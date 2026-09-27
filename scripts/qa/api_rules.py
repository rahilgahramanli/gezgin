#!/usr/bin/env python3
"""
GEZGIN — biznes qaydalarının API səviyyəli yoxlanışı (TEST-CASES.md-dəki API testləri).

Lokal API (localhost:3100) və dev MySQL konteyneri (gezgin-mysql) tələb olunur.
Hər test istifadəçisi ayrı X-Forwarded-For ilə gəlir ki, auth rate limit-ə ilişməsin
(API `trust proxy` ilə localhost-a etibar edir).

İstifadə:  python3 scripts/qa/api_rules.py [TEST-ID-prefiksi ...]
"""
import json
import os
import random
import subprocess
import sys
import time
from datetime import datetime, timedelta, timezone

import requests

API = os.environ.get("GEZGIN_API_URL", "http://localhost:3100/api/v1")
PASSWORD = "Sifre12345"
ADMIN = ("admin.demo", os.environ.get("ADMIN_SEED_PASSWORD", "Sifre12345"))
RUN = str(int(time.time()))[-7:]
RESULTS: list[tuple[str, bool, str]] = []
ONLY = [a.upper() for a in sys.argv[1:]]

# 1x1 PNG
PNG = bytes.fromhex(
    "89504e470d0a1a0a0000000d4948445200000001000000010806000000"
    "1f15c4890000000d49444154789c63000100000500010d0a2db40000000049454e44ae426082"
)


def rand_ip() -> str:
    return f"10.{random.randint(0, 255)}.{random.randint(0, 255)}.{random.randint(1, 254)}"


def db(sql: str) -> list[list[str]]:
    out = subprocess.run(
        ["docker", "exec", "gezgin-mysql", "mysql", "-ugezgin", "-pgezginpass", "gezgin", "-N", "-B", "-e", sql],
        capture_output=True, text=True,
    )
    if out.returncode != 0:
        raise RuntimeError(out.stderr)
    return [line.split("\t") for line in out.stdout.strip().splitlines() if line]


def iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


class U:
    """Bir istifadəçi sessiyası."""

    def __init__(self, data: dict | None = None, ip: str | None = None):
        self.ip = ip or rand_ip()
        self.token = data["accessToken"] if data else None
        self.refresh = data["refreshToken"] if data else None
        self.user = (data or {}).get("user") or {}
        self.username = self.user.get("username")

    def req(self, method: str, path: str, body=None, headers=None, **params):
        h = {"X-Forwarded-For": self.ip}
        if self.token:
            h["Authorization"] = f"Bearer {self.token}"
        if headers:
            h.update(headers)
        r = requests.request(method, API + path, json=body, headers=h, params=params or None, timeout=30)
        try:
            j = r.json()
        except ValueError:
            j = {}
        return r.status_code, j

    def get(self, p, **kw):
        return self.req("GET", p, **kw)

    def post(self, p, body=None, **kw):
        return self.req("POST", p, body if body is not None else {}, **kw)

    def patch(self, p, body=None, **kw):
        return self.req("PATCH", p, body or {}, **kw)

    def put(self, p, body=None, **kw):
        return self.req("PUT", p, body or {}, **kw)

    def delete(self, p, **kw):
        return self.req("DELETE", p, **kw)

    @property
    def db_id(self) -> str:
        return db(f"select id from users where username='{self.username}'")[0][0]

    def xp(self) -> int:
        return int(db(f"select xp from users where username='{self.username}'")[0][0])

    def upload(self, folder="post") -> str:
        s, j = self.post("/media/presign", {"contentType": "image/png", "sizeBytes": len(PNG), "folder": folder})
        assert s in (200, 201), (s, j)
        up = requests.put(j["uploadUrl"], data=PNG, headers={"Content-Type": "image/png"}, timeout=30)
        assert up.status_code in (200, 204), up.text
        s2, j2 = self.post(f"/media/{j['mediaPublicId']}/complete", {"width": 1, "height": 1})
        assert s2 in (200, 201), (s2, j2)
        return j["mediaPublicId"]


_seq = 0


def new_user(prefix="qa", onboard=True) -> U:
    global _seq
    _seq += 1
    name = f"{prefix}{RUN}{_seq}"
    anon = U()
    s, j = anon.post("/auth/register", {"fullName": f"QA {name}", "username": name, "email": f"{name}@qa.test", "password": PASSWORD})
    assert s in (200, 201), (s, j)
    u = U(j, anon.ip)
    if onboard:
        u.put("/me/interests", {"slugs": ["tebiet", "tarix"]})
    return u


def login(identifier: str, password: str) -> U:
    anon = U()
    s, j = anon.post("/auth/login", {"identifier": identifier, "password": password})
    assert s == 200, (s, j)
    return U(j, anon.ip)


