"use client";
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* ── Assistive Design Studio 🦾 ───────────────────────────────────────────────
   CLASS 4-6 (explorer, age ~9-11). Subject: AI / design thinking.
   ONE big idea: GOOD DESIGN STARTS WITH EMPATHY. The SAME alert is NOT right for
   everyone — you must reason from one real person's body & life to the device.

   This is a 3-CLIENT studio, not a one-tap quiz. You run a small design firm and
   must ship a working device for THREE different clients, one harder than the
   last. For EACH client you choose ONE sensor (which EVENT to detect) and ONE
   alert (which SENSE it reaches), then press TEST to run a deterministic
   scenario. A 3-point rubric — Works? · Notice? · Easy? — must ALL light green.

   Why it's a real problem, not luck:
   • The client's need describes a SITUATION, never names the sensor. You reason
     "which event would warn them?" — and several sensors look tempting (decoys).
   • Each alert reaches ONE sense (feel / see-big / see-small / hear / sound).
     A small light works for a Deaf reader but NOT a low-vision elder; a loud
     buzzer works for low-vision but NOT a Deaf user. No single alert wins twice.
   • Round 3 is the TWIST: the client can sense any alert fine, but their hands
     tire — so the EASY rubric (gentle sensor AND gentle output) becomes the
     real puzzle, and the "obvious" detector is a trap.

   OPTIMIZATION → STARS. Ship all three with a clean head (no failed tests, no
   hints) = ⭐⭐⭐. One slip or one peeked hint = ⭐⭐. More = ⭐. A clean win is
   always reachable. onComplete(passed:true) fires EXACTLY ONCE (ref-guarded).
   Wrong tests NEVER fire onComplete — gentle retry, keep the plan. Deterministic,
   strict-clean, timers cleared on unmount, prefers-reduced-motion respected. */

const ACCENT = "#a855f7";
const OK = "#34d399";
const BAD = "#f87171";

type SensorId =
  | "doorbell"
  | "ultrasonic"
  | "light"
  | "touchpad"
  | "tinyswitch"
  | "heat";
type AlertId =
  | "vibration"
  | "flashlamp"
  | "tinyled"
  | "buzzer"
  | "chime"
  | "bigbutton";
type PersonaId = "deaf" | "lowvision" | "grip";

/** How an alert reaches a person. "seebig" = large visible flash; "seesmall" =
 *  tiny indicator light; "feel" = touch/vibration; "hear" = audible. */
type Channel = "feel" | "seebig" | "seesmall" | "hear";

/** What KIND of event a sensor watches. The client's need maps to one kind;
 *  several sensors can share a kind so the learner must reason past the label. */
type EventKind = "doorbell" | "obstacle" | "dark" | "call" | "stove";

interface Sensor {
  id: SensorId;
  emoji: string;
  name: string;
  /** The category of event this sensor detects. */
  kind: EventKind;
  /** The real-world EVENT this sensor detects (shown so the learner reasons). */
  detects: string;
  /** True when triggering it needs no precise/strong press (gentle input). */
  gentle: boolean;
}

interface Alert {
  id: AlertId;
  emoji: string;
  name: string;
  /** The single sense this alert reaches the person through. */
  channel: Channel;
  /** True when operating/wearing it needs no precise grip or strength. */
  gentle: boolean;
}

interface Persona {
  id: PersonaId;
  emoji: string;
  name: string;
  tag: string;
  /** A SITUATION to solve — never names the sensor or the answer. */
  brief: string;
  /** The KIND of event the right sensor must detect for THIS client. */
  wantKind: EventKind;
  /** Channels this client can actually notice. */
  okChannels: Channel[];
  /** True when this client needs gentle input AND output (tired hands). */
  needsGentle: boolean;
  /** Socratic nudge — names the constraint, never the answer. */
  hint: string;
}

