"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMic } from "./_mic";
import { Caption, Footer, Hi, LabHeader } from "./_ui";
import { PredictionBars, TrainerClasses, useTeachable, type TeachClass } from "./_teach";

/**
 * Neural Lab — "Sound Trainer" (teachable audio classification).
 *
 * Teach the computer to tell sounds apart (clap / whistle / quiet) using the
 * microphone. Each moment's audio becomes a 32-band frequency fingerprint; KNN
 * matches new sounds to the closest taught class. A live equaliser shows the
 * fingerprint. PictoBlox's Audio-Classifier idea, on-device with Web Audio.
 */

const ACCENT = "#f472b6";
const CLASSES: TeachClass[] = [
  { id: "s1", label: "Sound 1" },
  { id: "s2", label: "Sound 2" },
  { id: "s3", label: "Quiet" },
];

export default function SoundTrainer() {
  const { start, stop, status, error, fingerprint, bands } = useMic();
  const rafRef = useRef<number | null>(null);
  const vecRef = useRef<number[] | null>(null);
  const [spectrum, setSpectrum] = useState<number[]>(new Array(bands).fill(0));
  const { addSample, classify, reset, counts, pred, ready } = useTeachable();

  const loop = useCallback(() => {
    const fp = fingerprint();
    if (fp) {
      vecRef.current = fp;
      setSpectrum(fp);
      classify(fp);
    }
    rafRef.current = requestAnimationFrame(loop);
  }, [fingerprint, classify]);

  useEffect(() => {
    if (status !== "on") return;
    rafRef.current = requestAnimationFrame(loop);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [status, loop]);

  useEffect(() => () => stop(), [stop]);

  const onAdd = (id: string) => { if (vecRef.current) addSample(id, vecRef.current); };
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const on = status === "on";

  return (
    <div className="mx-auto w-full max-w-[680px]" style={{ fontFamily: "system-ui, sans-serif", color: "#e8eefc" }}>
      <LabHeader emoji="🔊" title="Sound Trainer" grades="Grades 4–10" topic="Machine learning" accent={ACCENT} right={`${total} examples`} />

      <Caption accent={ACCENT} active={ready}>
        {on
          ? ready
            ? "🔊 It can hear the difference! Make each sound — the bars show its guess. Keep one class as background 'quiet' so it knows what silence looks like."
            : "Pick 2–3 sounds (clap, whistle, or just quiet). Make one sound and tap its button several times, then the next."
          : "Turn on the microphone and teach the computer to tell your sounds apart."}
      </Caption>

      {/* Mic stage + live equaliser */}
      <div className="relative overflow-hidden rounded-2xl border bg-[#060912] p-4" style={{ borderColor: on ? `${ACCENT}66` : "#1e2738" }}>
        {on ? (
          <div className="flex h-28 items-end justify-center gap-[2px]">
            {spectrum.map((v, i) => (
              <div key={i} className="w-2 rounded-t" style={{ height: `${Math.max(2, v * 100)}%`, background: ACCENT, opacity: 0.5 + v / 2 }} />
            ))}
          </div>
        ) : (
          <div className="grid h-28 place-items-center text-center">
            <div className="flex flex-col items-center gap-3">
              <span aria-hidden style={{ fontSize: 40 }}>🎤</span>
              {error && <p className="max-w-[260px] font-mono text-[11px] text-[#fb7185]">{error}</p>}
              <button type="button" onClick={start} className="rounded-xl border-2 px-4 py-2 font-mono text-xs font-semibold" style={{ borderColor: ACCENT, color: ACCENT, background: `${ACCENT}1a` }}>
                {error ? "Try again" : "▶ Turn on microphone"}
              </button>
              <p className="font-mono text-[9px] text-[#5b6b8c]">Audio is never recorded or uploaded — only the live spectrum is read.</p>
            </div>
          </div>
        )}
      </div>

      <TrainerClasses classes={CLASSES} counts={counts} accent={ACCENT} onAdd={onAdd} onReset={reset} disabled={!on} />
      <PredictionBars classes={CLASSES} pred={pred} accent={ACCENT} ready={ready} />

      <Footer accent={ACCENT}>
        Sound becomes a <Hi accent={ACCENT}>frequency fingerprint</Hi> — how much energy sits in low vs high pitches.
        The model stores an average fingerprint per class and matches live audio to the closest. It's the same idea
        behind wake-words like “Hey…” — though those use far bigger models and lots more examples.
      </Footer>
    </div>
  );
}