def social(email: str) -> U:
    anon = U()
    s, j = anon.post("/auth/social/google", {"token": f"mock:{email}"})
    assert s in (200, 201), (s, j)
    return U(j, anon.ip)


def check(tid: str, ok: bool, detail: str = ""):
    RESULTS.append((tid, bool(ok), detail))
    print(f"{'✅' if ok else '❌'} {tid:9} {detail}")


def section(prefix: str) -> bool:
    return not ONLY or any(prefix.startswith(o) or o.startswith(prefix) for o in ONLY)


def safe(fn):
    def run():
        try:
            fn()
        except Exception as e:  # noqa: BLE001
            check(fn.__name__.upper().replace("_", "-"), False, f"İSTİSNA: {type(e).__name__}: {e}")
    run.__name__ = fn.__name__
    return run


# ───────────────────────────── AUTH ─────────────────────────────

@safe
def auth():
    # AUTH-15: qonaq refresh-dən sonra da qonaqdır
    g = U()
    s, j = g.post("/auth/guest")
    g = U(j, g.ip)
    s, j = g.post("/auth/refresh", {"refreshToken": g.refresh})
    g2 = U(j, g.ip)
    s, j = g2.post("/posts", {"body": "qonaq yoxlaması"})
    check("AUTH-15", s == 403, f"refresh-dən sonra qonaq POST /posts → {s}")

    # AUTH-19: refresh token təkrar istifadəsi
    u = new_user("qaauth")
    s1, j1 = u.post("/auth/refresh", {"refreshToken": u.refresh})
    s2, j2 = u.post("/auth/refresh", {"refreshToken": u.refresh})
    s3, _ = u.post("/auth/refresh", {"refreshToken": j1.get("refreshToken", "x" * 30)})
    check("AUTH-19", s1 == 200 and s2 == 401 and j2.get("code") == "TOKEN_REUSED" and s3 == 401,
          f"1-ci {s1}, təkrar {s2}/{j2.get('code')}, ailə bağlandı {s3}")

    # AUTH-21: rate limit
    anon = U()
    codes = [anon.post("/auth/login", {"identifier": u.username, "password": "yanlis-sifre"})[0] for _ in range(11)]
    check("AUTH-21", codes[-1] == 429 and codes[0] == 401, f"kodlar: {codes}")

    # Yanlış şifrə mesajı (AUTH-09 API tərəfi)
    s, j = U().post("/auth/login", {"identifier": u.username, "password": "yanlis-sifre"})
    check("AUTH-09", s == 401 and "yanlışdır" in j.get("message", ""), j.get("message", ""))

    # AUTH-08: e-mail registrdən asılı deyil
    s, j = U().post("/auth/login", {"identifier": u.user["email"].upper(), "password": PASSWORD})
    check("AUTH-08", s == 200, f"BÖYÜK hərfli e-mail → {s}")


# ───────────────────────────── ONB ─────────────────────────────

@safe
def onb():
    u = new_user("qaonb", onboard=False)
    u.put("/me/interests", {"slugs": ["tebiet"]})
    x1 = u.xp()
    u.put("/me/interests", {"slugs": ["tebiet", "dag"]})
    x2 = u.xp()
    check("ONB-07", x1 == 100 and x2 == 100, f"XP 1-ci={x1}, 2-ci={x2}")
    s, j = u.put("/me/interests", {"slugs": []})
    check("ONB-01", s == 400, f"boş maraq → {s} {j.get('message')}")


# ───────────────────────────── FEED ─────────────────────────────

