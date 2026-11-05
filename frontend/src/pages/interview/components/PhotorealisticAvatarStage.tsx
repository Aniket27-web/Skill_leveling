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

  // Live state refs to feed 60 FPS animation loop without causing React re-renders
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

    // Caching aspect-fit destination rectangle (Never query DOM inside requestAnimationFrame)
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

    let speakingFrameFloat = 40.0;
    let speechDirection = 1;
    let listeningFloat = 0.0;
    let listeningDir = 1;
    let idleFloat = 0.0;
    let idleDir = 1;
    let lastTime = performance.now();

    const render = (now: number) => {
      animId = requestAnimationFrame(render);
      const dt = Math.min((now - lastTime) / 1000, 0.1); // Clamp delta time to 100ms
      lastTime = now;

      const isSpeaking = speakingRef.current;
      const isListening = listeningRef.current && !isSpeaking;
      const isThinking = thinkingRef.current && !isSpeaking;

      let selectedIndex = 0;

      if (isSpeaking) {
        // When speaking: Animate naturally through speech-articulating frames (frames 30 to 96)
        // at 24 FPS with smooth ping-pong cycling
        const speechMin = 30;
        const speechMax = totalFrames - 1; // 96
        const fps = 24.0;

        speakingFrameFloat += speechDirection * (fps * dt);
        if (speakingFrameFloat >= speechMax) {
          speakingFrameFloat = speechMax;
          speechDirection = -1;
        } else if (speakingFrameFloat <= speechMin) {
          speakingFrameFloat = speechMin;
          speechDirection = 1;
        }

        selectedIndex = Math.round(speakingFrameFloat);
      } else if (isListening) {
        // When listening: Attentive engagement loop across frames 0 to 35 at 14 FPS
        // Subtle forward posture and micro-nods
        const listenMin = 0;
        const listenMax = Math.min(36, totalFrames - 1);
        const fps = 14.0;

        listeningFloat += listeningDir * (fps * dt);
        if (listeningFloat >= listenMax) {
          listeningFloat = listenMax;
          listeningDir = -1;
        } else if (listeningFloat <= listenMin) {
          listeningFloat = listenMin;
          listeningDir = 1;
        }

        selectedIndex = Math.round(listeningFloat);
      } else if (isThinking) {
        // When thinking / evaluating: Pensive frames in range 15 to 45 at 12 FPS
        const thinkMin = 15;
        const thinkMax = Math.min(48, totalFrames - 1);
        const fps = 12.0;

        listeningFloat += listeningDir * (fps * dt);
        if (listeningFloat >= thinkMax) {
          listeningFloat = thinkMax;
          listeningDir = -1;
        } else if (listeningFloat <= thinkMin) {
          listeningFloat = thinkMin;
          listeningDir = 1;
        }

        selectedIndex = Math.round(listeningFloat);
      } else {
        // Idle resting state: gentle human presence micro-motion (frames 0 to 18) at 10 FPS
        const idleMin = 0;
        const idleMax = Math.min(20, totalFrames - 1);
        const fps = 10.0;

        idleFloat += idleDir * (fps * dt);
        if (idleFloat >= idleMax) {
          idleFloat = idleMax;
          idleDir = -1;
        } else if (idleFloat <= idleMin) {
          idleFloat = idleMin;
          idleDir = 1;
        }

        selectedIndex = Math.round(idleFloat);
      }

      // Safe bounds clamp
      selectedIndex = Math.max(0, Math.min(totalFrames - 1, selectedIndex));
      const activeImg = images[selectedIndex] || images[0];

      // Draw the active video keyframe onto hardware canvas
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
