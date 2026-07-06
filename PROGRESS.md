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
- **SIRADAKİ KARAR (kullanıcı istedi)**: **Focus Score** — süre + uygulamadan çıkış sayısı (AppState) + dışarıda geçen süre (telefon kullanımı proxy'si; UsageStats/ScreenTime İSTENMEYECEK, iOS'ta imkânsız) + tamamlama + molaya uyma → 0-100 skor, sunucuda hesaplanır (`sessions.focus_score`, migration 013), fişte kırılımla gösterilir, leaderboard'a karışmaz. Formül taslağı konuşuldu, onay bekliyor/başlanacak.

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
| Marka | **StudySquad** · paket `com.studysquad.app` · Play başlığı: "StudySquad: Study w/ Friends" |
| Backend | Fly.io — https://focusarena.fly.dev (/health 200, tüm cron'lar zamanlı; URL dahili, kullanıcı görmez) |
| DB | Supabase Sydney (ap-southeast-2); yerel bağlantı psql **pooler** ile (direkt host IPv6-only) |
| Migration'lar | 002–012 hepsi uygulandı ✓ |
| EAS | preview APK'lar başarılı ✓; preview env'de Sentry/PostHog/RC anahtarları; production env **boş** |
| Gözlemlenebilirlik | Sentry + PostHog **aktif** (preview build'lerde anahtarlar gömülü) |
| RevenueCat | Proje + `pro` entitlement + Monthly/Yearly offering ✓; Android anahtarı: `goog_ZabvZUZeqQlkyIWjFOGtRHKstqg` (public SDK anahtarı, gizli değil); ⏳ EAS'ta hâlâ test anahtarı yazılı (değiştirilecek); service account JSON + "coins" offering bekliyor |
| Play Console | Kayıt yapıldı, **kimlik doğrulama bekleniyor**; sonra: 12 testçi × 14 gün closed testing zorunlu |
| iOS | Kullanıcının telefonu iOS ama Apple hesabı yok; Android testi emülatörde. eas.json submit bloğu placeholder'lı |
| Domain | `studysquad.app` **henüz alınmadı** (paylaşım kartlarında yazıyor + gizlilik politikası için gerekli) |

---

## 🔜 Sıradaki Adımlar

**Sonraki oturumun ilk işleri (Claude):**
1. **YENİ PREVIEW BUILD** (kullanıcı erteledi — kuyruktaki 3 build iptal edildi): `cd mobile && npx eas-cli build --platform android --profile preview --non-interactive --no-wait`. İçereceği YENİ ve CİHAZDA HİÇ TEST EDİLMEMİŞ özellikler: **aylık takvim modalı (Faz 14) + donut grafik + pomodoro döngüsü (Faz 15)**. react-native-svg native modülü eklendiği için build cache'siz/uzun olacak. Bitince emülatöre kur (`adb install -r`) ve bu üç özelliği + mola bildirimini (kanal fix'i sonrası artık emülatörde de görünmeli) test et.
2. **Focus Score V1** (tasarım PROGRESS Faz 15 notunda + konuşuldu): mobil exits/awayMs/pauses takibi → stop gövdesinde gönder → sunucuda skor (migration 013 `sessions.focus_score`) → fişte kırılım + profilde haftalık ortalama.
3. Kalan küçük bug: onboarding **Skip butonu çalışmıyor**.
4. Aynı env'leri **production** ortamına da ekle → production AAB build.
5. Gizlilik politikası metnini hazırla (Sentry/PostHog/RC veri işleme dahil). Push teslimatı gerçek cihaz + muhtemel FCM kurulumu gerektiriyor.

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
