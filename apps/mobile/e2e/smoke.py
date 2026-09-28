#!/usr/bin/env python3
"""
GEZGIN UI smoke testi — iOS simulyatorunda REAL toxunuşlarla.

Skript düymələri accessibility etiketinə görə tapır (`idb ui describe-all`),
`idb ui tap` ilə basır, `idb ui text` ilə yazır, sonra nəticəni həm ekranda,
həm də API-də yoxlayır. Ekran şəkilləri yalnız göstərir; bu skript isə
"düymə həqiqətən işləyirmi" sualına cavab verir.

Tələblər:
  - idb + idb_companion (`brew install facebook/fb/idb-companion`, `pip install fb-idb`)
  - API (3100) və Metro (8081) işləyir, tətbiq simulyatorda quraşdırılıb
  - Tətbiqdə sessiya var (README → "Yoxlama")

İşlətmək:
  python3 e2e/smoke.py              # bütün axınlar
  python3 e2e/smoke.py like chat    # yalnız seçilənlər
"""
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request

API = os.environ.get('GEZGIN_API_URL', 'http://localhost:3100/api/v1')
BUNDLE = 'app.gezgin'
PASSWORD = os.environ.get('GEZGIN_TEST_PASSWORD', 'Test1234!')
SCREEN_W, SCREEN_H = 402, 874  # iPhone 17 Pro, point
SHOTS = os.environ.get('GEZGIN_SHOTS', '/tmp/gezgin-smoke')


# ─────────────────────────── cihaz ───────────────────────────

def sh(*args: str) -> str:
    return subprocess.run(args, capture_output=True, text=True, check=True).stdout


def booted_udid() -> str:
    out = sh('xcrun', 'simctl', 'list', 'devices', 'booted', '-j')
    for devices in json.loads(out)['devices'].values():
        for d in devices:
            if d['state'] == 'Booted' and 'iPhone' in d['name']:
                return d['udid']
    sys.exit('Açıq iPhone simulyatoru yoxdur')


UDID = os.environ.get('GEZGIN_UDID') or booted_udid()


def tree() -> list[dict]:
    return json.loads(sh('idb', 'ui', 'describe-all', '--udid', UDID))


def visible(e: dict) -> bool:
    f = e.get('frame') or {}
    cx = f.get('x', 0) + f.get('width', 0) / 2
    cy = f.get('y', 0) + f.get('height', 0) / 2
    return 0 <= cx <= SCREEN_W and 0 <= cy <= SCREEN_H


def find(label: str, *, exact: bool = False, kind: str | None = None, nth: int = 0,
         anywhere: bool = False) -> dict | None:
    """`anywhere=True` ekrandan kənardakı elementləri də qaytarır — sürüşdürmə istiqamətini seçmək üçün."""
    matches = []
    for e in tree():
        lab = e.get('AXLabel') or ''
        if (lab == label if exact else lab.startswith(label)) and (anywhere or visible(e)):
            if kind is None or e.get('type') == kind:
                matches.append(e)
    return matches[nth] if len(matches) > nth else None


def wait(label: str, timeout: float = 12, **kw) -> dict:
    end = time.time() + timeout
    while time.time() < end:
        e = find(label, **kw)
        if e:
            return e
        time.sleep(0.5)
    raise AssertionError(f'ekranda tapılmadı: {label!r}')


def gone(label: str, timeout: float = 8, **kw) -> None:
    end = time.time() + timeout
    while time.time() < end:
        if not find(label, **kw):
            return
        time.sleep(0.5)
    raise AssertionError(f'ekrandan getmədi: {label!r}')


def tap_xy(x: float, y: float) -> None:
    sh('idb', 'ui', 'tap', str(round(x)), str(round(y)), '--udid', UDID)
    time.sleep(0.7)


def wait_stable(label: str, timeout: float = 12, **kw) -> dict:
    """Element görünsə də lent hələ yüklənib yerini dəyişə bilər (hekayələr,
    təcrübə zolağı sonradan gəlir) — köhnə koordinata basmamaq üçün mövqe iki
    ardıcıl oxunuşda eyni olana qədər gözlənilir."""
    end = time.time() + timeout
    prev = None
    while time.time() < end:
        e = find(label, **kw)
        frame = e and tuple(round(e['frame'][k]) for k in ('x', 'y', 'width', 'height'))
        if frame and frame == prev:
            return e
        prev = frame
        time.sleep(0.6)
    return wait(label, 1, **kw)


