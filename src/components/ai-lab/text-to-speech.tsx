"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Caption, Footer, Hi, LabHeader } from "./_ui";

/**
 * Neural Lab — "Text to Speech" (speech synthesis).
 *
 * Type something, pick a voice and tune speed + pitch, and the browser's
 * built-in synthesiser reads it aloud. Teaches that TTS rebuilds speech sound
 * by sound, and that voice/speed/pitch are knobs on the same engine. Runs fully
 * in the browser; no audio leaves the device.
 */

const ACCENT = "#a855f7";

export default function TextToSpeech() {
  const [supported, setSupported] = useState(true);
  const [text, setText] = useState("Hello! I am your computer, and I can talk!");
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceURI, setVoiceURI] = useState<string>("");
  const [rate, setRate] = useState(1);
  const [pitch, setPitch] = useState(1);
  const [speaking, setSpeaking] = useState(false);
  const spokenRef = useRef(0);
  const [spokenCount, setSpokenCount] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) { setSupported(false); return; }
    const load = () => {
      const v = window.speechSynthesis.getVoices();
      if (v.length) {
        setVoices(v);
        setVoiceURI((prev) => prev || v.find((x) => x.default)?.voiceURI || v[0].voiceURI);
      }
    };
    load();
    window.speechSynthesis.onvoiceschanged = load;
    return () => { window.speechSynthesis.cancel(); window.speechSynthesis.onvoiceschanged = null; };
  }, []);

  const speak = useCallback(() => {
    if (!text.trim()) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const v = voices.find((x) => x.voiceURI === voiceURI);
    if (v) { u.voice = v; u.lang = v.lang; }
    u.rate = rate;
    u.pitch = pitch;
    u.onstart = () => setSpeaking(true);
    u.onend = () => { setSpeaking(false); spokenRef.current += 1; setSpokenCount(spokenRef.current); };
    window.speechSynthesis.speak(u);
  }, [text, voices, voiceURI, rate, pitch]);

  const stopSpeak = () => { window.speechSynthesis.cancel(); setSpeaking(false); };

  if (!supported) {
    return (
      <div className="mx-auto w-full max-w-[620px]" style={{ color: "#e8eefc" }}>
        <LabHeader emoji="🗣️" title="Text to Speech" grades="Grades 2–7" topic="Language" accent={ACCENT} />
        <Caption accent={ACCENT}>This browser doesn't support speech synthesis. Try Chrome, Edge or Safari.</Caption>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[620px]" style={{ fontFamily: "system-ui, sans-serif", color: "#e8eefc" }}>
      <LabHeader emoji="🗣️" title="Text to Speech" grades="Grades 2–7" topic="Language" accent={ACCENT} right={`${spokenCount} spoken`} />

      <Caption accent={ACCENT} active={spokenCount >= 2}>
        {spokenCount >= 2
          ? "🔊 Same words, different voice! TTS builds speech from small sound pieces, then voice / speed / pitch reshape it. It's how screen readers, satnavs and audiobooks talk."
          : "Type anything, choose a voice, then press Speak. Try changing the voice, speed and pitch and speak again."}
      </Caption>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        className="w-full rounded-2xl border border-[#1e2738] bg-[#0f1420] px-3 py-2 font-mono text-[13px] text-[#e8eefc] outline-none"
      />

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="block sm:col-span-3">
          <span className="font-mono text-[10px] text-[#5b6b8c]">Voice</span>
          <select value={voiceURI} onChange={(e) => setVoiceURI(e.target.value)} className="mt-1 w-full rounded-lg border border-[#1e2738] bg-[#0b1018] px-2 py-1.5 font-mono text-[11px] text-[#e8eefc]">
            {voices.map((v) => <option key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.lang})</option>)}
          </select>
        </label>
        <label className="block">
          <span className="font-mono text-[10px] text-[#5b6b8c]">Speed: {rate.toFixed(1)}×</span>
          <input type="range" min={0.5} max={2} step={0.1} value={rate} onChange={(e) => setRate(+e.target.value)} className="mt-1 w-full" style={{ accentColor: ACCENT }} />
        </label>
        <label className="block">
          <span className="font-mono text-[10px] text-[#5b6b8c]">Pitch: {pitch.toFixed(1)}</span>
          <input type="range" min={0} max={2} step={0.1} value={pitch} onChange={(e) => setPitch(+e.target.value)} className="mt-1 w-full" style={{ accentColor: ACCENT }} />
        </label>
        <div className="flex items-end gap-2">
          <button type="button" onClick={speak} className="flex-1 rounded-lg border-2 px-3 py-2 font-mono text-[12px] font-semibold" style={{ borderColor: ACCENT, color: ACCENT, background: `${ACCENT}1a` }}>{speaking ? "🔊 Speaking…" : "▶ Speak"}</button>
          {speaking && <button type="button" onClick={stopSpeak} className="rounded-lg border border-[#2a3550] px-3 py-2 font-mono text-[11px] text-[#9fb0d0]">stop</button>}
        </div>
      </div>

      <Footer accent={ACCENT}>
        Modern <Hi accent={ACCENT}>text-to-speech</Hi> predicts the tiny sound units (phonemes) for your words, then a
        voice model turns them into audio you hear. The same text can sound calm or excited just by changing speed and
        pitch — which is why AI voices are getting so lifelike.
      </Footer>
    </div>
  );
}
