"use client";
import type { ActivityProps } from "@/lib/activities/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* ------------------------------------------------------------------ */
/*  Smart City Control Panel — MQTT publish / subscribe automation     */
/*  Learning goal: IoT sensor nodes PUBLISH readings to named topics   */
/*  (city/zone1/temperature …); a subscriber dashboard applies         */
/*  IF topic <compare> threshold THEN action rules to a live data      */
/*  stream to control the city automatically. The learner wires three  */
/*  rules whose thresholds must cross the scripted timeline at exactly  */
/*  the right moments (dusk, heat peak, morning rush).                  */
/* ------------------------------------------------------------------ */

const ACCENT = "#22d3ee";
const GREEN = "#34d399";
const RED = "#f87171";
const AMBER = "#f59e0b";

/** Length of the scripted day, in ticks (one simulated minute each). */
const TICKS = 60;

type NodeId = "zone1" | "zone2" | "zone3";
type Compare = "<" | ">";
type ActionId = "light" | "fan" | "alert";

interface NodeDef {
  id: NodeId;
  /** MQTT topic the node publishes on. */
  topic: string;
  label: string;
  unit: string;
  emoji: string;
  /** Sensor hardware name, for flavour. */
  sensor: string;
  /** Gauge display range. */
  min: number;
  max: number;
  /** 60-tick scripted feed — identical on every replay. */
  feed: readonly number[];
}

/* ---- build the scripted feeds (deterministic, hand-shaped) ---- */

/** Zone2 traffic: IR vehicle counter. Morning rush spike, ticks 8–16. */
const TRAFFIC: number[] = [];
for (let t = 0; t < TICKS; t++) {
  // baseline ~30; sharp rush-hour spike to ~95 across the 8am window.
  TRAFFIC.push(t >= 8 && t <= 16 ? 95 : 30);
}

/** Zone1 temperature: DHT22 °C. Midday heat peak, ticks 25–34. */
const TEMP: number[] = [];
for (let t = 0; t < TICKS; t++) {
  // baseline ~26; afternoon sun pushes it to ~36.
  TEMP.push(t >= 25 && t <= 34 ? 36 : 26);
}

/** Zone3 light: LDR lux. Bright all day, then dusk drop from tick 40. */
const LIGHT: number[] = [];
for (let t = 0; t < TICKS; t++) {
  // ~700 in daylight; falls to ~150 once the sun sets.
  LIGHT.push(t >= 40 ? 150 : 700);
}

const NODES: readonly NodeDef[] = [
  {
    id: "zone1",
    topic: "city/zone1/temperature",
    label: "Zone 1 Temp",
    unit: "°C",
    emoji: "🌡️",
    sensor: "DHT22",
    min: 16,
    max: 42,
    feed: TEMP,
  },
  {
    id: "zone2",
    topic: "city/zone2/traffic",
    label: "Zone 2 Traffic",
    unit: "",
    emoji: "🚗",
    sensor: "IR counter",
    min: 0,
    max: 120,
    feed: TRAFFIC,
  },
  {
    id: "zone3",
    topic: "city/zone3/light",
    label: "Zone 3 Light",
    unit: "lx",
    emoji: "🔆",
    sensor: "LDR",
    min: 0,
    max: 800,
    feed: LIGHT,
  },
] as const;

const NODE_BY_ID: Record<NodeId, NodeDef> = NODES.reduce(
  (acc, n) => {
    acc[n.id] = n;
    return acc;
  },
  {} as Record<NodeId, NodeDef>,
);

interface ActionDef {
  id: ActionId;
  label: string;
  emoji: string;
  /** Short verb shown on the widget when this action is live. */
  live: string;
}

const ACTIONS: readonly ActionDef[] = [
  { id: "light", label: "turn streetlight ON", emoji: "💡", live: "LIT" },
  { id: "fan", label: "send fan command", emoji: "🌀", live: "COOLING" },
  { id: "alert", label: "raise traffic alert", emoji: "🚨", live: "ALERT" },
] as const;

/**
 * One editable rule. The learner sets node (topic), comparison, threshold and
 * action. A rule is "armed" only when the action matches its intended node so
 * that the checklist event can fire on the live stream.
 */
interface RuleConfig {
  node: NodeId;
  cmp: Compare;
  threshold: number;
  action: ActionId;
}

