/**
 * Skill Leveling - Hunter Ranking & Leveling Scoring Engine
 *
 * Hunter Ranks:
 *  - S-Rank (National / Monarch Level): Level 90 - 100
 *  - A-Rank: Level 75 - 89
 *  - B-Rank: Level 55 - 74
 *  - C-Rank: Level 35 - 54
 *  - D-Rank: Level 20 - 34
 *  - E-Rank: Level 0 - 19
 *
 * Difficulty Multipliers:
 *  - Easy: base +6 pts for correct, -2 pts (1/3 penalty) for incorrect
 *  - Medium: base +10 pts for correct, -3.33 pts (1/3 penalty) for incorrect
 *  - Hard: base +15 pts for correct, -5 pts (1/3 penalty) for incorrect
 */

export type HunterRank = 'E' | 'D' | 'C' | 'B' | 'A' | 'S';

export interface RankInfo {
  rank: HunterRank;
  title: string;
  badgeBg: string;
  badgeText: string;
  glowColor: string;
  borderClass: string;
  minLevel: number;
  maxLevel: number;
}

export const HUNTER_RANKS: Record<HunterRank, RankInfo> = {
  S: {
    rank: 'S',
    title: 'Monarch / Shadow Sovereign',
    badgeBg: 'bg-purple-900/80',
    badgeText: 'text-purple-300',
    glowColor: 'shadow-[0_0_25px_rgba(168,85,247,0.7)]',
    borderClass: 'border-purple-400',
    minLevel: 90,
    maxLevel: 100,
  },
  A: {
    rank: 'A',
    title: 'High-Rank Elite Hunter',
    badgeBg: 'bg-indigo-900/80',
    badgeText: 'text-indigo-300',
    glowColor: 'shadow-[0_0_20px_rgba(99,102,241,0.6)]',
    borderClass: 'border-indigo-400',
    minLevel: 75,
    maxLevel: 89,
  },
  B: {
    rank: 'B',
    title: 'Raid Commander',
    badgeBg: 'bg-fuchsia-900/80',
    badgeText: 'text-fuchsia-300',
    glowColor: 'shadow-[0_0_15px_rgba(217,70,239,0.5)]',
    borderClass: 'border-fuchsia-400',
    minLevel: 55,
    maxLevel: 74,
  },
  C: {
    rank: 'C',
    title: 'Dungeon Striker',
    badgeBg: 'bg-purple-950/70',
    badgeText: 'text-purple-200',
    glowColor: 'shadow-[0_0_10px_rgba(147,51,234,0.4)]',
    borderClass: 'border-purple-600',
    minLevel: 35,
    maxLevel: 54,
  },
  D: {
    rank: 'D',
    title: 'Awakened Combatant',
    badgeBg: 'bg-slate-900/80',
    badgeText: 'text-slate-300',
    glowColor: 'shadow-[0_0_8px_rgba(100,116,139,0.3)]',
    borderClass: 'border-slate-600',
    minLevel: 20,
    maxLevel: 34,
  },
  E: {
    rank: 'E',
    title: 'The Weakest Hunter',
    badgeBg: 'bg-zinc-900/80',
    badgeText: 'text-zinc-400',
    glowColor: 'shadow-none',
    borderClass: 'border-zinc-700',
    minLevel: 0,
    maxLevel: 19,
  },
};

export function getRankFromLevel(level: number): RankInfo {
  const clamped = Math.max(0, Math.min(100, Math.round(level)));
  if (clamped >= 90) return HUNTER_RANKS.S;
  if (clamped >= 75) return HUNTER_RANKS.A;
  if (clamped >= 55) return HUNTER_RANKS.B;
  if (clamped >= 35) return HUNTER_RANKS.C;
  if (clamped >= 20) return HUNTER_RANKS.D;
  return HUNTER_RANKS.E;
}

export interface LevelDeltaCalculation {
  isCorrect: boolean;
  score: number;
  delta: number;
  reason: string;
}

