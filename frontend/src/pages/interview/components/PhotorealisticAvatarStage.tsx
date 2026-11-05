import React, { useEffect, useRef } from 'react';

// Dynamically import all 97 labeled interviewer video animation frames
const frameModules = import.meta.glob<{ default: string }>(
    '../../../assests/Inteviewer/marcus_*.png',
    { eager: true }
);

// Sort all frame URLs numerically: marcus_001 -> marcus_097
const sortedEntries = Object.entries(frameModules).sort(([a], [b]) =>
    a.localeCompare(b, undefined, { numeric: true })
);

const FRAME_URLS: string[] = sortedEntries.map(([_, mod]) => mod.default);

// 1. Robust Speech Frames: all speech bursts and transitions (53 frames total)
const SPEECH_INDICES: number[] = sortedEntries
    .map(([path], idx) => ({ path, idx }))
    .filter(({ path }) => path.includes('speech'))
    .map(({ idx }) => idx);

// 2. Closing Smile Frames: the ten open-eye, closed-mouth listening poses.
const CLOSING_SMILE_INDICES: number[] = sortedEntries
    .map(([path], idx) => ({ path, idx }))
    .filter(({ path }) => path.includes('closing-smile'))
    .map(({ idx }) => idx);

// 3. Blink-only frames are reserved for idle blinks, never shown while listening.
const BLINK_INDICES: number[] = sortedEntries
    .map(([path], idx) => ({ path, idx }))
    .filter(({ path }) => path.includes('blink-pause') || path.includes('closing-blink'))
    .map(({ idx }) => idx);

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

        // Preload & decode all 97 labeled frames into hardware memory
        const images: HTMLImageElement[] = FRAME_URLS.map((url) => {
            const img = new Image();
            img.src = url;
            if ('decode' in img) {
                img.decode().catch(() => { });
            }
            return img;
        });

        let animId: number;
        const totalFrames = images.length;

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

        // Slow the speech reel to 10 FPS for more relaxed mouth movement.
        const TARGET_FPS = 9;
        const FRAME_INTERVAL_MS = 1000 / TARGET_FPS;
        // A 200 ms step slows the listening smile reel to five frames per second.
        const LISTENING_STEP_MS = 200;

        let lastFrameTime = performance.now();
        let lastSmileStepTime = performance.now();
        let speechCursor = 0;
        let smileCursor = 0;
        let wasSpeaking = false;
        let wasListening = false;

        // Natural eye blinks are only used in idle/thinking states. Listening plays
        // the closing-smile frames, which are kept separate from blink-only frames.
        let isBlinking = false;
        let blinkStartTime = 0;
        let nextBlinkTime = performance.now() + 2500;
        const BLINK_DURATION_MS = 200; // 160ms organic human blink cycle

        const render = (now: number) => {
            animId = requestAnimationFrame(render);

            const isSpeaking = speakingRef.current;
            const isListening = listeningRef.current && !isSpeaking;
            const isThinking = thinkingRef.current && !isSpeaking;

            // Handle speech state changes
            if (isSpeaking && !wasSpeaking) {
                // Start articulating forward through robust speech sequence
                speechCursor = 0;
                lastFrameTime = now;
                isBlinking = false;
            } else if (!isSpeaking && wasSpeaking) {
                // Reset to beginning of closing smile when user starts speaking
                smileCursor = 0;
                lastSmileStepTime = now;
                nextBlinkTime = now + 2000 + Math.random() * 1600;
            }
            wasSpeaking = isSpeaking;

            if (isListening && !wasListening) {
                smileCursor = 0;
                lastSmileStepTime = now;
                isBlinking = false;
            }
            wasListening = isListening;

            // Eye blink scheduler (active only during idle and thinking)
            if (!isSpeaking && !isListening) {
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

            // Advance the speech reel at the slower 10 FPS cadence.
            const elapsed = now - lastFrameTime;
            if (elapsed >= FRAME_INTERVAL_MS) {
                const steps = Math.floor(elapsed / FRAME_INTERVAL_MS);
                lastFrameTime = now - (elapsed % FRAME_INTERVAL_MS);

                if (isSpeaking && SPEECH_INDICES.length > 0) {
                    // Play the speech frames forward at 10 FPS.
                    speechCursor = (speechCursor + steps) % SPEECH_INDICES.length;
                }
            }

            // While listening, use only the named closing-smile frames in forward order.
            if (isListening && CLOSING_SMILE_INDICES.length > 0) {
                const smileElapsed = now - lastSmileStepTime;
                if (smileElapsed >= LISTENING_STEP_MS) {
                    const steps = Math.floor(smileElapsed / LISTENING_STEP_MS);
                    lastSmileStepTime += steps * LISTENING_STEP_MS;
                    smileCursor = (smileCursor + steps) % CLOSING_SMILE_INDICES.length;
                }
            }

            let activeIndex = 0;

            if (isSpeaking && SPEECH_INDICES.length > 0) {
                // When interviewer is speaking: use robust speech articulation (53 frames)
                activeIndex = SPEECH_INDICES[speechCursor] ?? SPEECH_INDICES[0];
            } else if (isListening && CLOSING_SMILE_INDICES.length > 0) {
                // Listening never switches to speech, neutral, or blink-pause frames.
                activeIndex = CLOSING_SMILE_INDICES[smileCursor] ?? CLOSING_SMILE_INDICES[0];
            } else if (isBlinking && BLINK_INDICES.length >= 3) {
                // When blinking: natural 3-stage human blink (closing -> closed -> opening)
                const blinkProgress = now - blinkStartTime;
                if (blinkProgress < 45) {
                    activeIndex = BLINK_INDICES[0]; // marcus_020_blink-pause-1
                } else if (blinkProgress < 115) {
                    activeIndex = BLINK_INDICES[1]; // marcus_021_blink-pause-1 (closed)
                } else {
                    activeIndex = BLINK_INDICES[2]; // marcus_022_blink-pause-1 (opening)
                }
            } else if (CLOSING_SMILE_INDICES.length > 0) {
                // Idle and thinking hold a calm smile; only listening animates the smile reel.
                activeIndex = CLOSING_SMILE_INDICES[0];
            } else {
                activeIndex = 0;
            }

            const clampedIndex = Math.max(0, Math.min(totalFrames - 1, activeIndex));
            const activeImg = images[clampedIndex] || images[0];

            // Single hardware draw call per display frame.
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
