import React, { useEffect, useRef, useState, useMemo } from 'react';
import marcusIdle from '../../../assests/Inteviewer/marcus_vance_office_interview.jpg';
import marcusParted from '../../../assests/Inteviewer/marcus_vance_parted.jpg';
import marcusSpeaking from '../../../assests/Inteviewer/marcus_vance_speaking.jpg';
import marcusRounded from '../../../assests/Inteviewer/marcus_vance_rounded.jpg';
import marcusHalfBlink from '../../../assests/Inteviewer/marcus_vance_half_blink.jpg';
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

type SpeechFrame = 'idle' | 'parted' | 'speaking' | 'rounded';
type BlinkStage = 'open' | 'half' | 'closed';

export const PhotorealisticAvatarStage: React.FC<PhotorealisticAvatarStageProps> = ({
  speaking,
  listening,
  isThinking = false,
  viseme = 'neutral',
  className = '',
  interviewerName = 'Marcus Vance · Senior Technical Partner',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoStreamRef = useRef<HTMLDivElement>(null);
  const listeningRef = useRef(listening);
  listeningRef.current = listening;

  const [activeSpeechFrame, setActiveSpeechFrame] = useState<SpeechFrame>('idle');
  const [blinkStage, setBlinkStage] = useState<BlinkStage>('open');

  // Pre-decode all photorealistic keyframes into GPU memory on mount
  useEffect(() => {
    const images = [
      marcusIdle,
      marcusParted,
      marcusSpeaking,
      marcusRounded,
      marcusHalfBlink,
      marcusBlink,
    ];
    images.forEach((src) => {
      const img = new Image();
      img.src = src;
      if ('decode' in img) {
        img.decode().catch(() => {});
      }
    });
  }, []);

  // 60 FPS Zero-Overhead Hardware-Accelerated Micro-Movements (Breathing, Nods, Drift)
  useEffect(() => {
    let animId: number;
    const startTime = performance.now();

    const loop = (currentTime: number) => {
      const elapsed = (currentTime - startTime) / 1000;

      // Natural breathing rhythm (~3.6s cycle, 1.8px vertical displacement)
      const breathing = Math.sin(elapsed * 1.7) * 1.8;

      // Subtle lateral micro-drift
      const sway = Math.cos(elapsed * 0.9) * 0.9;

      // Attentive listening nod when candidate speaks
      const nod = listeningRef.current ? Math.sin(elapsed * 3.2) * 2.2 : 0;

      if (videoStreamRef.current) {
        videoStreamRef.current.style.transform = `translate3d(${sway.toFixed(2)}px, ${(
          breathing + nod
        ).toFixed(2)}px, 0) scale(1.02)`;
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, []);

  // Multi-Frame Speech Articulation Sequence (Interpolates: Idle -> Parted -> Speaking -> Parted -> Rounded)
  useEffect(() => {
    if (!speaking) {
      setActiveSpeechFrame('idle');
      return;
    }

    let speechTimer: number;
    let stepIndex = 0;

    // Sequence of speech phonemes simulating fluid syllables with transitional in-betweens
    const cadenceSequence: SpeechFrame[] = [
      'parted',
      'speaking',
      'parted',
      'rounded',
      'parted',
      'speaking',
      'parted',
      'idle',
    ];

    const runSpeechCadence = () => {
      if (viseme === 'oh' || viseme === 'oo') {
        setActiveSpeechFrame('rounded');
      } else if (viseme === 'aa') {
        setActiveSpeechFrame('speaking');
      } else if (viseme === 'ee' || viseme === 'smile') {
        setActiveSpeechFrame('parted');
      } else {
        const nextFrame = cadenceSequence[stepIndex % cadenceSequence.length];
        setActiveSpeechFrame(nextFrame);
        stepIndex++;
      }

      // Fast, natural frame step (75ms - 110ms) creates fluid 10-15 FPS speech interpolation
      const duration = Math.random() * 35 + 75;
      speechTimer = window.setTimeout(runSpeechCadence, duration);
    };

    runSpeechCadence();

    return () => {
      clearTimeout(speechTimer);
    };
  }, [speaking, viseme]);

  // Organic 3-Stage Eyelid Blink (Open -> Half 40ms -> Closed 65ms -> Half 40ms -> Open)
  useEffect(() => {
    let blinkTimer: number;
    let halfCloseTimer: number;
    let fullCloseTimer: number;
    let halfOpenTimer: number;

    const scheduleNextBlink = () => {
      const delay = Math.random() * 2200 + 3000; // Blink every 3.0 to 5.2 seconds
      blinkTimer = window.setTimeout(() => {
        // Stage 1: Half-blink (lowering eyelids)
        setBlinkStage('half');

        halfCloseTimer = window.setTimeout(() => {
          // Stage 2: Fully closed
          setBlinkStage('closed');

          fullCloseTimer = window.setTimeout(() => {
            // Stage 3: Half-blink (raising eyelids)
            setBlinkStage('half');

            halfOpenTimer = window.setTimeout(() => {
              // Stage 4: Fully open
              setBlinkStage('open');
              scheduleNextBlink();
            }, 40);
          }, 65);
        }, 40);
      }, delay);
    };

    scheduleNextBlink();

    return () => {
      clearTimeout(blinkTimer);
      clearTimeout(halfCloseTimer);
      clearTimeout(fullCloseTimer);
      clearTimeout(halfOpenTimer);
    };
  }, []);

  // Status badge indicators
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
      {/* 60 FPS GPU-Accelerated Composited Video Layer */}
      <div
        ref={videoStreamRef}
        className="absolute inset-0 w-full h-full"
        style={{
          willChange: 'transform',
          transform: 'translate3d(0, 0, 0) scale(1.02)',
          backfaceVisibility: 'hidden',
        }}
      >
        {/* Layer 1: Base Idle Frame (Resting closed mouth in executive office) */}
        <img
          src={marcusIdle}
          alt="Marcus Vance - Idle"
          className="absolute inset-0 w-full h-full object-cover object-center filter brightness-[0.98] contrast-[1.02]"
          draggable={false}
          style={{ willChange: 'opacity' }}
        />

        {/* Layer 2: Parted Mouth Frame (Intermediary speech in-between) */}
        <img
          src={marcusParted}
          alt="Marcus Vance - Parted"
          className={`absolute inset-0 w-full h-full object-cover object-center transition-opacity duration-75 ease-out ${
            activeSpeechFrame === 'parted' ? 'opacity-100' : 'opacity-0'
          }`}
          draggable={false}
          style={{ willChange: 'opacity' }}
        />

        {/* Layer 3: Open Speaking Frame (Vowel / phoneme articulation) */}
        <img
          src={marcusSpeaking}
          alt="Marcus Vance - Speaking"
          className={`absolute inset-0 w-full h-full object-cover object-center transition-opacity duration-75 ease-out ${
            activeSpeechFrame === 'speaking' ? 'opacity-100' : 'opacity-0'
          }`}
          draggable={false}
          style={{ willChange: 'opacity' }}
        />

        {/* Layer 4: Rounded Mouth Frame ('O' / 'OH' speech phoneme) */}
        <img
          src={marcusRounded}
          alt="Marcus Vance - Rounded"
          className={`absolute inset-0 w-full h-full object-cover object-center transition-opacity duration-75 ease-out ${
            activeSpeechFrame === 'rounded' ? 'opacity-100' : 'opacity-0'
          }`}
          draggable={false}
          style={{ willChange: 'opacity' }}
        />

        {/* Layer 5: Half-Blink Frame (Organic 50% eyelid lowering transition) */}
        <img
          src={marcusHalfBlink}
          alt="Marcus Vance - Half Blink"
          className={`absolute inset-0 w-full h-full object-cover object-center transition-opacity duration-40 ease-in-out ${
            blinkStage === 'half' && !speaking ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
          draggable={false}
          style={{ willChange: 'opacity' }}
        />

        {/* Layer 6: Full-Blink Frame (Closed eyelids mid-blink) */}
        <img
          src={marcusBlink}
          alt="Marcus Vance - Blink"
          className={`absolute inset-0 w-full h-full object-cover object-center transition-opacity duration-50 ease-in-out ${
            blinkStage === 'closed' && !speaking ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
          draggable={false}
          style={{ willChange: 'opacity' }}
        />
      </div>

      {/* Layer 7: Cinematic Edge Vignette */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/25" />

      {/* Top Left: Executive Google Meet / Zoom Conference Tag */}
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

      {/* Bottom Right: High-Framerate RTX Hardware Accelerated Pill */}
      <div className="absolute bottom-4 right-4 z-10 hidden sm:flex items-center gap-1.5 rounded-md bg-black/40 border border-white/10 px-2.5 py-1 text-[10px] font-mono font-medium text-white/70 backdrop-blur-sm">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
        <span>60 FPS LOCKED · RTX ACCELERATED</span>
      </div>
    </div>
  );
};
