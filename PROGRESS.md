# FocusArena — Proje İlerleme Özeti

> Sıfırdan bugüne (2026-05-22 → 2026-07-05) tüm adımların kronolojik özeti.
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

### Faz 9 — Satış Hunisi (3 Temmuz)
`3099ba9`, `c562529`, `3cec2a7`, `fa3f222`

- **Onboarding dönüşüm hunisi**: 5 adım (motivasyon adımı + plan özeti) + **trial paywall** (`3099ba9`).
- **Push bildirimleri genişletildi** (`3cec2a7`): arkadaşlık isteği/kabul push'ları, win-back cron'u (3/7 gün, pet temalı), bildirime dokununca deep-link, Profil'de opt-out toggle. Fly'a deploy edildi.
- **In-app review** (`fa3f222`): expo-store-review, koşul: 3+ seans && 45 günde 1; fişte 🪙 +coin gösterimi.
- 🎉 **Satış öncesi kod işlerinin tamamı bitti.**

### Faz 10 — Rebrand + İlk APK'lar + RevenueCat Kurulumu (3 Temmuz, öğleden sonra)
`e462c99`, `910528b`, `eea7478`

- **expo-doctor 18/18**: metro watchFolders düzeltildi, `@types/react-native` kaldırıldı, expo 54.0.35 (`e462c99`).
- **Sentry Gradle fix** (`910528b`): source-map upload org/token olmadan build'i kırıyordu → eas.json'a `SENTRY_DISABLE_AUTO_UPLOAD=true`.
- **🏷️ REBRAND: FocusArena → StudySquad** (`eea7478`): görünen ad, paket adı `com.studysquad.app`, 10 dildeki appName/upgradeTitle, paylaşım kartları (`studysquad.app`), paywall, backend push metinleri. Fly'a deploy edildi. Dahili isimler (EAS slug, fly.dev URL, repo) bilerek değişmedi.
- **✅ İlk 2 başarılı EAS APK**: eski markalı `5f6b887b` + StudySquad markalı `89baf50c` (Sentry+PostHog+RC anahtarları EAS preview env'inde). Emülatörde (adb) kuruldu ve test edildi.
- **RevenueCat paneli kuruldu**: entitlement `pro`, default offering Monthly+Yearly (Lifetime kaldırıldı), Play Store app `com.studysquad.app` + gerçek `goog_...` anahtarı alındı. Ders: **Test Store anahtarı release build'de çalışmıyor** (SDK hata diyaloğu basıyor) → gerçek anahtara geçildi. Service account JSON, Play Console doğrulaması sonrasına ertelendi.
- **Play Console kaydı başladı**: $25 ödendi, kimlik doğrulama (fotoğraf) sonucu bekleniyor.

### Faz 11 — Referral + Davet CTA'ları + Streak Freeze Görünürlüğü (5 Temmuz)

- **Ödüllü referans sistemi**: davet kodu = davet edenin kullanıcı adı; yeni kullanıcı (≤7 gün) Friends ekranında kodu girer → **iki tarafa 500 coin + otomatik arkadaşlık** + davet edene push bildirimi (10 dil). Backend `modules/referrals/` (`POST /referrals/redeem`), migration `010_referrals.sql` (PK=referred_id → tek kullanım; self/reverse-pair farming guard'ları). Migration DB'de uygulandı ✓.
- **Boş ekran davet CTA'ları**: Friends boş listesi → 🎁 davet kartı + kod girişi (yalnız yeni hesaplara); Leaderboard arkadaş bölümü boşsa davet footer'ı; Friends sekme çubuğunda kalıcı 🎁 butonu. `useInviteShare` hook'u native share sheet + analytics (`invite_share_opened`).
- **Streak freeze görünürlüğü**: Home'da streak ≥ 3 ise 🛡️ şeridi — Pro'ya "serin koruma altında", Pro olmayana amber "X günlük serini koru" CTA'sı → `PaywallModal (source: streak_shield)`.
- i18n: 10 dilde `invite.*` (14 anahtar) + `home.streakProtected/streakProtectCta`; push metni `REFERRAL_REDEEMED`.
- Backend+mobil `tsc --noEmit` temiz; Fly'a deploy edildi.

---

## 🏗️ Altyapı Durumu

| Bileşen | Durum |
|---------|-------|
| Marka | **StudySquad** · paket `com.studysquad.app` · Play başlığı: "StudySquad: Study w/ Friends" |
| Backend | Fly.io — https://focusarena.fly.dev (/health 200, tüm cron'lar zamanlı; URL dahili, kullanıcı görmez) |
| DB | Supabase Sydney (ap-southeast-2); yerel bağlantı psql **pooler** ile (direkt host IPv6-only) |
| Migration'lar | 002–010 hepsi uygulandı ✓ |
| EAS | preview APK'lar başarılı ✓; preview env'de Sentry/PostHog/RC anahtarları; production env **boş** |
| Gözlemlenebilirlik | Sentry + PostHog **aktif** (preview build'lerde anahtarlar gömülü) |
| RevenueCat | Proje + `pro` entitlement + Monthly/Yearly offering ✓; Android anahtarı: `goog_ZabvZUZeqQlkyIWjFOGtRHKstqg` (public SDK anahtarı, gizli değil); ⏳ EAS'ta hâlâ test anahtarı yazılı (değiştirilecek); service account JSON + "coins" offering bekliyor |
| Play Console | Kayıt yapıldı, **kimlik doğrulama bekleniyor**; sonra: 12 testçi × 14 gün closed testing zorunlu |
| iOS | Kullanıcının telefonu iOS ama Apple hesabı yok; Android testi emülatörde. eas.json submit bloğu placeholder'lı |
| Domain | `studysquad.app` **henüz alınmadı** (paylaşım kartlarında yazıyor + gizlilik politikası için gerekli) |

---

## 🔜 Sıradaki Adımlar

**Sonraki oturumun ilk işleri (Claude):**
1. EAS preview env'de RC anahtarını gerçek anahtarla değiştir → yeni preview build → emülatörde doğrula (RC hata diyaloğu kalkmalı; paywall paketleri Play ürünleri tanımlanana kadar boş kalır, normal). Komut: `npx eas-cli env:update --environment preview --variable-name EXPO_PUBLIC_REVENUECAT_ANDROID_KEY --value goog_ZabvZUZeqQlkyIWjFOGtRHKstqg --non-interactive`
2. Aynı env'leri **production** ortamına da ekle → production AAB build.
3. Gizlilik politikası metnini hazırla (Sentry/PostHog/RC veri işleme dahil).

**Kullanıcı tarafında bekleyenler:**
4. Play Console kimlik doğrulama sonucu → uygulama oluştur (`com.studysquad.app`) → **closed testing** track'ine AAB + **12 testçi e-postası** (14 gün kullanım şartı — testçileri şimdiden topla!).
5. Play Console'da IAP ürünleri: Pro abonelik (monthly/yearly + **free trial offer**) + coin paketleri (`coins_1000/5500/12000`).
6. RC'ye service account JSON bağla + ürünleri eşle + **"coins" offering** oluştur.
7. `studysquad.app` domain'ini al (~15$/yıl).
8. **Apple**: $99/yıl hesap → eas.json placeholder'larını doldur → iOS build → TestFlight (kendi iPhone'unda test) → ASC sözleşme/banka/vergi + IAP ürünleri + App Privacy → review.
9. Yayın sonrası fikirler: günlük görevler, ligler, pet besleme, Arena Pass.

> **Not (Claude için):** Yeni oturuma başlarken güncel durumu görmek için önce bu dosyayı oku; oturum sonunda yapılanları ve sıradaki adımları buraya işle.

---

## 📌 Çalışma Kuralları

- Commit'ler kullanıcının kendi adına — **Co-Authored-By trailer'ı yok**.
- Branch/PR yok — **direkt main'e commit + push** (push reddedilirse fetch + rebase).
- Hedef: **hem Google Play hem App Store**.
