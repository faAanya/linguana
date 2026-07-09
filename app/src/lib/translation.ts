// Translation via HuggingFace Inference API using facebook/nllb-200-distilled-600M.
// NLLB uses its own language codes (FLORES-200), not ISO 639-1, so we map
// our app's ISO codes to NLLB codes.

const HF_API_URL =
  "https://api-inference.huggingface.co/models/facebook/nllb-200-distilled-600M";

// Maps our ISO 639-1 codes to NLLB FLORES-200 codes.
const NLLB_CODES: Record<string, string> = {
  en: "eng_Latn",
  es: "spa_Latn",
  fr: "fra_Latn",
  de: "deu_Latn",
  it: "ita_Latn",
  pt: "por_Latn",
  ru: "rus_Cyrl",
  uk: "ukr_Cyrl",
  pl: "pol_Latn",
  nl: "nld_Latn",
  sv: "swe_Latn",
  no: "nob_Latn",
  da: "dan_Latn",
  fi: "fin_Latn",
  cs: "ces_Latn",
  el: "ell_Grek",
  tr: "tur_Latn",
  ar: "arb_Arab",
  he: "heb_Hebr",
  hi: "hin_Deva",
  bn: "ben_Beng",
  ur: "urd_Arab",
  fa: "pes_Arab",
  zh: "zho_Hans",
  ja: "jpn_Jpan",
  ko: "kor_Hang",
  vi: "vie_Latn",
  th: "tha_Thai",
  id: "ind_Latn",
  ms: "zsm_Latn",
  tl: "tgl_Latn",
  ro: "ron_Latn",
  hu: "hun_Latn",
  bg: "bul_Cyrl",
  sr: "srp_Cyrl",
  hr: "hrv_Latn",
  sk: "slk_Latn",
  lt: "lit_Latn",
  lv: "lav_Latn",
  et: "est_Latn",
};

export function toNllbCode(isoCode: string): string | undefined {
  return NLLB_CODES[isoCode];
}

export interface TranslateParams {
  text: string;
  sourceLang: string; // ISO 639-1
  targetLang: string; // ISO 639-1
}

export async function translate({
  text,
  sourceLang,
  targetLang,
}: TranslateParams): Promise<string> {
  const token = process.env.HUGGINGFACE_API_TOKEN;
  if (!token) {
    throw new Error("HUGGINGFACE_API_TOKEN is not set");
  }

  const srcCode = toNllbCode(sourceLang);
  const tgtCode = toNllbCode(targetLang);

  if (!srcCode || !tgtCode) {
    throw new Error(`Unsupported language pair: ${sourceLang} → ${targetLang}`);
  }

  const response = await fetch(HF_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      inputs: text,
      parameters: {
        src_lang: srcCode,
        tgt_lang: tgtCode,
      },
    }),
  });

  if (!response.ok) {
    // HF returns 503 while a model is loading — surface a clear message
    if (response.status === 503) {
      throw new Error("Translation model is loading, please try again in a moment");
    }
    const errText = await response.text();
    throw new Error(`Translation failed: ${errText}`);
  }

  const data = await response.json();

  // NLLB returns [{ translation_text: "..." }]
  if (Array.isArray(data) && data[0]?.translation_text) {
    return data[0].translation_text;
  }

  throw new Error("Unexpected translation response format");
}