# FocusArena — Proje İlerleme Özeti

> Sıfırdan bugüne (2026-05-22 → 2026-07-03) tüm adımların kronolojik özeti.
> Backend canlı: **https://focusarena.fly.dev** · Repo: main branch, direkt push workflow.

---

## 📅 Zaman Çizelgesi

### Faz 1 — Temel Kurulum (22–24 Mayıs)
`418bc02 ilk commit`

- **Monorepo** npm workspaces ile kuruldu: `backend/` (Fastify + Socket.io) · `mobile/` (React Native / Expo) · `shared/` (ortak tipler).
- **Backend modülleri** tamamlandı:
  - **Auth** — register/login/refresh/logout; 15 dk access + 7 gün refresh JWT (Redis'te, rotation + reuse detection); `authGuard` tüm modüllerde.
  - **Timer** — start/pause/resume/stop + status/sessions/stats + konu CRUD. Pause doğruluğu `accumulatedMs` ile; ≥%90 = tamamlandı; XP 10/dk, Level = ⌊xp/500⌋+1; UTC-gün bazlı streak; Redis TTL 4 saat.
  - **Leaderboard** — global/friends/me, 4 dönem (daily/weekly/monthly/alltime), competition ranking, dönem başına Redis cache + invalidation.
  - **Rooms** — CRUD + join/leave/invite; 8 karakterli davet kodları (Redis, 7 gün TTL); sahiplik devri; presence (Redis TTL 5 dk).
  - **Friends** — istek/kabul/red/engel; cross-request auto-accept; `relationship` enum'u; online status Redis'te.
  - **Achievements** — 10 rozet türü; `checkAndAward` engine, timer/rooms/friends hook'ları; `achievement:new` socket emit.
  - **WebSocket** — JWT handshake, `user:{id}` kişisel room, presence:ping, friend:status broadcast.
  - **Jobs (Bull)** — leaderboard-tick (60 sn), streak-reset (00:05 UTC), session-cleanup (10 dk); graceful shutdown.
- **Mobil uygulama** tamamlandı: 6 sekme (Home/Timer/Leaderboard/Rooms/Friends/Profile), Zustand + MMKV persist, TanStack Query v5, snake→camelCase mapper katmanı, 401 auto-refresh interceptor, Reanimated timer dairesi.

### Faz 2 — Fly.io Deploy (25 Mayıs)
`958b453 … f1ca2aa` (7 commit)

- Dockerfile + fly.toml; port 8080; `ws` paketi (Node 20 Supabase realtime); entrypoint path düzeltmeleri.
- ✅ Backend **https://focusarena.fly.dev** adresinde canlıya alındı.

### Faz 3 — Mobil Çalışır Hale + Bug Temizliği (26–27 Mayıs)

- Expo Go'da çalışır duruma getirildi; NativeWorklets crash çözüldü.
- Timer bug'ları düzeltildi: pause bug, DELETE body hatası, timeout/race, XP=0 hizalama bug'ı.
- **Konularım** (subjects) özelliği tamamlandı; timer UI modernize edildi.
- Odalar: private-only + max 2 oda + üye dakika takibi (migration 002).

### Faz 4 — i18n + UI Modernizasyonu (2–3 Haziran)
`08f8ec8` → PR #1 merge (`b37fe81`)

- **10 dil × tüm ekranlar** i18n tamamlandı (locales/*.json).
- Tüm ekranlar tek modern renk paletine taşındı; geçici Tanı sekmesi kaldırıldı.
- Özel süre girişi düzeltildi; RAPOR.md oluşturuldu.

### Faz 5 — 12/12 Viral Özellik (3 Haziran)
`14b21fc … ebcfaed` + cache fix `26fd102`

| # | Özellik | Özet |
|---|---------|------|
| 1 | Timer canlı sayı | "Şu an X kişi odaklanıyor" (Redis + socket broadcast) + best today + pulse |
| 2 | Study Receipt | Seans sonu paylaşılabilir fiş kartı (view-shot + expo-sharing) |
| 3 | Leaderboard konumun | Rank kartı + komşu penceresi + "bir üst sıraya X puan" |
| 4 | Streak ısı haritası | Profilde 30 günlük aktivite takvimi (saf View, SVG'siz) |
| 5 | Home redesign | Günlük hedef halkası + 7 günlük grafik + canlı arkadaşlar |
| 6 | Oda "kütüphane hissi" | Oda içi leaderboard, madalyalar, sen-vurgusu |
| 7 | Onboarding (3 adım) | Konu → günlük hedef → arkadaş bul |
| 8 | Push bildirimleri | Expo token kaydı + streak-danger hatırlatıcısı (cron 20:00 UTC) |
| 9 | Country Wars | Haftalık ülke ligi, bayraklar, ülkene katkın (migration 004) |
| 10 | Ghost Mode | Dünkü kendinle yarış (bugün vs dün aynı saat) |
| 11 | Study DNA | Kronotip + odak stili + süper güç; paylaşılabilir kart |
| 12 | Boss Battle | Haftalık global hedef (100.000 dk), herkesin katkısı |

- Migration 002+003+004 DB'de uygulandı (psql ile doğrulandı).
- EAS kuruldu: projectId + Android keystore kayıtlı (`d89bf7b`).

### Faz 6 — Gözlemlenebilirlik (4 Haziran)
`f45a786 … 5bb0910`

- **Sentry** (crash, backend+mobil) + **PostHog** (analytics) kuruldu; env-gated (anahtar girilince aktif).
- 5xx'ler route catch bloklarından Sentry'ye; PostHog `flushAt:1`.

### Faz 7 — Pro Abonelik (5 Haziran)
`00403f5` + `6434bb0`

- **RevenueCat** freemium: Pro = sınırsız konu + streak freeze. react-native-purchases 9.15.2.
- Env-gated; migration 005 + RC anahtarları ile aktive edilecek şekilde hazırlandı.

### Faz 8 — Coin Ekonomisi + Kozmetik + Petler (2 Temmuz)
`709256a … 72e918e` (7 commit) · Migration 005–009 ✓ · Fly deploy ✓

- **Coin para birimi** + timer çerçeve mağazası; çerçeveler leaderboard/friends/rooms'ta görünüyor.
- **Coin paketi IAP** (RevenueCat consumables: coins_1000/5500/12000).
- **Pro'ya özel animasyonlu çerçeveler** (prism, royal) + **sezonluk çerçeveler** (Yaz 2026).
- **Zen Modu** immersive timer ekranı + 3 Pro rozeti (`12c612c`).
- **Evcil hayvanlar**: coin ile alınan animasyonlu pet (Noto Emoji lottie, CC BY 4.0) + evrim + Home companion (`72e918e`).

### Faz 9 — Satış Hunisi (3 Temmuz) — SON OTURUM
`3099ba9`, `c562529`, `3cec2a7`, `fa3f222`

- **Onboarding dönüşüm hunisi**: 5 adım (motivasyon adımı + plan özeti) + **trial paywall** (`3099ba9`).
- **Push bildirimleri genişletildi** (`3cec2a7`): arkadaşlık isteği/kabul push'ları, win-back cron'u (3/7 gün, pet temalı), bildirime dokununca deep-link, Profil'de opt-out toggle. Fly'a deploy edildi.
- **In-app review** (`fa3f222`): expo-store-review, koşul: 3+ seans && 45 günde 1; fişte 🪙 +coin gösterimi.
- 🎉 **Satış öncesi kod işlerinin tamamı bitti.**

---

## 🏗️ Altyapı Durumu

| Bileşen | Durum |
|---------|-------|
| Backend | Fly.io — https://focusarena.fly.dev (/health 200, tüm cron'lar zamanlı) |
| DB | Supabase Sydney (ap-southeast-2); yerel bağlantı psql **pooler** ile (direkt host IPv6-only) |
| Migration'lar | 002–009 hepsi uygulandı ✓ |
| EAS | projectId + Android keystore kayıtlı; production profili AAB + autoIncrement hazır |
| Gözlemlenebilirlik | Sentry + PostHog kodu hazır, env-gated |
| Faturalama | RevenueCat: Pro abonelik kodu canlı; "coins" offering'i RC panelinde **henüz oluşturulmadı** |
| iOS | eas.json submit bloğu placeholder'lı (ascAppId, appleTeamId — Apple hesabı açılınca) |

---

## 🔜 Sıradaki Adımlar (mağaza yayını — kod dışı işler)

1. **EAS preview APK** al ve gerçek cihazda doğrula (push + paywall + coin akışı Expo Go'da çalışmaz):
   `cd mobile && eas build --platform android --profile preview`
   (Son kuyruğa alınan build `5c524c07` — sonucu doğrulanmadı.)
2. **Gizlilik politikası URL'i** hazırla (iki mağaza için zorunlu; Sentry/PostHog/RC veri işliyor).
3. **EAS secrets**: Sentry / PostHog / RevenueCat anahtarları.
4. **Google Play**: $25 hesap → production AAB → Play Console (listing, content rating, Data Safety) → internal track → RC ürünleri (Pro + coin paketleri) → aboneliğe **free trial offer** tanımla (kod introPrice'ı otomatik algılıyor).
5. **RevenueCat**: "coins" offering'ini oluştur.
6. **Apple**: $99/yıl hesap → eas.json placeholder'larını doldur → iOS build → ASC sözleşme/banka/vergi + IAP ürünleri + App Privacy → TestFlight → review.
7. Yayın sonrası fikirler: günlük görevler, ligler, pet besleme, Arena Pass.

---

## 📌 Çalışma Kuralları

- Commit'ler kullanıcının kendi adına — **Co-Authored-By trailer'ı yok**.
- Branch/PR yok — **direkt main'e commit + push** (push reddedilirse fetch + rebase).
- Hedef: **hem Google Play hem App Store**.