def tap_lowest(label: str, **kw) -> None:
    """Eyni adlı element bir neçə dəfə olanda (stekdə qalan əvvəlki ekran da
    ağacda görünür) ən aşağıdakı — yəni cari ekrandakı düymə seçilir."""
    end = time.time() + 12
    while time.time() < end:
        matches = [e for e in tree() if visible(e) and (e.get('AXLabel') or '') == label]
        if matches:
            target = max(matches, key=lambda e: e['frame']['y'])
            f = target['frame']
            tap_xy(f['x'] + f['width'] / 2, f['y'] + f['height'] / 2)
            return
        time.sleep(0.5)
    raise AssertionError(f'ekranda tapılmadı: {label!r}')


def settle(seconds: float = 1.2) -> None:
    """Ekran keçidi animasiyası bitməmiş edilən toxunuş udulur — qısa fasilə."""
    time.sleep(seconds)


def tap(label: str, timeout: float = 12, **kw) -> None:
    f = wait_stable(label, timeout, **kw)['frame']
    tap_xy(f['x'] + f['width'] / 2, f['y'] + f['height'] / 2)


def type_text(text: str) -> None:
    sh('idb', 'ui', 'text', text, '--udid', UDID)
    time.sleep(0.4)


# Şaquli jest üfüqi siyahının (foto qalereyası, təcrübə zolağı) üstündən
# başlayanda o siyahı jesti udur və səhifə yerində qalır — ona görə bir neçə
# başlanğıc nöqtəsi sınanır.
SWIPE_STARTS = (560, 400, 250)


def swipe(distance: int = 450, *, up: bool = True, start_y: int = 560) -> None:
    end = start_y - distance if up else start_y + distance
    end = max(80, min(SCREEN_H - 80, end))
    sh('idb', 'ui', 'swipe', '200', str(start_y), '200', str(end), '--udid', UDID, '--duration', '0.3')
    time.sleep(0.8)


def swipe_up(distance: int = 450) -> None:
    swipe(distance, up=True)


def shot(name: str) -> str:
    os.makedirs(SHOTS, exist_ok=True)
    path = f'{SHOTS}/{name}.png'
    subprocess.run(['xcrun', 'simctl', 'io', UDID, 'screenshot', path], capture_output=True)
    return path


def relaunch() -> None:
    """Hər axın təmiz vəziyyətdən — Discover ekranından başlayır."""
    subprocess.run(['xcrun', 'simctl', 'terminate', UDID, BUNDLE], capture_output=True)
    sh('xcrun', 'simctl', 'launch', UDID, BUNDLE)
    wait('Lent', timeout=40, exact=True)
    time.sleep(1.5)


# ─────────────────────────── API ───────────────────────────

def call(path: str, token: str | None = None, method: str = 'GET', body: dict | None = None):
    req = urllib.request.Request(
        f'{API}{path}',
        method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={'Content-Type': 'application/json', **({'Authorization': f'Bearer {token}'} if token else {})},
    )
    try:
        with urllib.request.urlopen(req) as res:
            raw = res.read()
            return json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        raise AssertionError(f'{method} {path} → {e.code}: {e.read()[:200]!r}') from None


def app_session_user() -> str:
    """Tətbiqin öz sessiyası oxunur (yalnız oxu — refresh tokenə toxunmuruq)."""
    container = sh('xcrun', 'simctl', 'get_app_container', UDID, BUNDLE, 'data').strip()
    manifest = f'{container}/Library/Application Support/{BUNDLE}/RCTAsyncLocalStorage_V1/manifest.json'
    with open(manifest) as f:
        return json.loads(json.load(f)['gezgin.session'])['user']['username']


def login(username: str) -> str:
    return call('/auth/login', method='POST', body={'identifier': username, 'password': PASSWORD})['accessToken']


def register_helper() -> tuple[str, str]:
    """Qarşı tərəf — izləyən, bəyənən, yazan ikinci istifadəçi."""
    name = f'uihelp{int(time.time())}'
    res = call('/auth/register', method='POST', body={
        'email': f'{name}@test.az', 'password': PASSWORD, 'username': name, 'fullName': 'Kamran Köməkçi',
    })
    return name, res['accessToken']


# ─────────────────────────── köməkçilər ───────────────────────────

