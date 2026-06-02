# FocusArena — Build Progress

---

## ✅ Auth Module
`backend/src/modules/auth/`

| Endpoint | Description |
|----------|-------------|
| `POST /auth/register` | Supabase auth user + DB trigger → users table, issues token pair |
| `POST /auth/login` | Supabase signIn, issues token pair |
| `POST /auth/refresh` | Verifies refresh JWT + Redis match, rotates both tokens |
| `POST /auth/logout` | Deletes refresh token from Redis |

**Notes:**
- Access token: 15 min JWT `{ sub, email, type: 'access' }`
- Refresh token: 7 day JWT, stored in Redis at `refresh:{userId}`
- Token reuse detected → Redis entry wiped immediately
- `authGuard` exported for use in all other modules

---

## ✅ Timer Module
`backend/src/modules/timer/`

| Endpoint | Description |
|----------|-------------|
| `POST /timer/start` | Creates DB session + Redis state (`timer:{userId}`) |
| `POST /timer/pause` | Freezes clock, accumulates elapsed ms |
| `POST /timer/resume` | Resets `startTime`, resumes clock |
| `POST /timer/stop` | Finalizes DB record, clears Redis, awards XP |
| `GET /timer/status` | Live elapsed/remaining ms from Redis |
| `GET /timer/sessions` | Paginated history (`page`, `limit`, `from`, `to`, `subjectId`) |
| `GET /timer/stats` | Today / Mon–Sun week / all-time aggregates |
| `GET /timer/subjects` | List active subjects |
| `POST /timer/subjects` | Create subject |
| `PATCH /timer/subjects/:id` | Update subject fields |
| `DELETE /timer/subjects/:id` | Soft-delete (`is_active = false`) |

**Notes:**
- Pause accuracy: `accumulatedMs` carries elapsed time across all pause/resume cycles
- Completion threshold: ≥ 90 % of intended duration = `was_completed: true`
- XP: 10 XP/min on completion · Level = `⌊xp / 500⌋ + 1`
- Streak: only first completion of the UTC day updates counter; yesterday check → `+1` or reset to `1`
- Redis TTL: 4 h; crashed sessions recoverable via `sessions WHERE ended_at IS NULL`
- Emits `timer:started` to `user:{userId}` Socket.io room on start

---

## ✅ Leaderboard Module
`backend/src/modules/leaderboard/`

| Endpoint | Description |
|----------|-------------|
| `GET /leaderboard/global` | Paginated global board · `?period=daily\|weekly\|monthly\|alltime&page&limit` |
| `GET /leaderboard/friends` | Caller + accepted friends ranked · `?period=` |
| `GET /leaderboard/me` | Caller's rank, score, total-users count · `?period=` |

**Notes:**
- Score: `duration_minutes` sum for period windows; `xp` field for alltime
- Competition ranking: tied scores get same rank (1, 2, 2, 4)
- Redis cache per period — TTLs: daily 3 min · weekly 10 min · monthly 30 min · alltime 5 min
- `invalidateCache(period)` exported; `timer.stopTimer` busts all 4 periods on completion (fire-and-forget)
- `getTop10ForSocket(period)` exported for future WS tick job
- Friends board always includes the caller even with zero score
- Max 1,000 users ranked in memory; sessions capped at 50,000 rows per fetch

---

## ✅ Rooms Module
`backend/src/modules/rooms/`

| Endpoint | Description |
|----------|-------------|
| `GET /rooms` | Public room list · `?search&page&limit` |
| `GET /rooms/mine` | Rooms caller is active member of |
| `GET /rooms/:id` | Room detail + members + presence (private: members-only) |
| `POST /rooms` | Create room (owner auto-joins) |
| `PATCH /rooms/:id` | Update name / privacy / max_members (owner only) |
| `DELETE /rooms/:id` | Delete room (owner only) |
| `POST /rooms/:id/join` | Join room; private rooms require `{ inviteCode }` |
| `POST /rooms/join-by-code` | Invite code ile odaya katıl `{ code }` → `{ roomId, room }` |
| `POST /rooms/:id/leave` | Leave room; transfers ownership or deletes if last member |
| `POST /rooms/:id/invite` | Regenerate invite code (owner + private rooms only) |

