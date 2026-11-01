export type Difficulty = 'easy' | 'medium' | 'hard';

export type SessionStatus = 'in_progress' | 'completed';

export type QuestionEvalStatus = 'pending' | 'evaluating' | 'evaluated' | 'failed';

export interface User {
  id: string;
  email: string;
  name: string;
  created_at?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name?: string;
}

export interface AuthResponse {
  user: User;
  message?: string;
}

export interface Resume {
  id: string;
  filename: string;
  uploaded_at: string;
  char_count: number;
  preview_text?: string;
  file_size?: number;
}

export interface Question {
  id: string;
  index: number;
  text: string;
  user_answer?: string | null;
  score?: number | null;
  strengths?: string[] | null;
  improvements?: string[] | null;
  eval_status: QuestionEvalStatus;
  feedback?: string | null;
}

export interface Session {
  id: string;
  created_at: string;
  difficulty: Difficulty;
  question_count: number;
  target_role?: string | null;
  timer_seconds?: number | null;
  status: SessionStatus;
  current_question_index: number;
  questions: Question[];
  overall_score?: number | null;
  summary?: string | null;
  strengths?: string[] | null;
  improvements?: string[] | null;
  resume_id?: string | null;
}

export interface CreateSessionRequest {
  resume_id?: string | null;
  difficulty: Difficulty;
  question_count: number;
  target_role?: string | null;
  timer_seconds?: number | null;
}

export interface SubmitAnswerRequest {
  question_id: string;
  answer: string;
  idempotencyKey?: string;
}

export interface SubmitAnswerResponse {
  session_id: string;
  question: Question;
  session_completed?: boolean;
}

export interface RetryEvalResponse {
  session_id: string;
  question: Question;
}

export interface CompleteSessionResponse {
  session: Session;
}

export interface SessionsListResponse {
  sessions: Session[];
  total: number;
  limit: number;
  offset: number;
}

export interface ProgressHistoryItem {
  date: string;
  overall_score: number;
  difficulty: Difficulty;
  session_id: string;
  target_role?: string | null;
}

export interface ProgressResponse {
  history: ProgressHistoryItem[];
  average_score: number;
  total_sessions: number;
  moving_average?: number | null;
  score_delta?: number | null;
}

export interface ApiErrorDetail {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiErrorResponse {
  error: ApiErrorDetail;
}
