// screens-en/*.html -> screens-tr/*.html (Türkçe çeviri)
// Sıra: dosyaya özel çiftler -> global çiftler -> regex'ler (saat/virgül formatı)
const fs = require('fs');
const path = require('path');

const ROOT = 'C:/Users/alper/Desktop/FocusArena/docs/app-store/screenshots';
const SRC = path.join(ROOT, 'screens-en');
const DST = path.join(ROOT, 'screens-tr');

const globalPairs = [
  ['group="Store Screens EN"', 'group="Store Screens TR"'],
  ['<html lang="en">', '<html lang="tr">'],
  // tab bar
  ['</span>Home</div>', '</span>Ana Sayfa</div>'],
  ['</span>Timer</div>', '</span>Zamanlayıcı</div>'],
  ['</span>Ranks</div>', '</span>Sıralama</div>'],
  ['</span>Rooms</div>', '</span>Odalar</div>'],
  ['</span>Friends</div>', '</span>Arkadaşlar</div>'],
  ['</span>Profile</div>', '</span>Profil</div>'],
  // başlıklar
  ['<div class="hdr">Rooms</div>', '<div class="hdr">Odalar</div>'],
  ['<div class="hdr">Timer</div>', '<div class="hdr">Zamanlayıcı</div>'],
  ['<div class="hdr">Leaderboard</div>', '<div class="hdr">Sıralama</div>'],
  ['<div class="hdr">Profile</div>', '<div class="hdr">Profil</div>'],
  // konular + kişiler (baş harfler eşleşsin diye seçildi)
  ['Math', 'Matematik'], ['Physics', 'Fizik'], ['Biology', 'Biyoloji'],
  ['Maya', 'Melis'], ['Emma', 'Elif'], ['Kenji', 'Kerem'],
  ['Sofia', 'Selin'], ['Liam', 'Lale'], ['Noah', 'Nehir'], ['Ava', 'Asya'],
  ['(You)', '(Sen)'],
];

