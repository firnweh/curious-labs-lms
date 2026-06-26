"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

/**
 * Lightweight client-side i18n for Curious Labs.
 *
 * No routing changes, no extra deps — a React context holds the active
 * language, persists it to localStorage, and reflects it on <html lang>.
 * Components read strings with the `t()` helper from `useT()`.
 *
 * Adding a language = add it to LANGUAGES + a block to STRINGS.
 * Adding a string = add the same key to every language (missing keys fall
 * back to English, then to the key itself).
 */

export type Lang = "en" | "hi" | "ta" | "te" | "mr" | "bn" | "gu" | "kn";

export const LANGUAGES: { code: Lang; label: string; native: string }[] = [
  { code: "en", label: "EN", native: "English" },
  { code: "hi", label: "HI", native: "हिन्दी" },
  { code: "ta", label: "TA", native: "தமிழ்" },
  { code: "te", label: "TE", native: "తెలుగు" },
  { code: "mr", label: "MR", native: "मराठी" },
  { code: "bn", label: "BN", native: "বাংলা" },
  { code: "gu", label: "GU", native: "ગુજરાતી" },
  { code: "kn", label: "KN", native: "ಕನ್ನಡ" },
];

type Dict = Record<string, string>;

const STRINGS: Record<Lang, Dict> = {
  en: {
    "nav.login": "Login",
    "nav.logout": "Log out",
    "lang.label": "Language",
    "tracks.kicker": "EXPLORE THE LABS",
    "tracks.title": "Choose your track",
    "tracks.desc":
      "Pick your class, then dive into a world of making — {labs} live labs across {tracks} tracks.",
  },
  hi: {
    "nav.login": "लॉगिन",
    "nav.logout": "लॉग आउट",
    "lang.label": "भाषा",
    "tracks.kicker": "लैब्स एक्सप्लोर करें",
    "tracks.title": "अपना ट्रैक चुनें",
    "tracks.desc":
      "अपनी कक्षा चुनें और मेकिंग की दुनिया में उतरें — {tracks} ट्रैक्स में {labs} लाइव लैब्स।",
  },
  ta: {
    "nav.login": "உள்நுழைய",
    "nav.logout": "வெளியேறு",
    "lang.label": "மொழி",
    "tracks.kicker": "ஆய்வகங்களை ஆராயுங்கள்",
    "tracks.title": "உங்கள் பாதையைத் தேர்ந்தெடுங்கள்",
    "tracks.desc":
      "உங்கள் வகுப்பைத் தேர்ந்தெடுத்து, படைப்பாக்க உலகில் இறங்குங்கள் — {tracks} பாதைகளில் {labs} நேரடி ஆய்வகங்கள்.",
  },
  te: {
    "nav.login": "లాగిన్",
    "nav.logout": "లాగ్ అవుట్",
    "lang.label": "భాష",
    "tracks.kicker": "ల్యాబ్‌లను అన్వేషించండి",
    "tracks.title": "మీ ట్రాక్‌ను ఎంచుకోండి",
    "tracks.desc":
      "మీ తరగతిని ఎంచుకుని, సృష్టి ప్రపంచంలోకి అడుగుపెట్టండి — {tracks} ట్రాక్‌లలో {labs} లైవ్ ల్యాబ్‌లు.",
  },
  mr: {
    "nav.login": "लॉगिन",
    "nav.logout": "लॉग आउट",
    "lang.label": "भाषा",
    "tracks.kicker": "लॅब्स एक्सप्लोर करा",
    "tracks.title": "तुमचा ट्रॅक निवडा",
    "tracks.desc":
      "तुमचा वर्ग निवडा आणि बनवण्याच्या जगात उतरा — {tracks} ट्रॅक्समध्ये {labs} लाइव्ह लॅब्स.",
  },
  bn: {
    "nav.login": "লগইন",
    "nav.logout": "লগআউট",
    "lang.label": "ভাষা",
    "tracks.kicker": "ল্যাবগুলি অন্বেষণ করুন",
    "tracks.title": "আপনার ট্র্যাক বেছে নিন",
    "tracks.desc":
      "আপনার ক্লাস বেছে নিন, তারপর তৈরির জগতে ডুব দিন — {tracks} ট্র্যাকে {labs} লাইভ ল্যাব।",
  },
  gu: {
    "nav.login": "લોગિન",
    "nav.logout": "લોગ આઉટ",
    "lang.label": "ભાષા",
    "tracks.kicker": "લેબ્સ એક્સપ્લોર કરો",
    "tracks.title": "તમારો ટ્રેક પસંદ કરો",
    "tracks.desc":
      "તમારો વર્ગ પસંદ કરો અને બનાવટની દુનિયામાં ડૂબકી લગાવો — {tracks} ટ્રેકમાં {labs} લાઇવ લેબ્સ.",
  },
  kn: {
    "nav.login": "ಲಾಗಿನ್",
    "nav.logout": "ಲಾಗ್ ಔಟ್",
    "lang.label": "ಭಾಷೆ",
    "tracks.kicker": "ಲ್ಯಾಬ್‌ಗಳನ್ನು ಅನ್ವೇಷಿಸಿ",
    "tracks.title": "ನಿಮ್ಮ ಟ್ರ್ಯಾಕ್ ಆಯ್ಕೆಮಾಡಿ",
    "tracks.desc":
      "ನಿಮ್ಮ ತರಗತಿಯನ್ನು ಆಯ್ಕೆಮಾಡಿ, ನಂತರ ರಚನೆಯ ಜಗತ್ತಿನಲ್ಲಿ ಮುಳುಗಿ — {tracks} ಟ್ರ್ಯಾಕ್‌ಗಳಲ್ಲಿ {labs} ಲೈವ್ ಲ್ಯಾಬ್‌ಗಳು.",
  },
};

const LS_KEY = "cl:lang";

type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
};

const LanguageContext = createContext<Ctx | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  // Default to English on the server and the first client render so SSR and
  // hydration match; the saved choice is applied in an effect right after.
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(LS_KEY);
      if (saved && LANGUAGES.some((l) => l.code === saved)) {
        setLangState(saved as Lang);
      }
    } catch {
      /* localStorage unavailable — stay on default */
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      window.localStorage.setItem(LS_KEY, l);
    } catch {
      /* ignore persistence failure */
    }
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      let s = STRINGS[lang][key] ?? STRINGS.en[key] ?? key;
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          s = s.split(`{${k}}`).join(String(v));
        }
      }
      return s;
    },
    [lang],
  );

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useT() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useT must be used within a LanguageProvider");
  return ctx;
}
