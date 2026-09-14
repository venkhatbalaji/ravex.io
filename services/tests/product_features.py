"""Product integration checks shared by the isolated lifecycle runner."""
import concurrent.futures
import json
import uuid


def verify_product_features(call, expect, eventually, command, sql, endpoint, gateway, wallet, settlement, admin_token, player, market, predict, balance, lock, service_key):
    a_id, a = player()
    b_id, b = player()
    c_id, c = player()
    for token in (a, b, c):
        expect(call(gateway, "/wallet/me/earn", {"reason": "daily_login"}, token), 200)
    catalog, branding = endpoint("market-catalog"), endpoint("branding")
    eventually(lambda: call(gateway, "/branding/theme")[0] == 200, "branding not ready")
    # Every owning service enforces the same role rule as Gateway.
    future_market = market()
    for base in (gateway, catalog):
        expect(call(base, f'/markets/{future_market["id"]}/lock', {}, a), 403)
        expect(call(base, "/categories", {"name": "Forbidden"}, a), 403)
    for base in (gateway, branding):
        expect(call(base, "/branding/copy/nav.linkMarkets", {"value": "Forbidden"}, a, method="PUT"), 403)
    for base in (gateway, settlement):
        expect(call(base, f'/pools/{future_market["id"]}/settle', {"winningOutcomeId": future_market["outcomes"][0]["id"]}, a), 403)
    expect(call(settlement, f'/internal/pools/{future_market["id"]}/resolve', {}), 401)
    print("PASS: admin roles enforced at gateway and owning services", flush=True)

    category = expect(call(gateway, "/categories", {"name": "Cricket " + uuid.uuid4().hex[:6]}, admin_token), 201)
    renamed = expect(call(gateway, f'/categories/{category["id"]}', {"name": "International cricket"}, admin_token, method="PUT"), 200)
    assert renamed["name"] == "International cricket"
    tagged = expect(call(gateway, "/markets", {"title": "Categorized match", "eventStartAt": future_market["eventStartAt"], "outcomes": ["A", "B"], "categoryId": category["id"]}, admin_token), 201)
    expect(call(gateway, f'/categories/{category["id"]}', token=admin_token, method="DELETE"), 204)
    assert expect(call(gateway, f'/markets/{tagged["id"]}'), 200)["categoryId"] is None
    theme = expect(call(gateway, "/branding/theme"), 200)
    changed = {**theme, "brandName": "Integration Cricket", "accentColor": "#123456", "font": "Poppins"}
    assert expect(call(gateway, "/branding/theme", changed, admin_token, method="PUT"), 200)["brandName"] == changed["brandName"]
    expect(call(gateway, "/branding/theme", {**changed, "accentColor": "invalid"}, admin_token, method="PUT"), 400)
    expect(call(gateway, "/branding/copy/nav.linkMarkets", {"value": "Matches"}, admin_token, method="PUT"), 200)
    assert any(row["key"] == "nav.linkMarkets" and row["value"] == "Matches" for row in expect(call(gateway, "/branding/copy"), 200))
    command("restart", "branding")
    eventually(lambda: expect(call(gateway, "/branding/theme"), 200)["brandName"] == changed["brandName"], "branding lost its theme on restart")
    expect(call(gateway, "/branding/copy/nav.linkMarkets", token=admin_token, method="DELETE"), 204)
    expect(call(gateway, "/branding/theme", theme, admin_token, method="PUT"), 200)
    print("PASS: categories, brand validation, copy overrides, and branding persistence", flush=True)

    def stake(token, item, amount, outcome=0):
        key = str(uuid.uuid4())
        body = {"outcomeId": item["outcomes"][outcome]["id"], "amount": amount}
        result = call(gateway, f'/pools/{item["id"]}/stakes', body, token, {"Idempotency-Key": key})
        assert result[0] in (200, 202), result
        eventually(lambda: call(gateway, f'/pools/{item["id"]}/stakes', body, token, {"Idempotency-Key": key})[0] == 200, "stake did not complete")
        return result[1]["stake"]["id"]

    def result(item, winner=0, source="Official scorecard: home team won"):
        return call(gateway, f'/markets/{item["id"]}/settle', {"winningOutcomeId": item["outcomes"][winner]["id"], "source": source}, admin_token)

    def finished(item, status="settled"):
        eventually(lambda: expect(call(gateway, f'/markets/{item["id"]}'), 200)["status"] == status, "market resolution did not complete")

    main = market()
    expect(result(main), 409)
    a_stake, b_stake, c_stake = stake(a, main, 2), stake(b, main, 3), stake(c, main, 6, 1)
    expect(lock(main["id"]), 200)
    expect(result(main, source=""), 400)
    assert expect(result(main), 200)["status"] == "settling"
    finished(main)
    # Pool 11 / winning pool 5: exact payouts 4.4 and 6.6 => 4 and 7.
    assert [balance(t) for t in (a, b, c)] == [52, 54, 44]
    resolved = expect(call(gateway, f'/markets/{main["id"]}'), 200)
    assert resolved["resolvedBy"] and resolved["resolvedAt"] and resolved["resultSource"]
    for _ in range(3):
        expect(result(main), 200)
    expect(result(main, 1), 409)
    expect(call(gateway, f'/markets/{main["id"]}/cancel', {"reason": "Changed my mind"}, admin_token), 409)
    assert [balance(t) for t in (a, b, c)] == [52, 54, 44]
    print("PASS: exact winner payouts, losing stakes, immutable evidence, and repeated resolution", flush=True)

    competing = market()
    stake(c, competing, 2)
    expect(lock(competing["id"]), 200)
    before = balance(c)
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        decisions = list(executor.map(lambda winner: result(competing, winner, "Concurrent scorecard decision"), (0, 1)))
    assert sorted(code for code, _ in decisions) == [200, 409], decisions
    finished(competing)
    assert balance(c) == before + 2  # sole winner or zero-winner refund
    assert sql(f"SELECT COUNT(*) FROM wallet.settlement_receipts WHERE \"Id\"='{competing['id']}'") == "1"
    print("PASS: competing result submissions choose one immutable decision", flush=True)


    refund = market()
    stake(a, refund, 5)
    stake(b, refund, 7)
    cancel = {"reason": "Match abandoned due to rain"}
    assert expect(call(gateway, f'/markets/{refund["id"]}/cancel', cancel, admin_token), 200)["status"] == "refunding"
    finished(refund, "cancelled")
    expect(call(gateway, f'/markets/{refund["id"]}/cancel', cancel, admin_token), 200)
    assert [balance(t) for t in (a, b)] == [52, 54]
    no_winner = market()
    stake(a, no_winner, 4)
    stake(b, no_winner, 3)
    expect(lock(no_winner["id"]), 200)
    expect(result(no_winner, 1, "Away team won; no stakes on away"), 200)
    finished(no_winner)
    assert [balance(t) for t in (a, b)] == [52, 54]
    empty = market()
    expect(call(gateway, f'/markets/{empty["id"]}/cancel', cancel, admin_token), 200)
    finished(empty, "cancelled")
    print("PASS: cancelled, empty, and unbacked-winning markets refund correctly", flush=True)

    recovering = market()
    stake(a, recovering, 6)
    stake(b, recovering, 4, 1)
    expect(lock(recovering["id"]), 200)
    command("stop", "wallet-ledger")
    expect(result(recovering), 200)
    eventually(lambda: sql(f"SELECT COUNT(*) FROM settlement.resolutions WHERE market_id='{recovering['id']}'") == "1", "payout plan was not persisted during wallet outage")
    backlog = expect(call(gateway, "/operations/settlement", token=admin_token), 200)
    operation = next(row for row in backlog["items"] if row["marketId"] == recovering["id"])
    assert operation["kind"] == "payout" and operation["amount"] == 10
    assert backlog["pendingResolutions"] >= 1
    history = expect(call(gateway, "/predictions/me", token=a), 200)["items"]
    assert next(p for p in history if p["marketId"] == recovering["id"])["result"] == "processing"
    command("stop", "market-catalog", "settlement-engine")
    command("start", "wallet-ledger")
    eventually(lambda: call(wallet, "/health")[0] == 200, "wallet did not restart")
    plan = json.loads(sql(f"SELECT plan FROM settlement.resolutions WHERE market_id='{recovering['id']}'"))
    payment = {"kind": plan["kind"], "payouts": plan["payouts"]}
    receipt = expect(call(wallet, f'/internal/settlements/{recovering["id"]}', payment, headers={"X-Service-Key": service_key}), 200)
    assert [balance(t) for t in (a, b)] == [56, 50]
    # Payment committed while both orchestrators were stopped. Restart must
    # recognize that receipt and finish without paying again.
    command("start", "settlement-engine", "market-catalog")
    finished(recovering)
    assert not any(row["marketId"] == recovering["id"] for row in expect(call(gateway, "/operations/settlement", token=admin_token), 200)["items"])
    assert [balance(t) for t in (a, b)] == [56, 50]
    assert expect(call(wallet, f'/internal/settlements/{recovering["id"]}', payment, headers={"X-Service-Key": service_key}), 200) == receipt
    conflict = {"kind": "refund", "payouts": plan["payouts"]}
    expect(call(wallet, f'/internal/settlements/{recovering["id"]}', conflict, headers={"X-Service-Key": service_key}), 409)
    expect(call(wallet, f'/internal/settlements/{recovering["id"]}', payment, token=a), 401)
    print("PASS: payout commit with lost acknowledgement recovers once after restart", flush=True)

    history_a = expect(call(gateway, "/predictions/me", token=a), 200)
    history_b = expect(call(gateway, "/predictions/me", token=b), 200)
    history_c = expect(call(gateway, "/predictions/me", token=c), 200)
    assert any(p["id"] == a_stake and p["result"] == "won" and p["payout"] == 4 for p in history_a["items"])
    assert any(p["id"] == b_stake and p["result"] == "won" and p["payout"] == 7 for p in history_b["items"])
    assert any(p["id"] == c_stake and p["result"] == "lost" and p["payout"] == 0 for p in history_c["items"])
    assert any(p["result"] == "refunded" for p in history_a["items"])
    assert not ({p["id"] for p in history_a["items"]} & {p["id"] for p in history_b["items"]})
    first = expect(call(gateway, "/predictions/me?limit=1", token=a), 200)
    second = expect(call(gateway, f'/predictions/me?limit=1&offset={first["nextOffset"]}', token=a), 200)
    assert first["items"][0]["id"] != second["items"][0]["id"]
    expect(call(settlement, "/predictions/me"), 401)
    expect(call(gateway, "/predictions/me?limit=1000", token=a), 400)
    print("PASS: private player history, payout results, and pagination", flush=True)
