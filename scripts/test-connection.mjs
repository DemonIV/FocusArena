/**
 * FocusArena — Backend Connectivity Test
 * Çalıştırmak için: node scripts/test-connection.mjs
 */

const BASE_URL = 'https://focusarena.fly.dev';

const GREEN = '\x1b[32m✅';
const RED   = '\x1b[31m❌';
const YELLOW = '\x1b[33m⚠️';
const RESET  = '\x1b[0m';

async function test(name, fn) {
  try {
    const result = await fn();
    console.log(`${GREEN} ${name}${RESET}`, result !== undefined ? `→ ${JSON.stringify(result)}` : '');
    return true;
  } catch (err) {
    console.log(`${RED} ${name}${RESET}`, `→ ${err.message}`);
    return false;
  }
}

async function fetchJSON(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers ?? {}) },
    ...options,
  });
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${JSON.stringify(body)}`);
  return body;
}

console.log('\n🔍 FocusArena Backend Connectivity Test');
console.log(`📡 Target: ${BASE_URL}\n`);

// ─── 1. Health Check ───────────────────────────────────────────
console.log('── 1. Health Check ──');
const healthOk = await test('GET /health', () => fetchJSON('/health'));

if (!healthOk) {
  console.log(`\n${RED} Backend ulaşılamıyor! Olası sebepler:${RESET}`);
  console.log('  • fly.io uygulaması kapalı olabilir → fly status komutunu çalıştır');
  console.log('  • DNS çözümleme sorunu');
  console.log('  • İnternet bağlantısı yok\n');
  process.exit(1);
}

// ─── 2. Auth Endpoints ─────────────────────────────────────────
console.log('\n── 2. Auth Endpoints ──');

// Register (yeni kullanıcı — başarısız olması normal, 409 bekliyoruz)
await test('POST /auth/register (test user)', async () => {
  try {
    const res = await fetchJSON('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: `test_${Date.now()}@focusarena.test`,
        password: 'TestPass123!',
        username: `tester_${Date.now()}`,
      }),
    });
    return `user: ${res.user?.username ?? '?'}, token: ${res.accessToken ? '✓' : '✗'}`;
  } catch (e) {
    throw e;
  }
});

// Login (yanlış şifre — 401 bekliyoruz ama endpoint cevap vermeli)
await test('POST /auth/login (wrong pass → 401 expected)', async () => {
  try {
    await fetchJSON('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'nobody@example.com', password: 'wrong' }),
    });
  } catch (err) {
    if (err.message.includes('401') || err.message.includes('400')) {
      return '401/400 döndü (endpoint çalışıyor)';
    }
    throw err;
  }
});

// ─── 3. Protected Endpoint (auth guard) ────────────────────────
console.log('\n── 3. Auth Guard ──');
await test('GET /timer/status (no token → 401 expected)', async () => {
  try {
    await fetchJSON('/timer/status');
  } catch (err) {
    if (err.message.includes('401')) return '401 döndü (guard çalışıyor)';
    throw err;
  }
});

// ─── 4. Leaderboard (public?) ──────────────────────────────────
console.log('\n── 4. Leaderboard ──');
await test('GET /leaderboard/global?period=daily (no token → 401?)', async () => {
  try {
    const res = await fetchJSON('/leaderboard/global?period=daily');
    return `${res.data?.length ?? 0} entries`;
  } catch (err) {
    if (err.message.includes('401')) return '401 (auth gerekiyor)';
    throw err;
  }
});

// ─── 5. WebSocket / Socket.io endpoint ─────────────────────────
console.log('\n── 5. Socket.io ──');
await test('GET /socket.io/ (polling probe)', async () => {
  try {
    const res = await fetch(`${BASE_URL}/socket.io/?EIO=4&transport=polling`);
    const text = await res.text();
    if (res.ok || res.status === 200) return `status ${res.status}, body: ${text.slice(0, 60)}`;
    throw new Error(`status ${res.status}`);
  } catch (err) {
    throw err;
  }
});

console.log('\n──────────────────────────────────────');
console.log(`${GREEN} Test tamamlandı.${RESET}`);
console.log('Eğer tüm testler geçtiyse backend sağlıklı.');
console.log('App\'de hata görüyorsan sorun mobile → backend bağlantısında değil,');
console.log('muhtemelen Expo Metro bağlantısında (--tunnel kullan) veya env değişkenlerinde.\n');
