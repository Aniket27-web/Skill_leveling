import React, { useEffect, useRef } from 'react';
import marcusIdle from '../../../assests/Inteviewer/marcus_vance_office_interview.jpg';
import marcusParted from '../../../assests/Inteviewer/marcus_vance_parted.jpg';
import marcusSpeaking from '../../../assests/Inteviewer/marcus_vance_speaking.jpg';
import marcusRounded from '../../../assests/Inteviewer/marcus_vance_rounded.jpg';
import marcusSpeechAccent from '../../../assests/Inteviewer/marcus_vance_speech_accent.jpg';
import marcusThinking from '../../../assests/Inteviewer/marcus_vance_thinking.jpg';
import marcusListening from '../../../assests/Inteviewer/marcus_vance_listening.jpg';
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

export const PhotorealisticAvatarStage: React.FC<PhotorealisticAvatarStageProps> = ({
  speaking,
  listening,
  isThinking = false,
  viseme = 'neutral',
  className = '',
  interviewerName = 'Marcus Vance · Senior Technical Partner',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Live state refs to feed 60 FPS render loop without causing React re-renders
  const speakingRef = useRef(speaking);
  speakingRef.current = speaking;
  const listeningRef = useRef(listening);
  listeningRef.current = listening;
  const thinkingRef = useRef(isThinking);
  thinkingRef.current = isThinking;
  const visemeRef = useRef(viseme);
  visemeRef.current = viseme;

  // High-performance 60 FPS Engine (Zero Layout Thrashing, Single-Draw Keyframe Pipeline)
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d', {
      alpha: false,
      desynchronized: true,
    });
    if (!ctx) return;

    // Load and decode all 9 keyframes
    const images: Record<string, HTMLImageElement> = {
      idle: new Image(),
      parted: new Image(),
      speaking: new Image(),
      rounded: new Image(),
      speechAccent: new Image(),
      thinking: new Image(),
      listening: new Image(),
      halfBlink: new Image(),
      blink: new Image(),
    };

    images.idle.src = marcusIdle;
    images.parted.src = marcusParted;
    images.speaking.src = marcusSpeaking;
    images.rounded.src = marcusRounded;
    images.speechAccent.src = marcusSpeechAccent;
    images.thinking.src = marcusThinking;
    images.listening.src = marcusListening;
    images.halfBlink.src = marcusHalfBlink;
    images.blink.src = marcusBlink;

    Object.values(images).forEach((img) => {
      if ('decode' in img) {
        img.decode().catch(() => {});
      }
    });

    let animId: number;
    let startTime = performance.now();

    // Cache destination rectangle on resize (NEVER query DOM inside animation loop)
    let drawX = 0;
    let drawY = 0;
    let drawW = 960;
    let drawH = 540;

    const updateSize = (w: number, h: number) => {
      if (!w || !h) return;
      // Cap buffer resolution to 1280x720 max for silky 60 FPS throughput
      const maxW = 1280;
      let targetW = Math.round(w);
      let targetH = Math.round(h);
      if (targetW > maxW) {
        targetH = Math.round((targetH * maxW) / targetW);
        targetW = maxW;
      }
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }

      const imgAspect = 16 / 9;
      const canvasAspect = targetW / targetH;
      if (canvasAspect > imgAspect) {
        drawW = targetW;
        drawH = Math.round(targetW / imgAspect);
      } else {
        drawH = targetH;
        drawW = Math.round(targetH * imgAspect);
      }
      drawX = Math.round((targetW - drawW) / 2);
      drawY = Math.round((targetH - drawH) / 2);
    };

    // Initialize dimensions once
    updateSize(container.clientWidth || 960, container.clientHeight || 540);

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        updateSize(width, height);
      }
    });
    resizeObserver.observe(container);

    // Blinking variables
    let isBlinking = false;
    let blinkStartTime = 0;
    let nextBlinkTime = performance.now() + 3200;
    const BLINK_DURATION = 140; // 140ms crisp human blink

    const render = (now: number) => {
      animId = requestAnimationFrame(render);
      const elapsed = (now - startTime) / 1000;

      const isSpeaking = speakingRef.current;
      const isListening = listeningRef.current && !isSpeaking;
      const isThinking = thinkingRef.current && !isSpeaking;

      // Eye blink scheduler
      if (!isBlinking && now >= nextBlinkTime && !isSpeaking) {
        isBlinking = true;
        blinkStartTime = now;
      }

      let activeBlinkImg: HTMLImageElement | null = null;
      if (isBlinking) {
        const blinkElapsed = now - blinkStartTime;
        if (blinkElapsed >= BLINK_DURATION) {
          isBlinking = false;
          nextBlinkTime = now + Math.random() * 2400 + 3500;
        } else if (blinkElapsed >= 35 && blinkElapsed < 95) {
          activeBlinkImg = images.blink;
        } else if (blinkElapsed < 135) {
          activeBlinkImg = images.halfBlink;
        }
      }

      // Fast single-pass keyframe selection (Zero multi-layer CPU fill rate lag)
      let primaryImg = images.idle;

      if (activeBlinkImg && activeBlinkImg.complete) {
        primaryImg = activeBlinkImg;
      } else if (isSpeaking) {
        const currentViseme = visemeRef.current;
        const wave = Math.sin(elapsed * 12.0);

        if (wave > 0.45) {
          if (currentViseme === 'oh' || currentViseme === 'oo') {
            primaryImg = images.rounded.complete ? images.rounded : images.speaking;
          } else if (Math.sin(elapsed * 4.2) > 0.2 && images.speechAccent.complete) {
            primaryImg = images.speechAccent;
          } else {
            primaryImg = images.speaking.complete ? images.speaking : images.parted;
          }
        } else if (wave > -0.2) {
          primaryImg = images.parted.complete ? images.parted : images.idle;
        } else {
          primaryImg = images.idle;
        }
      } else if (isThinking && images.thinking.complete) {
        primaryImg = images.thinking;
      } else if (isListening && images.listening.complete) {
        primaryImg = images.listening;
      }

      // Single hardware draw call per frame
      if (primaryImg && primaryImg.complete && primaryImg.naturalWidth > 0) {
        ctx.drawImage(primaryImg, drawX, drawY, drawW, drawH);
      }
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden select-none bg-slate-950 font-sans ${className}`}
    >
      {/* Hardware-Accelerated Video Stream Canvas (Rock-solid fixed positioning, 0 layout thrashing) */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full object-cover object-center"
        style={{
          transform: 'translate3d(0, 0, 0)',
          backfaceVisibility: 'hidden',
        }}
      />

      {/* Subtle Cinematic Edge Vignette */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-black/20" />

      {/* Top Left: Executive Google Meet / Zoom Conference Pill */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2.5 rounded-full bg-black/60 border border-white/15 px-3.5 py-1.5 backdrop-blur-md shadow-lg">
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
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
          <span className="font-medium text-slate-200">
            {speaking ? 'Interviewer Speaking' : listening ? 'Listening Attentively' : 'Ready for Answer'}
          </span>
        </div>
      </div>
    </div>
  );
};