**Notes:**
- Invite codes: 8-char hex stored in Redis (`room:invite:code:{code}` ↔ `room:invite:room:{id}`), TTL 7 days; busted on delete/privacy change
- Presence: `room:presence:{roomId}:{userId}` in Redis, TTL 5 min; refreshed by WS `presence:ping`
- Owner leave: earliest-joined remaining member becomes owner; room deleted if no one left
- `max_members` patch guard: rejects if new value < current active count
- `room:updated` broadcast via Socket.io on join / leave / patch (best-effort)
- `getRoomMembers`, `setPresence` exported for WebSocket handler

---
## ✅ Friends Module
`backend/src/modules/friends/`

| Endpoint | Description |
|----------|-------------|
| `GET /friends` | Kabul edilmiş arkadaş listesi + online status |
| `GET /friends/requests` | Gelen bekleyen istekler |
| `GET /friends/sent` | Gönderilen bekleyen istekler |
| `GET /friends/blocked` | Engellediğim kullanıcılar |
| `GET /friends/search?q=` | Kullanıcı ara; her sonuçta `relationship` alanı var |
| `POST /friends/request` | Arkadaşlık isteği gönder |
| `POST /friends/:userId/accept` | Gelen isteği kabul et |
| `POST /friends/:userId/decline` | Gelen isteği reddet |
| `POST /friends/:userId/block` | Kullanıcıyı engelle |
| `DELETE /friends/:userId` | Arkadaşlığı kaldır veya engeli kaldır |

**Notes:**
- Friendship yönü: `(requester_id, addressee_id)` PK; `blocked` satırında `requester_id` her zaman engelleyendir
- Cross-request auto-accept: B isteği göndermişse A da istek gönderince otomatik `accepted` olur
- `relationship` enum: `none | friend | request_sent | request_received | blocked_by_me | blocked_by_them`
- Online status: Redis `user:status:{userId}`, TTL 5 dk; WS `presence:ping` ile güncellenir
- `setUserStatus` / `getUserStatus` WebSocket handler için export edildi

---
## ✅ Achievements Module
`backend/src/modules/achievements/`

| Endpoint | Description |
|----------|-------------|
| `GET /achievements` | Kendi trophy cabinet — earned (meta ile) + locked liste |
| `GET /achievements/:userId` | Başka kullanıcının sadece earned badge'leri (public) |

**Badge türleri (10 adet):**

| Badge | Koşul |
|-------|-------|
| `first_session` | İlk tamamlanan oturum |
| `streak_3/7/30` | Streak ≥ 3 / 7 / 30 gün |
| `hours_10/100` | Toplam ≥ 10 / 100 saat çalışma |
| `level_5/10` | Seviye ≥ 5 / 10 |
| `room_host` | İlk oda oluşturma |
| `social_butterfly` | ≥ 5 kabul edilmiş arkadaş |

**Notes:**
- `checkAndAward(userId, ctx)` — hafif engine; mevcut badge'ler çekilir, yeni koşullar kontrol edilir, tek INSERT ile toplu yazılır
- Üç hook-in noktası (fire-and-forget `void`):
  - `timer.service` → session complete sonrası (streak, level, totalMinutes, isFirstSession)
  - `rooms.service` → createRoom sonrası (`isRoomHost: true`)
  - `friends.service` → acceptRequest sonrası (her iki taraf için `friendCount`)
- DB UNIQUE constraint zaten koruma sağladığından race condition risksiz
- Her yeni badge için Socket.io `achievement:new` emit edilir (`user:{userId}` room)

---
## ✅ WebSocket / Presence
`backend/src/websocket/`

| Dosya | Sorumluluk |
|-------|-----------|
| `index.ts` | Sunucu singleton · `createSocketServer` · `getSocketServer` · `setupHandlers` |
| `handlers.ts` | Her bağlantı için olay handler'ları |

