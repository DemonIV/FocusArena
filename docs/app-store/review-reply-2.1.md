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
- iPhone <MODEL>, iOS <VERSION> — physical device, build 23 via TestFlight (primary
  test device; the attached screen recording was captured on it)
- iPhone <MODEL 2>, iOS <VERSION 2> — <sil veya doldur>
- iOS Simulator (iPhone 16 Pro, iOS 18) — used during development only
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

**Yükleme:** ASC → App Review → Resolution Center → cevabı yaz + videoyu ek olarak yükle.
Video 500 MB'ı geçerse: 1080p yerine daha düşük kalitede yeniden çek, ya da bir buluta
(Drive/Dropbox) yükleyip **herkese açık linki** cevaba yaz — Apple link kabul ediyor.

---

## C) Gönderim öncesi kontrol listesi

- [ ] `fly.toml` → `min_machines_running = 1` deploy edildi (hakem uykudaki makineye denk gelmesin)
- [ ] Yukarıdaki metinde `<MODEL>` / `<VERSION>` yer tutucuları gerçek cihazlarla dolduruldu
- [ ] Ekran kaydı çekildi (14 sahne, engelleme + IAP + hesap silme dahil)
- [ ] Metin **App Review Information → Notes** alanına da yapıştırıldı (Apple "future submissions" için istedi)
- [ ] Demo hesap bilgileri Notes'ta güncel: `testalpha1@studysquad.test` / `Passw0rd123`
- [ ] Resolution Center'a cevap + video gönderildi → durum tekrar "Waiting for Review"
