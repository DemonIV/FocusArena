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

### Faz 12 — Sıkı Mod (Forest mekaniği) (5 Temmuz)

- **Sıkı Mod 🔒 (ücretsiz)**: Timer'da toggle (settingsStore, persist). Seans çalışırken uygulamadan çıkılırsa 30 sn tolerans; 15. saniyede yerel uyarı bildirimi ("dön yoksa yanar"). Süre aşılırsa dönüşte **"seansın yandı"** modalı: **200 🪙 ile kurtar** (`POST /timer/rescue` + atomik `spend_coins`, migration 011 ✓) veya **pes et** (erken stop zaten 0 XP → backend'de ceza mantığı gerekmedi).
- Tasarım kararları: duraklatılmış seans yanmaz (meşru çıkış yolu); süre dolduysa ihlal sayılmaz (tamamlanma akışı kazanır); `strictLeftAt` persist → uygulama öldürülse bile ihlal yakalanır (sunucu senkronu beklenir). Pet varsa modalda üzülür (petEmoji💔).
- Monetizasyon: mekanik ücretsiz (retention), af coin'le (IAP talebi), gerçek OS-engelleme ileride Pro amiral gemisi. Analytics: `strict_left_app`, `strict_violation`, `strict_session_rescued`.
- i18n: 10 dilde `timer.strict*` (14 anahtar). Backend+mobil tsc temiz; Fly'a deploy edildi.

### Faz 13 — "Arkadaşın çalışıyor" push'u + arkadaş başına 🔔 (5 Temmuz)

- **"🔥 {name} şu an çalışıyor" push'u**: `startTimer`'dan fire-and-forget `notifyFriendsStudying` (10 dil). **Spam korkulukları**: arkadaş çifti başına günde 1 (Redis SET NX, UTC gün anahtarlı), alıcı başına günde max 3 (`push:fscap` INCR), alıcı o an odaktaysa gönderilmez (Sıkı Mod'la çelişmesin), global `push_enabled` + kişi bazlı mute'a saygılı. Dokununca Timer'a deep-link.
- **Arkadaş başına 🔔/🔕 toggle**: FriendsScreen satırında zil ikonu (optimistic). `PUT /friends/:id/mute`, `friend_push_mutes` tablosu (migration 012 ✓, satır=muted, varsayılan açık), `GET /friends` yanıtına `muted` bayrağı.
- Arkadaş online durumu görünürlüğü zaten vardı (satırda canlı durum + renk) — kullanıcı yeterli buldu, dokunulmadı. Ayrıca `referral_redeemed` push'una eksik olan tap-target eklendi (Friends).

### Faz 14 — Aylık İstatistikler (gün gün + konu bazlı, arkadaş profilleri) (6 Temmuz akşam)
`59f656b` + kritik fix `72ff607`

- **Yeni endpoint** `GET /timer/monthly?month=YYYY-MM&userId=…`: takvim ayı gün gün dakikalar + gün başına ve ay toplamı **konu kırılımı** (isim/ikon/renk, silinmiş konular "Konusuz" kovasında) + özet (toplam, aktif gün, en iyi gün, seans sayısı). **Yetki**: kendin veya kabul edilmiş arkadaş; yabancıya 403 (canlıda test edildi ✓). Redis cache: geçen aylar 24 saat (değişmez), içinde bulunulan ay 5 dk.
- **Mobil `MonthlyStatsModal`**: ay gezgini (‹ ay ›, 24 ay geriye), dokunulabilir takvim ısı haritası (günün konu kırılımı açılır), özet kutuları, pay çubuklu konu listesi. Girişler: Friends'te arkadaş satırına dokun → arkadaşın ayı; Profil'de heatmap kartına dokun → kendi ayın. i18n 10 dilde `monthly.*` (10 anahtar).
- Ürün kararı: gün gün detay **sadece arkadaşlara** (yabancıya kartvizit bile yok, düz 403) — gizlilik + mağaza incelemesi için muhafazakâr varsayılan. İleride "istatistiklerim arkadaşlara açık" toggle'ı eklenebilir.
- 🚨 **KRİTİK BUG BULUNDU ve DÜZELTİLDİ** (`72ff607`): `auth.service` login'i paylaşılan supabase istemcisinde `signInWithPassword` ile yapıyordu → supabase-js oturumu istemciye yapışıyor ve **sonraki TÜM sorgular service key yerine son giren kullanıcının JWT'siyle gidiyordu** (RLS satırları sessizce filtreliyor). Belirtiler: arkadaş istatistikleri hep 0; Boss Battle "5dk/1 savaşçı" (gerçek 10dk/2); leaderboard'lar login sonrası muhtemelen eksik. Fix: auth işlemleri izole `supabaseAuth` istemcisine taşındı + ana istemciye `persistSession:false`. Canlıda doğrulandı: self ✓ arkadaş (11dk, Physics 3+konusuz 8) ✓ 403 ✓.
- Ek sağlamlık: sessions sorgusu hata verirse sıfır hesaplanıp CACHE'lenmesin diye `sessionsRes.error` artık fırlatılıyor.
- Backend+mobil tsc temiz; Fly'a deploy ✓. **Mobil UI henüz cihazda görülmedi** — sonraki preview build'de test edilecek. Not: 403 testi için `testgamma3@studysquad.test` hesabı oluşturuldu (3. test hesabı).

### Faz 15 — Donut Grafik + 🍅 Pomodoro Döngüsü & Mola (6 Temmuz akşam-gece)
`bd064fa` (donut) + `0a4a2e2` (pomodoro)

- **Study DNA kaldırıldı → Konu Dağılımı donut grafiği** (`bd064fa`): Profil'de her konu kendi rengiyle dilim (dilim aralarında 2px boşluk), ortada toplam süre, altında legend (ikon + isim + süre + %). `react-native-svg 15.12.1` eklendi (**YENİ NATIVE MODÜL — sonraki build cache'siz olur**). Verisi yoksa bölüm gizli. `StudyDnaCard` silindi (backend `/timer/dna` + `timerService.getDNA` duruyor, ileride paylaşım kartında kullanılabilir).
- **Pomodoro döngüsü + mola** (`0a4a2e2`): Timer'da `Klasik | 🍅 Pomodoro` segmenti; önayarlar 25/5 ve 50/10; 4 tur; molada yeşil halka + geri sayım + "Molayı Atla" + "Döngüden çık"; mola bitiminde yerel bildirim; döngü sonunda özet (toplam odak/XP/coin) + toplanmış fiş paylaşımı. **Onaylanan tasarım mockup'ı**: https://claude.ai/code/artifact/dbe2533b-e6c3-42ff-adac-b18d4a099ad9
  - Mimari: her tur = backend'de normal seans (sıfır backend değişikliği, migration yok); mola tamamen istemcide (`pomodoroStore`, MMKV persist — app kill'e dayanıklı, `breakNotifId` persist'i çift bildirim planlamayı önler); Sıkı Mod molada otomatik askıda (aktif seans yokken `sessionBurnable` false); sonraki tur elle başlar; `breaksSkipped` sayacı ileriki **Focus Score**'un "molaya uyma" bileşeni için loglanıyor.
  - `timerStore`'a `onComplete` callback'i eklendi (doğal tamamlanma) → pomodoro turu ilerletiyor; **bonus fix**: klasik modda süre doğal bitince artık fiş gösteriliyor (eskiden sessizdi).
  - **Bildirim kanalı fix'i**: `ensureNotificationChannel()` artık app açılışında koşulsuz çağrılıyor (MainTabs) — kanalın `Device.isDevice`/pushEnabled guard'ları arkasında kalması yüzünden Sıkı Mod 15sn uyarısının hiç görünmemesi bug'ı KAPANDI.