/**
 * Calculates level adjustment from a question score (0-10):
 * - Score >= 7: Correct (+pts based on difficulty)
 * - Score < 7: Incorrect / Subpar (-1/3 penalty of correct gain)
 */
export function calculateLevelDelta(
  score: number | null | undefined,
  difficulty: 'easy' | 'medium' | 'hard' | string = 'medium'
): LevelDeltaCalculation {
  const normScore = score ?? 0;
  const isCorrect = normScore >= 7;

  let baseGain = 10;
  if (difficulty === 'easy') baseGain = 6;
  if (difficulty === 'hard') baseGain = 15;

  if (isCorrect) {
    // Quality scalar for answers scoring 7 to 10
    const qualityMultiplier = 0.7 + ((normScore - 7) / 3) * 0.3; // 0.7 to 1.0
    const gain = Math.round(baseGain * qualityMultiplier * 10) / 10;
    return {
      isCorrect: true,
      score: normScore,
      delta: +gain,
      reason: `Correct evaluation (${normScore}/10) gained +${gain} Level points!`,
    };
  } else {
    // 1/3 penalty of base gain
    const penalty = Math.round((baseGain / 3) * 10) / 10;
    return {
      isCorrect: false,
      score: normScore,
      delta: -penalty,
      reason: `Answer scored below threshold (${normScore}/10): -${penalty} Penalty points applied!`,
    };
  }
}

const HUNTER_STORAGE_KEY = 'skill_leveling_hunter_stats';

export interface HunterProfile {
  level: number;
  exp: number;
  totalAnswered: number;
  totalCorrect: number;
  totalPenalties: number;
  highestRank: HunterRank;
}

export function loadHunterProfile(): HunterProfile {
  const fallback: HunterProfile = { level: 10, exp: 0, totalAnswered: 0, totalCorrect: 0, totalPenalties: 0, highestRank: 'E' };
  if (typeof window === 'undefined') {
    return fallback;
  }
  try {
    const raw = localStorage.getItem(HUNTER_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return {
          level: Math.max(0, Math.min(100, Number.isFinite(Number(parsed.level)) ? Number(parsed.level) : 10)),
          exp: Number(parsed.exp) || 0,
          totalAnswered: Number(parsed.totalAnswered) || 0,
          totalCorrect: Number(parsed.totalCorrect) || 0,
          totalPenalties: Number(parsed.totalPenalties) || 0,
          highestRank: parsed.highestRank || 'E',
        };
      }
    }
  } catch {
    // fallback
  }
  return fallback;
}

export function saveHunterProfile(profile: HunterProfile): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(HUNTER_STORAGE_KEY, JSON.stringify(profile));
    window.dispatchEvent(new Event('hunter_update'));
    window.dispatchEvent(new Event('storage'));
  } catch {
    // ignore
  }
}

export function applyQuestionResultToHunter(
  score: number | null | undefined,
  difficulty: string
): { updatedProfile: HunterProfile; deltaInfo: LevelDeltaCalculation } {
  const current = loadHunterProfile();
  const deltaInfo = calculateLevelDelta(score, difficulty);

  let newLevel = Math.max(0, Math.min(100, current.level + deltaInfo.delta));
  newLevel = Math.round(newLevel * 10) / 10;

  const currentRankInfo = getRankFromLevel(newLevel);
  const highestRankInfo = getRankFromLevel(Math.max(current.level, newLevel));

  const updatedProfile: HunterProfile = {
    level: newLevel,
    exp: current.exp + (deltaInfo.isCorrect ? Math.round(deltaInfo.delta * 10) : 0),
    totalAnswered: current.totalAnswered + 1,
    totalCorrect: current.totalCorrect + (deltaInfo.isCorrect ? 1 : 0),
    totalPenalties: current.totalPenalties + (!deltaInfo.isCorrect ? 1 : 0),
    highestRank: highestRankInfo.rank,
  };

  saveHunterProfile(updatedProfile);
  return { updatedProfile, deltaInfo };
}

