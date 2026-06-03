# FocusArena — Uygulama Raporu

> Hazırlanma tarihi: 2026-06-03  
> Dal: `feat/i18n-and-ui-modernization` → `main`  
> Canlı backend: https://focusarena.fly.dev

---

## İçindekiler

1. [Genel Bakış](#1-genel-bakış)
2. [Teknik Yığın](#2-teknik-yığın)
3. [Mimari](#3-mimari)
4. [Backend Modülleri](#4-backend-modülleri)
5. [Mobile Uygulama](#5-mobile-uygulama)
6. [Veritabanı Şeması](#6-veritabanı-şeması)
7. [Gerçek Zamanlı Altyapı](#7-gerçek-zamanlı-altyapı)
8. [Arka Plan İşleri](#8-arka-plan-işleri)
9. [Kimlik Doğrulama ve Güvenlik](#9-kimlik-doğrulama-ve-güvenlik)
10. [Çoklu Dil Desteği](#10-çoklu-dil-desteği)
11. [Dağıtım (Deploy)](#11-dağıtım-deploy)
12. [Bilinen Sınırlamalar](#12-bilinen-sınırlamalar)

---

## 1. Genel Bakış

FocusArena, odaklanma sürelerini takip eden, rekabetçi bir sıralama tablosu sunan ve kullanıcıları özel çalışma odalarına davet eden bir **mobil odak / pomodoro uygulamasıdır**. Uygulama; bireysel çalışma takibini, sosyal motivasyonu (arkadaşlar, odalar, rozetler) ve çok dilli kullanıcı arayüzünü tek bir platformda bir araya getirir.

### Temel İşlevler

| İşlev | Açıklama |
|---|---|
| **Zamanlayıcı** | 1–180 dakika arası özel süreli, konuya göre kategorize edilmiş odak seansları |
| **XP & Seviye** | Tamamlanan her dakika için 10 XP; her 500 XP'de seviye artışı |
| **Seri (Streak)** | Günlük seri takibi; gece yarısı UTC'de sıfırlanır |
| **Sıralama Tablosu** | Günlük / haftalık / aylık / tüm zamanlar; gerçek zamanlı WebSocket güncellemesi |
| **Odalar** | Davet kodlu özel çalışma odaları; oda başına üye dakika takibi |
| **Arkadaşlar** | Arkadaşlık isteği / kabul / reddet / engelle; çevrimiçi durum |
| **Rozetler** | 10 farklı başarım rozeti; session, streak, saat, seviye, oda, sosyal koşulları |
| **Konular** | Renkli/ikonlu konu kategorileri; konu bazlı süre istatistikleri |
| **Çoklu Dil** | 10 dil: TR, EN, DE, ES, FR, IT, PT, NL, PL, RU |

---

## 2. Teknik Yığın

### Backend
| Katman | Teknoloji |
|---|---|
| Çalışma ortamı | Node.js 20, TypeScript |
| Web çerçevesi | Fastify + `@fastify/jwt`, `@fastify/cors` |
| Veritabanı | Supabase (PostgreSQL) |
| Önbellek / oturum | Redis (Upstash, TLS) |
| Gerçek zamanlı | Socket.io |
| İş kuyruğu | BullMQ |
| Dağıtım | Fly.io (Docker) |

### Mobile
| Katman | Teknoloji |
|---|---|
| Çerçeve | React Native + Expo SDK 52 |
| Navigasyon | React Navigation v7 (Stack + Bottom Tabs) |
| Durum yönetimi | Zustand + MMKV (kalıcı depolama) |
| Sunucu durumu | TanStack Query v5 |
| Animasyon | React Native Reanimated 3 |
| WebSocket | socket.io-client |
| Çoklu dil | i18next + react-i18next + expo-localization |

### Paylaşılan
- `focusarena-shared` — ortak TypeScript tipleri (monorepo paketi)

---

## 3. Mimari

```
┌─────────────────────────────────────────────────────┐
│                  Mobile (Expo Go)                   │
│  React Navigation → Screens → TanStack Query        │
│  Zustand (authStore, timerStore, socketStore)       │
│  Socket.io-client (WebSocket bağlantısı)            │
└──────────────┬──────────────────┬───────────────────┘
               │  REST (HTTPS)    │  WebSocket (WSS)
               ▼                  ▼
┌─────────────────────────────────────────────────────┐
│         Backend — Fly.io (focusarena.fly.dev)       │
│                                                     │
│  Fastify HTTP       Socket.io         BullMQ Jobs   │
│  ├─ /auth           ├─ timer:start    ├─ lb-tick     │
│  ├─ /timer          ├─ timer:pause    ├─ streak-     │
│  ├─ /leaderboard    ├─ room:join      │  reset       │
│  ├─ /rooms          ├─ room:leave     └─ session-    │
│  ├─ /friends        └─ presence:ping    cleanup     │
│  └─ /achievements                                   │
└───────────┬─────────────────────────────────────────┘
            │
     ┌──────┴──────┐
     ▼             ▼
  Supabase      Redis
  (PostgreSQL)  (Upstash)
  - users       - timer:{userId}
  - sessions    - refresh:{userId}
  - rooms       - room:invite:*
  - friends     - room:presence:*
  - badges      - leaderboard cache
  - ...         - user:status:*
```

---

## 4. Backend Modülleri

### 4.1 Auth (`/auth`)

| Endpoint | Metot | Açıklama |
|---|---|---|
| `/auth/register` | POST | Kullanıcı kaydı; Supabase auth + DB trigger |
| `/auth/login` | POST | Giriş; access (15 dk) + refresh (7 gün) token çifti |
| `/auth/refresh` | POST | Token yenileme; rotation tabanlı, Redis'te saklanır |
| `/auth/logout` | POST | Redis'ten refresh token silinir |

**Önemli detaylar:**
- Access token: 15 dakika ömürlü JWT `{ sub, email, type: 'access' }`
- Refresh token: 7 günlük JWT, Redis'te `refresh:{userId}` anahtarında
- **Token yeniden kullanım koruması:** Kullanılmış refresh token tekrar sunulursa Redis'teki kayıt silinir, oturum kalıcı olarak sonlandırılır
- **Single-flight refresh:** Mobile tarafında eşzamanlı 401 yanıtları tek bir refresh çağrısına indirgenir

### 4.2 Timer (`/timer`)

| Endpoint | Metot | Açıklama |
|---|---|---|
| `/timer/start` | POST | Seans başlatır; Redis'e durum yazar, DB'ye kayıt açar |
| `/timer/pause` | POST | Saati dondurur, `accumulatedMs` güncellenir |
| `/timer/resume` | POST | `startTime` sıfırlanır, seans devam eder |
| `/timer/stop` | POST | Seans sonlandırılır, XP hesaplanır, Redis temizlenir |
| `/timer/status` | GET | Redis'ten anlık `elapsed`/`remaining` ms değerleri |
| `/timer/sessions` | GET | Sayfalanmış seans geçmişi (`page`, `limit`, `from`, `to`, `subjectId`) |
| `/timer/stats` | GET | Bugün / hafta / tüm zamanlar istatistikleri |
| `/timer/subjects` | GET | Aktif konu listesi |
| `/timer/subjects` | POST | Yeni konu oluştur |
| `/timer/subjects/:id` | PATCH | Konu güncelle |
| `/timer/subjects/:id` | DELETE | Konu soft-delete (`is_active = false`) |

**XP Kuralı:** Tamamlanmış sesyon (≥%90 süre) → dakika başına 10 XP  
**Seviye Formülü:** `⌊xp / 500⌋ + 1`  
**Seri:** Günde ilk tamamlanan seans sayılır; dünkü seans yoksa sıfırlanır

### 4.3 Leaderboard (`/leaderboard`)

| Endpoint | Metot | Açıklama |
|---|---|---|
| `/leaderboard/global` | GET | Sayfalanmış global tablo; `?period=daily\|weekly\|monthly\|alltime` |
| `/leaderboard/friends` | GET | Çağıran + arkadaşları sıralı liste |
| `/leaderboard/me` | GET | Çağıranın sırası, skoru, toplam kullanıcı sayısı |

**Önbellek TTL'leri:** Günlük 3 dk · Haftalık 10 dk · Aylık 30 dk · Tüm zamanlar 5 dk  
**Skor:** `daily/weekly/monthly` → toplam dakika · `alltime` → XP

### 4.4 Rooms (`/rooms`)

| Endpoint | Metot | Açıklama |
|---|---|---|
| `/rooms/mine` | GET | Kullanıcının üye olduğu odalar |
| `/rooms/:id` | GET | Oda detayı + üyeler + presence bilgisi |
| `/rooms` | POST | Oda oluştur (her zaman private, max 2 oda/kişi) |
| `/rooms/:id/join` | POST | Odaya katıl (`{ inviteCode }` zorunlu) |
| `/rooms/join-by-code` | POST | Davet kodu ile katıl `{ code }` |
| `/rooms/:id/leave` | POST | Odadan ayrıl; son kişiyse oda silinir |
| `/rooms/:id/invite` | POST | Davet kodunu yenile (sadece sahip) |
| `/rooms/:id` | PATCH | Oda güncelle (sadece sahip) |
| `/rooms/:id` | DELETE | Oda sil (sadece sahip) |

**Davet kodu:** 8 karakter hex, Redis'te 7 gün TTL  
**Üye dakika takibi:** Seans bitince `add_study_minutes_to_rooms` RPC çağrılır

### 4.5 Friends (`/friends`)

| Endpoint | Metot | Açıklama |
|---|---|---|
| `/friends` | GET | Kabul edilmiş arkadaş listesi + online durum |
| `/friends/requests` | GET | Gelen bekleyen istekler |
| `/friends/sent` | GET | Gönderilen istekler |
| `/friends/search?q=` | GET | Kullanıcı ara; `relationship` alanı döner |
| `/friends/request` | POST | Arkadaşlık isteği gönder |
| `/friends/:userId/accept` | POST | İsteği kabul et |
| `/friends/:userId/decline` | POST | İsteği reddet |
| `/friends/:userId/block` | POST | Kullanıcıyı engelle |
| `/friends/:userId` | DELETE | Arkadaşlığı kaldır veya engeli kaldır |

**Çapraz istek otomatik kabul:** B zaten A'ya istek göndermişse, A da istek atınca otomatik `accepted` olur.

### 4.6 Achievements (`/achievements`)

| Badge | Koşul |
|---|---|
| `first_session` | İlk tamamlanan seans |
| `streak_3` | 3 günlük seri |
| `streak_7` | 7 günlük seri |
| `streak_30` | 30 günlük seri |
| `hours_10` | Toplam 600 dakika (10 saat) |
| `hours_100` | Toplam 6000 dakika (100 saat) |
| `level_5` | Seviye ≥ 5 |
| `level_10` | Seviye ≥ 10 |
| `room_host` | İlk oda oluşturma |
| `social_butterfly` | ≥ 5 kabul edilmiş arkadaş |

Badge'ler otomatik olarak kazanılır (fire-and-forget); yeni kazanımda Socket.io `achievement:new` eventi yayınlanır.

---

## 5. Mobile Uygulama

### 5.1 Navigasyon Yapısı

```
RootNavigator
├── Auth (Stack, headerShown:false)
│   ├── LoginScreen
│   └── RegisterScreen
└── Main
    └── MainTabs (Bottom Tabs)
        ├── 🏠 Home
        ├── ⏱  Timer
        ├── 🏆 Leaderboard
        ├── 🚪 Rooms
        ├── 👥 Friends
        └── 👤 Profile
```

### 5.2 Ekranlar

#### 🏠 HomeScreen
- Avatar ring'li hero header, kullanıcı adı, seviye rozeti
- Glow efektli XP ilerleme çubuğu + seri chip'i
- Bugünün istatistikleri (seans sayısı, odak süresi, seri)
- Aktif seans banner'ı (Timer ekranına yönlendirir)
- Kazanılan rozet ızgarası

#### ⏱ TimerScreen
- Animasyonlu yarı-daire ilerleme göstergesi (`TimerCircle`)
- Hızlı süre seçici (5–120 dk) + özel süre girişi (1–180 dk)
- Konu seçici modal
- Aktif seans: anlık geçen/kalan süre, duraklat/devam et/bitir kontrolleri
- Seans bitişinde XP ve süre bildirim ekranı

#### 🏆 LeaderboardScreen
- Dönem seçici: Bugün / Hafta / Ay / Tüm Zamanlar
- "Benim Sıram" kartı (sol kenar vurgusu)
- Global Top 10 listesi (madalya ikonları, avatar, skor)
- Arkadaşlar sıralaması
- Haftalık veriler WebSocket üzerinden canlı güncelleme

#### 🚪 RoomsScreen
- Oda oluştur (name → sistem davet kodu üretir)
- Davet kodu ile odaya katıl
- Oda kartları: sahip/üye rozeti, üye sayısı
- Oda detay modalı: üye listesi, çalışma dakikaları sıralaması, davet kodu
- Oda silme / ayrılma onay dialogu

#### 👥 FriendsScreen
- **Arkadaşlar** sekmesi: çevrimiçi durum göstergesi (📖 çalışıyor, ☕ molada, 💤 çevrimdışı)
- **İstekler** sekmesi: gelen/gönderilen istekler; kabul/reddet butonları
- **Arama** sekmesi: kullanıcı adına göre arama; `relationship` durumuna göre + Ekle / Arkadaş / Beklemede etiketi

#### 👤 ProfileScreen
- Profil kartı: avatar, kullanıcı adı, e-posta, seviye
- XP çubuğu: mevcut XP, sonraki seviyeye kalan, seri bilgisi
- İstatistik grid'i: toplam seans, odak süresi, tamamlanan, ort. süre
- **Konularım:** renk + ikon seçici, göreli ilerleme çubuğu, düzenle/sil; konu bazlı süre + seans sayısı
- **Rozetler:** kazanılan + kilitli ayrımı
- **Odalarım & Davet Kodları:** sahip olunan odaların davet kodları (kopyalanabilir)
- Güvenli çıkış

### 5.3 Durum Yönetimi

| Store | İçerik |
|---|---|
| `authStore` | `user`, `accessToken`, `login()`, `logout()`, `clearAuth()` |
| `timerStore` | `isActive`, `isPaused`, `remainingMs`, `elapsedMs`, `progress`; setInterval ticker |
| `socketStore` | Socket bağlantısı, `top10` (canlı lb), `friendStatuses` |

### 5.4 API Katmanı (`api.ts`)

- Axios tabanlı istemci; `Authorization: Bearer` header'ı otomatik eklenir
- **401 auto-retry:** İstek `401` aldığında `refreshOnce()` çağrılır, tek token yenilemesi yapılır; başarısızsa oturum kapatılır
- `Content-Type: application/json` yalnızca body içeren isteklerde gönderilir (GET/DELETE'de göndermez)
- `.env` değerindeki URL boşlukları `.trim()` ile temizlenir

---

## 6. Veritabanı Şeması

Supabase (PostgreSQL) üzerinde çalışır. Başlıca tablolar:

| Tablo | Amaç |
|---|---|
| `users` | Profil: `id (uuid)`, `username`, `email`, `xp`, `level`, `streak`, `longest_streak` |
| `study_sessions` | Seans kayıtları: süre, konu, tamamlanma, XP |
| `subjects` | Kullanıcı konuları: ad, renk, ikon, `is_active` |
| `rooms` | Odalar: ad, `is_private`, `max_members`, `invite_code`, `owner_id` |
| `room_members` | Oda üyeliği: `is_active`, `joined_at` |
| `room_member_minutes` | Oda bazlı üye çalışma dakikaları (migration 002) |
| `friendships` | `requester_id`, `addressee_id`, `status` (pending/accepted/blocked) |
| `user_achievements` | Kazanılan rozetler: `badge_type`, `earned_at` |

**Tetikleyiciler:**
- `handle_new_user`: Supabase auth'ta yeni kullanıcı oluşturulunca `users` tablosuna otomatik kayıt ekler
- `add_study_minutes_to_rooms(p_user_id, p_minutes)`: Seans bitişinde kullanıcının aktif üyesi olduğu tüm odalara dakika ekler

---

## 7. Gerçek Zamanlı Altyapı

### WebSocket Olayları

**Client → Server**

| Olay | Davranış |
|---|---|
| `timer:start` | `startTimer` çağırır, `timer:started` döner |
| `timer:pause` | `pauseTimer` çağırır |
| `timer:complete` | `stopTimer` çağırır |
| `room:join` | `room:{roomId}` oduna katılır, presence Redis'e yazılır |
| `room:leave` | Room'dan çıkar, presence silinir |
| `presence:ping` | Global `user:status:{id}` + oda presence'ları güncellenir |

**Server → Client**

| Olay | Tetikleyici |
|---|---|
| `timer:started` | Seans başladığında |
| `room:updated` | Oda join/leave/patch işlemlerinde |
| `friend:status` | Arkadaşın presence değişiminde |
| `leaderboard:tick` | Her 60 saniyede haftalık Top 10 |
| `achievement:new` | Yeni rozet kazanıldığında |
| `error:session` | Handler hatası |

**Bağlantı yaşam döngüsü:**
1. JWT `handshake.auth.token` doğrulanır
2. `user:{userId}` kişisel odasına katılır
3. Kopuşta: global durum `offline` → tüm oda presence'ları silinir → arkadaşlara `friend:status offline`

---

## 8. Arka Plan İşleri

| İş | Tetikleyici | Davranış |
|---|---|---|
| `leaderboard-tick` | Her 60 saniye | Haftalık Top 10 çeker → `leaderboard:tick` broadcast |
| `streak-reset` | Her gün 00:05 UTC | Dünkü seans olmayanların serisi sıfırlanır (100'lük batch UPDATE) |
| `session-cleanup` | Her 10 dakika | `ended_at IS NULL` + 4 saat geçmiş seansları zorla kapatır, Redis key'lerini siler |

BullMQ üzerinden yönetilir; sunucu yeniden başladığında çakışma yaratmamak için önce siler, sonra ekler. Graceful shutdown: SIGTERM/SIGINT ile tüm kuyruklardan çıkılır.

---

## 9. Kimlik Doğrulama ve Güvenlik

### Token Akışı

```
Login ──→ access_token (15 dk JWT)
       └─→ refresh_token (7 gün JWT, Redis'te)

İstek ──→ Authorization: Bearer <access_token>
401   ──→ POST /auth/refresh → yeni token çifti
          (single-flight: eşzamanlı 401'ler tek refresh'e indirgenir)
```

### Güvenlik Önlemleri

- **authGuard:** Her korumalı endpoint'te JWT doğrulaması
- **Refresh token rotation:** Her yenilemede yeni çift üretilir, eskisi Redis'ten silinir
- **Reuse attack koruması:** Aynı refresh token iki kez kullanılırsa tüm oturum sonlandırılır
- **Rate limiting:** Fly.io düzeyinde (infra)
- **CORS:** Yapılandırılmış `@fastify/cors`
- **SQL injection:** Supabase SDK parametrik sorgular kullanır

---

## 10. Çoklu Dil Desteği

### Desteklenen Diller

| Kod | Dil | Bayrak |
|---|---|---|
| `tr` | Türkçe | 🇹🇷 |
| `en` | English | 🇬🇧 |
| `de` | Deutsch | 🇩🇪 |
| `es` | Español | 🇪🇸 |
| `fr` | Français | 🇫🇷 |
| `it` | Italiano | 🇮🇹 |
| `pt` | Português | 🇵🇹 |
| `nl` | Nederlands | 🇳🇱 |
| `pl` | Polski | 🇵🇱 |
| `ru` | Русский | 🇷🇺 |

### Çeviri Kapsamı

Tüm locale JSON dosyaları (`mobile/src/i18n/locales/*.json`) şu anahtar gruplarını içerir:

- `common` — genel (hata, iptal, kaydet, vb. + birim kısaltmaları)
- `auth` — giriş/kayıt ekranı
- `nav` — sekme/başlık adları
- `home` — ana ekran metinleri
- `timer` — zamanlayıcı, modal ve alert metinleri
- `profile` — profil, konular, rozetler, odalar
- `rooms` — oda yönetimi ve modal'lar
- `leaderboard` — sıralama ekranı
- `friends` — arkadaş ekranı
- `status` — çevrimiçi durum etiketleri
- `language` — dil seçici başlığı

### Nasıl Çalışır

1. Uygulama açılınca cihaz dili otomatik algılanır (`expo-localization`)
2. Kullanıcı daha önce dil seçtiyse `AsyncStorage`'dan yüklenir
3. `LanguagePicker` bileşeniyle (bayraklı bottom-sheet) dil değiştirilebilir
4. Seçim `AsyncStorage`'a kaydedilir; bir sonraki açılışta da geçerlidir
5. Tüm çeviriler uygulama paketi içinde (bundle) — ağ bağlantısı gerektirmez

---

## 11. Dağıtım (Deploy)

### Backend — Fly.io

```
URL      : https://focusarena.fly.dev
Platform : Fly.io (Docker, Node.js 20)
Deploy   : flyctl deploy --remote-only (proje kök dizininden)
```

**Ortam değişkenleri (Fly secrets):**
- `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`
- `REDIS_URL` (Upstash, TLS: `rediss://`)
- `JWT_SECRET`
- `PORT` (varsayılan 8080)

### Mobile — Expo Go

```
Geliştirme  : npx expo start
Test cihazı : Expo Go uygulaması (QR kod ile)
API URL     : EXPO_PUBLIC_API_URL=https://focusarena.fly.dev
```

**Dikkat:** `.env` dosyasındaki URL değerinin sonunda boşluk bırakılmamalıdır (constants'ta `.trim()` uygulanır).

---

## 12. Bilinen Sınırlamalar

| Konu | Durum |
|---|---|
| Eski test odaları | DB'de birkaç public test odası kalmakta (silinebilir) |
| Push bildirim | Henüz yok; seans hatırlatıcısı veya rozet bildirimi planlanmadı |
| Offline mod | Aktif seans çalışır (yerel ticker), ancak sunucu erişimi yoksa başlatılamaz |
| Maksimum oda | Kullanıcı başına 2 oda sahibi olunabilir (kasıtlı kısıtlama) |
| Leaderboard boyutu | Bellekte en fazla 1000 kullanıcı, 50.000 seans satırı; daha büyük için sayfalama gerekir |
| E-posta doğrulama | Geliştirme modunda devre dışı (`email_confirm: true` → anında aktif) |

---

*Son güncelleme: 2026-06-03*
