// Ticker ownership: old (snapshot-before-await) vs new (always current + seq).
// Counts how many intervals are still alive after realistic overlapping calls.

let live = 0;
const mkInterval = (fn) => { live++; return { fn, id: Symbol() }; };
const mkClear = (h) => { if (h && !h.cleared) { h.cleared = true; live--; } };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const NET = 30; // ms, stands in for the status round trip

function makeStore(variant) {
  const s = { _interval: null, isLoading: false, isActive: false, isPaused: false };
  let seq = 0;
  let syncInFlight = null;

  const startTicker = () => {
    if (s._interval) mkClear(s._interval);
    const mine = ++seq;
    s._interval = mkInterval(() => { if (mine !== seq) return; });
  };
  const stopTicker = () => { if (s._interval) mkClear(s._interval); seq++; s._interval = null; };

  const start = async () => {
    s.isLoading = true;
    await sleep(NET);                       // POST /timer/start
    s.isActive = true;
    if (variant === 'old') { s._interval = mkInterval(() => {}); }  // overwrite, no clear
    else startTicker();
    s.isLoading = false;
  };

  const sync = async (serverActive) => {
    if (s.isLoading) return;
    if (variant === 'new') {
      if (syncInFlight) return syncInFlight;
      syncInFlight = (async () => {
        await sleep(NET);
        if (s.isLoading) return;
        if (!serverActive()) { stopTicker(); s.isActive = false; return; }
        s.isActive = true;
        startTicker();
      })();
      try { await syncInFlight; } finally { syncInFlight = null; }
      return;
    }
    // old: snapshot taken BEFORE the await
    const snapshot = s._interval;
    await sleep(NET);
    if (s.isLoading) return;
    if (!serverActive()) { if (snapshot) mkClear(snapshot); s.isActive = false; return; }
    if (snapshot) mkClear(snapshot);
    s._interval = mkInterval(() => {});
  };

  return { s, start, sync };
}

async function scenario(variant, rounds) {
  live = 0;
  const st = makeStore(variant);
  const serverActive = () => st.s.isActive;

  for (let i = 0; i < rounds; i++) {
    // A real session start: the socket's `timer:started` echo fires a sync
    // while start() is still in flight, and the screen syncs on foreground too.
    const p1 = st.start();
    const p2 = st.sync(serverActive);   // socket echo
    const p3 = st.sync(serverActive);   // app foregrounded
    await Promise.all([p1, p2, p3]);
    await st.sync(serverActive);        // tab revisit
  }
  return live;
}

(async () => {
  for (const rounds of [1, 3, 10]) {
    const oldLive = await scenario('old', rounds);
    const newLive = await scenario('new', rounds);
    console.log(`${String(rounds).padStart(2)} seans baslatma -> ESKI: ${oldLive} canli ticker | YENI: ${newLive}`);
  }
  console.log('\n(saglikli sonuc: aktif seans basina 1 ticker)');
})();
