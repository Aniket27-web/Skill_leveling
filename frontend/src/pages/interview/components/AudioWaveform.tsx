import React, { useEffect, useState } from 'react';

type AudioWaveformProps = { active: boolean; deviceId?: string; barCount?: number };

export const AudioWaveform: React.FC<AudioWaveformProps> = ({ active, deviceId = '', barCount = 32 }) => {
  const [levels, setLevels] = useState<number[]>(() => Array.from({ length: barCount }, () => 0.08));
  const [error, setError] = useState('');

  useEffect(() => {
    if (!active) {
      setLevels(Array.from({ length: barCount }, () => 0.08));
      return;
    }
    let stream: MediaStream | undefined;
    let context: AudioContext | undefined;
    let frame = 0;
    let cancelled = false;

    const start = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: deviceId ? { deviceId: { exact: deviceId } } : true });
        if (cancelled) { stream.getTracks().forEach((track) => track.stop()); return; }
        context = new AudioContext();
        const source = context.createMediaStreamSource(stream);
        const analyser = context.createAnalyser();
        analyser.fftSize = 128;
        source.connect(analyser);
        const samples = new Uint8Array(analyser.frequencyBinCount);
        const update = () => {
          analyser.getByteTimeDomainData(samples);
          const bars = Array.from({ length: barCount }, (_, index) => {
            const sample = samples[Math.floor(index * samples.length / barCount)] || 128;
            return Math.max(0.08, Math.min(1, Math.abs(sample - 128) / 40));
          });
          setLevels(bars);
          frame = requestAnimationFrame(update);
        };
        update();
        setError('');
      } catch {
        setError('Microphone level visualization is unavailable. Check microphone permission.');
      }
    };
    void start();
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((track) => track.stop());
      void context?.close();
    };
  }, [active, deviceId, barCount]);

  return <div aria-label={active ? 'Live microphone waveform' : 'Microphone idle'} className="flex h-12 items-center justify-center gap-1" role="img">{levels.map((level, index) => <span key={index} className={`w-1.5 rounded-full transition-[height] duration-75 ${active ? 'bg-blue-500' : 'bg-slate-300'}`} style={{ height: `${Math.max(4, level * 44)}px` }} />)}{error && <span className="sr-only">{error}</span>}</div>;
};