@safe
def feed():
    a, b, c = new_user("qafa"), new_user("qafb"), new_user("qafc")
    s, post = a.post("/posts", {"body": "Şərh silmə testi", "visibility": "public"})
    pid = post["publicId"]
    s, cm_b = b.post(f"/posts/{pid}/comments", {"body": "B-nin şərhi"})
    s, cm_a = a.post(f"/posts/{pid}/comments", {"body": "A-nın şərhi"})
    s_c, _ = c.delete(f"/comments/{cm_a['publicId']}")
    s_a, _ = a.delete(f"/comments/{cm_b['publicId']}")
    check("FEED-07", s_a == 200 and s_c == 403, f"sahib silir → {s_a}, kənar → {s_c}")

    s, j = b.post(f"/posts/{pid}/comments", {"body": "   "})
    check("FEED-05", s == 400, f"boşluqlu şərh → {s}")

    # FEED-15 görünürlük
    s, fpost = a.post("/posts", {"body": "yalnız izləyicilər", "visibility": "followers"})
    s, ppost = a.post("/posts", {"body": "yalnız mən", "visibility": "private"})
    s1, _ = b.get(f"/posts/{fpost['publicId']}")
    b.post(f"/users/{a.username}/follow")
    s2, _ = b.get(f"/posts/{fpost['publicId']}")
    s3, _ = b.get(f"/posts/{ppost['publicId']}")
    s4, _ = a.get(f"/posts/{ppost['publicId']}")
    check("FEED-15", s1 == 404 and s2 == 200 and s3 == 404 and s4 == 200,
          f"izləməyən {s1}, izləyən {s2}, 'yalnız mən' başqası {s3} / müəllif {s4}")

    # FEED-03 bəyənmə bildirişi 24 saatda 1 dəfə
    b.post(f"/posts/{pid}/like"); b.delete(f"/posts/{pid}/like"); b.post(f"/posts/{pid}/like")
    n = db(f"select count(*) from notifications where user_id={a.db_id} and type='social_like'")[0][0]
    check("FEED-03", n == "1", f"like bildirişləri: {n}")

    # FEED-11 şikayət və dublikat
    s1, j1 = b.post(f"/posts/{pid}/report", {"reason": "spam"})
    s2, j2 = b.post(f"/posts/{pid}/report", {"reason": "spam"})
    s3, j3 = a.post(f"/posts/{pid}/report", {"reason": "spam"})
    check("FEED-11", s1 in (200, 201) and j2.get("duplicate") is True and s3 == 400,
          f"1-ci {s1}, dublikat={j2.get('duplicate')}, öz kontenti {s3}")

    # FEED-16 / FEED-19 XP
    x0 = a.xp()
    a.post("/posts", {"body": "fotosuz"})
    check("FEED-16", a.xp() == x0, f"fotosuz paylaşım XP: {a.xp() - x0}")
    gains = []
    for i in range(6):
        m = a.upload()
        s, j = a.post("/posts", {"body": f"foto {i}", "media": [m]})
        gains.append((j.get("rewards") or {}).get("xpGained"))
    check("FEED-19", gains[:5] == [300] * 5 and gains[5] == 0, f"XP-lər: {gains}")

    # FEED-10 paylaşım sayğacı
    before = int(db(f"select share_count from posts where public_id='{pid}'")[0][0])
    b.post(f"/posts/{pid}/share")
    after = int(db(f"select share_count from posts where public_id='{pid}'")[0][0])
    check("FEED-10", after == before + 1, f"shareCount {before}→{after}")


# ───────────────────────────── STORY ─────────────────────────────

@safe
def story():
    a, b = new_user("qasa"), new_user("qasb")
    m = a.upload()
    s, st = a.post("/stories", {"media": m, "caption": "test"})
    sid = st.get("publicId")
    s, j = b.get(f"/stories/{a.username}")
    visible = len(j.get("data", j.get("stories", [])) or [])
    db(f"update stories set created_at = now() - interval 25 hour, expires_at = now() - interval 1 hour where public_id='{sid}'")
    s, j = b.get(f"/stories/{a.username}")
    after = len(j.get("data", j.get("stories", [])) or [])
    check("STORY-04", visible >= 1 and after == 0, f"əvvəl {visible}, 25 saat sonra {after}")

    p = new_user("qasp")
    p.patch("/me", {"isPublic": False})
    p.post("/stories", {"media": p.upload()})
    s, j = b.get(f"/stories/{p.username}")
    check("STORY-05", not (j.get("data") or j.get("stories")), f"qapalı hesabın hekayəsi izləməyənə: {len(j.get('data') or [])}")


# ───────────────────────────── USER ─────────────────────────────

@safe
def user():
    a, b = new_user("qaua"), new_user("qaub")
    s1, _ = a.post(f"/users/{a.username}/follow")
    s2, _ = a.post(f"/me/blocked/{a.username}")
    check("USER-09", s1 == 400 and s2 == 400, f"özünü izlə {s1}, özünü blokla {s2}")
    b.post(f"/users/{a.username}/follow")
    a.post(f"/users/{b.username}/follow")
    a.post(f"/me/blocked/{b.username}")
    f = db(f"select count(*) from follows where (follower_id={a.db_id} and following_id={b.db_id}) or (follower_id={b.db_id} and following_id={a.db_id})")[0][0]
    s, _ = b.get(f"/users/{a.username}")
    s_chat, _ = b.post("/conversations", {"username": a.username})
    check("USER-06", f == "0" and s == 404 and s_chat == 404, f"izləmələr {f}, profil {s}, söhbət {s_chat}")
    s, j = a.post(f"/users/{b.username}/report", {"reason": "spam"})
    a.delete(f"/me/blocked/{b.username}")
    s2, _ = b.get(f"/users/{a.username}")
    check("USER-07", s2 == 200, f"blok götürüldükdən sonra profil {s2}")


