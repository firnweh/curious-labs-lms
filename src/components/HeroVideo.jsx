"use client";
/* eslint-disable */
// ─────────────────────────────────────────────────────────────────────────────
// Curious Labs — 3D Modelling hero video.
// Ported verbatim from the Claude Design handoff "3D Modeling for Kids"
// (project/video.jsx = animations engine + scene). The prototype's <Stage>
// chrome (scrubber, letterbox, drop-shadow, persistence) is replaced by a
// stripped, cover-filling <HeroStage> so the piece runs full-bleed as a
// carousel slide. Fonts remapped to the app's next/font CSS variables.
// .jsx (not .tsx): checkJs is off, so this untyped port isn't type-checked.
// ─────────────────────────────────────────────────────────────────────────────
import * as React from "react";

// @ds-adherence-ignore -- omelette starter scaffold (raw elements/hex/px by design)

/* BEGIN USAGE */
// animations.jsx
// Reusable animation starter: Stage, Timeline, Sprite, easing helpers.
// Exports (to window): Stage, Sprite, PlaybackBar, TextSprite, ImageSprite, RectSprite,
//   useTime, useTimeline, useSprite, Easing, interpolate, animate, clamp.
//
// Usage (in an HTML file that loads React + Babel):
//
//   <Stage width={1280} height={720} duration={10} background="#f6f4ef">
//     <MyScene />
//   </Stage>
//
// <Stage> auto-scales to the viewport and provides the scrubber, play/pause,
// ←/→ seek, space, and 0-to-reset controls, and persists the playhead.
// Inside <Stage>, any child can call useTime() to read the current
// playhead (seconds). Or wrap content in <Sprite start={1} end={4}>...</Sprite>
// to only render during that window -- children receive a `localTime` and
// `progress` via the useSprite() hook. Use Easing + interpolate()/animate()
// for tweens; TextSprite / ImageSprite / RectSprite have built-in entry/exit.
// Build YOUR scenes by composing Sprites inside a Stage.
/* END USAGE */
// ─────────────────────────────────────────────────────────────────────────────

// ── Easing functions (hand-rolled, Popmotion-style) ─────────────────────────
// All easings take t ∈ [0,1] and return eased t ∈ [0,1] (may overshoot for back/elastic).
const Easing = {
  linear: (t) => t,

  // Quad
  easeInQuad:    (t) => t * t,
  easeOutQuad:   (t) => t * (2 - t),
  easeInOutQuad: (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),

  // Cubic
  easeInCubic:    (t) => t * t * t,
  easeOutCubic:   (t) => (--t) * t * t + 1,
  easeInOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1),

  // Quart
  easeInQuart:    (t) => t * t * t * t,
  easeOutQuart:   (t) => 1 - (--t) * t * t * t,
  easeInOutQuart: (t) => (t < 0.5 ? 8 * t * t * t * t : 1 - 8 * (--t) * t * t * t),

  // Expo
  easeInExpo:  (t) => (t === 0 ? 0 : Math.pow(2, 10 * (t - 1))),
  easeOutExpo: (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  easeInOutExpo: (t) => {
    if (t === 0) return 0;
    if (t === 1) return 1;
    if (t < 0.5) return 0.5 * Math.pow(2, 20 * t - 10);
    return 1 - 0.5 * Math.pow(2, -20 * t + 10);
  },

  // Sine
  easeInSine:    (t) => 1 - Math.cos((t * Math.PI) / 2),
  easeOutSine:   (t) => Math.sin((t * Math.PI) / 2),
  easeInOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,

  // Back (overshoot)
  easeOutBack: (t) => {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  easeInBack: (t) => {
    const c1 = 1.70158, c3 = c1 + 1;
    return c3 * t * t * t - c1 * t * t;
  },
  easeInOutBack: (t) => {
    const c1 = 1.70158, c2 = c1 * 1.525;
    return t < 0.5
      ? (Math.pow(2 * t, 2) * ((c2 + 1) * 2 * t - c2)) / 2
      : (Math.pow(2 * t - 2, 2) * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2;
  },

  // Elastic
  easeOutElastic: (t) => {
    const c4 = (2 * Math.PI) / 3;
    if (t === 0) return 0;
    if (t === 1) return 1;
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  },
};

// ── Core interpolation helpers ──────────────────────────────────────────────

// Clamp a value to [min, max]
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

// interpolate([0, 0.5, 1], [0, 100, 50], ease?) -> fn(t)
// Popmotion-style: linearly maps t across input keyframes to output values,
// with optional easing per segment (single fn or array of fns).
function interpolate(input, output, ease = Easing.linear) {
  return (t) => {
    if (t <= input[0]) return output[0];
    if (t >= input[input.length - 1]) return output[output.length - 1];
    for (let i = 0; i < input.length - 1; i++) {
      if (t >= input[i] && t <= input[i + 1]) {
        const span = input[i + 1] - input[i];
        const local = span === 0 ? 0 : (t - input[i]) / span;
        const easeFn = Array.isArray(ease) ? (ease[i] || Easing.linear) : ease;
        const eased = easeFn(local);
        return output[i] + (output[i + 1] - output[i]) * eased;
      }
    }
    return output[output.length - 1];
  };
}

// animate({from, to, start, end, ease})(t) — simpler single-segment tween.
// Returns `from` before `start`, `to` after `end`.
function animate({ from = 0, to = 1, start = 0, end = 1, ease = Easing.easeInOutCubic }) {
  return (t) => {
    if (t <= start) return from;
    if (t >= end) return to;
    const local = (t - start) / (end - start);
    return from + (to - from) * ease(local);
  };
}

// ── Timeline context ────────────────────────────────────────────────────────

const TimelineContext = React.createContext({ time: 0, duration: 10, playing: false });

const useTime = () => React.useContext(TimelineContext).time;
const useTimeline = () => React.useContext(TimelineContext);

// ── Sprite ──────────────────────────────────────────────────────────────────
// Renders children only when the playhead is inside [start, end]. Provides
// a sub-context with `localTime` (seconds since start) and `progress` (0..1).
//
//   <Sprite start={2} end={5}>
//     {({ localTime, progress }) => <Thing x={progress * 100} />}
//   </Sprite>
//
// Or as a plain wrapper — children can call useSprite() themselves.

const SpriteContext = React.createContext({ localTime: 0, progress: 0, duration: 0 });
const useSprite = () => React.useContext(SpriteContext);

function Sprite({ start = 0, end = Infinity, children, keepMounted = false }) {
  const { time } = useTimeline();
  const visible = time >= start && time <= end;
  if (!visible && !keepMounted) return null;

  const duration = end - start;
  const localTime = Math.max(0, time - start);
  const progress = duration > 0 && isFinite(duration)
    ? clamp(localTime / duration, 0, 1)
    : 0;

  const value = { localTime, progress, duration, visible };

  return (
    <SpriteContext.Provider value={value}>
      {typeof children === 'function' ? children(value) : children}
    </SpriteContext.Provider>
  );
}

// ── Sample sprite components ────────────────────────────────────────────────

// TextSprite: fades/slides text in on entry, holds, then fades out on exit.
// Props: text, x, y, size, color, font, entryDur, exitDur, align
function TextSprite({
  text,
  x = 0, y = 0,
  size = 48,
  color = '#111',
  font = 'Inter, system-ui, sans-serif',
  weight = 600,
  entryDur = 0.45,
  exitDur = 0.35,
  entryEase = Easing.easeOutBack,
  exitEase = Easing.easeInCubic,
  align = 'left',
  letterSpacing = '-0.01em',
}) {
  const { localTime, duration } = useSprite();
  const exitStart = Math.max(0, duration - exitDur);

  let opacity = 1;
  let ty = 0;

  if (localTime < entryDur) {
    const t = entryEase(clamp(localTime / entryDur, 0, 1));
    opacity = t;
    ty = (1 - t) * 16;
  } else if (localTime > exitStart) {
    const t = exitEase(clamp((localTime - exitStart) / exitDur, 0, 1));
    opacity = 1 - t;
    ty = -t * 8;
  }

  const translateX = align === 'center' ? '-50%' : align === 'right' ? '-100%' : '0';

  return (
    <div style={{
      position: 'absolute',
      left: x, top: y,
      transform: `translate(${translateX}, ${ty}px)`,
      opacity,
      fontFamily: font,
      fontSize: size,
      fontWeight: weight,
      color,
      letterSpacing,
      whiteSpace: 'pre',
      lineHeight: 1.1,
      willChange: 'transform, opacity',
    }}>
      {text}
    </div>
  );
}

// ImageSprite: scales + fades in; optional Ken Burns drift during hold.
function ImageSprite({
  src,
  x = 0, y = 0,
  width = 400, height = 300,
  entryDur = 0.6,
  exitDur = 0.4,
  kenBurns = false,
  kenBurnsScale = 1.08,
  radius = 12,
  fit = 'cover',
  placeholder = null, // {label: string} for striped placeholder
}) {
  const { localTime, duration } = useSprite();
  const exitStart = Math.max(0, duration - exitDur);

  let opacity = 1;
  let scale = 1;

  if (localTime < entryDur) {
    const t = Easing.easeOutCubic(clamp(localTime / entryDur, 0, 1));
    opacity = t;
    scale = 0.96 + 0.04 * t;
  } else if (localTime > exitStart) {
    const t = Easing.easeInCubic(clamp((localTime - exitStart) / exitDur, 0, 1));
    opacity = 1 - t;
    scale = (kenBurns ? kenBurnsScale : 1) + 0.02 * t;
  } else if (kenBurns) {
    const holdSpan = exitStart - entryDur;
    const holdT = holdSpan > 0 ? (localTime - entryDur) / holdSpan : 0;
    scale = 1 + (kenBurnsScale - 1) * holdT;
  }

  const content = placeholder ? (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'repeating-linear-gradient(135deg, #e9e6df 0 10px, #dcd8cf 10px 20px)',
      color: '#6b6458',
      fontFamily: 'JetBrains Mono, ui-monospace, monospace',
      fontSize: 13,
      letterSpacing: '0.04em',
      textTransform: 'uppercase',
    }}>
      {placeholder.label || 'image'}
    </div>
  ) : (
    <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: fit, display: 'block' }} />
  );

  return (
    <div style={{
      position: 'absolute',
      left: x, top: y,
      width, height,
      opacity,
      transform: `scale(${scale})`,
      transformOrigin: 'center',
      borderRadius: radius,
      overflow: 'hidden',
      willChange: 'transform, opacity',
    }}>
      {content}
    </div>
  );
}

