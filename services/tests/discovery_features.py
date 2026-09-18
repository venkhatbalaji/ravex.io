"""Real Catalog/PostgreSQL discovery contract checks through Gateway and service."""
import datetime
import uuid
from urllib.parse import urlencode


def verify_discovery(call, expect, eventually, command, sql, endpoint, admin_token):
    gateway = endpoint("gateway")
    prefix = "Discovery-" + uuid.uuid4().hex[:10]
    category = expect(call(gateway, "/categories", {"name": prefix}, admin_token), 201)
    future = (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=2)).isoformat()

    def create(title, category_id=None, description=""):
        return expect(call(gateway, "/markets", {"title": title, "description": description,
            "eventStartAt": future, "outcomes": ["Home", "Away"], "categoryId": category_id}, admin_token), 201)

    items = [create(f"{prefix} match {i}", category["id"]) for i in range(101)]
    literal = create(prefix + " 100%_\\", description="Unique description " + prefix)
    live = create(prefix + " started")
    sql(f'''UPDATE market_catalog.markets SET "EventStartAt"=NOW()-INTERVAL '1 minute' WHERE "Id"='{live["id"]}' ''')
    locked = create(prefix + " locked")
    expect(call(gateway, f'/markets/{locked["id"]}/lock', {}, admin_token), 200)
    cancelled = create(prefix + " cancelled")
    expect(call(gateway, f'/markets/{cancelled["id"]}/cancel', {"reason": "Discovery fixture cancellation"}, admin_token), 200)
    eventually(lambda: expect(call(gateway, f'/markets/{cancelled["id"]}'), 200)["status"] == "cancelled", "cancel did not complete")

    def browse(base=gateway, **filters):
        return expect(call(base, "/markets/browse?" + urlencode({"search": prefix, **filters})), 200)

    default = browse()
    assert len(default["items"]) == 20 and default["nextOffset"] == 20 and default["observedAt"]
    first = browse(categoryId=category["id"], limit=100)
    second = browse(categoryId=category["id"], limit=100, offset=first["nextOffset"])
    found = [m["id"] for m in first["items"] + second["items"]]
    assert found == sorted(m["id"] for m in items), found
    assert len(found) == len(set(found)) == 101 and second["nextOffset"] is None
    assert browse(categoryId=category["id"], offset=1000)["items"] == []
    assert browse(categoryId=str(uuid.uuid4()))["items"] == []
    assert len(browse(search=prefix.lower(), phase="UPCOMING", categoryId=category["id"])["items"]) == 20
    assert [m["id"] for m in browse(phase="live")["items"]] == [live["id"]]
    assert [m["id"] for m in browse(phase="completed")["items"]] == [cancelled["id"]]
    assert [m["id"] for m in browse(status="locked", phase="upcoming")["items"]] == [locked["id"]]
    assert browse(status="locked", phase="completed")["items"] == []
    assert browse(phase="processing")["items"] == []
    assert [m["id"] for m in browse(search=prefix + " 100%_\\")["items"]] == [literal["id"]]
    assert [m["id"] for m in browse(search="Unique description " + prefix)["items"]] == [literal["id"]]
    for base in [gateway, endpoint("market-catalog")]:
        legacy = expect(call(base, "/markets?" + urlencode({"search": prefix})), 200)
        assert isinstance(legacy, list) and len(legacy) == 100
        assert len(browse(base, limit=100)["items"]) == 100
        for query in ["limit=0", "limit=101", "offset=-1", "offset=1000001", "status=invalid", "status=99", "status=0", "phase=invalid", "phase=0", "search=" + "x" * 101]:
            for path in ["/markets?", "/markets/browse?"]:
                expect(call(base, path + query), 400)
    # Processing results must be found even beyond the unfiltered first page.
    command("stop", "wallet-ledger")
    try:
        expect(call(gateway, f'/markets/{locked["id"]}/settle', {
            "winningOutcomeId": locked["outcomes"][0]["id"], "source": "Discovery result evidence"}, admin_token), 200)
        expect(call(gateway, f'/markets/{live["id"]}/cancel', {"reason": "Discovery refund evidence"}, admin_token), 200)
        processing = browse(phase="processing", limit=1)
        assert [m["id"] for m in processing["items"]] == [locked["id"]] and processing["nextOffset"] == 1
        last = browse(phase="processing", limit=1, offset=1)
        assert [m["id"] for m in last["items"]] == [live["id"]] and last["nextOffset"] is None
        assert live["id"] not in [m["id"] for m in browse(limit=100)["items"]]
    finally:
        command("start", "wallet-ledger")
    eventually(lambda: browse(phase="processing")["items"] == [], "processing markets did not recover")
    print("PASS: bounded catalog lists, stable pagination, combined filters, literal search, phases and validation", flush=True)
