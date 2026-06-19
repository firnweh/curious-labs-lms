"use client";
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useMemo, useRef, useState } from "react";

/* ── Assistive Device Lab 🦾 ──────────────────────────────────────────────────
   GRADE 4 (explorer, age ~10–11). Subject: AI.
   ONE learning goal: GOOD DESIGN STARTS WITH EMPATHY — you choose a sensor +
   alert pair that fits one real person's specific need. The same alert isn't
   right for everyone: a Deaf user needs an alert they can FEEL or SEE (not a
   sound), a low-vision user needs an alert they can HEAR or FEEL (not a tiny
   light), and a user with limited grip needs an output that's EASY to use.

   The learner: picks a persona → picks ONE sensor → picks ONE alert → builds the
   rule "WHEN trigger → alert" → presses TEST. A deterministic scenario plays and
   a 3-point rubric (Works? · Easy? · Kind?) lights green. WIN → the persona
   reacts happily and a Young Inventor certificate appears.
   onComplete({passed:true, stars:3}) fires EXACTLY ONCE (ref-guarded).
   ──────────────────────────────────────────────────────────────────────────── */

const ACCENT = "#a855f7";
const OK = "#34d399";
const BAD = "#f87171";

type SensorId = "doorbell" | "ultrasonic" | "light" | "touchpad";
type AlertId = "vibration" | "flash" | "buzzer" | "bigbutton";
type PersonaId = "deaf" | "lowvision" | "grip";

/** How a person can perceive an alert. */
type Channel = "feel" | "see" | "hear";

interface Sensor {
  id: SensorId;
  emoji: string;
  name: string;
  /** The real-world thing this sensor detects. */
  trigger: string;
}

interface Alert {
  id: AlertId;
  emoji: string;
  name: string;
  /** Which sense the alert reaches the person through. */
  channel: Channel;
  /** True when the output is operated easily (no precise grip / strength). */
  easy: boolean;
}

interface Persona {
  id: PersonaId;
  emoji: string;
  name: string;
  need: string;
  /** The sensor that detects THIS persona's situation. */
  wantSensor: SensorId;
  /** Channels this persona can actually notice an alert through. */
  okChannels: Channel[];
  /** True if this persona needs an EASY-to-use output. */
  needsEasy: boolean;
  /** Socratic nudge — names the constraint, never the answer. */
  hint: string;
}

const SENSORS: readonly Sensor[] = [
  { id: "doorbell", emoji: "🔔", name: "Doorbell sensor", trigger: "someone rings the bell" },
  { id: "ultrasonic", emoji: "📡", name: "Obstacle sensor", trigger: "an object is in the way" },
  { id: "light", emoji: "🔆", name: "Light sensor", trigger: "the room gets dark" },
  { id: "touchpad", emoji: "👆", name: "Touch pad", trigger: "a pad is tapped" },
];

const ALERTS: readonly Alert[] = [
  { id: "vibration", emoji: "📳", name: "Vibration band", channel: "feel", easy: true },
  { id: "flash", emoji: "💡", name: "Flashing lamp", channel: "see", easy: true },
  { id: "buzzer", emoji: "🔊", name: "Loud buzzer", channel: "hear", easy: true },
  { id: "bigbutton", emoji: "🟢", name: "Big easy button", channel: "feel", easy: true },
];

const PERSONAS: readonly Persona[] = [
  {
    id: "deaf",
    emoji: "🧒",
    name: "Mira (Deaf)",
    need: "can't HEAR the doorbell ring",
    wantSensor: "doorbell",
    okChannels: ["feel", "see"],
    needsEasy: false,
    hint: "She can't hear — pick an alert she can FEEL or SEE.",
  },
  {
    id: "lowvision",
    emoji: "👵",
    name: "Nani (Low vision)",
    need: "trips on objects she can't SEE",
    wantSensor: "ultrasonic",
    okChannels: ["hear", "feel"],
    needsEasy: false,
    hint: "She can't see well — pick an alert she can HEAR or FEEL.",
  },
  {
    id: "grip",
    emoji: "🧑",
    name: "Sam (Low grip)",
    need: "can't press tiny switches",
    wantSensor: "touchpad",
    okChannels: ["feel", "see", "hear"],
    needsEasy: true,
    hint: "His hands tire fast — the sensor must be EASY to set off, not a tiny switch.",
  },
];

type Phase = "build" | "testing" | "win" | "miss";

