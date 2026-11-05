import React, { useEffect, useRef, useState, useMemo } from 'react';
import marcusIdle from '../../../assests/Inteviewer/marcus_vance_office_interview.jpg';
import marcusSpeaking from '../../../assests/Inteviewer/marcus_vance_speaking.jpg';
import marcusBlink from '../../../assests/Inteviewer/marcus_vance_blink.jpg';

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
  const [speechMouthOpen, setSpeechMouthOpen] = useState(false);

  // Preload all photorealistic frames for instantaneous zero-latency switching
  useEffect(() => {
    [marcusIdle, marcusSpeaking, marcusBlink].forEach((src) => {
      const img = new Image();
      img.src = src;
    });
  }, []);

  // Natural human blinking simulation (every 3.0 - 4.8 seconds, lasting ~115ms)
  useEffect(() => {
    let blinkTimer: number;
    let blinkCloseTimer: number;

    const scheduleNextBlink = () => {
      const delay = Math.random() * 2000 + 3000;
      blinkTimer = window.setTimeout(() => {
        setIsBlinking(true);
        blinkCloseTimer = window.setTimeout(() => {
          setIsBlinking(false);
          scheduleNextBlink();
        }, 115);
      }, delay);
    };

    scheduleNextBlink();

    return () => {
      clearTimeout(blinkTimer);
      clearTimeout(blinkCloseTimer);
    };
  }, []);

  // Audio-driven natural speech lip sync cadence modulation
  useEffect(() => {
    if (!speaking) {
      setSpeechMouthOpen(false);
      return;
    }

    // When speaking, cycle through syllable cadences (~110ms to 170ms per syllable)
    let cadenceTimer: number;
    let isOpen = true;

    const tickCadence = () => {
      setSpeechMouthOpen(isOpen);
      isOpen = !isOpen;
      const duration = Math.random() * 60 + 110;
      cadenceTimer = window.setTimeout(tickCadence, duration);
    };

    tickCadence();

    return () => {
      clearTimeout(cadenceTimer);
    };
  }, [speaking]);

  // Natural human micro-movements: continuous breathing, listening nods, and micro-saccades
  useEffect(() => {
    let animId: number;
    const startTime = performance.now();

    const loop = (currentTime: number) => {
      const elapsed = (currentTime - startTime) / 1000;

      // Gentle natural breathing rhythm (~3.6s cycle, subtle 1.8px)
      const breathing = Math.sin(elapsed * 1.7) * 1.8;

      // Subtle lateral micro-drift
      const sway = Math.cos(elapsed * 0.9) * 0.9;

      // Attentive nod when listening to candidate
      let nod = 0;
      if (listening) {
        nod = Math.sin(elapsed * 3.2) * 2.2;
      }

      setHeadOffsetY(breathing);
      setHeadOffsetX(sway);
      setNodOffset(nod);

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [listening]);

  // Determine active frame state
  const isSpeakingActive = speaking && (speechMouthOpen || (viseme && viseme !== 'neutral'));
  const isBlinkActive = isBlinking && !speaking;

  // Status label for conference call UI
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
      {/* Composited Photorealistic Video Stream with Natural Micro-Movements */}
      <div
        className="absolute inset-0 w-full h-full"
        style={{
          transform: `translate(${headOffsetX}px, ${headOffsetY + nodOffset}px) scale(1.02)`,
          transition: 'transform 0.08s ease-out',
        }}
      >
        {/* Layer 1: Photorealistic Idle / Listening Portrait in Modern Executive Office */}
        <img
          src={marcusIdle}
          alt="Photorealistic AI Interviewer - Marcus Vance"
          className="absolute inset-0 w-full h-full object-cover object-center filter brightness-[0.98] contrast-[1.02]"
          draggable={false}
        />

        {/* Layer 2: Photorealistic Active Speaking Frame (Parted lips / speech phoneme) */}
        <img
          src={marcusSpeaking}
          alt="Marcus Vance Speaking"
          className={`absolute inset-0 w-full h-full object-cover object-center transition-opacity duration-100 ease-out ${
            isSpeakingActive ? 'opacity-100' : 'opacity-0'
          }`}
          draggable={false}
        />

        {/* Layer 3: Photorealistic Natural Blink Frame */}
        <img
          src={marcusBlink}
          alt="Marcus Vance Blinking"
          className={`absolute inset-0 w-full h-full object-cover object-center transition-opacity duration-75 ease-in-out ${
            isBlinkActive ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
          draggable={false}
        />
      </div>

      {/* Layer 4: Cinematic Subtle Edge Vignette */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/25" />

      {/* Top Left: Executive Google Meet / Zoom Interviewer Tag */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2.5 rounded-full bg-black/60 border border-white/15 px-3.5 py-1.5 backdrop-blur-md shadow-lg">
        <span className={`h-2.5 w-2.5 rounded-full ${statusLabel.dot}`} />
        <span className="text-xs font-semibold text-white tracking-wide">{interviewerName}</span>
      </div>

      {/* Bottom Left: State & Audio Wave Visualizer */}
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

      {/* Bottom Right: HD 60FPS Video Conference Pill */}
      <div className="absolute bottom-4 right-4 z-10 hidden sm:flex items-center gap-1.5 rounded-md bg-black/40 border border-white/10 px-2.5 py-1 text-[10px] font-mono font-medium text-white/70 backdrop-blur-sm">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
        <span>HD 60FPS · REALTIME AI</span>
      </div>
    </div>
  );
};