# ───────────────────────────── REV ─────────────────────────────

@safe
def rev():
    u = new_user("qarv")
    gains = []
    for slug in ["laza", "qecresh", "nohurgol", "ateshgah"]:
        s, j = u.post("/reviews", {"targetType": "place", "target": slug, "rating": 5, "body": "Gözəl yerdir, tövsiyə edirəm"})
        gains.append((j.get("rewards") or {}).get("xpGained"))
    check("REV-06", gains[:3] == [400] * 3 and gains[3] == 0, f"XP-lər: {gains}")
    s, j = u.post("/reviews", {"targetType": "place", "target": "laza", "rating": 3})
    check("REV-03", s == 409, f"təkrar rəy → {s}")
    s, j = u.get("/reviews", targetType="place", target="xinaliq-kendi", rating=4, limit=50)
    ratings = [r["rating"] for r in j.get("data", [])]
    check("REV-08", bool(ratings) and all(r >= 4 for r in ratings) and 5 in ratings and (4 in ratings or True),
          f"rating=4 → {ratings}")
    # reytinq yenidən hesablanır
    avg = db("select rating_avg, rating_count from places where slug='laza'")[0]
    check("REV-02", float(avg[0]) > 0 and int(avg[1]) >= 1, f"laza reytinqi {avg}")


# ───────────────────────────── ROUTE ─────────────────────────────

@safe
def route():
    a, b = new_user("qara"), new_user("qarb")
    gains, slugs = [], []
    for i in range(3):
        s, j = a.post("/routes", {"title": f"QA marşrut {RUN} {i}", "region": "quba", "days": 2})
        gains.append((j.get("rewards") or {}).get("xpGained"))
        slugs.append(j.get("slug"))
    check("ROUTE-10", gains[:2] == [350, 350] and gains[2] == 0, f"XP-lər: {gains}")
    slug = slugs[0]
    s, j = a.get(f"/routes/{slug}")
    check("ROUTE-04", s == 200 and j.get("visibility") in ("private",) or j.get("isPublic") is False,
          f"yeni marşrut görünürlüyü: {j.get('visibility')} / isPublic={j.get('isPublic')}")
    s1, _ = b.get(f"/routes/{slug}")
    s2, _ = b.post("/trips", {"title": "idxal", "fromRoute": slug})
    s3, _ = b.post("/saved", {"type": "route", "target": slug})
    check("ROUTE-08", s1 == 404 and s2 == 404 and s3 == 404, f"başqası: bax {s1}, plana idxal {s2}, saxla {s3}")
    s, j = a.post(f"/routes/{slug}/stops", {"place": "nohurgol", "day": 3})
    s_ok, stop = a.post(f"/routes/{slug}/stops", {"place": "nohurgol", "day": 1})
    rs, rj = a.get(f"/routes/{slug}")
    stop_id = rj["itinerary"][0]["stops"][0]["stopId"]
    s2, j2 = a.patch(f"/routes/{slug}/stops/{stop_id}", {"day": 3})
    check("ROUTE-09", s == 400 and s2 == 400, f"3-cü gün: yarat {s}, yenilə {s2}")


# ───────────────────────────── TRIP ─────────────────────────────

@safe
def trip():
    u = new_user("qatr")
    s, j = u.post("/trips", {"title": "Tarix testi", "startDate": "2026-10-10", "endDate": "2026-10-05"})
    check("TRIP-09", s == 400, f"bitmə < başlanğıc → {s}")
    s, t1 = u.post("/trips", {"title": "Səyahət A", "startDate": "2026-10-10", "endDate": "2026-10-11"})
    s, t2 = u.post("/trips", {"title": "Səyahət B", "startDate": "2026-10-12", "endDate": "2026-10-12"})
    u.post(f"/trips/{t1['publicId']}/start")
    u.post(f"/trips/{t2['publicId']}/start")
    s, j1 = u.get(f"/trips/{t1['publicId']}")
    s, j2 = u.get(f"/trips/{t2['publicId']}")
    check("TRIP-05", j1["status"] == "planned" and j2["status"] == "active", f"A={j1['status']}, B={j2['status']}")
    x0 = u.xp()
    s, c1 = u.post(f"/trips/{t2['publicId']}/complete")
    x1 = u.xp()
    s, c2 = u.post(f"/trips/{t2['publicId']}/complete")
    x2 = u.xp()
    check("TRIP-06", x1 - x0 == 500 and x2 == x1, f"1-ci tamamlama +{x1 - x0}, 2-ci +{x2 - x1}")
    s, _ = u.delete(f"/trips/{t1['publicId']}")
    s2, _ = u.get(f"/trips/{t1['publicId']}")
    check("TRIP-07", s == 200 and s2 == 404, f"sil {s}, sonra detal {s2}")