type Rules = readonly [RuleConfig, RuleConfig, RuleConfig];

/** Threshold chips offered per row (the correct value is always present). */
const THRESHOLDS: Record<NodeId, readonly number[]> = {
  zone1: [22, 28, 32, 38],
  zone2: [40, 60, 80, 100],
  zone3: [150, 300, 500, 700],
};

/**
 * The intended event for each action, defined by the script:
 *  - streetlight ON  at dusk        → light  < 300 (true once light = 150)
 *  - fan command     at heat peak   → temp   > 32  (true once temp = 36)
 *  - traffic alert   at rush hour   → count  > 80  (true once traffic = 95)
 * Each is the tick where that condition FIRST becomes true.
 */
interface EventSpec {
  action: ActionId;
  node: NodeId;
  cmp: Compare;
  threshold: number;
  /** First tick at which the scripted feed satisfies the condition. */
  fireTick: number;
  when: string;
}

const EVENTS: readonly EventSpec[] = [
  { action: "alert", node: "zone2", cmp: ">", threshold: 80, fireTick: 8, when: "morning rush" },
  { action: "fan", node: "zone1", cmp: ">", threshold: 32, fireTick: 25, when: "heat peak" },
  { action: "light", node: "zone3", cmp: "<", threshold: 300, fireTick: 40, when: "dusk" },
] as const;

const EVENT_BY_ACTION: Record<ActionId, EventSpec> = EVENTS.reduce(
  (acc, e) => {
    acc[e.action] = e;
    return acc;
  },
  {} as Record<ActionId, EventSpec>,
);

/** Does a rule's condition hold on the published value at tick t? */
function ruleFires(rule: RuleConfig, t: number): boolean {
  const v = NODE_BY_ID[rule.node].feed[t];
  return rule.cmp === ">" ? v > rule.threshold : v < rule.threshold;
}

/** A starting wiring that is plausible but does NOT yet trigger correctly. */
const DEFAULT_RULES: Rules = [
  { node: "zone3", cmp: ">", threshold: 500, action: "light" },
  { node: "zone1", cmp: ">", threshold: 38, action: "fan" },
  { node: "zone2", cmp: ">", threshold: 100, action: "alert" },
];

interface LogEntry {
  tick: number;
  topic: string;
  value: number;
  unit: string;
}