const SENSORS: readonly Sensor[] = [
  { id: "doorbell", emoji: "🔔", name: "Doorbell sensor", kind: "doorbell", detects: "the front-door bell is pressed", gentle: true },
  { id: "ultrasonic", emoji: "📡", name: "Obstacle sensor", kind: "obstacle", detects: "an object is close in the path ahead", gentle: true },
  { id: "light", emoji: "🔆", name: "Light sensor", kind: "dark", detects: "the room gets dark", gentle: true },
  // Two ways to "call for help": a gentle big pad, and a fiddly tiny switch.
  { id: "touchpad", emoji: "🖐️", name: "Big touch pad", kind: "call", detects: "a wide pad is lightly tapped to call", gentle: true },
  { id: "tinyswitch", emoji: "🎚️", name: "Tiny push switch", kind: "call", detects: "a small stiff switch is pressed to call", gentle: false },
  { id: "heat", emoji: "🔥", name: "Heat sensor", kind: "stove", detects: "the stove is left switched on", gentle: true },
];

const ALERTS: readonly Alert[] = [
  { id: "vibration", emoji: "📳", name: "Vibration band", channel: "feel", gentle: true },
  { id: "flashlamp", emoji: "💡", name: "Big flashing lamp", channel: "seebig", gentle: true },
  { id: "tinyled", emoji: "🔹", name: "Tiny LED dot", channel: "seesmall", gentle: true },
  { id: "buzzer", emoji: "🔊", name: "Loud buzzer", channel: "hear", gentle: true },
  { id: "chime", emoji: "🎵", name: "Soft chime", channel: "hear", gentle: true },
  { id: "bigbutton", emoji: "🟢", name: "Big easy paddle", channel: "feel", gentle: true },
];

// Three CLIENTS, escalating. Order is fixed = deterministic.
const PERSONAS: readonly Persona[] = [
  {
    id: "deaf",
    emoji: "🧒",
    name: "Mira",
    tag: "Deaf",
    brief: "Mira is Deaf. She keeps missing visitors at the front door because she can't tell when someone has arrived.",
    wantKind: "doorbell",
    okChannels: ["feel", "seebig", "seesmall"], // any visual or touch; NOT sound
    needsGentle: false,
    hint: "She can't hear at all. Detect the right door event, and pick an alert her eyes or skin can catch — never her ears.",
  },
  {
    id: "lowvision",
    emoji: "👵",
    name: "Nani",
    tag: "Low vision",
    brief: "Nani has very low vision. While walking through her home she bumps into furniture and boxes left in the way.",
    wantKind: "obstacle",
    okChannels: ["feel", "hear"], // big lamp is still a light → can't see it; tiny LED no
    needsGentle: false,
    hint: "She can barely see, even big flashes. Detect what's in her PATH, and warn her through sound or touch.",
  },
  {
    id: "grip",
    emoji: "🧑",
    name: "Sam",
    tag: "Tired hands",
    brief: "Sam's hands tire fast and his fingers are weak, but his eyes and ears work fine. He wants to call for help from his chair. TWO sensors can sense a 'call' — but only one is gentle on weak hands.",
    wantKind: "call", // BOTH call sensors detect it; only the gentle one passes Easy
    okChannels: ["feel", "seebig", "seesmall", "hear"], // any sense works
    needsGentle: true, // BUT input AND output must be gentle
    hint: "Sam can sense any alert — that's not the puzzle. Two sensors both detect a 'call', but a tiny stiff switch hurts weak hands. Choose the gentle, easy-to-press input.",
  },
];

type Phase = "build" | "testing" | "roundwin" | "win" | "miss";

interface Verdict {
  works: boolean;
  notice: boolean;
  easy: boolean;
  /** A short, never-scolding nudge when something doesn't fit yet. */
  note: string;
}

/** Deterministic, pure rubric. No randomness — always reproducible. */
function evaluate(p: Persona, s: Sensor, a: Alert): Verdict {
  // WORKS: the chosen sensor detects THIS client's KIND of event. (For Sam,
  // both "call" sensors satisfy WORKS — the gentle one is sorted out by EASY.)
  const works = s.kind === p.wantKind;
  // NOTICE: the alert reaches a sense this client can actually use.
  const notice = p.okChannels.includes(a.channel);
  // EASY: for a gentle-handed client BOTH the input and output must be gentle;
  // otherwise any device passes the easy check.
  const easy = !p.needsGentle || (s.gentle && a.gentle);

  let note = "Looks like a kind fit — press TEST! ✨";
  if (!works) {
    note = "That sensor watches the wrong thing. Which EVENT would actually warn this client?";
  } else if (!notice) {
    if (a.channel === "hear") note = "A sound alert — can this client really hear it?";
    else if (a.channel === "seebig") note = "A bright light — can this client see it well enough?";
    else if (a.channel === "seesmall") note = "A tiny light — will this client ever spot it?";
    else note = "Will this client notice this alert?";
  } else if (!easy) {
    note = "So close! Is every part gentle for tired, weak hands?";
  }
  return { works, notice, easy, note };
}

