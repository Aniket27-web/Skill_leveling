import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSession } from '../../api/hooks';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/Card';
import { Button } from '../../components/Button';
import { Spinner } from '../../components/Spinner';
import { Bot, ArrowLeft } from 'lucide-react';

export const InterviewPlaceholder: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: session, isLoading } = useSession(id || '');

  return (
    <div className="max-w-3xl mx-auto py-12 space-y-6 text-center animate-fade-in">
      <Card className="p-8 border-teal-500/20 bg-slate-900/80">
        <div className="w-14 h-14 rounded-2xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400 mx-auto mb-4">
          <Bot className="w-7 h-7" />
        </div>
        <CardHeader>
          <CardTitle className="text-xl">Interactive Interview Room (P4 Reserved Route)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-300 max-w-md mx-auto">
            Session ID: <code className="text-teal-400 font-mono text-xs">{id}</code>
          </p>
          {isLoading ? (
            <Spinner size="md" />
          ) : session ? (
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400 text-left max-w-md mx-auto space-y-1">
              <p>Target Role: <strong className="text-white">{session.target_role || 'General'}</strong></p>
              <p>Difficulty: <strong className="text-white capitalize">{session.difficulty}</strong></p>
              <p>Questions: <strong className="text-white">{session.question_count}</strong></p>
              <p>Timer: <strong className="text-white">{session.timer_seconds ? `${session.timer_seconds}s` : 'Untimed'}</strong></p>
            </div>
          ) : null}
          <p className="text-xs text-slate-500 italic">
            This route is reserved for Frontend P4's interview execution view. P4 imports useSession, useSubmitAnswer, useRetryEval, and shared components.
          </p>
          <div className="pt-4 flex justify-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/')}
              leftIcon={<ArrowLeft className="w-4 h-4" />}
            >
              Return to Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
