"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Caption, Footer, Hi, LabHeader } from "./_ui";

/**
 * Neural Lab — "Speech to Text" (live transcription).
 *
 * Uses the browser's built-in Web Speech API to turn what you say into text in
 * real time. Three target phrases turn it into a gradeable challenge, and the
 * live "interim" text shows the AI second-guessing itself before it commits —
 * a great window into how speech models work.
 */

const ACCENT = "#60a5fa";

interface SRResult { 0: { transcript: string }; isFinal: boolean }
interface SREvent { resultIndex: number; results: { length: number;[i: number]: SRResult } }
interface SRInstance {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((e: SREvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void; stop: () => void;
}
type SRCtor = new () => SRInstance;

const TARGETS = ["hello world", "i love learning", "artificial intelligence"];
const norm = (s: string) => s.toLowerCase().replace(/[^a-z ]/g, "").replace(/\s+/g, " ").trim();

export default function SpeechToText() {
  const recRef = useRef<SRInstance | null>(null);
  const [supported, setSupported] = useState(true);
  const [listening, setListening] = useState(false);
  const [finalText, setFinalText] = useState("");
  const [interim, setInterim] = useState("");
  const [done, setDone] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) { setSupported(false); return; }
    const rec = new Ctor();
    rec.lang = "en-US";
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let fin = "", itm = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) fin += r[0].transcript;
        else itm += r[0].transcript;
      }
      setInterim(itm);
      if (fin) {
        setFinalText((prev) => (prev + " " + fin).trim());
        const said = norm(fin);
        setDone((prev) => {
          let next = prev;
          for (const t of TARGETS) if (!prev[t] && said.includes(t)) { next = next === prev ? { ...prev } : next; next[t] = true; }
          return next;
        });
      }
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    return () => { try { rec.stop(); } catch { /* already stopped */ } };
  }, []);

  const toggle = useCallback(() => {
    const rec = recRef.current;
    if (!rec) return;
    if (listening) { rec.stop(); setListening(false); }
    else { setInterim(""); try { rec.start(); setListening(true); } catch { /* start race */ } }
  }, [listening]);

  const doneCount = TARGETS.filter((t) => done[t]).length;
  const allDone = doneCount === TARGETS.length;

  if (!supported) {
    return (
      <div className="mx-auto w-full max-w-[620px]" style={{ color: "#e8eefc" }}>
        <LabHeader emoji="🎙️" title="Speech to Text" grades="Grades 3–8" topic="Language" accent={ACCENT} />
        <Caption accent={ACCENT}>This browser doesn't support live speech recognition. Try Chrome or Edge to use this experiment.</Caption>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[620px]" style={{ fontFamily: "system-ui, sans-serif", color: "#e8eefc" }}>
      <LabHeader emoji="🎙️" title="Speech to Text" grades="Grades 3–8" topic="Language" accent={ACCENT} right={`${doneCount}/${TARGETS.length} said`} />

      <Caption accent={ACCENT} active={allDone}>
        {allDone
          ? "🎉 You said them all! Notice the grey 'interim' text kept changing as you spoke, then locked in — the model keeps guessing the whole phrase and revises until the sounds make sense together."
          : listening
            ? "🎙️ Listening… speak clearly. Grey text is its live guess; it turns solid once it's sure."
            : "Tap the mic and read the phrases below out loud."}
      </Caption>

      <div className="flex flex-col items-center gap-3 rounded-2xl border border-[#1e2738] bg-[#0f1420] p-5">
        <button
          type="button"
          onClick={toggle}
          className="grid h-16 w-16 place-items-center rounded-full border-2 text-2xl transition-colors"
          style={{ borderColor: ACCENT, background: listening ? `${ACCENT}33` : `${ACCENT}1a`, color: ACCENT }}
        >
          {listening ? "⏸️" : "🎙️"}
        </button>
        <div className="min-h-[48px] w-full text-center">
          <span className="font-mono text-[13px] text-[#e8eefc]">{finalText} </span>
          <span className="font-mono text-[13px] text-[#5b6b8c] italic">{interim}</span>
          {!finalText && !interim && <span className="font-mono text-[11px] text-[#5b6b8c]">your words appear here…</span>}
        </div>
      </div>

      <p className="mb-1.5 mt-4 font-mono text-[9px] tracking-wide text-[#5b6b8c]">SAY EACH PHRASE</p>
      <div className="flex flex-wrap gap-1.5">
        {TARGETS.map((t) => {
          const ok = done[t];
          return (
            <span key={t} className="rounded-xl border-2 px-2.5 py-1.5 font-mono text-[10px]" style={{ borderColor: ok ? ACCENT : "#1e2738", background: ok ? `${ACCENT}1a` : "transparent", color: ok ? ACCENT : "#9fb0d0" }}>
              {ok ? "✓ " : "“ "}{t}{ok ? "" : " ”"}
            </span>
          );
        })}
      </div>

      <Footer accent={ACCENT}>
        Speech recognition slices your voice into tiny sound chunks and predicts the most likely <Hi accent={ACCENT}>words</Hi>,
        using context to fix itself (“ice cream” not “I scream”). It powers captions, voice assistants and dictation.
        Accents, noise and rare names are where it still trips up.
      </Footer>
    </div>
  );
}