# ───────────────────────────── CHK ─────────────────────────────

PLACES = {
    "icherisheher": (40.3661, 49.8353),
    "ateshgah": (40.4153, 50.0086),
    "xinaliq-kendi": (41.1897, 48.0169),
    "nohurgol": (41.35, 48.47),
    "quba-mese-piknik": (41.32, 48.47),
    "qecresh": (41.2667, 48.4167),
    "laza": (41.2833, 47.9333),
}


@safe
def chk():
    u = new_user("qack")
    s, j = u.post("/checkins", {"place": "icherisheher"})
    check("CHK-03", s == 400, f"koordinatsız check-in → {s} {j.get('message', '')}")
    lat, lng = PLACES["icherisheher"]
    s, j = u.post("/checkins", {"place": "xinaliq-kendi", "lat": lat, "lng": lng})
    check("CHK-02", s == 400 and "1000 m" in j.get("message", ""), j.get("message", ""))
    s, j = u.post("/checkins", {"place": "icherisheher", "lat": lat + 0.001, "lng": lng})
    r = j.get("rewards", {})
    badges = [b.get("slug") for b in r.get("newBadges", [])]
    check("CHK-01", s in (200, 201) and r.get("xpGained") == 600 and j.get("isFirstVisit") and "ilk-addim" in badges,
          f"{s} xp={r.get('xpGained')} badges={badges}")
    cnt0 = int(db("select checkin_count from places where slug='icherisheher'")[0][0])
    s2, j2 = u.post("/checkins", {"place": "icherisheher", "lat": lat, "lng": lng})
    cnt1 = int(db("select checkin_count from places where slug='icherisheher'")[0][0])
    check("CHK-04", s2 in (400, 409) and cnt1 == cnt0, f"təkrar check-in → {s2} {j2.get('message', '')}, sayğac {cnt0}→{cnt1}")
    gains = []
    for slug in ["nohurgol", "quba-mese-piknik", "qecresh"]:
        la, ln = PLACES[slug]
        s, j = u.post("/checkins", {"place": slug, "lat": la, "lng": ln})
        gains.append((j.get("rewards") or {}).get("xpGained"))
    check("CHK-05", gains[:2] == [600, 600] and gains[2] == 0, f"2-4-cü yeni məkan XP: {gains}")
    s, st = u.get("/me/stats")
    s, me = u.get("/me")
    s, sc = u.get("/me/score")
    live = st.get("score", st.get("gezginScore"))
    stored = (me.get("gamification") or {}).get("gezginScore")
    check("PROF-13", live == stored == sc.get("gezginScore"), f"/me/stats.score={live}, /me.gezginScore={stored}, /me/score={sc.get('gezginScore')}")
    s, rules = U().get("/xp-rules")
    keys = json.dumps(rules)[:200]
    check("PROF-13b", "place_checkin" in json.dumps(rules), f"/xp-rules: {keys}")


# ───────────────────────────── BOOK ─────────────────────────────

def expert_slots(slug: str, hours: list[float], capacity: int | None = None) -> list[int]:
    ex = social(db("select email from users where username='rustem.q'")[0][0])
    now = datetime.now(timezone.utc)
    times = [iso((now + timedelta(hours=h)).replace(microsecond=0)) for h in hours]
    body = {"startAt": times}
    if capacity:
        body["capacity"] = capacity
    s, j = ex.post(f"/experiences/{slug}/slots", body)
    assert s in (200, 201), (s, j)
    ids = []
    for t in times:
        row = db(
            "select s.id from experience_slots s join experiences e on e.id=s.experience_id "
            f"where e.slug='{slug}' and s.start_at='{t.replace('T', ' ').replace('Z', '')}'"
        )
        ids.append(int(row[0][0]))
    return ids


def add_card(u: U, number: str, default=True) -> str:
    s, j = u.post("/payments/methods", {"number": number, "expMonth": 12, "expYear": 2030, "cvv": "123", "isDefault": default})
    assert s in (200, 201), (s, j)
    return j["publicId"]