def text_inputs() -> list[dict]:
    return [e for e in tree() if e.get('type') in ('TextField', 'TextView', 'TextArea') and visible(e)]


def tap_input(nth: int = 0, timeout: float = 10) -> None:
    end = time.time() + timeout
    while time.time() < end:
        items = text_inputs()
        if len(items) > nth:
            f = items[nth]['frame']
            tap_xy(f['x'] + f['width'] / 2, f['y'] + f['height'] / 2)
            return
        time.sleep(0.4)
    raise AssertionError('mətn sahəsi tapılmadı')


def tap_in_row(anchor: str, target: str, below: bool = False) -> None:
    """`anchor` elementinin sətrindəki (və ya altındakı ən yaxın) `target`-ə basır."""
    a = wait(anchor)['frame']
    ay = a['y'] + a['height'] / 2
    candidates = [e for e in tree() if (e.get('AXLabel') or '') == target and visible(e)]
    def dist(e: dict) -> float:
        cy = e['frame']['y'] + e['frame']['height'] / 2
        return (cy - ay) if below else abs(cy - ay)
    candidates = [e for e in candidates if dist(e) >= 0] if below else candidates
    if not candidates:
        raise AssertionError(f'{anchor!r} yanında {target!r} yoxdur')
    f = min(candidates, key=dist)['frame']
    tap_xy(f['x'] + f['width'] / 2, f['y'] + f['height'] / 2)


# Ekranın altındakı sabit CTA paneli (Screen `footer`) və tab bar bu zonanı örtür —
# element mərkəzi buradan aşağıdadırsa, toxunuş panelə düşür.
SAFE_BOTTOM = SCREEN_H - 150


SAFE_TOP = 120


def scroll_to(label: str, attempts: int = 12, **kw) -> None:
    """Elementi toxunula bilən zonaya gətirir: altdadırsa yuxarı, üstdədirsə
    aşağı sürüşür. Kiçik linklərin (məs. "Rəy yaz") yanından keçməmək üçün
    addım qısadır."""
    previous: float | None = None
    start_index = 0
    for _ in range(attempts):
        e = find(label, anywhere=True, **kw)
        if not e:
            swipe(400, up=True, start_y=SWIPE_STARTS[start_index])
            continue

        center = e['frame']['y'] + e['frame']['height'] / 2
        if SAFE_TOP < center < SAFE_BOTTOM:
            return
        # Ekran tərpənmirsə jest udulur — növbəti başlanğıc nöqtəsini sına
        if previous is not None and abs(center - previous) < 5:
            start_index = (start_index + 1) % len(SWIPE_STARTS)
        previous = center

        gap = center - (SCREEN_H / 2)
        swipe(min(400, max(120, int(abs(gap)))), up=gap > 0, start_y=SWIPE_STARTS[start_index])
    raise AssertionError(f'{label!r} toxunula bilən zonaya gətirilmədi')


def sql(query: str) -> str:
    return sh('docker', 'exec', 'gezgin-mysql', 'sh', '-c',
              f'mysql --default-character-set=utf8mb4 -N -uroot -p"$MYSQL_ROOT_PASSWORD" gezgin -e "{query}" 2>/dev/null').strip()


class Ctx:
    def __init__(self) -> None:
        self.user = app_session_user()
        self.token = login(self.user)


def fresh_helper(ctx: Ctx) -> tuple[str, str]:
    name, token = register_helper()
    return name, token


# ─────────────────────────── axınlar ───────────────────────────

def flow_like(ctx: Ctx) -> str:
    """Lentdə ürək: ekranda vəziyyət dəyişir, serverdə bəyənmə yazılır, geri alınır."""
    relaunch()
    post = call('/feed?limit=1', ctx.token)['data'][0]
    was = post['viewer']['liked']
    on, off = 'Bəyənməni geri al', 'Bəyən'
    tap(on if was else off, exact=True)
    wait(off if was else on, exact=True)
    assert call(f"/posts/{post['publicId']}", ctx.token)['viewer']['liked'] is (not was), 'server bəyənməni yazmayıb'
    tap(off if was else on, exact=True)
    wait(on if was else off, exact=True)
    assert call(f"/posts/{post['publicId']}", ctx.token)['viewer']['liked'] is was, 'geri alma serverə çatmayıb'
    return f"{post['author']['username']} paylaşımı: bəyən → geri al"


