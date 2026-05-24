/** Pad a number to two digits */
const pad = (n: number) => String(Math.floor(n)).padStart(2, '0');

/** 3600 → "01:00:00" */
export function formatHHMMSS(totalSeconds: number): string {
  const s = Math.max(0, totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

/** 90 → "01:30" */
export function formatMMSS(totalSeconds: number): string {
  const s = Math.max(0, totalSeconds);
  return `${pad(s / 60)}:${pad(s % 60)}`;
}

/** 90 → "1m 30s" */
export function formatDuration(totalMinutes: number): string {
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

/** ms → "MM:SS" */
export function msToDisplay(ms: number): string {
  return formatHHMMSS(Math.floor(ms / 1000));
}
