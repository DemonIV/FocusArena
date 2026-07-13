// App Store pazarlama çerçevesi üretici — repo kökünden çalıştır:
//   npm i sharp (herhangi bir geçici klasörde) && node docs/app-store/screenshots/compose.js
// Kaynak: images/ (iPhone ekran görüntüleri, 945x2048 veya 1290x2796)
// Çıktı: docs/app-store/screenshots/tr/*.png (1290x2796, ASC 6.7" seti)
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '../../..');
const IMG = path.join(ROOT, 'images');
const OUT = path.join(ROOT, 'docs/app-store/screenshots/tr');
fs.mkdirSync(OUT, { recursive: true });

const CW = 1290, CH = 2796;          // canvas (6.7" portrait)
const SW = 1060;                      // screenshot display width
const SH = Math.round(2048 / 945 * SW); // ~2297
const SX = (CW - SW) / 2, SY = 470;
const R = 56;                         // screen corner radius
const BEZ = 16;                       // bezel padding

const NBSP = String.fromCharCode(160); // keeps edge spaces from collapsing in SVG
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/^ /, NBSP).replace(/ $/, NBSP);

// title: array of {t, accent?} segments rendered as one centered line
function bgSvg(title, subtitle) {
  const segs = title.map(s =>
    `<tspan xml:space="preserve" fill="${s.accent ? '#22D3EE' : '#F8FAFC'}">${esc(s.t)}</tspan>`).join('');
  return `<svg width="${CW}" height="${CH}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#0B0F1F"/>
      <stop offset="0.55" stop-color="#0E1428"/>
      <stop offset="1" stop-color="#101B33"/>
    </linearGradient>
    <radialGradient id="glowTop" cx="0.5" cy="0" r="0.9">
      <stop offset="0" stop-color="#22D3EE" stop-opacity="0.16"/>
      <stop offset="0.6" stop-color="#22D3EE" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glowBot" cx="0.5" cy="1" r="0.9">
      <stop offset="0" stop-color="#8B5CF6" stop-opacity="0.18"/>
      <stop offset="0.65" stop-color="#8B5CF6" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${CW}" height="${CH}" fill="url(#bg)"/>
  <rect width="${CW}" height="${CH}" fill="url(#glowTop)"/>
  <rect width="${CW}" height="${CH}" fill="url(#glowBot)"/>
  <text x="${CW / 2}" y="215" font-family="Segoe UI, Arial, sans-serif" font-size="84"
        font-weight="700" text-anchor="middle">${segs}</text>
  <text x="${CW / 2}" y="330" font-family="Segoe UI, Arial, sans-serif" font-size="44"
        font-weight="400" fill="#94A3B8" text-anchor="middle">${esc(subtitle)}</text>
  <rect x="${SX - BEZ}" y="${SY - BEZ}" width="${SW + BEZ * 2}" height="${SH + BEZ * 2}"
        rx="${R + BEZ}" fill="#05070D" stroke="#2B3A5C" stroke-width="3"/>
</svg>`;
}

const maskSvg = Buffer.from(
  `<svg width="${SW}" height="${SH}" xmlns="http://www.w3.org/2000/svg">
     <rect width="${SW}" height="${SH}" rx="${R}" fill="#fff"/>
   </svg>`);

const jobs = [
  {
    src: 'IMG_7201.PNG', out: '01-timer.png',
    title: [{ t: 'Tek dokunuşla ' }, { t: 'derin odak', accent: true }],
    subtitle: 'Pomodoro döngüleri, Zen Modu ve kilit ekranı sayacı',
  },
  {
    src: 'IMG_7203.PNG', out: '07-receipt.png',
    title: [{ t: 'Bitir, puanla, ' }, { t: 'paylaş', accent: true }],
    subtitle: 'Her seansa 0-100 Odak Skoru + XP ve coin ödülleri',
    // durum çubuğundaki "< Instagram" geri-dönüş yazısını kapat
    patch: { left: 0, top: 86, width: 270, height: 60, color: '#050508' },
  },
  {
    src: 'WhatsApp Image 2026-07-13 at 19.45.06 (1).jpeg', out: '02-home.png',
    title: [{ t: 'Hedef koy, ' }, { t: 'serini yakala', accent: true }],
    subtitle: 'Günlük hedef, haftalık challenge ve evcil dostun',
  },
  {
    src: 'WhatsApp Image 2026-07-13 at 19.45.05 (8).jpeg', out: '03-leaderboard.png',
    title: [{ t: 'Arkadaşlarınla ' }, { t: 'yarış', accent: true }],
    subtitle: 'Küresel ve arkadaş sıralamaları — her dakika sayılır',
  },
  {
    src: 'WhatsApp Image 2026-07-13 at 19.45.05 (3).jpeg', out: '04-stats.png',
    title: [{ t: 'Her dakikan ' }, { t: 'kayıtta', accent: true }],
    subtitle: 'Konu bazlı dağılım ve seans istatistikleri',
  },
  {
    src: 'WhatsApp Image 2026-07-13 at 19.45.05 (4).jpeg', out: '05-calendar.png',
    title: [{ t: 'Ayını ' }, { t: 'tek bakışta', accent: true }, { t: ' gör' }],
    subtitle: 'Gün gün odak takvimi ve konu kırılımı',
  },
  {
    src: 'WhatsApp Image 2026-07-13 at 19.45.05 (2).jpeg', out: '06-store.png',
    title: [{ t: 'Coin kazan, ' }, { t: 'dostunu büyüt', accent: true }],
    subtitle: 'Çerçeve ve evcil hayvan mağazası seni bekliyor',
  },
];

(async () => {
  for (const j of jobs) {
    let base = sharp(path.join(IMG, j.src));
    if (j.patch) {
      const p = j.patch;
      const rect = Buffer.from(`<svg width="${p.width}" height="${p.height}"
        xmlns="http://www.w3.org/2000/svg"><rect width="${p.width}" height="${p.height}"
        fill="${p.color}"/></svg>`);
      base = sharp(await base.composite([{ input: rect, left: p.left, top: p.top }]).toBuffer());
    }
    const shot = await base
      .resize(SW, SH, { fit: 'fill' })
      .composite([{ input: maskSvg, blend: 'dest-in' }])
      .png().toBuffer();
    await sharp(Buffer.from(bgSvg(j.title, j.subtitle)))
      .png()
      .composite([{ input: shot, left: SX, top: SY }])
      .toFile(path.join(OUT, j.out));
    console.log('done', j.out);
  }
})();