def flow_comment(ctx: Ctx) -> str:
    """Şərh ikonu → detal, klaviatura açıq; yaz → göndər → sil (təsdiqlə)."""
    relaunch()
    post = call('/feed?limit=1', ctx.token)['data'][0]
    tap('Şərhlər', exact=True)
    wait('Paylaşım', exact=True)
    body = f'UI test {int(time.time()) % 100000}'
    tap_input()
    type_text(body)
    tap('Göndər', exact=True)
    wait(body)
    comments = call(f"/posts/{post['publicId']}/comments?limit=50", ctx.token)['data']
    assert any(c['body'] == body for c in comments), 'şərh serverdə yoxdur'

    tap_in_row(body, 'Sil', below=True)
    tap('Sil', exact=True, kind='Button')  # təsdiq pəncərəsi
    gone(body)
    comments = call(f"/posts/{post['publicId']}/comments?limit=50", ctx.token)['data']
    assert not any(c['body'] == body for c in comments), 'silinmə serverə çatmayıb'
    return f'"{body}" yazıldı və silindi'


def flow_follow(ctx: Ctx) -> str:
    """Müəllifə toxun → profil → İzlə/İzləyirsən; izləyici sayı serverdə dəyişir."""
    relaunch()
    other = next(p for p in call('/feed?limit=10', ctx.token)['data'] if not p['viewer']['isMine'])['author']
    scroll_to(f"{other['username']},")
    tap(f"{other['username']},")
    wait(other['fullName'], exact=True)
    before = call(f"/users/{other['username']}", ctx.token)
    following = before['viewer']['isFollowing']
    tap('İzləyirsən' if following else 'İzlə', exact=True)
    wait('İzlə' if following else 'İzləyirsən', exact=True)
    after = call(f"/users/{other['username']}", ctx.token)
    assert after['viewer']['isFollowing'] is (not following), 'izləmə serverə çatmayıb'
    assert after['stats']['followers'] == before['stats']['followers'] + (-1 if following else 1), 'sayğac səhvdir'
    tap('İzlə' if following else 'İzləyirsən', exact=True)  # əvvəlki vəziyyətə qaytar
    wait('İzləyirsən' if following else 'İzlə', exact=True)
    return f"@{other['username']}: izləyici {before['stats']['followers']} → {after['stats']['followers']} → geri"


def flow_report(ctx: Ctx) -> str:
    """Üç nöqtə → paylaş paneli → Şikayət et → səbəb → təşəkkür; bazada şikayət qeydi."""
    relaunch()
    post = next(p for p in call('/feed?limit=10', ctx.token)['data'] if not p['viewer']['isMine'])
    anchor = f"{post['author']['username']},"
    scroll_to(anchor)
    tap_in_row(anchor, 'Daha çox')
    tap('Şikayət et', exact=True)
    tap('Spam və ya reklam', exact=True)
    wait('Təşəkkürlər', exact=True)
    tap('OK', exact=True, kind='Button')
    count = sql(
        "SELECT COUNT(*) FROM reports r JOIN users u ON u.id=r.reporter_id JOIN posts p ON p.id=r.target_id "
        f"WHERE u.username='{ctx.user}' AND r.target_type='post' AND p.public_id='{post['publicId']}'"
    )
    assert count == '1', f'bazada şikayət sayı {count}'
    return f"{post['author']['username']} paylaşımı şikayət olundu (bazada 1 qeyd)"


def flow_chat(ctx: Ctx) -> str:
    """Mesajlar → söhbət → yaz → göndər; mesaj serverdə, oxunmamış sayğac 0."""
    relaunch()
    conv = call('/conversations', ctx.token)['data'][0]
    tap('Mesajlar')
    wait(conv['title'])
    tap(conv['title'])
    body = f'Salam UI {int(time.time()) % 100000}'
    tap_input()
    type_text(body)
    tap('Göndər', exact=True)
    wait(body)
    last = call(f"/conversations/{conv['publicId']}/messages?limit=1", ctx.token)['data'][0]
    assert last['body'] == body and last['isMine'], 'mesaj serverdə yoxdur'
    item = next(c for c in call('/conversations', ctx.token)['data'] if c['publicId'] == conv['publicId'])
    assert item['unreadCount'] == 0, f"oxunmamış {item['unreadCount']}"
    return f"{conv['title']} ilə söhbət: \"{body}\" göndərildi"


