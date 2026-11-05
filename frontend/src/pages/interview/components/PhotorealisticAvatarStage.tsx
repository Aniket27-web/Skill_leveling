import React, { useEffect, useRef, useState, useMemo } from 'react';
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

  // 60 FPS Locked, Rock-Solid Camera Engine (Zero Shaking, Multi-Action Morphing)
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d', {
      alpha: false,
      desynchronized: true, // Lowest latency direct-to-screen hardware compositor
    });
    if (!ctx) return;

    // Load and decode all 9 photorealistic keyframes into GPU memory
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
    let lastTime = performance.now();
    let startTime = performance.now();

    // Continuous 60 FPS interpolation weights (smooth 0.0 to 1.0 lerp)
    let speechWeight = 0;
    let listeningWeight = 0;
    let thinkingWeight = 0;
    let blinkProgress = 0;
    let isBlinking = false;
    let nextBlinkTime = performance.now() + 3200;
    let blinkStartTime = 0;
    const BLINK_DURATION = 160; // 160ms organic human blink cycle

    const render = (now: number) => {
      animId = requestAnimationFrame(render);

      const delta = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;
      const elapsed = (now - startTime) / 1000;

      // Responsive canvas buffer sizing (match physical container pixels)
      const rect = container.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const targetWidth = Math.round(rect.width * dpr);
      const targetHeight = Math.round(rect.height * dpr);

      if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
        canvas.width = targetWidth;
        canvas.height = targetHeight;
      }

      // Target pose weights (smooth 60 FPS convergence)
      const targetListening = listeningRef.current && !speakingRef.current ? 1.0 : 0.0;
      const targetThinking = thinkingRef.current && !speakingRef.current ? 1.0 : 0.0;
      listeningWeight += (targetListening - listeningWeight) * 0.15;
      thinkingWeight += (targetThinking - thinkingWeight) * 0.15;

      // Speech openness calculation (multi-frequency harmonic vowel rhythm at 60 FPS)
      if (speakingRef.current) {
        const targetOpen =
          (Math.sin(elapsed * 14.5) * 0.48 + 0.52) *
          (Math.cos(elapsed * 7.8) * 0.35 + 0.65);
        speechWeight += (targetOpen - speechWeight) * 0.28;
      } else {
        speechWeight += (0 - speechWeight) * 0.22;
      }

      // Continuous Eye Blink Envelope Calculation (60 FPS smooth arc)
      if (!isBlinking && now >= nextBlinkTime && !speakingRef.current) {
        isBlinking = true;
        blinkStartTime = now;
      }

      if (isBlinking) {
        const blinkElapsed = now - blinkStartTime;
        if (blinkElapsed >= BLINK_DURATION) {
          isBlinking = false;
          blinkProgress = 0;
          nextBlinkTime = now + Math.random() * 2400 + 3200;
        } else {
          // Smooth sinusoidal eyelid curve (0 -> 1 -> 0)
          const t = blinkElapsed / BLINK_DURATION;
          blinkProgress = Math.sin(t * Math.PI);
        }
      } else {
        blinkProgress = 0;
      }

      // Hardware Accelerated Render (Rock-Solid Camera Position - NO shaking)
      ctx.save();
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      const baseImg = images.idle;
      if (!baseImg.complete || baseImg.naturalWidth === 0) {
        ctx.restore();
        return;
      }

      // Fixed, perfectly centered "object-cover" destination rect (ZERO wobble)
      const imgAspect = baseImg.naturalWidth / baseImg.naturalHeight;
      const canvasAspect = canvas.width / canvas.height;
      let drawW: number;
      let drawH: number;

      if (canvasAspect > imgAspect) {
        drawW = canvas.width;
        drawH = canvas.width / imgAspect;
      } else {
        drawH = canvas.height;
        drawW = canvas.height * imgAspect;
      }
      const drawX = Math.round((canvas.width - drawW) / 2);
      const drawY = Math.round((canvas.height - drawH) / 2);

      // 1. Draw Base Photorealistic Image (Rock-solid anchor in modern executive office)
      ctx.globalAlpha = 1.0;
      ctx.drawImage(baseImg, drawX, drawY, drawW, drawH);

      // 2. Action Pose: Thinking & Evaluating (Subtle contemplative head tilt)
      if (thinkingWeight > 0.02 && images.thinking.complete) {
        ctx.globalAlpha = Math.min(thinkingWeight, 1.0);
        ctx.drawImage(images.thinking, drawX, drawY, drawW, drawH);
      }

      // 3. Action Pose: Attentive Listening (Warm professional smile acknowledging candidate)
      if (listeningWeight > 0.02 && images.listening.complete) {
        ctx.globalAlpha = Math.min(listeningWeight, 1.0);
        ctx.drawImage(images.listening, drawX, drawY, drawW, drawH);
      }

      // 4. 60 FPS Continuous Speech Articulation (Blends Parted -> Speaking/Accent/Rounded)
      if (speechWeight > 0.04) {
        const currentViseme = visemeRef.current;

        // Choose appropriate phoneme frame
        let activeSpeechImg = images.speaking;
        if (currentViseme === 'oh' || currentViseme === 'oo') {
          activeSpeechImg = images.rounded;
        } else if (Math.sin(elapsed * 4.5) > 0.3) {
          activeSpeechImg = images.speechAccent; // Alternates natural conversational emphasis
        }

        if (speechWeight <= 0.48) {
          // Intermediate transition: blend smoothly between Idle and Parted
          if (images.parted.complete) {
            ctx.globalAlpha = Math.min((speechWeight - 0.04) / 0.44, 1.0);
            ctx.drawImage(images.parted, drawX, drawY, drawW, drawH);
          }
        } else {
          // Full speech articulation: blend smoothly between Parted and Active Phoneme
          const openAlpha = Math.min((speechWeight - 0.48) / 0.52, 1.0);
          if (images.parted.complete) {
            ctx.globalAlpha = 1.0 - openAlpha;
            ctx.drawImage(images.parted, drawX, drawY, drawW, drawH);
          }
          if (activeSpeechImg.complete) {
            ctx.globalAlpha = openAlpha;
            ctx.drawImage(activeSpeechImg, drawX, drawY, drawW, drawH);
          }
        }
      }

      // 5. 60 FPS Natural 3-Stage Opaque Eyelid Blink (No translucent bleed-through)
      if (isBlinking && !speakingRef.current) {
        const blinkElapsed = now - blinkStartTime;
        ctx.globalAlpha = 1.0;
        if (blinkElapsed >= 35 && blinkElapsed < 95) {
          if (images.blink.complete) {
            ctx.drawImage(images.blink, drawX, drawY, drawW, drawH);
          }
        } else if (blinkElapsed < 135) {
          if (images.halfBlink.complete) {
            ctx.drawImage(images.halfBlink, drawX, drawY, drawW, drawH);
          }
        }
      }

      ctx.restore();
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden select-none bg-slate-950 font-sans ${className}`}
    >
      {/* Hardware-Accelerated Video Stream Canvas (Rock-solid fixed positioning) */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full object-cover object-center"
        style={{
          willChange: 'transform',
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
          <span className="font-medium text-slate-200">{speaking ? 'Interviewer Speaking' : listening ? 'Listening Attentively' : 'Ready for Answer'}</span>
        </div>
      </div>
    </div>
  );
};