**Client → Server olayları:**

| Olay | Davranış |
|------|---------|
| `timer:start` | `startTimer` çağırır, `timer:started` döner |
| `timer:pause` | `pauseTimer` çağırır |
| `timer:complete` | `stopTimer` çağırır (was_completed server tarafında belirlenir) |
| `room:join` | Socket.io `room:{roomId}`'ye katılır, presence Redis'e yazılır, `room:updated` broadcast |
| `room:leave` | Room'dan çıkar, presence silinir, `room:updated` broadcast |
| `presence:ping` | Global `user:status:{id}` + tüm katılınan oda presence'ları güncellenir, arkadaşlara `friend:status` gönderilir |

**Yaşam döngüsü:**
- **Bağlantı**: JWT `handshake.auth.token` doğrulanır, DB'den username çekilir, `user:{userId}` kişisel room'una katılır
- **Kopuş**: Global status `offline` yapılır, tüm oda presence'ları silinir, arkadaşlara `friend:status offline` gönderilir

**Notes:**
- `setupHandlers(jwtVerify)` — Fastify'dan bağımsız; `server.ts`'de `app.jwt.verify` inject edilir
- Tüm handler'lar try/catch ile sarılır; hata `error:session` olayına yazılır
- `leaderboard:tick` → jobs modülüne bırakıldı

---
## ✅ Jobs (Bull queues)
`backend/src/jobs/`

| Job | Tetikleyici | Davranış |
|-----|------------|---------|
| `leaderboard-tick` | Her 60sn | Haftalık top-10 çeker → tüm socket'lere `leaderboard:tick` broadcast |
| `streak-reset` | Her gün 00:05 UTC | Dün oturum tamamlamayanların `streak`'ini 0'a sıfırlar |
| `session-cleanup` | Her 10dk | `ended_at IS NULL` + 4 saat geçmiş oturumları zorla kapatır, Redis timer key'lerini siler |

**Notes:**
- `scheduleRepeat()` yardımcısı: sunucu yeniden başlayınca yinelenen job'ları çakıştırmaz (önce siler, sonra ekler)
- Streak reset: önce tüm streak > 0 kullanıcılar çekilir → dünkü oturumlar ile fark hesaplanır → 100'lük batch UPDATE
- Session cleanup: `UPDATE … WHERE ended_at IS NULL` guard'ı race condition'a karşı koruma sağlar
- `removeOnComplete: 50` / `removeOnFail: 100` — Redis'te iş geçmişi saklanır
- `startJobs()` ve `stopJobs()` server.ts'e bağlandı; SIGTERM/SIGINT graceful shutdown çalışır

---
## ✅ Mobile App (React Native / Expo)
`mobile/`

### Katmanlar

| Katman | Dosyalar | Notlar |
|--------|---------|-------|
| **Utils** | `storage.ts`, `formatTime.ts` | MMKV Zustand adapter; msToDisplay / formatDuration |
| **Types** | `src/types/index.ts` | Tüm API + navigasyon tipleri camelCase; shared'dan sadece çakışmayan tipler re-export |
| **Services** | `api.ts`, `auth/timer/leaderboard/rooms/friends/achievements.service.ts` | 401 auto-retry + refresh interceptor; mapper layer (snake → camelCase) |
| **WebSocket** | `services/websocket.ts` | socket.io-client singleton; `initSocket` / `getSocket` / `disconnect` |
| **Stores** | `authStore`, `timerStore`, `socketStore` | Zustand + MMKV persist; setInterval ticker; socket event mapping |
| **Hooks** | `useAuth`, `useTimer` | AppState foreground sync; presence side-effects; `progress` 0–1 |
| **Components** | `TimerCircle`, `StatCard` | İki yarım-daire overflow:hidden animasyonu (SVG gerekmez); Reanimated |
| **Screens** | Login, Register, Home, Timer, Leaderboard, Rooms, Friends, Profile | TanStack Query v5; full CRUD UI |
| **Navigation** | `RootNavigator`, `MainTabs` | Auth / Main stack split; DarkTheme |
| **App.tsx** | — | SafeAreaProvider → QueryClient → MMKV hydration guard → Navigator |

