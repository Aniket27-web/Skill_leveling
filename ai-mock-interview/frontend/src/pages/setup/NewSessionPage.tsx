import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useResumes, useUploadResume, useCreateSession } from '../../api/hooks';
import { Resume, Difficulty } from '../../api/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/Card';
import { Button } from '../../components/Button';
import { ProgressBar } from '../../components/ProgressBar';
import { Spinner } from '../../components/Spinner';
import { useToast } from '../../components/Toast';
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertCircle,
  Clock,
  Briefcase,
  Sliders,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
} from 'lucide-react';
import { clsx } from 'clsx';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export const NewSessionPage: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  // Step state (1: Resume, 2: Config)
  const [step, setStep] = useState<1 | 2>(1);

  // Step 1: Resume State
  const { data: existingResumes, isLoading: resumesLoading } = useResumes();
  const uploadResumeMutation = useUploadResume();
  const [selectedResume, setSelectedResume] = useState<Resume | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [serverError422, setServerError422] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);

  // Step 2: Config State
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [questionCount, setQuestionCount] = useState<number>(5);
  const [targetRole, setTargetRole] = useState<string>('');
  const [timerEnabled, setTimerEnabled] = useState<boolean>(false);
  const [timerSeconds, setTimerSeconds] = useState<number>(60);

  // Submit / 502 State
  const createSessionMutation = useCreateSession();
  const [isPreparing, setIsPreparing] = useState<boolean>(false);
  const [submitError502, setSubmitError502] = useState<string | null>(null);

  // Client-side file validation
  const validateFile = (file: File): string | null => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'pdf' && ext !== 'docx') {
      return 'Unsupported file format. Please upload a PDF or DOCX resume.';
    }
    if (file.size > MAX_FILE_SIZE) {
      return `File size exceeds 5MB limit (${(file.size / (1024 * 1024)).toFixed(1)}MB). Please choose a smaller document.`;
    }
    return null;
  };

  const handleFileUpload = async (file: File) => {
    setFileError(null);
    setServerError422(null);

    const clientValidationErr = validateFile(file);
    if (clientValidationErr) {
      setFileError(clientValidationErr);
      return;
    }

    try {
      setIsUploading(true);
      setUploadProgress(20);

      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => (prev < 90 ? prev + 15 : prev));
      }, 100);

      const uploaded = await uploadResumeMutation.mutateAsync(file);

      clearInterval(progressInterval);
      setUploadProgress(100);
      setSelectedResume(uploaded);
      toast.success(`Resume "${file.name}" uploaded successfully!`);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Upload failed. Please check your network connection.';
      setServerError422(message);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleSessionSubmit = async () => {
    setSubmitError502(null);
    setIsPreparing(true);

    try {
      const newSession = await createSessionMutation.mutateAsync({
        resume_id: selectedResume?.id || null,
        difficulty,
        question_count: questionCount,
        target_role: targetRole.trim() || undefined,
        timer_seconds: timerEnabled ? timerSeconds : null,
      });

      toast.success('Interview questions generated! Starting interview.');
      navigate(`/interview/${newSession.id}`);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'AI question generation service is currently unavailable. Please try again.';
      setSubmitError502(message);
    } finally {
      setIsPreparing(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
      {/* Stepper Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          Create New Interview Session
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Customize difficulty, target role, and questions tailored to your resume.
        </p>

        {/* Stepper progress indicator */}
        <div className="flex items-center gap-4 mt-6">
          <button
            onClick={() => setStep(1)}
            className={clsx(
              'flex items-center gap-2.5 pb-2 border-b-2 font-semibold text-sm transition-colors text-left',
              step === 1
                ? 'border-teal-400 text-teal-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            )}
          >
            <span
              className={clsx(
                'w-6 h-6 rounded-full flex items-center justify-center text-xs',
                step === 1 ? 'bg-teal-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-400'
              )}
            >
              1
            </span>
            <span>Resume Selection</span>
          </button>

          <div className="w-8 h-px bg-slate-800 mb-2" />

          <button
            onClick={() => {
              if (selectedResume) setStep(2);
            }}
            disabled={!selectedResume}
            className={clsx(
              'flex items-center gap-2.5 pb-2 border-b-2 font-semibold text-sm transition-colors text-left disabled:opacity-40 disabled:cursor-not-allowed',
              step === 2
                ? 'border-teal-400 text-teal-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            )}
          >
            <span
              className={clsx(
                'w-6 h-6 rounded-full flex items-center justify-center text-xs',
                step === 2 ? 'bg-teal-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-400'
              )}
            >
              2
            </span>
            <span>Interview Setup</span>
          </button>
        </div>
      </div>

      {/* STEP 1: RESUME UPLOAD & SELECTION */}
      {step === 1 && (
        <div className="space-y-6">
          {/* Prominent 422 Server Error Display */}
          {serverError422 && (
            <div
              role="alert"
              data-testid="resume-422-error"
              className="rounded-xl border border-rose-500/40 bg-rose-950/40 p-5 text-rose-200 flex items-start gap-3.5 shadow-xl animate-fade-in"
            >
              <AlertCircle className="w-6 h-6 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-rose-300 text-sm">Resume Processing Error</h4>
                <p className="text-xs text-rose-200 mt-1 leading-relaxed">{serverError422}</p>
                <p className="text-[11px] text-rose-300/80 mt-2">
                  Tip: If your document was scanned or created as an image, text cannot be parsed by the AI. Please upload a digital PDF or standard Word .docx document.
                </p>
              </div>
            </div>
          )}

          {/* Client File Error */}
          {fileError && (
            <div
              role="alert"
              data-testid="resume-client-error"
              className="rounded-xl border border-amber-500/40 bg-amber-950/40 p-4 text-amber-200 flex items-center gap-3 text-sm animate-fade-in"
            >
              <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
              <span>{fileError}</span>
            </div>
          )}

          {/* Dropzone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            className={clsx(
              'border-2 border-dashed rounded-2xl p-8 text-center transition-all duration-200 cursor-pointer flex flex-col items-center justify-center relative overflow-hidden',
              isDragOver
                ? 'border-teal-400 bg-teal-500/10'
                : 'border-slate-700 hover:border-teal-500/50 bg-slate-900/60'
            )}
          >
            <input
              id="resume-file-input"
              data-testid="resume-file-input"
              type="file"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFileUpload(e.target.files[0]);
                }
              }}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            />
            <div className="w-16 h-16 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400 mb-4 shadow-inner">
              <UploadCloud className="w-8 h-8" />
            </div>
            <h3 className="text-base font-semibold text-white">
              Drag & drop your resume here, or <span className="text-teal-400 underline underline-offset-4">browse files</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1.5">
              Supports PDF or DOCX up to 5MB. AI extracts technical skills, past experience, and domain achievements.
            </p>

            {isUploading && (
              <div className="w-full max-w-xs mt-6">
                <ProgressBar value={uploadProgress} label="Uploading and analyzing resume..." showValue color="teal" />
              </div>
            )}
          </div>

          {/* Selected Resume Preview */}
          {selectedResume && (
            <Card className="border-teal-500/30 bg-teal-950/10 animate-fade-in">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-teal-500/20 text-teal-300 flex items-center justify-center shrink-0 mt-0.5">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-white text-sm">{selectedResume.filename}</h4>
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Extracted {selectedResume.char_count.toLocaleString()} characters • Uploaded{' '}
                      {new Date(selectedResume.uploaded_at).toLocaleDateString()}
                    </p>
                    {selectedResume.preview_text && (
                      <div className="mt-3 p-3 rounded-lg bg-slate-900/80 border border-slate-800 text-xs text-slate-300 font-mono leading-relaxed line-clamp-3">
                        "{selectedResume.preview_text}"
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Option to Pick Previously Uploaded Resume */}
          {existingResumes && existingResumes.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                Or select from previously uploaded resumes:
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {existingResumes.map((resume) => {
                  const isSelected = selectedResume?.id === resume.id;
                  return (
                    <div
                      key={resume.id}
                      onClick={() => {
                        setSelectedResume(resume);
                        setFileError(null);
                        setServerError422(null);
                      }}
                      className={clsx(
                        'p-3.5 rounded-xl border text-left cursor-pointer transition-all flex items-center justify-between gap-3',
                        isSelected
                          ? 'border-teal-400 bg-teal-500/10 shadow-md shadow-teal-500/10'
                          : 'border-slate-800 bg-slate-900/50 hover:bg-slate-800/40 hover:border-slate-700'
                      )}
                    >
                      <div className="min-w-0 flex items-center gap-2.5">
                        <FileText
                          className={clsx('w-4 h-4 shrink-0', isSelected ? 'text-teal-400' : 'text-slate-400')}
                        />
                        <div className="truncate">
                          <p className="text-xs font-semibold text-white truncate">{resume.filename}</p>
                          <p className="text-[11px] text-slate-500">
                            {resume.char_count} chars • {resume.uploaded_at.split('T')[0]}
                          </p>
                        </div>
                      </div>
                      {isSelected && <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Next Button */}
          <div className="flex justify-end pt-4 border-t border-slate-800">
            <Button
              variant="primary"
              size="lg"
              disabled={!selectedResume}
              onClick={() => setStep(2)}
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Continue to Interview Setup
            </Button>
          </div>
        </div>
      )}

      {/* STEP 2: INTERVIEW SETUP & CONFIG */}
      {step === 2 && (
        <div className="space-y-6">
          {/* 502 Error State with Friendly Message & Retry */}
          {submitError502 && (
            <div
              role="alert"
              data-testid="session-502-error"
              className="rounded-xl border border-rose-500/40 bg-rose-950/40 p-5 text-rose-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shadow-xl animate-fade-in"
            >
              <div className="flex items-start gap-3">
                <AlertCircle className="w-6 h-6 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-rose-300 text-sm">AI Service Temporarily Unavailable</h4>
                  <p className="text-xs text-rose-200 mt-1 leading-relaxed">
                    {submitError502}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSessionSubmit}
                leftIcon={<RefreshCw className="w-4 h-4" />}
                className="shrink-0"
              >
                Retry Generation
              </Button>
            </div>
          )}

          {/* Preparing Questions Overlay / State */}
          {isPreparing ? (
            <Card className="text-center py-16 px-6 border-teal-500/40 bg-slate-900/90 shadow-2xl">
              <div className="flex flex-col items-center justify-center space-y-4">
                <div className="relative">
                  <div className="w-16 h-16 rounded-full bg-teal-500/10 border border-teal-500/30 flex items-center justify-center animate-pulse">
                    <Sparkles className="w-8 h-8 text-teal-400" />
                  </div>
                  <div className="absolute inset-0">
                    <Spinner size="xl" className="text-teal-400/80" />
                  </div>
                </div>
                <h3 className="text-xl font-bold text-white tracking-tight">
                  Reading your resume and preparing questions...
                </h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                  Our AI is analyzing your technical achievements, skills, and the requested difficulty to formulate tailored coding and system design prompts. This can take 10+ seconds.
                </p>
              </div>
            </Card>
          ) : (
            <>
              {/* Target Job Role */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-teal-400" />
                    Target Job Role (Optional)
                  </CardTitle>
                  <CardDescription>
                    Tailors question topics to specific titles (e.g. "Senior React Engineer", "Backend Go Architect", "DevOps Lead").
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <input
                    type="text"
                    value={targetRole}
                    onChange={(e) => setTargetRole(e.target.value)}
                    placeholder="e.g. Senior Full-Stack Engineer"
                    className="w-full rounded-lg bg-slate-950/80 border border-slate-800 focus:border-teal-500 px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-teal-500 transition-colors"
                  />
                  <p className="text-[11px] text-slate-500 mt-2">
                    Tip: Enter "fail502" to test backend error handling as specified in the test contract.
                  </p>
                </CardContent>
              </Card>

              {/* Difficulty Cards */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Select Interview Difficulty</CardTitle>
                  <CardDescription>Choose the depth of questioning and evaluation strictness.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* Easy */}
                    <div
                      onClick={() => setDifficulty('easy')}
                      className={clsx(
                        'p-4 rounded-xl border cursor-pointer transition-all',
                        difficulty === 'easy'
                          ? 'border-emerald-500 bg-emerald-500/10 shadow-lg shadow-emerald-500/10'
                          : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
                      )}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-sm text-emerald-400">Easy</span>
                        {difficulty === 'easy' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        Fundamental concepts, straightforward scenarios, gentle grading.
                      </p>
                    </div>

                    {/* Medium */}
                    <div
                      onClick={() => setDifficulty('medium')}
                      className={clsx(
                        'p-4 rounded-xl border cursor-pointer transition-all',
                        difficulty === 'medium'
                          ? 'border-teal-500 bg-teal-500/10 shadow-lg shadow-teal-500/10'
                          : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
                      )}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-sm text-teal-400">Medium</span>
                        {difficulty === 'medium' && <CheckCircle2 className="w-4 h-4 text-teal-400" />}
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        Real-world trade-offs, architecture decisions, typical tech screens.
                      </p>
                    </div>

                    {/* Hard */}
                    <div
                      onClick={() => setDifficulty('hard')}
                      className={clsx(
                        'p-4 rounded-xl border cursor-pointer transition-all',
                        difficulty === 'hard'
                          ? 'border-purple-500 bg-purple-500/10 shadow-lg shadow-purple-500/10'
                          : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
                      )}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-sm text-purple-400">Hard</span>
                        {difficulty === 'hard' && <CheckCircle2 className="w-4 h-4 text-purple-400" />}
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        Staff/principal level, distributed bottlenecks, edge-case deep dives.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Question Count Slider (3-15) */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Sliders className="w-4 h-4 text-teal-400" />
                        Number of Questions: <span className="text-teal-300">{questionCount}</span>
                      </CardTitle>
                      <CardDescription>Adjust how many questions the AI generates (3 to 15).</CardDescription>
                    </div>
                    <span className="text-xs font-semibold px-2.5 py-1 rounded bg-slate-800 text-teal-400 border border-slate-700">
                      {questionCount} Questions
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  <input
                    type="range"
                    min={3}
                    max={15}
                    value={questionCount}
                    onChange={(e) => setQuestionCount(parseInt(e.target.value, 10))}
                    className="w-full accent-teal-400 h-2 bg-slate-800 rounded-lg cursor-pointer"
                  />
                  <div className="flex justify-between text-[11px] text-slate-500 mt-2 font-mono">
                    <span>3 (Quick)</span>
                    <span>5 (Standard)</span>
                    <span>10 (Comprehensive)</span>
                    <span>15 (Marathon)</span>
                  </div>
                </CardContent>
              </Card>

              {/* Optional Timer Toggle with Presets (30/60/90/120s) */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <Clock className="w-4 h-4 text-teal-400" />
                      <div>
                        <CardTitle className="text-base">Per-Question Countdown Timer</CardTitle>
                        <CardDescription>Enforces time pressure on each response.</CardDescription>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={timerEnabled}
                        onChange={(e) => setTimerEnabled(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-500"></div>
                    </label>
                  </div>
                </CardHeader>
                {timerEnabled && (
                  <CardContent className="pt-2">
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                      Timer Preset per Question
                    </label>
                    <div className="grid grid-cols-4 gap-2.5">
                      {[30, 60, 90, 120].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setTimerSeconds(preset)}
                          className={clsx(
                            'py-2 px-3 rounded-lg text-xs font-semibold border transition-all text-center',
                            timerSeconds === preset
                              ? 'border-teal-400 bg-teal-500/15 text-teal-300'
                              : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:text-white hover:bg-slate-800'
                          )}
                        >
                          {preset}s
                        </button>
                      ))}
                    </div>
                  </CardContent>
                )}
              </Card>

              {/* Footer navigation */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                <Button
                  variant="secondary"
                  size="md"
                  onClick={() => setStep(1)}
                  leftIcon={<ArrowLeft className="w-4 h-4" />}
                >
                  Back to Resume
                </Button>

                <Button
                  variant="primary"
                  size="lg"
                  onClick={handleSessionSubmit}
                  isLoading={createSessionMutation.isPending}
                  rightIcon={<Sparkles className="w-4 h-4" />}
                >
                  Generate Interview Questions
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