- i18n: 10 dilde `timer.*` +25 anahtar (pomodoro) + `profile.subjectDistribution`.
- **SIRADAKİ KARAR (kullanıcı istedi)**: **Focus Score** — Faz 16'da yapıldı ↓.

### Faz 16 — 🎯 Focus Score V1 (8 Temmuz)
`1127011` · Migration 013 ✓ · Fly deploy ✓

- **Her seansa 0-100 odak kalitesi skoru**, sunucuda hesaplanır; XP/coin (hacim ödülü) ile ayrı, **leaderboard'a karışmaz**. Ağırlıklı 3 bileşen: **Tamamlanma %35** (gerçek dk / hedef dk) + **Varlık %35** (uygulamada kalma; `awayMs/sessionMs × 150` cezası) + **İstikrar %30** (`100 − exits×12 − pauses×5`). Formül `computeFocusScore` (timer.service.ts). Renk tier: ≥85 yeşil, ≥60 amber, <60 kırmızı.
- **Backend**: migration 013 `sessions.focus_score smallint` (nullable — eski seanslar + 0-dk seanslar skorsuz). `POST /timer/stop` artık opsiyonel `{exits,awayMs,pauses}` gövdesi alır (Zod `StopTimerSchema`, hepsi default 0 → **eski istemciler tamamlanma üzerinden skorlanır, kırılmaz**). `StopTimerResult.focus` kırılımı döner. `getStats` → `week.avgFocusScore` (haftalık ortalama, scored seanslar; null olabilir).
- **Mobil**: `timerStore` seans boyunca `exits`/`awayMs`/`pauses` toplar; `stop()`'ta açık away-spell'i katlayıp gönderir. AppState takibi **uygulama genelinde** `useFocusTracking` hook'uyla (MainTabs'te mount — sekme değişse de yakalar); sadece `background`/`active` dinlenir (iOS `inactive` exit'i şişirir → yoksayıldı); **duraklatılmış seansta dışarı çıkmak varlığı düşürmez** (meşru çıkış). Fişte renkli skor rozeti + 3 bileşen çubuğu (`StudyReceiptModal`, paylaşılan görüntüye dahil); profilde "bu haftaki odak kalitesi" kartı. Pomodoro döngü-sonu birleşik fişinde focus GÖSTERİLMEZ (her tur ayrı skorlanır, DB'de). i18n 10 dilde `receipt.focus*` (4) + `profile.focusScore*` (2).
- **Doğrulama**: backend+mobil `tsc` temiz; migration psql pooler ile uygulandı + kolon doğrulandı; `/health` 200, `/timer/stop` yeni gövdeyle 401 (route canlı). **Mobil UI cihazda GÖRÜLMEDİ** — sonraki build'de test edilecek (Faz 14+15+16 birlikte).

### Faz 17 — 🍎 iOS/TestFlight kurulumu + gerçek App Icon (8 Temmuz)
`adeb407` (ios config) + `79b5199` (bundle ID) + `5b6ff46` (submit temizlik) + `c0fcf6f` (app icon)