### Navigasyon Yapısı
```
RootNavigator (Stack, headerShown: false)
├── Auth (Stack) → LoginScreen · RegisterScreen
└── Main → MainTabs (Bottom Tabs, 6 tab)
    ├── 🏠 Home    — XP bar + stats + active-timer banner + badges
    ├── ⏱ Timer   — Animasyonlu daire + süre seçici + konu picker + kontroller
    ├── 🏆 Leaderboard — Dönem seçici (daily/weekly/monthly/alltime) + canlı WS top10
    ├── 🚪 Rooms   — Liste / oda oluştur / davet kodu ile katıl
    ├── 👥 Friends — Friends / Requests / Search sekmeleri
    └── 👤 Profile — Avatar + XP + stats + tüm badge'ler + çıkış
```

### Teknik Notlar
- **Token yenileme**: `api.setOnRefresh` callback; 401 alınca bir kez retry
- **Zamanlayıcı doğruluğu**: setInterval tick + `accumulatedMs` (pause/resume güvenli)
- **Socket tipi uyumu**: `RawSocketLbEntry` → `LeaderboardEntry` map, snake→camelCase
- **TanStack Query v5**: `onSuccess`/`onError` sadece `useMutation`'da; `useQuery.onSuccess` → `useEffect`
- **Type çakışması çözümü**: `export * from 'focusarena-shared'` kaldırıldı; yalnızca `BadgeType`, `Achievement`, `Friendship`, `MemberStatus` re-export
- **Rehydration guard**: `AppInner` `isHydrated` false iken navigator render etmez (`null` döner)



┌───────────────────────────────────────────────────────────────┬─────────────────────────────┐
  │                             Konu                              │            Durum            │
  ├───────────────────────────────────────────────────────────────┼─────────────────────────────┤
  │ Auth/network kilitlenmesi (URL boşluğu + refresh yarışı)      │ ✅ Çözüldü                  │
  ├───────────────────────────────────────────────────────────────┼─────────────────────────────┤
  │ Friends/Rooms/Leaderboard snake_case uyumsuzlukları           │ ✅ Çözüldü                  │
  ├───────────────────────────────────────────────────────────────┼─────────────────────────────┤
  │ Özel timer süresi                                             │ ✅                          │
  ├───────────────────────────────────────────────────────────────┼─────────────────────────────┤
  │ Odalar private-only + max 2 oda + üye listesi + dakika takibi │ ✅ Deploy + migration canlı │
  ├───────────────────────────────────────────────────────────────┼─────────────────────────────┤
  │ Profile/Home XP=0 bug'ı (nested stats hizalama)               │ ✅                          │
  ├───────────────────────────────────────────────────────────────┼─────────────────────────────┤
  │ Konu silme "Body cannot be empty" (DELETE content-type)       │ ✅                          │
  ├───────────────────────────────────────────────────────────────┼─────────────────────────────┤
  │ i18n altyapısı + 10 dil + Login/Register çevirisi             │ ✅                          │
  └───────────────────────────────────────────────────────────────┴─────────────────────────────┘

  🔜 Sonraki oturumda kaldığımız yer

  Görev: Tüm ekranları (Timer, Profile, Rooms, Leaderboard, Friends, Home + sekme adları) 10 dile çevirmek —
  metinleri t() anahtarlarına taşıyıp locales/*.json dosyalarını doldurmak. Parti parti ilerleyeceğiz.

  Ayrıca bekleyen küçük işler: geçici 🔍 Tanı sekmesini kaldırmak, Home ekranı UI modernizasyonu.

  Sonraki oturumda "kaldığımız yerden devam" dediğinde hafızadan bu planı okuyup çeviriye başlayacağım. İyi
  çalışmalar! 🎯