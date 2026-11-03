/**
 * Canonical types conforming strictly to contract.md
 */

export type Difficulty = 'easy' | 'medium' | 'hard';
export type InterviewMode = 'text' | 'audio' | 'video';
export type SessionStatus = 'in_progress' | 'completed';
export type EvalStatus = 'pending' | 'done' | 'failed';
export type AnswerSource = 'typed' | 'voice';

export interface Dimensions {
  relevance: number;
  accuracy: number;
  depth: number;
  clarity: number;
}

export interface CurrentQuestion {
  id: string;
  order_index: number;
  text: string;
  category: string;
  seconds_remaining: number | null;
}

export interface Question {
  id: string;
  order_index: number;
  text: string;
  category: string;
  answer_text: string | null;
  eval_status: EvalStatus;
  score: number | null;
  strengths: string[];
  improvements: string[];
  missed_points: string[];
  dimensions: Dimensions | null;
  ideal_outline: string[];
}

export interface SessionSummary {
  text: string;
  top_strengths: string[];
  focus_areas: string[];
}

export interface Session {
  id: string;
  created_at: string;
  status: SessionStatus;
  difficulty: Difficulty;
  num_questions: number;
  target_role: string | null;
  timer_seconds: number | null;
  interview_mode: InterviewMode;
  interview_category: 'technical' | 'hr' | 'behavioral' | 'mixed';
  experience_level: 'fresher' | 'junior' | 'mid' | 'senior' | 'lead';
  duration_minutes: number | null;
  answered_count: number;
  current_question: CurrentQuestion | null;
  questions: Question[];
  overall_score?: number | null;
  summary?: SessionSummary | null;
}

export interface AnswerPayload {
  answer_text: string;
  source: AnswerSource;
}

export interface AnswerResponse {
  question_id: string;
  eval_status: 'done' | 'failed';
  score: number | null;
  dimensions: Dimensions | null;
  strengths: string[];
  improvements: string[];
  missed_points: string[];
  ideal_outline: string[];
}

export interface CompleteResponse {
  overall_score: number;
  summary: SessionSummary;
}