const regexes = [
  [/(\d+)h (\d+)m/g, '$1sa $2dk'],   // 4h 12m -> 4sa 12dk
  // 1,240 -> 1.240 — yalnız serbest sayılar; rgba(248,113,113,…) gibi CSS'e dokunmaz
  [/(?<![\d.,(])(\d{1,3}),(\d{3})(?!\d)/g, '$1.$2'],
];

const perFile = {
  '01-rooms.html': [
    ['+ Create Room', '+ Oda Kur'],
    ['🔗 Join with Code', '🔗 Kodla Katıl'],
    ['Finals Squad', 'YKS Ekibi'],
    ['👑 Owner', '👑 Sahip'],
    ['👥 6/10 · Tap for details', '👥 6/10 · Detay için dokun'],
    ['>Delete<', '>Sil<'],
    ['🔒 Private', '🔒 Gizli'],
    ['INVITE CODE', 'DAVET KODU'],
    ['Library focus today:', 'Kütüphane odağı bugün:'],
    ['>MEMBERS<', '>ÜYELER<'],
    ['focusing now', 'şu an odakta'],
    ['</span>online</div>', '</span>çevrimiçi</div>'],
    ['💤 offline', '💤 çevrimdışı'],
    ['>47m<', '>47dk<'],
  ],
  '02-timer.html': [
    ['Focus Timer', 'Odak Zamanlayıcı'],
    ['Zen Mode', 'Zen Modu'],
    ['>DURATION<', '>SÜRE<'], ['>ELAPSED<', '>GEÇEN<'], ['>LEFT<', '>KALAN<'],
    ['>45m<', '>45dk<'], ['>23m<', '>23dk<'], ['>22m<', '>22dk<'],
    ['⏸️ Pause', '⏸️ Duraklat'], ['⏹️ Finish', '⏹️ Bitir'],
    ['>FOCUSING<', '>ODAKTA<'],
  ],
  '03-home.html': [
    ['Welcome back,', 'Tekrar hoş geldin,'],
    ['>Lv 12<', '>Sv 12<'],
    ['Sparkle', 'Pırıltı'], ['>Baby<', '>Yavru<'],
    ['1h 20m of focus until it evolves', 'Büyümesine 1sa 20dk odak kaldı'],
    ['Weekly Challenge', 'Haftalık Challenge'],
    ['6d 4h left', '6g 4sa kaldı'],
    ['/ 2,100 min', '/ 2.100 dk'],
    ['Complete the weekly goal', 'Haftalık hedefi tamamla'],
    ['DAILY GOAL', 'GÜNLÜK HEDEF'],
    ['/ 5h<', '/ 5sa<'],
    ["TODAY'S STATS", 'BUGÜNÜN İSTATİSTİKLERİ'],
    ['>SESSIONS<', '>OTURUM<'], ['>FOCUS TIME<', '>ODAK SÜRESİ<'], ['>STREAK<', '>SERİ<'],
    ['🛡️ Protect your 12-day streak', '🛡️ 12 günlük serini koru'],
  ],
  '04-leaderboard.html': [
    ['🏆 Players', '🏆 Oyuncular'], ['🌍 Countries', '🌍 Ülkeler'],
    ['>Today<', '>Bugün<'], ['>Week<', '>Hafta<'], ['>Month<', '>Ay<'], ['>All Time<', '>Tümü<'],
    ['GLOBAL RANK', 'KÜRESEL SIRAN'],
    ["🏆 You're #3!", '🏆 3. sıradasın!'],
    ['GLOBAL TOP 10', 'KÜRESEL İLK 10'],
    ['maya_studies', 'melis_ders'],
  ],
  '05-stats.html': [
    ['Monthly stats and subjects', 'Aylık istatistikler ve konular'],
    ['STUDY BREAKDOWN', 'ÇALIŞMA DAĞILIMI'],
    ['Total focus', 'Toplam odak'],
    ['>STATISTICS<', '>İSTATİSTİKLER<'],
    ['>TOTAL SESSIONS<', '>TOPLAM OTURUM<'], ['>FOCUS TIME<', '>ODAK SÜRESİ<'],
    ['>COMPLETED<', '>TAMAMLANAN<'], ['>AVG LENGTH<', '>ORT. SÜRE<'],
    ['MY SUBJECTS', 'KONULARIM'], ['+ Add', '+ Ekle'],
    ['· 12 sessions', '· 12 oturum'],
  ],
  '06-calendar.html': [
    ['July 12, 2026', '12 Temmuz 2026'],
    ['July 2026', 'Temmuz 2026'],
    // hafta günleri (sıra önemli: önce Sa/Su, sonra Tu->Sa)
    ['>Sa<', '>Ct<'], ['>Su<', '>Pz<'], ['>Mo<', '>Pt<'], ['>Tu<', '>Sa<'],
    ['>We<', '>Ça<'], ['>Th<', '>Pe<'], ['>Fr<', '>Cu<'],
    ['Total focus', 'Toplam odak'], ['Active days', 'Aktif gün'], ['Best day', 'En iyi gün'],
    ['>SUBJECTS<', '>KONULAR<'],
  ],
  '07-store.html': [
    ['· 12 sessions', '· 12 oturum'], ['· 9 sessions', '· 9 oturum'],
    ['FRAME SHOP', 'ÇERÇEVE MAĞAZASI'],
    ['>Default<', '>Varsayılan<'], ['>Prism<', '>Prizma<'], ['>Royal<', '>Kraliyet<'],
    ['>Select<', '>Seç<'], ['✓ Selected', '✓ Seçili'],
    ['Every completed session earns coins equal to your XP', 'Her tamamlanan seansta XP kadar coin kazanırsın'],
    ['PET SHOP', 'EVCİL HAYVAN MAĞAZASI'],
    ['>Fox<', '>Tilki<'], ['>Owl<', '>Baykuş<'], ['>Dragon<', '>Ejderha<'],
    ['>RARE<', '>NADİR<'], ['>EPIC<', '>EPİK<'], ['>LEGENDARY<', '>EFSANEVİ<'],
    ['Your pet lives on your Home screen and appears next to your name on leaderboards',
     "Evcil dostun Ana Sayfa'nda yaşar ve sıralamada görünür"],
  ],
  '08-receipt.html': [
    ['📚 Pick a subject (optional)', '📚 Konu Seç (isteğe bağlı)'],
    ['>FOCUSED<', '>ODAKLANILDI<'],
    ['🔥 day 12', '🔥 12. gün'],
    ['Focus Score', 'Odak Skoru'],
    ['>Completion<', '>Tamamlama<'], ['>Presence<', '>Varlık<'], ['>Steadiness<', '>İstikrar<'],
    ['Global Rank: #3', 'Küresel Sıra: #3'],
    ['📤 Share', '📤 Paylaş'], ['>Close<', '>Kapat<'],
  ],
};

const replaceAll = (s, a, b) => s.split(a).join(b);

// Elle tasarlanan TR kareleri — çeviriden geçmez, üzerine YAZILMAZ.
const HANDMADE = new Set(['01-rooms.html']);

fs.mkdirSync(DST, { recursive: true });
fs.copyFileSync(path.join(SRC, '_base.css'), path.join(DST, '_base.css'));

for (const f of Object.keys(perFile)) {
  if (HANDMADE.has(f)) { console.log('atlandı (elle tasarım)', f); continue; }
  let c = fs.readFileSync(path.join(SRC, f), 'utf8');
  for (const [a, b] of perFile[f]) {
    if (!c.includes(a)) console.warn(`UYARI ${f}: bulunamadı -> ${a}`);
    c = replaceAll(c, a, b);
  }
  for (const [a, b] of globalPairs) c = replaceAll(c, a, b);
  // Sayı regex'leri SADECE gövdeye uygulanır — <style> içindeki rgba(…) bozulmasın.
  const cut = c.lastIndexOf('</style>');
  const head = cut === -1 ? '' : c.slice(0, cut);
  let body = cut === -1 ? c : c.slice(cut);
  for (const [re, b] of regexes) body = body.replace(re, b);
  fs.writeFileSync(path.join(DST, f), head + body);
  console.log('çevrildi', f);
}
