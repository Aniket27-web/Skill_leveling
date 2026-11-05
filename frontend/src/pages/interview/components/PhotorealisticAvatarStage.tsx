import React, { useEffect, useRef } from 'react';

// Dynamically import all 97 HD interviewer video animation frames
const frameModules = import.meta.glob<{ default: string }>(
  '../../../assests/Inteviewer/scene*.png',
  { eager: true }
);

// Sort frames numerically in exact sequence: scene00001.png -> scene00193.png (97 frames total)
const FRAME_URLS: string[] = Object.entries(frameModules)
  .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
  .map(([_, mod]) => mod.default);

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

  // Live state refs to feed animation loop without causing React re-renders
  const speakingRef = useRef(speaking);
  speakingRef.current = speaking;
  const listeningRef = useRef(listening);
  listeningRef.current = listening;
  const thinkingRef = useRef(isThinking);
  thinkingRef.current = isThinking;
  const visemeRef = useRef(viseme);
  visemeRef.current = viseme;

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || FRAME_URLS.length === 0) return;

    const ctx = canvas.getContext('2d', {
      alpha: false,
      desynchronized: true,
    });
    if (!ctx) return;

    // Preload & decode all 97 frames into hardware memory
    const images: HTMLImageElement[] = FRAME_URLS.map((url) => {
      const img = new Image();
      img.src = url;
      if ('decode' in img) {
        img.decode().catch(() => {});
      }
      return img;
    });

    let animId: number;
    const totalFrames = images.length; // 97 frames

    // Caching aspect-fit destination rectangle (Never query DOM inside render loop)
    let drawX = 0;
    let drawY = 0;
    let drawW = 1280;
    let drawH = 720;

    const updateSize = (w: number, h: number) => {
      if (!w || !h) return;
      const maxW = 1920;
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

      const imgAspect = 16 / 9; // 1280x720 is 16:9
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

    updateSize(container.clientWidth || 1280, container.clientHeight || 720);

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        updateSize(width, height);
      }
    });
    resizeObserver.observe(container);

    // Precise 25.0 FPS playback timing (40.0 ms per frame) locked as requested
    const TARGET_FPS = 25;
    const FRAME_INTERVAL_MS = 1000 / TARGET_FPS; // 40.0 ms
    const LISTENING_FRAME_INTERVAL_MS = 400;

    let lastFrameTime = performance.now();
    let lastListeningFrameTime = lastFrameTime;
    let currentSpeechFrame = 30; // Start of speaking articulation
    let speechDir = 1;
    let listeningMicroFrame = 0;
    let microDir = 1;

    // Natural eye blinking scheduler for listening & idle
    let isBlinking = false;
    let blinkStartTime = 0;
    let nextBlinkTime = performance.now() + 2500;
    const BLINK_DURATION_MS = 160; // 160ms natural human blink

    const render = (now: number) => {
      animId = requestAnimationFrame(render);

      const isSpeaking = speakingRef.current;
      const isListening = listeningRef.current && !isSpeaking;
      const isThinking = thinkingRef.current && !isSpeaking;

      // Eye blink scheduler (active during listening, idle, and thinking)
      if (!isSpeaking) {
        if (!isBlinking && now >= nextBlinkTime) {
          isBlinking = true;
          blinkStartTime = now;
        }
        if (isBlinking && now - blinkStartTime >= BLINK_DURATION_MS) {
          isBlinking = false;
          // Schedule next natural blink in 2.8 to 4.5 seconds
          nextBlinkTime = now + Math.random() * 1700 + 2800;
        }
      } else {
        isBlinking = false;
      }

      // Keep speech motion smooth while easing the source video down to 15 FPS.
      const elapsed = now - lastFrameTime;
      if (elapsed >= FRAME_INTERVAL_MS) {
        const steps = Math.floor(elapsed / FRAME_INTERVAL_MS);
        lastFrameTime = now - (elapsed % FRAME_INTERVAL_MS);

        if (isSpeaking) {
          // Slow the source clip while cycling through its speaking frames.
          currentSpeechFrame += speechDir * steps;
          if (currentSpeechFrame >= totalFrames - 1) {
            currentSpeechFrame = totalFrames - 1;
            speechDir = -1;
          } else if (currentSpeechFrame <= 30) {
            currentSpeechFrame = 30;
            speechDir = 1;
          }
        }
      }

      if (isSpeaking) {
        lastListeningFrameTime = now;
      } else if (now - lastListeningFrameTime >= LISTENING_FRAME_INTERVAL_MS) {
        lastListeningFrameTime = now;
        // Gentle listening micro-motion across the three attentive frames.
        listeningMicroFrame += microDir;
        if (listeningMicroFrame >= 2) {
          listeningMicroFrame = 2;
          microDir = -1;
        } else if (listeningMicroFrame <= 0) {
          listeningMicroFrame = 0;
          microDir = 1;
        }
      }

      let activeIndex = 0;

      if (isSpeaking) {
        // Speaking: mouth articulates at 15 FPS.
        activeIndex = currentSpeechFrame;
      } else if (isBlinking) {
        // Natural blink sequence while listening with mouth shut & warm smile:
        // Frame 18 (scene00037.png): closing
        // Frame 19 (scene00039.png): closed blink
        // Frame 20 (scene00041.png): opening
        const blinkProgress = now - blinkStartTime;
        if (blinkProgress < 40) {
          activeIndex = 18;
        } else if (blinkProgress < 120) {
          activeIndex = 19;
        } else {
          activeIndex = 20;
        }
      } else if (isListening) {
        // When listening to user: shut mouth, warm attentive smile, subtle micro-motion
        activeIndex = Math.max(0, Math.min(2, listeningMicroFrame));
      } else if (isThinking) {
        // When evaluating: shut mouth, attentive focused expression
        activeIndex = 0;
      } else {
        // Idle ready state: shut mouth, warm welcoming smile
        activeIndex = Math.max(0, Math.min(2, listeningMicroFrame));
      }

      const clampedIndex = Math.max(0, Math.min(totalFrames - 1, activeIndex));
      const activeImg = images[clampedIndex] || images[0];

      // Draw on each display refresh while advancing source frames at 15 FPS.
      if (activeImg && activeImg.complete && activeImg.naturalWidth > 0) {
        ctx.drawImage(activeImg, drawX, drawY, drawW, drawH);
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

      {/* Top Left: Executive Conference Pill */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2.5 rounded-full bg-black/75 border border-purple-400/45 px-3.5 py-1.5 backdrop-blur-md shadow-[0_0_0_1px_rgba(0,0,0,0.9),0_4px_18px_rgba(0,0,0,0.45)]">
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
        <span className="text-xs font-semibold text-white tracking-wide">{interviewerName}</span>
      </div>

      {/* Bottom Left: State & Audio Visualizer Badge */}
      <div className="absolute bottom-4 left-4 z-10 flex items-center gap-3 rounded-full bg-black/85 border border-purple-400/40 px-4 py-2 backdrop-blur-md shadow-[0_0_0_1px_rgba(0,0,0,0.95),0_8px_24px_rgba(0,0,0,0.5)] text-xs text-white">
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
