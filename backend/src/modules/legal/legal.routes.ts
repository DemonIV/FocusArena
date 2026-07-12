/**
 * Legal pages — Privacy Policy & Terms of Service.
 * Served as static HTML so the app stores have a public URL to point at
 * (App Store Connect / Play Console both require a privacy policy URL).
 * English first, Turkish below on the same page.
 */
import type { FastifyInstance } from 'fastify';

const EFFECTIVE_DATE = 'July 12, 2026';
const CONTACT_EMAIL = 'alperentorun334@gmail.com';
const APP_NAME = 'StudySquad';

function page(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} — ${APP_NAME}</title>
<style>
  :root { color-scheme: light dark; }
  body { margin: 0 auto; max-width: 720px; padding: 32px 20px 80px;
         font-family: -apple-system, "Segoe UI", Roboto, sans-serif;
         line-height: 1.65; color: #1e293b; background: #ffffff; }
  @media (prefers-color-scheme: dark) {
    body { color: #e2e8f0; background: #0d0d1a; }
    a { color: #00d2ff; }
  }
  h1 { font-size: 28px; margin-bottom: 4px; }
  h2 { font-size: 20px; margin-top: 36px; }
  h3 { font-size: 16px; margin-top: 24px; }
  .meta { color: #64748b; font-size: 14px; margin-bottom: 28px; }
  hr { border: none; border-top: 1px solid #64748b44; margin: 48px 0; }
  ul { padding-left: 22px; }
  li { margin: 6px 0; }
</style>
</head>
<body>
${body}
</body>
</html>`;
}

const PRIVACY_HTML = page('Privacy Policy', `
<h1>Privacy Policy</h1>
<p class="meta">${APP_NAME} · Effective date: ${EFFECTIVE_DATE} · <a href="#tr">Türkçe için tıklayın</a></p>

<p>${APP_NAME} ("we", "us") is a study-focus app that lets you track focus sessions and
compete with friends. This policy explains what we collect, why, and your choices.</p>

<h2>What we collect</h2>
<ul>
  <li><b>Account data</b> — email address, username and a securely hashed password when you register.</li>
  <li><b>Study activity</b> — focus sessions (duration, chosen subject, focus quality metrics),
      streaks, XP/level, in-app coins, badges, titles and cosmetic items you own.</li>
  <li><b>Social data</b> — friends, study rooms you join, invite codes you redeem, and your
      position on leaderboards. Your <b>username, level and study minutes are visible to other
      users</b> on leaderboards, in rooms and to your friends. Day-by-day statistics are visible
      only to friends you have accepted.</li>
  <li><b>Country & timezone</b> — an optional country code (from your device locale) for country
      leaderboards, and your UTC offset so streaks reset at your local midnight.</li>
  <li><b>Push token</b> — if you enable notifications, an Expo push token. You can turn
      notifications off in your device settings or in the app's profile settings.</li>
  <li><b>Usage analytics</b> — anonymous-by-default product events (screens used, features tapped)
      via PostHog, and crash reports via Sentry, so we can fix bugs and improve the app.</li>
</ul>

<h2>What we do NOT collect</h2>
<ul>
  <li>No contacts, no location (beyond the country code above), no microphone/camera access.</li>
  <li>No payment card data — purchases are processed entirely by Apple App Store / Google Play
      and RevenueCat; we only learn that a purchase succeeded.</li>
  <li>No advertising identifiers; the app contains no third-party ads.</li>
</ul>

<h2>How we use data</h2>
<p>To run the service (timers, streaks, leaderboards, rooms, notifications), to prevent abuse,
and to understand aggregate usage so we can improve the product. We do <b>not sell</b> your
personal data and we do not share it with advertisers.</p>

<h2>Where data lives</h2>
<p>Our backend runs on Fly.io; the database is Supabase (PostgreSQL) and session state is
stored in Upstash Redis. Analytics are processed by PostHog (US) and crash reports by
Sentry (EU). Each provider processes data on our behalf under their own security terms.</p>

<h2>Data retention & deletion</h2>
<p>Your data is kept while your account exists. You can <b>delete your account at any time in
the app</b> (Profile → Delete account). Deletion is immediate and permanent: your account row is
removed and all linked data (sessions, friendships, rooms, purchases metadata) is deleted with
it. You can also email us at <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a> to request
deletion, access or correction of your data.</p>

<h2>Children</h2>
<p>${APP_NAME} is not directed at children under 13, and we do not knowingly collect personal
data from children under 13. If you believe a child under 13 has created an account, contact us
and we will delete it.</p>

<h2>Changes</h2>
<p>If we materially change this policy we will update this page and the effective date, and
notify you in the app where appropriate.</p>

<h2>Contact</h2>
<p><a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a></p>

<hr id="tr">

<h1>Gizlilik Politikası</h1>
<p class="meta">${APP_NAME} · Yürürlük tarihi: 12 Temmuz 2026</p>

<p>${APP_NAME}, odak seanslarını takip edip arkadaşlarınla yarışmanı sağlayan bir ders çalışma
uygulamasıdır. Bu politika neyi, neden topladığımızı ve seçeneklerini açıklar.</p>

<h2>Topladıklarımız</h2>
<ul>
  <li><b>Hesap verisi</b> — kayıt olurken e-posta, kullanıcı adı ve güvenli şekilde
      hash'lenmiş şifre.</li>
  <li><b>Çalışma aktivitesi</b> — odak seansları (süre, konu, odak kalitesi metrikleri), seri
      (streak), XP/seviye, uygulama içi coin, rozet, ünvan ve sahip olduğun kozmetikler.</li>
  <li><b>Sosyal veri</b> — arkadaşlar, katıldığın odalar, kullandığın davet kodları ve
      liderlik tablosundaki konumun. <b>Kullanıcı adın, seviyen ve çalışma dakikaların diğer
      kullanıcılara görünür</b> (liderlik tabloları, odalar, arkadaşlar). Gün gün istatistikler
      yalnızca kabul ettiğin arkadaşlara görünür.</li>
  <li><b>Ülke ve saat dilimi</b> — ülke liderlik tablosu için cihaz dilinden alınan isteğe
      bağlı ülke kodu; serilerin yerel gece yarısında sıfırlanması için UTC farkın.</li>
  <li><b>Push token</b> — bildirimleri açarsan Expo push token'ı. Bildirimleri cihaz
      ayarlarından veya uygulamadaki profil ayarlarından kapatabilirsin.</li>
  <li><b>Kullanım analitiği</b> — ürünü iyileştirmek için PostHog üzerinden ürün olayları ve
      Sentry üzerinden çökme raporları.</li>
</ul>

<h2>Toplamadıklarımız</h2>
<ul>
  <li>Rehber, konum (yukarıdaki ülke kodu dışında), mikrofon/kamera erişimi YOK.</li>
  <li>Ödeme kartı verisi YOK — satın almalar tamamen App Store / Google Play ve RevenueCat
      tarafından işlenir; biz yalnızca satın almanın başarılı olduğunu görürüz.</li>
  <li>Reklam kimliği YOK; uygulamada üçüncü taraf reklam yoktur.</li>
</ul>

<h2>Verini nasıl kullanıyoruz</h2>
<p>Servisi çalıştırmak (sayaç, seri, liderlik tabloları, odalar, bildirimler), kötüye
kullanımı önlemek ve toplu kullanımı anlayıp ürünü iyileştirmek için. Kişisel verini
<b>satmayız</b>, reklamverenlerle paylaşmayız.</p>

<h2>Veri nerede tutuluyor</h2>
<p>Backend Fly.io üzerinde çalışır; veritabanı Supabase (PostgreSQL), oturum durumu Upstash
Redis'tedir. Analitik PostHog (ABD), çökme raporları Sentry (AB) tarafından işlenir.</p>

<h2>Saklama ve silme</h2>
<p>Verin hesabın var olduğu sürece saklanır. <b>Hesabını istediğin an uygulama içinden
silebilirsin</b> (Profil → Hesabı sil). Silme anında ve kalıcıdır; hesabına bağlı tüm veriler
birlikte silinir. Silme, erişim veya düzeltme talebi için
<a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a> adresine de yazabilirsin.</p>

<h2>Çocuklar</h2>
<p>${APP_NAME} 13 yaş altı çocuklara yönelik değildir; 13 yaş altından bilerek veri toplamayız.
13 yaş altı bir çocuğun hesap açtığını düşünüyorsan bize ulaş, hesabı silelim.</p>

<h2>İletişim</h2>
<p><a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a></p>
`);

const TERMS_HTML = page('Terms of Service', `
<h1>Terms of Service</h1>
<p class="meta">${APP_NAME} · Effective date: ${EFFECTIVE_DATE} · <a href="#tr">Türkçe için tıklayın</a></p>

<p>By creating an account or using ${APP_NAME} you agree to these terms.</p>

<h2>1. The service</h2>
<p>${APP_NAME} is a study-focus timer with social features: focus sessions, streaks,
leaderboards, study rooms, friends and cosmetic collectibles. We may add, change or remove
features as the product evolves.</p>

<h2>2. Eligibility & accounts</h2>
<p>You must be at least 13 years old. You are responsible for your account credentials and for
everything done with your account. One account per person; accounts may not be sold or shared.</p>

<h2>3. Fair play & acceptable use</h2>
<ul>
  <li>No falsifying study data (automation, tampering with requests, exploiting bugs) —
      leaderboards only work if the numbers are honest. We may reset stats or suspend accounts
      involved in manipulation.</li>
  <li>No offensive, impersonating or misleading usernames or room names.</li>
  <li>No harassment of other users. You can block other users in the app; blocked users cannot
      interact with you.</li>
  <li>No attempts to disrupt or reverse-engineer the service.</li>
</ul>

<h2>4. Virtual items</h2>
<p>Coins, pets, frames, badges and other virtual items have <b>no real-world monetary value</b>,
are non-transferable and cannot be exchanged for money. Purchases of virtual items are processed
by Apple App Store / Google Play; refunds follow the relevant store's policy. We may adjust the
in-app economy (prices, earn rates) to keep it fair.</p>

<h2>5. Subscriptions</h2>
<p>Optional Pro subscriptions (where offered) renew automatically until cancelled in your App
Store / Google Play account settings. Prices are shown before purchase. Store refund policies
apply.</p>

<h2>6. Termination</h2>
<p>You can delete your account at any time in the app (Profile → Delete account). We may suspend
or terminate accounts that violate these terms, with notice where practical.</p>

<h2>7. Disclaimers & liability</h2>
<p>The service is provided "as is", without warranties of uninterrupted availability or data
loss prevention. To the maximum extent permitted by law, our total liability is limited to the
amount you paid us in the 12 months before the claim.</p>

<h2>8. Changes & governing law</h2>
<p>We may update these terms; material changes will be announced in the app. These terms are
governed by the laws of the Republic of Türkiye. Contact:
<a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a></p>

<hr id="tr">

<h1>Kullanım Şartları</h1>
<p class="meta">${APP_NAME} · Yürürlük tarihi: 12 Temmuz 2026</p>

<p>Hesap oluşturarak veya ${APP_NAME}'i kullanarak bu şartları kabul etmiş olursun.</p>

<h2>1. Servis</h2>
<p>${APP_NAME}; odak seansları, seriler, liderlik tabloları, çalışma odaları, arkadaşlar ve
kozmetik koleksiyon öğeleri içeren sosyal bir ders çalışma sayacıdır. Ürün geliştikçe özellik
ekleyebilir, değiştirebilir veya kaldırabiliriz.</p>

<h2>2. Uygunluk ve hesaplar</h2>
<p>En az 13 yaşında olmalısın. Hesap bilgilerinden ve hesabınla yapılan her şeyden sen
sorumlusun. Kişi başı bir hesap; hesaplar satılamaz veya paylaşılamaz.</p>

<h2>3. Adil oyun ve kabul edilebilir kullanım</h2>
<ul>
  <li>Çalışma verisini tahrif etmek yok (otomasyon, istek manipülasyonu, bug istismarı) —
      liderlik tabloları ancak sayılar dürüstse çalışır. Manipülasyona karışan hesapların
      istatistiklerini sıfırlayabilir veya hesabı askıya alabiliriz.</li>
  <li>Saldırgan, taklit eden veya yanıltıcı kullanıcı adı / oda adı yok.</li>
  <li>Diğer kullanıcılara taciz yok. Uygulamada kullanıcı engelleyebilirsin; engellenen
      kullanıcı seninle etkileşemez.</li>
  <li>Servisi bozmaya veya tersine mühendisliğe teşebbüs yok.</li>
</ul>

<h2>4. Sanal öğeler</h2>
<p>Coin, evcil hayvan, çerçeve, rozet ve diğer sanal öğelerin <b>gerçek dünyada parasal değeri
yoktur</b>; devredilemez ve paraya çevrilemez. Satın almalar App Store / Google Play tarafından
işlenir; iadeler ilgili mağazanın politikasına tabidir.</p>

<h2>5. Abonelikler</h2>
<p>(Sunulduğu yerde) isteğe bağlı Pro abonelikleri, mağaza hesabından iptal edilene kadar
otomatik yenilenir. Fiyatlar satın almadan önce gösterilir.</p>

<h2>6. Fesih</h2>
<p>Hesabını istediğin an uygulamadan silebilirsin (Profil → Hesabı sil). Bu şartları ihlal eden
hesapları askıya alabilir veya kapatabiliriz.</p>

<h2>7. Sorumluluk reddi</h2>
<p>Servis "olduğu gibi" sunulur; kesintisiz erişim garanti edilmez. Yasaların izin verdiği
azami ölçüde toplam sorumluluğumuz, talepten önceki 12 ayda bize ödediğin tutarla sınırlıdır.</p>

<h2>8. Değişiklikler ve uygulanacak hukuk</h2>
<p>Şartları güncelleyebiliriz; önemli değişiklikler uygulamada duyurulur. Bu şartlara Türkiye
Cumhuriyeti hukuku uygulanır. İletişim:
<a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a></p>
`);

const SUPPORT_HTML = page('Support', `
<h1>${APP_NAME} Support</h1>
<p class="meta">We usually reply within 1–2 days.</p>

<h2>Contact</h2>
<p>Email us at <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a> — bug reports, questions
and feedback are all welcome. Please include your username and device model for faster help.</p>

<h2>Common questions</h2>
<h3>How do I delete my account?</h3>
<p>In the app: Profile → Delete account. Deletion is immediate and permanent.</p>
<h3>My streak reset unexpectedly</h3>
<p>Streaks reset at your local midnight. If you believe something went wrong, email us with
your username and we will check.</p>
<h3>How do I turn off notifications?</h3>
<p>Profile → notification settings in the app, or your device's system settings.</p>

<hr>

<h1>${APP_NAME} Destek</h1>
<p>Bize <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a> adresinden ulaşabilirsin —
hata bildirimi, soru ve geri bildirim için. Kullanıcı adını ve cihaz modelini eklersen daha
hızlı yardımcı oluruz. Hesabını silmek için: Profil → Hesabı sil.</p>

<p><a href="/legal/privacy">Privacy Policy / Gizlilik Politikası</a> ·
<a href="/legal/terms">Terms of Service / Kullanım Şartları</a></p>
`);

export async function legalRoutes(fastify: FastifyInstance) {
  fastify.get('/privacy', async (_request, reply) => {
    return reply.type('text/html; charset=utf-8').send(PRIVACY_HTML);
  });
  fastify.get('/terms', async (_request, reply) => {
    return reply.type('text/html; charset=utf-8').send(TERMS_HTML);
  });
  fastify.get('/support', async (_request, reply) => {
    return reply.type('text/html; charset=utf-8').send(SUPPORT_HTML);
  });
}