// RectSprite: simple rectangle that animates position/size/color via props.
// Useful demo primitive — takes a `render` fn for per-frame customization.
function RectSprite({
  x = 0, y = 0,
  width = 100, height = 100,
  color = '#111',
  radius = 8,
  entryDur = 0.4,
  exitDur = 0.3,
  render, // optional: (ctx) => style overrides
}) {
  const spriteCtx = useSprite();
  const { localTime, duration } = spriteCtx;
  const exitStart = Math.max(0, duration - exitDur);

  let opacity = 1;
  let scale = 1;

  if (localTime < entryDur) {
    const t = Easing.easeOutBack(clamp(localTime / entryDur, 0, 1));
    opacity = clamp(localTime / entryDur, 0, 1);
    scale = 0.4 + 0.6 * t;
  } else if (localTime > exitStart) {
    const t = Easing.easeInQuad(clamp((localTime - exitStart) / exitDur, 0, 1));
    opacity = 1 - t;
    scale = 1 - 0.15 * t;
  }

  const overrides = render ? render(spriteCtx) : {};

  return (
    <div style={{
      position: 'absolute',
      left: x, top: y,
      width, height,
      background: color,
      borderRadius: radius,
      opacity,
      transform: `scale(${scale})`,
      transformOrigin: 'center',
      willChange: 'transform, opacity',
      ...overrides,
    }} />
  );
}


