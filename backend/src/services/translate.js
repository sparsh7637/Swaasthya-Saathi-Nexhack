const fetch = require('node-fetch');
const { Groq } = require('groq-sdk');
const { GROQ_API_KEY } = require('../config/env');

const groq = new Groq({ apiKey: GROQ_API_KEY });

// Map ASCII digits 0-9 to native numeral sets for selected languages
function convertAsciiDigitsToNative(input, targetLang) {
  if (!input) return input;
  const maps = {
    // Devanagari (Hindi, Marathi, Nepali)
    dev: ['०','१','२','३','४','५','६','७','८','९'],
    // Bengali
    ben: ['০','১','২','৩','৪','৫','৬','৭','৮','৯'],
    // Gujarati
    guj: ['૦','૧','૨','૩','૪','૫','૬','૭','૮','૯'],
    // Gurmukhi (Punjabi)
    guru: ['੦','੧','੨','੩','੪','੫','੬','੭','੮','੯'],
    // Oriya (Odia)
    ori: ['୦','୧','୨','୩','୪','୫','୬','୭','୮','୯'],
    // Tamil
    tam: ['௦','௧','௨','௩','௪','௫','௬','௭','௮','௯'],
    // Telugu
    tel: ['౦','౧','౨','౩','౪','౫','౬','౭','౮','౯'],
    // Kannada
    knd: ['೦','೧','೨','೩','೪','೫','೬','೭','೮','೯'],
    // Malayalam
    mal: ['൦','൧','൨','൩','൪','൫','൬','൭','൮','൯']
  };

  const lang = (targetLang || '').toLowerCase();
  let map = null;
  if (['hi','mr','ne'].includes(lang)) map = maps.dev;
  else if (lang === 'bn') map = maps.ben;
  else if (lang === 'gu') map = maps.guj;
  else if (lang === 'pa') map = maps.guru;
  else if (lang === 'or') map = maps.ori;
  else if (lang === 'ta') map = maps.tam;
  else if (lang === 'te') map = maps.tel;
  else if (lang === 'kn') map = maps.knd;
  else if (lang === 'ml') map = maps.mal;

  if (!map) return input;
  return input.replace(/[0-9]/g, d => map[Number(d)]);
}

// Convert integer to Hindi words (Indian numbering system)
function integerToHindiWords(num) {
  const units = [
    'शून्य','एक','दो','तीन','चार','पाँच','छह','सात','आठ','नौ','दस','ग्यारह','बारह','तेरह','चौदह','पंद्रह','सोलह','सत्रह','अठारह','उन्नीस'
  ];
  const tens = [
    '', '', 'बीस','तीस','चालीस','पचास','साठ','सत्तर','अस्सी','नब्बे'
  ];
  const irregular = {
    20: 'बीस',21: 'इक्कीस',22: 'बाईस',23: 'तेईस',24: 'चौबीस',25: 'पच्चीस',26: 'छब्बीस',27: 'सत्ताईस',28: 'अट्ठाईस',29: 'उनतीस',
    30: 'तीस',31: 'इकतीस',32: 'बत्तीस',33: 'तैंतीस',34: 'चौंतीस',35: 'पैंतीस',36: 'छत्तीस',37: 'सैंतीस',38: 'अड़तीस',39: 'उनतालीस',
    40: 'चालीस',41: 'इकतालीस',42: 'बयालीस',43: 'तैंतालीस',44: 'चवालीस',45: 'पैंतालीस',46: 'छियालिस',47: 'सैंतालीस',48: 'अड़तालीस',49: 'उन्चास',
    50: 'पचास',51: 'इक्यावन',52: 'बावन',53: 'तििरपन',54: 'चौवन',55: 'पचपन',56: 'छप्पन',57: 'सत्तावन',58: 'अट्ठावन',59: 'उनसाठ',
    60: 'साठ',61: 'इकसठ',62: 'बासठ',63: 'तििरसठ',64: 'चौंसठ',65: 'पैंसठ',66: 'छियासठ',67: 'सड़सठ',68: 'अड़सठ',69: 'उनहत्तर',
    70: 'सत्तर',71: 'इकहत्तर',72: 'बहत्तर',73: 'तिहत्तर',74: 'चौहत्तर',75: 'पचहत्तर',76: 'छिहत्तर',77: 'सतहत्तर',78: 'अठहत्तर',79: 'उन्यासी',
    80: 'अस्सी',81: 'इक्यासी',82: 'बयासी',83: 'तिरासी',84: 'चौरासी',85: 'पचासी',86: 'छियासी',87: 'सतासी',88: 'अठासी',89: 'नवासी',
    90: 'नब्बे',91: 'इक्यानवे',92: 'बानवे',93: 'तिरानवे',94: 'चौरानवे',95: 'पचानवे',96: 'छियानवे',97: 'सत्तानवे',98: 'अट्ठानवे',99: 'निन्यानवे'
  };
  if (num < 20) return units[num];
  if (num < 100) return irregular[num] || `${tens[Math.floor(num/10)]}`;
  if (num < 1000) {
    const hundreds = Math.floor(num / 100);
    const rem = num % 100;
    return rem ? `${units[hundreds]} सौ ${integerToHindiWords(rem)}` : `${units[hundreds]} सौ`;
  }
  const parts = [];
  const crore = Math.floor(num / 10000000);
  if (crore) {
    parts.push(`${integerToHindiWords(crore)} करोड़`);
    num = num % 10000000;
  }
  const lakh = Math.floor(num / 100000);
  if (lakh) {
    parts.push(`${integerToHindiWords(lakh)} लाख`);
    num = num % 100000;
  }
  const thousand = Math.floor(num / 1000);
  if (thousand) {
    parts.push(`${integerToHindiWords(thousand)} हज़ार`);
    num = num % 1000;
  }
  const hundred = Math.floor(num / 100);
  if (hundred) {
    parts.push(`${integerToHindiWords(hundred)} सौ`);
    num = num % 100;
  }
  if (num) parts.push(integerToHindiWords(num));
  return parts.join(' ');
}