@safe
def book():
    slug = "kend-metbexi-masterklassi"  # 60 AZN, rustem.q
    u = new_user("qabk")
    [s72, s30, s10, s5] = expert_slots(slug, [72, 30, 10, 96], capacity=4)

    s, q = u.post("/bookings/quote", {"type": "experience", "target": slug, "slotId": s72, "adults": 2, "children": 1, "extras": ["transfer"]})
    check("BOOK-02", q.get("subtotalAzn") == 150 and q.get("extrasAzn") == 75 and q.get("totalAzn") == 225,
          f"subtotal={q.get('subtotalAzn')} extras={q.get('extrasAzn')} total={q.get('totalAzn')}")

    good = add_card(u, "4111111111111111")
    bad = add_card(u, "4000000000000002", default=False)
    tds = add_card(u, "4000000000003220", default=False)
    exp = add_card(u, "4000000000000069", default=False)

    # BOOK-05: rədd → eyni rezervasiya yaxşı kartla ödənir
    s, b1 = u.post("/bookings", {"type": "experience", "target": slug, "slotId": s72, "adults": 1}, headers={"Idempotency-Key": f"k{RUN}a"})
    s1, j1 = u.post(f"/bookings/{b1['publicId']}/pay", {"paymentMethod": bad})
    st = u.get(f"/bookings/{b1['publicId']}")[1]["status"]
    x0 = u.xp()
    s2, j2 = u.post(f"/bookings/{b1['publicId']}/pay", {"paymentMethod": good})
    check("BOOK-05", s1 == 400 and "vəsait" in j1.get("message", "") and st == "awaiting_payment" and j2.get("status") == "confirmed",
          f"rədd {s1} '{j1.get('message')}', status {st}; təkrar → {j2.get('status')} ({s2})")
    check("BOOK-04", u.xp() - x0 == 50, f"ödəniş XP +{u.xp() - x0}")

    # BOOK-06: 3DS
    s, b2 = u.post("/bookings", {"type": "experience", "target": slug, "slotId": s72, "adults": 1})
    s, j = u.post(f"/bookings/{b2['publicId']}/pay", {"paymentMethod": tds})
    ra = (j.get("payment") or {}).get("status")
    s, j = u.post(f"/bookings/{b2['publicId']}/pay", {"paymentMethod": tds, "otp": "000000"})
    wrong = j.get("status"), (j.get("payment") or {}).get("status"), s
    s, j = u.post(f"/bookings/{b2['publicId']}/pay", {"paymentMethod": tds, "otp": "123456"})
    check("BOOK-06", ra == "requires_action" and j.get("status") == "confirmed",
          f"1-ci {ra}, yanlış OTP {wrong}, doğru OTP → {j.get('status')}")

    # BOOK-07: müddəti bitmiş
    s, b3 = u.post("/bookings", {"type": "experience", "target": slug, "slotId": s96 if False else s72, "adults": 1})
    s, j = u.post(f"/bookings/{b3['publicId']}/pay", {"paymentMethod": exp})
    check("BOOK-07", s == 400 and "müddəti" in j.get("message", ""), f"{s} {j.get('message')}")

    # BOOK-08: tutum (4 yer; 2 təsdiq + 1 gözləyən artıq tutulub)
    left = int(db(f"select capacity - booked from experience_slots where id={s72}")[0][0])
    s, j = u.post("/bookings/quote", {"type": "experience", "target": slug, "slotId": s72, "adults": left + 1})
    s, j = u.post("/bookings", {"type": "experience", "target": slug, "slotId": s72, "adults": left + 1})
    check("BOOK-08", s == 400 and f"{left} yer" in j.get("message", ""), f"{s} {j.get('message')}")

    # BOOK-13: ödənilməmiş rezervasiya 30 dəqiqədən sonra düşür
    booked0 = int(db(f"select booked from experience_slots where id={s5}")[0][0])
    s, b4 = u.post("/bookings", {"type": "experience", "target": slug, "slotId": s5, "adults": 2})
    db(f"update bookings set created_at = now() - interval 31 minute where public_id='{b4['publicId']}'")
    u.get("/bookings", filter="upcoming")
    u.get(f"/experiences/{slug}/availability")
    time.sleep(1)
    st4 = db(f"select status from bookings where public_id='{b4['publicId']}'")[0][0]
    booked1 = int(db(f"select booked from experience_slots where id={s5}")[0][0])
    check("BOOK-13", st4 == "cancelled" and booked1 == booked0, f"status {st4}, yer {booked0}→{booked1}")

    # BOOK-10/11: ləğv faizləri
    res = {}
    for label, sid in (("72s", s72), ("30s", s30), ("10s", s10)):
        s, bb = u.post("/bookings", {"type": "experience", "target": slug, "slotId": sid, "adults": 1, "paymentMethod": good})
        before = int(db(f"select booked from experience_slots where id={sid}")[0][0])
        s, c = u.post(f"/bookings/{bb['publicId']}/cancel", {"reason": "test"})
        after = int(db(f"select booked from experience_slots where id={sid}")[0][0])
        res[label] = (c.get("policy", {}).get("refundPercent"), c.get("refund", {}).get("amountAzn"), before - after, bb["publicId"])
    check("BOOK-10", res["72s"][0] == 100 and res["72s"][1] == 60 and res["72s"][2] == 1, f"72 saat: {res['72s'][:3]}")
    check("BOOK-11", res["30s"][0] == 50 and res["30s"][1] == 30 and res["10s"][0] == 0 and res["10s"][1] == 0,
          f"30 saat: {res['30s'][:2]}, 10 saat: {res['10s'][:2]}")

    # BOOK-14: ləğv / geri qaytarılmış rezervasiyanı ödəmək
    s1, _ = u.post(f"/bookings/{res['72s'][3]}/pay", {"paymentMethod": good})
    s2, _ = u.post(f"/bookings/{res['10s'][3]}/pay", {"paymentMethod": good})
    check("BOOK-14", s1 == 400 and s2 == 400, f"refunded → {s1}, cancelled → {s2}")

    # BOOK-15: başqasının ödənişini geri qaytarmaq
    other = new_user("qabx")
    pay_id = u.get(f"/bookings/{b1['publicId']}")[1]["payment"]["publicId"]
    s, j = other.post(f"/payments/{pay_id}/refund", {"amountAzn": 1})
    s_own, _ = u.post(f"/payments/{pay_id}/refund", {"amountAzn": 1})
    check("BOOK-15", s in (403, 404) and s_own in (403, 404), f"kənar istifadəçi {s}, sahib birbaşa {s_own} (geri qaytarma yalnız ləğv ilə)")

    # BOOK-16: Idempotency-Key istifadəçiyə aiddir
    s, j = other.post("/bookings", {"type": "experience", "target": slug, "slotId": s30, "adults": 1}, headers={"Idempotency-Key": f"k{RUN}a"})
    check("BOOK-16", s in (200, 201) and j.get("publicId") != b1["publicId"], f"başqasının açarı → {s}")

    # BOOK-17: keçmiş tarix / keçmiş rezervasiyanı ödəmək
    past = iso(datetime.now(timezone.utc) - timedelta(hours=2))
    s1, _ = u.post("/bookings", {"type": "experience", "target": slug, "startAt": past, "adults": 1})
    s, b5 = u.post("/bookings", {"type": "experience", "target": slug, "slotId": s30, "adults": 1})
    db(f"update bookings set start_at = now() - interval 1 hour where public_id='{b5['publicId']}'")
    s2, j2 = u.post(f"/bookings/{b5['publicId']}/pay", {"paymentMethod": good})
    check("BOOK-17", s1 == 400 and s2 == 400, f"keçmişə bron {s1}, keçmiş bronu ödə {s2} {j2.get('message', '')}")

    # BOOK-18: slotsuz bronda qrup həddi (maxGroup 8)
    fut = iso(datetime.now(timezone.utc) + timedelta(days=5))
    s, j = u.post("/bookings", {"type": "experience", "target": slug, "startAt": fut, "adults": 9})
    check("BOOK-18", s == 400, f"9 nəfər (maxGroup 8) → {s} {j.get('message', '')}")

    # BOOK-19: bitmiş təsdiqlənmiş təcrübə tamamlanır
    s, b6 = u.post("/bookings", {"type": "experience", "target": slug, "slotId": s30, "adults": 1, "paymentMethod": good})
    db(f"update bookings set start_at = now() - interval 5 hour where public_id='{b6['publicId']}'")
    x0 = u.xp()
    u.get("/bookings", filter="past")
    time.sleep(1)
    st6 = db(f"select status from bookings where public_id='{b6['publicId']}'")[0][0]
    s, stats = u.get("/me/stats")
    check("BOOK-19", st6 == "completed" and u.xp() - x0 == 800, f"status {st6}, XP +{u.xp() - x0}, stats.experiences={stats.get('experiences')}")

    # BOOK-12: otel paketi
    pkg = db("select p.public_id from business_packages p join businesses b on b.id=p.business_id where b.slug='gabala-resort-spa' and p.price_azn=240")[0][0]
    start = (datetime.now(timezone.utc) + timedelta(days=10)).replace(hour=14, minute=0, second=0, microsecond=0)
    s, j = u.post("/bookings", {"type": "business_package", "target": pkg, "startAt": iso(start), "adults": 2, "children": 1, "extras": ["spa"], "paymentMethod": good})
    nights = (datetime.fromisoformat(j["endAt"].replace("Z", "+00:00")) - datetime.fromisoformat(j["startAt"].replace("Z", "+00:00"))).days if j.get("endAt") else None
    check("BOOK-12", j.get("pricing", {}).get("totalAzn") == 300 and j.get("status") == "confirmed" and nights == 2,
          f"cəmi {j.get('pricing', {}).get('totalAzn')}, status {j.get('status')}, gecə {nights}")

    # BOOK-20: defolt kart silinəndə növbəti defolt olur
    s, _ = u.delete(f"/payments/methods/{good}")
    s, j = u.get("/payments/methods")
    items = j if isinstance(j, list) else j.get("data", [])
    check("BOOK-20", sum(1 for m in items if m.get("isDefault")) == 1, f"defolt sayı: {[m.get('isDefault') for m in items]}")

    # BOOK-09: siyahı filtrləri
    s, up = u.get("/bookings", filter="upcoming")
    s, ca = u.get("/bookings", filter="cancelled")
    check("BOOK-09", all(b["status"] in ("confirmed", "awaiting_payment", "pending") for b in up["data"])
          and all(b["status"] in ("cancelled", "refunded") for b in ca["data"]),
          f"gələcək {len(up['data'])}, ləğv {len(ca['data'])}")


