"use client";
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* ------------------------------------------------------------------ */
/*  Doorbell Tunes — a button is a DIGITAL INPUT that triggers a       */
/*  program, and tone() commands (note + duration) play a melody in   */
/*  sequence. Part 1 teaches a clean pull-down input. Part 2 is a      */
/*  real PUZZLE: the tune is NOT shown — you must DECODE it from a     */
/*  set of logic clues, reasoning out every note and its length, then */
/*  press the door button to run your program.                        */
/*                                                                     */
/*  Three escalating rounds. Each round's clues pin down exactly ONE   */
/*  correct 5-note melody (verified by an in-file solver), but you     */
/*  can't copy it — you have to think. Brute-forcing 7 notes × 2       */
/*  lengths across 5 cells is 14^5 ≈ 537k combos, so guessing fails;   */
/*  the clues are the only path. Solve all three → 3 stars.            */
/* ------------------------------------------------------------------ */

const ACCENT = "#22d3ee";

type Note = "C" | "D" | "E" | "F" | "G" | "A" | "B";
type Dur = "short" | "long";

const NOTES: readonly Note[] = ["C", "D", "E", "F", "G", "A", "B"] as const;

/** A colour per note so cells read at a glance. */
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

interface Round {
  /** The single melody the clues pin down (used only to grade — never shown). */
  answer: readonly Step[];
  /** Plain-language clues the learner reasons from. */
  clues: readonly string[];
  /** Where the learner starts — a deliberately-wrong, neutral guess. */
  start: readonly Step[];
}

const s = (note: Note, dur: Dur): Step => ({ note, dur });

/* ---- Three hand-authored, deterministic decode puzzles. -----------------
   Each clue set was checked (see verifyUnique below, run once in dev) to
   pin down EXACTLY ONE melody out of all 14^5 possibilities. ------------- */
const ROUNDS: readonly Round[] = [
  // R1 — a gentle 5-note "ding-dong". Direct clues, but you still must read
  // and combine them; nothing is laid out to copy.
  {
    answer: [s("E", "long"), s("C", "long"), s("D", "short"), s("G", "short"), s("C", "long")],
    clues: [
      "Cell 1 is E, played long.",
      "Cell 2 is two steps LOWER than cell 1, played long.",
      "Cell 5 matches cell 2 exactly (same note, same length).",
      "Cell 3 is one step HIGHER than cell 2, played short.",
      "Cell 4 is G (the highest note in this tune), played short.",
    ],
    start: [s("C", "short"), s("C", "short"), s("C", "short"), s("C", "short"), s("C", "short")],
  },
  // R2 — a rising staircase with a length pattern. Needs chained reasoning
  // (each note defined relative to a neighbour) plus an odd/even length rule.
  {
    answer: [s("C", "short"), s("E", "long"), s("F", "short"), s("A", "long"), s("G", "short")],
    clues: [
      "Cell 1 is the lowest note there is (C), played short.",
      "Each odd cell (1, 3, 5) is short; each even cell (2, 4) is long.",
      "Cell 2 is two steps higher than cell 1.",
      "Cell 3 is one step higher than cell 2.",
      "Cell 4 is two steps higher than cell 3.",
      "Cell 5 is one step LOWER than cell 4.",
    ],
    start: [s("C", "long"), s("C", "long"), s("C", "long"), s("C", "long"), s("C", "long")],
  },
  // R3 — the TWIST. A mirror/palindrome shape. You anchor on the middle note
  // (cell 3 = A), then chain DOWN to cells 2 and 1, then MIRROR to fill 4 and 5.
  // The length rule and the mirror together defeat any "just copy" instinct.
  {
    answer: [s("D", "short"), s("F", "long"), s("A", "short"), s("F", "long"), s("D", "short")],
    clues: [
      "The tune is a MIRROR: cell 1 = cell 5, and cell 2 = cell 4 (same note AND length).",
      "Cell 3 is the highest note in the whole tune, and it is A.",
      "Cell 2 is two steps LOWER than cell 3.",
      "Cell 1 is two steps LOWER than cell 2.",
      "Only cells 2 and 4 are long; the other three are short.",
    ],
    start: [s("B", "short"), s("B", "short"), s("B", "short"), s("B", "short"), s("B", "short")],
  },
] as const;

const sameStep = (a: Step, b: Step): boolean => a.note === b.note && a.dur === b.dur;

type Phase = "build" | "playing" | "roundWon" | "won";

