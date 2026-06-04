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



1. Sentry: 2 proje aç → Node (backend) + React Native (mobile), DSN'leri al.                                                                                                                                            
    2. PostHog: 1 proje aç (cloud us/eu), Project API Key + host al.                                                                                                                                                       
    3. Anahtarları bana ver → backend için fly secrets set …, mobile .env + EAS env'i ben dolduruyorum. bu adımları nasıl yapacağım                                                                                        
    
● Tamamı tarayıcıdan, ücretsiz planlarla yapılıyor. Adım adım:

  1) Sentry — 2 proje

  1. sentry.io → Get Started / Sign up (GitHub veya Google ile hızlı; ücretsiz "Developer" planı yeterli).
  2. İlk açılışta bir organization ister → bir isim ver (örn. focusarena).
  3. Backend projesi:
    - Create Project (veya Projects → Create Project).
    - Platform listesinden Node.js seç.
    - Proje adı: focusarena-backend → Create Project.
    - Açılan "Configure" ekranında DSN görünür (https://...@o....ingest.sentry.io/...). Bunu kopyala. → DSN #1
  4. Mobil projesi:
    - Tekrar Create Project → platform React Native → ad focusarena-mobile → Create.
    - Yine DSN'i kopyala. → DSN #2

  ▎ DSN'i sonradan bulmak istersen: Settings → Projects → [proje] → Client Keys (DSN).

  2) PostHog — 1 proje

  1. posthog.com → Get started for free / Sign up.
  2. Bölge sorar: US mu EU mu? Birini seç ve aklında tut:
    - US seçersen host = https://us.i.posthog.com
    - EU seçersen host = https://eu.i.posthog.com
  3. Kayıt sonrası otomatik bir proje oluşur. Project API Key'i al:
    - Settings (sol altta) → Project → Project API Key (veya açılış ekranındaki kurulum snippet'inde görünür).
    - phc_ ile başlar. → PostHog Key

  3) Bana getireceğin 4 değer

  Sentry backend DSN  : https://...ingest.sentry.io/...
  Sentry mobile DSN   : https://...ingest.sentry.io/...
  PostHog Project Key : phc_...
  PostHog host        : https://us.i.posthog.com   (veya eu)

  Bunları yapıştır, gerisini ben hallederim:
  - Backend → fly secrets set SENTRY_DSN=… POSTHOG_KEY=… POSTHOG_HOST=… (Fly otomatik yeniden başlatır)
  - Mobil → mobile/.env + EAS env

  ---
  İki küçük not:
  - Sentry'de DSN gizli değildir (zaten istemciye gömülüyor), rahatça paylaşabilirsin. PostHog Project API Key de istemci-tarafı anahtardır, paylaşması güvenli — asıl gizli olan "Personal API Key"i değil, onu
  istemiyorum.
  - Acele etmene gerek yok; anahtarlar olmadan da uygulama sorunsuz çalışıyor. Hazır olunca yapıştırman yeterli.