- **Apple Developer hesabı ONAYLANDI** → iOS yolu açıldı. Auth engelleri (sırayla çözüldü): (1) hesap güvenlik kilidi `-20209` → iforgot.apple.com ile açıldı; (2) `com.studysquad.app` bundle ID **başka bir Apple hesabında kayıtlı** (iOS bundle ID globalde benzersiz olmalı) → **iOS bundle ID `com.studysquadhq.app`** yapıldı. **Android paketi `com.studysquad.app` DEĞİŞMEDİ** (Play + RC ona bağlı); marka ismi StudySquad kaldı (kullanıcı "A — ismi koru" seçti, tam rebrand YAPILMADI). iOS bundle ID kullanıcıya görünmez/dahili.
- **app.json iOS**: `buildNumber` + `infoPlist.ITSAppUsesNonExemptEncryption:false` (yalnız standart TLS → her TestFlight yüklemesindeki export-compliance sorusunu atlar). `eas.json` submit.ios placeholder'ları (ascAppId/appleTeamId) silindi → auto-create. Auth yöntemi: **interaktif Apple login** (2FA), APP_MANAGER rollü ASC API key.
- **İlk iOS build FINISHED** (.ipa) ama **submit REDDEDİLDİ → app icon**: tüm asset'ler **1×1 placeholder + alpha kanallı** (proje kurulumundan kalma; Android hoş görüyordu, iOS App Store alpha'lı/eksik ikonu reddediyor). Ayrıca build 2 "kullanıldı" hatası.
- **GERÇEK APP ICON tasarlandı** (`c0fcf6f`): "birlikte ders çalışan iki figür" — cyan + pembe iki dost (oturan/eğik poz, versiyon B), paylaşılan açık kitap, aydınlanma ışıltısı, koyu gradyan + cyan hale (uygulama teması). Vektör SVG → `sharp` ile raster (scratchpad'de kuruldu). **`icon.png` 1024×1024 OPAK (alpha yok)** = App Store uyumlu; ayrıca `adaptive-icon.png` (Android), `splash.png` (şeffaf ön-plan), `notification-icon.png` (beyaz silüet). Onay artif:  https://claude.ai/code/artifact/714f6bf3-0683-497c-a4e5-cd1337d0ec09
- `ios.buildNumber` 2→**3** (autoIncrement zaten açık; build 2 reddedilen submit'te kullanıldığı için unique olmalı).
- **App Store Connect'te uygulama OLUŞTURULDU**: "StudySquad" / `com.studysquadhq.app`, TestFlight grubu + `alperentorun334@icloud.com` test erişimi. App Store'da "StudySquad" ismi müsaitti (kullanıcı baktı).
- ✅ **Yeni ikonlu build (buildNumber 4) BAŞARILI → TestFlight'a yüklendi → iPhone'a kuruldu**. Gerçek cihazda **giriş DOĞRULANDI** (testalpha1 ile; ilk denemede yanlış şifre → sonra çalıştı). Backend bağlantısı sorunsuz. İkon reddi ÇÖZÜLDÜ. StudySquad artık gerçek iPhone'da TestFlight üzerinden çalışıyor. 🎉
- **Test hesapları** (backend/Supabase'de kayıtlı; TestFlight aynı backend'e bağlı): `testalpha1@studysquad.test` + `testbeta2@studysquad.test` (+ `testgamma3`), şifre `Passw0rd123`. Alpha & Beta arkadaş.

### Faz 18 — Haftalık Challenge + Ünvanlar + Çoklu Konu (9 Temmuz)
Migration 014 (weekly_goal_claims) + 015 (users.selected_title) ✓ · backend+mobil tsc temiz

- **Boss Battle KALDIRILDI → Haftalık Challenge** (kullanıcı "kişisel/arkadaş challenge" seçti). Global 100.000 dk hedefi yerine: (1) **kişisel haftalık hedef** = aktif konuların günlük hedef toplamı × 7; hedefe ulaşınca **300 🪙 ödül** (`weekly_goal_claims` tablosu PK=(user_id, week_start) → haftada 1, çift-claim guard'ı; `add_coins` RPC). (2) **Arkadaş sıralaması** — sen + kabul edilmiş arkadaşlar bu haftaki dakikaya göre sıralı (madalyalar, sen-vurgusu). Backend: `getWeeklyChallenge` + `claimWeeklyReward` (`timer.service.ts`), `GET /timer/challenge` + `POST /timer/challenge/claim` (eski `GET /timer/boss` silindi). Home'daki `<WeeklyChallengeCard>` yeni kart: kişisel progress bar + "Ödülü Al" butonu + arkadaş mini-sıralaması.
- **Ünvan (title) sistemi** (yeni — önceden sadece rozet vardı). Rozete bağlı 9 seçilebilir ünvan (`novice`→null default, `focused`→first_session, `roller`→streak_3, `week_warrior`→streak_7, `iron_will`→streak_30, `centurion`→hours_100, `elite`→level_10, `social`→social_butterfly, `pro`→pro_member). Katalog `achievements.schema.ts` (`TITLE_META`). `GET /achievements` artık `titles[]` + `selectedTitle` döner; `PUT /achievements/title` seçili ünvanı yazar (kilitliyse 409). Kolon `users.selected_title` (migration 015). Profil'de: seçili ünvan kullanıcı adının altında, ayrıca "Ünvanlar" bölümünde chip'lerle seçim (kilitliler 🔒).
- **Çoklu konu**: (1) ücretsiz konu limiti **3 → 8** (`FREE_SUBJECT_LIMIT`). (2) **Onboarding'de çoklu konu** — step 1'e "＋ Başka konu ekle" (chip listesi + kaldır), plan adımı hepsini gösterir; seçilen günlük hedef konulara bölünür (backend goal'leri topladığı için toplam = seçilen hedef); finish max 8'e slice'lar.
- i18n: 10 dilde `challenge.*` (9 anahtar, `boss.*` yerine), `titles.*` (9), `profile.titles/titlesHint`, `onboarding.addAnotherSubject`.
- **Doğrulama**: backend+mobil `tsc --noEmit` temiz; migration 014+015 pooler ile uygulandı + doğrulandı. **Backend Fly'a HENÜZ DEPLOY EDİLMEDİ + cihazda test EDİLMEDİ** — `/timer/boss` kaldırıldığı için deploy YENİ mobil build ile eşzamanlı olmalı (eski TestFlight build'i eski endpoint'i çağırır).

### Faz 19 — Timer fix + UI polish + keep-awake (kritik) (9 Temmuz)
Sadece mobil (backend değişmedi) · tsc temiz

- **🔴 KRİTİK FIX — keep-awake**: Aktif seansta ekran artık uyanık tutuluyor (`expo-keep-awake`, YENİ native modül → build cache'siz). Neden kritik: telefon **auto-lock** olunca (ya da kullanıcı ekranı kilitleyince) `AppState 'background'` fırlar; bunu (a) **Sıkı Mod** "uygulamadan çıktı" sanıp seansı **yakıyordu**, (b) **Focus Score** exit+awayMs sayıp *presence/steadiness*'i çökertiyordu. Yani telefonu bırakıp çalışan (ideal) öğrenci cezalanıyordu. Root hook `useKeepAwakeDuringSession` (MainTabs'te mount; aktif&duraklamamışsa uyanık, duraklama/durdurma bırakır). **Not:** manuel kilit hâlâ background'tır — managed RN'de kilit vs uygulama-değişimi ayırt edilemiyor; auto-lock (asıl sessiz hata) çözüldü. Gerçek "ekran kapalı + sayaç görünür" çözümü = Live Activity (sonraki iş).
- **Timer ekranı orphan-pomodoro fix**: Diskte takılı `mode:pomodoro`+`phase:focus` ama aktif olmayan timer, TimerScreen'de hiçbir bölümü render etmeyip **sadece boş 00:00 çemberi** bırakıyordu (yeni build/expired session sonrası). Sunucu sync'ine 2.5 sn şans verip hâlâ oturum yoksa `abortCycle()` → idle. Kullanıcının "sadece 00:00 çerçevesi" şikayeti buydu.
- **Timer çember polish** (`TimerCircle`): idle artık `00:00` yerine seçilen süreyi önizliyor (`25:00`), ölü gri yerine marka accent'i, "şarjlı" halka + yumuşak statik idle glow. Gereksiz süre rozeti kaldırıldı.
- **Profil sıralaması**: Çerçeve + Pet mağazası artık **Konularım ile Rozetler arasında** (eskiden Pro kartının altındaydı) — kullanıcı isteği.
- **Ana sayfa — haftalık konu donut'u** (`WeeklySubjectDonutCard`): "Bu Hafta" bar grafiğinin altında ‹ hafta › gezginli, o haftanın konu bazlı odak dağılımı (donut + ortada toplam + lejant). **Backend değişikliği YOK** — zaten canlı `getMonthly` endpoint'inden seçilen haftanın 7 günü (gerekirse 2 ay) toplanıyor, React Query ay bazında cache'liyor. i18n 5 anahtar × 10 dil.
- **⚠️ Bulunan açık bug (henüz düzeltilmedi)**: Gün sınırı UTC — streak/günlük hedef Türkiye'de saat 03:00'te resetleniyor; gece çalışması yanlış güne düşüyor. Kullanıcı bazlı timezone offset gerek.
- **SONRAKİ İŞ (kullanıcı seçti)**: 🔒 **Live Activity / kilit ekranı sayacı** — native iOS ActivityKit + SwiftUI Widget Extension (Expo config plugin, ör. `@bacons/apple-targets`) + JS köprü; iOS 16.1+. Ayrı native build + cihaz doğrulaması gerektirir (mevcut TestFlight pipeline'ını riske atmamak için kendi başına yapılacak). Android'de karşılığı ongoing chronometer notification.

### Faz 20 — Yerel gün/hafta sınırları (UTC bug fix) (9 Temmuz)
Migration 016 ✓ · backend+mobil tsc temiz · Fly deploy ✓ · commit `061e1f6`

- **Sorun**: streak + günlük hedef + haftalık pencereler UTC'ye göreydi → TR (UTC+3) kullanıcısında gün **03:00'te** resetleniyor, gece 01:00 seansı yanlış güne düşüyordu.
- **Çözüm**: kullanıcı bazlı `utc_offset_minutes` (migration 016, default 0). Client açılışta `-getTimezoneOffset()` ile offset raporlar (`PUT /timer/timezone`). Backend yardımcıları `localDayStart`/`localWeekStart`/`localDateKey`; şu fonksiyonlar artık yerel pencere kullanıyor: `getStats` (bugün+hafta+dailyBreakdown), `awardXpAndStreak` (**streak** — en kritik), `getActivityHeatmap`, `getGhost`, `getWeeklyChallenge`, `getMonthlyStats` (yerel ay/gün + cache key'e offset eklendi). `WeeklySubjectDonutCard` yerel tarih anahtarlarına geçti (aylık yerel gruplama ile tutarlı).
- **Geri uyumlu**: offset varsayılan 0 = eski UTC davranışı → eski/in-flight build'ler bozulmaz; sadece yeni build offset raporlayınca yerel davranış aktifleşir. Not: sabit offset (IANA değil), DST'de bir sonraki açılışta düzelir; TR zaten sabit UTC+3.
- **Doğrulama**: migration pooler ile uygulandı + kolon doğrulandı; Fly deploy sonrası `/health` 200, `PUT /timer/timezone` 401 (route canlı). **Cihazda test bekliyor** (yeni build ile).

### Faz 21 — 🔒 iOS Live Activity (kilit ekranı sayacı) (10 Temmuz)
Sadece mobil · iOS-only · tsc temiz · **CİHAZDA TEST EDİLMEDİ (iOS build gerekli)**

- **Kütüphane seçimi**: `expo-widgets` (Expo resmi) **SDK 57** gerektiriyor (biz SDK 54) + yerleşik native timer yok → elendi. **`expo-live-activity` (Software Mansion) v0.4.2** seçildi: arşivlenmiş (1 Haz 2026) ama SDK 54'te çalışıyor ve **kilit ekranında kendi kendine sayan native countdown**'ı var (`progressBar: { date }`). Config plugin native widget target'ı build sırasında üretiyor — el yazımı Swift YOK.
- **Kod**: `services/liveActivity.ts` (start/running/paused/end sarmalayıcı, `Platform.OS==='ios'` guard'lı — Android'de no-op; native modül `requireOptionalNativeModule` → Android'de null, Android build etkilenmez). `hooks/useFocusLiveActivity.ts` timerStore'u izliyor: seans başında başlat (endDate = now+remainingMs), duraklat → dondurulmuş progress bar, devam → yeni countdown, durunca bitir. MainTabs'te mount (keep-awake yanında).
- **Config**: app.json `NSSupportsLiveActivities:true`, `scheme:"studysquad"` (deep-link `studysquad://timer`), `plugins:["expo-live-activity"]`, iOS `buildNumber 4→5`. i18n `liveActivity.*` (4 anahtar × 10 dil).
- **Gerçekler/limitler**: iOS 16.2+; Windows'ta test edilemez → **cihazda kullanıcı test eder, 1-2 tur iterasyon beklenir**. Bilinen minör: app mid-session öldürülürse yetim activity kalır (end date'te iOS otomatik kapatır); relaunch'ta ikinci başlayabilir. Görsel/App Groups yok (sade başlık+altbaşlık+timer).
- **SONRAKİ ADIM**: iOS **production** build + TestFlight submit (autoIncrement buildNumber'ı yönetir) → iPhone'da kilit ekranı/Dynamic Island countdown'u test et. Komut: `cd mobile && npx eas-cli build --platform ios --profile production --non-interactive --auto-submit`.

### Faz 22 — Sıkı Mod kaldırıldı (kilitleme cezası şikayeti) (10 Temmuz)
Sadece mobil · tsc temiz

- **Neden**: Kullanıcı cihazda pomodoro başlatıp telefonu **elle kilitledi** → "seansın tehlikede" bildirimi geldi (başka uygulamaya geçmemişti). keep-awake auto-lock'u önlüyor ama manuel kilit yine `background` fırlatıyor; managed RN'de **ekran kilidi ≠ uygulama değişimi** ayırt edilemiyor. Kullanıcı ceza mantığını beğenmedi.
- **Yapılan**: **Sıkı Mod tamamen kaldırıldı** — toggle (settingsStore.strictMode + TimerScreen Switch UI + hint), `useStrictMode` hook'u, `StrictModeFailModal`, rescue/forfeit akışı silindi. Artık hiçbir arka plan olayı (kilit dahil) seansı yakmıyor/uyarmıyor. Backend `/timer/rescue` endpoint'i + `timer.strict*` i18n anahtarları kullanılmıyor ama duruyor (zararsız, deploy gerekmez).
- **AÇIK/İSTENEN (native gerekli)**: Kullanıcı "sadece **başka uygulamaya geçince** uyarı olsun, kilitlemede olmasın, toggle'sız uygulama kendi yapsın" istiyor. Bu ayrım native ekran-kilidi algılama gerektiriyor (iOS `protectedDataWillBecomeUnavailable`, Android `ACTION_SCREEN_OFF`); hazır Expo-uyumlu kütüphane yok (`react-native-lock-detection` npm'de değil). → Ayrı native iş olarak, fail-safe (belirsiz=iyi huylu, asla yanlış yakma) tasarımla, cihazda test edilerek yapılacak. Kullanıcı onayı bekliyor.
- Not: Focus Score'un *presence* bileşeni hâlâ arka planı sayıyor (yıkıcı değil, sadece kalite metriği); keep-awake auto-lock'u azaltıyor.

### Faz 23 — Native ekran-kilidi algılama + "geri dön" hatırlatması (10 Temmuz)
Sadece mobil · tsc temiz · **CİHAZDA TEST EDİLMEDİ** (v1, empirik)

- **Amaç** (Faz 22'nin devamı): kilitleme hiçbir şey yapmasın, **sadece başka uygulamaya geçince** nazik hatırlatma. Bu ayrım native gerektiriyor.
- **Yeni LOCAL Expo modülü** `mobile/modules/screen-lock` (Name `ScreenLock`) — el yazımı, expo-keep-awake şablonuyla, SDK 54. **Autolinking her iki platformda da doğrulandı** (`expo-modules-autolinking resolve` iOS podName `ScreenLock` + Android `expo.modules.screenlock.ScreenLockModule`). API: `reset()` + `consumeLocked()` (bir absence sırasında kilit oldu mu, read-and-clear).
  - **iOS** (Swift): public `protectedDataWillBecomeUnavailableNotification` gözlemcisi → bayrak. **Best-effort** — public API'de prompt/güvenilir kilit sinyali yok, JS askısı + gecikme nedeniyle bazı kilitleri kaçırabilir. Darwin/private trick KULLANILMADI (mağaza güvenliği + derleme riski). 
  - **Android** (Kotlin): `ACTION_SCREEN_OFF` receiver (dinamik kayıt, API 34+ RECEIVER_NOT_EXPORTED) → bayrak. **Güvenilir** (ekran-durumu net).
- **JS**: `services/screenLock.ts` (fail-safe: modül yok/hata → "kilitli" say → asla hatırlatma). `hooks/useAwayReminder.ts` MainTabs'te mount: arka plana geçince `leftAt`+`reset()`; **dönünce** 15sn+ uzaktaysan **ve** `consumeLocked()` false ise (kilit olmadıysa) → nazik **uygulama-içi Alert** (`focusReminder.*`, 10 dil). iOS JS askısı yüzünden "yokken bildirim" yerine **dönüşte** karar veriliyor (güvenilir). Yıkıcı değil.
- **Bilinen/empirik**: iOS best-effort — cihazda kilitleyip test et: hatırlatma çıkarsa (yanlış pozitif) v2'de Darwin sinyali eklenebilir; hiç çıkmıyorsa uygulama-değişiminde çıkıyor mu bak. Android'de güvenilir olmalı.
- **SONRAKİ ADIM**: iOS build (buildNumber 6) + Android build → cihazda test: (1) kilitle → hatırlatma YOK olmalı, (2) başka uygulamaya 15sn+ geç, dön → nazik hatırlatma çıkmalı.

### Faz 24 — Pomodoro auto-start toggle'ları + titreşim/bildirim + profil sırası (11 Temmuz)
Sadece mobil · tsc temiz · commit `c2131f0`

- **Pomodoro auto-start, ikisi de ayarlanabilir** (kullanıcı istedi): Timer setup ekranında pomodoro seçiliyken 2 Switch — **"Molaları otomatik başlat"** (varsayılan AÇIK = eski davranış) + **"Çalışmayı otomatik başlat"** (varsayılan KAPALI = eski davranış). `settingsStore`'da persist (`pomodoroAutoBreak`/`pomodoroAutoFocus`). Dört kombinasyon da çalışır; ikisi açıkken tam otomatik 4 tur.
- **Yeni `awaitBreak` fazı** (`pomodoroStore`): auto-break kapalıysa odak turu bitince "☕ Mola başlat" ekranı; `startBreak()` molayı elle başlatır. `completeRound(r, autoStartBreak)` imzası değişti. Auto-focus: mola bitince `awaitNext`'te effect sonraki turu tek-sefer başlatır (`isLoading` guard'ı çift seansı önler).
- **Geçişlerde titreşim + bildirim** (kullanıcı istedi): odak turu bitince 📳 `Vibration.vibrate` + YENİ anlık bildirim ("Tur bitti! ☕ {{min}} dk mola" / son turda "Döngü tamamlandı 🎉") — `notifyNow()` (notifications.ts, push opt-out'tan bağımsız yerel bildirim). Mola bitince 📳 foreground titreşim eklendi (zamanlanmış "mola bitti" bildirimi zaten vardı; Android `default` kanalı `vibrationPattern` taşıdığı için arka planda da titrer). `VIBRATE` izni app.json'da zaten vardı.
- **Profil sırası düzeltildi** (kullanıcı istedi; Faz 19'daki taşımanın revizyonu): … Konularım → Çerçeve/Pet Mağazası → **Odalarım → Ünvanlar → Rozetler** (rozetler en sona) → Ayarlar.
- i18n: 10 dile 9 yeni `timer.*` anahtarı (autoStartBreaks/Focus+hint'ler, startBreak, roundDoneTitle, roundOverTitle/Body, cycleDoneBody).

### Faz 25 — Pomodoro bildirim/auto-start düzeltmeleri (cihaz geri bildirimi) (11 Temmuz)
Sadece mobil · tsc temiz · commit `e492456`

- **Kullanıcı taze build'i test etti, 2 sorun bildirdi** (ikisi de doğrulandı, kök neden aynı: telefon kilitliyken JS askıda):
  1. "Tur bitti" bildirimi kilitliyken gelmiyordu — `notifyNow` tık anında atılıyordu, tick çalışmayınca hiç ateşlenmiyordu. **Fix**: tur-sonu bildirimi artık **tur başlarken zamanlanıyor** (mola bildirimi gibi; `roundNotifId` pomodoroStore'da persist → relaunch'ta duplicate yok). Pause iptal eder, resume kalan süreyle yeniden kurar; elle stop / döngüden çıkış / yetim döngü / server-side kaybolma iptal eder. Son turda metin "döngü tamamlandı". `scheduleBreakOverNotification` → genel `scheduleLocalNotification` olarak yeniden adlandırıldı.
  2. Auto-focus mola bitiminde turu başlatmıyordu + bildirime dokununca "network error" flash'ı. **Gerçek**: arka planda tur başlatmak OS kısıtı gereği imkânsız (backend seansı = ağ çağrısı); bildirime dokununca ön plana gelişte ilk istek radyo uyanmadan düşüyordu. **Fix**: auto-start artık **3 denemeye kadar 2 sn arayla sessiz retry** (busy-ref guard'lı, her denemede phase/autoFocus/isActive yeniden kontrol; 409 → syncWithServer), Alert sadece son hatada. Ayrıca `breakOverBody` 10 dilde eyleme çağıran metne çevrildi ("Dokun, X. tura başla") — dokunuş turu fiilen başlatıyor.
- **Bilinen sınır (mimari)**: uygulama mola bittiğinde arka plandaysa sonraki tur ancak kullanıcı uygulamayı açınca başlar — bildirim tap'i bunu tetikliyor, tasarım gereği böyle kalacak.
- **Ek düzeltme (`dc1a41a`)**: kullanıcı bildirdi — eski "tur bitti / mola bitti" bildirimi, yeni oturum başlatınca bile telefonun bildirim tepsisinde kalıyordu (kod sadece *zamanlanmış* bildirimi iptal ediyordu, *gösterilmiş* olanı kaldırmıyordu). **Fix**: pomodoro yerel bildirimleri `data.pomodoro=true` ile etiketlendi + yeni `dismissPomodoroNotifications()` (getPresentedNotifications → sadece etiketlileri dismiss; arkadaş/streak push'ları tepside kalır). Çağrı noktaları: oturum başlat (klasik+pomodoro), sonraki tur (manuel+auto-start), mola başlat, mola atla. Not: bu build'den ÖNCE tepsiye düşmüş (etiketsiz) bildirimler bir kereliğine temizlenmez — elle kaydırılır.

### 📝 Oturum Özeti — 2026-07-11 (Faz 24 + TAZE BUILD'LER) ⭐ EN GÜNCEL

- **Faz 24 yapıldı** (yukarıda): pomodoro auto-start toggle'ları + tur/mola geçişlerinde titreşim+bildirim + profil bölüm sırası. Commit `c2131f0`, main'e push'landı.
- **🚀 TAZE BUILD'LER ATILDI** (Faz 19–24'ün TAMAMINI içeren ilk build'ler; native modüller yüzünden cache'siz):
  - **Android preview APK**: build `592d10f0` — https://expo.dev/accounts/software66/projects/focusarena/builds/592d10f0-e2be-4778-bf8c-e6b30d7e7996
  - **iOS production**: build `50f40c6d` (buildNumber 6→**7** otomatik) — https://expo.dev/accounts/software66/projects/focusarena/builds/50f40c6d-f574-4457-bae4-762f2cb85cae — credentials `com.studysquadhq.app.LiveActivity` target'ını içeriyor ✓ (expo-live-activity plugin widget'ı üretmiş).
  - ✅ **iOS TestFlight'a GÖNDERİLDİ** (11 Tem 04:49, EAS workflow "Submit app to TestFlight" otomatik halletti — dünkü "zincirlenemedi" endişesi yersizmiş). Gün içindeki elle `submit --latest` denemesi "buildNumber 7 zaten kullanıldı" hatası verdi = zararsız duplicate. **`ascAppId: 6788842347` eas.json'a yazıldı** → artık non-interactive submit çalışır. Not: submission durumu expo.dev/…/submissions sayfasından okunabilir (eas-cli 20'de submit:list yok).
- **Cihazda test bekleyen her şey bu build'lerde**: keep-awake, timer idle çember + orphan fix, haftalık donut, UTC gün sınırı, Live Activity (iOS), screen-lock hatırlatması, pomodoro auto-start+titreşim, profil sırası, artı Faz 14/15/16/18 UI'ları (aylık takvim, pomodoro, Focus Score, Challenge/ünvanlar/çoklu konu).
- **Gün içi devam**: kullanıcı build'i test etti → pomodoro geri bildirimleri geldi → **Faz 25 düzeltmeleri yapıldı** (`e492456`, yukarıda).
- **🚀 FAZ 25'Lİ YENİ BUILD'LER ATILDI ve BİTTİ** (JS-only değişiklik, hızlı bitti):
  - **iOS production `b7ecffa9`** (buildNumber **8**) — FINISHED ✓, **auto-submit bu kez zincirlendi** (eas.json'a yazılan `ascAppId: 6788842347` sayesinde; submission `7be25e84` build bitince otomatik koştu). https://expo.dev/accounts/software66/projects/focusarena/builds/b7ecffa9-1f2c-4783-9ded-5bd27eb758ac
  - **Android preview APK `85229865`** — FINISHED ✓. https://expo.dev/accounts/software66/projects/focusarena/builds/85229865-b19d-421a-8958-41ad66db399c
  - Not: dünkü build 7 (`50f40c6d`) zaten 11 Tem 04:49'da TestFlight'a başarıyla gitmişti; gün içindeki elle submit "buildNumber 7 zaten kullanıldı" hatası zararsız duplicate'ti.
- **SIRADAKİ TEST (build 8 / yeni APK ile, pomodoro)**: (1) tur çalışırken telefonu kilitle → tur-sonu bildirimi kilit ekranına titreşimle düşmeli; (2) molada bekle → "Dokun, X. tura başla" bildirimine dokun → network error GÖRMEDEN sonraki tur başlamalı; (3) ekran açıkken auto-start açıksa mola bitince tur kendiliğinden başlamalı. Artı önceki listedeki tüm Faz 19–24 testleri geçerli.
- **Gün içi devam 2**: kullanıcı bildirdi — eski bildirim yeni oturumda tepside kalıyor → **tepsi-temizleme fix'i yapıldı** (`dc1a41a`, Faz 25 "Ek düzeltme" maddesi). JS-only; build 8'de YOK, bir sonraki build'e girecek. ⚠️ Yeni build atılırken hatırla.
- **Gün içi devam 4 — BUILD 9 + kalıntı eas.json temizliği**: Kullanıcı "autoIncrement çalışmıyor" sandı — sebep repo kökündeki KULLANILMAYAN `eas.json` (remote appVersionSource yazıyordu; gerçek config `mobile/eas.json` = local + autoIncrement). Kök dosya silindi (`f576007`). Mekanizma açıklandı: numara production build BAŞLATILINCA artar (6→7→8 hep böyle olmuştu). **Yeni build'ler atıldı** (tepsi fix `dc1a41a` + pet vitrini `225cb7e` dahil): **iOS production `bd47dcd9` (buildNumber 9, auto-submit zincirlendi, submission `1c759dd5`)** + **Android preview APK `d4a8bac6`**. app.json bump commit: `0b34033`. Bitince: TestFlight build 9 + APK cihaz testleri (pomodoro senaryoları + pet mağazası vitrini + tepsi temizliği).
- **Gün içi devam 3 — Pet mağazası vitrin yenilemesi** (`225cb7e`, kullanıcı "basit/statik duruyor" dedi): nadirlik katmanı (yaygın→mitik, renkli kart çerçeveleri + etiket), **PetDetailModal** (karta dokun → büyük animasyonlu sahne + kişilik metni + evrim yolculuğu 🥚→yavru→yetişkin + ilerleme), satın almada Alert yerine modal CTA + **yumurta kutlama ekranı** (titreşim + "1 saat odaklan çatlasın"), kartlarda evrim aşaması rozeti, analytics (`pet_detail_viewed`/`pet_adopted`), 10 dilde 16 yeni i18n anahtarı. `tsc` temiz. JS-only; **build 8'de YOK** — tepsi fix'iyle birlikte bir sonraki build'e girecek; cihazda test edilecek.

### 📝 Oturum Özeti — 2026-07-10 (Faz 19–23: UX geri bildirim turu)

Kullanıcı cihazda test edip geri bildirim verdi; sırayla Faz 19–23 yapıldı. **Hepsi main'de** (HEAD `c65ca89`).

**Yapılanlar:**
- **Faz 19** — Timer fix (yetim pomodoro → boş 00:00 çemberi) + idle çember polish (25:00 önizleme) + **keep-awake** (auto-lock artık seansı yakmıyor) + Ana sayfa **haftalık konu donut'u** (hafta seçmeli) + Profil mağaza sırası (çerçeve+pet → Konularım↔Rozetler arası).
- **Faz 20** — **UTC gün sınırı fix** (migration 016 ✓ uygulandı + **Fly deploy ✓**). Streak/hedef/hafta artık kullanıcı yerel saatine göre; client `PUT /timer/timezone` ile offset raporluyor.
- **Faz 21** — **iOS Live Activity** (kilit ekranı countdown, `expo-live-activity`).
- **Faz 22** — **Sıkı Mod tamamen kaldırıldı** (kilitleme cezası şikayeti üzerine).
- **Faz 23** — **Native `screen-lock` modülü** (yeni local Expo modülü, autolinking ✓) + "başka uygulamaya geçince nazik hatırlatma, kilitte hiçbir şey" (dönüşte karar, yıkıcı değil, fail-safe).

**🚨 BUILD/DEPLOY DURUMU (sonraki oturumun kritik başlangıç noktası):**
- **Backend**: Faz 20 UTC fix Fly'a **deploy edildi ✓** (`/health` 200, `/timer/timezone` 401). Migration 016 uygulandı. Backend güncel, ekstra deploy gerekmez.
- **Android build `107f4c1a`** (bu oturumun başında atıldı): SADECE Faz 19 timer-fix/donut/keep-awake + Faz 20 client içeriyordu. **BAYAT** — Faz 21/22/23 (Live Activity, Sıkı Mod kaldırma, screen-lock) o build'den SONRA commit'lendi. Yani **hiçbir mevcut build en güncel kodu içermiyor.**
- **iOS**: Live Activity + screen-lock native modülleri içeren **HİÇ build alınmadı**. `app.json` iOS `buildNumber = 6`.
- **SONUÇ**: Sonraki oturumda **TAZE iOS + Android build** gerekli (hepsini içeren). Native modüller (expo-live-activity, screen-lock, react-native-svg, expo-keep-awake) → build cache'siz/uzun.

**Cihazda test bekleyen HER ŞEY (tek build'de):** keep-awake, timer idle çember + orphan fix, haftalık donut, profil sırası, UTC gün sınırı, **Live Activity** (iOS, buildNumber 6), **screen-lock hatırlatması** (kilitle→yok / app-switch→var), artı hâlâ bekleyen Faz 14/15/16/18 (aylık takvim, pomodoro, Focus Score, Challenge/ünvanlar/çoklu konu).

**Açık/empirik notlar:**
- **Live Activity**: iOS build gerekli; kaprisli olabilir, 1-2 tur iterasyon beklenir.
- **screen-lock iOS**: best-effort (public `protectedData`, Darwin/private yok). Test: kilitte yanlış hatırlatma çıkarsa v2'de Darwin sinyali; app-switch'te hiç çıkmıyorsa bak. Android güvenilir olmalı.
- **UTC gün sınırı**: sabit offset (IANA değil); DST'de bir sonraki açılışta düzelir; TR zaten sabit +3.
- Kullanılmayan ama duran: backend `/timer/rescue`, `timer.strict*` i18n (zararsız).

---

### 📝 Oturum Özeti — 2026-07-09 (Faz 18: Challenge + Ünvanlar + Çoklu Konu)

Kullanıcı 3 karar verdi, hepsi uygulandı — commit `7717003`, main'de:
1. **Boss Battle → Haftalık Challenge** (kişisel hedef + 300🪙 ödül + arkadaş sıralaması). Global hedef kaldırıldı.
2. **Ünvan sistemi kuruldu** (yoktu — kullanıcı doğru hatırlamış): rozete bağlı 9 seçilebilir ünvan, profilde gösterim + seçim.
3. **Çoklu konu**: ücretsiz limit 3→8 + onboarding'de birden fazla konu ekleme.

- **Doğrulama**: backend+mobil `tsc` temiz; migration 014+015 pooler ile canlı DB'ye uygulandı + doğrulandı (`weekly_goal_claims` tablosu + `users.selected_title` kolonu).
- **YAPILMADI (bilinçli)**: Fly deploy + cihaz testi. `/timer/boss` silindiği için deploy YENİ mobil build ile eşzamanlı olmalı. Kullanıcı deploy/build kararını sonraya bıraktı.
- **SONRAKİ OTURUMUN İLK İŞİ**: Backend'i Fly'a deploy et (`--depot=false`) + yeni preview build başlat → cihazda Faz 18'i (challenge kartı + ödül claim + ünvan seçimi + onboarding çoklu konu) test et. Ayrıca bekleyen Faz 14/15/16 cihaz testleri de bu build'e dahil.

### 📝 Oturum Özeti — 2026-07-08/09 (Focus Score + iOS/TestFlight + App Icon)

Yoğun oturum, 3 büyük iş bitti — hepsi main'de:
1. **Focus Score V1** (Faz 16) — backend+mobil, migration 013 ✓, Fly deploy ✓, tsc temiz. Cihaz UI testi bekliyor.
2. **iOS/TestFlight kurulumu** (Faz 17) — Apple hesap kilidi açıldı, bundle ID çakışması çözüldü (`com.studysquadhq.app`), ASC uygulaması + TestFlight oluşturuldu, build başarılı, iPhone'a kuruldu, **giriş cihazda doğrulandı**.
3. **Gerçek App Icon** — placeholder 1×1/alpha'lı ikonlar (iOS'un reddetme sebebi) → "birlikte ders çalışan iki figür" (cyan+pembe, kitap, ışıltı). SVG→sharp, icon.png opak.

- **Öğrenilen tuzaklar**: iOS bundle ID globalde benzersiz olmalı (Android paket adı değil); App Store ikonu OPAK (alpha yok) + 1024×1024 şart; Apple yeni hesaplar ilk 3.parti girişte `-20209` kilitleyebiliyor (iforgot ile açılır); `EXPO_PUBLIC_API_URL` production env'de baked (giriş cihazda çalışıyor = doğru).
- **SONRAKİ OTURUM (kullanıcı test edip dönecek)**: gerçek cihaz test geri bildirimleri — özellikle **push teslimatı** (arkadaş çalışıyor/referral/streak; iOS APNs otomatik olduğu için Android FCM'siz çalışabilir), **Focus Score** fiş+profil UI, **aylık takvim + donut + pomodoro** (Faz 14/15 ilk kez cihazda), **Sıkı Mod** yanma akışı. Kullanıcı bulguları bildirecek → düzeltmeler yapılacak.

### 📝 Oturum Özeti — 2026-07-06 (öğleden sonra: EMÜLATÖR TEST OTURUMU)

Sabahki yarım kalan doğrulama tamamlandı + Faz 11–13 testleri yapıldı (build `13448391` APK'sı, Pixel_8):

**✅ Doğrulanan (uçtan uca, 2 test hesabı: testalpha1 + testbeta2):**
- **Emülatör interneti**: cold boot + `-dns-server` ile ağ VALIDATED (not: `adb shell ping` emülatörde HER ZAMAN %100 loss verir — ICMP forward edilmiyor, yanlış alarm; doğru test `dumpsys connectivity | grep VALIDATED`).
- **RC init temiz**: gerçek `goog_` anahtar kabul ✓, ConfigurationError diyaloğu YOK; sadece beklenen "offerings'te ürün yok, yoksayabilirsin" log'u + emülatörde BILLING_UNAVAILABLE (normal). Onboarding sonrası paywall boş paketlerle zarifçe atlanıyor.
- **Backend bağlantısı**: kayıt/login/timer/boss battle canlı veriyle çalışıyor.
- **Referans sistemi**: kod kullanma → "+500 coin & arkadaşsınız" ✓, iki tarafta da coin 500 ✓ (DB'den doğrulandı), oto-arkadaşlık iki yönde listede ✓, boş ekran davet kartı + Redeem UI tasarlandığı gibi.
- **Sıkı Mod**: arka planda 30 sn aşımı → dönüşte "Session burned!" modalı ✓ → **200 coin kurtarma** ✓ (coin 500→300, seans kaldığı yerden devam ✓, tamamlanınca normal ödül: beta 300+50=350 DB'de doğru) → ikinci testte **"Let it burn"** yolu ✓ ("Session lost, no rewards"). Duraklatma/uygulama içi gezinme yanmıyor ✓.
- **Arkadaş başına 🔔 mute toggle**: optimistic 🔔↔🔕 çalışıyor ✓.
- **Rozet sistemi**: First Focus rozeti seans sonrası göründü ✓.

**❌ Emülatörde TEST EDİLEMEYEN — gerçek cihaz gerekiyor:**
- **Push teslimatı** (arkadaş çalışıyor / referral / streak): `notifications.ts` `Device.isDevice` guard'ı emülatörde token kaydını bilerek atlıyor → `expo_push_token` hep NULL. Gerçek cihazda test edilmeli.
- **Sıkı Mod 15 sn uyarı bildirimi**: `channelId 'default'` kanalı yalnızca `registerForPushNotifications` içinde oluşturuluyor; emülatörde o fonksiyon erken çıktığı için kanal yok → bildirim sessizce düşüyor. (Yanma mekaniği bildirimden bağımsız ÇALIŞIYOR.)

**🐛 Bulunan bug'lar:**
- ✅ DÜZELTİLDİ (`6264a8a`): referans başarı diyaloğu başlığı `+{{coins}} coins!` gösteriyordu — `FriendsScreen.tsx` t() çağrısına `coins` parametresi eksikti.
- ⚠️ AÇIK: Onboarding **Skip butonu hiç tepki vermiyor** (2 farklı adımda 3+ deneme; Continue akışı çalışıyor). Düşük öncelik ama huni analitiğini bozar.
- ⚠️ AÇIK (edge case): kullanıcı app-içi bildirim toggle'ını kapatırsa `registerForPushNotifications` kanal oluşturmadan dönüyor → Sıkı Mod yerel uyarısı gerçek cihazda da gösterilmez. Kanal oluşturma `Device.isDevice`/pushEnabled guard'larından ÖNCE yapılmalı.
- ⚠️ NOT: `notifyFriendsStudying` pair-anahtarını token kontrolünden ÖNCE SET NX'liyor → alıcının token'ı yoksa o günkü hak boşa yanıyor (bilinçli tasarım olabilir; gerçek cihaz testinden önce hatırla — bugünkü test için Upstash'tan `push:fs*` anahtarları elle silindi).
- ⚠️ Push token'ının **FCM (Firebase) kurulumu** olmadan Android'de alınamayabileceği doğrulanmadı — mağaza öncesi gerçek cihazda push testi ŞART; gerekirse Firebase projesi + EAS'a FCM anahtarı eklenecek.

**Ortam notları:** `adb shell input text` kullanırken Gboard "stylus" eğitim ekranı araya girebiliyor (Cancel'la kapat); PowerShell `>` ile binary bozuluyor → screencap için Bash kullan; emülatörde `pm grant com.studysquad.app android.permission.POST_NOTIFICATIONS` ile bildirim izni verilebiliyor (uygulama içinde runtime prompt akışı hiç görülmedi — gerçek cihazda kontrol et).

### 📝 Oturum Özeti — 2026-07-06 (sabah: RC anahtarı + yeni preview build)

Kısa oturum; "Sıradaki Adımlar" 1. maddesinin ilk yarısı yapıldı:

- ✅ EAS **preview** env'de `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` gerçek anahtarla (`goog_Zabv...`) değiştirildi (`eas env:update`), `env:list` ile doğrulandı (4 anahtar tam).
- ✅ **Yeni preview build FINISHED**: build ID `13448391-ebbb-4e97-9ca0-aaa3ffed084f`, APK: https://expo.dev/artifacts/eas/B6CCJsrnNDeT5rNQaQXewUJc2OxZaNsf4evf_ssu9p0.apk
- ✅ APK emülatöre (Pixel_8) kuruldu, uygulama açıldı; logcat'te **RC ConfigurationError diyaloğu YOK** (test anahtarı sorunu çözülmüş görünüyor).
- ⚠️ **AMA emülatörde internet yoktu** (ping %100 loss, PostHog network hatası) → RC/backend doğrulaması **sonuçsuz**. `-dns-server 8.8.8.8,1.1.1.1` ile yeniden başlatıldı → adb "offline"da takıldı, oturum burada kapatıldı.
- ❌ Faz 11–13 özellik testleri (referans, Sıkı Mod, arkadaş push'u) **yapılamadı** — sonraki oturuma kaldı.

**Sonraki oturumun ilk işi**: Emülatörü aç (gerekirse cold boot: `emulator -avd Pixel_8 -no-snapshot-load`), interneti doğrula (`adb shell ping 8.8.8.8`), uygulamayı aç → RC init + backend bağlantısını doğrula → Faz 11–13 testleri. APK zaten kurulu; değilse yukarıdaki URL'den indir + `adb install -r`.

### 📝 Oturum Özeti — 2026-07-05 (Faz 11+12+13)

Bu oturumda 3 büyük özellik bitirildi, hepsi main'de + Fly'da canlı, migration'lar DB'de:

| Commit | Özellik | Durum |
|--------|---------|-------|
| `2eac69e` | Referans sistemi (2×500 coin + oto-arkadaşlık) + boş ekran davet CTA'ları + streak shield | ✅ canlı, migration 010 ✓ |
| `b3b0349` | Sıkı Mod 🔒 (Forest mekaniği: 30 sn tolerans → seans yanar → 200 🪙 kurtarma) | ✅ canlı, migration 011 ✓ |
| `73e0cb5` | "🔥 Arkadaşın çalışıyor" push'u + arkadaş başına 🔔/🔕 mute | ✅ canlı, migration 012 ✓ |

- **Ürün kararları** (kullanıcıyla konuşuldu): Sıkı Mod ücretsiz (retention), af coin'le satılır, gerçek OS-engelleme ileride Pro amiral gemisi. Arkadaş push'u oda değil **arkadaş** bazlı; spam koruması: çift başına günde 1 + alıcıya günde 3 + odaktakine gönderme. Rekabet analizi yapıldı (Forest/YPT/Focusmate) — konumlandırma: "takımınla çalış".
- **Doğrulama**: her fazda backend+mobil `tsc` temiz; route'lar canlıda 401 testiyle doğrulandı (`/referrals/redeem`, `/timer/rescue`, `/friends/:id/mute`); `/health` 200.
- **Henüz test edilmedi (emülatör/cihaz gerekli)**: referans akışı uçtan uca, Sıkı Mod arka plan→bildirim→yanma→kurtarma akışı, arkadaş push'unun gerçek teslimatı. Hepsi **bir sonraki preview build'de** test edilmeli (RC anahtar değişikliğiyle aynı build).
- **Ortam notları**: Fly deploy'da depot builder TLS hatası → kalıcı çözüm `--depot=false`; PowerShell'de commit mesajında çift tırnak kullanma (native arg aktarımında bozuluyor, here-string bile kurtarmıyor).

---

## 🏗️ Altyapı Durumu

| Bileşen | Durum |
|---------|-------|
| Marka | **StudySquad** · Android paketi `com.studysquad.app` · **iOS bundle `com.studysquadhq.app`** (com.studysquad.app başka hesapta kayıtlı) · Play başlığı: "StudySquad: Study w/ Friends" |
| Backend | Fly.io — https://focusarena.fly.dev (/health 200, tüm cron'lar zamanlı; URL dahili, kullanıcı görmez) |
| DB | Supabase Sydney (ap-southeast-2); yerel bağlantı psql **pooler** ile (direkt host IPv6-only) |
| Migration'lar | 002–016 hepsi uygulandı ✓ (013 = focus_score, 014 = weekly_goal_claims, 015 = users.selected_title, 016 = users.utc_offset_minutes) |
| EAS | preview APK'lar başarılı ✓; preview env'de Sentry/PostHog/RC anahtarları; production env **boş** |
| Gözlemlenebilirlik | Sentry + PostHog **aktif** (preview build'lerde anahtarlar gömülü) |
| RevenueCat | Proje + `pro` entitlement + Monthly/Yearly offering ✓; Android anahtarı: `goog_ZabvZUZeqQlkyIWjFOGtRHKstqg` (public SDK anahtarı, gizli değil); ⏳ EAS'ta hâlâ test anahtarı yazılı (değiştirilecek); service account JSON + "coins" offering bekliyor |
| Play Console | Kayıt yapıldı, **kimlik doğrulama bekleniyor**; sonra: 12 testçi × 14 gün closed testing zorunlu |
| iOS | ✅ Apple hesabı onaylı; ASC uygulaması (`com.studysquadhq.app`, TestFlight + `alperentorun334@icloud.com`). buildNumber 4 TestFlight'ta çalıştı. 🔄 **TAZE build `50f40c6d` (buildNumber 7) derleniyor** — Live Activity + screen-lock dahil; bitince elle submit: `eas submit -p ios --latest` (ascAppId eas.json'da yok → auto-submit çalışmıyor). ASC API key (APP_MANAGER) EAS'te saklı. `scheme: studysquad` |
| Native modüller | expo-live-activity (Live Activity), local `modules/screen-lock` (kilit algılama, autolinking ✓ + gitignore negation), react-native-svg, expo-keep-awake → build cache'siz/uzun |
| Domain | `studysquad.app` **henüz alınmadı** (paylaşım kartlarında yazıyor + gizlilik politikası için gerekli) |

---

## 🔜 Sıradaki Adımlar

**Sonraki oturumun ilk işleri (Claude):** — bkz ⭐ "Oturum Özeti 2026-07-11" (BUILD DURUMU)
1. ✅ ~~TAZE iOS + Android build al~~ — atıldı (Android `592d10f0`, iOS `50f40c6d`). **Build sonuçlarını kontrol et**; iOS bittiyse **elle submit**: `cd mobile && npx eas-cli submit -p ios --latest` (interaktif, 2FA isteyebilir). Kalıcı fix: ascAppId'yi eas.json submit profiline yaz.
2. **Cihaz test geri bildirimlerini topla** → iterasyon: özellikle **Live Activity** (iOS, kaprisli olabilir) + **screen-lock hatırlatması** (iOS best-effort; kilitte yanlış tetik olursa v2 Darwin sinyali; Android güvenilir mi) + **pomodoro auto-start/titreşim** (Faz 24). Ayrıca Faz 14/15/16/18 UI'ları ilk kez cihazda.
3. Kalan küçük bug: onboarding **Skip butonu çalışmıyor**.
4. Aynı env'leri **production** ortamına da ekle → production AAB build (Play için).
5. Gizlilik politikası metnini hazırla (Sentry/PostHog/RC veri işleme dahil). Push teslimatı gerçek cihaz + muhtemel FCM kurulumu gerektiriyor.

**Kullanıcı tarafında bekleyenler:**
4. Play Console kimlik doğrulama sonucu → uygulama oluştur (`com.studysquad.app`) → **closed testing** track'ine AAB + **12 testçi e-postası** (14 gün kullanım şartı — testçileri şimdiden topla!).
5. Play Console'da IAP ürünleri: Pro abonelik (monthly/yearly + **free trial offer**) + coin paketleri (`coins_1000/5500/12000`).
6. RC'ye service account JSON bağla + ürünleri eşle + **"coins" offering** oluştur.
7. `studysquad.app` domain'ini al (~15$/yıl).
8. **Apple**: ✅ hesap onaylı + ASC uygulaması + ilk build. Kalan: yeni ikonlu build TestFlight'ta işlensin → iPhone'da test (özellikle **push**) → sonra ASC sözleşme/banka/vergi + iOS IAP ürünleri + **RevenueCat iOS `appl_` anahtarı** (IAP kurulunca) + App Privacy → public review. Not: iOS bundle `com.studysquadhq.app`.
9. Yayın sonrası fikirler: günlük görevler, ligler, pet besleme, Arena Pass.

> **Not (Claude için):** Yeni oturuma başlarken güncel durumu görmek için önce bu dosyayı oku; oturum sonunda yapılanları ve sıradaki adımları buraya işle.

---

## 📌 Çalışma Kuralları

- Commit'ler kullanıcının kendi adına — **Co-Authored-By trailer'ı yok**.
- Branch/PR yok — **direkt main'e commit + push** (push reddedilirse fetch + rebase).
- Hedef: **hem Google Play hem App Store**.

