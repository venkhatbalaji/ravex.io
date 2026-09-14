#!/usr/bin/env python3
"""Run with Python 3; creates and removes its own isolated Compose project.
Use --project NAME to exercise an already-running test project without cleanup.
"""
from product_features import verify_product_features
from operations_features import verify_operations
import argparse
import concurrent.futures
import datetime
import json
import pathlib
import os
import subprocess
import time
import urllib.error
import urllib.request
import uuid

ROOT = pathlib.Path(__file__).resolve().parents[2]
KEY = "integration-only-service-key-32-characters"
ADMIN_EMAIL = "admin@integration.test"
ADMIN_PASSWORD = "integration-only-admin-password-123"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--project")
    parser.add_argument("--ui", action="store_true", help="Also run the real admin/platform browser journey")
    args = parser.parse_args()
    project = args.project or "ravex-stakes-test-" + uuid.uuid4().hex[:8]
    compose = ["docker", "compose", "-p", project, "-f", str(ROOT / "services/tests/compose.yml")]

    endpoint_cache, known_endpoints = {}, {}

    def command(*parts, capture=False):
        result = subprocess.run(compose + list(parts), check=True, text=True, capture_output=capture)
        if parts[0] in ("start", "restart", "up"):
            endpoint_cache.clear()
        return result.stdout.strip() if capture else None

    def endpoint(service):
        if service not in endpoint_cache:
            endpoint_cache[service] = "http://" + command("port", service, "8080", capture=True).splitlines()[0]
            known_endpoints[endpoint_cache[service]] = service
        return endpoint_cache[service]

    def sql(statement):
        return command("exec", "-T", "postgres", "psql", "-U", "ravex", "-d", "ravex", "-At", "-v", "ON_ERROR_STOP=1", "-c", statement, capture=True)

    def call(base, path, body=None, token=None, headers=None, method=None):
        if base in known_endpoints:
            base = endpoint(known_endpoints[base])
        actual = {"Content-Type": "application/json", **(headers or {})}
        if token:
            actual["Authorization"] = "Bearer " + token
        req = urllib.request.Request(base + path, data=json.dumps(body).encode() if body is not None else None, headers=actual, method=method)
        try:
            with urllib.request.urlopen(req, timeout=20) as response:
                raw = response.read()
                return response.status, json.loads(raw) if raw else None
        except urllib.error.HTTPError as error:
            raw = error.read()
            return error.code, json.loads(raw) if raw else None

    def expect(result, status):
        assert result[0] == status, (result, status)
        return result[1]

    def eventually(check, description):
        deadline = time.monotonic() + 40
        while time.monotonic() < deadline:
            try:
                if check():
                    return
            except (OSError, AssertionError, json.JSONDecodeError):
                pass
            time.sleep(0.3)
        raise AssertionError(description)

    try:
        if not args.project:
            command("up", "-d", "--build")
        gateway, wallet, settlement = map(endpoint, ["gateway", "wallet-ledger", "settlement-engine"])
        eventually(lambda: call(gateway, "/markets")[0] == 200 and call(wallet, "/health")[0] == 200 and call(settlement, "/health")[0] == 200, "services did not become ready")
        # Identity's controlled bootstrap (ADMIN_BOOTSTRAP_EMAIL/PASSWORD in compose.yml)
        # is the only way this token exists — market create/lock/settle are admin-only.
        admin_token = expect(call(gateway, "/auth/login", {"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}), 200)["accessToken"]

        def player():
            email = f"stakes-{uuid.uuid4().hex}@example.test"
            expect(call(gateway, "/auth/register", {"email": email, "password": "integration-password-123", "displayName": "Stake Test"}), 201)
            login = expect(call(gateway, "/auth/login", {"email": email, "password": "integration-password-123"}), 200)
            return login["user"]["id"], login["accessToken"]

        def market():
            future = (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=2)).isoformat()
            return expect(call(gateway, "/markets", {"title": "Durable stake test", "eventStartAt": future, "outcomes": ["Home", "Away"]}, admin_token), 201)

        def lock(market_id):
            return call(gateway, f"/markets/{market_id}/lock", {}, admin_token)

        def predict(token, item, key, amount=10):
            return call(gateway, f'/pools/{item["id"]}/stakes', {"outcomeId": item["outcomes"][0]["id"], "amount": amount}, token, {"Idempotency-Key": key})

        def balance(token):
            return expect(call(gateway, "/wallet/me/balance", token=token), 200)["balance"]

        def parallel(function, count=12):
            with concurrent.futures.ThreadPoolExecutor(max_workers=count) as executor:
                return list(executor.map(lambda _: function(), range(count)))

        preflight = urllib.request.Request(gateway + "/pools/" + str(uuid.uuid4()) + "/stakes", method="OPTIONS", headers={
            "Origin": "http://localhost:3001", "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "authorization,content-type,idempotency-key",
        })
        with urllib.request.urlopen(preflight) as response:
            assert response.headers["Access-Control-Allow-Origin"] == "http://localhost:3001"
            assert "idempotency-key" in response.headers["Access-Control-Allow-Headers"].lower()
        preflight.add_header("Origin", "https://untrusted.example")
        with urllib.request.urlopen(preflight) as response:
            assert response.headers.get("Access-Control-Allow-Origin") is None
        print("PASS: browser preflight permits only the configured platform origin", flush=True)

        user, token = player()
        claims = parallel(lambda: call(gateway, "/wallet/me/earn", {"reason": "daily_login"}, token))
        assert sum(code == 200 for code, _ in claims) == 1, claims
        assert all(code in (200, 409) for code, _ in claims), claims
        assert balance(token) == 50
        print("PASS: concurrent daily claims credit once", flush=True)

        item = market()
        payload = {"outcomeId": item["outcomes"][0]["id"], "amount": 10}
        expect(call(settlement, f'/pools/{item["id"]}/stakes', payload), 401)
        expect(call(settlement, f'/pools/{item["id"]}/stakes', payload, "forged-token"), 401)
        expect(call(gateway, f'/pools/{item["id"]}/stakes', payload, token), 400)
        expect(call(wallet, "/wallet/me/stake", payload, token), 404)
        expect(call(wallet, f"/internal/stakes/{uuid.uuid4()}", {"userId": user, "marketId": item["id"], **payload}, token), 401)
        expect(call(settlement, f'/internal/pools/{item["id"]}/close', {}), 401)
        print("PASS: service authorization and required idempotency key", flush=True)

        key = str(uuid.uuid4())
        duplicates = parallel(lambda: predict(token, item, key))
        assert all(code in (200, 202) for code, _ in duplicates), duplicates
        assert len({body["stake"]["id"] for _, body in duplicates}) == 1
        eventually(lambda: predict(token, item, key)[0] == 200, "duplicate stake never completed")
        assert balance(token) == 40
        assert expect(call(gateway, f'/pools/{item["id"]}'), 200)["totalPool"] == 10
        expect(predict(token, item, key, 11), 409)
        expect(predict(token, market(), key), 409)
        expect(lock(item["id"]), 200)
        expect(predict(token, item, key), 200)
        expect(predict(token, item, str(uuid.uuid4())), 409)
        print("PASS: duplicate admission, payload conflicts, and replay after closure", flush=True)

        race_market = market()
        race_keys = [str(uuid.uuid4()) for _ in range(12)]
        with concurrent.futures.ThreadPoolExecutor(max_workers=12) as executor:
            results = list(executor.map(lambda k: predict(token, race_market, k), race_keys))
        assert all(code in (200, 202, 402) for code, _ in results), results
        eventually(lambda: all(predict(token, race_market, k)[0] in (200, 402) for k in race_keys), "concurrent stakes did not finish")
        assert balance(token) == 0
        assert expect(call(gateway, f'/pools/{race_market["id"]}'), 200)["totalPool"] == 40
        print("PASS: parallel stakes cannot overdraw the wallet", flush=True)

        recovery_user, recovery_token = player()
        expect(call(gateway, "/wallet/me/earn", {"reason": "daily_login"}, recovery_token), 200)
        rejected_id = str(uuid.uuid4())
        debit_payload = {"userId": recovery_user, "marketId": item["id"], "outcomeId": item["outcomes"][0]["id"], "amount": 1000}
        rejected = expect(call(wallet, f"/internal/stakes/{rejected_id}", debit_payload, headers={"X-Service-Key": KEY}), 402)
        expect(call(gateway, "/wallet/me/earn", {"reason": "referral"}, recovery_token), 200)
        assert expect(call(wallet, f"/internal/stakes/{rejected_id}", debit_payload, headers={"X-Service-Key": KEY}), 402) == rejected
        expect(call(wallet, f"/internal/stakes/{rejected_id}", {**debit_payload, "amount": 1}, headers={"X-Service-Key": KEY}), 409)
        print("PASS: wallet rejection is durable and conflicting replay is rejected", flush=True)

        recovery_market = market()
        recovery_key, stake_id = str(uuid.uuid4()), str(uuid.uuid4())
        command("stop", "settlement-engine")
        # Model process death after admission and wallet commit, before recording
        # acceptance. No user bearer token is stored in the durable intent.
        sql(f"INSERT INTO settlement.market_gates (market_id) VALUES ('{recovery_market['id']}'); INSERT INTO settlement.stakes (id,user_id,idempotency_key,market_id,outcome_id,amount) VALUES ('{stake_id}','{recovery_user}','{recovery_key}','{recovery_market['id']}','{recovery_market['outcomes'][0]['id']}',10)")
        debit_payload = {"userId": recovery_user, "marketId": recovery_market["id"], "outcomeId": recovery_market["outcomes"][0]["id"], "amount": 10}
        decision = expect(call(wallet, f"/internal/stakes/{stake_id}", debit_payload, headers={"X-Service-Key": KEY}), 200)
        assert balance(recovery_token) == 140
        command("start", "settlement-engine")
        eventually(lambda: (call(gateway, f'/pools/{recovery_market["id"]}')[1] or {}).get("totalPool") == 10, "worker did not recover committed debit")
        assert balance(recovery_token) == 140
        assert expect(call(wallet, f"/internal/stakes/{stake_id}", debit_payload, headers={"X-Service-Key": KEY}), 200) == decision
        expect(predict(recovery_token, recovery_market, recovery_key), 200)
        print("PASS: restart recovers a committed debit without a second charge", flush=True)

        outage_market, outage_key = market(), str(uuid.uuid4())
        command("stop", "wallet-ledger")
        pending = expect(predict(recovery_token, outage_market, outage_key), 202)
        assert pending["stake"]["state"] == "pending"
        expect(lock(outage_market["id"]), 409)
        expect(predict(recovery_token, outage_market, str(uuid.uuid4())), 409)
        command("start", "wallet-ledger")
        eventually(lambda: predict(recovery_token, outage_market, outage_key)[0] == 200, "pending stake not recovered after wallet outage")
        expect(lock(outage_market["id"]), 200)
        assert balance(recovery_token) == 130
        command("restart", "settlement-engine", "wallet-ledger")
        eventually(lambda: predict(recovery_token, outage_market, outage_key)[0] == 200 and balance(recovery_token) == 130, "restart lost durable result")
        print("PASS: outage recovery, market drain, and repeated restart", flush=True)

        verify_product_features(call, expect, eventually, command, sql, endpoint, gateway, wallet, settlement, admin_token, player, market, predict, balance, lock, KEY)

        assert sql('SELECT COUNT(*) FROM (SELECT "TransactionId" FROM wallet.ledger_entries GROUP BY "TransactionId" HAVING SUM("Amount") <> 0 OR COUNT(*) <> 2) bad') == "0"
        assert sql('SELECT COUNT(*) FROM (SELECT a."Id" FROM wallet.accounts a JOIN wallet.ledger_entries e ON e."AccountId"=a."Id" WHERE a."OwnerType"=\'User\' GROUP BY a."Id" HAVING SUM(e."Amount") < 0) bad') == "0"
        accepted = sql("SELECT COALESCE(SUM(amount),0) FROM settlement.stakes WHERE state='accepted'")
        escrow = sql('SELECT COALESCE(SUM("Amount"),0) FROM wallet.ledger_entries WHERE "AccountId"=\'00000000-0000-0000-0000-000000000002\'')
        paid = sql('SELECT COALESCE(SUM("Total"),0) FROM wallet.settlement_receipts')
        assert int(accepted) - int(paid) == int(escrow), (accepted, paid, escrow)
        print("PASS: double-entry ledger and accepted-stake escrow reconcile", flush=True)

        verify_operations(call, expect, eventually, command, endpoint, sql, admin_token, player)

        if not args.project:
            command("exec", "-T", "postgres", "createdb", "-U", "ravex", "settlement_tests")
            command("run", "--rm", "go-tests")
        if args.ui:
            # Next regenerates these when the test server uses .next-e2e.
            generated = [ROOT / "apps" / app / name
                         for app in ("admin", "platform")
                         for name in ("next-env.d.ts", "tsconfig.json")]
            originals = {path: path.read_bytes() if path.exists() else None for path in generated}
            try:
                subprocess.run(["npx", "playwright", "test"], cwd=ROOT, check=True,
                               env={**os.environ, "TEST_GATEWAY_URL": endpoint("gateway")})
            finally:
                for path, content in originals.items():
                    if content is None:
                        path.unlink(missing_ok=True)
                    else:
                        path.write_bytes(content)
        print("All product integration checks passed.", flush=True)
    except BaseException:
        command("logs", "--tail", "40")
        raise
    finally:
        if not args.project:
            command("down", "--volumes", "--remove-orphans")


if __name__ == "__main__":
    main()
