// StudySquad App Store kareleri — "Nebula" pazarlama çerçevesi v2
// Koyu uzay + yıldız alanı + yörünge/kuyruklu yıldız imzası + eğik telefon mockup'ı
// ⚠️ EN seti için ÇALIŞTIRMA — en/ + en/6p5 artık compose-en.js ile üretiliyor
//    (telefon içerikleri İngilizce HTML rebuild, 8 kare). Bu script'in 'en' çıktıları BAYAT.
// ⚠️ TR seti için de ÇALIŞTIRMA — tr/ + tr/6p5 artık compose-tr.js ile üretiliyor
//    (translate-tr.js -> screens-tr -> render-tr.ps1 -> compose-tr.js, 8 kare).
//    Bu dosya yalnızca arşiv/referans: eski 7 kare gerçek ekran görüntülerinden üretiliyordu.
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const IMG = 'C:/Users/alper/Desktop/FocusArena/images';
const ROOT = 'C:/Users/alper/Desktop/FocusArena/docs/app-store/screenshots';

const CW = 1290, CH = 2796;
const SW = 1080, SH = Math.round(2048 / 945 * SW); // 2341 (tüm kaynaklar aynı oran)
const SX = (CW - SW) / 2, SY = 640;
const R = 64, BEZ = 18, TILT = -3;

// deterministik yıldız alanı
const stars = [];
let seed = 42;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
for (let i = 0; i < 46; i++) {
  stars.push({ x: Math.round(rnd() * CW), y: Math.round(rnd() * 560 + rnd() * rnd() * 2200),
    r: (rnd() * 1.8 + 0.7).toFixed(1), o: (rnd() * 0.5 + 0.15).toFixed(2) });
}

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

function svgFrame(png64, f) {
  const starDots = stars.map(s =>
    `<circle cx="${s.x}" cy="${s.y}" r="${s.r}" fill="#DCE9FF" opacity="${s.o}"/>`).join('');
  const line = segs => segs.map(s =>
    `<tspan xml:space="preserve" fill="${s.accent ? 'url(#tg)' : '#F8FAFC'}">${esc(s.t)}</tspan>`).join('');
  const lines = f.title.map((segs, i) =>
    `<text x="${CW / 2}" y="${300 + i * 122}" font-family="Segoe UI Black, Segoe UI, Arial"
       font-size="104" font-weight="900" text-anchor="middle"
       letter-spacing="-1">${line(segs)}</text>`).join('');
  const cx = CW / 2, cy = SY + SH / 2;
  return `<svg width="${CW}" height="${CH}" xmlns="http://www.w3.org/2000/svg"
     xmlns:xlink="http://www.w3.org/1999/xlink">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#080C1A"/>
      <stop offset="0.5" stop-color="#0C1226"/>
      <stop offset="1" stop-color="#141B3A"/>
    </linearGradient>
    <radialGradient id="glowC" cx="0.5" cy="0.36" r="0.62">
      <stop offset="0" stop-color="#22D3EE" stop-opacity="0.22"/>
      <stop offset="1" stop-color="#22D3EE" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glowV" cx="0.5" cy="1" r="0.8">
      <stop offset="0" stop-color="#8B5CF6" stop-opacity="0.25"/>
      <stop offset="1" stop-color="#8B5CF6" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="tg" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#22D3EE"/>
      <stop offset="1" stop-color="#A78BFA"/>
    </linearGradient>
    <linearGradient id="orb" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#22D3EE" stop-opacity="0"/>
      <stop offset="1" stop-color="#22D3EE" stop-opacity="0.6"/>
    </linearGradient>
    <clipPath id="scr"><rect x="${SX}" y="${SY}" width="${SW}" height="${SH}" rx="${R}"/></clipPath>
  </defs>
  <rect width="${CW}" height="${CH}" fill="url(#bg)"/>
  <rect width="${CW}" height="${CH}" fill="url(#glowC)"/>
  <rect width="${CW}" height="${CH}" fill="url(#glowV)"/>
  ${starDots}
  <!-- eyebrow -->
  <rect x="${CW / 2 - f.eyeW / 2}" y="118" width="${f.eyeW}" height="58" rx="29"
        fill="#22D3EE" fill-opacity="0.08" stroke="#22D3EE" stroke-opacity="0.35"/>
  <text x="${CW / 2}" y="158" font-family="Segoe UI Semibold, Segoe UI, Arial" font-size="30"
        font-weight="600" fill="#67E8F9" text-anchor="middle" letter-spacing="6">${esc(f.eyebrow)}</text>
  ${lines}
  <text x="${CW / 2}" y="${300 + f.title.length * 122 - 30}" font-family="Segoe UI, Arial"
        font-size="46" fill="#8FA3BF" text-anchor="middle">${esc(f.subtitle)}</text>
  <!-- yörünge + kuyruklu yıldız (telefonun arkasında) -->
  <g opacity="0.9">
    <ellipse cx="${cx}" cy="${cy - 60}" rx="820" ry="300" fill="none"
             stroke="url(#orb)" stroke-width="3" transform="rotate(-14 ${cx} ${cy - 60})"/>
  </g>
  <!-- kuyruklu yıldız (sol üst yıldız alanı) -->
  <g opacity="0.95">
    <line x1="52" y1="132" x2="172" y2="212" stroke="url(#orb)" stroke-width="4"
          stroke-linecap="round"/>
    <circle cx="172" cy="212" r="22" fill="#22D3EE" opacity="0.22"/>
    <circle cx="172" cy="212" r="10" fill="#22D3EE" opacity="0.6"/>
    <circle cx="172" cy="212" r="4.5" fill="#FFFFFF"/>
  </g>
  <circle cx="${cx}" cy="${cy}" r="900" fill="url(#glowC)" opacity="0.5"/>
  <!-- telefon -->
  <g transform="rotate(${TILT} ${cx} ${cy})">
    <rect x="${SX - BEZ}" y="${SY - BEZ}" width="${SW + BEZ * 2}" height="${SH + BEZ * 2}"
          rx="${R + BEZ}" fill="#05070D" stroke="#33436B" stroke-width="3"/>
    <image xlink:href="data:image/png;base64,${png64}" x="${SX}" y="${SY}"
           width="${SW}" height="${SH}" clip-path="url(#scr)"/>
  </g>
</svg>`;
}

