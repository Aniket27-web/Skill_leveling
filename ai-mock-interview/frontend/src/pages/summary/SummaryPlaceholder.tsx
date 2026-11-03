import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSession, downloadReport } from '../../api/hooks';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/Card';
import { Button } from '../../components/Button';
import { ScoreBadge } from '../../components/ScoreBadge';
import { Spinner } from '../../components/Spinner';
import { Award, Download, ArrowLeft } from 'lucide-react';

export const SummaryPlaceholder: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: session, isLoading } = useSession(id || '');

  return (
    <div className="max-w-3xl mx-auto py-12 space-y-6 text-center animate-fade-in">
      <Card className="p-8 border-teal-500/20 bg-slate-900/80">
        <div className="w-14 h-14 rounded-2xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400 mx-auto mb-4">
          <Award className="w-7 h-7" />
        </div>
        <CardHeader>
          <CardTitle className="text-xl">Interview Summary & Debrief (P4 Reserved Route)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-300 max-w-md mx-auto">
            Session ID: <code className="text-teal-400 font-mono text-xs">{id}</code>
          </p>
          {isLoading ? (
            <Spinner size="md" />
          ) : session ? (
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400 text-left max-w-md mx-auto space-y-2">
              <div className="flex items-center justify-between">
                <span>Score:</span>
                <ScoreBadge score={session.overall_score} size="md" />
              </div>
              <p>Role: <strong className="text-white">{session.target_role || 'General'}</strong></p>
              <p>Summary: <span className="text-slate-300">{session.summary || 'Summary pending...'}</span></p>
            </div>
          ) : null}
          <p className="text-xs text-slate-500 italic">
            This route is reserved for Frontend P4's interview summary view. P4 mounts their custom analysis components here.
          </p>
          <div className="pt-4 flex justify-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/history')}
              leftIcon={<ArrowLeft className="w-4 h-4" />}
            >
              Back to History
            </Button>
            {id && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => downloadReport(id)}
                leftIcon={<Download className="w-4 h-4" />}
              >
                Download PDF Report
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