interface Verdict {
  works: boolean;
  easy: boolean;
  kind: boolean;
  /** A short, never-scolding nudge when something doesn't fit yet. */
  note: string;
}

/** Deterministic, pure rubric check. No randomness — always reproducible. */
function evaluate(p: Persona, s: Sensor, a: Alert): Verdict {
  // WORKS: the chosen sensor must detect THIS persona's situation, and for
  // low-grip the touch pad is the easy-to-trigger input they need.
  const works = s.id === p.wantSensor;
  // KIND: the alert must reach the person through a sense they can use.
  const kind = p.okChannels.includes(a.channel);
  // EASY: the whole device must be usable — for low-grip that means the input
  // (touch pad) doesn't need a precise/strong press; otherwise any output is fine.
  const easyInput = !p.needsEasy || s.id === "touchpad";
  const easy = a.easy && easyInput;

  let note = "Nice fit — press TEST! ✨";
  if (!works) {
    note = `That sensor won't notice when she/he ${p.need.replace("can't ", "")}. Match the sensor to the need.`;
  } else if (!kind) {
    if (a.channel === "hear") note = "A loud sound — will this person really notice it?";
    else if (a.channel === "see") note = "A small light — can this person see it well enough?";
    else note = "Will this person notice this alert?";
  } else if (!easy) {
    note = "Close! Is this easy to set off for someone with tired hands?";
  }
  return { works, easy, kind, note };
}

