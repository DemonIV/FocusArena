# App Review — Guideline 2.1 "Information Needed" cevabı (v1.0, build 23)

> Red tarihi: 14 Ağustos 2026 · **Kod hatası bulunmadı** — Apple yalnızca ekran kaydı +
> yazılı bilgi istiyor. Yeni build GEREKMEZ; cevap **Resolution Center**'a yazılır ve
> aynı metin **App Review Information → Notes** alanına kalıcı olarak yapıştırılır.
>
> Apple'ın istediği 8 madde aşağıda birebir sırayla cevaplanmıştır.
> Madde 1 (ekran kaydı) kullanıcı tarafından çekilir → çekim planı en altta.

---

## A) Resolution Center'a + Notes alanına yapıştırılacak metin (İngilizce)

```
Hello, and thank you for reviewing StudySquad. Below is the information requested,
in the same order.

A screen recording captured on a physical iPhone is attached to this message. It
starts from app launch and walks through registration, login, the core focus-timer
flow, the social features (friend requests, blocking), the paywall and the coin
shop with in-app purchase details, the push-notification permission prompt, and
account deletion.

2) DEVICES AND OS VERSIONS TESTED
- iPhone 14 Pro, iOS 26.6 — physical device, build 23 installed via TestFlight.
  This is our primary test device and the attached screen recording was captured
  on it.
- iOS Simulator (iPhone 16 Pro) — used during development only, not for release
  verification.
The app is iPhone-only (supportsTablet is false) and requires iOS 15.1 or later.
The Live Activity / lock-screen countdown requires iOS 16.2 or later; on older
versions the rest of the app works normally and no Live Activity is started.

3) WHAT THE APP DOES, AND FOR WHOM
StudySquad is a social study-focus timer for students (target audience: high school
and university students, ages 13+).

Problem it solves: studying alone is hard to sustain. Students lose focus, break
their routine after a few days, and have no way to feel accountable to anyone.

How the app solves it: the user creates study subjects (e.g. Math, Physics), sets a
daily goal, and runs focus sessions with a classic timer or a Pomodoro cycle
(25/5 or 50/10, 4 rounds, with break screens). Every completed session earns XP and
coins, builds a daily streak, and feeds detailed statistics (day-by-day calendar
heatmap, per-subject distribution, weekly charts, and a 0-100 "focus score" that
measures completion, presence and steadiness).

The value comes from the social layer: users add friends, see who is studying right
now, compare weekly minutes on friend and global leaderboards, join small private
study rooms ("study together" presence), and take part in a weekly personal
challenge. Cosmetic rewards (timer frames, avatars, virtual pets) are bought with
coins earned by studying. There is no gambling, no user-to-user messaging, and no
advertising anywhere in the app.

4) SETUP AND ACCESS INSTRUCTIONS
No sample files or special setup are needed. The app talks to our own backend, so
an internet connection is required.

Demo account (already populated with friends, study history and coins):
   Username / e-mail: testalpha1@studysquad.test
   Password: Passw0rd123
A second demo account, if you want to test the friend flow between two accounts:
   testbeta2@studysquad.test / Passw0rd123   (already friends with testalpha1)
You can also register a brand-new account with any e-mail address; no e-mail
verification is required, and the 5-step onboarding (choose subjects, set a daily
goal) takes about 30 seconds.

Reaching the main features after signing in:
- Focus timer:      "Timer" tab -> pick a subject and a duration -> Start.
                    Switch between "Classic" and "Pomodoro" with the segmented control.
- Statistics:       "Profile" tab (weekly chart, subject donut, streak heatmap;
                    tap the heatmap for the month-by-month calendar).
- Leaderboards:     "Leaderboard" tab (global / friends, daily-weekly-monthly-all time,
                    plus the weekly "Country Wars" league).
- Study rooms:      "Rooms" tab -> create a private room or join with an 8-character
                    invite code.
- Friends:          "Friends" tab -> search by username -> send request. Requests must
                    be explicitly accepted. Long-press / open a friend row for the
                    block action.
- Paywall (Pro):    "Profile" tab -> tap the "StudySquad Pro" card at the top.
- Coin Shop:        "Profile" tab -> "Frames" shop section -> tap the coin balance
                    chip in its header.
- Account deletion: "Profile" tab -> scroll to the bottom -> "Delete account"
                    (two-step confirmation, deletes the account and all its data).

Permission prompts: the only system prompt the app shows is the push-notification
prompt (study reminders and friend activity). It is optional and the app is fully
usable if it is declined. The app does NOT request location, contacts, camera,
microphone, photos, or App Tracking Transparency, and it does not use IDFA.

5) EXTERNAL SERVICES USED
- Fly.io - hosting for our own backend API (Node.js/Fastify). All app data flows
  through this API.
- Supabase (PostgreSQL, EU / Frankfurt region) - our application database.
- Upstash (Redis) - caching, session tokens, leaderboard and presence data.
- RevenueCat - in-app purchase receipt validation and subscription status. It does
  not process payments; all payments are handled by Apple's In-App Purchase system.
- Expo Push Notification Service (Apple APNs behind it) - delivery of push
  notifications.
- Sentry - crash reporting. PostHog - product analytics (aggregate usage only).
- Apple ActivityKit - the lock-screen / Dynamic Island Live Activity countdown.
There are NO AI services, NO third-party data providers, NO advertising or
attribution SDKs, and NO third-party login providers. All study content is created
by the users themselves.

6) REGIONAL DIFFERENCES
There are none. The app offers exactly the same features, content and prices in
every region. The interface is localized into 10 languages (English, Turkish,
German, Spanish, French, Italian, Dutch, Polish, Portuguese, Russian) and follows
the device language; all other behaviour is identical worldwide. The "Country Wars"
leaderboard groups users by the country code reported by the device locale
(ISO 3166-1 alpha-2) - it is a cosmetic grouping only, no location data is
collected and no feature is restricted by country.

7) REGULATED INDUSTRY / THIRD-PARTY MATERIAL
StudySquad does not operate in a regulated industry (no health, finance, gambling,
dating or medical functionality) and does not provide any protected third-party
material. All user-facing content is either created by the users (subject names,
room names, usernames) or produced by us. The only third-party asset is the
animated pet artwork, based on Google's Noto Emoji set, used under the
Creative Commons Attribution 4.0 (CC BY 4.0) license, which permits commercial use
with attribution.

8) IN-APP PURCHASES: WHAT IS SOLD AND WHERE
Five products were submitted with this version. Everything else in the app is free,
and coins can also be earned for free by completing focus sessions - the packs are
only a shortcut.

a) StudySquad Pro - auto-renewing subscription, monthly (pro_monthly) and yearly
   (pro_yearly), one shared "pro" entitlement. Pro unlocks unlimited study subjects
   (free tier allows 8), streak freeze, Zen focus mode, animated timer frames and
   Pro-only badges.
   HOW TO REACH IT: sign in -> "Profile" tab (last tab) -> tap the "StudySquad Pro"
   card at the top of the screen. The paywall opens and shows, for each plan, the
   product title, the subscription length, the localized price, an auto-renewal
   notice, tappable Terms of Use and Privacy Policy links, and a "Restore purchases"
   action. The same paywall is also offered once during onboarding.

b) Coin packs - consumables: coins_1000 (1,000 coins), coins_5500 (5,500 coins),
   coins_12000 (12,000 coins). Coins are the cosmetic currency, spent on timer
   frames, avatars and virtual pets. They have no cash value, cannot be transferred
   between accounts, and are not refundable.
   HOW TO REACH IT: sign in -> "Profile" tab -> scroll to the "Frames" shop section
   -> tap the coin balance chip (with the coin icon) in its header -> the Coin Shop
   opens with the three packs and their prices.

Please let us know if anything else would help the review. Thank you for your time.
```

