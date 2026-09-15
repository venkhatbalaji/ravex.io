"""Reward policy, claim availability and daily-reset integration checks."""
import datetime


def verify_rewards(call, expect, command, sql, endpoint, admin_token, player):
    gateway, wallet = endpoint("gateway"), endpoint("wallet-ledger")
    user, token = player()
    other, other_token = player()
    ledger_before = sql('SELECT COUNT(*) FROM wallet.ledger_entries')
    for base in (gateway, wallet):
        expect(call(base, "/wallet/me/rewards"), 401)
        status = expect(call(base, "/wallet/me/rewards", token=token), 200)
        assert status["items"] == [{"reason": "daily_login", "amount": 50, "available": True, "nextAvailableAt": None}], status
        for actor in (token, admin_token):
            for reason in ("rewarded_ad", "referral"):
                expect(call(base, "/wallet/me/earn", {"reason": reason, "verified": True, "eventId": "forged-event"}, actor), 403)
        for reason in ("DAILY_LOGIN", "unknown", "", None):
            expect(call(base, "/wallet/me/earn", {"reason": reason}, token), 400)
    assert sql('SELECT COUNT(*) FROM wallet.ledger_entries') == ledger_before
    assert sql(f'SELECT COUNT(*) FROM wallet.accounts WHERE "OwnerUserId"=\'{user}\'') == "0", "reward read created an account"

    result = expect(call(gateway, "/wallet/me/earn", {"reason": "daily_login", "amount": 1000000, "userId": other}, token), 200)
    assert result == {"credited": 50, "balance": 50}, result
    assert expect(call(gateway, "/wallet/me/balance", token=other_token), 200)["balance"] == 0
    status = expect(call(gateway, "/wallet/me/rewards", token=token), 200)
    reward = status["items"][0]
    assert not reward["available"]
    observed = datetime.datetime.fromisoformat(status["observedAt"].replace("Z", "+00:00"))
    reset = datetime.datetime.fromisoformat(reward["nextAvailableAt"].replace("Z", "+00:00"))
    assert reset.hour == reset.minute == reset.second == 0 and 0 < (reset-observed).total_seconds() <= 86400
    expect(call(wallet, "/wallet/me/earn", {"reason": "daily_login"}, token), 409)
    command("restart", "wallet-ledger")
    # Reuse runner endpoint handling after Docker's ephemeral port changes.
    import time
    for attempt in range(40):
        try:
            status = expect(call(wallet, "/wallet/me/rewards", token=token), 200)
            break
        except OSError:
            if attempt == 39:
                raise
            time.sleep(0.3)
    assert not status["items"][0]["available"]
    expect(call(wallet, "/wallet/me/earn", {"reason": "daily_login"}, token), 409)

    # Move the test player's complete ledger pair to yesterday to exercise reset
    # without changing the host clock or leaving an unbalanced fixture.
    sql(f'''UPDATE wallet.ledger_entries SET "CreatedAt" = date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC' - interval '1 second'
        WHERE "TransactionId" IN (SELECT e."TransactionId" FROM wallet.ledger_entries e
        JOIN wallet.accounts a ON a."Id"=e."AccountId" WHERE a."OwnerUserId"='{user}' AND e."Reason"='daily_login')''')
    assert expect(call(gateway, "/wallet/me/rewards", token=token), 200)["items"][0]["available"]
    assert expect(call(gateway, "/wallet/me/earn", {"reason": "daily_login"}, token), 200)["balance"] == 100
    expect(call(gateway, "/wallet/me/earn", {"reason": "daily_login"}, token), 409)
    assert sql('SELECT COUNT(*) FROM (SELECT "TransactionId" FROM wallet.ledger_entries GROUP BY "TransactionId" HAVING SUM("Amount") <> 0 OR COUNT(*) <> 2) bad') == "0"
    print("PASS: unverified rewards denied, server-owned amounts, private availability, restart persistence, and UTC reset", flush=True)
