import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import officeBg from '../../../assests/Inteviewer/corporate_office_bg.jpg';
import interviewerBase from '../../../assests/Inteviewer/photorealistic_interviewer_base.png';
import eyesOpen from '../../../assests/Inteviewer/eyes_open.png';
import eyesBlink from '../../../assests/Inteviewer/eyes_blink.png';
import eyesListen from '../../../assests/Inteviewer/eyes_listen.png';
import eyesThink from '../../../assests/Inteviewer/eyes_think.png';
import mouthRest from '../../../assests/Inteviewer/mouth_rest.png';
import mouthAa from '../../../assests/Inteviewer/mouth_aa.png';
import mouthEe from '../../../assests/Inteviewer/mouth_ee.png';
import mouthOh from '../../../assests/Inteviewer/mouth_oh.png';
import mouthOo from '../../../assests/Inteviewer/mouth_oo.png';
import mouthSmile from '../../../assests/Inteviewer/mouth_smile.png';

export type Viseme = 'neutral' | 'aa' | 'ee' | 'oh' | 'oo' | 'smile';

export interface PhotorealisticAvatarStageProps {
  speaking: boolean;
  listening: boolean;
  isThinking?: boolean;
  viseme?: Viseme;
  className?: string;
  interviewerName?: string;
}