# ───────────────────────────── PROF ─────────────────────────────

@safe
def prof():
    a, b = new_user("qapa"), new_user("qapb")
    a.patch("/me/settings", {"profileVisibility": "followers"})
    s, j = b.get(f"/users/{a.username}")
    check("PROF-06", j.get("canViewContent") is False or j.get("isPublic") is False,
          f"'İzləyicilər' seçildi → isPublic={j.get('isPublic')}, canViewContent={j.get('canViewContent')}")
    a.patch("/me", {"homeRegionSlug": "quba"})
    s, j = a.patch("/me", {"homeRegionSlug": None})
    hr = db(f"select home_region_id from users where username='{a.username}'")[0][0]
    check("PROF-02", hr in ("NULL", ""), f"ev regionu götürüldü → {hr} ({s})")
    s, lb = a.get("/leaderboard", period="all_time", following="true")
    rows = lb.get("data", lb.get("entries", []))
    me = lb.get("me") or {}
    check("PROF-12", me.get("rank") is not None and me.get("rank") <= max(1, len(rows) + 1),
          f"following=true: sıra {me.get('rank')}, siyahı {len(rows)}")


# ───────────────────────────── SAVED ─────────────────────────────

@safe
def saved():
    u = new_user("qasv")
    s, j = u.post("/saved", {"type": "place", "target": "lahic", "collection": "01ZZZZZZZZZZZZZZZZZZZZZZZZ"})
    n = db(f"select count(*) from saved_items where user_id={u.db_id}")[0][0]
    check("PROF-09", s == 404 and n == "0", f"olmayan kolleksiya → {s}, saxlanıldı: {n}")


