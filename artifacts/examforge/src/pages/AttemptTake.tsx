import { useState, useEffect, useCallback } from "react";
import { useParams, useLocation, Link } from "wouter";
import {
  useGetAttempt,
  useSubmitAnswer,
  useFinishAttempt,
  useSubmitLeaderboardEntry,
  getGetAttemptQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen, CheckCircle, XCircle, ArrowRight, ArrowLeft,
  Award, Loader2, Star, Home, RotateCcw, AlertCircle, Pause, Play
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { TimerBar } from "@/components/TimerBar";
import { AiGradingCard } from "@/components/AiGradingCard";

function formatEssayPrompt(prompt: string) {
  if (!prompt) return null;

  // Pattern: (i), (ii), (iii)... or i), ii), iii)... or (1), (2)... or a), b)...
  const subPattern = /(\((?:i{1,3}|iv|v|vi{0,3}|ix|x|[1-9]|[a-h])\)\s*|(?:^|\s)(?:i{1,3}|iv|v|vi{0,3}|ix|x)\)\s*|(?:^|\s)[a-h]\)\s*|(?:^|\s)\d+\.\s+)/gi;

  // First split on explicit newlines
  const rawLines = prompt.split(/\n/);
  const parts: { text: string; isSub: boolean }[] = [];

  for (const line of rawLines) {
    const trimmed = line.trim();
    if (!trimmed) { parts.push({ text: "", isSub: false }); continue; }

    // Check if this line itself starts with a subquestion marker
    const lineStartSub = trimmed.match(/^(\((?:i{1,3}|iv|v|vi{0,3}|ix|x|[1-9]|[a-h])\)\s*|[a-h]\)\s*|\d+\.\s+)/i);
    if (lineStartSub) {
      parts.push({ text: trimmed, isSub: true });
      continue;
    }

    // Try to split inline subquestions: "text text: (i) A, (ii) B, (iii) C"
    const segments: string[] = [];
    let lastIndex = 0;
    let foundSub = false;

    // Find all inline subquestion markers
    const matches = [...trimmed.matchAll(/(?:,?\s+|(?:^|\s))(?:\((?:i{1,3}|iv|v|vi{0,3}|ix|x|[1-9a-h])\)\s*|(?:i{1,3}|iv|v|vi{0,3}|ix|x|[1-9a-h])\)\s*)/gi)];

    if (matches.length >= 2) {
      // Multiple subquestions found inline — split them
      // The text before the first marker is the main question
      const firstMarkerIdx = trimmed.indexOf(matches[0][0].trim());
      const preamble = trimmed.substring(0, firstMarkerIdx).trim();
      if (preamble) {
        parts.push({ text: preamble.endsWith(":") ? preamble : preamble + ":", isSub: false });
      }

      for (let m = 0; m < matches.length; m++) {
        const matchStart = trimmed.indexOf(matches[m][0].trim(), m === 0 ? 0 : trimmed.indexOf(matches[m - 1][0].trim()) + 1);
        const nextStart = m + 1 < matches.length
          ? trimmed.indexOf(matches[m + 1][0].trim(), matchStart + 1)
          : trimmed.length;
        const segment = trimmed.substring(matchStart, nextStart).trim().replace(/,\s*$/, "").trim();
        if (segment) {
          parts.push({ text: segment, isSub: true });
        }
      }
      foundSub = true;
    }

    if (!foundSub) {
      parts.push({ text: trimmed, isSub: false });
    }
  }

  return (
    <div className="space-y-1.5">
      {parts.map((p, i) => (
        <div key={i}>
          {p.text === "" ? (
            <div className="h-2" />
          ) : p.isSub ? (
            <div className="pl-4 md:pl-6 py-0.5 text-foreground/90">
              <span className="font-medium">{p.text}</span>
            </div>
          ) : (
            <div className="text-foreground">{p.text}</div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function AttemptTake() {
  const { attemptId } = useParams();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [essayAnswer, setEssayAnswer] = useState("");
  const [showResults, setShowResults] = useState<boolean | null>(null);
  const [isPaused, setIsPaused] = useState(false);

  const { data: attempt, isLoading, isError, error } = useGetAttempt(attemptId!, {
    query: { enabled: !!attemptId, queryKey: getGetAttemptQueryKey(attemptId!) }
  });

  const submitAnswer = useSubmitAnswer();
  const finishAttempt = useFinishAttempt();
  const submitLeaderboard = useSubmitLeaderboardEntry();

  useEffect(() => {
    if (attempt) {
      setElapsedSeconds(attempt.elapsedSeconds || 0);
      setTimerRunning(attempt.status === "in_progress" && attempt.timeLimitMinutes != null);
    }
  }, [attempt?.id]);

  useEffect(() => {
    if (attempt && attempt.status === "in_progress" && Array.isArray(attempt.questions)) {
      const firstUnanswered = attempt.questions.findIndex((q: any) => !q.isAnswered);
      if (firstUnanswered !== -1 && firstUnanswered !== currentIndex) {
        setCurrentIndex(firstUnanswered);
      } else if (firstUnanswered === -1 && attempt.questions.length > 0) {
        setCurrentIndex(attempt.questions.length - 1);
      }
    }
  }, [attempt?.id]);

  const handleAutoSubmit = useCallback(() => {
    if (!attempt || attempt.status === "finished") return;
    finishAttempt.mutate(
      { attemptId: attemptId!, data: { elapsedSeconds } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetAttemptQueryKey(attemptId!) });
          localStorage.removeItem(`examforge_resume_${attempt.examId}`);
          setShowResults(true);
        }
      }
    );
  }, [attempt, attemptId, elapsedSeconds, finishAttempt, queryClient]);

  const handleTimerTick = useCallback((newElapsed: number) => {
    setElapsedSeconds(newElapsed);
  }, []);

  const handleTimerExpire = useCallback(() => {
    setTimerRunning(false);
    handleAutoSubmit();
  }, [handleAutoSubmit]);

  const handleTimerAdjust = useCallback((_newTimeLimit: number | null) => {
    // Timer adjustment handled by TimerBar
  }, []);

  const handlePause = () => {
    setIsPaused(true);
    setTimerRunning(false);
  };

  const handleResume = () => {
    setIsPaused(false);
    setTimerRunning(attempt?.timeLimitMinutes != null && attempt?.status === "in_progress");
  };

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isError || !attempt || (attempt as any).error) {
    return (
      <div className="min-h-[100dvh] bg-background flex flex-col items-center justify-center p-4 font-sans">
        <Card className="max-w-md w-full p-8 text-center space-y-4 border-border/60 shadow-lg">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
          <h2 className="text-xl font-bold font-serif text-foreground">Attempt Not Found</h2>
          <p className="text-muted-foreground text-sm">
            {(error as any)?.message || (attempt as any)?.error || "We couldn't load this attempt. It may have expired or been removed."}
          </p>
          <div className="pt-2 flex justify-center gap-3">
            <Button onClick={() => setLocation("/")} className="gap-2">
              <Home className="w-4 h-4" /> Return to Dashboard
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const isFinished = attempt.status === "finished";
  const questions = attempt.questions || [];
  const shouldShowResults = isFinished && (showResults === null ? true : showResults);

  if (shouldShowResults) {
    return (
      <ResultsScreen
        attempt={attempt}
        attemptId={attemptId!}
        onReview={() => {
          setShowResults(false);
          setCurrentIndex(0);
        }}
      />
    );
  }

  if (questions.length === 0) {
    return (
      <div className="min-h-[100dvh] bg-background flex flex-col items-center justify-center p-4 font-sans">
        <Card className="max-w-md w-full p-8 text-center space-y-4 border-border/60 shadow-lg">
          <AlertCircle className="w-12 h-12 text-muted-foreground/60 mx-auto" />
          <h2 className="text-xl font-bold font-serif">No Questions Available</h2>
          <p className="text-muted-foreground text-sm">
            This exam attempt does not contain any questions.
          </p>
          <div className="pt-2 flex justify-center gap-3">
            <Button onClick={() => setLocation("/")} className="gap-2">
              <Home className="w-4 h-4" /> Back to Dashboard
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const safeIndex = Math.min(Math.max(0, currentIndex), questions.length - 1);
  const question = questions[safeIndex];
  const totalQuestions = attempt.total || questions.length;

  const answeredCount = questions.filter((q: any) => q.isAnswered).length;

  const handleOptionClick = (index: number) => {
    if (!question || isFinished || question.isAnswered || submittingId === question.id) return;

    setSubmittingId(question.id);
    submitAnswer.mutate({
      attemptId: attemptId!,
      data: {
        attemptQuestionId: question.id,
        selectedIndex: index,
        elapsedSeconds,
      }
    }, {
      onSuccess: (result: any) => {
        setSubmittingId(null);
        queryClient.setQueryData(getGetAttemptQueryKey(attemptId!), (old: any) => {
          if (!old || !Array.isArray(old.questions)) return old;
          const newQuestions = old.questions.map((q: any) => {
            if (q.id === question.id) {
              return {
                ...q,
                isAnswered: true,
                selectedIndex: index,
                correctIndex: result.correctIndex,
                isCorrect: result.isCorrect
              };
            }
            return q;
          });
          return { ...old, questions: newQuestions, score: result.score, total: result.total };
        });
      },
      onError: () => setSubmittingId(null)
    });
  };

  const handleEssaySubmit = () => {
    if (!question || isFinished || question.isAnswered || submittingId === question.id || !essayAnswer.trim()) return;

    setSubmittingId(question.id);
    submitAnswer.mutate({
      attemptId: attemptId!,
      data: {
        attemptQuestionId: question.id,
        essayAnswer: essayAnswer.trim(),
        elapsedSeconds,
      }
    }, {
      onSuccess: () => {
        setSubmittingId(null);
        queryClient.setQueryData(getGetAttemptQueryKey(attemptId!), (old: any) => {
          if (!old || !Array.isArray(old.questions)) return old;
          const newQuestions = old.questions.map((q: any) => {
            if (q.id === question.id) {
              return {
                ...q,
                isAnswered: true,
                selectedIndex: -1,
                isCorrect: null,
                userEssayAnswer: essayAnswer.trim(),
              };
            }
            return q;
          });
          return { ...old, questions: newQuestions };
        });
        setEssayAnswer("");
      },
      onError: () => setSubmittingId(null)
    });
  };

  const handleNext = () => {
    if (safeIndex < totalQuestions - 1) {
      setCurrentIndex(curr => curr + 1);
    } else {
      if (isFinished) {
        setShowResults(true);
      } else {
        finishAttempt.mutate({ attemptId: attemptId!, data: { elapsedSeconds } }, {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getGetAttemptQueryKey(attemptId!) });
            localStorage.removeItem(`examforge_resume_${attempt.examId}`);
            setShowResults(true);
          }
        });
      }
    }
  };

  const handlePrev = () => {
    if (safeIndex > 0) {
      setCurrentIndex(curr => curr - 1);
    }
  };

  const handleJumpTo = (index: number) => {
    if (index >= 0 && index < totalQuestions) {
      setCurrentIndex(index);
    }
  };

  const optionLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

  return (
    <>
      {/* Pause Overlay */}
      <AnimatePresence>
        {isPaused && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col items-center justify-center p-4 sm:p-6"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="text-center space-y-4 sm:space-y-6 max-w-xs sm:max-w-sm w-full"
            >
              <Pause className="w-12 h-12 sm:w-16 sm:h-16 text-primary mx-auto" />
              <h2 className="text-xl sm:text-2xl font-serif font-bold text-foreground">Quiz Paused</h2>
              <p className="text-muted-foreground text-xs sm:text-sm">
                Your progress has been saved. The timer is paused.
              </p>
              <div className="text-3xl sm:text-4xl font-mono font-bold text-primary">
                {String(Math.floor(elapsedSeconds / 60)).padStart(2, '0')}:{String(elapsedSeconds % 60).padStart(2, '0')}
              </div>
              <Button
                size="lg"
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-base sm:text-lg px-6 sm:px-8 py-4 sm:py-6 h-auto gap-2"
                onClick={handleResume}
              >
                <Play className="w-4 h-4 sm:w-5 sm:h-5" /> Resume Quiz
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="min-h-[100dvh] bg-background flex flex-col font-sans overflow-x-hidden w-full max-w-full">
        {/* Top Bar */}
        <div className="sticky top-0 z-40 bg-card border-b border-border/60 shadow-sm w-full">
          <div className="max-w-3xl mx-auto px-2 py-1.5 sm:px-3 sm:py-2 md:px-4 md:py-3 space-y-1.5 md:space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Badge className="bg-secondary text-secondary-foreground text-[10px] md:text-sm font-semibold px-2 py-0.5 md:px-4 md:py-1.5 rounded-full border-border/40 shrink-0">
                Q {safeIndex + 1}/{totalQuestions}
              </Badge>

              <div className="flex-1 min-w-0">
                <Progress value={(answeredCount / totalQuestions) * 100} className="h-2 bg-secondary" />
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {!isFinished && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handlePause}
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                    title="Pause Quiz"
                  >
                    <Pause className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>

            {/* Timer */}
            {attempt.timeLimitMinutes != null && (
              <TimerBar
                timeLimitMinutes={attempt.timeLimitMinutes}
                elapsedSeconds={elapsedSeconds}
                isRunning={timerRunning && !isFinished}
                onTick={handleTimerTick}
                onExpire={handleTimerExpire}
                onAdjust={handleTimerAdjust}
              />
            )}
            {attempt.timeLimitMinutes == null && (
              <div className="flex items-center gap-1.5 md:gap-2 text-[10px] md:text-xs text-muted-foreground">
                <span className="font-mono">{String(Math.floor(elapsedSeconds / 60)).padStart(2, '0')}:{String(elapsedSeconds % 60).padStart(2, '0')}</span>
                <span>elapsed</span>
              </div>
            )}
          </div>
        </div>

        {/* Question Number Indicators */}
        <div className="max-w-3xl mx-auto w-full px-2 sm:px-3 md:px-4 pt-2 md:pt-3 overflow-x-hidden">
          <div className="flex flex-wrap gap-1 md:gap-1.5 justify-center max-h-20 sm:max-h-24 md:max-h-32 overflow-y-auto pb-1">
            {questions.map((q: any, i: number) => {
              const isCurrent = i === safeIndex;
              const isAnswered = q.isAnswered;
              return (
                <button
                  key={q.id || i}
                  onClick={() => handleJumpTo(i)}
                  className={`
                    w-7 h-7 sm:w-8 sm:h-8 md:w-9 md:h-9 rounded-full flex items-center justify-center text-[10px] sm:text-xs md:text-xs font-bold
                    transition-all duration-200 border-2
                    ${isCurrent
                      ? 'border-primary bg-primary text-primary-foreground scale-110 shadow-md'
                      : isAnswered
                        ? 'border-success bg-success text-success-foreground'
                        : 'border-border bg-secondary text-muted-foreground hover:border-primary/50 hover:bg-secondary/80'
                    }
                  `}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
        </div>

        {/* Question Card */}
        <div className="flex-1 flex flex-col items-center px-2 sm:px-3 md:px-4 py-3 md:py-4 min-w-0">
          <div className="w-full max-w-3xl min-w-0">
            <AnimatePresence mode="wait">
              <motion.div
                key={question.id}
                initial={{ x: 50, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -50, opacity: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="w-full"
              >
                <div className="bg-card rounded-2xl md:rounded-3xl p-4 sm:p-5 md:p-8 shadow-2xl border border-border/80 min-w-0 overflow-hidden">
                  {question.topic && (
                    <div className="mb-3">
                      <span className="text-xs font-bold uppercase tracking-widest text-accent bg-accent/10 px-3 py-1 rounded-full">
                        {question.topic}
                      </span>
                    </div>
                  )}

                  <div className="text-base sm:text-lg md:text-xl lg:text-2xl font-serif font-semibold text-primary leading-relaxed mb-4 md:mb-6 break-words min-w-0">
                    {question.questionType === "essay" ? formatEssayPrompt(question.prompt) : question.prompt}
                    {question.repeatNote && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex ml-2 align-middle cursor-help text-accent hover:scale-110 transition-transform">
                            <Star className="w-5 h-5 fill-current" />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent className="bg-primary text-primary-foreground p-4 max-w-sm text-sm border-none shadow-xl">
                          <div dangerouslySetInnerHTML={{ __html: question.repeatNote }} />
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>

                  {question.questionType === "essay" ? (
                    <div className="space-y-3">
                      {!question.isAnswered ? (
                        <>
                          <Textarea
                            value={essayAnswer}
                            onChange={(e) => setEssayAnswer(e.target.value)}
                            placeholder="Write your answer here..."
                            className="min-h-[120px] md:min-h-[150px] text-base resize-y"
                          />
                          <Button
                            onClick={handleEssaySubmit}
                            disabled={!essayAnswer.trim() || submittingId === question.id}
                            className="gap-2 bg-primary hover:bg-primary/90 w-full md:w-auto"
                          >
                            {submittingId === question.id ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                            Submit Answer
                          </Button>
                        </>
                      ) : (
                        <div className="p-4 rounded-2xl border border-border/60 bg-secondary/30">
                          <p className="text-sm font-medium text-muted-foreground mb-2">Answer submitted</p>
                          <p className="text-foreground whitespace-pre-wrap text-sm">{essayAnswer || "Answer submitted"}</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {question.options.map((opt: string, i: number) => {
                        const isSelected = question.selectedIndex === i;
                        const isAlreadySelected = question.isAnswered && isSelected;

                        let optionStateClasses = "border-border hover:border-primary/50 hover:bg-secondary/50 bg-card";
                        let letterClasses = "bg-secondary text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary";

                        if (question.isAnswered) {
                          if (isAlreadySelected) {
                            optionStateClasses = "border-primary bg-primary/10";
                            letterClasses = "bg-primary text-primary-foreground";
                          } else {
                            optionStateClasses = "border-border/40 opacity-60";
                            letterClasses = "bg-secondary/50 text-muted-foreground/50";
                          }
                        } else if (isSelected || submittingId === question.id) {
                          if (isSelected) {
                            optionStateClasses = "border-primary bg-primary/5";
                            letterClasses = "bg-primary text-primary-foreground";
                          } else {
                            optionStateClasses = "border-border/40 opacity-60";
                          }
                        }

                        return (
                          <button
                            key={i}
                            onClick={() => handleOptionClick(i)}
                            disabled={question.isAnswered || submittingId !== null}
                            className={`w-full group text-left p-3 md:p-4 rounded-2xl border-2 transition-all duration-200 flex items-center gap-3 md:gap-4 ${optionStateClasses}`}
                          >
                            <span className={`w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center font-bold text-xs md:text-sm shrink-0 transition-colors ${letterClasses}`}>
                              {optionLetters[i]}
                            </span>
                            <span className="font-medium text-foreground text-sm md:text-base break-words min-w-0">{opt}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Show "Answer submitted" for MCQ after answering, no correct/incorrect feedback */}
                  {question.questionType !== "essay" && question.isAnswered && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="mt-4 text-sm text-muted-foreground text-center"
                    >
                      Answer submitted
                    </motion.div>
                  )}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Bottom Navigation */}
        <div className="sticky bottom-0 z-40 bg-card border-t border-border/60 shadow-lg w-full">
          <div className="max-w-3xl mx-auto px-2 sm:px-3 md:px-4 py-2 md:py-3 flex items-center justify-between gap-2 md:gap-3">
            <Button
              variant="ghost"
              onClick={handlePrev}
              disabled={safeIndex === 0}
              className="text-muted-foreground hover:text-foreground hover:bg-secondary/50 gap-1 text-xs md:text-base h-8 md:h-10"
            >
              <ArrowLeft className="w-3.5 h-3.5 md:w-4 md:h-4" /> <span className="hidden sm:inline">Previous</span>
            </Button>

            <span className="text-[10px] md:text-xs text-muted-foreground font-mono shrink-0">
              {answeredCount}/{totalQuestions}
            </span>

            <Button
              size="sm"
              onClick={handleNext}
              disabled={!question?.isAnswered && !isFinished}
              className={`gap-1 font-bold px-3 md:px-8 shadow-md text-xs md:text-base h-8 md:h-10 ${!question?.isAnswered && !isFinished ? 'opacity-50' : 'bg-primary hover:bg-primary/90'}`}
            >
              {safeIndex === totalQuestions - 1 ? (
                isFinished ? "View Results" : "Finish"
              ) : (
                <><span className="hidden sm:inline">Next</span> <ArrowRight className="w-3.5 h-3.5 md:w-4 md:h-4" /></>
              )}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

function ResultsScreen({ attempt, attemptId, onReview }: { attempt: any, attemptId: string, onReview: () => void }) {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const submitLeaderboard = useSubmitLeaderboardEntry();
  const userName = localStorage.getItem("examforge_user_name") || "";
  const [leaderboardSubmitted, setLeaderboardSubmitted] = useState(false);

  const questions = attempt?.questions || [];
  const hasEssayQuestions = questions.some((q: any) => q.questionType === "essay");
  const hasMcqQuestions = questions.some((q: any) => q.questionType === "mcq" || !q.questionType);

  useEffect(() => {
    if (
      !leaderboardSubmitted &&
      userName &&
      hasMcqQuestions &&
      !hasEssayQuestions &&
      attempt.status === "finished"
    ) {
      submitLeaderboard.mutate(
        {
          examId: attempt.examId,
          data: {
            userName,
            score: attempt.score,
            total: attempt.total,
            elapsedSeconds: attempt.elapsedSeconds || 0,
          },
        },
        {
          onSuccess: () => setLeaderboardSubmitted(true),
          onError: () => setLeaderboardSubmitted(true),
        }
      );
    }
  }, [attempt, userName, hasMcqQuestions, hasEssayQuestions, leaderboardSubmitted, submitLeaderboard]);

  return (
    <div className="min-h-[100dvh] bg-background py-6 md:py-10 px-3 md:px-4 font-sans overflow-x-hidden">
      <div className="max-w-4xl mx-auto space-y-6 md:space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">

        <Card className="border-border/60 shadow-2xl overflow-hidden bg-card">
          <div className="h-3 w-full bg-accent"></div>
          <CardContent className="p-6 md:p-12 text-center">
            <Award className="w-16 h-16 md:w-20 md:h-20 mx-auto text-accent mb-4 md:mb-6" />
            <h1 className="text-2xl md:text-4xl font-serif font-bold text-primary mb-2">Quiz Completed</h1>
            <p className="text-base md:text-lg text-muted-foreground mb-6 md:mb-8">{attempt.examTitle}</p>

            <div className="inline-flex flex-col items-center justify-center p-6 md:p-8 bg-secondary/50 rounded-full w-36 h-36 md:w-48 md:h-48 border-4 border-background shadow-inner mb-6 md:mb-8">
              <span className="text-3xl md:text-5xl font-black text-primary">{Math.round(attempt.scorePct)}<span className="text-xl md:text-3xl">%</span></span>
              <span className="text-xs md:text-sm font-medium text-muted-foreground mt-2">{attempt.score} / {attempt.total} Correct</span>
            </div>

            {userName && submitLeaderboard.isPending && (
              <div className="mb-4 text-sm text-muted-foreground">
                Submitting to leaderboard...
              </div>
            )}
            {userName && leaderboardSubmitted && !submitLeaderboard.isError && (
              <div className="mb-4 text-sm text-success font-medium">
                Score submitted to leaderboard!
              </div>
            )}

            <div className="flex flex-col sm:flex-row flex-wrap justify-center gap-3 md:gap-4">
              <Button size="lg" className="bg-primary hover:bg-primary/90 gap-2 px-6 md:px-8" onClick={() => setLocation(`/exams/${attempt.examId}/take`)}>
                <RotateCcw className="w-4 h-4" /> Try Again
              </Button>
              <Button size="lg" variant="outline" className="gap-2 px-6 md:px-8" onClick={onReview}>
                <BookOpen className="w-4 h-4" /> Review Answers
              </Button>
              <Button size="lg" variant="ghost" className="gap-2 px-6 md:px-8" onClick={() => setLocation(`/`)}>
                <Home className="w-4 h-4" /> Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>

        {hasEssayQuestions && (
          <AiGradingCard attemptId={attemptId} examTitle={attempt.examTitle} />
        )}

        <div className="space-y-3 md:space-y-4">
          <h2 className="text-xl md:text-2xl font-serif font-bold px-2">Review Summary</h2>
          {questions.map((q: any, i: number) => (
            <Card key={q.id || i} className="shadow-sm border-border/60">
              <CardContent className="p-4 md:p-6 flex flex-col md:flex-row gap-4 md:gap-6">
                <div className="flex-none pt-1">
                  {q.questionType === "essay" ? (
                    <Badge variant="outline" className="text-xs">Essay</Badge>
                  ) : q.isCorrect ?
                    <CheckCircle className="w-7 h-7 md:w-8 md:h-8 text-success" /> :
                    <XCircle className="w-7 h-7 md:w-8 md:h-8 text-destructive" />
                  }
                </div>
                <div className="flex-1 space-y-3 md:space-y-4 min-w-0">
                  <div className="font-medium text-base md:text-lg leading-snug text-foreground break-words">
                    <span className="text-muted-foreground mr-2">{i + 1}.</span>
                    {q.questionType === "essay" ? formatEssayPrompt(q.prompt) : q.prompt}
                  </div>

                  {q.questionType === "essay" ? (
                    <div className="p-3 rounded-lg bg-secondary/30 border border-border/40">
                      <p className="text-sm font-medium text-muted-foreground mb-1">Submitted Answer:</p>
                      <p className="text-foreground whitespace-pre-wrap text-sm">{q.userEssayAnswer || "No answer submitted"}</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex gap-2 flex-wrap">
                        <Badge variant="outline" className="bg-card text-muted-foreground border-border/60 text-xs">Your Answer</Badge>
                        <span className={`font-medium text-sm ${q.isCorrect ? 'text-success' : 'text-destructive'}`}>
                          {q.selectedIndex != null && q.options && q.options[q.selectedIndex] !== undefined
                            ? q.options[q.selectedIndex]
                            : 'Skipped'}
                        </span>
                      </div>
                      {!q.isCorrect && q.correctIndex != null && q.options && q.options[q.correctIndex] !== undefined && (
                        <div className="flex gap-2 flex-wrap">
                          <Badge variant="outline" className="bg-success/10 text-success border-success/20 text-xs">Correct Answer</Badge>
                          <span className="font-medium text-success text-sm">{q.options[q.correctIndex]}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {(q.explanation || q.reference) && (
                    <div className="bg-secondary/40 p-3 md:p-4 rounded-lg text-sm space-y-2 mt-2">
                      {q.explanation && <div><span className="font-semibold">Explanation:</span> <span className="text-muted-foreground">{q.explanation}</span></div>}
                      {q.reference && <div><span className="font-semibold">Reference:</span> <span className="text-muted-foreground">{q.reference}</span></div>}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

      </div>
    </div>
  );
}