def flow_live(ctx: Ctx) -> str:
    """Socket: qarşı tərəf yazır → açıq ekranlar yenilənmədən yeni mesajı göstərir."""
    relaunch()
    name, token = fresh_helper(ctx)
    tap('Mesajlar')
    wait('Mesajlar', exact=True)
    conv = call('/conversations', token, 'POST', {'username': ctx.user})
    call(f"/conversations/{conv['publicId']}/messages", token, 'POST', {'body': 'Salam! Canli test'})
    wait('Kamran Köməkçi', timeout=12)  # siyahı özü yenilənməlidir
    tap('Kamran Köməkçi')
    wait('Salam! Canli test')
    call(f"/conversations/{conv['publicId']}/messages", token, 'POST', {'body': 'Bu da ikinci mesaj'})
    wait('Bu da ikinci mesaj', timeout=12)  # açıq çata socket ilə
    return 'yeni söhbət siyahıda və mesaj açıq çatda canlı göründü'


def flow_notifications(ctx: Ctx) -> str:
    """Qarşı tərəf izləyir → zəngdə nöqtə canlı çıxır → bildirişə toxunuş profilə aparır → hamısını oxu."""
    relaunch()
    name, token = fresh_helper(ctx)
    # İki bildiriş: birinə toxunub oxuyuruq, "Hamısını oxu" qalan üçün lazım olur
    call(f'/users/{ctx.user}/follow', token, 'POST')
    my_post = call(f'/users/{ctx.user}/posts?limit=1', ctx.token)['data'][0]
    call(f"/posts/{my_post['publicId']}/like", token, 'POST')

    wait('Bildirişlər, oxunmamış var', timeout=12)
    tap('Bildirişlər')
    tap('Kamran səni izləməyə başladı')
    wait('Kamran Köməkçi', exact=True)  # deep link: gezgin://user/<ad>
    tap('Geri', exact=True)
    tap('Hamısını oxu', exact=True)
    time.sleep(1.5)
    assert call('/notifications?limit=1', ctx.token)['unreadCount'] == 0, 'oxunmamış qaldı'
    return 'canlı nöqtə → bildiriş → profil → hamısı oxundu'


def flow_review(ctx: Ctx) -> str:
    """Lentdə məkan etiketi → məkan → "Rəy yaz" → 4 ulduz + çip + mətn → göndər; serverdə rəy, sonra silinir."""
    place = 'xinaliq-kendi'
    # Əvvəlki qaçışdan qalan rəy varsa təmizlə — ekran 409 ilə redaktə rejiminə keçərdi
    for r in call(f'/reviews?targetType=place&target={place}&limit=50', ctx.token)['data']:
        if r['author']['username'] == ctx.user:
            call(f"/reviews/{r['publicId']}", ctx.token, 'DELETE')
    before = call(f'/places/{place}', ctx.token)['reviewCount']

    relaunch()
    # Dəqiq ad: lentdəki "Xınalıq kəndi turu" təcrübə kartı ilə qarışmasın
    scroll_to('Xınalıq kəndi', exact=True)
    tap('Xınalıq kəndi', exact=True)
    scroll_to('Rəy yaz', attempts=8)
    tap('Rəy yaz')
    wait('Səyahətin necə keçdi?', exact=True)
    tap('4 ulduz', exact=True)
    wait('Çox yaxşı', exact=True)
    tap('Təbiət 🌿', exact=True)
    # Avtodüzəliş söz dəyişir ("reyi" → "return") — yalnız neytral mətn yazılır
    body = f'UI test {int(time.time()) % 100000}'
    tap_input()
    type_text(body)
    tap('Rəyi göndər', exact=True)
    wait('Təşəkkürlər!', exact=True)
    tap('Bağla', exact=True, kind='Button')

    mine = next((r for r in call(f'/reviews?targetType=place&target={place}&limit=50', ctx.token)['data']
                 if r['author']['username'] == ctx.user), None)
    assert mine, 'rəy serverdə yoxdur'
    assert mine['rating'] == 4 and mine['tags'] == ['tebiet'] and mine['body'] == body, f'rəy səhv yazılıb: {mine}'
    assert call(f'/places/{place}', ctx.token)['reviewCount'] == before + 1, 'məkanın rəy sayı artmayıb'
    call(f"/reviews/{mine['publicId']}", ctx.token, 'DELETE')  # seed reytinqini bərpa et
    return f'4★ + "Təbiət" + mətn göndərildi, məkan rəy sayı {before} → {before + 1} → geri'


