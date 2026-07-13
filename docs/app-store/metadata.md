# App Store Connect — v1.0 Yayın Paketi (StudySquad)

> Hazırlayan: 2026-07-12 oturumu. ASC: https://appstoreconnect.apple.com — app `6788842347` (StudySquad / com.studysquadhq.app).
> Karar: **v1.0 iOS'ta IAP/abonelik YOK** (RC'de Apple app'i kurulmadı, billing env-gate kapalı) → inceleme basit; IAP v1.1'de.

---

## 1) App Information (bir kere doldurulur)

| Alan | Değer |
|---|---|
| Name | `StudySquad` |
| Subtitle (30 kr) | EN: `Focus timer with friends` · TR: `Arkadaşlarınla odaklan` |
| Primary Category | **Education** |
| Secondary Category | Productivity |
| Content Rights | "Does not contain third-party content" (Noto Emoji CC-BY zaten atıf gerektiriyor ama üçüncü taraf *lisanssız* içerik yok) |
| Age Rating | Anket cevapları ↓ §5 |
| Privacy Policy URL | `https://focusarena.fly.dev/legal/privacy` |

## 2) Pricing & Availability

- Price: **Free** (0)
- Availability: tüm ülkeler (varsayılan)

## 3) Version 1.0 sayfası

**Support URL:** `https://focusarena.fly.dev/legal/support`
**Marketing URL:** boş bırak (studysquad.app domain'i alınmadı)
**Copyright:** `2026 Alperen Torun`

### Description — EN (primary locale: English U.S.)

```
Studying alone is hard. StudySquad turns focus into a game you play with friends.

Start a focus session or a full Pomodoro cycle, and your minutes count — toward your
daily goal, your streak, your friends' leaderboard and your country's weekly ranking.

WHY STUDENTS STAY
• Focus timer & Pomodoro cycles — 25/5 or 50/10, auto-start options, break reminders
• Lock-screen Live Activity — watch your countdown without unlocking your phone
• Streaks & daily goals — build a habit, protect your streak
• Focus Score — every session gets a 0–100 quality score, not just minutes
• Study with friends — see who's studying right now, race your friends' weekly minutes
• Ghost Mode — race the yesterday-you, beat your own record
• Country Wars — your minutes count for your country's weekly league
• Study rooms — private rooms with your study group, library-style ranking
• Monthly calendar & subject breakdown — see exactly where your hours go
• Collect & customize — earn coins, adopt an evolving study pet, unlock timer frames
• Share your Study Receipt — a beautiful session card for your story

Your data stays yours: no ads, no selling data, delete your account anytime.

StudySquad — study together, stay focused.
```

### Description — TR (Turkish)

```
Tek başına ders çalışmak zor. StudySquad odaklanmayı arkadaşlarınla oynadığın bir oyuna çevirir.

Bir odak seansı ya da tam Pomodoro döngüsü başlat; dakikaların günlük hedefine, serine,
arkadaş sıralamana ve ülkenin haftalık ligine yazılsın.

NEDEN STUDYSQUAD
• Odak sayacı ve Pomodoro döngüleri — 25/5 veya 50/10, otomatik başlatma, mola hatırlatması
• Kilit ekranı canlı sayacı — telefonu açmadan geri sayımı gör
• Seri (streak) ve günlük hedefler — alışkanlık kur, serini koru
• Focus Score — her seansa sadece dakika değil, 0–100 kalite puanı
• Arkadaşlarınla çalış — kim şu an çalışıyor gör, haftalık dakika yarışına gir
• Hayalet Modu — dünkü kendinle yarış, kendi rekorunu kır
• Ülke Savaşları — dakikaların ülkenin haftalık ligine katkı sağlasın
• Çalışma odaları — çalışma grubunla özel odalar, kütüphane havasında sıralama
• Aylık takvim ve konu dağılımı — saatlerin tam olarak nereye gittiğini gör
• Topla ve kişiselleştir — coin kazan, evrilen ders evcil hayvanı edin, sayaç çerçeveleri aç
• Study Receipt paylaş — seans sonunda hikayene koyabileceğin şık kart

Verin senindir: reklam yok, veri satışı yok, hesabını istediğin an silebilirsin.

StudySquad — birlikte çalış, odaklan.
```

### Keywords (100 kr, virgülle)

EN: `study,focus,timer,pomodoro,streak,study with me,friends,leaderboard,exam,habit,concentration`
TR: `ders,odak,sayaç,pomodoro,yks,kpss,ders çalışma,arkadaş,sıralama,seri,motivasyon`

### Promotional Text (170 kr, her an değiştirilebilir)

EN: `Study with friends: focus timer, streaks, leaderboards, country wars and a lock-screen countdown. Every minute counts.`
TR: `Arkadaşlarınla ders çalış: odak sayacı, seriler, sıralamalar, ülke savaşları ve kilit ekranı geri sayımı.`

### What's New (v1.0)

EN: `First release 🎉` · TR: `İlk sürüm 🎉`

## 4) App Review Information

- **Sign-in required: YES** → Demo account:
  - User: `testalpha1@studysquad.test`
  - Password: `Passw0rd123`
- **Notes** (kopyala-yapıştır):

```
Thank you for reviewing StudySquad!

• Demo account above is pre-populated (has friends and study history). You can also
  register a fresh account with any email — no email verification is required.
• Social features: users can block other users (Friends screen) and all friend
  requests require explicit acceptance. Day-by-day stats are visible to accepted
  friends only.
• Account deletion is available in-app: Profile → Delete account (bottom of screen).
• This version contains NO in-app purchases and NO ads.
• Live Activity (lock-screen countdown) requires iOS 16.2+ and starts automatically
  with a focus session.
• Push notifications are optional; the app is fully usable without them.
```

- Contact: Alperen Torun · alperentorun334@gmail.com · telefon numaranı ekle

## 5) Age Rating anketi (beklenen sonuç: 4+)

Tüm şiddet/korku/cinsellik/madde soruları: **None**
- Gambling (simulated dahil): **No/None**
- Contests: **None** (ödüllü yarışma yok; leaderboard ödülsüz)
- Unrestricted Web Access: **NO** (webview yok)
- Kids Category'ye girme: **HAYIR**
- "Made for Kids" değil; 13+ hedef (Terms'te yazıyor)

## 6) App Privacy (nutrition labels)

"Data collection: Yes" → şu tipler **Collected, Linked to identity, NOT used for tracking**:

| Data type | Purpose |
|---|---|
| Contact Info → Email Address | App Functionality (hesap) |
| Identifiers → User ID | App Functionality, Analytics |
| Usage Data → Product Interaction | Analytics (PostHog) |
| User Content → Other User Content | App Functionality (konu adları, oda adları, kullanıcı adı) |
| Purchases → Purchase History | App Functionality (RevenueCat — Android; iOS v1'de satın alma yok ama beyan güvenli tarafta) |

**Collected, NOT linked, not tracking:**
| Diagnostics → Crash Data, Performance Data | App Functionality (Sentry) |

- "Do you or your partners use data for tracking (ATT)?" → **NO** (reklam/veri brokeri yok)

## 7) Screenshots (zorunlu: 6.9" veya 6.7" iPhone seti, 3–10 adet)

Önerilen kareler (build 10'dan, Nebula timer'lı):
1. Timer — aktif seans, Nebula halkası + FOCUSING ⏳ **EKSİK — kullanıcıdan bekleniyor**
2. Home — günlük hedef + challenge kartı + pet ✅ `screenshots/tr/02-home.png`
3. Leaderboard — küresel sıralama ✅ `screenshots/tr/03-leaderboard.png`
4. Profil — konu donut'u + istatistikler ✅ `screenshots/tr/04-stats.png`
5. Aylık takvim (konu kırılımlı) ✅ `screenshots/tr/05-calendar.png`
6. Çerçeve + Pet mağazası ✅ `screenshots/tr/06-store.png`
7. Study Receipt paylaşım kartı ⏳ **EKSİK — kullanıcıdan bekleniyor** (opsiyonel)

Üretim: `docs/app-store/screenshots/tr/` altında **1290×2796 pazarlama çerçeveli** PNG'ler hazır
(koyu gradyan + Türkçe başlık + telefon çerçevesi; 2026-07-13). Kaynak ham görüntüler `images/`
klasöründe (WhatsApp 945×2048). Timer + Receipt görüntüleri gelince aynı boru hattıyla
`01-timer.png` ve `07-receipt.png` üretilecek (script: scratchpad `compose.js` — sharp,
`xml:space="preserve"` tspan hilesiyle; gerekirse yeniden kurulur).

## 8) Sıra (checklist)

- [x] Privacy/Terms/Support sayfaları canlı (fly.dev/legal/*)
- [x] EAS production env: PostHog+Sentry+RC-Android anahtarları eklendi
- [x] Build 10 (production, autoIncrement) → TestFlight → cihazda hızlı duman testi (Nebula timer + login + seans)
- [ ] iPhone'dan ekran görüntüleri → 5/7 çerçevelendi (`screenshots/tr/`); Timer + Receipt bekleniyor → ASC'ye yükle
- [ ] ASC: App Information + Pricing + Privacy + Age Rating doldur (bu doküman)
- [ ] Version 1.0: metin/keywords/screenshots + build 10 seç + demo hesap + notlar
- [ ] Release seçeneği: **Manually release** (onay sonrası elle yayınla) — ilk sürümde kontrol bizde
- [ ] Submit for Review 🚀 (ilk inceleme tipik 24–48 saat)

## 9) v1.1 için park edilenler

- iOS IAP: RC'de App Store app + `appl_` key, ASC'de subscription group (Monthly/Yearly) + coin consumables, paywall'a Terms/Privacy linkleri (Apple 3.1.2 şartı), trial tanımı
- Profil'e gizlilik/şartlar linkleri (i18n ile)
- studysquad.app domain'i (marketing URL + e-posta)
