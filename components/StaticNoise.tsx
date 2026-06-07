"use client";

import { useEffect, useRef, useMemo } from "react";

interface StaticNoiseProps {
  visible: boolean;
}

export default function StaticNoise({ visible }: StaticNoiseProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const noiseNodeRef = useRef<AudioBufferSourceNode | null>(null);

  const stopStaticSound = useMemo(
    () => () => {
      try {
        noiseNodeRef.current?.stop();
      } catch {
        // already stopped
      }
      noiseNodeRef.current = null;
    },
    [],
  );

  const startStaticSound = useMemo(
    () => () => {
      try {
        stopStaticSound();

        if (!audioCtxRef.current) {
          audioCtxRef.current = new AudioContext();
        }
        const audioCtx = audioCtxRef.current;

        if (audioCtx.state === "suspended") {
          audioCtx.resume();
        }

        const bufferSize = audioCtx.sampleRate * 2;
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < bufferSize; i++) {
          data[i] = (Math.random() * 2 - 1) * 0.3;
        }

        const source = audioCtx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;

        const filter = audioCtx.createBiquadFilter();
        filter.type = "bandpass";
        filter.frequency.value = 2000;
        filter.Q.value = 0.3;

        const gain = audioCtx.createGain();
        gain.gain.value = 0;

        source.connect(filter);
        filter.connect(gain);
        gain.connect(audioCtx.destination);

        gain.gain.linearRampToValueAtTime(0.5, audioCtx.currentTime + 0.03);
        source.start();
        noiseNodeRef.current = source;
      } catch {
        // audio not available
      }
    },
    [stopStaticSound],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const drawNoise = () => {
      const w = canvas.width;
      const h = canvas.height;
      const imageData = ctx.createImageData(w, h);
      const data = imageData.data;

      for (let i = 0; i < data.length; i += 4) {
        const v = Math.random() * 255;
        data[i] = v;
        data[i + 1] = v;
        data[i + 2] = v;
        data[i + 3] = 255;
      }

      ctx.putImageData(imageData, 0, 0);
      animRef.current = requestAnimationFrame(drawNoise);
    };

    if (visible) {
      drawNoise();
      startStaticSound();
    } else {
      stopStaticSound();
    }

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", resize);
      stopStaticSound();
    };
  }, [visible, startStaticSound, stopStaticSound]);

  if (!visible) return null;

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 z-20"
      style={{ imageRendering: "pixelated", mixBlendMode: "screen" }}
    />
  );
}
