import React, { useState, useEffect } from 'react';
import { Quote, Sparkles, RefreshCw, Flame, Award } from 'lucide-react';

export interface MotivationalQuote {
  id: number;
  text: string;
  author: string;
  source: string;
  tag: 'Solo Leveling' | 'Philosophy' | 'Resilience';
}

const QUOTES: MotivationalQuote[] = [
  {
    id: 1,
    text: "I used to be the weakest hunter of all mankind. But I never gave up on surviving and growing stronger. Arise.",
    author: "Sung Jin-woo",
    source: "Solo Leveling (Chugong)",
    tag: "Solo Leveling",
  },
  {
    id: 2,
    text: "The pain of discipline is temporary, but the regret of quitting lasts forever. Keep grinding, keep leveling.",
    author: "Sung Jin-woo",
    source: "Shadow Monarch · Solo Leveling",
    tag: "Solo Leveling",
  },
  {
    id: 3,
    text: "He who has a why to live can bear almost any how.",
    author: "Friedrich Nietzsche",
    source: "Twilight of the Idols",
    tag: "Philosophy",
  },
  {
    id: 4,
    text: "You have power over your mind — not outside events. Realize this, and you will find unbreakable strength.",
    author: "Marcus Aurelius",
    source: "Meditations",
    tag: "Philosophy",
  },
  {
    id: 5,
    text: "Courage isn't the absence of fear, but the triumph over it. Even in the darkest dungeon, push forward.",
    author: "Chugong",
    source: "Creator of Solo Leveling",
    tag: "Solo Leveling",
  },
  {
    id: 6,
    text: "The impediment to action advances action. What stands in the way becomes the way.",
    author: "Marcus Aurelius",
    source: "Roman Emperor & Stoic Philosopher",
    tag: "Philosophy",
  },
  {
    id: 7,
    text: "I will become stronger. Stronger than anyone else, so that I will never be helpless again.",
    author: "Sung Jin-woo",
    source: "Solo Leveling",
    tag: "Solo Leveling",
  },
  {
    id: 8,
    text: "It does not matter how slowly you go as long as you do not stop.",
    author: "Confucius",
    source: "Analects of Confucius",
    tag: "Resilience",
  },
  {
    id: 9,
    text: "Do not pray for an easy life, pray for the strength to endure a difficult one.",
    author: "Bruce Lee",
    source: "Martial Artist & Philosopher",
    tag: "Resilience",
  },
  {
    id: 10,
    text: "Limits exist only for those who accept them. Every dungeon cleared is proof you can surpass yourself.",
    author: "Sung Jin-woo",
    source: "Monarch of Shadows · Solo Leveling",
    tag: "Solo Leveling",
  },
];

export const MotivationalQuotesCard: React.FC = () => {
  const [index, setIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  // Auto-rotate quotes every 12 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      handleNextQuote();
    }, 12000);
    return () => clearInterval(timer);
  }, [index]);

  const handleNextQuote = () => {
    setIsAnimating(true);
    setTimeout(() => {
      setIndex((prev) => (prev + 1) % QUOTES.length);
      setIsAnimating(false);
    }, 200);
  };

  const current = QUOTES[index];

  return (
    <div className="relative overflow-hidden rounded-3xl border border-purple-500/40 bg-gradient-to-r from-purple-950/80 via-[#120826] to-indigo-950/80 p-6 shadow-2xl backdrop-blur-md">
      {/* Background magical ambient glow */}
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-purple-600/20 blur-3xl" />
      <div className="pointer-events-none absolute -left-16 -bottom-16 h-48 w-48 rounded-full bg-indigo-600/20 blur-3xl" />

      <div className="relative z-10 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-purple-600/30 border border-purple-400/40 text-purple-300 shadow-[0_0_15px_rgba(147,51,234,0.4)]">
            <Flame className="h-5 w-5 text-amber-400 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] font-black uppercase tracking-wider text-purple-300">
                Hunter Willpower Surge
              </span>
              <span className="rounded-full bg-purple-500/20 border border-purple-400/30 px-2 py-0.5 text-[10px] font-bold text-purple-200">
                {current.tag}
              </span>
            </div>
            <p className="text-xs text-purple-300/70">Daily motivation to conquer technical interview dungeons</p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleNextQuote}
          title="Inspire with next quote"
          className="inline-flex items-center gap-1.5 self-start sm:self-auto rounded-xl border border-purple-400/30 bg-purple-900/40 px-3 py-1.5 text-xs font-semibold text-purple-200 hover:bg-purple-800/50 hover:text-white transition shadow-sm"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isAnimating ? 'animate-spin' : ''}`} />
          <span>Next Quote</span>
        </button>
      </div>

      <div className="relative mt-4 pt-3 border-t border-purple-500/20">
        <Quote className="absolute -top-2 left-0 h-8 w-8 text-purple-500/20 -translate-y-1/2 select-none pointer-events-none" />
        <div className={`transition-opacity duration-200 ${isAnimating ? 'opacity-0' : 'opacity-100'}`}>
          <blockquote className="text-base sm:text-lg font-medium leading-relaxed text-slate-100 italic pl-4 border-l-2 border-purple-500/60">
            "{current.text}"
          </blockquote>
          <div className="mt-3 pl-4 flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold text-amber-300 flex items-center gap-1.5">
              <Award className="h-4 w-4 text-amber-400" />
              {current.author}
            </span>
            <span className="text-xs font-mono text-purple-300/60">· {current.source}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

