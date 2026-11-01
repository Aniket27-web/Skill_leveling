import { http, HttpResponse, delay } from 'msw';
import {
  User,
  Resume,
  Session,
  Difficulty,
} from '../api/types';

// In-memory stateful store
let currentUser: User | null = {
  id: 'usr_mock_1',
  email: 'alex.developer@example.com',
  name: 'Alex Johnson',
  created_at: '2026-01-15T09:00:00Z',
};

let resumes: Resume[] = [
  {
    id: 'res_1',
    filename: 'Alex_Johnson_Senior_FullStack_2026.pdf',
    uploaded_at: '2026-10-20T14:30:00Z',
    char_count: 4250,
    preview_text: 'Alex Johnson - Senior Full-Stack Engineer with 6+ years experience in React, TypeScript, Node.js, distributed systems, and PostgreSQL. Led frontend architecture for cloud-native microservices.',
    file_size: 142000,
  },
  {
    id: 'res_2',
    filename: 'Alex_Resume_Frontend_Architect.docx',
    uploaded_at: '2026-10-25T11:15:00Z',
    char_count: 3890,
    preview_text: 'Frontend Architect specializing in design systems, performance optimization, and web vitals. Built large-scale enterprise React platforms and state management pipelines.',
    file_size: 98000,
  },
];