# iOS foto seçicisi (PHPicker) ayrı prosesdə işləyir — accessibility ağacında
# görünmür, ona görə koordinatla basılır. iPhone 17 Pro, "Private Access" bannerı ilə.
PICKER_PHOTO_1 = (66, 412)
PICKER_PHOTO_2 = (201, 412)
PICKER_DONE = (364, 144)


def tap_header(label: str, timeout: float = 10) -> None:
    """Başlıqdakı düymə — eyni adlı başlıq mətnindən (StaticText) fərqləndirilir."""
    end = time.time() + timeout
    while time.time() < end:
        for e in tree():
            f = e['frame']
            if (e.get('AXLabel') or '') == label and e.get('type') != 'StaticText' and visible(e) and f['x'] > 250:
                tap_xy(f['x'] + f['width'] / 2, f['y'] + f['height'] / 2)
                return
        time.sleep(0.5)
    raise AssertionError(f'başlıq düyməsi tapılmadı: {label!r}')


def open_create(action: str) -> None:
    relaunch()
    tap('Yarat', exact=True)
    wait('Nə yaradaq?')
    tap(action)
    wait('Ləğv et', exact=True)


def dismiss_alert() -> None:
    if find('OK', exact=True, kind='Button'):
        tap('OK', exact=True, kind='Button')


def url_ok(url: str) -> bool:
    try:
        with urllib.request.urlopen(urllib.request.Request(url, method='HEAD')) as res:
            return res.status == 200
    except urllib.error.URLError:
        return False


def flow_photo_post(ctx: Ctx) -> str:
    """Yarat → Paylaşım et → sistem seçicisi → 2 foto → mətn → Paylaş; fotolar MinIO-ya yüklənir."""
    open_create('Paylaşım et')
    body = f'UI foto testi {int(time.time()) % 100000} #uitest'
    tap_input()
    type_text(body)
    tap('Foto', exact=True)
    time.sleep(3)
    tap_xy(*PICKER_PHOTO_1)
    tap_xy(*PICKER_PHOTO_2)
    tap_xy(*PICKER_DONE)
    wait('Fotonu sil', timeout=10)
    thumbs = [e for e in tree() if e.get('AXLabel') == 'Fotonu sil']
    assert len(thumbs) == 2, f'{len(thumbs)} foto seçildi, 2 gözlənilirdi'

    tap_header('Paylaş')
    wait('Paylaşım', exact=True, timeout=40)  # yükləmə → paylaşım detalı
    dismiss_alert()  # "+300 XP" (gündəlik limit dolubsa pəncərə çıxmır)

    post = call(f'/users/{ctx.user}/posts?limit=1', ctx.token)['data'][0]
    assert post['body'] == body, f"son paylaşım gözlənilən deyil: {post['body']!r}"
    assert len(post['media']) == 2, f"{len(post['media'])} foto yazılıb"
    assert all(url_ok(m['url']) for m in post['media']), 'fotolar anbarda açılmır'
    assert post['hashtags'] == ['uitest']
    call(f"/posts/{post['publicId']}", ctx.token, 'DELETE')
    return '2 foto MinIO-ya yükləndi, paylaşım yarandı (sonra silindi)'


def flow_story(ctx: Ctx) -> str:
    """Yarat → Hekayə → 1 foto → başlıq → Paylaş; Discover-də öz dairən görünür və baxış ekranı açılır."""
    open_create('Hekayə')
    tap('Foto', exact=True)
    time.sleep(3)
    tap_xy(*PICKER_PHOTO_1)  # selectionLimit=1 — seçici tək toxunuşla bağlanır
    wait('Fotonu sil', timeout=10)
    tap_input()
    type_text('UI hekaye testi')
    tap_header('Paylaş')
    # Paylaşılandan sonra təsdiq alerti çıxır ("Hekayə paylaşıldı")
    wait('Hekayə paylaşıldı', timeout=40)
    tap('OK', exact=True)
    wait('Nə yaradaq?', timeout=10)

    assert call('/stories', ctx.token)['hasMine'], 'hekayə dairələrdə yoxdur'
    tap('Lent, tab')
    wait('Lent', exact=True)
    tap('Sən', exact=True)
    wait('UI hekaye testi', timeout=10)
    tap('Bağla', exact=True)

    for st in call(f'/stories/{ctx.user}', ctx.token)['data']:
        if st['caption'] == 'UI hekaye testi':
            call(f"/stories/{st['publicId']}", ctx.token, 'DELETE')
    return 'hekayə yükləndi, "Sən" dairəsindən açıldı (sonra silindi)'