export default function AssistiveDesignStudio({ onComplete }: ActivityProps) {
  const [round, setRound] = useState<number>(0);
  const [sensorId, setSensorId] = useState<SensorId | null>(null);
  const [alertId, setAlertId] = useState<AlertId | null>(null);
  const [phase, setPhase] = useState<Phase>("build");
  const [hintShown, setHintShown] = useState<boolean>(false);
  const [verdict, setVerdict] = useState<Verdict | null>(null);

  // Optimization tracking → stars. Deterministic counters, not randomness.
  const [misses, setMisses] = useState<number>(0);
  const [hintsUsed, setHintsUsed] = useState<number>(0);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reportedRef = useRef<boolean>(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);
  useEffect(() => () => clearTimer(), [clearTimer]);

  const persona = PERSONAS[round];
  const sensor = useMemo<Sensor | null>(
    () => SENSORS.find((s) => s.id === sensorId) ?? null,
    [sensorId],
  );
  const alert = useMemo<Alert | null>(
    () => ALERTS.find((a) => a.id === alertId) ?? null,
    [alertId],
  );

  const ready = sensor !== null && alert !== null;
  const won = phase === "win";
  const roundWon = phase === "roundwin";
  const testing = phase === "testing";
  const locked = testing || won || roundWon;

  const pickSensor = useCallback(
    (id: SensorId) => {
      if (locked) return;
      setSensorId((cur) => (cur === id ? null : id));
      setPhase("build");
      setVerdict(null);
    },
    [locked],
  );

  const pickAlert = useCallback(
    (id: AlertId) => {
      if (locked) return;
      setAlertId((cur) => (cur === id ? null : id));
      setPhase("build");
      setVerdict(null);
    },
    [locked],
  );

  const handleTest = useCallback(() => {
    if (!sensor || !alert || locked) return;
    const v = evaluate(persona, sensor, alert);
    setVerdict(v);
    setPhase("testing");
    const pass = v.works && v.notice && v.easy;
    clearTimer();
    timerRef.current = setTimeout(() => {
      if (!pass) {
        // Gentle retry. KEEP the plan. NEVER fire onComplete on a miss.
        setMisses((m) => m + 1);
        setPhase("miss");
        return;
      }
      const last = round >= PERSONAS.length - 1;
      if (!last) {
        setPhase("roundwin");
        // Slide the next, harder client in after a beat.
        timerRef.current = setTimeout(() => {
          setRound((r) => r + 1);
          setSensorId(null);
          setAlertId(null);
          setVerdict(null);
          setHintShown(false);
          setPhase("build");
        }, 1200);
        return;
      }
      // FINAL client shipped → grade the whole studio run on efficiency.
      setPhase("win");
      if (!reportedRef.current) {
        reportedRef.current = true;
        const slips = misses + hintsUsed;
        const stars: 1 | 2 | 3 = slips === 0 ? 3 : slips <= 2 ? 2 : 1;
        const detail =
          stars === 3
            ? "Shipped all 3 devices on the first try — flawless! 🦾"
            : stars === 2
              ? "Shipped all 3 devices for your clients. Young Inventor! 🦾"
              : "All 3 clients helped — you got there! 🦾";
        onComplete({ passed: true, stars, detail });
      }
    }, 900);
  }, [sensor, alert, locked, persona, round, misses, hintsUsed, clearTimer, onComplete]);

  const showHint = useCallback(() => {
    setHintShown((h) => {
      if (!h) setHintsUsed((n) => n + 1);
      return !h;
    });
  }, []);

  const handleReset = useCallback(() => {
    clearTimer();
    setRound(0);
    setSensorId(null);
    setAlertId(null);
    setPhase("build");
    setVerdict(null);
    setHintShown(false);
    setMisses(0);
    setHintsUsed(0);
    // reportedRef intentionally NOT reset — onComplete(passed:true) fires once.
  }, [clearTimer]);

  // Live preview of the rule the learner is writing.
  const ruleText = useMemo<string>(() => {
    const trig = sensor ? sensor.detects.toUpperCase() : "…";
    const out = alert ? alert.name.toUpperCase() : "…";
    return `WHEN ${trig} → ${out}`;
  }, [sensor, alert]);

  const reaction: "happy" | "sad" | "idle" =
    won || roundWon ? "happy" : phase === "miss" ? "sad" : "idle";

  const status = useMemo<string>(() => {
    if (won) return "All three clients helped. You're a Young Inventor! ⭐";
    if (roundWon) return `${persona.name}'s device works! Next client coming up…`;
    if (testing) return "Running the real-life scenario…";
    if (phase === "miss") return verdict?.note ?? "Not quite — adjust and test again.";
    if (!sensor) return "Step 1 · Which SENSOR detects this client's event?";
    if (!alert) return "Step 2 · Which ALERT will this client notice & use?";
    return "Ready! Press TEST to run the scenario.";
  }, [won, roundWon, testing, phase, verdict, sensor, alert, persona]);

  return (
    <div className="flex w-full max-w-[460px] flex-col gap-3 font-mono text-ink">
      <style>{`
        @keyframes g4assistivedesign-pulse {
          0%,100% { opacity: .25; transform: scale(1); }
          50% { opacity: .9; transform: scale(1.12); }
        }
        @keyframes g4assistivedesign-pop {
          0% { transform: scale(.6); opacity: 0; }
          60% { transform: scale(1.15); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes g4assistivedesign-bob {
          0%,100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }
        @keyframes g4assistivedesign-slidein {
          0% { transform: translateX(14px); opacity: 0; }
          100% { transform: translateX(0); opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-g4ad-idle] { animation: none !important; }
        }
      `}</style>

      {/* ── STUDIO HEADER: progress across the three clients ──────────── */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] uppercase tracking-wide text-ink-faint">
          Design Studio · Client {Math.min(round + 1, PERSONAS.length)} of {PERSONAS.length}
        </p>
        <span aria-hidden className="inline-flex items-center gap-1.5">
          {PERSONAS.map((p, i) => {
            const shipped = i < round || won;
            const current = i === round && !won;
            return (
              <span
                key={p.id}
                className="grid h-[14px] w-[14px] place-items-center rounded-full"
                data-g4ad-idle={current ? "" : undefined}
                style={{
                  background: shipped
                    ? ACCENT
                    : current
                      ? "rgba(168,85,247,.25)"
                      : "rgba(255,255,255,.06)",
                  border: `2px solid ${shipped || current ? ACCENT : "rgba(120,140,170,.35)"}`,
                  boxShadow: current ? `0 0 8px ${ACCENT}88` : undefined,
                }}
              />
            );
          })}
        </span>
      </div>

      {/* ── CLIENT BRIEF ─────────────────────────────────────────────── */}
      <div
        key={persona.id}
        className="flex items-start gap-2 rounded-xl border p-3"
        data-g4ad-idle=""
        style={{
          borderColor: "var(--color-line, #283042)",
          background: "rgba(168,85,247,.07)",
          animation: "g4assistivedesign-slidein .4s ease-out",
        }}
      >
        <span aria-hidden className="text-3xl leading-none">{persona.emoji}</span>
        <div className="flex flex-col gap-0.5">
          <p className="text-[12px] font-semibold text-ink">
            {persona.name} <span className="text-ink-dim">· {persona.tag}</span>
          </p>
          <p className="text-[11px] leading-snug text-ink-dim">{persona.brief}</p>
        </div>
      </div>

      {/* ── DEVICE BOARD + CLIENT REACTION ───────────────────────────── */}
      <div
        className="panel relative overflow-hidden rounded-xl p-3"
        style={won || roundWon ? { boxShadow: `0 0 0 1px ${ACCENT}, 0 0 26px -4px ${ACCENT}` } : undefined}
      >
        <svg viewBox="0 0 360 150" className="block h-auto w-full" role="img" aria-label="Assistive device board and the client's reaction">
          <rect x={10} y={14} width={210} height={122} rx={12} fill="rgba(168,85,247,.07)" stroke="var(--color-line,#283042)" />
          <g transform="translate(56 56)">
            <circle r={26} fill={sensor ? "rgba(168,85,247,.16)" : "rgba(255,255,255,.03)"} stroke={sensor ? ACCENT : "#3a4254"} strokeWidth={1.5}
              data-g4ad-idle={testing && sensor ? "" : undefined}
              style={testing && sensor ? { animation: "g4assistivedesign-pulse 1s ease-in-out infinite", transformOrigin: "center" } : undefined} />
            <text textAnchor="middle" y={9} fontSize={26}>{sensor ? sensor.emoji : "＋"}</text>
          </g>
          <text x={56} y={104} textAnchor="middle" fontSize={9} fill="#9aa6b2">SENSOR</text>
          <line x1={84} y1={56} x2={148} y2={56} stroke={ready ? ACCENT : "#3a4254"} strokeWidth={2.5} strokeDasharray="5 4">
            {testing && <animate attributeName="stroke-dashoffset" from="18" to="0" dur="0.5s" repeatCount="indefinite" />}
          </line>
          <g transform="translate(176 56)">
            <circle r={26} fill={alert ? "rgba(168,85,247,.16)" : "rgba(255,255,255,.03)"} stroke={alert ? ACCENT : "#3a4254"} strokeWidth={1.5}
              data-g4ad-idle={testing && alert ? "" : undefined}
              style={testing && alert ? { animation: "g4assistivedesign-pulse .7s ease-in-out infinite", transformOrigin: "center" } : undefined} />
            <text textAnchor="middle" y={9} fontSize={26}>{alert ? alert.emoji : "＋"}</text>
          </g>
          <text x={176} y={104} textAnchor="middle" fontSize={9} fill="#9aa6b2">ALERT</text>

          <g transform="translate(290 60)">
            <circle r={36} fill="rgba(255,255,255,.03)" stroke={reaction === "happy" ? OK : reaction === "sad" ? BAD : "#3a4254"} strokeWidth={2} />
            <text textAnchor="middle" y={14} fontSize={40}
              data-g4ad-idle={reaction === "happy" ? "" : undefined}
              style={reaction === "happy" ? { animation: "g4assistivedesign-bob .6s ease-in-out infinite" } : undefined}>
              {persona.emoji}
            </text>
            {reaction === "happy" && (
              <text textAnchor="middle" y={-40} fontSize={22} style={{ animation: "g4assistivedesign-pop .4s ease-out" }}>👍</text>
            )}
            {reaction === "sad" && (
              <text textAnchor="middle" y={-40} fontSize={22} style={{ animation: "g4assistivedesign-pop .4s ease-out" }}>🤔</text>
            )}
          </g>
        </svg>

        <p className="mt-1 rounded-lg bg-black/25 px-2 py-1 text-center text-[11px]" style={{ color: ACCENT }}>
          {ruleText}
        </p>
      </div>

      {/* ── SENSOR + ALERT PICKERS ───────────────────────────────────── */}
      {!won && !roundWon && (
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5" role="group" aria-label="Choose one sensor">
            <p className="text-[10px] uppercase tracking-wide text-ink-faint">Pick a sensor</p>
            {SENSORS.map((s) => {
              const active = sensorId === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onPointerDown={() => pickSensor(s.id)}
                  disabled={locked}
                  aria-pressed={active}
                  aria-label={`${s.name}: detects ${s.detects}`}
                  className="flex items-start gap-2 rounded-lg border px-2 py-1.5 text-left text-[10.5px] leading-tight transition disabled:opacity-60"
                  style={{
                    borderColor: active ? ACCENT : "var(--color-line,#283042)",
                    background: active ? "rgba(168,85,247,.16)" : "rgba(255,255,255,.02)",
                    color: active ? "#fff" : "var(--color-ink-dim,#9aa6b2)",
                  }}
                >
                  <span aria-hidden className="text-base leading-none">{s.emoji}</span>
                  <span>{s.name}</span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-col gap-1.5" role="group" aria-label="Choose one alert">
            <p className="text-[10px] uppercase tracking-wide text-ink-faint">Pick an alert</p>
            {ALERTS.map((a) => {
              const active = alertId === a.id;
              return (
                <button
                  key={a.id}
                  type="button"
                  onPointerDown={() => pickAlert(a.id)}
                  disabled={locked}
                  aria-pressed={active}
                  aria-label={`${a.name}`}
                  className="flex items-start gap-2 rounded-lg border px-2 py-1.5 text-left text-[10.5px] leading-tight transition disabled:opacity-60"
                  style={{
                    borderColor: active ? ACCENT : "var(--color-line,#283042)",
                    background: active ? "rgba(168,85,247,.16)" : "rgba(255,255,255,.02)",
                    color: active ? "#fff" : "var(--color-ink-dim,#9aa6b2)",
                  }}
                >
                  <span aria-hidden className="text-base leading-none">{a.emoji}</span>
                  <span>{a.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 3-POINT RUBRIC ───────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-2">
        {([
          { key: "works", label: "Works?", on: verdict?.works ?? false },
          { key: "notice", label: "Notice?", on: verdict?.notice ?? false },
          { key: "easy", label: "Easy?", on: verdict?.easy ?? false },
        ] as const).map((r) => (
          <div
            key={r.key}
            className="flex items-center justify-center gap-1 rounded-lg border px-2 py-1.5 text-[11px]"
            style={{
              borderColor: r.on ? OK : "var(--color-line,#283042)",
              background: r.on ? "rgba(52,211,153,.14)" : "rgba(255,255,255,.02)",
              color: r.on ? OK : "var(--color-ink-dim,#9aa6b2)",
            }}
          >
            <span aria-hidden>{r.on ? "✓" : "○"}</span>
            {r.label}
          </div>
        ))}
      </div>

      {/* ── STATUS ───────────────────────────────────────────────────── */}
      <div
        role="status"
        aria-live="polite"
        className="rounded-lg px-3 py-2 text-center text-[12px]"
        style={{
          background: won || roundWon ? "rgba(52,211,153,.12)" : "rgba(255,255,255,.03)",
          color: won || roundWon ? OK : phase === "miss" ? BAD : "var(--color-ink-dim,#9aa6b2)",
        }}
      >
        {status}
      </div>

      {/* ── WIN CERTIFICATE ──────────────────────────────────────────── */}
      {won && (
        <div
          className="relative overflow-hidden rounded-xl border p-3 text-center"
          style={{ borderColor: ACCENT, background: "rgba(168,85,247,.10)", animation: "g4assistivedesign-pop .5s ease-out" }}
        >
          <p className="text-lg" aria-hidden>✨🎉 {misses + hintsUsed === 0 ? "⭐⭐⭐" : misses + hintsUsed <= 2 ? "⭐⭐" : "⭐"}</p>
          <p className="mt-1 text-sm font-semibold text-ink">Young Inventor Certificate</p>
          <p className="mt-0.5 text-[11px] text-ink-dim">
            You shipped a kind, working device for <b>all three</b> clients. 🦾
          </p>
          {misses + hintsUsed > 0 && (
            <p className="mt-1 text-[10px] text-ink-faint">
              Tip: try Reset and ship all three on the first try with no hints for ⭐⭐⭐.
            </p>
          )}
        </div>
      )}

      {/* ── CONTROLS ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onPointerDown={showHint}
          disabled={won || roundWon}
          className="rounded-lg border border-line bg-panel/60 px-3 py-2 text-[12px] font-medium text-ink-dim disabled:opacity-40"
          aria-label="Show a hint"
        >
          {hintShown ? "Hide hint" : "Hint"}
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            onPointerDown={handleReset}
            className="rounded-lg border border-line bg-panel/60 px-3 py-2 text-[12px] font-medium text-ink-dim"
            aria-label="Reset the studio"
          >
            Reset
          </button>
          <button
            type="button"
            onPointerDown={handleTest}
            disabled={!ready || locked}
            className="rounded-lg px-4 py-2 text-[12px] font-semibold disabled:opacity-50"
            style={{ background: ACCENT, color: "#0b0712" }}
            aria-label="Test the device"
          >
            {testing ? "Testing…" : won ? "Done ✓" : "Test ▶"}
          </button>
        </div>
      </div>

      {hintShown && !won && !roundWon && (
        <p className="rounded-lg bg-black/20 px-3 py-2 text-[11px] leading-snug" style={{ color: ACCENT }}>
          💡 {persona.hint}
        </p>
      )}
    </div>
  );
}