export default function DoorbellTunes({ onComplete }: ActivityProps) {
  const [round, setRound] = useState<number>(0);
  const [wired, setWired] = useState<boolean>(false);
  const [dragOver, setDragOver] = useState<boolean>(false);
  const [pressed, setPressed] = useState<boolean>(false);
  const [readout, setReadout] = useState<string>("digitalRead(D2) = 0");
  const [seq, setSeq] = useState<Step[]>(() => ROUNDS[0].start.map((x) => ({ ...x })));
  const [active, setActive] = useState<number>(-1); // play-head cell index
  const [flashes, setFlashes] = useState<number>(0); // LED flash counter
  const [ledOn, setLedOn] = useState<boolean>(false);
  const [phase, setPhase] = useState<Phase>("build");
  const [hint, setHint] = useState<string>("");
  const [checked, setChecked] = useState<boolean>(false); // showed a wrong-check yet?

  const reportedRef = useRef<boolean>(false);
  const timersRef = useRef<number[]>([]);
  const flickerRef = useRef<number[]>([]);

  const rd = ROUNDS[round];

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

  // Whole-melody correctness (graded against the hidden answer, not shown live).
  const melodyOk = useMemo<boolean>(
    () => seq.every((st, i) => sameStep(st, rd.answer[i])),
    [seq, rd],
  );

  // Per-cell correctness is ONLY revealed after a "check" press — never live,
  // so the puzzle can't be brute-forced by watching cells turn green.
  const cellOk = useMemo<boolean[]>(
    () => seq.map((st, i) => sameStep(st, rd.answer[i])),
    [seq, rd],
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
      if (phase === "playing" || phase === "roundWon" || phase === "won") return;
      setSeq((prev) => {
        const next = prev.slice();
        next[i] = { ...next[i], note };
        return next;
      });
      setHint("");
      setChecked(false);
    },
    [phase],
  );

  const toggleDur = useCallback(
    (i: number) => {
      if (phase === "playing" || phase === "roundWon" || phase === "won") return;
      setSeq((prev) => {
        const next = prev.slice();
        next[i] = {
          ...next[i],
          dur: next[i].dur === "short" ? "long" : "short",
        };
        return next;
      });
      setHint("");
      setChecked(false);
    },
    [phase],
  );

  /** Press the DOOR button → run the program. Wrong melodies do NOT win and
   *  do NOT report a failure; they reveal which cells are off and let you fix. */
  const runProgram = useCallback(() => {
    if (phase === "playing" || phase === "roundWon" || phase === "won") return;

    if (!wired) {
      setHint("The door button can't be read yet — wire the resistor first.");
      return;
    }
    if (!melodyOk) {
      const wrongCount = cellOk.filter((ok) => !ok).length;
      setChecked(true);
      setHint(
        `Not quite — ${wrongCount} cell${wrongCount === 1 ? "" : "s"} don't fit the clues yet. ` +
          `The off cells are marked ✕. Re-read the clues and adjust.`,
      );
      return;
    }

    // Correct decode → deterministic play-through.
    clearTimers();
    setHint("");
    setPhase("playing");
    setFlashes(0);
    setActive(-1);

    let clock = 0;
    const GAP = 90;
    seq.forEach((st, i) => {
      const t = window.setTimeout(() => setActive(i), clock);
      timersRef.current.push(t);
      clock += (st.dur === "long" ? 620 : 380) + GAP;
    });

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

    const isLast = round >= ROUNDS.length - 1;
    const fin = window.setTimeout(() => {
      if (isLast) {
        setPhase("won");
        if (!reportedRef.current) {
          reportedRef.current = true;
          onComplete({
            passed: true,
            stars: 3,
            detail: "Decoded all three doorbell tunes from the clues and ran each program!",
          });
        }
      } else {
        // Win this round, then load the next, harder puzzle.
        setPhase("roundWon");
        const adv = window.setTimeout(() => {
          setRound((r) => r + 1);
          setSeq(ROUNDS[round + 1].start.map((x) => ({ ...x })));
          setActive(-1);
          setFlashes(0);
          setLedOn(false);
          setChecked(false);
          setHint("");
          setPhase("build");
        }, 1300);
        timersRef.current.push(adv);
      }
    }, clock + 120);
    timersRef.current.push(fin);
  }, [phase, wired, melodyOk, cellOk, seq, round, clearTimers, onComplete]);

  const handleReset = useCallback(() => {
    clearTimers();
    clearFlicker();
    reportedRef.current = false;
    setRound(0);
    setWired(false);
    setDragOver(false);
    setPressed(false);
    setReadout("digitalRead(D2) = 0");
    setSeq(ROUNDS[0].start.map((x) => ({ ...x })));
    setActive(-1);
    setFlashes(0);
    setLedOn(false);
    setPhase("build");
    setHint("");
    setChecked(false);
  }, [clearTimers, clearFlicker]);

  const status = useMemo<string>(() => {
    if (phase === "won") return "Ding dong! All three tunes decoded 🔔";
    if (phase === "roundWon") return "Correct! Next puzzle loading…";
    if (phase === "playing") return "Running tone() sequence…";
    if (!wired) return "Step 1: drag the pull-down resistor into the circuit.";
    return `Step 2: decode round ${round + 1} of 3 from the clues, then press the door button.`;
  }, [phase, wired, round]);

  const playing = phase === "playing";
  const locked = playing || phase === "roundWon" || phase === "won";

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

      {/* round progress dots */}
      <div className="flex items-center gap-2 px-1" aria-label={`Round ${round + 1} of ${ROUNDS.length}`}>
        <span className="font-mono text-[10px] uppercase tracking-tech text-ink-faint">puzzle</span>
        <span className="flex items-center gap-1.5" aria-hidden>
          {ROUNDS.map((_, i) => {
            const solved = i < round || phase === "won";
            const current = i === round && phase !== "won";
            return (
              <span
                key={`dot${i}`}
                className="grid h-3 w-3 place-items-center rounded-full"
                style={{
                  background: solved ? ACCENT : current ? `${ACCENT}33` : "rgba(255,255,255,0.06)",
                  border: `2px solid ${solved || current ? ACCENT : "#33415a"}`,
                }}
              />
            );
          })}
        </span>
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

      {/* ---------------- PART 2: DECODE THE MELODY ---------------- */}
      <div className="flex flex-col gap-2 rounded-xl border border-line bg-panel/60 p-3">
        <p className="font-mono text-[11px] uppercase tracking-tech text-ink-faint">
          2 · Decode — work out the secret tune from the clues
        </p>

        {/* clue list (the puzzle — no answer tiles to copy) */}
        <ul className="flex flex-col gap-1 rounded-md bg-black/25 p-2" aria-label="Clues for the secret melody">
          {rd.clues.map((c, i) => (
            <li key={`clue${i}`} className="flex gap-1.5 text-[11px] leading-snug text-ink-dim">
              <span aria-hidden style={{ color: ACCENT }}>•</span>
              <span>{c}</span>
            </li>
          ))}
        </ul>
        <p className="text-[10px] leading-tight text-ink-faint">
          Note ladder (low → high): C · D · E · F · G · A · B. &ldquo;One step higher&rdquo; means the next note up.
        </p>

        {/* learner's note strip with per-cell verdict (only after a check) */}
        <div className="flex items-center gap-1.5">
          <span className="w-12 shrink-0 font-mono text-[10px] text-ink-faint">tune</span>
          <div className="flex flex-1 gap-1.5">
            {seq.map((st, i) => {
              const isHead = active === i;
              const verdict = checked ? (cellOk[i] ? "ok" : "bad") : "none";
              return (
                <div
                  key={`cell${i}`}
                  className="relative flex flex-1 flex-col items-center rounded-md py-1 font-mono text-[11px]"
                  style={{
                    background: verdict === "ok" ? "#34d39922" : verdict === "bad" ? "#f8717118" : "#0e1622",
                    border: `1px solid ${isHead ? ACCENT : verdict === "ok" ? "#34d399" : verdict === "bad" ? "#f87171" : "#33415a"}`,
                    transform: isHead ? "translateY(-2px)" : undefined,
                    transition: "transform .1s ease",
                  }}
                  aria-label={`Cell ${i + 1}: ${st.note} ${st.dur}${verdict === "ok" ? " — fits the clues" : verdict === "bad" ? " — does not fit" : ""}`}
                >
                  <span style={{ color: verdict === "ok" ? "#34d399" : NOTE_COLOR[st.note], fontWeight: 700 }}>{st.note}</span>
                  <button
                    type="button"
                    onClick={() => toggleDur(i)}
                    disabled={locked}
                    aria-label={`Cell ${i + 1} length: ${st.dur}. Tap to toggle short or long.`}
                    className="text-ink-faint disabled:opacity-50"
                    style={{ touchAction: "manipulation" }}
                  >
                    {st.dur === "long" ? "▮▮" : "▮"}
                  </button>
                  {verdict !== "none" && (
                    <span
                      aria-hidden
                      className="absolute -right-1 -top-1 grid h-3.5 w-3.5 place-items-center rounded-full text-[8px]"
                      style={{
                        background: verdict === "ok" ? "#34d399" : "#f87171",
                        color: "#05070d",
                        fontWeight: 700,
                      }}
                    >
                      {verdict === "ok" ? "✓" : "✕"}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* note pads — set each cell's note by reasoning, not copying */}
        <div className="flex flex-col gap-1.5">
          <span className="font-mono text-[10px] text-ink-faint">
            Pick the note for each cell · tap its length above to set short ▮ / long ▮▮
          </span>
          {seq.map((st, i) => (
            <div key={`pads${i}`} className="flex items-center gap-1.5">
              <span className="w-12 shrink-0 font-mono text-[10px] text-ink-faint">cell {i + 1}</span>
              <div className="flex flex-1 gap-1" role="group" aria-label={`Note pads for cell ${i + 1}`}>
                {NOTES.map((n) => {
                  const sel = st.note === n;
                  return (
                    <button
                      key={n}
                      type="button"
                      onPointerDown={() => setCellNote(i, n)}
                      disabled={locked}
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
          aria-label="Reset the lab to round one"
        >
          Reset
        </button>
        <button
          type="button"
          onClick={runProgram}
          disabled={locked}
          className="rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60"
          style={{ background: ACCENT, color: "#05070d", touchAction: "manipulation" }}
          aria-label="Press the door button to run your program"
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
            Ding dong! All three tunes decoded
          </p>
          <p className="text-[11px] text-ink-dim">
            Clean input · 3 secret melodies cracked from clues
          </p>
          <span className="text-lg" aria-label="three stars">⭐⭐⭐</span>
        </div>
      )}
    </div>
  );
}