def flow_save(ctx: Ctx) -> str:
    """Məkan detalında "Saxla" → serverdə saxlanılanlara düşür, ikon dolur; təkrar toxunuş geri alır."""
    place = 'xinaliq-kendi'
    # Düymə vəziyyətsiz idi: hər toxunuş POST göndərirdi, ikon heç dəyişmirdi
    if call(f'/places/{place}', ctx.token)['isSaved']:
        call(f'/saved/place/{place}', ctx.token, 'DELETE')

    relaunch()
    scroll_to('Xınalıq kəndi', exact=True)
    tap('Xınalıq kəndi', exact=True)
    wait('Saxla', exact=True, kind='Button')
    tap('Saxla', exact=True, kind='Button')
    # Etiket vəziyyəti ilə birlikdə dəyişir — ekranda da görünən yeganə əlamətdir
    wait('Saxlamanı götür', exact=True, kind='Button')
    assert call(f'/places/{place}', ctx.token)['isSaved'], 'server saxlamayıb'
    saved = call('/saved?type=place', ctx.token)['data']
    assert any(i['slug'] == place for i in saved), 'saxlanılanlar siyahısında yoxdur'

    tap('Saxlamanı götür', exact=True, kind='Button')
    wait('Saxla', exact=True, kind='Button')
    assert not call(f'/places/{place}', ctx.token)['isSaved'], 'saxlama geri alınmayıb'
    return 'Xınalıq kəndi saxlanıldı → siyahıda göründü → geri alındı'


def flow_settings(ctx: Ctx) -> str:
    """Tənzimləmələr (ekran 34): dil dəyişir, açar çevrilir, hər ikisi serverdə qalır."""
    before = call('/me/settings', ctx.token)
    # Test öz vəziyyətini qurur — əvvəlki qaçışdan qalan dəyər nəticəni gizlədə bilər
    call('/me/settings', ctx.token, 'PATCH', {'language': 'az', 'pushEnabled': True})

    relaunch()
    tap('Profil, tab')
    wait('Tənzimləmələr', kind='Button')
    tap('Tənzimləmələr', kind='Button')

    wait('English', exact=True)
    tap('English', exact=True)
    scroll_to('Push bildirişləri', exact=True)
    tap('Push bildirişləri', exact=True)

    after = call('/me/settings', ctx.token)
    assert after['language'] == 'en', f"dil serverdə dəyişmədi: {after['language']}"
    assert after['pushEnabled'] is False, 'push açarı serverdə dəyişmədi'

    call('/me/settings', ctx.token, 'PATCH', {'language': before['language'], 'pushEnabled': before['pushEnabled']})
    return f"dil az → en, push {before['pushEnabled']} → False (sonra geri)"


def flow_edit_profile(ctx: Ctx) -> str:
    """Profili redaktə et (ekran 54): bio yazılır, serverdə görünür, sonra geri qaytarılır."""
    before = call('/me', ctx.token)
    text = f'UI test bio {int(time.time()) % 100000}'

    relaunch()
    tap('Profil, tab')
    wait('Profili redaktə et', kind='Button')
    tap('Profili redaktə et', kind='Button')

    wait('Ad və soyad', exact=True)
    # Üçüncü sahə "Haqqında"dır — ad və istifadəçi adı ondan əvvəl gəlir
    tap_input(2)
    type_text(text)
    tap('Yadda saxla', exact=True, kind='Button')
    wait('Tənzimləmələr', kind='Button')

    after = call('/me', ctx.token)
    assert after['bio'] == text, f'bio serverə getmədi: {after["bio"]!r}'
    call('/me', ctx.token, 'PATCH', {'bio': before['bio'] or ''})
    return f'bio yazıldı və serverdə göründü ({len(text)} simvol), sonra geri'