export default function AssistiveDeviceLab({ onComplete }: ActivityProps) {
  const [personaId, setPersonaId] = useState<PersonaId | null>(null);
  const [sensorId, setSensorId] = useState<SensorId | null>(null);
  const [alertId, setAlertId] = useState<AlertId | null>(null);
  const [phase, setPhase] = useState<Phase>("build");
  const [hintShown, setHintShown] = useState<boolean>(false);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const reportedRef = useRef<boolean>(false);

  const persona = useMemo<Persona | null>(
    () => PERSONAS.find((p) => p.id === personaId) ?? null,
    [personaId],
  );
  const sensor = useMemo<Sensor | null>(
    () => SENSORS.find((s) => s.id === sensorId) ?? null,
    [sensorId],
  );
  const alert = useMemo<Alert | null>(
    () => ALERTS.find((a) => a.id === alertId) ?? null,
    [alertId],
  );

  const ready = persona !== null && sensor !== null && alert !== null;

  const pickPersona = useCallback((id: PersonaId) => {
    setPersonaId(id);
    setSensorId(null);
    setAlertId(null);
    setPhase("build");
    setVerdict(null);
    setHintShown(false);
  }, []);

  const pickSensor = useCallback((id: SensorId) => {
    setSensorId((cur) => (cur === id ? null : id));
    setPhase("build");
    setVerdict(null);
  }, []);

  const pickAlert = useCallback((id: AlertId) => {
    setAlertId((cur) => (cur === id ? null : id));
    setPhase("build");
    setVerdict(null);
  }, []);

  const handleTest = useCallback(() => {
    if (!persona || !sensor || !alert) return;
    const v = evaluate(persona, sensor, alert);
    setVerdict(v);
    setPhase("testing");
    const passed = v.works && v.easy && v.kind;
    // Brief deterministic "scenario plays" beat, then resolve.
    window.setTimeout(() => {
      if (passed) {
        setPhase("win");
        if (!reportedRef.current) {
          reportedRef.current = true;
          onComplete({
            passed: true,
            stars: 3,
            detail: `${persona.name}'s device works, is easy & is kind. Young Inventor! 🦾`,
          });
        }
      } else {
        setPhase("miss");
        onComplete({ passed: false, detail: v.note });
      }
    }, 900);
  }, [persona, sensor, alert, onComplete]);

  const handleReset = useCallback(() => {
    setPersonaId(null);
    setSensorId(null);
    setAlertId(null);
    setPhase("build");
    setVerdict(null);
    setHintShown(false);
    // reportedRef intentionally NOT reset — onComplete(passed:true) fires once.
  }, []);

  // Live preview of the rule the learner is writing.
  const ruleText = useMemo<string>(() => {
    const trig = sensor ? sensor.trigger.toUpperCase() : "…";
    const out = alert ? alert.name.toUpperCase() : "…";
    return `WHEN ${trig} → ${out}`;
  }, [sensor, alert]);

  const won = phase === "win";
  const testing = phase === "testing";

  // Persona avatar reaction for the test/win animation.
  const reaction: "happy" | "sad" | "idle" =
    won ? "happy" : phase === "miss" ? "sad" : "idle";

  const status = useMemo<string>(() => {
    if (won) return "It works, it's easy, and it's kind. ⭐⭐⭐";
    if (phase === "miss") return verdict?.note ?? "Not quite — adjust and test again.";
    if (testing) return "Testing the device…";
    if (!persona) return "Step 1 · Choose a person to design for.";
    if (!sensor) return "Step 2 · Choose ONE sensor that fits their need.";
    if (!alert) return "Step 3 · Choose ONE alert they will notice.";
    return "Ready! Press TEST to try your device.";
  }, [won, phase, verdict, testing, persona, sensor, alert]);

  return (
    <div className="flex w-full max-w-[440px] flex-col gap-3 font-mono text-ink">
      <style>{`
        @keyframes g4assistivedesign-ring {
          0%,100% { transform: rotate(0deg); }
          20% { transform: rotate(-14deg); }
          40% { transform: rotate(14deg); }
          60% { transform: rotate(-8deg); }
          80% { transform: rotate(8deg); }
        }
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
      `}</style>

      {/* ── PERSONA PICKER ─────────────────────────────────────────── */}
      <div className="flex flex-col gap-2">
        <p className="text-[11px] uppercase tracking-wide text-ink-faint">
          Who are you helping?
        </p>
        <div className="grid grid-cols-3 gap-2" role="group" aria-label="Choose a person to design for">
          {PERSONAS.map((p) => {
            const active = personaId === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onPointerDown={() => pickPersona(p.id)}
                aria-pressed={active}
                aria-label={`${p.name}: ${p.need}`}
                className="flex flex-col items-center gap-1 rounded-xl border p-2 text-center transition"
                style={{
                  borderColor: active ? ACCENT : "var(--color-line, #283042)",
                  background: active ? "rgba(168,85,247,.14)" : "rgba(255,255,255,.02)",
                }}
              >
                <span aria-hidden className="text-2xl">{p.emoji}</span>
                <span className="text-[11px] font-semibold text-ink">{p.name}</span>
                <span className="text-[9px] leading-tight text-ink-dim">{p.need}</span>
              </button>
            );
          })}
        </div>
      </div>

      {persona && (
        <>
          {/* ── DEVICE BOARD + PERSONA REACTION ──────────────────────── */}
          <div
            className="panel relative overflow-hidden rounded-xl p-3"
            style={won ? { boxShadow: `0 0 0 1px ${ACCENT}, 0 0 26px -4px ${ACCENT}` } : undefined}
          >
            <svg viewBox="0 0 360 150" className="block h-auto w-full" role="img" aria-label="Assistive device board and the person's reaction">
              {/* board */}
              <rect x={10} y={14} width={210} height={122} rx={12} fill="rgba(168,85,247,.07)" stroke="var(--color-line,#283042)" />
              {/* sensor slot */}
              <g transform="translate(56 56)">
                <circle r={26} fill={sensor ? "rgba(168,85,247,.16)" : "rgba(255,255,255,.03)"} stroke={sensor ? ACCENT : "#3a4254"} strokeWidth={1.5}
                  style={testing && sensor ? { animation: "g4assistivedesign-pulse 1s ease-in-out infinite", transformOrigin: "center" } : undefined} />
                <text textAnchor="middle" y={9} fontSize={26}>{sensor ? sensor.emoji : "＋"}</text>
              </g>
              <text x={56} y={104} textAnchor="middle" fontSize={9} fill="#9aa6b2">SENSOR</text>
              {/* wire */}
              <line x1={84} y1={56} x2={148} y2={56} stroke={ready ? ACCENT : "#3a4254"} strokeWidth={2.5} strokeDasharray="5 4">
                {testing && <animate attributeName="stroke-dashoffset" from="18" to="0" dur="0.5s" repeatCount="indefinite" />}
              </line>
              {/* alert slot */}
              <g transform="translate(176 56)">
                <circle r={26} fill={alert ? "rgba(168,85,247,.16)" : "rgba(255,255,255,.03)"} stroke={alert ? ACCENT : "#3a4254"} strokeWidth={1.5}
                  style={testing && alert ? { animation: "g4assistivedesign-pulse .7s ease-in-out infinite", transformOrigin: "center" } : undefined} />
                <text textAnchor="middle" y={9} fontSize={26}>{alert ? alert.emoji : "＋"}</text>
              </g>
              <text x={176} y={104} textAnchor="middle" fontSize={9} fill="#9aa6b2">ALERT</text>

              {/* persona avatar reacting */}
              <g transform="translate(290 60)">
                <circle r={36} fill="rgba(255,255,255,.03)" stroke={reaction === "happy" ? OK : reaction === "sad" ? BAD : "#3a4254"} strokeWidth={2} />
                <text textAnchor="middle" y={14} fontSize={40}
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

            {/* live rule */}
            <p className="mt-1 rounded-lg bg-black/25 px-2 py-1 text-center text-[11px]" style={{ color: ACCENT }}>
              {ruleText}
            </p>
          </div>

          {/* ── SENSOR + ALERT PICKERS ───────────────────────────────── */}
          {!won && (
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
                      aria-pressed={active}
                      aria-label={`${s.name}: detects when ${s.trigger}`}
                      className="flex items-center gap-2 rounded-lg border px-2 py-1.5 text-left text-[11px] transition"
                      style={{
                        borderColor: active ? ACCENT : "var(--color-line,#283042)",
                        background: active ? "rgba(168,85,247,.16)" : "rgba(255,255,255,.02)",
                        color: active ? "#fff" : "var(--color-ink-dim,#9aa6b2)",
                      }}
                    >
                      <span aria-hidden className="text-base">{s.emoji}</span>
                      <span className="leading-tight">{s.name}</span>
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
                      aria-pressed={active}
                      aria-label={`${a.name}: the person will ${a.channel} it`}
                      className="flex items-center gap-2 rounded-lg border px-2 py-1.5 text-left text-[11px] transition"
                      style={{
                        borderColor: active ? ACCENT : "var(--color-line,#283042)",
                        background: active ? "rgba(168,85,247,.16)" : "rgba(255,255,255,.02)",
                        color: active ? "#fff" : "var(--color-ink-dim,#9aa6b2)",
                      }}
                    >
                      <span aria-hidden className="text-base">{a.emoji}</span>
                      <span className="leading-tight">{a.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── 3-POINT RUBRIC ───────────────────────────────────────── */}
          <div className="grid grid-cols-3 gap-2">
            {([
              { key: "works", label: "Works?", on: verdict?.works ?? false },
              { key: "easy", label: "Easy?", on: verdict?.easy ?? false },
              { key: "kind", label: "Kind?", on: verdict?.kind ?? false },
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
        </>
      )}

      {/* ── STATUS ───────────────────────────────────────────────────── */}
      <div
        role="status"
        aria-live="polite"
        className="rounded-lg px-3 py-2 text-center text-[12px]"
        style={{
          background: won ? "rgba(52,211,153,.12)" : "rgba(255,255,255,.03)",
          color: won ? OK : phase === "miss" ? BAD : "var(--color-ink-dim,#9aa6b2)",
        }}
      >
        {status}
      </div>

      {/* ── WIN CERTIFICATE ──────────────────────────────────────────── */}
      {won && persona && (
        <div
          className="rounded-xl border p-3 text-center"
          style={{ borderColor: ACCENT, background: "rgba(168,85,247,.10)", animation: "g4assistivedesign-pop .5s ease-out" }}
        >
          <p className="text-lg" aria-hidden>✨🎉 ⭐⭐⭐</p>
          <p className="mt-1 text-sm font-semibold text-ink">Young Inventor Certificate</p>
          <p className="mt-0.5 text-[11px] text-ink-dim">
            You designed a device that helps <b>{persona.name}</b> — and it&apos;s kind. 🦾
          </p>
        </div>
      )}

      {/* ── CONTROLS ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onPointerDown={() => setHintShown((h) => !h)}
          disabled={!persona || won}
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
            aria-label="Reset the lab"
          >
            Reset
          </button>
          <button
            type="button"
            onPointerDown={handleTest}
            disabled={!ready || testing || won}
            className="rounded-lg px-4 py-2 text-[12px] font-semibold disabled:opacity-50"
            style={{ background: ACCENT, color: "#0b0712" }}
            aria-label="Test the device"
          >
            {testing ? "Testing…" : won ? "Done ✓" : "Test ▶"}
          </button>
        </div>
      </div>

      {hintShown && persona && !won && (
        <p className="rounded-lg bg-black/20 px-3 py-2 text-[11px] leading-snug" style={{ color: ACCENT }}>
          💡 {persona.hint}
        </p>
      )}
    </div>
  );
}
