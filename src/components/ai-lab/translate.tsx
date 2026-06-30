"use client";

import { useCallback, useState } from "react";
import { Caption, Footer, Hi, LabHeader } from "./_ui";

/**
 * Neural Lab — "Translator" (machine translation).
 *
 * Type a sentence and translate it between languages using a free, no-key
 * translation API (MyMemory). Teaches that machine translation maps MEANING
 * between languages, not word-for-word — and (a real, honest point) that this
 * one sends your text to an online service, unlike the on-device experiments.
 */

const ACCENT = "#34d399";
const LANGS: { code: string; label: string }[] = [
  { code: "hi", label: "Hindi" },
  { code: "es", label: "Spanish" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "ja", label: "Japanese" },
  { code: "ar", label: "Arabic" },
  { code: "ta", label: "Tamil" },
  { code: "bn", label: "Bengali" },
];

export default function Translator() {
  const [text, setText] = useState("Hello, how are you?");
  const [target, setTarget] = useState("hi");
  const [out, setOut] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [tried, setTried] = useState<Set<string>>(new Set());

  const translate = useCallback(async () => {
    if (!text.trim()) return;
    setBusy(true); setErr(null); setOut("");
    try {
      const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|${target}`;
      const res = await fetch(url);
      const data = await res.json();
      const t = data?.responseData?.translatedText;
      if (t) {
        setOut(t);
        setTried((s) => new Set(s).add(target));
      } else {
        setErr("No translation came back — try again in a moment.");
      }
    } catch {
      setErr("Couldn't reach the translation service (it needs internet).");
    } finally {
      setBusy(false);
    }
  }, [text, target]);

  const speak = () => {
    if (!out || typeof window === "undefined" || !window.speechSynthesis) return;
    const u = new SpeechSynthesisUtterance(out);
    u.lang = target;
    window.speechSynthesis.speak(u);
  };

  return (
    <div className="mx-auto w-full max-w-[620px]" style={{ fontFamily: "system-ui, sans-serif", color: "#e8eefc" }}>
      <LabHeader emoji="🌍" title="Translator" grades="Grades 3–9" topic="Language" accent={ACCENT} right={`${tried.size} languages`} />

      <Caption accent={ACCENT} active={tried.size >= 2}>
        {tried.size >= 2
          ? "🌍 Two languages down! Good machine translation maps MEANING, not word-for-word — that's why word order and grammar change. Heads up: this one sends your text online, unlike the camera/mic labs that stay on your device."
          : "Type English, pick a language, and translate. Try translating the same sentence into a few languages."}
      </Caption>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={2}
        className="w-full rounded-2xl border border-[#1e2738] bg-[#0f1420] px-3 py-2 font-mono text-[13px] text-[#e8eefc] outline-none"
      />

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="font-mono text-[10px] text-[#5b6b8c]">English →</span>
        <select value={target} onChange={(e) => setTarget(e.target.value)} className="rounded-lg border border-[#1e2738] bg-[#0b1018] px-2 py-1.5 font-mono text-[11px] text-[#e8eefc]">
          {LANGS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
        </select>
        <button type="button" onClick={translate} disabled={busy} className="rounded-lg border-2 px-3 py-1.5 font-mono text-[11px] font-semibold disabled:opacity-40" style={{ borderColor: ACCENT, color: ACCENT, background: `${ACCENT}1a` }}>
          {busy ? "Translating…" : "🌍 Translate"}
        </button>
      </div>

      <div className="mt-3 rounded-2xl border border-[#1e2738] bg-[#0f1420] px-3 py-3">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[9px] tracking-wide text-[#5b6b8c]">{LANGS.find((l) => l.code === target)?.label.toUpperCase()}</span>
          {out && <button type="button" onClick={speak} className="font-mono text-[10px]" style={{ color: ACCENT }}>🔊 hear it</button>}
        </div>
        <div className="mt-1 break-words font-mono text-[15px]" style={{ color: out ? "#e8eefc" : "#5b6b8c" }}>
          {err ? <span className="text-[#fb7185] text-[12px]">{err}</span> : out || "— translation appears here —"}
        </div>
      </div>

      <Footer accent={ACCENT}>
        Machine translation reads the whole sentence, builds its <Hi accent={ACCENT}>meaning</Hi>, then writes that
        meaning in the new language — which is why it reorders words and fixes grammar. Modern translators use the same
        kind of model as chatbots. Idioms and slang are still where they slip.
      </Footer>
    </div>
  );
}