let sessions: Session[] = [
  {
    id: 'sess_1',
    created_at: '2026-10-26T10:00:00Z',
    difficulty: 'hard',
    question_count: 5,
    target_role: 'Staff Frontend Engineer',
    timer_seconds: 60,
    status: 'completed',
    current_question_index: 5,
    overall_score: 88,
    summary: 'Exceptional mastery of web architecture, rendering optimization, and micro-frontend patterns. Strong system design trade-offs.',
    strengths: [
      'Deep knowledge of React concurrent rendering and fiber mechanics',
      'Effective communication of browser reflows and memory leak prevention',
      'Articulated clear caching strategies with service workers',
    ],
    improvements: [
      'Provide more concrete metric targets when discussing bundle budgeting',
      'Deepen coverage of server-side streaming hydration edge cases',
    ],
    resume_id: 'res_1',
    questions: [
      {
        id: 'q_1_1',
        index: 1,
        text: 'How would you architect a resilient micro-frontend architecture while avoiding bundle duplication and style collisions?',
        user_answer: 'I would recommend Module Federation with Webpack or Vite, establishing a shared host core for dependencies like React and query clients. Styles should be scoped using CSS modules or Tailwind with strict prefixes.',
        score: 92,
        strengths: ['Clear isolation strategy', 'Addressed shared dependencies'],
        improvements: ['Could mention version skew strategies between remotes'],
        eval_status: 'evaluated',
      },
      {
        id: 'q_1_2',
        index: 2,
        text: 'Explain how you troubleshoot and eliminate long tasks that degrade Interaction to Next Paint (INP).',
        user_answer: 'Using Chrome Performance Profiler and PerformanceObserver, trace tasks over 50ms. Yield main thread work with scheduler.yield() or requestIdleCallback, and break up synchronous state mutations.',
        score: 85,
        strengths: ['Accurate tool usage', 'Modern browser API recommendations'],
        improvements: ['Include debouncing/throttling best practices for frequent event inputs'],
        eval_status: 'evaluated',
      },
    ],
  },
  {
    id: 'sess_2',
    created_at: '2026-10-28T15:30:00Z',
    difficulty: 'medium',
    question_count: 4,
    target_role: 'Senior React Developer',
    timer_seconds: 90,
    status: 'completed',
    current_question_index: 4,
    overall_score: 82,
    summary: 'Solid understanding of state machines, async handling, and component composition. Good practical testing approach.',
    strengths: [
      'Comprehensive grasp of custom hook encapsulation',
      'Strong error boundary implementation techniques',
    ],
    improvements: [
      'Elaborate more on optimistic UI rollback patterns',
    ],
    resume_id: 'res_1',
    questions: [
      {
        id: 'q_2_1',
        index: 1,
        text: 'How do you design a custom hook for server data caching, deduplication, and stale-while-revalidate?',
        user_answer: 'By leveraging TanStack Query patterns: tracking query keys, dispatching background fetches with staleTime, and providing status states.',
        score: 82,
        strengths: ['Great explanation of SWR mechanics'],
        improvements: ['Detail manual cache invalidation scenarios'],
        eval_status: 'evaluated',
      },
    ],
  },
  {
    id: 'sess_3',
    created_at: '2026-10-31T09:20:00Z',
    difficulty: 'easy',
    question_count: 3,
    target_role: 'Frontend Engineer',
    timer_seconds: null,
    status: 'completed',
    current_question_index: 3,
    overall_score: 74,
    summary: 'Good baseline technical knowledge, communicates concepts clearly.',
    strengths: ['Clean explanations of DOM event propagation'],
    improvements: ['Could show more familiarity with CSS layout algorithms (Flex vs Grid)'],
    resume_id: 'res_2',
    questions: [
      {
        id: 'q_3_1',
        index: 1,
        text: 'Explain the difference between event bubbling and event capturing in the DOM.',
        user_answer: 'Capturing travels down from the window to the target element, while bubbling propagates upwards from target to window.',
        score: 74,
        strengths: ['Accurate propagation flow description'],
        improvements: ['Provide practical examples of stopPropagation use cases'],
        eval_status: 'evaluated',
      },
    ],
  },
  {
    id: 'sess_timer_demo',
    created_at: '2026-11-01T11:00:00Z',
    difficulty: 'medium',
    question_count: 3,
    target_role: 'Full Stack Engineer',
    timer_seconds: 45,
    status: 'in_progress',
    current_question_index: 1,
    overall_score: null,
    summary: null,
    strengths: null,
    improvements: null,
    resume_id: 'res_1',
    questions: [
      {
        id: 'q_timer_1',
        index: 1,
        text: 'Walk through how you design an idempotent payment processing endpoint to prevent double charging.',
        user_answer: null,
        score: null,
        strengths: null,
        improvements: null,
        eval_status: 'pending',
      },
      {
        id: 'q_timer_2',
        index: 2,
        text: 'How does database indexing work, and what are the trade-offs of B-tree vs Hash indexes?',
        user_answer: null,
        score: null,
        strengths: null,
        improvements: null,
        eval_status: 'pending',
      },
      {
        id: 'q_timer_3',
        index: 3,
        text: 'Describe how you handle distributed transaction rollbacks across microservices without two-phase commit.',
        user_answer: null,
        score: null,
        strengths: null,
        improvements: null,
        eval_status: 'pending',
      },
    ],
  },
];

