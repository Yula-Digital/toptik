const HEBREW_CHAR_REGEX = /[֐-׿]/;
const LATIN_WORD_REGEX = /[A-Za-z]{3,}/;
const CHUNK_MAX_LENGTH = 1000;
const ATTEMPTS_PER_CHUNK = 3;

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

function splitIntoChunks(text: string) {
  const sentences = text.match(/[^.!?]+[.!?]*\s*/g) ?? [text];
  const chunks: string[] = [];
  let current = "";
  for (const sentence of sentences) {
    if (current && current.length + sentence.length > CHUNK_MAX_LENGTH) {
      chunks.push(current.trim());
      current = "";
    }
    current += sentence;
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

async function requestTranslation(input: string): Promise<string | null> {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=he&dt=t&q=${encodeURIComponent(
    input,
  )}`;
  const res = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
    headers: { "user-agent": USER_AGENT },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as unknown;

  if (!Array.isArray(data) || !Array.isArray(data[0])) return null;
  const segments = data[0] as unknown[];
  const translated = segments
    .map((segment) => (Array.isArray(segment) ? String(segment[0] ?? "") : ""))
    .join("")
    .trim();
  return translated || null;
}

// The public translate endpoint is flaky on long inputs — it can return text
// that flips back to the source language mid-sentence. Translate sentence-sized
// chunks and accept a chunk's result only if it actually came back in Hebrew,
// retrying a few times before falling back to the original text for that chunk.
export async function translateToHebrew(input: string | null) {
  if (!input?.trim()) return input;

  const chunks = splitIntoChunks(input);
  const translatedChunks: string[] = [];

  for (const chunk of chunks) {
    if (!LATIN_WORD_REGEX.test(chunk)) {
      translatedChunks.push(chunk);
      continue;
    }

    let accepted: string | null = null;
    for (let attempt = 0; attempt < ATTEMPTS_PER_CHUNK; attempt += 1) {
      try {
        const candidate = await requestTranslation(chunk);
        if (candidate && HEBREW_CHAR_REGEX.test(candidate)) {
          accepted = candidate;
          break;
        }
      } catch {
        // retry
      }
    }
    translatedChunks.push(accepted ?? chunk);
  }

  const result = translatedChunks.join(" ").replace(/\s+/g, " ").trim();
  return result || input;
}
