"use client";
/* eslint-disable */
// Curious Labs studio intro split into per-section carousel slides.
// Ported from Claude Design handoff "Curious Labs Intro" (video-intro.jsx).
// Each 15s section is its own looping slide; rendered transparent so the
// homepage cosmos (CosmosFX) shows through. .jsx so the untyped port skips tsc.
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
    const warpE = 0;
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
  const appear = Easing.easeOutCubic(clamp((time - 0.3) / 0.6, 0, 1));
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

// ── Shared platform nav rail (makes every studio feel like one product) ─────
function NavRail({ active = 0, accent = ['#38BDF8', '#22D3EE'] }) {
  const items = ['◆', '⚙', '✦', '</>'];
  return (
    <div style={{ width: 62, background: 'rgba(6,14,26,0.6)', borderRight: '1px solid rgba(255,255,255,0.07)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 14, paddingBottom: 14, gap: 12, flexShrink: 0 }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #38BDF8, #C084FC)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#06121f', fontFamily: "'Orbitron', sans-serif",
        fontWeight: 900, fontSize: 18, marginBottom: 8, boxShadow: '0 4px 12px rgba(56,189,248,0.4)' }}>C</div>
      {items.map((g, i) => (
        <div key={i} style={{ width: 40, height: 40, borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: "'JetBrains Mono', monospace", fontSize: 16,
          color: i === active ? '#08121f' : 'rgba(143,163,191,0.7)',
          background: i === active ? `linear-gradient(180deg, ${accent[0]}, ${accent[1]})` : 'rgba(255,255,255,0.04)',
          border: i === active ? 'none' : '1px solid rgba(255,255,255,0.07)',
          boxShadow: i === active ? `0 0 16px ${accent[0]}88` : 'none' }}>{g}</div>
      ))}
      <div style={{ marginTop: 'auto', width: 36, height: 36, borderRadius: '50%',
        background: 'linear-gradient(135deg, #2a3550, #46587c)', border: '1px solid rgba(255,255,255,0.12)' }} />
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
  const settle = Easing.easeOutCubic(clamp(localTime / 0.4, 0, 1));
  const bob = Math.sin(time * 0.7) * 9;
  const cxFn = interpolate([0.3, 0.9, 1.1, 1.7, 2.4, 3.4], [640, 96, 96, 96, 1052, 1052], Easing.easeInOutCubic);
  const cyFn = interpolate([0.3, 0.9, 1.1, 1.7, 2.4, 3.4], [330, 300, 300, 300, 268, 268], Easing.easeInOutCubic);
  const curX = cxFn(localTime), curY = cyFn(localTime);
  const click1 = localTime > 1.0 && localTime < 1.25;
  const click2 = localTime > 2.4 && localTime < 2.65;
  const clicking = click1 || click2;
  const tint = localTime > 2.5 ? 'pink' : 'warm';
  const toolActive = localTime > 1.1;

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
        <NavRail active={0} accent={['#FBBF24', '#FB7185']} />
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



// ── ROBOTICS scenes — appended after the shared cosmos engine ───────────────
// Reuses in-scope: C, FH, FB, FM, React, Stage, Sprite, useTime, useSprite,
//   Easing, interpolate, clamp, Center, Cosmos, HeadLine, Sub, fio.

function accentOf(tint) {
  return tint === 'warm' ? ['#ffe0a3', '#fb923c', '#c2531f']
    : tint === 'purple' ? ['#e6d2ff', '#c084fc', '#6d3fb0']
    : tint === 'pink' ? ['#ffd6ec', '#f472b6', '#b03a76']
    : ['#cdeffd', '#38bdf8', '#1f6fa8'];
}
const METAL = 'linear-gradient(150deg,#f1f5fb,#aab9d4 50%,#46587c)';

// ── Robotics HUD chrome ─────────────────────────────────────────────────────
function HUDRobotics() {
  const time = useTime();
  const op = Easing.easeOutCubic(clamp((time - 0.3) / 0.6, 0, 1)) * 0.9;
  const corner = { position: 'absolute', fontFamily: FM, fontSize: 15, letterSpacing: '0.16em',
    color: 'rgba(143,163,191,0.85)', textTransform: 'uppercase', opacity: op };
  const tick = String(Math.floor((time * 12) % 1000)).padStart(3, '0');
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <div style={{ ...corner, left: 54, top: 46, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: C.cyan, boxShadow: `0 0 10px ${C.cyan}` }} />
        Curious Labs · Robotics Lab
      </div>
      <div style={{ ...corner, right: 54, top: 46 }}>BOT OS v3.0 · {tick}</div>
      <div style={{ ...corner, left: 54, bottom: 46, fontSize: 13 }}>STEM · AGES 8–16</div>
      <div style={{ ...corner, right: 54, bottom: 46, fontSize: 13 }}>BUILD · CODE · RUN</div>
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

// ── CoreModule — the kids' robotics "brain" board (micro:bit-style) ─────────
function CoreModule({ float = true }) {
  const time = useTime();
  const bob = float ? Math.sin(time * 0.8) * 10 : 0;
  const tilt = Math.sin(time * 0.5) * 8;
  // 5x5 smiley pattern
  const smile = [
    [0, 1, 0, 1, 0],
    [0, 1, 0, 1, 0],
    [0, 0, 0, 0, 0],
    [1, 0, 0, 0, 1],
    [0, 1, 1, 1, 0],
  ];
  return (
    <div style={{ position: 'relative', width: 300, height: 230, perspective: 1100, transform: `translateY(${bob}px)` }}>
      <div style={{ position: 'absolute', left: 30, top: 18, width: 240, height: 200, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(56,189,248,0.3), transparent 70%)', filter: 'blur(28px)' }} />
      <div style={{ position: 'absolute', inset: 0, transformStyle: 'preserve-3d', transform: `rotateY(${tilt}deg) rotateX(6deg)` }}>
        {/* board */}
        <div style={{ position: 'absolute', left: 26, top: 24, width: 248, height: 168, borderRadius: 22,
          background: 'linear-gradient(160deg,#13314e,#0c2138 60%,#081626)',
          border: `1.5px solid ${C.cyan}66`, boxShadow: `0 18px 40px rgba(0,0,0,0.55), 0 0 40px rgba(56,189,248,0.25), inset 0 1px 0 rgba(255,255,255,0.08)` }}>
          {/* LED matrix */}
          <div style={{ position: 'absolute', left: 64, top: 30, display: 'grid', gridTemplateColumns: 'repeat(5, 16px)', gap: 9 }}>
            {smile.flatMap((row, r) => row.map((on, c2) => (
              <div key={r + '-' + c2} style={{ width: 16, height: 16, borderRadius: 4,
                background: on ? C.cyan : 'rgba(56,189,248,0.12)',
                boxShadow: on ? `0 0 10px ${C.cyan}, 0 0 4px ${C.cyan2}` : 'none' }} />
            )))}
          </div>
          {/* buttons */}
          <div style={{ position: 'absolute', left: 14, top: 64, width: 30, height: 30, borderRadius: '50%',
            background: 'radial-gradient(circle at 38% 35%, #e9eef7, #7d8aa4)', border: '2px solid #2a3550' }} />
          <div style={{ position: 'absolute', right: 14, top: 64, width: 30, height: 30, borderRadius: '50%',
            background: 'radial-gradient(circle at 38% 35%, #e9eef7, #7d8aa4)', border: '2px solid #2a3550' }} />
          {/* power LED */}
          <div style={{ position: 'absolute', right: 16, top: 14, width: 9, height: 9, borderRadius: '50%',
            background: C.pink, boxShadow: `0 0 10px ${C.pink}` }} />
        </div>
        {/* gold edge connector */}
        <div style={{ position: 'absolute', left: 40, top: 188, width: 220, height: 30, borderRadius: '0 0 12px 12px',
          background: 'linear-gradient(180deg,#caa44e,#9c7c30)' }}>
          {[0, 1, 2, 3, 4].map(i => (
            <div key={i} style={{ position: 'absolute', top: 0, left: 24 + i * 44, width: 22, height: 30,
              background: 'linear-gradient(180deg,#f2d98a,#b9912f)', borderRadius: '0 0 4px 4px' }} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── The robot — a rover-bot assembled from parts ────────────────────────────
function Robot({ assemble = 1, spin = true, tint = 'cyan', float = true }) {
  const time = useTime();
  const EC = Easing.easeOutCubic;
  const part = (s, d) => EC(clamp((assemble - s) / d, 0, 1));
  const pBase = part(0.0, 0.4), pWL = part(0.1, 0.4), pWR = part(0.16, 0.4);
  const pBody = part(0.26, 0.42), pAL = part(0.42, 0.4), pAR = part(0.48, 0.4);
  const pHead = part(0.56, 0.42), pAnt = part(0.72, 0.4), pFace = part(0.8, 0.4);
  const wobble = spin ? Math.sin(time * 0.9) * 9 : 0;
  const bob = float ? Math.sin(time * 0.9) * 12 : 0;
  const acc = accentOf(tint);
  const blink = Math.sin(time * 1.4 + 0.5) > 0.93 ? 0.12 : 1;
  const wheel = (x, p, dir) => (
    <div style={{ position: 'absolute', left: x, top: 332, width: 108, height: 108, borderRadius: '50%',
      opacity: p, transform: `translateX(${(1 - p) * dir * 90}px)`,
      background: 'radial-gradient(circle at 50% 50%, #c9d4ea 0 20%, #243150 22% 58%, #0c1424 60%)',
      border: '3px solid #2a3550', boxShadow: '0 6px 14px rgba(0,0,0,0.5)' }}>
      <div style={{ position: 'absolute', left: '50%', top: '50%', width: 30, height: 30, marginLeft: -15, marginTop: -15,
        borderRadius: '50%', background: `radial-gradient(circle at 40% 35%, #fff, ${acc[1]})`, boxShadow: `0 0 10px ${acc[1]}` }} />
    </div>
  );
  const arm = (x, p, dir) => (
    <div style={{ position: 'absolute', left: x, top: 212, width: 30, height: 118, opacity: p,
      transform: `translateX(${(1 - p) * dir * 90}px)` }}>
      <div style={{ width: 30, height: 92, borderRadius: 14, background: 'linear-gradient(90deg,#3b4d70,#aebdd6 45%,#6e80a4)' }} />
      <div style={{ position: 'absolute', left: 2, top: 88, width: 26, height: 26, borderRadius: 7,
        background: `linear-gradient(150deg, ${acc[0]}, ${acc[2]})`, boxShadow: `0 0 10px ${acc[1]}66` }} />
    </div>
  );
  return (
    <div style={{ position: 'relative', width: 380, height: 560, perspective: 1500, transform: `translateY(${bob}px)` }}>
      <div style={{ position: 'absolute', inset: 0, transformStyle: 'preserve-3d', transform: `rotateY(${wobble}deg)` }}>
        <div style={{ position: 'absolute', left: 70, top: 120, width: 240, height: 320, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(56,189,248,0.22), transparent 70%)', filter: 'blur(34px)', opacity: pBody }} />
        {/* base plate */}
        <div style={{ position: 'absolute', left: 96, top: 350, width: 188, height: 46, borderRadius: 16, opacity: pBase,
          transform: `translateY(${(1 - pBase) * 80}px)`,
          background: 'linear-gradient(180deg,#5b6f96,#2a3550)', boxShadow: '0 8px 18px rgba(0,0,0,0.5)' }} />
        {wheel(40, pWL, -1)}
        {wheel(232, pWR, 1)}
        {arm(40, pAL, -1)}
        {arm(310, pAR, 1)}
        {/* body */}
        <div style={{ position: 'absolute', left: 84, top: 188, width: 212, height: 172, borderRadius: 30, opacity: pBody,
          transform: `translateY(${(1 - pBody) * -60}px)`, overflow: 'hidden', background: METAL,
          boxShadow: 'inset 0 2px 8px rgba(255,255,255,0.5), 0 12px 28px rgba(0,0,0,0.45)', border: '1px solid rgba(207,232,255,0.4)' }}>
          <div style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: 24,
            background: `linear-gradient(90deg, ${acc[2]}, ${acc[1]}, ${acc[2]})`, opacity: 0.9 }} />
          {/* chest ring */}
          <div style={{ position: 'absolute', left: 78, top: 60, width: 56, height: 56, borderRadius: '50%',
            border: `5px solid ${acc[1]}`, boxShadow: `0 0 16px ${acc[1]}, inset 0 0 12px ${acc[1]}88`,
            background: 'radial-gradient(circle, rgba(56,189,248,0.25), transparent 70%)' }} />
          {/* buttons */}
          {[70, 100, 130].map((x, i) => (
            <div key={i} style={{ position: 'absolute', left: x, top: 132, width: 14, height: 14, borderRadius: '50%',
              background: i === 0 ? acc[1] : 'rgba(255,255,255,0.5)', boxShadow: i === 0 ? `0 0 8px ${acc[1]}` : 'none' }} />
          ))}
        </div>
        {/* neck */}
        <div style={{ position: 'absolute', left: 168, top: 176, width: 44, height: 18, background: '#5b6f96', opacity: pHead }} />
        {/* head */}
        <div style={{ position: 'absolute', left: 110, top: 64, width: 160, height: 116, borderRadius: 28, opacity: pHead,
          transform: `translateY(${(1 - pHead) * -120}px)`, background: METAL,
          boxShadow: 'inset 0 2px 8px rgba(255,255,255,0.6), 0 8px 20px rgba(0,0,0,0.4)' }}>
          {/* visor */}
          <div style={{ position: 'absolute', left: 16, top: 26, width: 128, height: 66, borderRadius: 18,
            background: 'linear-gradient(160deg,#0b1830,#13294b)', border: '2px solid #5b6f96', boxShadow: 'inset 0 0 16px rgba(0,0,0,0.6)' }} />
          {/* eyes */}
          <div style={{ position: 'absolute', left: 42, top: 44, width: 30, height: 30, borderRadius: '50%', opacity: pFace,
            transform: `scaleY(${blink})`, background: `radial-gradient(circle at 40% 35%, #d6f7ff, ${C.cyan2} 60%, #0a4f6c)`, boxShadow: `0 0 14px ${C.cyan}` }} />
          <div style={{ position: 'absolute', left: 88, top: 44, width: 30, height: 30, borderRadius: '50%', opacity: pFace,
            transform: `scaleY(${blink})`, background: `radial-gradient(circle at 40% 35%, #d6f7ff, ${C.cyan2} 60%, #0a4f6c)`, boxShadow: `0 0 14px ${C.cyan}` }} />
          {/* ears */}
          <div style={{ position: 'absolute', left: -10, top: 40, width: 14, height: 28, borderRadius: 6, background: '#3b4d70' }} />
          <div style={{ position: 'absolute', right: -10, top: 40, width: 14, height: 28, borderRadius: 6, background: '#3b4d70' }} />
        </div>
        {/* antenna */}
        <div style={{ position: 'absolute', left: 186, top: 28, width: 6, height: 44, background: 'linear-gradient(#9fb0d2,#3b4d70)', opacity: pAnt,
          transform: `translateY(${(1 - pAnt) * -40}px)` }} />
        <div style={{ position: 'absolute', left: 176, top: 10, width: 26, height: 26, borderRadius: '50%', opacity: pAnt,
          transform: `translateY(${(1 - pAnt) * -40}px) scale(${0.4 + 0.6 * pAnt})`,
          background: `radial-gradient(circle at 35% 35%, #fff, ${C.pink})`, boxShadow: `0 0 16px ${C.pink}` }} />
      </div>
    </div>
  );
}

// ── Mini robotic arm ────────────────────────────────────────────────────────
function MiniArm() {
  const time = useTime();
  const sw = Math.sin(time * 1.1) * 8;
  const acc = accentOf('purple');
  return (
    <div style={{ position: 'relative', width: 180, height: 220 }}>
      <div style={{ position: 'absolute', left: 30, top: 60, width: 120, height: 150, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(192,132,252,0.26), transparent 70%)', filter: 'blur(20px)' }} />
      {/* base */}
      <div style={{ position: 'absolute', left: 44, top: 184, width: 92, height: 30, borderRadius: 8,
        background: 'linear-gradient(180deg,#8a9cc0,#3b4d70)', clipPath: 'polygon(10% 0,90% 0,100% 100%,0 100%)' }} />
      <div style={{ position: 'absolute', left: 70, top: 150, width: 40, height: 44, background: METAL, borderRadius: 8 }} />
      {/* shoulder + arm1 */}
      <div style={{ position: 'absolute', left: 78, top: 150, transformOrigin: 'center', transform: `rotate(${sw}deg)` }}>
        <div style={{ position: 'absolute', left: -7, top: -10, width: 24, height: 24, borderRadius: '50%',
          background: `radial-gradient(circle at 38% 35%, ${acc[0]}, ${acc[2]})`, boxShadow: `0 0 10px ${acc[1]}` }} />
        <div style={{ position: 'absolute', left: -4, top: -86, width: 18, height: 86, borderRadius: 8, background: 'linear-gradient(90deg,#3b4d70,#aebdd6 50%,#6e80a4)' }} />
        {/* elbow + arm2 */}
        <div style={{ position: 'absolute', left: -22, top: -96, transformOrigin: 'right bottom', transform: `rotate(${-30 + sw}deg)` }}>
          <div style={{ position: 'absolute', right: -2, bottom: -2, width: 20, height: 20, borderRadius: '50%',
            background: `radial-gradient(circle at 38% 35%, ${acc[0]}, ${acc[2]})`, boxShadow: `0 0 10px ${acc[1]}` }} />
          <div style={{ position: 'absolute', right: 0, bottom: 8, width: 70, height: 16, borderRadius: 8, background: 'linear-gradient(0deg,#3b4d70,#aebdd6 50%,#6e80a4)' }} />
          {/* gripper */}
          <div style={{ position: 'absolute', left: -16, bottom: 4, width: 10, height: 24, borderRadius: 4, background: acc[1], transform: 'rotate(-18deg)' }} />
          <div style={{ position: 'absolute', left: -16, bottom: 4, width: 10, height: 24, borderRadius: 4, background: acc[1], transform: 'rotate(18deg)' }} />
        </div>
      </div>
    </div>
  );
}

// ── Mini drone (quadcopter) ─────────────────────────────────────────────────
function MiniDrone() {
  const time = useTime();
  const hov = Math.sin(time * 1.6) * 6;
  const rot = time * 900;
  const acc = accentOf('cyan');
  const rotor = (x, y) => (
    <div style={{ position: 'absolute', left: x, top: y, width: 74, height: 74, borderRadius: '50%',
      border: `2px solid ${C.cyan}66`, background: 'radial-gradient(circle, rgba(56,189,248,0.12), transparent 72%)' }}>
      <div style={{ position: 'absolute', left: '50%', top: '50%', width: 64, height: 5, marginLeft: -32, marginTop: -2.5,
        borderRadius: 3, background: 'rgba(200,225,255,0.6)', transform: `rotate(${rot}deg)`, filter: 'blur(1px)' }} />
      <div style={{ position: 'absolute', left: '50%', top: '50%', width: 64, height: 5, marginLeft: -32, marginTop: -2.5,
        borderRadius: 3, background: 'rgba(200,225,255,0.6)', transform: `rotate(${rot + 90}deg)`, filter: 'blur(1px)' }} />
    </div>
  );
  return (
    <div style={{ position: 'relative', width: 250, height: 150, transform: `translateY(${hov}px)` }}>
      <div style={{ position: 'absolute', left: 40, top: 30, width: 170, height: 90, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(56,189,248,0.24), transparent 70%)', filter: 'blur(18px)' }} />
      {/* arms */}
      <div style={{ position: 'absolute', left: 60, top: 64, width: 130, height: 10, marginTop: -5, borderRadius: 6, background: '#3b4d70', transform: 'rotate(28deg)' }} />
      <div style={{ position: 'absolute', left: 60, top: 64, width: 130, height: 10, marginTop: -5, borderRadius: 6, background: '#3b4d70', transform: 'rotate(-28deg)' }} />
      {rotor(8, 6)}{rotor(168, 6)}{rotor(8, 72)}{rotor(168, 72)}
      {/* body */}
      <div style={{ position: 'absolute', left: 86, top: 44, width: 78, height: 50, borderRadius: 18, background: METAL,
        boxShadow: 'inset 0 2px 6px rgba(255,255,255,0.5), 0 8px 18px rgba(0,0,0,0.45)' }}>
        <div style={{ position: 'absolute', left: '50%', top: 28, width: 22, height: 22, marginLeft: -11, borderRadius: '50%',
          background: `radial-gradient(circle at 38% 32%, #d6f7ff, ${C.cyan2} 58%, #0a4f6c)`, boxShadow: `0 0 12px ${C.cyan}` }} />
        <div style={{ position: 'absolute', left: 10, top: 8, width: 8, height: 8, borderRadius: '50%', background: acc[1], boxShadow: `0 0 8px ${acc[1]}` }} />
      </div>
    </div>
  );
}

// ── Block-coding studio ─────────────────────────────────────────────────────
function CodeStudio() {
  const { localTime } = useSprite();
  const time = useTime();
  const settle = Easing.easeOutCubic(clamp(localTime / 0.4, 0, 1));
  const bob = Math.sin(time * 0.7) * 9;
  const cxFn = interpolate([0.3, 1.3, 1.6, 2.2, 3.4], [110, 360, 360, 1090, 1090], Easing.easeInOutCubic);
  const cyFn = interpolate([0.3, 1.3, 1.6, 2.2, 3.4], [220, 300, 300, 150, 150], Easing.easeInOutCubic);
  const curX = cxFn(localTime), curY = cyFn(localTime);
  const dropping = localTime > 1.25 && localTime < 1.55;
  const running = localTime > 2.5;
  const clickRun = localTime > 2.2 && localTime < 2.5;
  const clicking = dropping || clickRun;
  const turnOp = clamp((localTime - 1.45) / 0.3, 0, 1);
  const ghostOn = localTime > 0.3 && localTime < 1.45;
  // exec highlight index
  const execIdx = running ? Math.floor((localTime - 2.5) / 0.32) % 7 : -1;

  const paletteBlk = (bg, dark, label) => (
    <div style={{ width: 132, height: 26, borderRadius: 7, marginBottom: 6, display: 'flex', alignItems: 'center',
      padding: '0 10px', fontFamily: FB, fontWeight: 600, fontSize: 12, color: '#08121f',
      background: `linear-gradient(180deg, ${bg}, ${dark})`, boxShadow: '0 2px 0 rgba(0,0,0,0.25)' }}>{label}</div>
  );
  const cat = (col, label) => (
    <div style={{ fontFamily: FM, fontSize: 10.5, letterSpacing: '0.12em', color: col, textTransform: 'uppercase',
      margin: '0 0 7px', display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: col }} />{label}
    </div>
  );
  const pill = (t) => <span style={{ background: '#fff', borderRadius: 12, padding: '2px 9px', fontSize: 13, color: '#08121f', boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.18)' }}>{t}</span>;
  const drop = (t) => <span style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 7, padding: '2px 9px', fontSize: 13, color: '#fff', display: 'inline-flex', gap: 5, alignItems: 'center' }}>{t} ▾</span>;
  const hexb = (t) => <span style={{ background: '#2fb6c6', color: '#06121f', fontWeight: 700, padding: '4px 14px', fontSize: 13, clipPath: 'polygon(9% 0,91% 0,100% 50%,91% 100%,9% 100%,0 50%)' }}>{t}</span>;
  const cmd = (bg, dark, content, o = {}) => (
    <div style={{ position: 'relative', width: o.w || 220, marginBottom: o.mb == null ? 7 : o.mb, marginLeft: o.indent || 0,
      opacity: o.op == null ? 1 : o.op, transform: `translateY(${o.ty || 0}px)` }}>
      <div style={{ position: 'absolute', top: -5, left: 16, width: 20, height: 6, borderRadius: '0 0 5px 5px', background: bg }} />
      <div style={{ minHeight: 38, borderRadius: 9, display: 'flex', alignItems: 'center', gap: 8, padding: '6px 13px',
        fontFamily: FB, fontWeight: 600, fontSize: 14.5, color: '#08121f', background: `linear-gradient(180deg,${bg},${dark})`,
        boxShadow: `0 2px 0 rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.45)${o.glow ? `, 0 0 0 3px #ffffffaa, 0 0 18px ${bg}` : ''}`,
        border: '1px solid rgba(0,0,0,0.16)' }}>{content}</div>
    </div>
  );
  const cwrap = (bg, dark, header, children, o = {}) => (
    <div style={{ position: 'relative', marginBottom: o.mb == null ? 7 : o.mb, marginLeft: o.indent || 0, opacity: o.op == null ? 1 : o.op }}>
      {cmd(bg, dark, header, { w: o.w || 234, mb: 0, glow: o.glow })}
      <div style={{ display: 'flex' }}>
        <div style={{ width: 13, background: `linear-gradient(90deg,${dark},${bg})` }} />
        <div style={{ paddingTop: 7, paddingLeft: 8 }}>{children}</div>
      </div>
      <div style={{ width: o.w || 234, height: 13, borderRadius: '0 0 9px 9px', background: `linear-gradient(180deg,${bg},${dark})`, boxShadow: '0 2px 0 rgba(0,0,0,0.28)' }} />
    </div>
  );

  // robot preview drive
  const drive = running ? localTime - 2.5 : 0;
  const driveX = running ? Math.sin(drive * 1.5) * 26 : 0;
  const groundShift = running ? -((time * 70) % 44) : 0;

  return (
    <div style={{ width: 1260, height: 706, borderRadius: 22, overflow: 'hidden',
      transform: `translateY(${(1 - settle) * 40 + bob}px) scale(${0.92 + 0.08 * settle})`, opacity: settle,
      background: 'linear-gradient(180deg, rgba(13,26,46,0.96), rgba(7,16,30,0.97))',
      border: '1px solid rgba(56,189,248,0.22)',
      boxShadow: '0 50px 130px rgba(0,0,0,0.65), 0 0 60px rgba(56,189,248,0.12), inset 0 1px 0 rgba(255,255,255,0.06)',
      position: 'relative' }}>
      {/* title bar */}
      <div style={{ height: 50, display: 'flex', alignItems: 'center', gap: 10, padding: '0 20px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <span style={{ width: 13, height: 13, borderRadius: '50%', background: '#ff5f57' }} />
        <span style={{ width: 13, height: 13, borderRadius: '50%', background: '#febc2e' }} />
        <span style={{ width: 13, height: 13, borderRadius: '50%', background: '#28c840' }} />
        <span style={{ fontFamily: FM, fontSize: 15, color: C.body, marginLeft: 14, letterSpacing: '0.06em' }}>curious-labs · rover.blocks</span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontFamily: FM, fontSize: 13, color: C.cyan }}>● connected</span>
          <div style={{ width: 30, height: 30, borderRadius: '50%', background: `linear-gradient(135deg, ${C.cyan}, ${C.purple})` }} />
        </div>
      </div>
      {/* menu bar */}
      <div style={{ height: 38, display: 'flex', alignItems: 'center', padding: '0 22px', fontFamily: FB, fontSize: 14, color: C.body, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <span style={{ marginRight: 22 }}>Blocks</span><span style={{ marginRight: 22 }}>Simulate</span><span style={{ marginRight: 22 }}>Share</span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, color: '#08121f', fontWeight: 700,
          padding: '5px 16px', borderRadius: 9, fontSize: 14, fontFamily: FB,
          background: clickRun ? 'linear-gradient(180deg,#86efac,#22c55e)' : 'linear-gradient(180deg,#4ade80,#22a350)',
          boxShadow: running ? '0 0 18px rgba(74,222,128,0.6)' : 'none' }}>▶ Run</div>
      </div>
      <div style={{ display: 'flex', height: 558 }}>
        <NavRail active={1} accent={['#22D3EE', '#38BDF8']} />
        {/* palette */}
        <div style={{ width: 178, borderRight: '1px solid rgba(255,255,255,0.07)', padding: '16px 16px', overflow: 'hidden' }}>
          {cat('#38BDF8', 'Motion')}
          {paletteBlk('#38BDF8', '#1f78ad', 'Drive forward')}
          {paletteBlk('#38BDF8', '#1f78ad', 'Turn right')}
          {paletteBlk('#38BDF8', '#1f78ad', 'Stop')}
          {cat('#C084FC', 'Looks')}
          {paletteBlk('#C084FC', '#8a4fd0', 'Light up')}
          {paletteBlk('#C084FC', '#8a4fd0', 'Show face')}
          {cat('#FBBF24', 'Control')}
          {paletteBlk('#FBBF24', '#c98a12', 'Repeat')}
          {paletteBlk('#FBBF24', '#c98a12', 'Forever')}
          {paletteBlk('#FBBF24', '#c98a12', 'If / else')}
          {cat('#2fb6c6', 'Sensing')}
          {paletteBlk('#2fb6c6', '#1c7e8a', 'If sees')}
          {paletteBlk('#2fb6c6', '#1c7e8a', 'Distance')}
          {cat('#F472B6', 'Sound')}
          {paletteBlk('#F472B6', '#c14d8b', 'Beep')}
          {cat('#ff8a3d', 'Variables')}
          {paletteBlk('#ff8a3d', '#d35e16', 'speed')}
        </div>
        {/* canvas */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden',
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.07) 1.5px, transparent 1.5px)', backgroundSize: '26px 26px' }}>
          <div style={{ position: 'absolute', left: 56, top: 28 }}>
            {cmd('#e9a23b', '#c97f1a', <span>When <span style={{ fontSize: 16 }}>⚑</span> clicked</span>, { w: 208, glow: execIdx === 0 })}
            {cmd('#ff8a3d', '#d35e16', <span>set {drop('speed')} to {pill('5')}</span>, { w: 228, glow: execIdx === 1 })}
            {cwrap('#FBBF24', '#c98a12', <span>forever</span>, (
              <>
                {cwrap('#f4a82a', '#c2780f', <span>if {hexb('sees object?')} then</span>, (
                  <>
                    {cmd('#38BDF8', '#1f78ad', <span>turn right {pill('90')} °</span>, { w: 196, op: turnOp, ty: (1 - turnOp) * -12, glow: execIdx === 3 })}
                    <div style={{ marginLeft: -8, marginBottom: 7, width: 110, height: 30, display: 'flex', alignItems: 'center', padding: '0 13px',
                      color: '#08121f', fontFamily: FB, fontWeight: 600, fontSize: 14.5,
                      background: 'linear-gradient(180deg,#f4a82a,#c2780f)', borderRadius: '0 9px 9px 0' }}>else</div>
                    {cmd('#38BDF8', '#1f78ad', <span>drive forward {pill('speed')}</span>, { w: 212, glow: execIdx === 4 })}
                  </>
                ), { w: 254, glow: execIdx === 2 })}
                {cmd('#C084FC', '#8a4fd0', <span>light up {drop('green')}</span>, { w: 196, glow: execIdx === 5 })}
              </>
            ), { w: 274, glow: execIdx === 6 })}
          </div>
        </div>
        {/* preview */}
        <div style={{ width: 300, borderLeft: '1px solid rgba(255,255,255,0.07)', padding: '18px 18px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontFamily: FM, fontSize: 12, letterSpacing: '0.12em', color: C.head, textTransform: 'uppercase', marginBottom: 12 }}>Live Preview</div>
          <div style={{ flex: 1, borderRadius: 14, position: 'relative', overflow: 'hidden',
            background: 'linear-gradient(180deg,#0a1830,#06101f)', border: '1px solid rgba(56,189,248,0.18)' }}>
            {/* floor */}
            <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 90,
              backgroundImage: 'linear-gradient(90deg, rgba(56,189,248,0.18) 1px, transparent 1px)',
              backgroundSize: '44px 44px', backgroundPositionX: groundShift,
              borderTop: '1px solid rgba(56,189,248,0.3)' }} />
            <div style={{ position: 'absolute', left: '50%', bottom: 36, transform: `translateX(calc(-50% + ${driveX}px))` }}>
              <div style={{ transform: 'scale(0.3)', transformOrigin: 'bottom center' }}>
                <Robot assemble={1} spin={false} tint="cyan" float={false} />
              </div>
            </div>
            <div style={{ position: 'absolute', left: 12, top: 10, fontFamily: FM, fontSize: 12, color: running ? '#4ade80' : C.body }}>
              {running ? '● running' : '○ idle'}
            </div>
          </div>
          <div style={{ marginTop: 14, fontFamily: FM, fontSize: 12, color: C.body }}>Rover-01</div>
          <div style={{ marginTop: 8, height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.08)', position: 'relative' }}>
            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '86%', borderRadius: 3, background: 'linear-gradient(90deg,#4ade80,#22c55e)' }} />
          </div>
          <div style={{ marginTop: 6, fontFamily: FM, fontSize: 11, color: C.body }}>Battery 86%</div>
        </div>
      </div>
      {/* status bar */}
      <div style={{ height: 60, display: 'flex', alignItems: 'center', padding: '0 22px', borderTop: '1px solid rgba(255,255,255,0.07)', fontFamily: FM, fontSize: 13, color: C.body, letterSpacing: '0.06em' }}>
        Blocks 7 · Robot: Rover-01 · Sensors 3
        <span style={{ marginLeft: 'auto', color: C.cyan }}>{running ? 'EXECUTING…' : 'READY'}</span>
      </div>
      {/* ghost dragged block */}
      {ghostOn && (
        <div style={{ position: 'absolute', left: curX + 6, top: curY + 6, zIndex: 18, pointerEvents: 'none', transform: 'rotate(-3deg)', opacity: 0.92 }}>
          <div style={{ width: 196, height: 40, borderRadius: 11, display: 'flex', alignItems: 'center', gap: 9, padding: '0 14px',
            fontFamily: FB, fontWeight: 600, fontSize: 15, color: '#08121f', background: 'linear-gradient(180deg,#38BDF8,#1f78ad)',
            boxShadow: '0 8px 18px rgba(0,0,0,0.5)' }}><span style={{ fontSize: 16 }}>↻</span>Turn right 90°</div>
        </div>
      )}
      {/* cursor */}
      <div style={{ position: 'absolute', left: curX, top: curY, transform: `scale(${clicking ? 0.82 : 1})`, transition: 'transform 80ms', pointerEvents: 'none', zIndex: 20 }}>
        {clicking && <div style={{ position: 'absolute', left: -16, top: -16, width: 38, height: 38, borderRadius: '50%', border: `2px solid ${C.cyan}`, opacity: 0.7 }} />}
        <svg width="26" height="30" viewBox="0 0 26 30" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }}>
          <path d="M3 2 L3 24 L9 18 L13 27 L17 25 L13 16 L21 16 Z" fill="#fff" stroke="#0b1220" strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );
}



// ── CURIOUS LABS — 60s merged intro ────────────────────────────────────────
// Appended after: engine + shared cosmos + 3D components (Rocket, StudioUI)
//   + robotics components (Robot, CoreModule, CodeStudio, MiniArm/Drone).
// Reuses in-scope: C, FH, FB, FM, React, Stage, Sprite, useTime, useSprite,
//   Easing, interpolate, clamp, Center, Cosmos, HeadLine, Sub, fio, METAL.

const ACC = {
  d3: ['#FBBF24', '#FB7185'],
  rob: ['#22D3EE', '#38BDF8'],
  ai: ['#C084FC', '#F472B6'],
  web: ['#34D399', '#22D3EE'],
};
const grad = (a) => `linear-gradient(90deg, ${a[0]}, ${a[1]})`;

// ── Caption over a centerpiece / studio ─────────────────────────────────────
function Caption({ title, sub, accent, top = 108, size = 64 }) {
  const { localTime, duration } = useSprite();
  const f = fio(localTime, duration, 0.5, 0.55);
  return (
    <Center style={{ alignItems: 'flex-start', paddingTop: top }}>
      <div style={{ textAlign: 'center', opacity: f.opacity, transform: `translateY(${f.ty}px)` }}>
        <HeadLine text={title} size={size} grad={grad(accent)} />
        {sub ? <><div style={{ height: 14 }} /><Sub text={sub} /></> : null}
      </div>
    </Center>
  );
}

// ── Chapter divider — sweeping curtain + giant number ───────────────────────
function SectionTitle({ index, title, accent }) {
  const { localTime } = useSprite();
  const e = Easing.easeInOutCubic;
  const cover = clamp(localTime / 0.55, 0, 1);
  const uncover = clamp((localTime - 2.15) / 0.7, 0, 1);
  const panelX = uncover > 0 ? e(uncover) * 116 : (1 - e(cover)) * -116;
  const tin = clamp((localTime - 0.5) / 0.45, 0, 1);
  const tout = 1 - clamp((localTime - 1.95) / 0.3, 0, 1);
  const tOp = tin * tout;
  return (
    <div style={{ position: 'absolute', inset: 0, transform: `translateX(${panelX}%)`,
      overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: '18%', top: '20%', width: 760, height: 760, borderRadius: '50%',
        background: `radial-gradient(circle, ${accent[0]}33, transparent 64%)`, filter: 'blur(40px)' }} />
      {/* giant number */}
      <div style={{ position: 'absolute', right: 110, top: 90, fontFamily: FH, fontWeight: 900, fontSize: 460,
        lineHeight: 1, letterSpacing: '-0.02em', opacity: tOp * 0.16,
        background: grad(accent), WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>
        {index}
      </div>
      <div style={{ position: 'absolute', left: 150, top: '50%', transform: `translateY(calc(-50% + ${(1 - tin) * 26}px))`, opacity: tOp }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 22 }}>
          <div style={{ width: 66, height: 5, borderRadius: 3, background: grad(accent) }} />
          <span style={{ fontFamily: FM, fontSize: 20, letterSpacing: '0.4em', color: accent[0], textTransform: 'uppercase' }}>
            Section {index}
          </span>
        </div>
        <div style={{ fontFamily: FH, fontWeight: 800, fontSize: 96, lineHeight: 1.02, letterSpacing: '0.01em', color: C.head, maxWidth: 1100 }}>
          {title}
        </div>
      </div>
    </div>
  );
}

// ── Generic studio window shell ─────────────────────────────────────────────
function studioShell(title, accent, runLabel, runOn, settle, bob, body, active = 2, w = 1240) {
  return (
    <div style={{ width: w, height: 700, borderRadius: 22, overflow: 'hidden',
      transform: `translateY(${(1 - settle) * 40 + bob}px) scale(${0.92 + 0.08 * settle})`, opacity: settle,
      background: 'linear-gradient(180deg, rgba(13,26,46,0.96), rgba(7,16,30,0.97))',
      border: `1px solid ${accent[0]}55`,
      boxShadow: `0 50px 130px rgba(0,0,0,0.65), 0 0 60px ${accent[0]}22, inset 0 1px 0 rgba(255,255,255,0.06)`,
      position: 'relative' }}>
      <div style={{ height: 50, display: 'flex', alignItems: 'center', gap: 10, padding: '0 20px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <span style={{ width: 13, height: 13, borderRadius: '50%', background: '#ff5f57' }} />
        <span style={{ width: 13, height: 13, borderRadius: '50%', background: '#febc2e' }} />
        <span style={{ width: 13, height: 13, borderRadius: '50%', background: '#28c840' }} />
        <span style={{ fontFamily: FM, fontSize: 15, color: C.body, marginLeft: 14, letterSpacing: '0.06em' }}>{title}</span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10, color: '#08121f', fontWeight: 700,
          padding: '6px 16px', borderRadius: 9, fontSize: 14, fontFamily: FB,
          background: runOn ? `linear-gradient(180deg, ${accent[0]}, ${accent[1]})` : 'rgba(255,255,255,0.1)',
          color: runOn ? '#08121f' : C.body, boxShadow: runOn ? `0 0 18px ${accent[0]}88` : 'none' }}>{runLabel}</div>
      </div>
      <div style={{ display: 'flex', height: 650 }}>
        <NavRail active={active} accent={accent} />
        {body}
      </div>
    </div>
  );
}
function pointer(curX, curY, clicking, accent) {
  return (
    <div style={{ position: 'absolute', left: curX, top: curY, transform: `scale(${clicking ? 0.82 : 1})`, transition: 'transform 80ms', pointerEvents: 'none', zIndex: 20 }}>
      {clicking ? <div style={{ position: 'absolute', left: -16, top: -16, width: 38, height: 38, borderRadius: '50%', border: `2px solid ${accent[0]}`, opacity: 0.7 }} /> : null}
      <svg width="26" height="30" viewBox="0 0 26 30" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }}>
        <path d="M3 2 L3 24 L9 18 L13 27 L17 25 L13 16 L21 16 Z" fill="#fff" stroke="#0b1220" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

// ── AI: neural network centerpiece ──────────────────────────────────────────
function NeuralNet({ assemble = 1 }) {
  const time = useTime();
  const bob = Math.sin(time * 0.8) * 12;
  const W = 640, H = 440;
  const layers = [{ x: 90, n: 4 }, { x: 256, n: 6 }, { x: 422, n: 6 }, { x: 560, n: 3 }];
  const pts = layers.map(L => { const g = H / (L.n + 1); return Array.from({ length: L.n }, (_, i) => ({ x: L.x, y: g * (i + 1) })); });
  const conns = [];
  for (let l = 0; l < pts.length - 1; l++) for (const a of pts[l]) for (const b of pts[l + 1]) conns.push({ a, b, l });
  const layerOn = (l) => clamp((assemble - l * 0.16) / 0.3, 0, 1);
  const lineOn = (l) => clamp((assemble - (l * 0.16 + 0.22)) / 0.3, 0, 1);
  const flow = assemble > 0.92;
  return (
    <div style={{ position: 'relative', width: W, height: H, transform: `translateY(${bob}px)` }}>
      <div style={{ position: 'absolute', left: 60, top: 40, width: W - 120, height: H - 80, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(192,132,252,0.22), transparent 70%)', filter: 'blur(36px)' }} />
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{ position: 'relative', overflow: 'visible' }}>
        {conns.map((c, i) => (
          <line key={i} x1={c.a.x} y1={c.a.y} x2={c.b.x} y2={c.b.y} stroke="#C084FC" strokeOpacity={0.22 * lineOn(c.l)} strokeWidth={1.4} />
        ))}
        {flow ? conns.filter((_, i) => i % 4 === 0).map((c, i) => {
          const f = (time * 0.5 + i * 0.11) % 1;
          const px = c.a.x + (c.b.x - c.a.x) * f, py = c.a.y + (c.b.y - c.a.y) * f;
          return <g key={'p' + i}><circle cx={px} cy={py} r={7} fill="#F472B6" opacity={0.3} /><circle cx={px} cy={py} r={3.4} fill="#fff" /></g>;
        }) : null}
        {pts.flatMap((layer, l) => layer.map((p, i) => (
          <g key={l + '-' + i} opacity={layerOn(l)}>
            <circle cx={p.x} cy={p.y} r={22} fill="#38BDF8" opacity={0.18} />
            <circle cx={p.x} cy={p.y} r={13} fill="#22D3EE" stroke="#eaf7ff" strokeWidth={1.6} />
            <circle cx={p.x - 4} cy={p.y - 4} r={3.5} fill="#fff" opacity={0.85} />
          </g>
        )))}
      </svg>
    </div>
  );
}

// ── AI: train / predict lab ─────────────────────────────────────────────────
function AIStudio() {
  const { localTime } = useSprite();
  const time = useTime();
  const settle = Easing.easeOutCubic(clamp(localTime / 0.4, 0, 1));
  const bob = Math.sin(time * 0.7) * 9;
  const cxFn = interpolate([0.3, 1.4, 1.8, 5.2], [620, 1086, 1086, 1086], Easing.easeInOutCubic);
  const cyFn = interpolate([0.3, 1.4, 1.8, 5.2], [330, 150, 150, 150], Easing.easeInOutCubic);
  const curX = cxFn(localTime), curY = cyFn(localTime);
  const clickRun = localTime > 1.6 && localTime < 1.9;
  const training = localTime > 1.85;
  const acc = training ? Math.min(96, ((localTime - 1.85) / 2.2) * 96) : 0;
  const predicted = localTime > 4.2;
  const shape = (kind, col) => (
    <div style={{ width: 50, height: 50, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
      {kind === 'round'
        ? <div style={{ width: 26, height: 26, borderRadius: '50%', background: col, boxShadow: `0 0 10px ${col}` }} />
        : <div style={{ width: 0, height: 0, borderLeft: '15px solid transparent', borderRight: '15px solid transparent', borderBottom: `26px solid ${col}`, filter: `drop-shadow(0 0 6px ${col})` }} />}
    </div>
  );
  const body = (
    <>
      {/* training data */}
      <div style={{ width: 318, borderRight: '1px solid rgba(255,255,255,0.07)', padding: '22px 20px' }}>
        <div style={{ fontFamily: FM, fontSize: 12, letterSpacing: '0.14em', color: C.head, textTransform: 'uppercase', marginBottom: 16 }}>Training data</div>
        <div style={{ fontFamily: FB, fontSize: 14, color: C.cyan, marginBottom: 10 }}>● Round</div>
        <div style={{ display: 'flex', gap: 12, marginBottom: 22 }}>{shape('round', C.cyan)}{shape('round', C.cyan)}{shape('round', C.cyan)}</div>
        <div style={{ fontFamily: FB, fontSize: 14, color: C.pink, marginBottom: 10 }}>▲ Sharp</div>
        <div style={{ display: 'flex', gap: 12, marginBottom: 28 }}>{shape('sharp', C.pink)}{shape('sharp', C.pink)}{shape('sharp', C.pink)}</div>
        <div style={{ fontFamily: FM, fontSize: 12, color: C.body, letterSpacing: '0.06em' }}>6 examples · 2 labels</div>
      </div>
      {/* model + accuracy */}
      <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 26,
        backgroundImage: 'radial-gradient(rgba(192,132,252,0.06) 1.5px, transparent 1.5px)', backgroundSize: '26px 26px' }}>
        <div style={{ transform: 'scale(0.62)', marginTop: -20 }}><NeuralNet assemble={clamp((localTime) / 0.6, 0, 1)} /></div>
        <div style={{ width: 360, marginTop: -30 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: FM, fontSize: 13, color: C.body, marginBottom: 8 }}>
            <span>ACCURACY</span><span style={{ color: C.purple, fontWeight: 700 }}>{acc.toFixed(0)}%</span>
          </div>
          <div style={{ height: 10, borderRadius: 5, background: 'rgba(255,255,255,0.08)', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${acc}%`, borderRadius: 5, background: grad(ACC.ai), boxShadow: `0 0 14px ${C.purple}` }} />
          </div>
          <div style={{ marginTop: 14, fontFamily: FM, fontSize: 13, color: training ? C.purple : C.body, textAlign: 'center' }}>
            {training ? (acc >= 95 ? '✓ model trained' : 'training…') : 'press train to learn'}
          </div>
        </div>
      </div>
      {/* prediction */}
      <div style={{ width: 300, borderLeft: '1px solid rgba(255,255,255,0.07)', padding: '22px 20px' }}>
        <div style={{ fontFamily: FM, fontSize: 12, letterSpacing: '0.14em', color: C.head, textTransform: 'uppercase', marginBottom: 18 }}>Prediction</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 22 }}>
          {shape('round', '#9fb0d2')}
          <span style={{ color: C.body, fontSize: 22 }}>→</span>
          <span style={{ fontFamily: FB, fontWeight: 700, fontSize: 18, color: predicted ? C.cyan : C.body }}>{predicted ? 'Round' : '…'}</span>
        </div>
        <div style={{ fontFamily: FM, fontSize: 12, color: C.body, marginBottom: 8 }}>CONFIDENCE</div>
        <div style={{ height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.08)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: predicted ? '94%' : '0%', borderRadius: 4, background: `linear-gradient(90deg, ${C.cyan}, ${C.cyan2})`, transition: 'width 400ms' }} />
        </div>
        <div style={{ marginTop: 8, fontFamily: FM, fontSize: 13, color: C.cyan }}>{predicted ? '94%' : ''}</div>
      </div>
    </>
  );
  return (
    <div style={{ position: 'relative' }}>
      {studioShell('curious-labs · ai-lab', ACC.ai, '▶ Train', training, settle, bob, body, 2)}
      {pointer(curX, curY, clickRun, ACC.ai)}
    </div>
  );
}

// ── Web: a website assembling in a browser ──────────────────────────────────
function WebBuild({ assemble = 1 }) {
  const time = useTime();
  const bob = Math.sin(time * 0.8) * 11;
  const p = (s, d) => Easing.easeOutBack(clamp((assemble - s) / d, 0, 1));
  const acc = ACC.web;
  const block = (pr, style, children, from = 'up') => (
    <div style={{ opacity: clamp(pr * 1.4, 0, 1),
      transform: from === 'up' ? `translateY(${(1 - pr) * 26}px)` : `translateX(${(1 - pr) * -26}px)`, ...style }}>{children}</div>
  );
  return (
    <div style={{ width: 780, height: 540, borderRadius: 16, overflow: 'hidden', transform: `translateY(${bob}px)`,
      background: '#0e1a2c', border: `1px solid ${acc[0]}55`, boxShadow: `0 50px 120px rgba(0,0,0,0.6), 0 0 50px ${acc[0]}22` }}>
      {/* browser chrome */}
      <div style={{ height: 46, display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px', background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#ff5f57' }} />
        <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#febc2e' }} />
        <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#28c840' }} />
        <div style={{ marginLeft: 14, flex: 1, height: 26, borderRadius: 8, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', padding: '0 12px', fontFamily: FM, fontSize: 13, color: C.body }}>
          <span style={{ color: acc[0] }}>⌂</span><span style={{ marginLeft: 8 }}>curiouslabs.dev</span>
        </div>
      </div>
      {/* page */}
      <div style={{ height: 494, background: 'linear-gradient(180deg,#fbfdff,#eef3fb)', padding: '0', position: 'relative', overflow: 'hidden' }}>
        {block(p(0, 0.4), { height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 26px', background: '#fff', borderBottom: '1px solid #e6ebf3' },
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <div style={{ width: 22, height: 22, borderRadius: 7, background: grad(acc) }} />
              <span style={{ fontFamily: FH, fontWeight: 800, fontSize: 16, color: '#0e1a2c' }}>Curious</span>
            </div>
            <div style={{ display: 'flex', gap: 18 }}>{['Home', 'Build', 'Learn'].map((t, i) => <span key={i} style={{ fontFamily: FB, fontSize: 13, color: '#5b6b85' }}>{t}</span>)}</div>
          </>)}
        {block(p(0.18, 0.4), { padding: '28px 26px 0' },
          <>
            <div style={{ fontFamily: FH, fontWeight: 800, fontSize: 34, color: '#0e1a2c', lineHeight: 1.1 }}>Build the future.</div>
            <div style={{ fontFamily: FB, fontSize: 15, color: '#5b6b85', marginTop: 10, maxWidth: 420 }}>Young creators ship real projects — in 3D, robotics, AI and the web.</div>
          </>)}
        {block(p(0.36, 0.4), { display: 'flex', gap: 16, padding: '22px 26px 0' },
          <>
            {[0, 1, 2].map(i => (
              <div key={i} style={{ flex: 1, height: 120, borderRadius: 14, background: '#fff', border: '1px solid #e6ebf3', boxShadow: '0 8px 20px rgba(20,40,80,0.06)', padding: 14 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: [grad(ACC.d3), grad(ACC.rob), grad(ACC.ai)][i] }} />
                <div style={{ height: 8, width: '70%', borderRadius: 4, background: '#e6ebf3', marginTop: 14 }} />
                <div style={{ height: 8, width: '50%', borderRadius: 4, background: '#eef2f8', marginTop: 8 }} />
              </div>
            ))}
          </>)}
        {block(p(0.6, 0.4), { padding: '24px 26px 0', display: 'flex', gap: 14 },
          <>
            <div style={{ padding: '12px 26px', borderRadius: 10, background: grad(acc), color: '#06231a', fontFamily: FB, fontWeight: 700, fontSize: 15, boxShadow: `0 8px 20px ${acc[0]}55` }}>Start building</div>
            <div style={{ padding: '12px 24px', borderRadius: 10, border: '1px solid #cfd9ea', color: '#5b6b85', fontFamily: FB, fontWeight: 600, fontSize: 15 }}>See projects</div>
          </>)}
      </div>
    </div>
  );
}

// ── Web: live code editor + preview ─────────────────────────────────────────
function CodeEditor() {
  const { localTime } = useSprite();
  const time = useTime();
  const settle = Easing.easeOutCubic(clamp(localTime / 0.4, 0, 1));
  const bob = Math.sin(time * 0.7) * 9;
  const cxFn = interpolate([0.3, 1.2, 1.6, 5.2], [560, 360, 360, 360], Easing.easeInOutCubic);
  const cyFn = interpolate([0.3, 1.2, 1.6, 5.2], [330, 384, 384, 384], Easing.easeInOutCubic);
  const curX = cxFn(localTime), curY = cyFn(localTime);
  const typed = clamp((localTime - 1.4) / 1.0, 0, 1);
  const showBtn = localTime > 2.5;
  const caret = Math.floor(time * 2) % 2 === 0;
  const tag = (t) => <span style={{ color: '#F472B6' }}>{t}</span>;
  const at = (t) => <span style={{ color: '#38BDF8' }}>{t}</span>;
  const st = (t) => <span style={{ color: '#FBBF24' }}>{t}</span>;
  const line = (n, indent, children, o = {}) => (
    <div style={{ display: 'flex', opacity: o.op == null ? 1 : o.op, transform: `translateX(${o.tx || 0}px)` }}>
      <span style={{ width: 30, color: 'rgba(143,163,191,0.4)', textAlign: 'right', marginRight: 18, userSelect: 'none' }}>{n}</span>
      <span style={{ paddingLeft: indent * 16, color: '#c8d4e8' }}>{children}</span>
    </div>
  );
  const body = (
    <>
      {/* code */}
      <div style={{ width: '54%', borderRight: '1px solid rgba(255,255,255,0.07)', padding: '20px 18px',
        fontFamily: FM, fontSize: 15.5, lineHeight: 2.0, background: 'rgba(4,10,20,0.4)' }}>
        {line(1, 0, <>{tag('<section')} {at('class')}={st('"hero"')}{tag('>')}</>)}
        {line(2, 1, <>{tag('<h1>')}Build the future{tag('</h1>')}</>)}
        {line(3, 1, <>{tag('<p>')}Create in 3D, robotics &amp; AI{tag('</p>')}</>)}
        {line(4, 1, <>{tag('<button')} {at('class')}={st('"cta"')}{tag('>')}Start{tag('</button>')}</>, { op: typed, tx: (1 - typed) * 14 })}
        {line(5, 0, <>{tag('</section>')}{caret ? <span style={{ color: ACC.web[0] }}>▍</span> : null}</>)}
      </div>
      {/* preview */}
      <div style={{ flex: 1, position: 'relative', background: 'linear-gradient(180deg,#fbfdff,#eef3fb)', overflow: 'hidden' }}>
        <div style={{ height: 40, display: 'flex', alignItems: 'center', padding: '0 16px', background: '#fff', borderBottom: '1px solid #e6ebf3', fontFamily: FM, fontSize: 12, color: C.body }}>
          <span style={{ color: ACC.web[0] }}>●</span><span style={{ marginLeft: 8 }}>live preview</span>
        </div>
        <div style={{ padding: '40px 36px' }}>
          <div style={{ fontFamily: FH, fontWeight: 800, fontSize: 38, color: '#0e1a2c', lineHeight: 1.1 }}>Build the future</div>
          <div style={{ fontFamily: FB, fontSize: 16, color: '#5b6b85', marginTop: 14 }}>Create in 3D, robotics &amp; AI</div>
          <div style={{ marginTop: 26, opacity: showBtn ? 1 : 0, transform: `scale(${showBtn ? 1 : 0.6})`, transition: 'transform 280ms, opacity 280ms', transformOrigin: 'left' }}>
            <span style={{ display: 'inline-block', padding: '14px 32px', borderRadius: 11, background: grad(ACC.web), color: '#06231a', fontFamily: FB, fontWeight: 700, fontSize: 16, boxShadow: `0 10px 24px ${ACC.web[0]}66` }}>Start</span>
          </div>
        </div>
      </div>
    </>
  );
  return (
    <div style={{ position: 'relative' }}>
      {studioShell('curious-labs · index.html', ACC.web, '⟳ Live', true, settle, bob, body, 3)}
      {pointer(curX, curY, false, ACC.web)}
    </div>
  );
}

// ── Opening brand reveal ────────────────────────────────────────────────────
function Opening() {
  const { localTime } = useSprite();
  const e = Easing.easeOutCubic;
  const kick = e(clamp((localTime - 0.2) / 0.6, 0, 1));
  const logo = e(clamp((localTime - 0.6) / 0.9, 0, 1));
  const tag = e(clamp((localTime - 1.5) / 0.8, 0, 1));
  const chips = clamp((localTime - 2.3) / 1.2, 0, 1);
  const out = 1 - clamp((localTime - 5.1) / 0.8, 0, 1);
  const chipData = [['3D Modelling', ACC.d3], ['Robotics', ACC.rob], ['AI', ACC.ai], ['Web Dev', ACC.web]];
  return (
    <Center style={{ flexDirection: 'column', opacity: out }}>
      <div style={{ fontFamily: FM, fontSize: 19, letterSpacing: '0.46em', color: C.cyan, textTransform: 'uppercase',
        opacity: kick, transform: `translateY(${(1 - kick) * 14}px)`, marginBottom: 22 }}>
        PW Academy presents
      </div>
      <div style={{ opacity: logo, transform: `translateY(${(1 - logo) * 22}px) scale(${0.95 + 0.05 * logo})` }}>
        <HeadLine text="CURIOUS LABS" size={150} weight={900} ls="0.04em"
          grad={`linear-gradient(100deg, ${C.cyan} 0%, ${C.cyan2} 32%, ${C.purple} 68%, ${C.pink} 100%)`} />
      </div>
      <div style={{ fontFamily: FB, fontSize: 28, color: C.head, opacity: tag, marginTop: 14, transform: `translateY(${(1 - tag) * 14}px)`, letterSpacing: '0.01em' }}>
        Where young minds build the future.
      </div>
      <div style={{ display: 'flex', gap: 16, marginTop: 40 }}>
        {chipData.map((c, i) => {
          const cp = clamp((chips - i * 0.12) / 0.5, 0, 1);
          return (
            <div key={i} style={{ opacity: cp, transform: `translateY(${(1 - cp) * 18}px)`,
              padding: '11px 22px', borderRadius: 999, fontFamily: FB, fontWeight: 600, fontSize: 17, color: C.head,
              border: `1.5px solid ${c[1][0]}`, background: `linear-gradient(120deg, ${c[1][0]}22, ${c[1][1]}11)`,
              boxShadow: `0 0 22px ${c[1][0]}33` }}>{c[0]}</div>
          );
        })}
      </div>
    </Center>
  );
}

// ── Intro HUD + section progress ────────────────────────────────────────────
function IntroHUD() {
  const time = useTime();
  const op = Easing.easeOutCubic(clamp((time - 0.3) / 0.6, 0, 1)) * 0.9;
  const secs = [[0, '3D Modelling', ACC.d3], [15, 'Robotics', ACC.rob], [30, 'AI', ACC.ai], [45, 'Web Development', ACC.web]];
  let idx = 0; for (let i = 0; i < secs.length; i++) if (time >= secs[i][0]) idx = i;
  const cur = secs[idx];
  const corner = { position: 'absolute', fontFamily: FM, fontSize: 15, letterSpacing: '0.16em', color: 'rgba(143,163,191,0.85)', textTransform: 'uppercase', opacity: op };
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <div style={{ ...corner, left: 54, top: 46, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: cur[2][0], boxShadow: `0 0 10px ${cur[2][0]}` }} />
        Curious Labs · PW Academy
      </div>
      <div style={{ ...corner, right: 54, top: 46 }}>{cur[1]}</div>
      <div style={{ ...corner, left: 54, bottom: 56 }}>0{idx + 1} / 04</div>
      {/* progress ticks */}
      <div style={{ position: 'absolute', right: 54, bottom: 58, display: 'flex', gap: 8, opacity: op }}>
        {secs.map((s, i) => (
          <div key={i} style={{ width: 34, height: 4, borderRadius: 2, background: i <= idx ? s[2][0] : 'rgba(255,255,255,0.16)', boxShadow: i === idx ? `0 0 10px ${s[2][0]}` : 'none' }} />
        ))}
      </div>
    </div>
  );
}

// ── Master 60s timeline ─────────────────────────────────────────────────────
function IntroSceneSprites() {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', fontFamily: FB }}>

      <Sprite start={0} end={3}><SectionTitle index="01" title="3D Modelling" accent={ACC.d3} /></Sprite>
      <Sprite start={2.6} end={8.4}><Center style={{ transform: 'translateY(36px)' }}><Rocket assemble={clamp((useTime() - 3.0) / 2.6, 0, 1)} spin={true} float={false} /></Center></Sprite>
      <Sprite start={2.9} end={8.2}><Caption title="Model it in 3D." sub="Snap primitives together into a real creation." accent={ACC.d3} /></Sprite>
      <Sprite start={8.0} end={15}><Center style={{ transform: 'translateY(34px) scale(0.82)' }}><StudioUI /></Center></Sprite>
      <Sprite start={8.2} end={14.9}><Caption title="Design in the 3D studio." accent={ACC.d3} size={54} top={36} /></Sprite>

      {/* 02 · ROBOTICS */}
      <Sprite start={15} end={18}><SectionTitle index="02" title="Robotics" accent={ACC.rob} /></Sprite>
      <Sprite start={17.6} end={23.4}><Center style={{ transform: 'translateY(40px)' }}><Robot assemble={clamp((useTime() - 18.0) / 2.6, 0, 1)} spin={true} float={false} /></Center></Sprite>
      <Sprite start={17.9} end={23.2}><Caption title="Build your robot." sub="Add motors, sensors and wheels." accent={ACC.rob} /></Sprite>
      <Sprite start={23.0} end={30}><Center style={{ transform: 'translateY(34px) scale(0.8)' }}><CodeStudio /></Center></Sprite>
      <Sprite start={23.2} end={29.9}><Caption title="Code it to life." accent={ACC.rob} size={54} top={30} /></Sprite>

      {/* 03 · AI */}
      <Sprite start={30} end={33}><SectionTitle index="03" title="Artificial Intelligence" accent={ACC.ai} /></Sprite>
      <Sprite start={32.6} end={38.4}><Center style={{ transform: 'translateY(40px)' }}><NeuralNet assemble={clamp((useTime() - 33.0) / 2.4, 0, 1)} /></Center></Sprite>
      <Sprite start={32.9} end={38.2}><Caption title="Teach a neural net." sub="Watch data flow through the network." accent={ACC.ai} /></Sprite>
      <Sprite start={38.0} end={45}><Center style={{ transform: 'translateY(34px) scale(0.82)' }}><AIStudio /></Center></Sprite>
      <Sprite start={38.2} end={44.9}><Caption title="Train your own AI." accent={ACC.ai} size={54} top={30} /></Sprite>

      {/* 04 · WEB DEVELOPMENT */}
      <Sprite start={45} end={48}><SectionTitle index="04" title="Web Development" accent={ACC.web} /></Sprite>
      <Sprite start={47.6} end={53.4}><Center style={{ transform: 'translateY(40px)' }}><WebBuild assemble={clamp((useTime() - 48.0) / 2.6, 0, 1)} /></Center></Sprite>
      <Sprite start={47.9} end={53.2}><Caption title="Build for the web." sub="Assemble a real site, block by block." accent={ACC.web} /></Sprite>
      <Sprite start={53.0} end={60}><Center style={{ transform: 'translateY(34px) scale(0.82)' }}><CodeEditor /></Center></Sprite>
      <Sprite start={53.2} end={59.9}><Caption title="Code a live site." accent={ACC.web} size={54} top={30} /></Sprite>
    </div>
  );
}



// ── Transparent, contain-fit stage that loops one [from,to] section window ──
// (contain, not cover, so nothing is cropped — the letterbox shows the home cosmos)
function IntroStage({ from, to, children }) {
  const hostRef = React.useRef(null);
  const [scale, setScale] = React.useState(1);
  const [time, setTime] = React.useState(from);
  const [inView, setInView] = React.useState(true);
  const [reduced, setReduced] = React.useState(false);

  React.useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener && mq.addEventListener('change', apply);
    return () => { mq.removeEventListener && mq.removeEventListener('change', apply); };
  }, []);

  React.useEffect(() => {
    const el = hostRef.current; if (!el) return;
    const measure = () => { const w = el.clientWidth, h = el.clientHeight; if (w && h) setScale(Math.min(w / 1920, h / 1080)); };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener('resize', measure);
    return () => { ro.disconnect(); window.removeEventListener('resize', measure); };
  }, []);

  React.useEffect(() => {
    const el = hostRef.current; if (!el) return;
    const io = new IntersectionObserver((ents) => setInView(ents[0].isIntersecting), { threshold: 0.05 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  React.useEffect(() => {
    if (reduced) { setTime(from + 5); return; }
    if (!inView) return;
    let raf = 0, last = null;
    const step = (ts) => {
      if (last == null) last = ts;
      const dt = (ts - last) / 1000; last = ts;
      setTime((t) => { let n = t + dt; if (n >= to) n = from + (n - to); return n; });
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [inView, reduced, from, to]);

  const ctx = React.useMemo(() => ({ time, duration: to, playing: !reduced && inView }), [time, to, reduced, inView]);

  return (
    <div ref={hostRef} style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: '50%', top: '50%', width: 1920, height: 1080,
        transform: `translate(-50%, -50%) scale(${scale})`, transformOrigin: 'center', willChange: 'transform' }}>
        <TimelineContext.Provider value={ctx}>{children}</TimelineContext.Provider>
      </div>
    </div>
  );
}

function introSlide(from, to) {
  return (
    <div className="hero-intro" style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      <IntroStage from={from} to={to}><IntroSceneSprites /></IntroStage>
    </div>
  );
}

export function HeroIntro3D()       { return introSlide(0, 15); }
export function HeroIntroRobotics() { return introSlide(15, 30); }
export function HeroIntroAI()       { return introSlide(30, 45); }
export function HeroIntroWeb()      { return introSlide(45, 60); }