export const PhotorealisticAvatarStage: React.FC<PhotorealisticAvatarStageProps> = ({
  speaking,
  listening,
  isThinking = false,
  viseme = 'neutral',
  className = '',
  interviewerName = 'Marcus Vance · Senior Technical Partner',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isBlinking, setIsBlinking] = useState(false);
  const [headOffsetY, setHeadOffsetY] = useState(0);
  const [headOffsetX, setHeadOffsetX] = useState(0);
  const [nodOffset, setNodOffset] = useState(0);

  // Preload all photorealistic asset layers for immediate zero-latency switching
  useEffect(() => {
    const assetUrls = [
      officeBg,
      interviewerBase,
      eyesOpen,
      eyesBlink,
      eyesListen,
      eyesThink,
      mouthRest,
      mouthAa,
      mouthEe,
      mouthOh,
      mouthOo,
      mouthSmile,
    ];
    assetUrls.forEach((src) => {
      const img = new Image();
      img.src = src;
    });
  }, []);

  // Natural human blinking simulation (every 2.8 - 4.8 seconds, lasting ~120ms)
  useEffect(() => {
    let blinkTimer: number;
    let blinkCloseTimer: number;

    const scheduleNextBlink = () => {
      const delay = Math.random() * 2200 + 2600;
      blinkTimer = window.setTimeout(() => {
        setIsBlinking(true);
        blinkCloseTimer = window.setTimeout(() => {
          setIsBlinking(false);
          scheduleNextBlink();
        }, 125);
      }, delay);
    };

    scheduleNextBlink();

    return () => {
      clearTimeout(blinkTimer);
      clearTimeout(blinkCloseTimer);
    };
  }, []);

  // Natural human micro-movements: continuous breathing, listening nods, and micro-saccades
  useEffect(() => {
    let animId: number;
    let startTime = performance.now();

    const loop = (currentTime: number) => {
      const elapsed = (currentTime - startTime) / 1000;

      // Gentle natural breathing rhythm (~3.6s cycle)
      const breathing = Math.sin(elapsed * 1.7) * 2.5;

      // Subtle lateral micro-drift
      const sway = Math.cos(elapsed * 0.9) * 1.2;

      // Attentive nod when listening to candidate
      let nod = 0;
      if (listening) {
        nod = Math.sin(elapsed * 3.2) * 2.8;
      }

      setHeadOffsetY(breathing);
      setHeadOffsetX(sway);
      setNodOffset(nod);

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [listening]);

  // Determine active eye overlay
  const activeEyeSrc = useMemo(() => {
    if (isBlinking) return eyesBlink;
    if (isThinking) return eyesThink;
    if (listening) return eyesListen;
    return eyesOpen;
  }, [isBlinking, isThinking, listening]);

  // Determine active mouth overlay
  const activeMouthSrc = useMemo(() => {
    if (!speaking) {
      if (listening) return mouthRest;
      if (isThinking) return mouthSmile;
      return mouthRest;
    }

    switch (viseme) {
      case 'aa':
        return mouthAa;
      case 'ee':
        return mouthEe;
      case 'oh':
        return mouthOh;
      case 'oo':
        return mouthOo;
      case 'smile':
        return mouthSmile;
      default:
        return mouthAa;
    }
  }, [speaking, listening, isThinking, viseme]);

  // Status label
  const statusLabel = useMemo(() => {
    if (speaking) return { text: 'Interviewer Speaking', dot: 'bg-emerald-400 animate-pulse' };
    if (isThinking) return { text: 'Analyzing Response...', dot: 'bg-amber-400 animate-pulse' };
    if (listening) return { text: 'Listening Attentively', dot: 'bg-blue-400 animate-pulse' };
    return { text: 'Ready for Answer', dot: 'bg-emerald-500' };
  }, [speaking, listening, isThinking]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden select-none bg-slate-950 font-sans ${className}`}
      style={{
        perspective: '1000px',
      }}
    >
      {/* Layer 1: Photorealistic Executive Corporate Office Background */}
      <img
        src={officeBg}
        alt="Executive Corporate Office"
        className="absolute inset-0 w-full h-full object-cover object-center filter brightness-95 contrast-105"
        style={{
          transform: `scale(1.03) translate(${-headOffsetX * 0.25}px, ${-headOffsetY * 0.2}px)`,
          transition: 'transform 0.15s ease-out',
        }}
      />

      {/* Layer 2: Subtle Depth-of-Field Blur Gradient */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/25" />

      {/* Layer 3: Warm Studio Lighting Vignette */}
      <div
        className="pointer-events-none absolute inset-0 opacity-40 mix-blend-soft-light"
        style={{
          background: 'radial-gradient(circle at 45% 35%, rgba(255,245,230,0.3) 0%, rgba(10,15,30,0.85) 100%)',
        }}
      />

      {/* Layer 4: Composited Adult Male Interviewer with Micro-Movements */}
      <div
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
        style={{
          transform: `translate(${headOffsetX}px, ${headOffsetY + nodOffset}px)`,
          transition: 'transform 0.08s ease-out',
        }}
      >
        <div className="relative w-full h-full max-w-[1080px] max-h-[1080px] flex items-center justify-center">
          {/* Base High-Resolution Human Portrait */}
          <img
            src={interviewerBase}
            alt="Photorealistic AI Interviewer"
            className="w-full h-full object-contain object-bottom drop-shadow-[0_15px_30px_rgba(0,0,0,0.8)] filter brightness-[0.98] contrast-[1.02]"
            draggable={false}
          />

          {/* Dynamic Eye Micro-Expression Overlay */}
          <img
            src={activeEyeSrc}
            alt="Eyes Micro-expression"
            className="absolute inset-0 w-full h-full object-contain object-bottom transition-opacity duration-75"
            draggable={false}
          />

          {/* Dynamic Audio-Driven Viseme Mouth Overlay */}
          <img
            src={activeMouthSrc}
            alt="Mouth Viseme"
            className="absolute inset-0 w-full h-full object-contain object-bottom transition-all duration-100 ease-out"
            style={{
              opacity: 1,
              transform: speaking ? 'scale(1.005)' : 'scale(1.0)',
            }}
            draggable={false}
          />
        </div>
      </div>

      {/* Top Left: Google Meet / Zoom Interviewer Tag */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2.5 rounded-full bg-black/60 border border-white/15 px-3.5 py-1.5 backdrop-blur-md shadow-lg">
        <span className={`h-2.5 w-2.5 rounded-full ${statusLabel.dot}`} />
        <span className="text-xs font-semibold text-white tracking-wide">{interviewerName}</span>
      </div>

      {/* Bottom Left: State & Audio Visualizer Badge */}
      <div className="absolute bottom-4 left-4 z-10 flex items-center gap-3 rounded-full bg-slate-950/75 border border-white/15 px-4 py-2 backdrop-blur-md shadow-xl text-xs text-white">
        <div className="flex items-center gap-1.5">
          {speaking && (
            <div className="flex items-center gap-0.5 h-3">
              <span className="w-0.5 h-2 bg-emerald-400 rounded-full animate-bounce" />
              <span className="w-0.5 h-3 bg-emerald-400 rounded-full animate-bounce [animation-delay:0.15s]" />
              <span className="w-0.5 h-2.5 bg-emerald-400 rounded-full animate-bounce [animation-delay:0.3s]" />
              <span className="w-0.5 h-1.5 bg-emerald-400 rounded-full animate-bounce [animation-delay:0.45s]" />
            </div>
          )}
          {listening && (
            <div className="flex items-center gap-0.5 h-3">
              <span className="w-0.5 h-2.5 bg-blue-400 rounded-full animate-pulse" />
              <span className="w-0.5 h-1.5 bg-blue-400 rounded-full animate-pulse [animation-delay:0.2s]" />
              <span className="w-0.5 h-3 bg-blue-400 rounded-full animate-pulse [animation-delay:0.4s]" />
            </div>
          )}
          <span className="font-medium text-slate-200">{statusLabel.text}</span>
        </div>
      </div>

      {/* Bottom Right: HD Real-Time Badge */}
      <div className="absolute bottom-4 right-4 z-10 hidden sm:flex items-center gap-1.5 rounded-md bg-black/40 border border-white/10 px-2.5 py-1 text-[10px] font-mono font-medium text-white/70 backdrop-blur-sm">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
        <span>HD 60FPS · RTX 2050 ACCELERATED</span>
      </div>
    </div>
  );
};