export const handlers = [
  // 1. AUTH
  http.get('*/api/auth/me', async () => {
    await delay(150);
    if (!currentUser) {
      return HttpResponse.json(
        { error: { code: 'unauthorized', message: 'You must be logged in to view this session' } },
        { status: 401 }
      );
    }
    return HttpResponse.json({ user: currentUser });
  }),

  http.post('*/api/auth/login', async ({ request }) => {
    await delay(300);
    const body = (await request.json()) as { email?: string; password?: string };
    if (!body.email || !body.password) {
      return HttpResponse.json(
        { error: { code: 'validation_error', message: 'Email and password are required' } },
        { status: 400 }
      );
    }
    if (body.password.length < 8) {
      return HttpResponse.json(
        { error: { code: 'invalid_credentials', message: 'Password must be at least 8 characters' } },
        { status: 400 }
      );
    }

    currentUser = {
      id: 'usr_mock_1',
      email: body.email,
      name: body.email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      created_at: new Date().toISOString(),
    };

    return HttpResponse.json({ user: currentUser, message: 'Logged in successfully' });
  }),

  http.post('*/api/auth/register', async ({ request }) => {
    await delay(350);
    const body = (await request.json()) as { email?: string; password?: string; name?: string };
    if (!body.email || !body.password) {
      return HttpResponse.json(
        { error: { code: 'validation_error', message: 'Email and password are required' } },
        { status: 400 }
      );
    }
    if (body.password.length < 8) {
      return HttpResponse.json(
        { error: { code: 'weak_password', message: 'Password must be at least 8 characters' } },
        { status: 400 }
      );
    }

    currentUser = {
      id: `usr_${Date.now()}`,
      email: body.email,
      name: body.name || body.email.split('@')[0],
      created_at: new Date().toISOString(),
    };

    return HttpResponse.json({ user: currentUser, message: 'Registration successful' });
  }),

  http.post('*/api/auth/logout', async () => {
    await delay(150);
    currentUser = null;
    return HttpResponse.json({ success: true });
  }),

  // 2. RESUMES
  http.get('*/api/resumes', async () => {
    await delay(200);
    return HttpResponse.json(resumes);
  }),

  http.post('*/api/resumes', async ({ request }) => {
    await delay(400);
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return HttpResponse.json(
        { error: { code: 'missing_file', message: 'No resume file provided' } },
        { status: 400 }
      );
    }

    // Explicit test requirement: 422 resume upload for file named scanned.pdf
    if (file.name.toLowerCase().includes('scanned.pdf')) {
      return HttpResponse.json(
        {
          error: {
            code: 'unreadable_resume',
            message: 'Unable to extract text from scanned PDF. Please upload a digital PDF or DOCX file with selectable text.',
          },
        },
        { status: 422 }
      );
    }

    const newResume: Resume = {
      id: `res_${Date.now()}`,
      filename: file.name,
      uploaded_at: new Date().toISOString(),
      char_count: Math.floor(2500 + Math.random() * 3000),
      preview_text: `Preview of ${file.name}: Extracted software engineering profile with focus on modern distributed architectures, frontend performance, and automated CI/CD workflows.`,
      file_size: file.size,
    };

    resumes.unshift(newResume);
    return HttpResponse.json(newResume, { status: 201 });
  }),

  // 3. SESSIONS
  http.get('*/api/sessions', async ({ request }) => {
    await delay(200);
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '10', 10);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);

    const paginatedSessions = sessions.slice(offset, offset + limit);
    return HttpResponse.json({
      sessions: paginatedSessions,
      total: sessions.length,
      limit,
      offset,
    });
  }),

  http.post('*/api/sessions', async ({ request }) => {
    // Simulated AI processing time (can take longer as per specification)
    await delay(500);
    const body = (await request.json()) as {
      resume_id?: string;
      difficulty: Difficulty;
      question_count: number;
      target_role?: string;
      timer_seconds?: number | null;
    };

    // Explicit test requirement: 502 session create if target_role is "fail502"
    if (body.target_role && body.target_role.toLowerCase().includes('fail502')) {
      return HttpResponse.json(
        {
          error: {
            code: 'ai_unavailable',
            message: 'AI question generation service is currently unavailable. Please check your connection or retry in a moment.',
          },
        },
        { status: 502 }
      );
    }

    const questionCount = body.question_count || 5;
    const role = body.target_role?.trim() || 'Software Engineer';
    const sampleQuestions = [
      `Could you describe a challenging technical architecture decision you made recently for ${role}?`,
      `How do you diagnose and resolve complex memory leaks or bottlenecks in high-throughput applications?`,
      `Explain the strategy you employ to maintain high test coverage and fault tolerance across microservices.`,
      `How would you handle schema migrations in a live zero-downtime database with millions of active records?`,
      `What trade-offs do you evaluate when selecting between optimistic concurrency and pessimistic locking?`,
      `Describe how you structure clean domain models and enforce boundaries in complex business domains.`,
    ];

    const questions = Array.from({ length: questionCount }, (_, idx) => ({
      id: `q_${Date.now()}_${idx + 1}`,
      index: idx + 1,
      text: sampleQuestions[idx % sampleQuestions.length] || `Interview question #${idx + 1} for ${role}`,
      user_answer: null,
      score: null,
      strengths: null,
      improvements: null,
      eval_status: 'pending' as const,
    }));

    const newSession: Session = {
      id: `sess_${Date.now()}`,
      created_at: new Date().toISOString(),
      difficulty: body.difficulty || 'medium',
      question_count: questionCount,
      target_role: role,
      timer_seconds: body.timer_seconds ?? null,
      status: 'in_progress',
      current_question_index: 1,
      questions,
      overall_score: null,
      summary: null,
      strengths: null,
      improvements: null,
      resume_id: body.resume_id || null,
    };

    sessions.unshift(newSession);
    return HttpResponse.json(newSession, { status: 201 });
  }),

  http.get('*/api/sessions/:id', async ({ params }) => {
    await delay(150);
    const session = sessions.find((s) => s.id === params.id);
    if (!session) {
      return HttpResponse.json(
        { error: { code: 'session_not_found', message: `Session ${params.id} was not found` } },
        { status: 404 }
      );
    }
    return HttpResponse.json(session);
  }),

  http.post('*/api/sessions/:id/answers', async ({ params, request }) => {
    await delay(400);
    const session = sessions.find((s) => s.id === params.id);
    if (!session) {
      return HttpResponse.json(
        { error: { code: 'session_not_found', message: 'Session not found' } },
        { status: 404 }
      );
    }

    const body = (await request.json()) as { question_id: string; answer: string; idempotencyKey?: string };
    const question = session.questions.find((q) => q.id === body.question_id);

    if (!question) {
      return HttpResponse.json(
        { error: { code: 'question_not_found', message: 'Question not found' } },
        { status: 404 }
      );
    }

    question.user_answer = body.answer;

    // Explicit test requirement: failed evaluation case triggered by answer text "fail"
    if (body.answer && body.answer.toLowerCase().includes('fail')) {
      question.eval_status = 'failed';
      question.score = null;
      question.feedback = 'Evaluation failed: the automated grading model timed out. Please click retry.';
      return HttpResponse.json({
        session_id: session.id,
        question,
        session_completed: false,
      });
    }

    // Successful evaluation
    question.eval_status = 'evaluated';
    const computedScore = Math.floor(75 + Math.random() * 20);
    question.score = computedScore;
    question.strengths = [
      'Comprehensive explanation of the architectural trade-offs',
      'Demonstrated practical real-world production experience',
    ];
    question.improvements = [
      'Could cite specific latency numbers or capacity scaling calculations',
    ];
    question.feedback = 'Solid response with clear articulation and good technical depth.';

    // Advance session progress
    if (session.current_question_index < session.question_count) {
      session.current_question_index += 1;
    }

    return HttpResponse.json({
      session_id: session.id,
      question,
      session_completed: session.questions.every((q) => q.eval_status === 'evaluated'),
    });
  }),

  http.post('*/api/sessions/:id/questions/:questionId/retry-eval', async ({ params }) => {
    await delay(350);
    const session = sessions.find((s) => s.id === params.id);
    if (!session) {
      return HttpResponse.json(
        { error: { code: 'session_not_found', message: 'Session not found' } },
        { status: 404 }
      );
    }

    const question = session.questions.find((q) => q.id === params.questionId);
    if (!question) {
      return HttpResponse.json(
        { error: { code: 'question_not_found', message: 'Question not found' } },
        { status: 404 }
      );
    }

    question.eval_status = 'evaluated';
    question.score = 80;
    question.strengths = ['Recovered evaluation: Well-structured technical argument'];
    question.improvements = ['Include concrete monitoring KPIs'];
    question.feedback = 'Retry evaluation completed successfully.';

    return HttpResponse.json({
      session_id: session.id,
      question,
    });
  }),

  http.post('*/api/sessions/:id/complete', async ({ params }) => {
    await delay(300);
    const session = sessions.find((s) => s.id === params.id);
    if (!session) {
      return HttpResponse.json(
        { error: { code: 'session_not_found', message: 'Session not found' } },
        { status: 404 }
      );
    }

    const evaluatedQuestions = session.questions.filter((q) => q.score !== null && q.score !== undefined);
    const avgScore = evaluatedQuestions.length
      ? Math.round(evaluatedQuestions.reduce((acc, q) => acc + (q.score || 0), 0) / evaluatedQuestions.length)
      : 80;

    session.status = 'completed';
    session.overall_score = avgScore;
    session.summary = `Candidate demonstrated consistent problem solving and articulated clear engineering solutions across all ${session.question_count} questions.`;
    session.strengths = [
      'Strong architectural clarity and system boundary design',
      'Effective balance between speed of implementation and long-term maintainability',
    ];
    session.improvements = [
      'Provide more exact observability and automated alerting strategies',
    ];

    return HttpResponse.json({ session });
  }),

  http.delete('*/api/sessions/:id', async ({ params }) => {
    await delay(250);
    const index = sessions.findIndex((s) => s.id === params.id);
    if (index === -1) {
      return HttpResponse.json(
        { error: { code: 'session_not_found', message: 'Session not found to delete' } },
        { status: 404 }
      );
    }
    sessions.splice(index, 1);
    return HttpResponse.json({ success: true });
  }),

  // 4. PROGRESS
  http.get('*/api/progress', async () => {
    await delay(200);
    const completedSessions = sessions
      .filter((s) => s.status === 'completed' && s.overall_score !== null && s.overall_score !== undefined)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    const history = completedSessions.map((s) => ({
      date: s.created_at.split('T')[0],
      overall_score: s.overall_score as number,
      difficulty: s.difficulty,
      session_id: s.id,
      target_role: s.target_role,
    }));

    const totalScores = history.reduce((sum, h) => sum + h.overall_score, 0);
    const average_score = history.length > 0 ? Math.round(totalScores / history.length) : 0;

    // Moving average of last 3 sessions
    const moving_average =
      history.length >= 3
        ? Math.round((history.slice(-3).reduce((sum, h) => sum + h.overall_score, 0) / 3) * 10) / 10
        : average_score;

    const latest = history[history.length - 1]?.overall_score || 0;
    const score_delta = history.length > 0 ? Math.round((latest - average_score) * 10) / 10 : 0;

    return HttpResponse.json({
      history,
      average_score,
      total_sessions: sessions.length,
      moving_average,
      score_delta,
    });
  }),

  // 5. REPORT DOWNLOAD
  http.get('*/api/sessions/:id/report', async ({ params }) => {
    await delay(300);
    const session = sessions.find((s) => s.id === params.id);
    const content = `AI Mock Interview Performance Report
=============================================
Session ID: ${params.id}
Date: ${session?.created_at || new Date().toISOString()}
Target Role: ${session?.target_role || 'General Software Engineering'}
Difficulty: ${session?.difficulty || 'Medium'}
Overall Score: ${session?.overall_score ?? 'Pending'}/100

Summary:
${session?.summary || 'No summary generated yet.'}

Strengths:
${session?.strengths?.map((s) => ` - ${s}`).join('\n') || 'None recorded.'}

Areas for Improvement:
${session?.improvements?.map((i) => ` - ${i}`).join('\n') || 'None recorded.'}
=============================================
Generated by AI Mock Interviewer System.
`;

    const blob = new Blob([content], { type: 'application/pdf' });
    return new HttpResponse(blob, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="interview-report-${params.id}.pdf"`,
      },
    });
  }),
];
