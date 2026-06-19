"use client";
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* ------------------------------------------------------------------ */
/*  Doorbell Tunes — a button is a DIGITAL INPUT that triggers a       */
/*  program, and tone() commands (note + duration) play a melody in   */
/*  sequence. The learner wires a clean input, composes a 5-note      */
/*  tune to match a target, then presses the door button to run it.   */
/* ------------------------------------------------------------------ */

const ACCENT = "#22d3ee";

type Note = "C" | "D" | "E" | "F" | "G" | "A" | "B";
type Dur = "short" | "long";

const NOTES: readonly Note[] = ["C", "D", "E", "F", "G", "A", "B"] as const;

/** A colour per note so the target tiles read at a glance. */
const NOTE_COLOR: Record<Note, string> = {
  C: "#f87171",
  D: "#fb923c",
  E: "#fbbf24",
  F: "#34d399",
  G: "#22d3ee",
  A: "#818cf8",
  B: "#e879f9",
};

interface Step {
  note: Note;
  dur: Dur;
}

/** A familiar "ding-dong" doorbell shape — fixed, shown, always copy-able. */
const TARGET: readonly Step[] = [
  { note: "E", dur: "long" },
  { note: "C", dur: "long" },
  { note: "D", dur: "short" },
  { note: "G", dur: "short" },
  { note: "C", dur: "long" },
] as const;

const STEPS = TARGET.length;

/** Every cell starts blank-ish (a deliberately wrong first guess). */
function freshSequence(): Step[] {
  return [
    { note: "C", dur: "short" },
    { note: "C", dur: "short" },
    { note: "C", dur: "short" },
    { note: "C", dur: "short" },
    { note: "C", dur: "short" },
  ];
}

type Phase = "build" | "playing" | "won";