# ───────────────────────────── MOD ─────────────────────────────

@safe
def mod():
    u = new_user("qamd")
    s, _ = u.get("/admin/stats")
    check("MOD-04", s == 403, f"adi istifadəçi /admin/stats → {s}")
    adm = login(*ADMIN)
    v = new_user("qamv")
    s, post = v.post("/posts", {"body": "moderasiya testi"})
    u.post(f"/posts/{post['publicId']}/report", {"reason": "spam"})
    s, reps = adm.get("/admin/reports", status="open")
    rep = next((r for r in reps.get("data", []) if (r.get("target") or {}).get("publicId") == post["publicId"]
                or post["publicId"] in json.dumps(r)), None)
    check("MOD-01", rep is not None, "şikayət admin növbəsində" if rep else "növbədə tapılmadı")
    if rep:
        s, j = adm.post(f"/admin/reports/{rep['publicId']}/resolve", {"action": "suspend_user", "note": "test"})
        s1, _ = v.get("/me")
        s2, j2 = U().post("/auth/login", {"identifier": v.username, "password": PASSWORD})
        s3, _ = v.post("/auth/refresh", {"refreshToken": v.refresh})
        s4, _ = u.get(f"/posts/{post['publicId']}")
        check("MOD-03", s1 == 401 and s2 == 401 and "dayandırılıb" in j2.get("message", "") and s3 == 401 and s4 == 404,
              f"/me {s1}, login {s2} '{j2.get('message')}', refresh {s3}, paylaşım {s4}")
        adm.post(f"/admin/users/{v.username}/restore")
        s5, _ = U().post("/auth/login", {"identifier": v.username, "password": PASSWORD})
        check("MOD-03b", s5 == 200, f"bərpadan sonra giriş {s5}")


SECTIONS = [("AUTH", auth), ("ONB", onb), ("FEED", feed), ("STORY", story), ("USER", user), ("REV", rev),
            ("ROUTE", route), ("TRIP", trip), ("CHK", chk), ("BOOK", book), ("PROF", prof), ("SAVED", saved), ("MOD", mod)]

if __name__ == "__main__":
    for prefix, fn in SECTIONS:
        if section(prefix):
            print(f"\n── {prefix}")
            fn()
    failed = [r for r in RESULTS if not r[1]]
    print(f"\n{len(RESULTS) - len(failed)}/{len(RESULTS)} keçdi")
    sys.exit(1 if failed else 0)
