"""Real-service checks for readiness and the protected recovery backlog."""
import concurrent.futures
import datetime
import time
import uuid


def verify_operations(call, expect, eventually, command, endpoint, sql, admin_token, player):
    names = ("identity", "wallet-ledger", "market-catalog", "branding", "settlement-engine", "gateway")
    bases = {name: endpoint(name) for name in names}
    gateway, settlement = bases["gateway"], bases["settlement-engine"]
    for base in bases.values():
        eventually(lambda: call(base, "/health/ready")[0] == 200, "readiness did not become healthy")
    _, player_token = player()
    for base in (gateway, settlement):
        expect(call(base, "/operations/settlement"), 401)
        expect(call(base, "/operations/settlement", token=player_token), 403)
        for query in ("limit=0", "limit=101", "limit=", "offset=-1", "offset=1000001", "offset=bad"):
            expect(call(base, "/operations/settlement?" + query, token=admin_token), 400)
    initial = expect(call(gateway, "/operations/settlement", token=admin_token), 200)
    assert initial["pendingDebits"] == initial["pendingResolutions"] == 0, initial
    assert initial["oldestPendingAt"] is None and initial["items"] == [] and initial["nextOffset"] is None

    # Freeze recovery while adding a reproducible backlog in the disposable DB.
    # Fixture rows are removed before restarting workers; they must never debit.
    command("stop", "settlement-engine")
    command("stop", "wallet-ledger")
    market, user, outcome = (str(uuid.uuid4()) for _ in range(3))
    ids = [str(uuid.uuid4()) for _ in range(3)]
    try:
        sql(f"INSERT INTO settlement.market_gates(market_id) VALUES ('{market}')")
        for index, operation in enumerate(ids):
            sql(f"INSERT INTO settlement.stakes(id,user_id,idempotency_key,market_id,outcome_id,amount,created_at) VALUES ('{operation}','{user}','{uuid.uuid4()}','{market}','{outcome}',10,now()-interval '{10-index} minutes')")
        command("start", "settlement-engine")
        eventually(lambda: call(settlement, "/health/ready")[0] == 200, "settlement did not start")
        first = expect(call(gateway, "/operations/settlement?limit=2", token=admin_token), 200)
        assert first["pendingDebits"] == 3 and first["pendingResolutions"] == 0
        assert [i["id"] for i in first["items"]] == ids[:2] and first["nextOffset"] == 2
        second = expect(call(gateway, "/operations/settlement?limit=2&offset=2", token=admin_token), 200)
        assert [i["id"] for i in second["items"]] == ids[2:] and second["nextOffset"] is None
        for item in first["items"] + second["items"]:
            assert set(item) == {"id", "marketId", "kind", "amount", "createdAt", "updatedAt"}
            assert item["kind"] == "debit"
        age = datetime.datetime.fromisoformat(first["observedAt"].replace("Z", "+00:00")) - datetime.datetime.fromisoformat(first["oldestPendingAt"].replace("Z", "+00:00"))
        assert age.total_seconds() >= 600
    finally:
        command("stop", "settlement-engine")
        sql(f"DELETE FROM settlement.stakes WHERE market_id='{market}'; DELETE FROM settlement.market_gates WHERE market_id='{market}'")
        command("start", "wallet-ledger", "settlement-engine")
    eventually(lambda: call(gateway, "/health/ready")[0] == 200, "services did not recover")
    assert expect(call(gateway, "/operations/settlement", token=admin_token), 200)["items"] == []
    print("PASS: protected operational backlog, stable age, pagination, and privacy", flush=True)

    # Pause rather than stop: the test database is tmpfs and must retain its data.
    command("pause", "postgres")
    try:
        started = time.monotonic()
        def probe(base):
            expect(call(base, "/health"), 200)
            try:
                body = expect(call(base, "/health/ready"), 503)
                assert body["status"] == "not_ready"
            except Exception as error:
                raise AssertionError(f"Readiness failure for {base}: {error}") from error
        with concurrent.futures.ThreadPoolExecutor(max_workers=len(bases)) as executor:
            list(executor.map(probe, bases.values()))
        assert time.monotonic() - started < 15, "readiness probes were not bounded"
    finally:
        command("unpause", "postgres")
    for base in bases.values():
        eventually(lambda: call(base, "/health/ready")[0] == 200, "readiness did not recover after database outage")
    print("PASS: database outage fails readiness, preserves liveness, and recovers", flush=True)
