# iOS IAP — App Review bilgileri (v1.0 ile birlikte gönderilecek)

> Apple kuralı: bir uygulamanın **ilk aboneliği ve ilk consumable'ı** yeni bir uygulama
> sürümüyle birlikte submit edilmek zorunda. Bu yüzden 5 ürün de v1.0 submission'ına
> eklenecek (ASC → App Store → 1.0 → "In-App Purchases and Subscriptions").
>
> ASC app: `6788842347` · bundle `com.studysquadhq.app` · RC public key `appl_CpgcZwwowOTtnxuIHThiZWWOUBS`

## Demo hesap (App Review'a verilen)

```
testalpha1@studysquad.test
Passw0rd123
```

## Satın alma ekranlarına ulaşma yolu

| Ürün grubu | Yol |
|---|---|
| Pro abonelik (paywall) | Sign in → **Profile** tab → üstteki 👑 "StudySquad Pro" kartına dokun |
| Coin paketleri (Coin Shop) | Sign in → **Profile** tab → "Frames" mağaza bölümü → 🪙 coin bakiyesi çipine dokun |

Not: onboarding sırasında da (yeni hesapta) trial paywall'ı gösteriliyor.

## Review screenshot'ları (her ürüne zorunlu)

- **Paywall ekran görüntüsü** → `pro_monthly`, `pro_yearly` ürünlerine yüklenir
- **Coin Shop ekran görüntüsü** → `coins_1000`, `coins_5500`, `coins_12000` ürünlerine yüklenir

Kullanıcı cihazdan (TestFlight) çekip ASC'ye sürükler; Claude'un `file_upload` aracı disk
yolu kabul etmiyor.

## Review Notes metinleri (ASC'ye kopyala-yapıştır, İngilizce)

### pro_monthly
```
StudySquad Pro — monthly auto-renewing subscription.

How to reach the purchase screen:
1. Sign in with the demo account (testalpha1@studysquad.test / Passw0rd123).
2. Open the "Profile" tab (last tab).
3. Tap the "StudySquad Pro" card at the top of the screen.
4. The paywall opens; select "Monthly" and tap the subscribe button.

Pro unlocks: unlimited study subjects (free tier is limited to 8), streak freeze,
Zen focus mode, animated timer frames and Pro-only badges.

Subscription length and price are shown on the paywall, together with tappable
Terms of Use and Privacy Policy links and a "Restore purchases" action.
Purchases are handled through RevenueCat.
```

### pro_yearly
```
StudySquad Pro — yearly auto-renewing subscription (1 year, paid upfront).

How to reach the purchase screen:
1. Sign in with the demo account (testalpha1@studysquad.test / Passw0rd123).
2. Open the "Profile" tab (last tab).
3. Tap the "StudySquad Pro" card at the top of the screen.
4. The paywall opens; the yearly plan is preselected — tap the subscribe button.

Same Pro entitlement as the monthly plan (unlimited subjects, streak freeze, Zen
mode, animated frames, Pro badges) at a discounted yearly price. The paywall shows
the price, the subscription length, the auto-renewal notice, Terms of Use and
Privacy Policy links, and a "Restore purchases" action.
```

### coins_1000 / coins_5500 / coins_12000
```
Consumable coin pack (1,000 / 5,500 / 12,000 coins).

Coins are the in-app cosmetic currency. They are also earned for free by
completing focus sessions; this pack is an optional shortcut.

How to reach the purchase screen:
1. Sign in with the demo account (testalpha1@studysquad.test / Passw0rd123).
2. Open the "Profile" tab (last tab).
3. Scroll to the "Frames" shop section and tap the coin balance chip (🪙) in its header.
4. The Coin Shop opens with the three coin packs.

Coins are spent on cosmetic timer frames, avatars and virtual pets. They have no
cash value, cannot be transferred between accounts and are not refundable.
```

## Submission checklist (v1.0)

- [ ] Build **23** (yasal linkler dahil) ASC'de işlendi ve versiyona bağlandı
- [ ] 5 IAP ürününe review screenshot + review notes eklendi
- [ ] 5 IAP ürünü "1.0" submission'ına eklendi (version sayfası)
- [ ] App Privacy yayında (Faz 28'de yapıldı ✓)
- [ ] Age rating 13+ (Faz 28 ✓), Pricing Free + 175 ülke (✓)
- [ ] EN + TR metinler ve 8+8 ekran görüntüsü yerinde (Faz 28–30 ✓)
- [ ] Sign-in demo hesabı + telefon/iletişim bilgisi dolu (✓)
- [ ] **Add for Review → Submit** (yayın: Automatically release)