def flow_onboarding(ctx: Ctx) -> str:
    """Qeydiyyat → maraqlar (2/3) → profil qurma (3/3) → tətbiq. Sonda köhnə sessiya qaytarılır."""
    name = f'uionb{int(time.time())}'
    email = f'{name}@test.az'

    relaunch()
    tap('Profil, tab')
    wait('Tənzimləmələr', kind='Button')
    tap('Tənzimləmələr', kind='Button')
    scroll_to('Çıxış', exact=True, kind='Button')
    tap('Çıxış', exact=True, kind='Button')

    wait('Qeydiyyat', exact=True)
    settle()
    tap('Qeydiyyat', exact=True)
    wait('Ad Soyad', exact=True)
    settle()
    for i, value in enumerate(['UI Onboarding', name, email, PASSWORD]):
        tap_input(i)
        type_text(value)
    tap('Davam et', exact=True)

    # Addım 2/3 — ən azı bir maraq seçilməlidir
    wait('Səni nə maraqlandırır?', exact=True)
    settle()
    tap('Təbiət')
    # Düymənin etiketi seçim sayını göstərir — seçim tutulmayıbsa toxunmaq erkəndir
    wait('Davam et (1 seçildi)', exact=True)
    # Qeydiyyat formasından sonra klaviatura hələ bağlanır və alt panel sürüşür;
    # ilk toxunuş bəzən boşa düşür, ona görə ekran dəyişənə qədər təkrarlanır
    for _ in range(3):
        tap('Davam et (1 seçildi)', exact=True)
        time.sleep(1.5)
        if find('Özünü tanıt', exact=True):
            break

    # Addım 3/3 — ekran 39
    wait('Özünü tanıt', exact=True)
    settle()
    assert find('Addım 3 / 3', exact=True), 'addım göstəricisi yoxdur'
    tap('Sonra edərəm', exact=True, kind='Button')
    wait('Lent, tab')

    token = login(name)
    me = call('/me', token)
    assert me['onboardingCompleted'] is True, 'onboarding bayrağı qalxmadı'
    assert me['interests'], 'maraqlar yazılmadı'
    # Test yaratdığı hesabı özü təmizləyir
    call('/me', token, 'DELETE')

    # Köhnə sessiyanı qaytar — qalan axınlar ona bağlıdır
    tap('Profil, tab')
    wait('Tənzimləmələr', kind='Button')
    tap('Tənzimləmələr', kind='Button')
    scroll_to('Çıxış', exact=True, kind='Button')
    tap('Çıxış', exact=True, kind='Button')
    wait('Daxil ol', exact=True)
    settle()
    tap('Daxil ol', exact=True)
    wait('E-mail və ya istifadəçi adı', exact=True)
    settle()
    tap_input(0)
    type_text(ctx.user)
    tap_input(1)
    type_text(PASSWORD)
    tap_lowest('Daxil ol')
    wait('Lent, tab', timeout=15)

    return f'@{name} yaradıldı, 3 addım keçildi, hesab silindi, @{ctx.user} geri qayıtdı'


FLOWS = {
    'like': flow_like,
    'comment': flow_comment,
    'follow': flow_follow,
    'report': flow_report,
    'chat': flow_chat,
    'live': flow_live,
    'notifications': flow_notifications,
    'review': flow_review,
    'photo_post': flow_photo_post,
    'story': flow_story,
    'save': flow_save,
    'settings': flow_settings,
    'edit_profile': flow_edit_profile,
}

# `onboarding` qəsdən defolt siyahıda deyil: çıxış → qeydiyyat → yenidən giriş
# ardıcıllığında iOS eyni adlı düyməni iki ekranda göstərir və axın yanlış yerə
# toxunur. Əl ilə işlətmək üçün: `python3 e2e/smoke.py onboarding`
FLOWS_MANUAL = {'onboarding': flow_onboarding}


def main() -> None:
    # Fonda işləyəndə nəticələr sonda yox, axın-axın görünsün
    sys.stdout.reconfigure(line_buffering=True)
    ctx = Ctx()
    names = sys.argv[1:] or list(FLOWS)
    registry = {**FLOWS, **FLOWS_MANUAL}
    print(f'simulyator {UDID[:8]}… · istifadəçi @{ctx.user}\n')
    failed = 0
    for n in names:
        t0 = time.time()
        try:
            detail = registry[n](ctx)
            print(f'✓ {n:14} {time.time() - t0:5.1f}s  {detail}')
        except Exception as e:  # noqa: BLE001 — hər axının xətası hesabatda görünməlidir
            failed += 1
            print(f'✗ {n:14} {time.time() - t0:5.1f}s  {e}  [{shot("fail-" + n)}]')
    print(f'\n{len(names) - failed}/{len(names)} axın keçdi')
    sys.exit(1 if failed else 0)


if __name__ == '__main__':
    main()