---

## A2) ⚠️ ASC'ye GERÇEKTEN yapıştırılacak metin (4000 karakter sınırı)

> **Yukarıdaki (A) metni 7810 karakter — ASC'ye SIĞMIYOR.** 14 Ağustos'ta tarayıcıdan
> doğrulandı: **Resolution Center reply kutusu 4000**, **App Review Information → Notes
> alanı da 4000** karakterle sınırlı (Notes'ta hâlihazırda 1214 karakter dolu, temizlenip
> bu metin yazılacak). Aşağıdaki sürüm **3942 karakter** — 8 maddenin hepsi, demo hesaplar,
> block/IAP/hesap silme yönlendirmeleri korunmuş hâlde. **Yapıştırılacak olan budur.**

```
Thank you for reviewing StudySquad. The requested information follows, in the same order.

1) SCREEN RECORDING
Attached. Captured on a physical iPhone 14 Pro (iOS 26.6), starting from app launch: registration + onboarding, the push-notification prompt, login, the focus timer and Pomodoro, the friend request and BLOCK flow, the Pro paywall, the coin shop, and the two-step account deletion.

2) DEVICES / OS TESTED
iPhone 14 Pro, iOS 26.6 - physical device, build 23 via TestFlight; used for the recording. The iOS Simulator was used during development only. The app is iPhone-only and requires iOS 15.1+; the Live Activity countdown requires iOS 16.2+ and is simply not started on older versions.

3) FUNCTION AND TARGET AUDIENCE
StudySquad is a social study-focus timer for students (high school and university, 13+). Studying alone is hard to sustain. A user creates subjects (Math, Physics...), sets a daily goal and runs focus sessions with a classic timer or a Pomodoro cycle. Sessions earn XP and coins, build a streak and feed statistics (heatmap, per-subject breakdown, weekly charts, a 0-100 focus score). The value is the social layer: friends, who is studying right now, weekly leaderboards and small private study rooms. Cosmetics (frames, avatars, pets) are bought with coins earned by studying. No gambling, no user-to-user messaging, no advertising.

4) SETUP AND ACCESS
No sample files or special setup; an internet connection is required.
Demo account, pre-populated: testalpha1@studysquad.test / Passw0rd123
Second account for the friend flow: testbeta2@studysquad.test / Passw0rd123
A new account can also be registered; no email verification, onboarding ~30 seconds.
Navigation: Timer tab (subject + duration, Start; Classic/Pomodoro switch). Profile tab (stats, heatmap, paywall card, Frames shop, account deletion). Leaderboard tab. Rooms tab (create, or join with an 8-character code). Friends tab (search by username, send request; open a friend row to block).
The only system prompt is the optional push-notification prompt. The app does not request location, contacts, camera, microphone, photos or App Tracking Transparency, and does not use IDFA.

5) EXTERNAL SERVICES
Fly.io (our own Node.js API), Supabase/PostgreSQL (database), Upstash Redis (cache, sessions), RevenueCat (receipt validation only; all payments are handled by Apple's IAP), Expo Push over APNs, Sentry (crashes), PostHog (aggregate analytics), Apple ActivityKit. No AI services, no third-party data providers, no advertising or attribution SDKs, no third-party login.

6) REGIONAL DIFFERENCES
None - identical features, content and pricing everywhere. The interface is localized into 10 languages and follows the device language. "Country Wars" groups users by the device locale country code: cosmetic only, no location data is collected and no feature is region-restricted.

7) REGULATED INDUSTRY / THIRD-PARTY MATERIAL
Not applicable: no health, finance, gambling, dating or medical functionality, and no protected third-party material. The only third-party asset is the animated pet artwork, based on Google's Noto Emoji set, used under CC BY 4.0 (commercial use permitted with attribution).

8) IN-APP PURCHASES
a) StudySquad Pro - auto-renewing subscription, monthly (pro_monthly) and yearly (pro_yearly), one shared "pro" entitlement: unlimited subjects (free tier allows 8), streak freeze, Zen mode, animated frames, Pro badges. Reached from the Profile tab, "StudySquad Pro" card, and once during onboarding. The paywall shows the title, length, localized price, the auto-renewal notice, Terms of Use and Privacy Policy links and "Restore purchases".
b) Coin packs - consumables coins_1000, coins_5500, coins_12000. Coins are the cosmetic currency for frames, avatars and pets; no cash value, not transferable, and also earned free by studying. Reached from the Profile tab, Frames section, coin balance chip.

Thank you for your time.
```

