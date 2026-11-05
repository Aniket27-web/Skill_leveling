import React, { useState, useEffect } from 'react';
import { Quote, RefreshCw, Flame, Award } from 'lucide-react';

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
    text: "Life is a game, and everyone plays it alone; in the end, your strength is your only true companion.",
    author: "Developer",
    source: "System Core Directive",
    tag: "Resilience",
  },
  {
    id: 2,
    text: "I used to be the weakest hunter of all mankind. But I never gave up on surviving and growing stronger. Arise.",
    author: "Sung Jin-woo",
    source: "Solo Leveling (Chugong)",
    tag: "Solo Leveling",
  },
  {
    id: 3,
    text: "The pain of discipline is temporary, but the regret of quitting lasts forever. Keep grinding, keep leveling.",
    author: "Sung Jin-woo",
    source: "Shadow Monarch · Solo Leveling",
    tag: "Solo Leveling",
  },
  {
    id: 4,
    text: "He who has a why to live can bear almost any how.",
    author: "Friedrich Nietzsche",
    source: "Twilight of the Idols",
    tag: "Philosophy",
  },
  {
    id: 5,
    text: "You have power over your mind — not outside events. Realize this, and you will find unbreakable strength.",
    author: "Marcus Aurelius",
    source: "Meditations",
    tag: "Philosophy",
  },
  {
    id: 6,
    text: "Courage isn't the absence of fear, but the triumph over it. Even in the darkest dungeon, push forward.",
    author: "Chugong",
    source: "Creator of Solo Leveling",
    tag: "Solo Leveling",
  },
  {
    id: 7,
    text: "The impediment to action advances action. What stands in the way becomes the way.",
    author: "Marcus Aurelius",
    source: "Roman Emperor & Stoic Philosopher",
    tag: "Philosophy",
  },
  {
    id: 8,
    text: "I will become stronger. Stronger than anyone else, so that I will never be helpless again.",
    author: "Sung Jin-woo",
    source: "Solo Leveling",
    tag: "Solo Leveling",
  },
  {
    id: 9,
    text: "It does not matter how slowly you go as long as you do not stop.",
    author: "Confucius",
    source: "Analects of Confucius",
    tag: "Resilience",
  },
  {
    id: 10,
    text: "Do not pray for an easy life, pray for the strength to endure a difficult one.",
    author: "Bruce Lee",
    source: "Martial Artist & Philosopher",
    tag: "Resilience",
  },
  {
    id: 11,
    text: "Limits exist only for those who accept them. Every dungeon cleared is proof you can surpass yourself.",
    author: "Sung Jin-woo",
    source: "Monarch of Shadows · Solo Leveling",
    tag: "Solo Leveling",
  },
];

export const MotivationalQuotesCard: React.FC = () => {
  const [index, setIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  // Auto-rotate quotes every 20 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      handleNextQuote();
    }, 20000);
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
    <div className="relative overflow-hidden rounded-3xl border border-purple-200/90 bg-gradient-to-r from-purple-50/80 via-white to-indigo-50/60 p-6 shadow-md backdrop-blur-md transition-all duration-300 dark:border-purple-500/35 dark:bg-gradient-to-r dark:from-purple-950/80 dark:via-[#120826] dark:to-indigo-950/80 dark:shadow-2xl">
      {/* Background magical ambient glow */}
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-purple-400/15 blur-3xl dark:bg-purple-600/20" />
      <div className="pointer-events-none absolute -left-16 -bottom-16 h-48 w-48 rounded-full bg-indigo-400/15 blur-3xl dark:bg-indigo-600/20" />

      <div className="relative z-10 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-purple-100 border border-purple-300 text-purple-700 shadow-sm dark:bg-purple-600/30 dark:border-purple-400/40 dark:text-purple-300 dark:shadow-[0_0_15px_rgba(147,51,234,0.4)]">
            <Flame className="h-5 w-5 text-amber-500 dark:text-amber-400 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] font-black uppercase tracking-wider text-purple-900 dark:text-purple-300">
                Hunter Willpower Surge
              </span>
              <span className="rounded-full bg-purple-100 border border-purple-200 px-2 py-0.5 text-[10px] font-bold text-purple-700 dark:bg-purple-500/20 dark:border-purple-400/30 dark:text-purple-200">
                {current.tag}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-purple-300/70">Daily motivation to conquer technical interview dungeons</p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleNextQuote}
          title="Inspire with next quote"
          className="inline-flex items-center gap-1.5 self-start sm:self-auto rounded-xl border border-purple-200 bg-white px-3 py-1.5 text-xs font-semibold text-purple-700 hover:bg-purple-50 hover:text-purple-900 transition shadow-sm dark:border-purple-400/30 dark:bg-purple-900/40 dark:text-purple-200 dark:hover:bg-purple-800/50 dark:hover:text-white"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isAnimating ? 'animate-spin' : ''}`} />
          <span>Next Quote</span>
        </button>
      </div>

      <div className="relative mt-4 pt-3 border-t border-purple-100 dark:border-purple-500/20">
        <Quote className="absolute -top-2 left-0 h-8 w-8 text-purple-300/30 dark:text-purple-500/20 -translate-y-1/2 select-none pointer-events-none" />
        <div className={`transition-opacity duration-200 ${isAnimating ? 'opacity-0' : 'opacity-100'}`}>
          <blockquote className="text-base sm:text-lg font-medium leading-relaxed text-slate-800 dark:text-slate-100 italic pl-4 border-l-2 border-purple-500 dark:border-purple-400">
            "{current.text}"
          </blockquote>
          <div className="mt-3 pl-4 flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
              <Award className="h-4 w-4 text-amber-500 dark:text-amber-400" />
              {current.author}
            </span>
            <span className="text-xs font-mono text-slate-500 dark:text-purple-300/60">· {current.source}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
