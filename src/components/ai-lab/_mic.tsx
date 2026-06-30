"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Shared microphone plumbing for the Neural Lab's audio experiment. Opens an
 * audio stream, runs it through a Web Audio AnalyserNode, and exposes a
 * 32-band frequency "fingerprint" + a live loudness level. No audio is ever
 * recorded or uploaded — only the live spectrum is read each frame.
 */

export type MicStatus = "idle" | "starting" | "on" | "error";
const BANDS = 32;

export function useMic() {
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const dataRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const [status, setStatus] = useState<MicStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("This browser can't open a microphone.");
      setStatus("error");
      return;
    }
    setStatus("starting");
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      streamRef.current = stream;
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.6;
      src.connect(analyser);
      ctxRef.current = ctx;
      analyserRef.current = analyser;
      dataRef.current = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));
      setStatus("on");
    } catch (e) {
      const name = e instanceof DOMException ? e.name : "";
      setError(name === "NotAllowedError" ? "Microphone blocked — allow access, then try again." : "Couldn't start the microphone.");
      setStatus("error");
    }
  }, []);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    ctxRef.current?.close().catch(() => {});
    ctxRef.current = null;
    analyserRef.current = null;
    setStatus("idle");
  }, []);

  useEffect(() => () => stop(), [stop]);

  /** Average the FFT bins down to BANDS values in 0..1. */
  const fingerprint = useCallback((): number[] | null => {
    const analyser = analyserRef.current, data = dataRef.current;
    if (!analyser || !data) return null;
    analyser.getByteFrequencyData(data);
    const out = new Array(BANDS).fill(0);
    const per = Math.floor(data.length / BANDS);
    for (let b = 0; b < BANDS; b++) {
      let s = 0;
      for (let i = 0; i < per; i++) s += data[b * per + i];
      out[b] = s / per / 255;
    }
    return out;
  }, []);

  const level = useCallback((): number => {
    const fp = fingerprint();
    if (!fp) return 0;
    return fp.reduce((a, b) => a + b, 0) / fp.length;
  }, [fingerprint]);

  return { start, stop, status, error, fingerprint, level, bands: BANDS };
}
