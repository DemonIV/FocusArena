/**
 * Objectionable-content filter for user-authored text that other people see:
 * usernames, room names, study-subject names.
 *
 * App Store Guideline 1.2 requires UGC apps to offer "a method for filtering
 * objectionable content" — this is that method, applied at write time so the
 * bad string never reaches another user's screen.
 *
 * Deliberately small and conservative. A big blocklist is a false-positive
 * machine (the Scunthorpe problem): "Kumsal" and "analiz" are ordinary words.
 * So the list holds only terms that are slurs or explicit in every context,
 * and all but a handful are matched on word boundaries rather than substrings.
 */

/** Matched anywhere in the string — no innocent word contains these. */
const SUBSTRING_TERMS = [
  'nigger', 'nigga', 'faggot', 'chingchong', 'kikeroo',
  'childporn', 'childp0rn', 'cp0rn', 'rapeporn', 'incestporn',
  'amcik', 'amcigi', 'orospu', 'piclik', 'yarrak', 'sikeyim', 'sikerim',
  'gotveren', 'ibnesin',
];

/** Matched as whole words only — these appear inside legitimate words. */
const WORD_TERMS = [
  'fuck', 'fucker', 'fucking', 'motherfucker', 'shit', 'bullshit', 'bitch',
  'cunt', 'whore', 'slut', 'dick', 'cock', 'pussy', 'wanker', 'bastard',
  'retard', 'tranny', 'rapist', 'pedo', 'pedophile', 'porn', 'porno',
  'hitler', 'nazi',
  // Turkish. Short forms like "am", "got", "pic" and "aq" are deliberately
  // absent: they collide with ordinary English words ("8 am", "got it",
  // "pic of the day") and a study-room name should not trip over those.
  'amk', 'amina', 'aminakoyayim', 'sikik', 'sikeyim', 'kahpe', 'kaltak',
  'yavsak', 'ibne', 'orospucocugu', 'anani', 'ananin',
];

/**
 * Leet/diacritic normalisation. Folds the usual evasions (`f4gg0t`, `s1k`,
 * `ORÖSPU`) onto plain ASCII lowercase, then squeezes repeats so `fuuuck`
 * collapses to `fuck`. Separators become spaces so `f_u_c_k` does NOT slip
 * through as one word but `fuck_you` still trips the word list.
 */
export function normalizeForFilter(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // strip combining accents
    .replace(/ı/g, 'i').replace(/ş/g, 's').replace(/ğ/g, 'g')
    .replace(/ç/g, 'c').replace(/ö/g, 'o').replace(/ü/g, 'u')
    .replace(/[0]/g, 'o').replace(/[1|!]/g, 'i').replace(/[3]/g, 'e')
    .replace(/[4@]/g, 'a').replace(/[5$]/g, 's').replace(/[7]/g, 't')
    .replace(/[^a-z ]+/g, ' ')          // separators/punctuation → space
    .replace(/(.)\1{2,}/g, '$1$1')      // fuuuuck → fuuck
    .replace(/\s+/g, ' ')
    .trim();
}

const WORD_SET = new Set(WORD_TERMS.map(normalizeForFilter));

/** Collapses every repeated letter to one: `fuuuuck` -> `fuck`, `sh1iit` -> `shit`. */
function squeezeRuns(text: string): string {
  return text.replace(/(.)\1+/g, '$1');
}

/** True when the text contains a blocked term. */
export function containsObjectionable(input: string): boolean {
  const normalized = normalizeForFilter(input);
  if (!normalized) return false;

  // Stretching letters is the cheapest evasion, so every check runs twice:
  // once on the text as written, once with all repeats collapsed. The second
  // pass is what catches `fuuuuck`; the first is what keeps `assess` intact.
  const variants = [normalized, squeezeRuns(normalized)];

  for (const variant of variants) {
    const squeezed = variant.replace(/ /g, '');
    if (SUBSTRING_TERMS.some((term) => squeezed.includes(term))) return true;
    if (variant.split(' ').some((word) => WORD_SET.has(word))) return true;
  }
  return false;
}

/**
 * Throws a 400-shaped error when the text is objectionable.
 * `field` names what was rejected so the client can point at the right input.
 */
export function assertClean(input: string, field: 'username' | 'roomName' | 'subjectName'): void {
  if (containsObjectionable(input)) {
    throw Object.assign(
      new Error(`This ${field === 'username' ? 'username' : 'name'} is not allowed.`),
      { code: 'OBJECTIONABLE', field },
    );
  }
}
