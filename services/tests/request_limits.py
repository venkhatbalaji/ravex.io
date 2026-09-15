"""Exercise real gateway limits independently of high-volume regression tests."""
import json
import time
import urllib.error
import urllib.request
import uuid


def verify_request_limits(call, expect, eventually, endpoint, player, market):
    limited, gateway = endpoint("limited-gateway"), endpoint("gateway")
    eventually(lambda: call(limited, "/health/ready")[0] == 200, "limited gateway did not become ready")

    def throttled(path, body, token=None, extra=None):
        headers = {"Content-Type": "application/json", "Origin": "http://localhost:3001", **(extra or {})}
        if token:
            headers["Authorization"] = "Bearer " + token
        request = urllib.request.Request(limited + path, data=json.dumps(body).encode(), headers=headers)
        try:
            urllib.request.urlopen(request, timeout=15).close()
            raise AssertionError("Expected a throttled request")
        except urllib.error.HTTPError as error:
            assert error.code == 429, error.code
            payload = json.loads(error.read())
            delay = int(error.headers["Retry-After"])
            assert 1 <= delay <= 10 and payload["retryAfterSeconds"] == delay
            assert error.headers["Cache-Control"] == "no-store"
            assert "retry-after" in error.headers["Access-Control-Expose-Headers"].lower()
            return delay

    credentials = {"email": "missing@example.test", "password": "invalid-test-password"}
    for _ in range(3):
        expect(call(limited, "/auth/login", credentials), 401)
    throttled("/auth/login", credentials, extra={"X-Forwarded-For": "203.0.113.7", "X-Real-IP": "203.0.113.8"})
    # Case and trailing-slash variations share the authentication prefix quota.
    throttled("/AUTH/login/", credentials)

    user, token = player()
    _, other = player()
    claim = {"reason": "daily_login"}
    expect(call(limited, "/wallet/me/earn", claim, token), 200)
    for _ in range(2):
        expect(call(limited, "/wallet/me/earn", claim, token), 409)
    throttled("/wallet/me/earn", claim, token)
    expect(call(limited, "/wallet/me/earn", claim, other), 200)
    me = expect(call(gateway, "/me", token=token), 200)
    refreshed = expect(call(gateway, "/auth/login", {"email": me["email"], "password": "integration-password-123"}), 200)["accessToken"]
    throttled("/wallet/me/earn", claim, refreshed)

    item, key = market(), str(uuid.uuid4())
    stake = {"outcomeId": item["outcomes"][0]["id"], "amount": 10}
    path = f'/pools/{item["id"]}/stakes'
    for _ in range(3):
        response = call(limited, path, stake, token, {"Idempotency-Key": key})
        assert response[0] in (200, 202), response
    throttled(path, stake, token, {"Idempotency-Key": key})
    for _ in range(4):
        expect(call(limited, "/health"), 200)
        assert expect(call(limited, "/wallet/me/balance", token=token), 200)["balance"] == 40
    # Every consumed partition replenishes; retrying preserves the original debit.
    time.sleep(11)
    expect(call(limited, "/auth/login", credentials), 401)
    expect(call(limited, "/wallet/me/earn", claim, token), 409)
    expect(call(limited, path, stake, token, {"Idempotency-Key": key}), 200)
    assert expect(call(limited, "/wallet/me/balance", token=token), 200)["balance"] == 40
    print("PASS: request quotas, spoof resistance, per-user isolation, Retry-After, and safe retry after reset", flush=True)
