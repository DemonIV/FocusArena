.

🔴 Öncelik 1 — Hemen Ekle (Yüksek Etki, Düşük Maliyet)
1. Timer Ekranı — Canlı Motivasyon Katmanı
Şu an: Sadece sayaç var
Eklenecek:

"Right now 1,247 people are focusing with you"
→ WebSocket'ten global aktif kullanıcı sayısı
→ Zaten socket altyapısı var, 1 satır veri

Timer çalışırken:
→ Subtle animasyon: nefes alan halka (pulse)
→ Renk geçişi: başlarken mavi → bitiş yaklaşınca yeşil
→ Alt kısımda: "🔥 Your best today: 2h 15m"
2. "Study Receipt" Paylaşım Kartı
Seans bitince:
┌─────────────────────────┐
│  ⚡ FocusArena          │
│                         │
│  Mathematics            │
│  2h 30m focused         │
│                         │
│  +1,500 XP  🔥 Day 12  │
│  Global Rank: #247      │
│                         │
│  focusarena.app         │
└─────────────────────────┘
[Share] butonu

→ Instagram Story boyutunda (1080x1920)
→ react-native-view-shot ile screenshot al
→ En güçlü organik büyüme mekanizması
→ Raporda push bildirim yok yazıyor — bu onu telafi eder
3. Leaderboard — Kişisel Konum Vurgusu
Şu an: Liste var
Eklenecek:

Listenin ortasında kullanıcı kendi satırını görür:
─────────────────────
#245  Alex K.    4h 20m
#246  Maria S.   4h 15m
► #247  Sen      4h 10m  ◄ (highlight)
#248  John D.    4h 05m
─────────────────────
"3 people ahead of you. 
 Study 10 more minutes to reach #244"

→ /leaderboard/me endpoint zaten var
→ Sadece UI değişikliği
4. Streak Ekranı — Görsel Takvim
Şu an: Sayı gösteriliyor (12 gün streak)
Eklenecek:

Son 30 günlük ısı haritası:
[●][●][●][○][●][●][●]...
Dolu = çalışıldı, boş = kaçırıldı

GitHub contribution graph benzeri
→ "Your longest streak: 23 days"
→ Psikolojik etki: boş kareyi görmek istemezsin
→ react-native-svg ile basit

🟡 Öncelik 2 — Bu Ay Ekle (Yüksek Etki, Orta Maliyet)
5. Home Ekranı — Dashboard Redesign
Şu an muhtemelen: Timer butonu + basit stats
Olması gereken:

┌─ Bugün ──────────────────┐
│  3h 45m / 4h hedef  %93  │
│  ████████████░░░         │
└──────────────────────────┘

┌─ Haftanın özeti ─────────┐
│  Mo Tu We Th Fr Sa Su    │
│  2h 3h 1h 4h -- -- --    │
│  Toplam: 10h 45m         │
└──────────────────────────┘

┌─ Arkadaşlar (canlı) ─────┐
│  📖 Alex — 45m çalışıyor │
│  ☕ Maria — mola          │
│  💤 John — çevrimdışı    │
└──────────────────────────┘
6. Oda Ekranı — "Kütüphane Hissi"
Oda içindeyken:

Üyeler kartlar halinde:
┌──────────┐  ┌──────────┐
│  👤 Alex  │  │  👤 Maria│
│ 📖 1h 23m│  │ ☕ Mola  │
│ [canlı]  │  │          │
└──────────┘  └──────────┘

Ambient ses seçeneği (opsiyonel):
☕ Coffee shop  📚 Library  🌧️ Rain
→ Expo AV ile local ses dosyaları
→ Premium özellik olabilir

Oda içi mini leaderboard:
1. Alex    2h 15m
2. Sen     1h 45m  ◄
3. Maria   1h 10m
7. Onboarding Akışı
Raporda yok — büyük ihtimalle eksik.

3 adımlı onboarding:
1. "What do you study?" → ilk konu oluşturma
2. "Set your daily goal" → günlük hedef (dakika)
3. "Find friends" → kullanıcı ara / atla

Olmadan:
→ Kullanıcı boş ekranla karşılaşır
→ İlk gün churn %60+
8. Push Bildirim — Raporda "Henüz Yok" Yazıyor
Bunu en kısa sürede ekle:

Kritik bildirimler:
→ "🔥 Streak tehlikede! Gece 23:00 uyarısı"
→ "Alex seni geçti leaderboard'da"
→ "Oda arkadaşın çalışmaya başladı"
→ "Haftalık özet: 12h 30m çalıştın"

expo-notifications zaten pakette var (raporda görüyorum)
Sadece implement edilmemiş
→ Firebase FCM bağlantısı + backend'de bildirim servisi

🟢 Öncelik 3 — Sonraki Versiyon (Viral Potansiyel)
9. Country Wars
Leaderboard'a ülke sekmesi ekle:

🇹🇷 Turkey    #3   2,847h this week
🇩🇪 Germany   #4   2,654h this week
🇺🇸 USA        #1   8,234h this week

"Sen bu hafta Türkiye'ye 45h katkı yaptın"
→ /leaderboard/country endpoint zaten var
→ Reddit/Twitter'da organik viral potansiyel yüksek
10. Ghost Mode (Hayalet Rakip)
Timer çalışırken:
"You're 12 minutes behind yesterday's you 👻"

Dünkü aynı saatteki performansla karşılaştırma
→ sessions tablosundan hesaplanabilir
→ Sadece kendinle rekabet — düşük baskı, yüksek motivasyon
11. Study DNA Profil Kartı
Profile ekranına ekle:

┌─ Study DNA ──────────────────┐
│  🦉 Night Owl                │
│  🎯 Deep Focus Specialist    │
│  📐 Math Dominant            │
│                              │
│  Peak hours: 22:00-01:00     │
│  Avg session: 47 min         │
│  Superpower: Long streaks    │
└──────────────────────────────┘

[Share DNA] → paylaşılabilir kart
→ sessions tablosundan analiz edilebilir
→ Kimlik oluşturma mekanizması
12. Boss Battle (Haftalık Global Event)
Her hafta pazartesi başlar:
"⚔️ This week's Boss: 1,000,000 minutes globally"

Progress bar gerçek zamanlı:
███████░░░░░░  680,432 / 1,000,000 min

Tüm kullanıcılar birlikte çalışır
Başarılırsa herkes özel rozet alır
→ BullMQ job ile weekly event sistemi
→ Haftalık hype + email/bildirim kancası

Öncelik Sırası — Claude Code için
Bu hafta:
1. Study Receipt paylaşım kartı      (viral etki #1)
2. Timer canlı kullanıcı sayısı      (motivasyon)
3. Leaderboard kişisel konum vurgusu (engagement)

Gelecek hafta:
4. Push bildirim (streak uyarısı)    (retention #1)
5. Streak ısı haritası takvimi       (habit loop)
6. Onboarding akışı                  (churn azaltma)

Bu ay:
7. Country Wars                      (viral)
8. Ghost Mode                        (daily motivation)
9. Oda ambient ses                   (premium feature)
10. Boss Battle sistemi              (weekly event)

---

## ✅ Observability (Sentry + PostHog) — TAMAMLANDI (2026-06-04)

Sentry (crash) + PostHog (analytics) kuruldu, anahtarlar girildi, uçtan uca doğrulandı.

- **Sentry — backend (Node, EU)** ✅ canlı 500 testiyle doğrulandı
- **Sentry — mobile (React Native, EU)** ✅ kurulu
- **PostHog — backend** ✅ `user_registered` Activity'de göründü
- **PostHog — mobile** ✅ kurulu (`screen_viewed` vb.)

Anahtarlar: Fly secrets (backend) + `backend/.env` + `mobile/.env` + `eas.json` (preview/production). `.env`'ler gitignore'da, git'e girmedi. PostHog: US bölgesi (`us.i.posthog.com`).

Bu sırada bulunup düzeltilen 2 gerçek hata:
- **Sentry boşluğu** (commit 11132a4): route'lar hatayı catch edip elle 500 dönüyordu → Fastify `onError` tetiklenmiyordu → her 500 catch'ine `captureException` eklendi.
- **PostHog kaybı** (commit a537b7e): Fly auto-stop makineyi idle olunca durdurduğundan batch'lenen event'ler flush edilmeden kayboluyordu → `flushAt: 1` ile her event anında gönderiliyor.

## ✅ Pro'ya özel Zen Modu + rozetler (2026-07-02)

"Abonelik için özel timer ekranı ve rozetler" — tamamlandı:

- **Zen Modu**: aktif seansta 🧘 butonu → tam ekran, dikkat dağıtmayan odak ekranı (animasyonlu aurora efektleri, dev saat, minimal kontroller; takılı çerçevenin renklerine uyar). Pro değilse paywall açılır (source: `zen_mode`).
- **Pro rozetleri** (3 adet, yalnızca aktif Pro aboneliğiyle kazanılır):
  - `pro_member` 👑 — Pro'ya katıl (RevenueCat webhook aktivasyonunda verilir)
  - `pro_marathon` 🚀 — Pro'yken 2 saatlik seans tamamla
  - `pro_streak_14` ⚜️ — Pro'yken 14 günlük seriye ulaş
- Profil'de Pro rozetleri altın çerçeveli + PRO etiketli; kilitliyse tıklayınca paywall (source: `pro_badge`).
- Paywall'a 3 yeni fayda satırı eklendi (Zen, animasyonlu çerçeveler, rozetler) — 10 dilde.
- Migration `008_pro_badges.sql` (badge_type CHECK genişletmesi) canlı DB'ye uygulandı ✓