function numberToHindiWords(value) {
  if (value === null || value === undefined) return '';
  const str = String(value).trim();
  if (!str) return '';
  let negative = false;
  let s = str;
  if (s.startsWith('-')) { negative = true; s = s.slice(1); }
  const [intPart, fracPart] = s.split(/[\.]/);
  const intNum = Number(intPart.replace(/,/g, ''));
  if (!Number.isFinite(intNum)) return str;
  let words = integerToHindiWords(intNum);
  if (fracPart && /\d/.test(fracPart)) {
    const fracWords = fracPart.split('').map(d => integerToHindiWords(Number(d))).join(' ');
    words = `${words} दशमलव ${fracWords}`;
  }
  return negative ? `ऋण ${words}` : words;
}

function replaceNumbersWithWords(input, targetLang) {
  if (!input) return input;
  const lang = (targetLang || '').toLowerCase();
  if (lang !== 'hi') return input;
  
  // First, handle numbers before "mg" specifically
  let result = input.replace(/(\d+[\d,]*\.?\d*)\s*mg/gi, (match, number) => {
    const normalized = number.replace(/,/g, '');
    if (!/^\d*\.?\d+$/.test(normalized)) return match;
    try {
      return `${numberToHindiWords(normalized)} mg`;
    } catch {
      return match;
    }
  });
  
  // Then handle other standalone numbers
  result = result.replace(/(?<![\w\d])(\d+[\d,]*\.?\d*)(?![\w\d])/g, (match) => {
    const normalized = match.replace(/,/g, '');
    if (!/^\d*\.?\d+$/.test(normalized)) return match;
    try {
      return numberToHindiWords(normalized);
    } catch {
      return match;
    }
  });
  
  return result;
}

async function translateText(text, targetLang, sourceLang = 'auto') {
  if (!targetLang) {
    throw new Error('translateText requires both text and targetLang');
  }
  const input = typeof text === 'string' ? text : (text == null ? '' : String(text));
  if (!input || !input.trim()) {
    console.warn('translateText called with empty input, returning empty string');
    return '';
  }

  // Try Groq LLM first
  try {
    const systemPrompt = `You are a professional translator. Translate the user's message from ${sourceLang} to ${targetLang}. Preserve meaning and tone. Respond with ONLY the translated text, no quotes, no extra words, no notes.`;
    const chat = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: input }
      ],
      model: 'openai/gpt-oss-120b',
      temperature: 0.2,
      top_p: 1,
      max_completion_tokens: 5000,
      stream: false
    });

    let translated = chat.choices[0].message.content
      .replace(/[\*\_\~\`]/g, '')
      .trim();

    if (translated) {
      translated = replaceNumbersWithWords(translated, targetLang);
      translated = convertAsciiDigitsToNative(translated, targetLang);
      console.log(translated);
      return translated;
    }
  } catch (err) {
    // Fall back to public translate endpoint if Groq is unavailable
    // console.warn('[translate] Groq translation failed, falling back:', err?.message || err);
  }

  // Fallback: Google public translate API (best-effort, not guaranteed for production)
  const res = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encodeURIComponent(input)}`);
  const data = await res.json();
  const fallback = data[0].map(part => part[0]).join('');
  const withWords = replaceNumbersWithWords(fallback, targetLang);
  return convertAsciiDigitsToNative(withWords, targetLang);
}

module.exports = { translateText, replaceNumbersWithWords, convertAsciiDigitsToNative };