---

## B) Ekran kaydı çekim planı (madde 1) — kullanıcı yapacak

**Kurallar (Apple'ın şartı):** gerçek iPhone'da, güncel iOS'ta, **uygulamayı açarak başla**,
tek kesintisiz kayıt. Süre 3–5 dk ideal. Sesli anlatım gerekmez (istersen ekleyebilirsin).
Kayıt: Ayarlar → Denetim Merkezi → **Ekran Kaydı**'nı ekle → sağ üstten aşağı çek → ⏺.

> ⚠️ Kayda başlamadan önce **uygulamayı bir kez açıp kapat** (backend makinesi uyanmış
> olsun, hiçbir yerde sonsuz spinner görünmesin). Kayıtta boş/yüklenen ekran kalırsa
> Apple bunu "2.1 bug" sayar.

| # | Sahne | Ne yapılacak |
|---|-------|--------------|
| 1 | **Açılış** | Ana ekrandan StudySquad ikonuna dokun (kayıt uygulama açılışıyla başlamalı) |
| 2 | **Kayıt olma** | "Kayıt ol" → yeni bir e-posta ile hesap aç → onboarding'i baştan sona geç (konu seç, hedef seç). Onboarding'de **trial paywall** çıkarsa 3-4 sn göster, sonra kapat |
| 3 | **Bildirim izni** | Push izni istemi çıkınca **göster** ve "İzin ver"e bas (Apple bunu görmek istiyor) |
| 4 | **Çıkış + Giriş** | Profile → Çıkış yap → **demo hesapla giriş yap** (`testalpha1@studysquad.test` / `Passw0rd123`) |
| 5 | **Timer (çekirdek özellik)** | Timer sekmesi → konu + süre seç → **Başlat** → 10-15 sn say → duraklat/devam → **Durdur** → seans fişini (Study Receipt) göster |
| 6 | **Pomodoro** | Segment'ten 🍅 Pomodoro'yu seç, ekranı 3-4 sn göster (başlatmana gerek yok) |
| 7 | **İstatistikler** | Home'daki haftalık grafik + Profile → konu donut'u + streak heatmap → heatmap'e dokunup aylık takvimi aç |
| 8 | **Leaderboard** | Leaderboard sekmesi → global/arkadaş + Country Wars'ı göster |
| 9 | **Rooms** | Rooms sekmesi → bir odaya gir, oda içi listeyi göster |
| 10 | **Friends + ENGELLEME** ⚠️ | Friends sekmesi → arkadaş listesi → bir kullanıcı satırından **Engelle (Block)** akışını aç ve göster (Apple UGC için bunu özellikle istedi). Sonra vazgeç/geri al |
| 11 | **Paywall (IAP)** ⚠️ | Profile → üstteki 👑 **StudySquad Pro** kartına dokun → paywall'da **fiyat, süre (Aylık/Yıllık), otomatik yenilenme yazısı, Kullanım Şartları + Gizlilik linkleri, Satın alımları geri yükle** hepsi ekranda görünecek şekilde 5-6 sn yavaşça kaydır |
| 12 | **Coin Shop (IAP)** ⚠️ | Profile → "Çerçeveler" bölümü → 🪙 bakiye çipine dokun → 3 coin paketi + fiyatlar görünsün |
| 13 | **Satın alma akışı** | Bir pakete dokunup **Apple'ın satın alma sayfası (sandbox) açılsın** → sonra iptal et. (Açılmazsa sorun değil; kayda "sandbox purchase sheet" görünmesi bonus) |
| 14 | **Hesap silme** ⚠️ | Profile → en alta kaydır → **Hesabı sil** → iki aşamalı onay ekranını göster. **Demo hesabı GERÇEKTEN SİLME** — son onaydan vazgeç! |

---

## B2) Yükleme yerleri (14 Ağustos'ta ASC'de tarayıcıdan doğrulandı)

| Ne | Tam yol | Not |
|---|---|---|
| **Ekran kaydı + destekleyici görüntüler** | Distribution → **App Review** → 12 Ağu gönderimi → sayfanın en altı → **"Reply to App Review"** → açılan modal → **Attach File** | `input[type=file]` **multiple**, `accept` kısıtı yok. Metin kutusu **4000 karakter**. Gönderdikten sonra ek eklenemiyor → önce dosyayı hazırla |
| Hakem için kalıcı ek | App Store → iOS App 1.0 → **App Review Information → Attachment → Choose File** | `#appStoreReviewAttachments_undefined`, **tek dosya** |
| Notes (Apple "future submissions" için istedi) | App Store → iOS App 1.0 → App Review Information → **Notes** | **4000 karakter**; 14 Ağu itibarıyla 1214 karakter dolu → temizlenip A2 metni yazılacak |
| Mağaza vitrini ekran görüntüleri | App Store → 1.0 → **Previews and Screenshots** | `accept=.jpg,.jpeg,.png,.mov,.m4v,.mp4`. **Zaten 8 tane yüklü (6.5" Display) — dokunma** |

Video çok büyük olursa buluta (Drive/Dropbox) yükleyip **herkese açık linki** cevaba yaz —
Apple link kabul ediyor.

---

## B3) ⚠️ Video kalitesi — WhatsApp'tan geçirme

14 Ağustos'ta çekilen kayıt WhatsApp üzerinden bilgisayara aktarıldı ve
`ffprobe` ile ölçüldü: **384×848 piksel**, 1378 kb/sn, 3 dk 11 sn, 31,6 MB.
Orijinal 1179×2556 → WhatsApp %70 küçültmüş.

**Bu çözünürlük kullanılamaz:** hakem paywall'daki fiyatı, "Aylık/Yıllık" ibaresini,
otomatik yenilenme yazısını ve Terms/Privacy linklerini okuyamaz — Apple'ın madde 8'de
ve Guideline 3.1.2'de tam olarak istediği şey bunlar. Bu hâliyle gönderilirse ikinci red riski yüksek.

**Kural: kaydı WhatsApp'la aktarma.** Kullanılabilir yollar:
- iCloud.com → Fotoğraflar → kaydı seç → İndir (orijinal kalite, kablo gerekmez)
- Google Drive / OneDrive uygulamasından yükle → PC'den indir (video sıkıştırılmaz)
- USB kablo (aşağıdaki tuzağa dikkat)

Ekran görüntüleri (945×2048, 16 adet) destekleyici kanıt olarak **yeterli**, sorun yok.

### USB/MTP tuzağı (14 Ağustos'ta yaşandı)
- iPhone'da **`DCIM` klasörü görünmüyor**; `Internal Storage` altında doğrudan
  `202511_a`, `202608_b` gibi klasörler var. Doğru yer burası.
- **Klasör adı dosya tarihini vermiyor** — `202603_a` içinde 1–2 Ağustos 2026 dosyaları çıktı.
  Tek tek klasör aramak yerine hepsini programatik tara.
- iCloud Fotoğraflar + "iPhone Depolamasını Optimize Et" açıkken **klasörlerin çoğu boş görünür**
  (39 klasörün 5'i dolu, toplam 251 dosya, en yenisi 2 Ağustos). Orijinaller iCloud'da olduğu için
  kablo bunları göstermez. **iCloud alanı satın almak tek başına yetmez** —
  Ayarlar → Fotoğraflar → **"Orijinalleri İndir ve Sakla"** gerekir (saatler sürer, 100+ GB iner).
- Tarama komutu (PowerShell, Shell.Application COM ile — MTP'de `Get-ChildItem` çalışmaz):

```powershell
$shell = New-Object -ComObject Shell.Application
$iphone = $shell.NameSpace(17).Items() | Where-Object { $_.Name -eq "Apple iPhone" }
$int = (($shell.NameSpace($iphone.Path)).Items() | Where-Object { $_.Name -eq "Internal Storage" }).GetFolder
foreach ($a in $int.Items()) { $c = @($a.GetFolder.Items()).Count; if ($c) { "$($a.Name) -> $c" } }
```

Telefon takılı değilse/kilitliyse `Apple iPhone` "This PC" altında hiç görünmez
(`Get-PnpDevice -Class WPD` çıktısında `Unknown` olur).

---

## B4) ⚠️ Eksik ekran görüntüleri — çekilmesi gereken 5 kare (18 Ağustos'ta tespit edildi)

`C:\Users\alper\Downloads\iphonee\` altındaki 16 görüntü (945×2048) incelendi. Kapsadıkları:
login, ana sayfa (donut + haftalık grafik), timer (klasik / pomodoro ayarları / çalışırken /
mola), sıralama (küresel + Ülke Savaşları), odalar (liste + oda kur + oda detayı), arkadaş
listesi, profil (Pro kartı + streak heatmap, istatistikler + coin bakiyesi, avatarlar +
ünvanlar, ayarlar + "Hesabı Sil" butonu).

**Ama Apple'ın red mektubunda özellikle sorduğu şu ekranlar YOK:**

| # | Çekilecek kare | Neden gerekli | Nasıl ulaşılır |
|---|---|---|---|
| A | **Paywall (tam)** — fiyat, "Aylık/Yıllık", otomatik yenilenme yazısı, Kullanım Şartları + Gizlilik linkleri, "Satın alımları geri yükle" **hepsi tek karede** | Madde 8 + Guideline 3.1.2'nin tam konusu | Profil → üstteki 👑 **StudySquad Pro** kartı. Sığmazsa 2 kare çek (üst/alt) |
| B | **Coin Shop** — 3 paket + fiyatları | Madde 8 (consumable'lar) | Profil → "Çerçeve Mağazası" → 🪙 bakiye çipi (1.300 yazan) |
| C | **Engelleme (Block) akışı** | Apple UGC için ayrıca istedi; Notes'ta "users can block other users" yazıyor, kanıt lazım | Arkadaşlar → `testbeta2` satırını aç → Engelle seçeneği görünsün |
| D | **Push izin istemi** (iOS'un sistem dialogu) | Madde 4 — "hangi izinler isteniyor" | Uygulamayı yeni hesapla aç / izni sıfırla → istem çıkınca kare al |
| E | **Hesap silme onay ekranı** (iki aşamalı onayın 2. adımı) | Elimizde sadece "Hesabı Sil" butonu var, onay ekranı yok | Profil → en alt → Hesabı Sil → onay ekranını göster, **son adımı ONAYLAMA** |

Bu 5 kare olmadan gönderim yapılırsa ikinci red riski yüksek — çünkü cevap metni bunları
anlatıyor ama görsel kanıt yok, videonun kendisi de okunmaz çözünürlükte (B3).

---

## C) Gönderim öncesi kontrol listesi

- [ ] `fly.toml` → `min_machines_running = 1` deploy edildi (hakem uykudaki makineye denk gelmesin)
- [x] Metindeki `<MODEL>` / `<VERSION>` yer tutucuları dolduruldu (iPhone 14 Pro / iOS 26.6)
- [x] Ekran kaydı çekildi (3 dk 11 sn) + 16 ekran görüntüsü
- [x] **Kaydın ORİJİNALİ** telefondan çıkarıldı — 20 Ağu: TR kaydı 1180×2556 / 4:55 / 145 MB `Downloads\ScreenRecording_08-19-2026 23-17-56_1.MP4` (bkz. E1)
- [ ] **İngilizce kayıt** PC'ye aktarıldı — Apple'a gidecek asıl video bu (bkz. E4/1)
- [ ] **Eksik ekran görüntüleri**: coin shop ✅ (`IMG_7586.PNG`) · paywall ⚠️ yarım (Terms/Privacy kadrajda yok, `IMG_7587.PNG`) · block ❌ · push izni ❌ · hesap silme onayı ❌ (bkz. E1/E3)
- [ ] A2 metni (3942 karakter) Resolution Center reply kutusuna yazıldı
- [x] A2 metni **App Review Information → Notes** alanına yapıştırıldı ve kaydedildi (18 Ağustos 2026, 3942/4000, "✓ Saved" doğrulandı — eski 1214 karakterlik metnin yerine geçti)
- [x] Demo hesap bilgileri güncel: `testalpha1@studysquad.test` / `Passw0rd123`
- [x] 16 görüntü inceleme sırasına göre adlandırıldı (`01-login-screen.jpg` … `16-profile-settings-delete-account.jpg`), yükleme için scratchpad'de hazır
- [ ] Video + ekran görüntüleri **Attach File** ile eklendi (gönderdikten sonra ek eklenemiyor!)
- [ ] Resolution Center'a cevap gönderildi → durum tekrar "Waiting for Review"

---

## D) Oturum durumu — 18 Ağustos 2026

**Tamamlanan:**
- A2 metni **App Review Information → Notes** alanına yazıldı ve kaydedildi (3942/4000, "✓ Saved").
  Eski 1214 karakterlik not metninin yerini aldı.
- 16 ekran görüntüsü tek tek incelendi, inceleme sırasına göre adlandırılıp yükleme için
  scratchpad'e (`asc-evidence/`) kopyalandı — toplam 1,7 MB, `file_upload` limitine uygun.

**Tıkanan noktalar (ikisi de kullanıcıda):**
1. **Video hâlâ WhatsApp sürümü.** `Downloads\iphonee\WhatsApp Video 2026-08-14 at 22.39.32.mp4`
   `ffprobe` ile ölçüldü: **384×848**, 33,2 MB, 3:11 — yani 14 Ağustos'taki dosyanın aynısı,
   yeni bir şey gelmemiş. Kullanılamaz (B3). Ayrıca 33 MB, `file_upload`'ın 10 MB limitinin
   üstünde → **Claude yükleyemez, kullanıcı elle eklemeli.** Kullanıcı orijinali çıkaracağını belirtti.
2. **5 ekran görüntüsü eksik** (paywall, coin shop, block, push izni, hesap silme onayı) — bkz. B4.
   Cevap metni bunları anlatıyor ama görsel kanıt yok.

**Sonraki oturumun ilk işi:** kullanıcının verdiği yoldaki videoyu `ffprobe` ile doğrula
(genişlik ≥ 1080 olmalı; gerekirse ffmpeg ile 720×1560 / ~50 MB'a indir), eksik 5 kareyi
mevcut 16'nın arasına doğru sıraya yerleştir, sonra Resolution Center → Reply modalında
A2 metni + görüntüleri koy, videoyu kullanıcıya ekletip **kullanıcı onayıyla** gönder.

---

## E) Oturum durumu — 20 Ağustos 2026 · Videolar çekildi (TR + EN)

Kullanıcı kaydı **iki dilde** çekti. Bilgisayara şu an **yalnızca Türkçe olan** aktarılmış.

### E1) Elimizdeki dosyalar

| Dosya | Ölçüm | Durum |
|---|---|---|
| `Downloads\ScreenRecording_08-19-2026 23-17-56_1.MP4` | **1180×2556**, 4 dk 55 sn, 3,9 Mb/sn, **145 MB** | ✅ **Türkçe kayıt, tam çözünürlük.** B3'teki WhatsApp sorunu çözüldü |
| İngilizce kayıt | — | ❌ **Henüz PC'de yok.** Aynı yolla (iCloud/Drive, WhatsApp DEĞİL) aktarılmalı |
| `Downloads\IMG_7586.PNG` | 1179×2556 | ✅ **Coin Shop (EN)** — 1.000/$1.99, 5.500/$7.99, 12.000/$12.99 → B4 maddesi **B tamam** |
| `Downloads\IMG_7587.PNG` | 1179×2556 | ⚠️ **Paywall (EN)** — Monthly $5.99 / Yearly $44.99 / Go Pro / Restore purchases / otomatik yenilenme yazısı var, **ama Terms + Privacy linkleri kadrajda YOK** → B4 maddesi **A yarım** |

Ekran görüntülerindeki kırmızı kayıt noktası ve 00:35 saati, İngilizce kaydın bu gece
çekildiğini gösteriyor — dosya telefonda duruyor.

### E2) ⚠️ Paywall'da Terms/Privacy linkleri neden görünmüyor (kod hatası DEĞİL)

`PaywallModal.tsx:205` `<LegalLinks />` bileşenini basıyor ve `LegalLinks.tsx` gerçekten
dokunulabilir **Kullanım Şartları · Gizlilik Politikası** linkleri üretiyor
(`LEGAL_URLS.terms` / `.privacy`, i18n anahtarları `legal.terms` / `legal.privacy` — hepsi mevcut).

Sorun: sheet `maxHeight: '88%'` ve içerik bir `ScrollView` içinde
(`PaywallModal.tsx:122`, `showsVerticalScrollIndicator={false}`). Linkler en son eleman
olduğu için **ekranın altında kalıyor**; kaydırma çubuğu da gizli olduğundan alt içerik
olduğu belli olmuyor. Hem videoda hem `IMG_7587.PNG`'de otomatik yenilenme yazısında kesiliyor.

**Yapılacak:** paywall açıkken sheet'in içinde **yukarı kaydır** → alta
"Kullanım Şartları · Gizlilik Politikası" gelsin → o kareyi çek/kaydet.
Bu, Guideline 3.1.2'nin ve A2 metnindeki 8-a maddesinin doğrudan konusu; kanıtsız gönderilirse
"metinde var diyor ama göstermiyor" durumu oluşur.

### E3) Türkçe kayıtta EKSİK olan sahneler (0–295 sn kare kare tarandı)

| B planı # | Sahne | Kayıtta var mı |
|---|---|---|
| 1 | Uygulama açılışı | ⚠️ Kayıt doğrudan **giriş ekranında** başlıyor (ana ekrandan ikona dokunma yok) |
| 2 | **Kayıt olma + onboarding** | ❌ Yok — mevcut demo hesapla giriş yapılmış |
| 3 | **Push izin istemi** | ❌ Yok |
| 4 | Giriş | ✅ 0–20 sn |
| 5 | Timer (klasik, çalışırken) | ✅ 45–60, 195–205, 265–275 sn |
| 6 | Pomodoro ayarları | ✅ ~60 sn |
| 7 | İstatistik + heatmap + aylık takvim | ✅ 150–175 sn |
| 8 | Leaderboard (Oyuncular/Ülkeler, Tüm Zamanlar) | ✅ 80–95 sn |
| 9 | Rooms (liste, oda kur, oda detayı, davet kodu) | ✅ 100–125, 220 sn |
| 10 | **Arkadaşlar → ENGELLE (Block)** | ❌ Yok — sadece liste, arama ve davet paylaşımı görünüyor |
| 11 | Paywall | ⚠️ Var (145–152 sn) ama **Terms/Privacy'ye kadar kaydırılmamış** (bkz. E2) |
| 12 | **Coin Shop (3 paket + fiyat)** | ❌ Videoda yok — sadece "Çerçeve Mağazası" ve 1.300 coin çipi. *(EN ekran görüntüsü kapatıyor)* |
| 13 | Sandbox satın alma sayfası | ❌ Yok |
| 14 | **Hesap silme iki aşamalı onay** | ❌ Yok — kayıt "Çıkış Yap" onayıyla bitiyor (280 sn) |

### E4) Sıradaki adımlar (öncelik sırasıyla)

1. **İngilizce kaydı PC'ye aktar** (iCloud.com → Fotoğraflar → İndir, veya Drive/OneDrive).
   Hakem İngilizce okuyor → **Apple'a gidecek asıl video İngilizce olan.** Türkçe kayıt
   yedek/lokalizasyon kanıtı; ikisini birden yollamak şart değil.
2. **Eksik kanıt kareleri** (ekran görüntüsü yeterli, yeniden çekim şart değil):
   - Paywall **alta kaydırılmış** hâli → Terms of Use · Privacy Policy görünsün *(en kritik)*
   - Arkadaşlar → `testbeta2` → **Block** akışı
   - **Push bildirim izni** sistem istemi
   - **Hesabı Sil** iki aşamalı onayın 2. adımı *(son onaya BASMA)*
3. Videoyu ASC'ye yüklemeden önce boyutu kontrol et — 145 MB büyük. Gerekirse
   `ffmpeg -i in.MP4 -vf scale=1080:-2 -c:v libx264 -crf 24 -preset veryfast -c:a aac -b:a 96k out.mp4`
   ile ~1080 genişlikte, okunabilirliği koruyarak küçült.
4. Sonra: Resolution Center → Reply → A2 metni + görüntüler + video → **kullanıcı onayıyla** gönder.