export default function DoorbellTunes({ onComplete }: ActivityProps) {
  const [wired, setWired] = useState<boolean>(false);
  const [dragOver, setDragOver] = useState<boolean>(false);
  const [pressed, setPressed] = useState<boolean>(false);
  const [readout, setReadout] = useState<string>("digitalRead(D2) = 0");
  const [seq, setSeq] = useState<Step[]>(freshSequence);
  const [active, setActive] = useState<number>(-1); // play-head cell index
  const [flashes, setFlashes] = useState<number>(0); // LED flash counter
  const [ledOn, setLedOn] = useState<boolean>(false);
  const [phase, setPhase] = useState<Phase>("build");
  const [hint, setHint] = useState<string>("");

  const completedRef = useRef<boolean>(false);
  const timersRef = useRef<number[]>([]);
  const flickerRef = useRef<number[]>([]);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((t) => window.clearTimeout(t));
    timersRef.current = [];
  }, []);
  const clearFlicker = useCallback(() => {
    flickerRef.current.forEach((t) => window.clearTimeout(t));
    flickerRef.current = [];
  }, []);

  useEffect(() => {
    return () => {
      clearTimers();
      clearFlicker();
    };
  }, [clearTimers, clearFlicker]);

  // ---- which cells already match the target (live per-note feedback) ----
  const matches = useMemo<boolean[]>(
    () =>
      seq.map(
        (s, i) => s.note === TARGET[i].note && s.dur === TARGET[i].dur,
      ),
    [seq],
  );
  const melodyOk = matches.every(Boolean);

  // First mismatching cell — drives the gentle hint, never the answer.
  const firstWrong = useMemo<number>(
    () => matches.findIndex((m) => !m),
    [matches],
  );

  /** Drop the pull-down resistor block into the wiring slot. */
  const handleWire = useCallback(() => {
    setDragOver(false);
    setWired(true);
    setReadout("digitalRead(D2) = 0");
    setHint("");
  }, []);

  /** Press the on-screen circuit button (Part 1 input demo). */
  const tapInput = useCallback(() => {
    if (phase === "playing") return;
    if (!wired) {
      // No clean pull-down → a noisy, floating input that bounces 1…0…1.
      setReadout("digitalRead(D2) = 1…0…1  ⚠ noisy");
      setHint("The input is floating. Drag the pull-down resistor in first.");
      clearFlicker();
      const seqBits = ["1", "0", "1", "0"];
      seqBits.forEach((b, i) => {
        const t = window.setTimeout(() => {
          setReadout(`digitalRead(D2) = ${b}…  ⚠ noisy`);
        }, 120 * (i + 1));
        flickerRef.current.push(t);
      });
      const reset = window.setTimeout(() => {
        setReadout("digitalRead(D2) = 0  ⚠ floating");
      }, 120 * (seqBits.length + 1));
      flickerRef.current.push(reset);
      return;
    }
    // Clean input: a crisp HIGH while held.
    setPressed(true);
    setReadout("digitalRead(D2) = 1  → PRESSED");
  }, [phase, wired, clearFlicker]);

  const releaseInput = useCallback(() => {
    if (!wired) return;
    setPressed(false);
    setReadout("digitalRead(D2) = 0");
  }, [wired]);

  const setCellNote = useCallback(
    (i: number, note: Note) => {
      if (phase === "playing") return;
      setSeq((prev) => {
        const next = prev.slice();
        next[i] = { ...next[i], note };
        return next;
      });
      setHint("");
    },
    [phase],
  );

  const toggleDur = useCallback(
    (i: number) => {
      if (phase === "playing") return;
      setSeq((prev) => {
        const next = prev.slice();
        next[i] = {
          ...next[i],
          dur: next[i].dur === "short" ? "long" : "short",
        };
        return next;
      });
      setHint("");
    },
    [phase],
  );

  /** Press the DOOR button → run the program: sweep + buzz + flash LED ×3. */
  const runProgram = useCallback(() => {
    if (phase === "playing" || phase === "won") return;

    if (!wired) {
      setHint("The door button can't be read yet — wire the resistor first.");
      return;
    }
    if (!melodyOk) {
      const where = firstWrong >= 0 ? firstWrong + 1 : 1;
      setHint(`Note ${where} doesn't match the target yet — compare it tile-by-tile.`);
      if (!completedRef.current) {
        onComplete({
          passed: false,
          detail: `Note ${where} doesn't match yet — keep tuning the melody.`,
        });
      }
      return;
    }

    // All conditions met → deterministic play-through.
    clearTimers();
    setHint("");
    setPhase("playing");
    setFlashes(0);
    setActive(-1);

    let clock = 0;
    const GAP = 90;
    // Sweep the play head across each note. Long notes hold a touch longer.
    seq.forEach((s, i) => {
      const t = window.setTimeout(() => setActive(i), clock);
      timersRef.current.push(t);
      clock += (s.dur === "long" ? 620 : 380) + GAP;
    });

    // After the melody, flash the LED three times.
    for (let f = 0; f < 3; f++) {
      const on = window.setTimeout(() => {
        setActive(-1);
        setLedOn(true);
        setFlashes((n) => n + 1);
      }, clock);
      const off = window.setTimeout(() => setLedOn(false), clock + 180);
      timersRef.current.push(on, off);
      clock += 360;
    }

    // Win.
    const fin = window.setTimeout(() => {
      setPhase("won");
      if (!completedRef.current) {
        completedRef.current = true;
        onComplete({
          passed: true,
          stars: 3,
          detail: "Button input wired clean and the doorbell tune plays in sequence!",
        });
      }
    }, clock + 120);
    timersRef.current.push(fin);
  }, [phase, wired, melodyOk, firstWrong, seq, clearTimers, onComplete]);

  const handleReset = useCallback(() => {
    clearTimers();
    clearFlicker();
    setWired(false);
    setDragOver(false);
    setPressed(false);
    setReadout("digitalRead(D2) = 0");
    setSeq(freshSequence());
    setActive(-1);
    setFlashes(0);
    setLedOn(false);
    setPhase("build");
    setHint("");
  }, [clearTimers, clearFlicker]);

  const status = useMemo<string>(() => {
    if (phase === "won") return "Ding dong! Someone's at the door 🔔";
    if (phase === "playing") return "Running tone() sequence…";
    if (!wired) return "Step 1: drag the pull-down resistor into the circuit.";
    if (!melodyOk) return `Step 2: copy the target tune — ${matches.filter(Boolean).length}/${STEPS} notes matched.`;
    return "Step 3: press the door button to play your doorbell!";
  }, [phase, wired, melodyOk, matches]);

  const playing = phase === "playing";

  return (
    <div className="flex w-full flex-col gap-3 text-ink" style={{ maxWidth: 440 }}>
      <style>{`
        @keyframes g4doorbelltones-buzz {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-1.5px); }
          75% { transform: translateX(1.5px); }
        }
        @keyframes g4doorbelltones-ring {
          0% { box-shadow: 0 0 0 0 ${ACCENT}66; }
          100% { box-shadow: 0 0 0 10px ${ACCENT}00; }
        }
        @keyframes g4doorbelltones-pop {
          0% { transform: scale(0.6); opacity: 0; }
          60% { transform: scale(1.08); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>

      {/* ---------------- SCENE ---------------- */}
      <div className="panel relative overflow-hidden rounded-xl p-3">
        <svg
          viewBox="0 0 320 170"
          className="block h-auto w-full"
          role="img"
          aria-label="A door with a push button, a controller box, a buzzer and an indicator LED"
        >
          {/* door */}
          <rect x="14" y="20" width="92" height="132" rx="4" fill="#1b2433" stroke="#2c3a4f" strokeWidth="2" />
          <rect x="22" y="30" width="76" height="50" rx="3" fill="#141c28" />
          <rect x="22" y="92" width="76" height="50" rx="3" fill="#141c28" />
          <circle cx="92" cy="92" r="3.5" fill="#b08d57" />
          {/* push button on the door frame */}
          <g
            transform="translate(118 70)"
            onPointerDown={tapInput}
            onPointerUp={releaseInput}
            onPointerLeave={releaseInput}
            style={{ cursor: playing ? "default" : "pointer", touchAction: "manipulation" }}
          >
            <circle cx="0" cy="0" r="13" fill="#0e1622" stroke="#2c3a4f" strokeWidth="2" />
            <circle cx="0" cy="0" r="8" fill={pressed ? ACCENT : "#33415a"} stroke={pressed ? "#fff" : "#1b2433"} strokeWidth="1.5" style={pressed ? { animation: "g4doorbelltones-ring 0.5s ease-out" } : undefined} />
            <text x="0" y="26" fontSize="7" textAnchor="middle" fill="#9aa6b2" className="font-mono">BUTTON</text>
          </g>

          {/* controller box */}
          <g transform="translate(150 96)">
            <rect x="0" y="0" width="86" height="58" rx="5" fill="#10331f" stroke="#1f6b3f" strokeWidth="1.5" />
            <text x="43" y="14" fontSize="7" textAnchor="middle" fill="#34d399" className="font-mono">CONTROLLER</text>
            {Array.from({ length: 6 }, (_, i) => (
              <rect key={`pin${i}`} x={8 + i * 12} y={46} width="6" height="8" rx="1" fill="#facc15" />
            ))}
            <rect x="30" y="22" width="26" height="14" rx="2" fill="#0c2417" stroke="#1f6b3f" strokeWidth="1" />
            <text x="43" y="32" fontSize="6.5" textAnchor="middle" fill="#9aa6b2" className="font-mono">D2</text>
          </g>

          {/* passive buzzer */}
          <g transform="translate(258 28)" style={active >= 0 ? { animation: "g4doorbelltones-buzz 0.16s linear infinite" } : undefined}>
            <circle cx="22" cy="22" r="20" fill="#0e1622" stroke={active >= 0 ? ACCENT : "#2c3a4f"} strokeWidth="2" />
            <circle cx="22" cy="22" r="5" fill={active >= 0 ? ACCENT : "#33415a"} />
            {active >= 0 &&
              [9, 13, 17].map((r) => (
                <circle key={`wv${r}`} cx="22" cy="22" r={r} fill="none" stroke={ACCENT} strokeWidth="1" opacity={(20 - r) / 20} />
              ))}
            <text x="22" y="56" fontSize="7" textAnchor="middle" fill="#9aa6b2" className="font-mono">BUZZER</text>
            {active >= 0 && (
              <text x="22" y="22" dy="3" fontSize="11" textAnchor="middle" fill="#05070d" className="font-mono" style={{ fontWeight: 700 }}>{seq[active].note}</text>
            )}
          </g>

          {/* indicator LED */}
          <g transform="translate(266 96)">
            <circle cx="12" cy="22" r="11" fill={ledOn ? "#fde047" : "#2a2a1a"} stroke={ledOn ? "#fde047" : "#3a3a28"} strokeWidth="2" style={ledOn ? { filter: "drop-shadow(0 0 6px #fde047)" } : undefined} />
            <text x="12" y="48" fontSize="7" textAnchor="middle" fill="#9aa6b2" className="font-mono">LED</text>
          </g>

          {/* wire from button to D2 */}
          <path d="M131 70 C150 70 150 118 150 118" fill="none" stroke={wired ? ACCENT : "#33415a"} strokeWidth="2" strokeDasharray={wired ? "0" : "4 4"} />
        </svg>

        <div className="mt-1 flex items-center justify-between gap-2 px-1 font-mono text-[11px]" role="status" aria-live="polite">
          <span style={phase === "won" ? { color: ACCENT } : undefined} className={phase === "won" ? "" : "text-ink-dim"}>{status}</span>
          <span className="tabular-nums text-ink-faint" aria-label={`LED flashed ${flashes} times`}>flashes: {flashes}/3</span>
        </div>
      </div>

      {/* ---------------- PART 1: WIRE THE INPUT ---------------- */}
      <div className="flex flex-col gap-2 rounded-xl border border-line bg-panel/60 p-3">
        <p className="font-mono text-[11px] uppercase tracking-tech text-ink-faint">
          1 · Digital input — give D2 a clean read
        </p>
        <div className="flex items-center gap-3">
          {/* draggable resistor block */}
          <button
            type="button"
            draggable={!wired}
            onDragStart={(e) => e.dataTransfer.setData("text/plain", "resistor")}
            onClick={!wired ? handleWire : undefined}
            disabled={wired}
            aria-label="Pull-down resistor block. Drag or tap to drop it into the wiring slot."
            className="rounded-md border px-3 py-2 font-mono text-xs disabled:opacity-40"
            style={{
              borderColor: wired ? "#2c3a4f" : ACCENT,
              color: wired ? "#566173" : ACCENT,
              cursor: wired ? "default" : "grab",
              touchAction: "manipulation",
            }}
          >
            ▭ 10kΩ pull-down
          </button>
          <span aria-hidden className="text-ink-faint">→</span>
          {/* wiring slot (drop target) */}
          <div
            onDragOver={(e) => {
              if (wired) return;
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.getData("text/plain") === "resistor") handleWire();
            }}
            role="group"
            aria-label={wired ? "Wiring slot — resistor placed" : "Empty wiring slot"}
            className="flex flex-1 items-center justify-center rounded-md border-2 border-dashed py-2 font-mono text-xs transition"
            style={{
              borderColor: wired ? ACCENT : dragOver ? ACCENT : "#33415a",
              background: wired ? `${ACCENT}14` : "transparent",
              color: wired ? ACCENT : "#566173",
            }}
          >
            {wired ? "✓ resistor wired" : "drop resistor here"}
          </div>
        </div>
        <p className="rounded bg-black/30 px-2 py-1 font-mono text-[11px]" style={{ color: readout.includes("PRESSED") ? ACCENT : readout.includes("⚠") ? "#fbbf24" : "#9aa6b2" }}>
          {readout}
        </p>
        <p className="text-[10px] leading-tight text-ink-faint">
          Hold the door button above to read D2. A floating pin reads noisy 1…0…1; a pull-down keeps it a clean 0 until pressed.
        </p>
      </div>

      {/* ---------------- PART 2: COMPOSE THE MELODY ---------------- */}
      <div className="flex flex-col gap-2 rounded-xl border border-line bg-panel/60 p-3">
        <p className="font-mono text-[11px] uppercase tracking-tech text-ink-faint">
          2 · Compose — copy the target tone() sequence
        </p>

        {/* target tiles to copy */}
        <div className="flex items-center gap-1.5">
          <span className="w-12 shrink-0 font-mono text-[10px] text-ink-faint">target</span>
          <div className="flex flex-1 gap-1.5">
            {TARGET.map((s, i) => (
              <div
                key={`tg${i}`}
                className="flex flex-1 flex-col items-center rounded-md py-1 font-mono text-[11px]"
                style={{ background: `${NOTE_COLOR[s.note]}22`, border: `1px solid ${NOTE_COLOR[s.note]}` }}
                aria-label={`Target note ${i + 1}: ${s.note} ${s.dur}`}
              >
                <span style={{ color: NOTE_COLOR[s.note], fontWeight: 700 }}>{s.note}</span>
                <span className="text-ink-faint">{s.dur === "long" ? "▮▮" : "▮"}</span>
              </div>
            ))}
          </div>
        </div>

        {/* learner's note strip */}
        <div className="flex items-center gap-1.5">
          <span className="w-12 shrink-0 font-mono text-[10px] text-ink-faint">yours</span>
          <div className="flex flex-1 gap-1.5">
            {seq.map((s, i) => {
              const ok = matches[i];
              const isHead = active === i;
              return (
                <div
                  key={`cell${i}`}
                  className="flex flex-1 flex-col items-center rounded-md py-1 font-mono text-[11px]"
                  style={{
                    background: ok ? "#34d39922" : "#0e1622",
                    border: `1px solid ${isHead ? ACCENT : ok ? "#34d399" : "#33415a"}`,
                    transform: isHead ? "translateY(-2px)" : undefined,
                    transition: "transform .1s ease",
                  }}
                  aria-label={`Your note ${i + 1}: ${s.note} ${s.dur}${ok ? " — matches target" : ""}`}
                >
                  <span style={{ color: ok ? "#34d399" : NOTE_COLOR[s.note], fontWeight: 700 }}>{s.note}</span>
                  <button
                    type="button"
                    onClick={() => toggleDur(i)}
                    disabled={playing}
                    aria-label={`Note ${i + 1} duration: ${s.dur}. Tap to toggle.`}
                    className="text-ink-faint disabled:opacity-50"
                    style={{ touchAction: "manipulation" }}
                  >
                    {s.dur === "long" ? "▮▮" : "▮"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* note pads — tap a cell-row? we let the learner set each cell's note via pads */}
        <div className="flex flex-col gap-1.5">
          <span className="font-mono text-[10px] text-ink-faint">
            Pick a note for each cell · tap a pad below a cell number
          </span>
          {seq.map((s, i) => (
            <div key={`pads${i}`} className="flex items-center gap-1.5">
              <span className="w-12 shrink-0 font-mono text-[10px] text-ink-faint">cell {i + 1}</span>
              <div className="flex flex-1 gap-1" role="group" aria-label={`Note pads for cell ${i + 1}`}>
                {NOTES.map((n) => {
                  const sel = s.note === n;
                  return (
                    <button
                      key={n}
                      type="button"
                      onPointerDown={() => setCellNote(i, n)}
                      disabled={playing}
                      aria-label={`Set cell ${i + 1} to note ${n}`}
                      aria-pressed={sel}
                      className="flex-1 rounded py-1 font-mono text-[11px] transition disabled:opacity-50"
                      style={{
                        background: sel ? NOTE_COLOR[n] : "#0e1622",
                        color: sel ? "#05070d" : NOTE_COLOR[n],
                        border: `1px solid ${NOTE_COLOR[n]}55`,
                        fontWeight: sel ? 700 : 400,
                        touchAction: "manipulation",
                      }}
                    >
                      {n}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ---------------- PART 3: TRIGGER + CONTROLS ---------------- */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={handleReset}
          className="rounded-lg border border-line bg-panel/60 px-4 py-2 text-sm font-medium text-ink-dim"
          aria-label="Reset the lab"
        >
          Reset
        </button>
        <button
          type="button"
          onClick={runProgram}
          disabled={playing || phase === "won"}
          className="rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60"
          style={{ background: ACCENT, color: "#05070d", touchAction: "manipulation" }}
          aria-label="Press the door button to run the program"
        >
          {playing ? "Playing…" : phase === "won" ? "Done ✓" : "Press door button ▶"}
        </button>
      </div>

      {/* hint line */}
      {hint && phase !== "won" && (
        <p className="font-mono text-[11px]" style={{ color: "#fbbf24" }} role="status" aria-live="polite">
          {hint}
        </p>
      )}

      {/* win celebration */}
      {phase === "won" && (
        <div
          className="flex flex-col items-center gap-1 rounded-xl p-4 text-center"
          style={{
            border: `1px solid ${ACCENT}`,
            background: `${ACCENT}12`,
            animation: "g4doorbelltones-pop 0.4s ease-out",
          }}
          role="status"
          aria-live="polite"
        >
          <span className="text-2xl" aria-hidden>✨🎉🔔</span>
          <p className="font-display text-sm" style={{ color: ACCENT }}>
            Ding dong! Someone&apos;s at the door
          </p>
          <p className="text-[11px] text-ink-dim">
            Clean input · 5 notes matched · LED flashed 3 times
          </p>
          <span className="text-lg" aria-label="three stars">⭐⭐⭐</span>
        </div>
      )}
    </div>
  );
}