function Stage({
  width = 1280,
  height = 720,
  duration = 10,
  background = '#f6f4ef',
  fps = 60,
  loop = true,
  autoplay = true,
  persistKey = 'animstage',
  children,
}) {
  const [time, setTime] = React.useState(() => {
    try {
      const v = parseFloat(localStorage.getItem(persistKey + ':t') || '0');
      return isFinite(v) ? clamp(v, 0, duration) : 0;
    } catch { return 0; }
  });
  const [playing, setPlaying] = React.useState(autoplay);
  const [hoverTime, setHoverTime] = React.useState(null);
  const [scale, setScale] = React.useState(1);

  const stageRef = React.useRef(null);
  const canvasRef = React.useRef(null);
  const rafRef = React.useRef(null);
  const lastTsRef = React.useRef(null);

  // Persist playhead
  React.useEffect(() => {
    try { localStorage.setItem(persistKey + ':t', String(time)); } catch {}
  }, [time, persistKey]);

  // Auto-scale to fit viewport
  React.useEffect(() => {
    if (!stageRef.current) return;
    const el = stageRef.current;
    const measure = () => {
      const barH = 44; // playback bar height
      const s = Math.min(
        el.clientWidth / width,
        (el.clientHeight - barH) / height
      );
      setScale(Math.max(0.05, s));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [width, height]);

  // Animation loop
  React.useEffect(() => {
    if (!playing) {
      lastTsRef.current = null;
      return;
    }
    const step = (ts) => {
      if (lastTsRef.current == null) lastTsRef.current = ts;
      const dt = (ts - lastTsRef.current) / 1000;
      lastTsRef.current = ts;
      setTime((t) => {
        let next = t + dt;
        if (next >= duration) {
          if (loop) next = next % duration;
          else { next = duration; setPlaying(false); }
        }
        return next;
      });
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      lastTsRef.current = null;
    };
  }, [playing, duration, loop]);

  // Keyboard: space = play/pause, ← → = seek
  React.useEffect(() => {
    const onKey = (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      if (e.code === 'Space') {
        e.preventDefault();
        setPlaying(p => !p);
      } else if (e.code === 'ArrowLeft') {
        setTime(t => clamp(t - (e.shiftKey ? 1 : 0.1), 0, duration));
      } else if (e.code === 'ArrowRight') {
        setTime(t => clamp(t + (e.shiftKey ? 1 : 0.1), 0, duration));
      } else if (e.key === '0' || e.code === 'Home') {
        setTime(0);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [duration]);

  const displayTime = hoverTime != null ? hoverTime : time;

  const ctxValue = React.useMemo(
    () => ({ time: displayTime, duration, playing, setTime, setPlaying }),
    [displayTime, duration, playing]
  );

  return (
    <div
      ref={stageRef}
      style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center',
        background: '#0a0a0a',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      {/* Canvas area — vertically centered in remaining space */}
      <div style={{
        flex: 1,
        width: '100%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden',
        minHeight: 0,
      }}>
        <div
          ref={canvasRef}
          style={{
            width, height,
            background,
            position: 'relative',
            transform: `scale(${scale})`,
            transformOrigin: 'center',
            flexShrink: 0,
            boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
            overflow: 'hidden',
          }}
        >
          <TimelineContext.Provider value={ctxValue}>
            {children}
          </TimelineContext.Provider>
        </div>
      </div>

      {/* Playback bar — stacked below canvas, never overlapping */}
      <PlaybackBar
        time={displayTime}
        actualTime={time}
        duration={duration}
        playing={playing}
        onPlayPause={() => setPlaying(p => !p)}
        onReset={() => { setTime(0); }}
        onSeek={(t) => setTime(t)}
        onHover={(t) => setHoverTime(t)}
      />
    </div>
  );
}

// ── Playback bar ────────────────────────────────────────────────────────────
// Play/pause, return-to-begin, scrub track, time display.
// Uses fixed-width time fields so layout doesn't thrash.

function PlaybackBar({ time, duration, playing, onPlayPause, onReset, onSeek, onHover }) {
  const trackRef = React.useRef(null);
  const [dragging, setDragging] = React.useState(false);

  const timeFromEvent = React.useCallback((e) => {
    const rect = trackRef.current.getBoundingClientRect();
    const x = clamp((e.clientX - rect.left) / rect.width, 0, 1);
    return x * duration;
  }, [duration]);

  const onTrackMove = (e) => {
    if (!trackRef.current) return;
    const t = timeFromEvent(e);
    if (dragging) {
      onSeek(t);
    } else {
      onHover(t);
    }
  };

  const onTrackLeave = () => {
    if (!dragging) onHover(null);
  };

  const onTrackDown = (e) => {
    setDragging(true);
    const t = timeFromEvent(e);
    onSeek(t);
    onHover(null);
  };

  React.useEffect(() => {
    if (!dragging) return;
    const onUp = () => setDragging(false);
    const onMove = (e) => {
      if (!trackRef.current) return;
      const t = timeFromEvent(e);
      onSeek(t);
    };
    window.addEventListener('mouseup', onUp);
    window.addEventListener('mousemove', onMove);
    return () => {
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('mousemove', onMove);
    };
  }, [dragging, timeFromEvent, onSeek]);

  const pct = duration > 0 ? (time / duration) * 100 : 0;
  const fmt = (t) => {
    const total = Math.max(0, t);
    const m = Math.floor(total / 60);
    const s = Math.floor(total % 60);
    const cs = Math.floor((total * 100) % 100);
    return `${String(m).padStart(1, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
  };

  const mono = 'JetBrains Mono, ui-monospace, SFMono-Regular, monospace';

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '8px 16px',
      background: 'rgba(20,20,20,0.92)',
      borderTop: '1px solid rgba(255,255,255,0.08)',
      width: '100%',
      maxWidth: 680,
      alignSelf: 'center',

      borderRadius: 8,
      color: '#f6f4ef',
      fontFamily: 'Inter, system-ui, sans-serif',
      userSelect: 'none',
      flexShrink: 0,
    }}>
      <IconButton onClick={onReset} title="Return to start (0)">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M3 2v10M12 2L5 7l7 5V2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round"/>
        </svg>
      </IconButton>
      <IconButton onClick={onPlayPause} title="Play/pause (space)">
        {playing ? (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <rect x="3" y="2" width="3" height="10" fill="currentColor"/>
            <rect x="8" y="2" width="3" height="10" fill="currentColor"/>
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M3 2l9 5-9 5V2z" fill="currentColor"/>
          </svg>
        )}
      </IconButton>

      {/* Current time: fixed width so it doesn't thrash */}
      <div style={{
        fontFamily: mono,
        fontSize: 12,
        fontVariantNumeric: 'tabular-nums',
        width: 64, textAlign: 'right',
        color: '#f6f4ef',
      }}>
        {fmt(time)}
      </div>

      {/* Scrub track */}
      <div
        ref={trackRef}
        onMouseMove={onTrackMove}
        onMouseLeave={onTrackLeave}
        onMouseDown={onTrackDown}
        style={{
          flex: 1,
          height: 22,
          position: 'relative',
          cursor: 'pointer',
          display: 'flex', alignItems: 'center',
        }}
      >
        <div style={{
          position: 'absolute',
          left: 0, right: 0, height: 4,
          background: 'rgba(255,255,255,0.12)',
          borderRadius: 2,
        }}/>
        <div style={{
          position: 'absolute',
          left: 0, width: `${pct}%`, height: 4,
          background: 'oklch(72% 0.12 250)',
          borderRadius: 2,
        }}/>
        <div style={{
          position: 'absolute',
          left: `${pct}%`, top: '50%',
          width: 12, height: 12,
          marginLeft: -6, marginTop: -6,
          background: '#fff',
          borderRadius: 6,
          boxShadow: '0 2px 4px rgba(0,0,0,0.4)',
        }}/>
      </div>

      {/* Duration: fixed width */}
      <div style={{
        fontFamily: mono,
        fontSize: 12,
        fontVariantNumeric: 'tabular-nums',
        width: 64, textAlign: 'left',
        color: 'rgba(246,244,239,0.55)',
      }}>
        {fmt(duration)}
      </div>
    </div>
  );
}

function IconButton({ children, onClick, title }) {
  const [hover, setHover] = React.useState(false);
  return (
    <button
      onClick={onClick}
      title={title}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: 28, height: 28,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: hover ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 6,
        color: '#f6f4ef',
        cursor: 'pointer',
        padding: 0,
        transition: 'background 120ms',
      }}
    >
      {children}
    </button>
  );
}
// ── Curious Labs hero video — scenes (appended after animations engine) ──────
// Refers to in-scope: React, Stage, Sprite, useTime, useSprite, Easing,
//                     interpolate, animate, clamp, TextSprite.

const C = {
  base: '#070E1B', base2: '#06121F',
  cyan: '#38BDF8', cyan2: '#22D3EE',
  purple: '#C084FC', pink: '#F472B6',
  warm: '#FBBF24', warm2: '#FB7185',
  head: '#DFE6F2', body: '#8FA3BF',
};
const FH = "var(--font-orbitron), 'Orbitron', system-ui, sans-serif";
const FB = "var(--font-body), 'Inter', system-ui, sans-serif";
const FM = "var(--font-mono), 'JetBrains Mono', ui-monospace, monospace";

// fade-in / fade-out helper based on local sprite time
function fio(localTime, duration, inDur = 0.5, outDur = 0.5) {
  let o = 1, y = 0;
  if (localTime < inDur) {
    const t = Easing.easeOutCubic(clamp(localTime / inDur, 0, 1));
    o = t; y = (1 - t) * 24;
  } else if (localTime > duration - outDur) {
    const t = Easing.easeInCubic(clamp((localTime - (duration - outDur)) / outDur, 0, 1));
    o = 1 - t; y = -t * 14;
  }
  return { opacity: o, ty: y };
}

function Center({ children, style }) {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', ...style }}>
      {children}
    </div>
  );
}

// ── Starfield (canvas) with warp-in driven by global time ───────────────────
function Starfield() {
  const time = useTime();
  const ref = React.useRef(null);
  const starsRef = React.useRef(null);
  if (!starsRef.current) {
    const stars = [];
    for (let i = 0; i < 280; i++) {
      const layer = i < 110 ? 0 : i < 210 ? 1 : 2;
      const hueRoll = Math.random();
      stars.push({
        x: Math.random(), y: Math.random(),
        r: layer === 0 ? 0.7 : layer === 1 ? 1.1 : 1.7,
        layer,
        tw: Math.random() * Math.PI * 2,
        spd: 0.7 + Math.random() * 1.8,
        hue: hueRoll < 0.34 ? 199 : hueRoll < 0.5 ? 265 : null,
      });
    }
    starsRef.current = stars;
  }
  React.useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const ctx = cv.getContext('2d');
    const W = cv.width, H = cv.height, cx = W / 2, cy = H / 2;
    ctx.clearRect(0, 0, W, H);
    const warp = clamp(1 - time / 1.9, 0, 1);
    const warpE = Easing.easeInCubic(warp);
    if (time < 0.9) {
      const fa = (1 - time / 0.9);
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 520);
      g.addColorStop(0, `rgba(190,235,255,${0.9 * fa})`);
      g.addColorStop(0.4, `rgba(56,189,248,${0.35 * fa})`);
      g.addColorStop(1, 'rgba(56,189,248,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    for (const s of starsRef.current) {
      const px = s.x * W, py = s.y * H;
      const tw = 0.45 + 0.55 * Math.sin(time * s.spd + s.tw);
      const col = s.hue == null
        ? `rgba(255,255,255,${0.45 + 0.55 * tw})`
        : `hsla(${s.hue},92%,76%,${0.45 + 0.55 * tw})`;
      if (warpE > 0.015) {
        const dx = px - cx, dy = py - cy;
        const len = warpE * (0.55 + s.layer * 0.32);
        const sx = cx + dx * (1 - len), sy = cy + dy * (1 - len);
        ctx.strokeStyle = col; ctx.lineWidth = s.r * 1.3; ctx.globalAlpha = 0.85;
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(px, py); ctx.stroke();
      } else {
        ctx.fillStyle = col; ctx.globalAlpha = 1;
        ctx.beginPath(); ctx.arc(px, py, s.r, 0, 7); ctx.fill();
      }
    }
    // shooting stars / comets (recur over the loop)
    const comets = [
      { t0: 5.2, dur: 1.3, x0: 0.08, y0: 0.12, dx: 0.5, dy: 0.24 },
      { t0: 12.6, dur: 1.4, x0: 0.78, y0: 0.08, dx: -0.5, dy: 0.3 },
      { t0: 20.4, dur: 1.3, x0: 0.15, y0: 0.22, dx: 0.55, dy: 0.16 },
      { t0: 27.4, dur: 1.2, x0: 0.62, y0: 0.06, dx: 0.28, dy: 0.34 },
    ];
    for (const cm of comets) {
      const local = time - cm.t0;
      if (local < 0 || local > cm.dur) continue;
      const p = local / cm.dur;
      const ease = 1 - Math.pow(1 - p, 2);
      const hx = (cm.x0 + cm.dx * ease) * W, hy = (cm.y0 + cm.dy * ease) * H;
      const ang = Math.atan2(cm.dy, cm.dx), tailLen = 170;
      const tx = hx - Math.cos(ang) * tailLen, ty = hy - Math.sin(ang) * tailLen;
      const a = Math.sin(p * Math.PI);
      const grad = ctx.createLinearGradient(tx, ty, hx, hy);
      grad.addColorStop(0, 'rgba(214,247,255,0)');
      grad.addColorStop(1, `rgba(214,247,255,${0.9 * a})`);
      ctx.strokeStyle = grad; ctx.lineWidth = 2.6; ctx.lineCap = 'round'; ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(hx, hy); ctx.stroke();
      ctx.fillStyle = `rgba(255,255,255,${a})`;
      ctx.beginPath(); ctx.arc(hx, hy, 2.8, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
  });
  return <canvas ref={ref} width={1920} height={1080}
    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />;
}

// ── A distant planet (with optional ring) ───────────────────────────────────
function Planet({ size, x, y, grad, ring, ringColor, glow = 60, op = 0.6, phase = 0, drift = 0.25 }) {
  const time = useTime();
  const bob = Math.sin(time * drift + phase) * 12;
  return (
    <div style={{ position: 'absolute', left: x, top: y, width: size, height: size, opacity: op,
      transform: `translateY(${bob}px)`, pointerEvents: 'none' }}>
      {ring && (
        <div style={{ position: 'absolute', left: '50%', top: '50%', width: size * 1.85, height: size * 0.5,
          marginLeft: -(size * 1.85) / 2, marginTop: -(size * 0.5) / 2, borderRadius: '50%',
          border: `${Math.max(7, size * 0.035)}px solid ${ringColor}`,
          transform: 'rotateX(72deg) rotateZ(-20deg)', boxShadow: `0 0 26px ${ringColor}` }} />
      )}
      <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: grad,
        boxShadow: `0 0 ${glow}px ${ringColor || 'rgba(56,189,248,0.4)'}, inset -${size * 0.16}px -${size * 0.16}px ${size * 0.42}px rgba(4,12,28,0.88)` }} />
      {/* terminator sheen */}
      <div style={{ position: 'absolute', inset: 0, borderRadius: '50%',
        background: 'radial-gradient(circle at 34% 28%, rgba(255,255,255,0.22), transparent 42%)' }} />
    </div>
  );
}

// ── Cosmos background (always mounted) ──────────────────────────────────────
function Cosmos() {
  const time = useTime();
  const neb = (hue, x, y, sz, drift, op) => ({
    position: 'absolute',
    left: `${x + Math.sin(time * 0.08 + drift) * 2.2}%`,
    top: `${y + Math.cos(time * 0.07 + drift) * 2.2}%`,
    width: sz, height: sz, borderRadius: '50%',
    background: `radial-gradient(circle, ${hue} 0%, transparent 68%)`,
    filter: 'blur(90px)', opacity: op, pointerEvents: 'none',
  });
  const bokeh = [
    [200, 240, 22, C.cyan, 0], [1620, 360, 16, C.pink, 1.5], [380, 820, 18, C.purple, 3],
    [1500, 760, 14, C.cyan, 4.2], [900, 160, 12, C.warm, 2.1], [1180, 900, 20, C.purple, 5],
  ];
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden',
      background: `radial-gradient(125% 95% at 50% -12%, #11233f 0%, #0a182c 38%, ${C.base} 68%, ${C.base2} 100%)` }}>
      {/* aurora glow top */}
      <div style={{ position: 'absolute', left: '50%', top: '-22%', width: 1500, height: 700, marginLeft: -750,
        background: 'radial-gradient(circle, rgba(56,189,248,0.28), transparent 62%)', filter: 'blur(70px)', pointerEvents: 'none' }} />
      {/* nebulae */}
      <div style={neb('rgba(56,189,248,0.5)', 52, -8, 780, 0, 0.5)} />
      <div style={neb('rgba(192,132,252,0.5)', -12, 58, 840, 2, 0.44)} />
      <div style={neb('rgba(244,114,182,0.42)', 62, 72, 640, 4, 0.36)} />
      <div style={neb('rgba(45,120,220,0.42)', 22, 30, 700, 6, 0.34)} />
      {/* milky-way band */}
      <div style={{ position: 'absolute', left: '-12%', top: '24%', width: '124%', height: 420,
        transform: 'rotate(-17deg)', filter: 'blur(46px)', pointerEvents: 'none',
        background: 'linear-gradient(90deg, transparent, rgba(126,150,224,0.10) 28%, rgba(186,160,236,0.18) 50%, rgba(126,150,224,0.10) 72%, transparent)' }} />
      {/* distant galaxy */}
      <div style={{ position: 'absolute', left: '4%', top: '4%', width: 460, height: 460, opacity: 0.26,
        transform: `rotate(${time * 2.4}deg)`, filter: 'blur(26px)', pointerEvents: 'none',
        WebkitMaskImage: 'radial-gradient(circle, #000 0%, transparent 68%)',
        maskImage: 'radial-gradient(circle, #000 0%, transparent 68%)',
        background: 'conic-gradient(from 0deg, rgba(192,132,252,0), rgba(192,132,252,0.55), rgba(56,189,248,0.32), rgba(244,114,182,0.4), rgba(192,132,252,0))' }} />
      <Starfield />
      {/* bokeh dust */}
      {bokeh.map((b, i) => (
        <div key={i} style={{ position: 'absolute', left: b[0] + Math.sin(time * 0.2 + b[4]) * 16,
          top: b[1] + Math.cos(time * 0.16 + b[4]) * 14, width: b[2], height: b[2], borderRadius: '50%',
          background: b[3], filter: 'blur(5px)', opacity: 0.4, pointerEvents: 'none' }} />
      ))}
      {/* planets + moon (crisp, in front of stars) */}
      <Planet size={372} x={1480} y={628} op={0.6} glow={70} ring ringColor="rgba(192,132,252,0.5)" phase={0}
        grad="radial-gradient(circle at 36% 30%, #6fd6f2, #2f74bb 52%, #0c2c54 88%)" />
      <Planet size={208} x={-72} y={-66} op={0.5} glow={46} ringColor="rgba(244,114,182,0.4)" phase={2}
        grad="radial-gradient(circle at 38% 32%, #e6c8ff, #9a6ad0 46%, #532f88 84%)" />
      <Planet size={92} x={1520} y={132} op={0.72} glow={30} ringColor="rgba(160,180,210,0.4)" phase={3} drift={0.3}
        grad="radial-gradient(circle at 36% 30%, #eef2f8, #aab6c8 50%, #5b6679 86%)" />
      {/* vignette */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(120% 100% at 50% 50%, transparent 56%, rgba(3,8,18,0.58) 100%)' }} />
    </div>
  );
}

// ── HUD chrome ──────────────────────────────────────────────────────────────
function HUD() {
  const time = useTime();
  const appear = Easing.easeOutCubic(clamp((time - 2.0) / 0.8, 0, 1));
  const op = appear * 0.9;
  const corner = { position: 'absolute', fontFamily: FM, fontSize: 15, letterSpacing: '0.16em',
    color: 'rgba(143,163,191,0.85)', textTransform: 'uppercase', opacity: op };
  const tick = String(Math.floor((time * 12) % 1000)).padStart(3, '0');
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <div style={{ ...corner, left: 54, top: 46, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: C.cyan,
          boxShadow: `0 0 10px ${C.cyan}` }} />
        Curious Labs · Build Studio
      </div>
      <div style={{ ...corner, right: 54, top: 46 }}>3D ENGINE v3.0 · {tick}</div>
      <div style={{ ...corner, left: 54, bottom: 46, fontSize: 13 }}>STEM · AGES 8–16</div>
      <div style={{ ...corner, right: 54, bottom: 46, fontSize: 13 }}>RENDER · REALTIME</div>
      <div style={{ position: 'absolute', inset: 28, opacity: op * 0.5 }}>
        {[['top', 'left'], ['top', 'right'], ['bottom', 'left'], ['bottom', 'right']].map((c, i) => (
          <div key={i} style={{ position: 'absolute', [c[0]]: 0, [c[1]]: 0, width: 34, height: 34,
            [`border${c[0][0].toUpperCase() + c[0].slice(1)}`]: `2px solid ${C.cyan}`,
            [`border${c[1][0].toUpperCase() + c[1].slice(1)}`]: `2px solid ${C.cyan}` }} />
        ))}
      </div>
    </div>
  );
}

// ── Gradient headline / sub ─────────────────────────────────────────────────
function HeadLine({ text, grad, size = 92, ty = 0, opacity = 1, weight = 800, ls = '0.01em' }) {
  return (
    <div style={{ fontFamily: FH, fontWeight: weight, fontSize: size, lineHeight: 1.08,
      letterSpacing: ls, transform: `translateY(${ty}px)`, opacity,
      padding: '0.04em 0.14em 0.16em 0.02em', width: 'fit-content', maxWidth: '100%',
      background: grad || `linear-gradient(90deg, ${C.head}, ${C.head})`,
      WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
      whiteSpace: 'pre' }}>
      {text}
    </div>
  );
}
function Sub({ text, size = 30, ty = 0, opacity = 1 }) {
  return (
    <div style={{ fontFamily: FB, fontWeight: 400, fontSize: size, color: C.body,
      transform: `translateY(${ty}px)`, opacity, letterSpacing: '0.01em' }}>
      {text}
    </div>
  );
}

// ── Wireframe 3D cube ───────────────────────────────────────────────────────
function WireCube({ size = 230, rotBase = 0 }) {
  const time = useTime();
  const rot = rotBase + time * 38;
  const h = size / 2;
  const face = (t) => ({ position: 'absolute', width: size, height: size, left: '50%', top: '50%',
    marginLeft: -h, marginTop: -h, transform: t, border: `2px solid ${C.cyan}`,
    background: 'rgba(56,189,248,0.06)',
    boxShadow: `inset 0 0 26px rgba(56,189,248,0.35), 0 0 16px rgba(56,189,248,0.35)` });
  const faces = [
    `rotateY(0deg) translateZ(${h}px)`, `rotateY(180deg) translateZ(${h}px)`,
    `rotateY(90deg) translateZ(${h}px)`, `rotateY(-90deg) translateZ(${h}px)`,
    `rotateX(90deg) translateZ(${h}px)`, `rotateX(-90deg) translateZ(${h}px)`,
  ];
  const verts = [];
  for (const sx of [-h, h]) for (const sy of [-h, h]) for (const sz of [-h, h]) verts.push([sx, sy, sz]);
  return (
    <div style={{ perspective: 1100 }}>
      <div style={{ position: 'relative', width: 0, height: 0, transformStyle: 'preserve-3d',
        transform: `rotateX(-22deg) rotateY(${rot}deg)` }}>
        {faces.map((t, i) => <div key={i} style={face(t)} />)}
        {verts.map((v, i) => (
          <div key={'v' + i} style={{ position: 'absolute', width: 10, height: 10, left: -5, top: -5,
            borderRadius: '50%', background: C.cyan2,
            boxShadow: `0 0 12px ${C.cyan}`, transform: `translate3d(${v[0]}px,${v[1]}px,${v[2]}px)` }} />
        ))}
      </div>
    </div>
  );
}

// ── The rocket — assembled from primitives, detailed & shaded ───────────────
function Rocket({ assemble = 1, spin = true, ignite = false, tint = 'warm', float = true }) {
  const time = useTime();
  const EC = Easing.easeOutCubic;
  const part = (s, d) => EC(clamp((assemble - s) / d, 0, 1));
  const pBody = part(0.0, 0.42);
  const pNose = part(0.16, 0.4);
  const pFinL = part(0.30, 0.4);
  const pFinR = part(0.38, 0.4);
  const pWin = part(0.5, 0.4);
  const pNoz = part(0.46, 0.4);
  const pFlame = ignite ? 1 : 0;
  const wobble = spin ? Math.sin(time * 1.0) * 12 : 0;
  const bob = float ? Math.sin(time * 0.9) * 12 : 0;
  const accent = tint === 'pink'
    ? ['#fbcfe8', '#f472b6', '#be3d82']
    : tint === 'purple'
      ? ['#ddd0fb', '#c084fc', '#7c4bc9']
      : ['#ffe6b0', '#fb923c', '#e23b54'];
  const noseGrad = `linear-gradient(118deg, #ffffff 2%, ${accent[0]} 16%, ${accent[1]} 56%, ${accent[2]} 100%)`;
  const flick = 1 + 0.22 * Math.sin(time * 24) + 0.1 * Math.sin(time * 41);
  const rivet = (x, y) => ({ position: 'absolute', left: x, top: y, width: 6, height: 6, borderRadius: '50%',
    background: 'radial-gradient(circle at 35% 35%, #f4f8ff, #6b7da0)', boxShadow: '0 0 2px rgba(0,0,0,0.4)' });
  return (
    <div style={{ position: 'relative', width: 280, height: 640, perspective: 1400,
      transform: `translateY(${bob}px)` }}>
      <div style={{ position: 'absolute', inset: 0, transformStyle: 'preserve-3d',
        transform: `rotateY(${wobble}deg)` }}>
        <div style={{ position: 'absolute', left: 54, top: 110, width: 172, height: 440, borderRadius: '50%',
          background: `radial-gradient(circle, ${tint === 'warm' ? 'rgba(251,146,60,0.25)' : 'rgba(56,189,248,0.28)'}, transparent 70%)`,
          filter: 'blur(34px)', opacity: pBody }} />
        {/* nose cone */}
        <div style={{ position: 'absolute', left: 80, top: 34, width: 120, height: 152,
          borderRadius: '60px 60px 12px 12px', background: noseGrad, opacity: pNose, overflow: 'hidden',
          transform: `translateY(${(1 - pNose) * -150}px)`,
          boxShadow: '0 0 26px rgba(251,146,60,0.45), inset 0 0 26px rgba(0,0,0,0.18)' }}>
          <div style={{ position: 'absolute', left: 24, top: 8, width: 14, height: 124, borderRadius: 8,
            background: 'linear-gradient(#ffffffcc, transparent)', filter: 'blur(2px)' }} />
        </div>
        {/* body cylinder */}
        <div style={{ position: 'absolute', left: 80, top: 168, width: 120, height: 300,
          borderRadius: '20px 20px 26px 26px', opacity: pBody, overflow: 'hidden',
          transform: `translateY(${(1 - pBody) * 140}px)`,
          background: 'linear-gradient(90deg,#0e1726 0%,#48597f 14%,#aebdd6 32%,#f4f8ff 50%,#9fb0d2 66%,#3b4d70 84%,#0c1424 100%)',
          boxShadow: 'inset 0 0 22px rgba(255,255,255,0.18), 0 0 30px rgba(56,189,248,0.22)',
          border: '1px solid rgba(207,232,255,0.35)' }}>
          <div style={{ position: 'absolute', left: 24, top: 0, width: 12, height: '100%',
            background: 'linear-gradient(180deg, rgba(255,255,255,0.7), rgba(255,255,255,0.15))', filter: 'blur(3px)' }} />
          <div style={{ position: 'absolute', left: 0, top: 18, width: '100%', height: 22,
            background: `linear-gradient(90deg, ${accent[2]}, ${accent[1]}, ${accent[2]})`, opacity: 0.92 }} />
          <div style={{ position: 'absolute', left: 0, top: 150, width: '100%', height: 2, background: 'rgba(20,30,50,0.35)' }} />
          <div style={{ position: 'absolute', left: 0, top: 232, width: '100%', height: 2, background: 'rgba(20,30,50,0.35)' }} />
          <div style={rivet(10, 160)} /><div style={rivet(104, 160)} />
          <div style={rivet(10, 242)} /><div style={rivet(104, 242)} />
        </div>
        {/* window */}
        <div style={{ position: 'absolute', left: 103, top: 228, width: 74, height: 74, borderRadius: '50%',
          opacity: pWin, transform: `scale(${0.4 + 0.6 * pWin})`,
          background: 'radial-gradient(circle at 36% 30%, #e7faff, #22d3ee 52%, #0a4f6c)',
          border: '5px solid #eaf7ff', boxShadow: `0 0 22px ${C.cyan}, inset 0 0 14px rgba(8,60,82,0.8)` }}>
          <div style={{ position: 'absolute', left: 14, top: 10, width: 20, height: 14, borderRadius: '50%',
            background: 'rgba(255,255,255,0.8)', filter: 'blur(1px)' }} />
        </div>
        {/* fins */}
        <div style={{ position: 'absolute', left: 16, top: 368, width: 78, height: 134, opacity: pFinL,
          transform: `translateX(${(1 - pFinL) * -90}px)`,
          background: `linear-gradient(120deg, ${accent[1]}, ${accent[2]})`,
          clipPath: 'polygon(100% 0, 100% 100%, 0 100%)', boxShadow: '0 0 16px rgba(251,146,60,0.4)' }} />
        <div style={{ position: 'absolute', left: 186, top: 368, width: 78, height: 134, opacity: pFinR,
          transform: `translateX(${(1 - pFinR) * 90}px)`,
          background: `linear-gradient(240deg, ${accent[1]}, ${accent[2]})`,
          clipPath: 'polygon(0 0, 0 100%, 100% 100%)', boxShadow: '0 0 16px rgba(251,146,60,0.4)' }} />
        {/* nozzle */}
        <div style={{ position: 'absolute', left: 96, top: 462, width: 88, height: 50, opacity: pNoz, overflow: 'hidden',
          transform: `translateY(${(1 - pNoz) * 60}px)`,
          background: 'linear-gradient(90deg,#1c2640,#8493b0,#cfd9ee,#7c8aa8,#1a2238)',
          clipPath: 'polygon(12% 0, 88% 0, 100% 100%, 0 100%)' }}>
          <div style={{ position: 'absolute', left: '30%', top: 0, width: 2, height: '100%', background: 'rgba(15,22,40,0.5)' }} />
          <div style={{ position: 'absolute', left: '52%', top: 0, width: 2, height: '100%', background: 'rgba(15,22,40,0.5)' }} />
          <div style={{ position: 'absolute', left: '70%', top: 0, width: 2, height: '100%', background: 'rgba(15,22,40,0.5)' }} />
        </div>
        {/* flame */}
        {pFlame > 0 && (
          <div style={{ position: 'absolute', left: 110, top: 506, width: 60, height: 184, transformOrigin: 'top center',
            transform: `scaleY(${flick}) scaleX(${0.9 + 0.1 * Math.sin(time * 30)})`,
            borderRadius: '0 0 30px 30px / 0 0 120px 120px',
            background: 'linear-gradient(180deg,#ffffff 0%,#fde68a 22%,#fb923c 55%,#f43f5e 80%,transparent 100%)',
            filter: 'blur(2px)', opacity: 0.95 }} />
        )}
      </div>
    </div>
  );
}

// ── Detailed shaded robot ───────────────────────────────────────────────────
function MiniBot() {
  const eye = (x) => ({ position: 'absolute', left: x, top: 54, width: 20, height: 20, borderRadius: '50%',
    background: 'radial-gradient(circle at 40% 35%, #d6f7ff, #22d3ee 60%, #0a4f6c)', boxShadow: `0 0 12px ${C.cyan}` });
  const metal = 'linear-gradient(150deg,#eef3fb,#9fb0d2 52%,#46587c)';
  return (
    <div style={{ position: 'relative', width: 172, height: 212 }}>
      <div style={{ position: 'absolute', left: 36, top: 28, width: 100, height: 170, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(56,189,248,0.22), transparent 70%)', filter: 'blur(22px)' }} />
      {/* antenna */}
      <div style={{ position: 'absolute', left: 81, top: -2, width: 6, height: 26, background: 'linear-gradient(#9fb0d2,#3b4d70)' }} />
      <div style={{ position: 'absolute', left: 73, top: -20, width: 22, height: 22, borderRadius: '50%',
        background: `radial-gradient(circle at 35% 35%, #fff, ${C.pink})`, boxShadow: `0 0 14px ${C.pink}` }} />
      {/* head */}
      <div style={{ position: 'absolute', left: 36, top: 20, width: 98, height: 78, borderRadius: 22, background: metal,
        boxShadow: 'inset 0 2px 6px rgba(255,255,255,0.6), 0 6px 18px rgba(0,0,0,0.4)' }} />
      {/* visor */}
      <div style={{ position: 'absolute', left: 48, top: 42, width: 74, height: 44, borderRadius: 14,
        background: 'linear-gradient(160deg,#0b1830,#13294b)', border: '2px solid #5b6f96',
        boxShadow: 'inset 0 0 14px rgba(0,0,0,0.6)' }} />
      <div style={eye(58)} /><div style={eye(94)} />
      {/* side ears */}
      <div style={{ position: 'absolute', left: 28, top: 50, width: 12, height: 22, borderRadius: 5, background: '#3b4d70' }} />
      <div style={{ position: 'absolute', left: 132, top: 50, width: 12, height: 22, borderRadius: 5, background: '#3b4d70' }} />
      {/* neck */}
      <div style={{ position: 'absolute', left: 74, top: 94, width: 22, height: 14, background: '#5b6f96' }} />
      {/* torso */}
      <div style={{ position: 'absolute', left: 42, top: 106, width: 86, height: 86, borderRadius: 18,
        background: 'linear-gradient(150deg,#e4ebf6,#8a9cc0 52%,#3b4d70)',
        boxShadow: 'inset 0 2px 6px rgba(255,255,255,0.5), 0 8px 20px rgba(0,0,0,0.4)' }} />
      <div style={{ position: 'absolute', left: 76, top: 130, width: 18, height: 18, borderRadius: '50%',
        background: `radial-gradient(circle at 40% 35%, #fff, ${C.cyan})`, boxShadow: `0 0 12px ${C.cyan}` }} />
      {/* arms */}
      <div style={{ position: 'absolute', left: 20, top: 112, width: 20, height: 60, borderRadius: 10, background: 'linear-gradient(#9fb0d2,#3b4d70)' }} />
      <div style={{ position: 'absolute', left: 132, top: 112, width: 20, height: 60, borderRadius: 10, background: 'linear-gradient(#9fb0d2,#3b4d70)' }} />
    </div>
  );
}

// ── Detailed shaded race car ────────────────────────────────────────────────
function MiniCar() {
  return (
    <div style={{ position: 'relative', width: 232, height: 124 }}>
      <div style={{ position: 'absolute', left: 20, top: 34, width: 196, height: 74, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(192,132,252,0.3), transparent 70%)', filter: 'blur(20px)' }} />
      {/* cabin */}
      <div style={{ position: 'absolute', left: 64, top: 14, width: 104, height: 46, borderRadius: 8,
        background: 'linear-gradient(160deg,#cfe0ff,#5b7bc0 60%,#2a3f70)', border: '1px solid rgba(255,255,255,0.3)',
        clipPath: 'polygon(18% 0, 82% 0, 100% 100%, 0 100%)' }} />
      <div style={{ position: 'absolute', left: 76, top: 18, width: 38, height: 32,
        background: 'linear-gradient(150deg, rgba(255,255,255,0.7), transparent)',
        clipPath: 'polygon(22% 0,100% 0,78% 100%,0 100%)' }} />
      {/* body */}
      <div style={{ position: 'absolute', left: 6, top: 50, width: 220, height: 46, borderRadius: '26px 28px 16px 16px',
        background: `linear-gradient(160deg,#d9b8ff,${C.purple} 50%,#6d3fb0)`,
        boxShadow: 'inset 0 2px 8px rgba(255,255,255,0.4), 0 10px 24px rgba(0,0,0,0.4)' }} />
      <div style={{ position: 'absolute', left: 14, top: 72, width: 200, height: 3, background: 'rgba(255,255,255,0.5)', borderRadius: 2 }} />
      {/* headlight */}
      <div style={{ position: 'absolute', left: 214, top: 62, width: 14, height: 12, borderRadius: 6,
        background: `radial-gradient(circle, #fff, ${C.warm})`, boxShadow: `0 0 12px ${C.warm}` }} />
      {/* wheels */}
      {[36, 152].map((x, i) => (
        <div key={i} style={{ position: 'absolute', left: x, top: 80, width: 48, height: 48, borderRadius: '50%',
          background: 'radial-gradient(circle at 50% 50%, #c9d4ea 0 24%, #1a2236 26% 60%, #0c1424 62%)',
          border: '2px solid #2a3550', boxShadow: '0 4px 10px rgba(0,0,0,0.5)' }}>
          <div style={{ position: 'absolute', left: '50%', top: '50%', width: 10, height: 10, marginLeft: -5, marginTop: -5,
            borderRadius: '50%', background: '#dbe4f5' }} />
        </div>
      ))}
    </div>
  );
}

// ── Studio UI walkthrough — detailed editor floating in space ───────────────
function StudioUI() {
  const { localTime } = useSprite();
  const time = useTime();
  const settle = Easing.easeOutCubic(clamp(localTime / 0.7, 0, 1));
  const bob = Math.sin(time * 0.7) * 9;
  const cxFn = interpolate([0.8, 1.9, 2.2, 3.6, 4.8, 6.8], [640, 96, 96, 96, 1052, 1052], Easing.easeInOutCubic);
  const cyFn = interpolate([0.8, 1.9, 2.2, 3.6, 4.8, 6.8], [330, 300, 300, 300, 268, 268], Easing.easeInOutCubic);
  const curX = cxFn(localTime), curY = cyFn(localTime);
  const click1 = localTime > 2.1 && localTime < 2.45;
  const click2 = localTime > 4.7 && localTime < 5.05;
  const clicking = click1 || click2;
  const tint = localTime > 4.9 ? 'pink' : 'warm';
  const toolActive = localTime > 2.2;

  const tool = (active, glyph, label, key) => (
    <div key={key} style={{ position: 'relative', width: 54, height: 54, borderRadius: 12,
      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
      background: active ? 'rgba(56,189,248,0.18)' : 'rgba(255,255,255,0.04)',
      border: `1.5px solid ${active ? C.cyan : 'rgba(255,255,255,0.08)'}`,
      boxShadow: active ? `0 0 16px rgba(56,189,248,0.4)` : 'none', color: active ? C.cyan : C.body }}>
      {glyph}
      {active && (
        <div style={{ position: 'absolute', left: 64, top: 16, fontFamily: FM, fontSize: 12, whiteSpace: 'nowrap',
          background: 'rgba(10,22,42,0.95)', color: C.cyan, padding: '4px 9px', borderRadius: 6,
          border: '1px solid rgba(56,189,248,0.3)', letterSpacing: '0.06em' }}>{label}</div>
      )}
    </div>
  );
  const swatch = (col, on) => (
    <div style={{ width: 38, height: 38, borderRadius: 9, background: col,
      border: on ? '3px solid #fff' : '2px solid rgba(255,255,255,0.15)',
      boxShadow: on ? `0 0 16px ${col}` : 'none' }} />
  );
  const propRow = (label, val, col) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 9,
      fontFamily: FM, fontSize: 13 }}>
      <span style={{ color: col, fontWeight: 700, width: 16 }}>{label}</span>
      <span style={{ flex: 1, marginLeft: 8, padding: '4px 8px', borderRadius: 6, color: C.head,
        background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', textAlign: 'right' }}>{val}</span>
    </div>
  );
  const menuItem = (t) => <span style={{ marginRight: 22 }}>{t}</span>;

  return (
    <div style={{ width: 1240, height: 700, borderRadius: 22, overflow: 'hidden',
      transform: `translateY(${(1 - settle) * 40 + bob}px) scale(${0.92 + 0.08 * settle})`, opacity: settle,
      background: 'linear-gradient(180deg, rgba(13,26,46,0.96), rgba(7,16,30,0.97))',
      border: '1px solid rgba(56,189,248,0.22)',
      boxShadow: '0 50px 130px rgba(0,0,0,0.65), 0 0 60px rgba(56,189,248,0.12), inset 0 1px 0 rgba(255,255,255,0.06)',
      position: 'relative' }}>
      {/* title bar */}
      <div style={{ height: 50, display: 'flex', alignItems: 'center', gap: 10, padding: '0 20px',
        borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <span style={{ width: 13, height: 13, borderRadius: '50%', background: '#ff5f57' }} />
        <span style={{ width: 13, height: 13, borderRadius: '50%', background: '#febc2e' }} />
        <span style={{ width: 13, height: 13, borderRadius: '50%', background: '#28c840' }} />
        <span style={{ fontFamily: FM, fontSize: 15, color: C.body, marginLeft: 14, letterSpacing: '0.06em' }}>
          curious-labs · rocket.model3d
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontFamily: FM, fontSize: 13, color: C.cyan }}>● live</span>
          <div style={{ width: 30, height: 30, borderRadius: '50%', background: `linear-gradient(135deg, ${C.cyan}, ${C.purple})` }} />
        </div>
      </div>
      {/* menu bar */}
      <div style={{ height: 38, display: 'flex', alignItems: 'center', padding: '0 22px',
        fontFamily: FB, fontSize: 14, color: C.body, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        {menuItem('File')}{menuItem('Edit')}{menuItem('Object')}{menuItem('Modifier')}{menuItem('Render')}{menuItem('Help')}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, color: C.cyan,
          padding: '4px 12px', borderRadius: 7, border: `1px solid ${C.cyan}`, fontSize: 13, fontFamily: FM }}>
          ▶ Render
        </div>
      </div>
      <div style={{ display: 'flex', height: 552 }}>
        {/* toolbar */}
        <div style={{ width: 88, borderRight: '1px solid rgba(255,255,255,0.07)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, paddingTop: 20 }}>
          {tool(toolActive, '◻', 'Cube', 't1')}
          {tool(false, '●', 'Sphere', 't2')}
          {tool(false, '▲', 'Cone', 't3')}
          {tool(false, '⬢', 'Cylinder', 't4')}
          <div style={{ width: 44, height: 1, background: 'rgba(255,255,255,0.1)', margin: '6px 0' }} />
          {tool(false, '↔', 'Move', 't5')}
          {tool(false, '⟲', 'Rotate', 't6')}
          {tool(false, '⬚', 'Scale', 't7')}
        </div>
        {/* viewport */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden',
          backgroundImage: 'linear-gradient(rgba(56,189,248,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(56,189,248,0.06) 1px, transparent 1px)',
          backgroundSize: '46px 46px' }}>
          <div style={{ position: 'absolute', left: 16, top: 14, fontFamily: FM, fontSize: 13, color: C.body, letterSpacing: '0.08em' }}>
            Perspective · Rocket_01
          </div>
          {/* nav cube */}
          <div style={{ position: 'absolute', right: 18, top: 14, width: 44, height: 44, borderRadius: 8,
            border: `1.5px solid ${C.cyan}66`, background: 'rgba(56,189,248,0.06)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FM, fontSize: 11, color: C.cyan }}>
            3D
          </div>
          {/* rocket */}
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ transform: 'scale(0.62)' }}>
              <Rocket assemble={1} spin={true} tint={tint} float={false} />
            </div>
          </div>
          {/* selection box + corner handles */}
          <div style={{ position: 'absolute', left: '50%', top: '50%', width: 230, height: 390,
            marginLeft: -115, marginTop: -195, border: `1.5px dashed ${C.cyan}`, opacity: 0.6 }}>
            {[['-4px', '-4px'], ['-4px', 'auto', '-4px'], ['auto', '-4px', 'auto', '-4px'], ['auto', 'auto', '-4px', '-4px']].map((p, i) => (
              <div key={i} style={{ position: 'absolute', top: p[0], left: p[1] === 'auto' ? 'auto' : p[1],
                right: i === 1 || i === 3 ? '-4px' : 'auto', bottom: i >= 2 ? '-4px' : 'auto',
                width: 9, height: 9, background: '#fff', border: `1px solid ${C.cyan}` }} />
            ))}
          </div>
          {/* axis gizmo */}
          <div style={{ position: 'absolute', left: 22, bottom: 20, width: 60, height: 60 }}>
            <div style={{ position: 'absolute', left: 4, bottom: 4, width: 40, height: 3, background: '#f87171', transformOrigin: 'left' }} />
            <div style={{ position: 'absolute', left: 4, bottom: 4, width: 3, height: 40, background: '#4ade80' }} />
            <div style={{ position: 'absolute', left: 4, bottom: 4, width: 30, height: 3, background: '#60a5fa', transform: 'rotate(38deg)', transformOrigin: 'left' }} />
            <span style={{ position: 'absolute', left: 46, bottom: 0, fontFamily: FM, fontSize: 11, color: '#f87171' }}>X</span>
            <span style={{ position: 'absolute', left: 0, top: 0, fontFamily: FM, fontSize: 11, color: '#4ade80' }}>Y</span>
          </div>
        </div>
        {/* right panel */}
        <div style={{ width: 256, borderLeft: '1px solid rgba(255,255,255,0.07)', padding: '20px 18px',
          display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontFamily: FM, fontSize: 13, letterSpacing: '0.14em', color: C.head, textTransform: 'uppercase', marginBottom: 6 }}>
            Properties
          </div>
          <div style={{ fontFamily: FB, fontSize: 15, color: C.cyan, marginBottom: 16 }}>◆ Rocket_01</div>
          <div style={{ fontFamily: FM, fontSize: 12, letterSpacing: '0.12em', color: C.body, textTransform: 'uppercase', marginBottom: 10 }}>Transform</div>
          {propRow('X', '0.00 m', '#f87171')}
          {propRow('Y', '1.40 m', '#4ade80')}
          {propRow('Z', '0.00 m', '#60a5fa')}
          <div style={{ fontFamily: FM, fontSize: 12, letterSpacing: '0.12em', color: C.body, textTransform: 'uppercase', margin: '18px 0 12px' }}>Material</div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
            {swatch(C.warm2, tint === 'warm')}
            {swatch(C.pink, tint === 'pink')}
            {swatch(C.cyan, false)}
            {swatch(C.purple, false)}
          </div>
          <div style={{ fontFamily: FM, fontSize: 12, letterSpacing: '0.12em', color: C.body, textTransform: 'uppercase', marginBottom: 10 }}>Roughness</div>
          <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.08)', position: 'relative', marginBottom: 6 }}>
            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '42%', borderRadius: 3,
              background: `linear-gradient(90deg, ${C.cyan}, ${C.purple})` }} />
            <div style={{ position: 'absolute', left: '42%', top: -4, width: 14, height: 14, marginLeft: -7, borderRadius: '50%', background: '#fff' }} />
          </div>
        </div>
      </div>
      {/* status bar */}
      <div style={{ height: 60, display: 'flex', alignItems: 'center', padding: '0 22px',
        borderTop: '1px solid rgba(255,255,255,0.07)', fontFamily: FM, fontSize: 13, color: C.body, letterSpacing: '0.06em' }}>
        Verts 2,480 · Tris 1,204 · Objects 8
        <span style={{ marginLeft: 'auto', color: C.cyan }}>60 FPS · GPU realtime</span>
      </div>
      {/* cursor */}
      <div style={{ position: 'absolute', left: curX, top: curY, transform: `scale(${clicking ? 0.82 : 1})`,
        transition: 'transform 80ms', pointerEvents: 'none', zIndex: 20 }}>
        {clicking && <div style={{ position: 'absolute', left: -16, top: -16, width: 38, height: 38,
          borderRadius: '50%', border: `2px solid ${C.cyan}`, opacity: 0.7 }} />}
        <svg width="26" height="30" viewBox="0 0 26 30" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }}>
          <path d="M3 2 L3 24 L9 18 L13 27 L17 25 L13 16 L21 16 Z" fill="#fff" stroke="#0b1220" strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );
}

// ── Scenes ──────────────────────────────────────────────────────────────────
function S1() {
  const { localTime } = useSprite();
  const show = clamp((localTime - 1.6) / 0.5, 0, 1);
  const out = 1 - clamp((localTime - 3.2) / 0.6, 0, 1);
  const op = show * out;
  const dots = '.'.repeat(1 + Math.floor((localTime * 3) % 4));
  return (
    <Center style={{ flexDirection: 'column' }}>
      <div style={{ fontFamily: FM, fontSize: 22, letterSpacing: '0.34em', color: C.cyan,
        textTransform: 'uppercase', opacity: op, transform: `translateY(${(1 - show) * 12}px)` }}>
        Initializing build studio{dots}
      </div>
      <div style={{ width: 240, height: 3, background: 'rgba(56,189,248,0.18)', marginTop: 22, opacity: op,
        borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${clamp((localTime - 1.6) / 1.6, 0, 1) * 100}%`,
          background: `linear-gradient(90deg, ${C.cyan}, ${C.purple})` }} />
      </div>
    </Center>
  );
}
function S2() {
  const { localTime, duration } = useSprite();
  const f = fio(localTime, duration, 0.6, 0.6);
  const cubeScale = Easing.easeOutBack(clamp(localTime / 0.9, 0, 1));
  return (
    <>
      <Center style={{ transform: 'translateY(40px)' }}>
        <div style={{ transform: `scale(${cubeScale})`, opacity: clamp(localTime / 0.6, 0, 1) }}>
          <WireCube />
        </div>
      </Center>
      <Center style={{ alignItems: 'flex-start', paddingTop: 150 }}>
        <div style={{ textAlign: 'center', opacity: f.opacity, transform: `translateY(${f.ty}px)` }}>
          <HeadLine text="Start with a shape." size={84} grad={`linear-gradient(90deg, ${C.cyan}, ${C.cyan2})`} />
          <div style={{ height: 18 }} />
          <Sub text="Every creation begins with a single primitive." />
        </div>
      </Center>
    </>
  );
}
function S3() {
  const { localTime, duration } = useSprite();
  const f = fio(localTime, duration, 0.6, 0.6);
  const assemble = clamp((localTime - 0.6) / 3.0, 0, 1);
  return (
    <>
      <Center style={{ transform: 'translateY(30px)' }}>
        <div style={{ opacity: clamp(localTime / 0.5, 0, 1) }}>
          <Rocket assemble={assemble} spin={true} float={false} />
        </div>
      </Center>
      <Center style={{ alignItems: 'flex-start', paddingTop: 96, justifyContent: 'flex-start', paddingLeft: 120 }}>
        <div style={{ opacity: f.opacity, transform: `translateY(${f.ty}px)`, maxWidth: 820 }}>
          <HeadLine text={'Snap it together,\nin 3D.'} size={74} grad={`linear-gradient(90deg, ${C.warm}, ${C.warm2})`} />
          <div style={{ height: 16 }} />
          <Sub text="Drag primitives into place and watch your idea take form." />
        </div>
      </Center>
    </>
  );
}
function S4() {
  const { localTime, duration } = useSprite();
  const f = fio(localTime, duration, 0.5, 0.6);
  return (
    <>
      <Center style={{ transform: 'translateY(40px) scale(0.86)' }}>
        <StudioUI />
      </Center>
      <Center style={{ alignItems: 'flex-start', paddingTop: 30 }}>
        <div style={{ textAlign: 'center', opacity: f.opacity, transform: `translateY(${f.ty}px)` }}>
          <HeadLine text="Inside the Studio." size={62} grad={`linear-gradient(90deg, ${C.cyan}, ${C.purple})`} />
        </div>
      </Center>
    </>
  );
}
function S5() {
  const { localTime, duration } = useSprite();
  const f = fio(localTime, duration, 0.5, 0.7);
  const t = useTime();
  const e = (s) => Easing.easeOutBack(clamp((localTime - s) / 0.6, 0, 1));
  return (
    <>
      <Center style={{ gap: 110, transform: 'translateY(30px)' }}>
        <div style={{ transform: `translateY(${Math.sin(t * 1.3) * 18}px) scale(${e(0.3)})`, opacity: clamp((localTime - 0.3) / 0.4, 0, 1) }}>
          <MiniBot />
        </div>
        <div style={{ transform: `translateY(${Math.sin(t * 1.0 + 1) * 14}px) scale(${0.62 * e(0.0)})`, opacity: clamp(localTime / 0.4, 0, 1) }}>
          <Rocket assemble={1} spin={true} float={false} />
        </div>
        <div style={{ transform: `translateY(${Math.sin(t * 1.3 + 2) * 18}px) scale(${e(0.6)})`, opacity: clamp((localTime - 0.6) / 0.4, 0, 1) }}>
          <MiniCar />
        </div>
      </Center>
      <Center style={{ alignItems: 'flex-start', paddingTop: 120 }}>
        <div style={{ textAlign: 'center', opacity: f.opacity, transform: `translateY(${f.ty}px)` }}>
          <HeadLine text="Imagine anything." size={88} grad={`linear-gradient(90deg, ${C.cyan}, ${C.pink})`} />
          <div style={{ height: 16 }} />
          <Sub text="Rockets, robots, race cars — if they can dream it, they can build it." />
        </div>
      </Center>
    </>
  );
}

function Scenes() {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', fontFamily: FB }}>
      <Cosmos />
      <Sprite start={0} end={4.0}><S1 /></Sprite>
      <Sprite start={3.4} end={9.2}><S2 /></Sprite>
      <Sprite start={8.6} end={16.4}><S3 /></Sprite>
      <Sprite start={15.8} end={23.6}><S4 /></Sprite>
      <Sprite start={23.0} end={30}><S5 /></Sprite>
      <HUD />
    </div>
  );
}

// ── Full-bleed stage (replaces the prototype Stage; no controls/letterbox) ───
const DESIGN_W = 1920, DESIGN_H = 1080, DURATION = 30, STATIC_T = 27;

function HeroStage({ children }) {
  const hostRef = React.useRef(null);
  const [scale, setScale] = React.useState(1);
  const [time, setTime] = React.useState(0);
  const [inView, setInView] = React.useState(true);
  const [reduced, setReduced] = React.useState(false);

  // honour reduced-motion: freeze on a representative frame
  React.useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener && mq.addEventListener('change', apply);
    return () => { mq.removeEventListener && mq.removeEventListener('change', apply); };
  }, []);

  // cover-fit the 1920×1080 canvas to the container (crop, never letterbox)
  React.useEffect(() => {
    const el = hostRef.current; if (!el) return;
    const measure = () => {
      const w = el.clientWidth, h = el.clientHeight;
      if (!w || !h) return;
      setScale(Math.max(w / DESIGN_W, h / DESIGN_H));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener('resize', measure);
    return () => { ro.disconnect(); window.removeEventListener('resize', measure); };
  }, []);

  // pause the timeline when the slide is scrolled off-screen
  React.useEffect(() => {
    const el = hostRef.current; if (!el) return;
    const io = new IntersectionObserver((ents) => setInView(ents[0].isIntersecting), { threshold: 0.05 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // timeline loop
  React.useEffect(() => {
    if (reduced) { setTime(STATIC_T); return; }
    if (!inView) return; // freeze while off-screen
    let raf = 0, last = null;
    const step = (ts) => {
      if (last == null) last = ts;
      const dt = (ts - last) / 1000; last = ts;
      setTime((t) => { let n = t + dt; if (n >= DURATION) n %= DURATION; return n; });
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [inView, reduced]);

  const ctx = React.useMemo(
    () => ({ time, duration: DURATION, playing: !reduced && inView }),
    [time, reduced, inView],
  );

  return (
    <div ref={hostRef} style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: C.base }}>
      <div style={{ position: 'absolute', left: '50%', top: '50%', width: DESIGN_W, height: DESIGN_H,
        transform: `translate(-50%, -50%) scale(${scale})`, transformOrigin: 'center', willChange: 'transform' }}>
        <TimelineContext.Provider value={ctx}>{children}</TimelineContext.Provider>
      </div>
    </div>
  );
}

export function HeroVideo() {
  return (
    <div className="hero-video" style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: C.base }}>
      <HeroStage>
        <Scenes />
      </HeroStage>
    </div>
  );
}