const shots = [
  { src: 'IMG_7201.PNG', out: '01-timer.png',
    tr: { eyebrow: 'ODAK SAYACI', eyeW: 420,
      title: [[{ t: 'Arkadaşlarınla' }], [{ t: 'ders çalış', accent: true }]],
      subtitle: 'Pomodoro döngüleri ve kilit ekranında canlı sayaç' },
    en: { eyebrow: 'FOCUS TIMER', eyeW: 380,
      title: [[{ t: 'Study with' }], [{ t: 'your friends', accent: true }]],
      subtitle: 'Pomodoro cycles and a live lock-screen countdown' } },
  { src: 'WhatsApp Image 2026-07-13 at 19.45.06 (1).jpeg', out: '02-home.png',
    tr: { eyebrow: 'GÜNLÜK HEDEF', eyeW: 440,
      title: [[{ t: 'Hedef koy,' }], [{ t: 'serini yakala', accent: true }]],
      subtitle: 'Günlük hedef, haftalık challenge ve evcil dostun' },
    en: { eyebrow: 'DAILY GOALS', eyeW: 380,
      title: [[{ t: 'Set goals,' }], [{ t: 'keep your streak', accent: true }]],
      subtitle: 'Daily goals, weekly challenges and your study pet' } },
  { src: 'WhatsApp Image 2026-07-13 at 19.45.05 (8).jpeg', out: '03-leaderboard.png',
    tr: { eyebrow: 'SIRALAMA', eyeW: 340,
      title: [[{ t: 'Sıralamada' }], [{ t: 'yüksel', accent: true }]],
      subtitle: 'Küresel lig ve arkadaş yarışı — her dakika puan' },
    en: { eyebrow: 'LEADERBOARDS', eyeW: 420,
      title: [[{ t: 'Climb the' }], [{ t: 'rankings', accent: true }]],
      subtitle: 'Global league and friend races — every minute scores' } },
  { src: 'WhatsApp Image 2026-07-13 at 19.45.05 (3).jpeg', out: '04-stats.png',
    tr: { eyebrow: 'İSTATİSTİKLER', eyeW: 460,
      title: [[{ t: 'Her dakikan' }], [{ t: 'kayıtta', accent: true }]],
      subtitle: 'Konu bazlı dağılım ve seans istatistikleri' },
    en: { eyebrow: 'STATISTICS', eyeW: 360,
      title: [[{ t: 'Every minute' }], [{ t: 'counted', accent: true }]],
      subtitle: 'Subject breakdown and session statistics' } },
  { src: 'WhatsApp Image 2026-07-13 at 19.45.05 (4).jpeg', out: '05-calendar.png',
    tr: { eyebrow: 'AYLIK TAKVİM', eyeW: 440,
      title: [[{ t: 'Ayını' }], [{ t: 'tek bakışta', accent: true }, { t: ' gör' }]],
      subtitle: 'Gün gün odak takvimi ve konu kırılımı' },
    en: { eyebrow: 'MONTHLY CALENDAR', eyeW: 520,
      title: [[{ t: 'Your month' }], [{ t: 'at a glance', accent: true }]],
      subtitle: 'Day-by-day focus calendar with subject breakdown' } },
  { src: 'WhatsApp Image 2026-07-13 at 19.45.05 (2).jpeg', out: '06-store.png',
    tr: { eyebrow: 'ÖDÜLLER', eyeW: 320,
      title: [[{ t: 'Coin kazan,' }], [{ t: 'dostunu büyüt', accent: true }]],
      subtitle: 'Sayaç çerçeveleri ve evrilen evcil hayvanlar' },
    en: { eyebrow: 'REWARDS', eyeW: 320,
      title: [[{ t: 'Earn coins,' }], [{ t: 'grow your pet', accent: true }]],
      subtitle: 'Timer frames and evolving study pets' } },
  { src: 'IMG_7203.PNG', out: '07-receipt.png',
    patch: { left: 0, top: 86, width: 270, height: 60, color: '#050508' },
    tr: { eyebrow: 'STUDY RECEIPT', eyeW: 460,
      title: [[{ t: 'Bitir, puanla,' }], [{ t: 'paylaş', accent: true }]],
      subtitle: 'Her seansa 0-100 Odak Skoru, XP ve coin' },
    en: { eyebrow: 'STUDY RECEIPT', eyeW: 460,
      title: [[{ t: 'Finish, score,' }], [{ t: 'share', accent: true }]],
      subtitle: 'Every session earns a 0-100 Focus Score, XP and coins' } },
];

(async () => {
  for (const lang of ['tr', 'en']) {
    const OUT = path.join(ROOT, lang), OUT65 = path.join(ROOT, lang, '6p5');
    fs.mkdirSync(OUT, { recursive: true });
    fs.mkdirSync(OUT65, { recursive: true });
    for (const s of shots) {
      let base = sharp(path.join(IMG, s.src));
      if (s.patch) {
        const p = s.patch;
        const rect = Buffer.from(`<svg width="${p.width}" height="${p.height}"
          xmlns="http://www.w3.org/2000/svg"><rect width="${p.width}" height="${p.height}"
          fill="${p.color}"/></svg>`);
        base = sharp(await base.composite([{ input: rect, left: p.left, top: p.top }]).toBuffer());
      }
      const png64 = (await base.resize(SW, SH, { fit: 'fill' }).png().toBuffer()).toString('base64');
      const master = await sharp(Buffer.from(svgFrame(png64, s[lang]))).png().toBuffer();
      fs.writeFileSync(path.join(OUT, s.out), master);
      await sharp(master).resize(1284, 2778, { fit: 'fill' }).png().toFile(path.join(OUT65, s.out));
      console.log('done', lang, s.out);
    }
  }
})();