export default function SmartCityMqtt({ onComplete }: ActivityProps) {
  const [rules, setRules] = useState<Rules>(DEFAULT_RULES);
  const [tick, setTick] = useState<number>(0);
  const [playing, setPlaying] = useState<boolean>(false);
  /** Action -> tick it first fired during THIS run (or -1 if not yet). */
  const [fired, setFired] = useState<Record<ActionId, number>>({
    light: -1,
    fan: -1,
    alert: -1,
  });
  const [won, setWon] = useState<boolean>(false);

  const completedRef = useRef<boolean>(false);
  const rulesRef = useRef<Rules>(rules);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    rulesRef.current = rules;
  }, [rules]);

  const stopTimer = useCallback((): void => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);
  useEffect(() => stopTimer, [stopTimer]);

  /** Recompute, for the rules, the first-fire tick of each action up to `upTo`. */
  const firedUpTo = useCallback((rs: Rules, upTo: number): Record<ActionId, number> => {
    const out: Record<ActionId, number> = { light: -1, fan: -1, alert: -1 };
    for (let t = 0; t <= upTo && t < TICKS; t++) {
      for (const r of rs) {
        if (out[r.action] === -1 && ruleFires(r, t)) out[r.action] = t;
      }
    }
    return out;
  }, []);

  /**
   * A checklist item is satisfied when its action fired AND fired at the
   * correct scripted tick (the threshold reasoning is right, not too early /
   * never). We accept the exact first-true tick from the script.
   */
  const checkItem = useCallback(
    (action: ActionId, firedMap: Record<ActionId, number>): "pending" | "early" | "ok" => {
      const spec = EVENT_BY_ACTION[action];
      const ft = firedMap[action];
      if (ft === -1) return "pending";
      return ft === spec.fireTick ? "ok" : "early";
    },
    [],
  );

  const finish = useCallback(
    (firedMap: Record<ActionId, number>): void => {
      const states = ACTIONS.map((a) => checkItem(a.id, firedMap));
      const allOk = states.every((s) => s === "ok");
      if (allOk) {
        setWon(true);
        if (!completedRef.current) {
          completedRef.current = true;
          onComplete({
            passed: true,
            stars: 3,
            detail:
              "All three subscriber rules fired on the live MQTT stream at the right moments — rush alert, heat-peak fan and dusk streetlight!",
          });
        }
      } else {
        // kind, specific nudge on the weakest rule — never scold.
        const earlyish = ACTIONS.find((a) => checkItem(a.id, firedMap) === "early");
        const pending = ACTIONS.find((a) => checkItem(a.id, firedMap) === "pending");
        let nudge: string;
        if (pending) {
          const e = EVENT_BY_ACTION[pending.id];
          nudge = `${pending.emoji} "${pending.label}" never fired. Check it subscribes to ${NODE_BY_ID[e.node].topic} with a threshold the feed actually crosses.`;
        } else if (earlyish) {
          const e = EVENT_BY_ACTION[earlyish.id];
          nudge = `${earlyish.emoji} "${earlyish.label}" fired at the wrong moment — adjust the threshold so it triggers only at the ${e.when}.`;
        } else {
          nudge = "Almost — tune a comparison or threshold and replay the day.";
        }
        onComplete({ passed: false, detail: nudge });
      }
    },
    [checkItem, onComplete],
  );

  // Re-grade whenever the playhead lands on the final tick.
  const settleAt = useCallback(
    (t: number): void => {
      if (t >= TICKS - 1) {
        const firedMap = firedUpTo(rulesRef.current, TICKS - 1);
        setFired(firedMap);
        finish(firedMap);
      }
    },
    [finish, firedUpTo],
  );

  const play = useCallback((): void => {
    if (won) return;
    stopTimer();
    setPlaying(true);
    // restart the day from 0 so events fire in scripted order.
    setTick(0);
    setFired({ light: -1, fan: -1, alert: -1 });
    let t = 0;
    timerRef.current = setInterval(() => {
      t += 1;
      const firedMap = firedUpTo(rulesRef.current, t);
      setFired(firedMap);
      setTick(t);
      if (t >= TICKS - 1) {
        stopTimer();
        setPlaying(false);
        finish(firedMap);
      }
    }, 90);
  }, [won, stopTimer, firedUpTo, finish]);

  const scrub = useCallback(
    (t: number): void => {
      if (playing) {
        stopTimer();
        setPlaying(false);
      }
      const clamped = Math.max(0, Math.min(TICKS - 1, t));
      setTick(clamped);
      setFired(firedUpTo(rulesRef.current, clamped));
      settleAt(clamped);
    },
    [playing, stopTimer, firedUpTo, settleAt],
  );

  const editRule = useCallback(
    (idx: number, patch: Partial<RuleConfig>): void => {
      if (won) return;
      setRules((prev) => {
        const next = [prev[0], prev[1], prev[2]] as RuleConfig[];
        const merged: RuleConfig = { ...next[idx], ...patch };
        // if the node changed, snap threshold to that node's mid chip so it's valid.
        if (patch.node && patch.node !== next[idx].node) {
          const chips = THRESHOLDS[patch.node];
          merged.threshold = chips[Math.floor(chips.length / 2)];
        }
        next[idx] = merged;
        const nextRules = next as unknown as Rules;
        // live re-grade at the current playhead so the checklist updates instantly.
        setFired(firedUpTo(nextRules, tick));
        return nextRules;
      });
    },
    [won, firedUpTo, tick],
  );

  const reset = useCallback((): void => {
    stopTimer();
    setRules(DEFAULT_RULES);
    setTick(0);
    setPlaying(false);
    setFired({ light: -1, fan: -1, alert: -1 });
    setWon(false);
  }, [stopTimer]);

  /* ---- live derived view at the current playhead ---- */

  const liveFired = useMemo(() => {
    // which actions are firing RIGHT NOW (this tick), for widget animation.
    const now: Record<ActionId, boolean> = { light: false, fan: false, alert: false };
    for (const r of rules) {
      if (ruleFires(r, tick)) now[r.action] = true;
    }
    return now;
  }, [rules, tick]);

  const log = useMemo<LogEntry[]>(() => {
    // newest first: the last few topic publishes up to the current playhead.
    const out: LogEntry[] = [];
    for (let t = tick; t >= 0 && out.length < 5; t--) {
      const n = NODES[t % 3];
      out.push({ tick: t, topic: n.topic, value: n.feed[t], unit: n.unit });
    }
    return out;
  }, [tick]);

  const checklist = useMemo(
    () => ACTIONS.map((a) => ({ action: a, state: checkItem(a.id, fired) })),
    [fired, checkItem],
  );
  const okCount = checklist.filter((c) => c.state === "ok").length;

  const status = useMemo<string>(() => {
    if (won) return "City automated! Every rule fired at the right moment. ✨🎉 ⭐⭐⭐";
    if (playing) return `Streaming live MQTT… ${String(tick).padStart(2, "0")}:00 of the day`;
    return `Wire three rules, then ▶ play the day. (${okCount}/3 events correct)`;
  }, [won, playing, tick, okCount]);

  const hour = useMemo<string>(() => `${String(Math.floor(tick / 2.5)).padStart(2, "0")}:00`, [tick]);

  return (
    <div className="flex w-full max-w-[440px] flex-col gap-3 font-mono text-ink">
      <style>{`
        @keyframes g9smartcitymqtt-pop {
          0% { transform: scale(0.6); opacity: 0; }
          60% { transform: scale(1.12); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes g9smartcitymqtt-pulse {
          0%,100% { opacity: 1; }
          50% { opacity: 0.45; }
        }
        @keyframes g9smartcitymqtt-spin { to { transform: rotate(360deg); } }
        @keyframes g9smartcitymqtt-flash {
          0%,100% { box-shadow: 0 0 0 1px ${RED}; }
          50% { box-shadow: 0 0 14px -2px ${RED}, 0 0 0 1px ${RED}; }
        }
        @keyframes g9smartcitymqtt-slidein {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* ---------------- HEADER ---------------- */}
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm">
          <span aria-hidden className="text-lg">🌆</span>
          <span className="font-display">Smart City Control Panel</span>
        </span>
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-tech"
          style={
            won
              ? { background: GREEN, color: "#05070d" }
              : playing
                ? { background: ACCENT, color: "#05070d" }
                : { color: "var(--color-ink-faint)", border: "1px solid var(--color-line)" }
          }
          aria-hidden
        >
          {won ? "● live" : playing ? "● streaming" : "○ broker"}
        </span>
      </div>

      {/* ---------------- DASHBOARD WIDGETS ---------------- */}
      <div
        className="panel relative overflow-hidden rounded-xl p-3"
        style={won ? { boxShadow: `0 0 0 1px ${GREEN}, 0 0 24px -4px ${GREEN}` } : undefined}
      >
        <div className="mb-2 flex items-center justify-between text-[10px] text-ink-faint">
          <span>📊 subscriber dashboard</span>
          <span className="tabular-nums">clock {hour}</span>
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          {NODES.map((n) => {
            const v = n.feed[tick];
            const frac = (v - n.min) / (n.max - n.min);
            const pct = Math.max(0, Math.min(1, frac)) * 100;
            const act = n.id === "zone1" ? "fan" : n.id === "zone2" ? "alert" : "light";
            const live = liveFired[act as ActionId];
            return (
              <div
                key={n.id}
                className="rounded-lg border bg-panel-2/60 p-2"
                style={{ borderColor: live ? ACCENT : "var(--color-line)" }}
                role="img"
                aria-label={`${n.label} publishing ${v}${n.unit} on ${n.topic}`}
              >
                <div className="flex items-center justify-between text-[10px] text-ink-faint">
                  <span>{n.emoji}</span>
                  <span className="truncate">{n.label}</span>
                </div>
                <div className="font-display text-sm tabular-nums" style={{ color: live ? ACCENT : "var(--color-ink)" }}>
                  {v}
                  <span className="text-[9px] text-ink-faint">{n.unit}</span>
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-panel">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${pct}%`, background: live ? ACCENT : "#475569", transition: "width 90ms linear" }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* actuators */}
        <div className="mt-2 grid grid-cols-3 gap-1.5 text-center">
          {ACTIONS.map((a) => {
            const live = liveFired[a.id];
            const spin = a.id === "fan";
            const flash = a.id === "alert";
            return (
              <div
                key={a.id}
                className="rounded-lg border p-1.5"
                style={
                  live && flash
                    ? { borderColor: RED, animation: "g9smartcitymqtt-flash 0.7s ease-in-out infinite" }
                    : { borderColor: live ? ACCENT : "var(--color-line)" }
                }
                role="img"
                aria-label={`${a.label} is ${live ? "active" : "idle"}`}
              >
                <div
                  className="text-xl"
                  aria-hidden
                  style={
                    live && spin
                      ? { display: "inline-block", animation: "g9smartcitymqtt-spin 0.7s linear infinite" }
                      : live
                        ? { animation: "g9smartcitymqtt-pulse 0.9s ease-in-out infinite" }
                        : { opacity: 0.35 }
                  }
                >
                  {a.emoji}
                </div>
                <div className="text-[9px]" style={{ color: live ? (flash ? RED : ACCENT) : "var(--color-ink-faint)" }}>
                  {live ? a.live : "idle"}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ---------------- TIMELINE SCRUBBER ---------------- */}
      <div className="panel flex flex-col gap-1.5 rounded-xl p-3">
        <div className="flex items-center justify-between text-[11px] text-ink-faint">
          <span className="uppercase tracking-tech">timeline · 1 day</span>
          <span className="tabular-nums">
            t{String(tick).padStart(2, "0")}/{TICKS - 1}
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={TICKS - 1}
          step={1}
          value={tick}
          onChange={(e) => scrub(Number(e.target.value))}
          aria-label={`Scrub the day timeline, currently tick ${tick} of ${TICKS - 1}`}
          className="h-2 w-full cursor-pointer appearance-none rounded-full bg-panel-2"
          style={{ accentColor: ACCENT, touchAction: "none" }}
          disabled={won}
        />
        <div className="flex justify-between text-[9px] text-ink-faint">
          <span>🚗 rush</span>
          <span>🌡️ heat</span>
          <span>🌇 dusk</span>
        </div>
      </div>

      {/* ---------------- LIVE MESSAGE LOG ---------------- */}
      <div className="panel rounded-xl p-3">
        <p className="mb-1 text-[11px] uppercase tracking-tech text-ink-faint">📨 MQTT message log</p>
        <ul className="flex flex-col gap-0.5 text-[11px]">
          {log.map((e, i) => (
            <li
              key={`${e.tick}-${e.topic}`}
              className="flex items-center justify-between tabular-nums"
              style={i === 0 ? { animation: "g9smartcitymqtt-slidein 0.18s ease-out" } : undefined}
            >
              <span style={{ color: ACCENT }}>{e.topic}</span>
              <span className="text-ink-dim">
                {e.value}
                {e.unit}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* ---------------- STATUS ---------------- */}
      <div
        className="rounded-lg border px-3 py-2 text-xs"
        role="status"
        aria-live="polite"
        style={{
          borderColor: won ? GREEN : "var(--color-line)",
          color: won ? GREEN : "var(--color-ink-dim)",
        }}
      >
        {status}
      </div>

      {/* ---------------- CHECKLIST ---------------- */}
      <div className="panel flex flex-col gap-1.5 rounded-xl p-3">
        <p className="text-[11px] uppercase tracking-tech text-ink-faint">events to automate ({okCount}/3)</p>
        {checklist.map(({ action, state }) => {
          const spec = EVENT_BY_ACTION[action.id];
          const mark = state === "ok" ? "✅" : state === "early" ? "⚠️" : "⬜";
          const note =
            state === "ok"
              ? `fired at ${action.live === "ALERT" ? "rush" : action.id === "fan" ? "heat peak" : "dusk"} ✓`
              : state === "early"
                ? "fired at the wrong moment"
                : `should fire at ${spec.when}`;
          return (
            <div key={action.id} className="flex items-center gap-2 text-[11px]">
              <span aria-hidden>{mark}</span>
              <span className="text-ink-dim">
                {action.emoji} {action.label}
              </span>
              <span
                className="ml-auto text-[10px]"
                style={{ color: state === "ok" ? GREEN : state === "early" ? AMBER : "var(--color-ink-faint)" }}
              >
                {note}
              </span>
            </div>
          );
        })}
      </div>

      {won && (
        <div
          className="rounded-lg border p-3 text-center text-xs"
          style={{ borderColor: GREEN, color: "var(--color-ink)", animation: "g9smartcitymqtt-pop 0.4s ease-out" }}
        >
          Your dashboard subscribed to three topics and let threshold rules drive the whole city — that
          is exactly how real MQTT IoT automation works. ✨🎉
        </div>
      )}

      {/* ---------------- RULE BUILDER ---------------- */}
      <div className="panel flex flex-col gap-2 rounded-xl p-3">
        <p className="text-[11px] uppercase tracking-tech text-ink-faint">subscriber rules — IF topic … THEN action</p>
        {rules.map((r, i) => {
          const node = NODE_BY_ID[r.node];
          const action = ACTIONS.find((a) => a.id === r.action);
          return (
            <div key={`rule-${i}`} className="rounded-lg border border-line bg-panel-2/40 p-2">
              <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                <span className="text-ink-faint">IF</span>
                {/* topic / node select */}
                <select
                  value={r.node}
                  onChange={(e) => editRule(i, { node: e.target.value as NodeId })}
                  disabled={won}
                  aria-label={`Topic for rule ${i + 1}`}
                  className="rounded-md border border-line bg-panel px-1.5 py-0.5 text-[11px]"
                  style={{ color: ACCENT }}
                >
                  {NODES.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.topic}
                    </option>
                  ))}
                </select>
                {/* comparison toggle */}
                <div
                  className="inline-flex overflow-hidden rounded-md border border-line"
                  role="group"
                  aria-label={`Comparison for rule ${i + 1}`}
                >
                  {(["<", ">"] as const).map((c) => (
                    <button
                      key={c}
                      type="button"
                      onPointerDown={() => !won && editRule(i, { cmp: c })}
                      aria-pressed={r.cmp === c}
                      aria-label={`compare ${c === ">" ? "greater than" : "less than"}`}
                      className="px-2 py-0.5 font-display"
                      style={{
                        touchAction: "manipulation",
                        background: r.cmp === c ? ACCENT : "transparent",
                        color: r.cmp === c ? "#05070d" : "var(--color-ink-dim)",
                      }}
                    >
                      {c}
                    </button>
                  ))}
                </div>
                {/* threshold chips */}
                <div className="flex flex-wrap gap-1">
                  {THRESHOLDS[r.node].map((th) => (
                    <button
                      key={th}
                      type="button"
                      onPointerDown={() => !won && editRule(i, { threshold: th })}
                      aria-pressed={r.threshold === th}
                      aria-label={`set rule ${i + 1} threshold to ${th}`}
                      className="rounded-md border px-1.5 py-0.5 text-[11px] font-display tabular-nums"
                      style={{
                        touchAction: "manipulation",
                        borderColor: r.threshold === th ? ACCENT : "var(--color-line)",
                        background:
                          r.threshold === th ? "color-mix(in srgb, #22d3ee 18%, transparent)" : "transparent",
                        color: r.threshold === th ? ACCENT : "var(--color-ink-dim)",
                      }}
                    >
                      {th}
                      {node.unit}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
                <span className="text-ink-faint">THEN</span>
                <select
                  value={r.action}
                  onChange={(e) => editRule(i, { action: e.target.value as ActionId })}
                  disabled={won}
                  aria-label={`Action for rule ${i + 1}`}
                  className="rounded-md border border-line bg-panel px-1.5 py-0.5 text-[11px] text-ink-dim"
                >
                  {ACTIONS.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.emoji} {a.label}
                    </option>
                  ))}
                </select>
                {action && (
                  <span className="ml-auto text-[10px]" style={{ color: liveFired[action.id] ? ACCENT : "var(--color-ink-faint)" }}>
                    {liveFired[action.id] ? "● firing" : "○ quiet"}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ---------------- CONTROLS ---------------- */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={reset}
          className="rounded-lg border border-line bg-panel/60 px-4 py-2 text-sm font-medium text-ink-dim"
          aria-label="Reset all rules and the timeline"
        >
          Reset
        </button>
        <button
          type="button"
          onClick={play}
          disabled={playing || won}
          className="rounded-lg px-5 py-2 text-sm font-semibold disabled:opacity-60"
          style={{ background: ACCENT, color: "#05070d" }}
          aria-label="Play the scripted day and run the rules on the live stream"
        >
          {won ? "Automated ✓" : playing ? `Streaming ${tick}/${TICKS - 1}` : "▶ Play the day"}
        </button>
      </div>
    </div>
  );
}
