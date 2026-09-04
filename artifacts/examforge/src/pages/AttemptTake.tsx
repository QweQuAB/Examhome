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
  Award, Loader2, Star, Home, RotateCcw, AlertCircle
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

  const { data: attempt, isLoading, isError, error } = useGetAttempt(attemptId!, {
    query: { enabled: !!attemptId, queryKey: getGetAttemptQueryKey(attemptId!) }
  });

  const submitAnswer = useSubmitAnswer();
  const finishAttempt = useFinishAttempt();
  const submitLeaderboard = useSubmitLeaderboardEntry();

  // Initialize timer from attempt data
  useEffect(() => {
    if (attempt) {
      setElapsedSeconds(attempt.elapsedSeconds || 0);
      setTimerRunning(attempt.status === "in_progress" && attempt.timeLimitMinutes != null);
    }
  }, [attempt?.id]);

  // Jump to first unanswered question on load
  useEffect(() => {
    if (attempt && attempt.status === "in_progress" && Array.isArray(attempt.questions)) {
      const firstUnanswered = attempt.questions.findIndex(q => !q.isAnswered);
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
    // Timer adjustment handled by parent
  }, []);

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

  // Default to showing results screen if attempt is finished, unless user specifically chose to review
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
  const progressPct = ((safeIndex + 1) / totalQuestions) * 100;

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
      onSuccess: (result) => {
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

  const optionLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col items-center py-6 px-4 md:px-8 font-sans">
      <div className="w-full max-w-3xl space-y-6">
        {/* Progress Header */}
        <div className="bg-card rounded-2xl p-4 md:p-6 shadow-lg border border-border/60 space-y-3">
          <div className="flex items-center justify-between gap-4 md:gap-6 flex-wrap">
            <div className="flex items-center gap-2">
              <Badge className="bg-secondary text-secondary-foreground hover:bg-secondary text-sm font-semibold px-4 py-1.5 rounded-full border-border/40">
                Q {safeIndex + 1} of {totalQuestions}
              </Badge>
              {isFinished && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowResults(true)}
                  className="text-xs gap-1.5 h-7"
                >
                  <Award className="w-3.5 h-3.5" /> Results
                </Button>
              )}
            </div>
            <div className="flex-1 min-w-[200px]">
              <Progress value={progressPct} className="h-2.5 bg-secondary" />
            </div>
            <Badge className="bg-accent text-accent-foreground hover:bg-accent text-sm font-bold px-4 py-1.5 rounded-full">
              Score: {attempt.score}
            </Badge>
          </div>

          {/* Timer Bar */}
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
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-mono">{String(Math.floor(elapsedSeconds / 60)).padStart(2, '0')}:{String(elapsedSeconds % 60).padStart(2, '0')}</span>
              <span>elapsed</span>
            </div>
          )}
        </div>

        {/* Question Card */}
        <AnimatePresence mode="wait">
          <motion.div
            key={question.id}
            initial={{ x: 50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -50, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="w-full"
          >
            <div className="bg-card rounded-3xl p-6 md:p-10 shadow-2xl border border-border/80">
              {question.topic && (
                <div className="mb-4">
                  <span className="text-xs font-bold uppercase tracking-widest text-accent bg-accent/10 px-3 py-1 rounded-full">
                    {question.topic}
                  </span>
                </div>
              )}

              <div className="text-xl md:text-2xl font-serif font-semibold text-primary leading-relaxed mb-8">
                {question.prompt}
                {question.repeatNote && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex ml-3 align-middle cursor-help text-accent hover:scale-110 transition-transform">
                        <Star className="w-6 h-6 fill-current" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent className="bg-primary text-primary-foreground p-4 max-w-sm text-sm border-none shadow-xl">
                      <div dangerouslySetInnerHTML={{ __html: question.repeatNote }} />
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>

              {/* MCQ Options or Essay Answer */}
              {question.questionType === "essay" ? (
                <div className="space-y-4">
                  {!question.isAnswered ? (
                    <>
                      <Textarea
                        value={essayAnswer}
                        onChange={(e) => setEssayAnswer(e.target.value)}
                        placeholder="Write your answer here..."
                        className="min-h-[150px] text-base"
                      />
                      <Button
                        onClick={handleEssaySubmit}
                        disabled={!essayAnswer.trim() || submittingId === question.id}
                        className="gap-2 bg-primary hover:bg-primary/90"
                      >
                        {submittingId === question.id ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                        Submit Answer
                      </Button>
                    </>
                  ) : (
                    <div className="p-4 rounded-2xl border border-border/60 bg-secondary/30">
                      <p className="text-sm font-medium text-muted-foreground mb-2">Your Answer:</p>
                      <p className="text-foreground whitespace-pre-wrap">{essayAnswer || "Answer submitted"}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {question.options.map((opt, i) => {
                    const isSelected = question.selectedIndex === i;
                    const isCorrectAnswer = question.correctIndex === i;
                    const isWrongSelected = isSelected && !question.isCorrect;
                    const showCorrect = question.isAnswered && isCorrectAnswer;

                    let optionStateClasses = "border-border hover:border-primary/50 hover:bg-secondary/50 bg-card";
                    let letterClasses = "bg-secondary text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary";

                    if (question.isAnswered) {
                      if (showCorrect) {
                        optionStateClasses = "border-success bg-success/10";
                        letterClasses = "bg-success text-success-foreground";
                      } else if (isWrongSelected) {
                        optionStateClasses = "border-destructive bg-destructive/10";
                        letterClasses = "bg-destructive text-destructive-foreground";
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
                        className={`w-full group text-left p-4 rounded-2xl border-2 transition-all duration-200 flex items-center gap-4 ${optionStateClasses}`}
                      >
                        <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0 transition-colors ${letterClasses}`}>
                          {optionLetters[i]}
                        </span>
                        <span className="font-medium text-foreground text-base">{opt}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              <AnimatePresence>
                {question.isAnswered && (
                  <motion.div
                    initial={{ opacity: 0, height: 0, marginTop: 0 }}
                    animate={{ opacity: 1, height: 'auto', marginTop: 24 }}
                    className="overflow-hidden"
                  >
                    <div className={`p-6 rounded-2xl border ${question.isCorrect ? 'bg-success/5 border-success/20' : 'bg-destructive/5 border-destructive/20'}`}>
                      <div className={`flex items-center gap-2 font-bold text-lg mb-3 ${question.isCorrect ? 'text-success' : 'text-destructive'}`}>
                        {question.isCorrect ? <CheckCircle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                        {question.isCorrect ? "Correct!" : "Incorrect"}
                      </div>

                      {question.explanation && (
                        <p className="text-foreground leading-relaxed mb-4">{question.explanation}</p>
                      )}

                      {question.reference && (
                        <div className="bg-primary/5 border-l-4 border-primary/40 p-3 rounded-r-lg text-sm font-medium text-primary">
                          {question.reference}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <div className="flex items-center justify-between px-2">
          <Button
            variant="ghost"
            onClick={handlePrev}
            disabled={safeIndex === 0}
            className="text-muted-foreground hover:text-foreground hover:bg-secondary/50 gap-2"
          >
            <ArrowLeft className="w-4 h-4" /> Previous
          </Button>

          <Button
            size="lg"
            onClick={handleNext}
            disabled={!question?.isAnswered && !isFinished}
            className={`gap-2 font-bold px-8 shadow-md ${!question?.isAnswered && !isFinished ? 'opacity-50' : 'bg-primary hover:bg-primary/90'}`}
          >
            {safeIndex === totalQuestions - 1 ? (
               isFinished ? "View Results" : "Finish Attempt"
            ) : (
               <>Next <ArrowRight className="w-4 h-4" /></>
            )}
          </Button>
        </div>
      </div>
    </div>
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

  // Auto-submit to leaderboard on finish (MCQ only, if name provided)
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
          onError: () => setLeaderboardSubmitted(true), // Don't retry
        }
      );
    }
  }, [attempt, userName, hasMcqQuestions, hasEssayQuestions, leaderboardSubmitted, submitLeaderboard]);

  return (
    <div className="min-h-[100dvh] bg-background py-10 px-4 font-sans">
      <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">

        <Card className="border-border/60 shadow-2xl overflow-hidden bg-card">
          <div className="h-3 w-full bg-accent"></div>
          <CardContent className="p-8 md:p-12 text-center">
            <Award className="w-20 h-20 mx-auto text-accent mb-6" />
            <h1 className="text-3xl md:text-4xl font-serif font-bold text-primary mb-2">Quiz Completed</h1>
            <p className="text-lg text-muted-foreground mb-8">{attempt.examTitle}</p>

            <div className="inline-flex flex-col items-center justify-center p-8 bg-secondary/50 rounded-full w-48 h-48 border-4 border-background shadow-inner mb-8">
              <span className="text-5xl font-black text-primary">{Math.round(attempt.scorePct)}<span className="text-3xl">%</span></span>
              <span className="text-sm font-medium text-muted-foreground mt-2">{attempt.score} / {attempt.total} Correct</span>
            </div>

            {/* Leaderboard Submission Status */}
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

            <div className="flex flex-wrap justify-center gap-4">
              <Button size="lg" className="bg-primary hover:bg-primary/90 gap-2 px-8" onClick={() => setLocation(`/exams/${attempt.examId}/take`)}>
                <RotateCcw className="w-4 h-4" /> Try Again
              </Button>
              <Button size="lg" variant="outline" className="gap-2 px-8" onClick={onReview}>
                <BookOpen className="w-4 h-4" /> Review Answers
              </Button>
              <Button size="lg" variant="ghost" className="gap-2 px-8" onClick={() => setLocation(`/`)}>
                <Home className="w-4 h-4" /> Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* AI Grading for Essay Attempts */}
        {hasEssayQuestions && (
          <AiGradingCard attemptId={attemptId} examTitle={attempt.examTitle} />
        )}

        <div className="space-y-4">
          <h2 className="text-2xl font-serif font-bold px-2">Review Summary</h2>
          {questions.map((q: any, i: number) => (
            <Card key={q.id || i} className="shadow-sm border-border/60">
              <CardContent className="p-6 flex flex-col md:flex-row gap-6">
                <div className="flex-none pt-1">
                  {q.questionType === "essay" ? (
                    <Badge variant="outline" className="text-xs">Essay</Badge>
                  ) : q.isCorrect ?
                    <CheckCircle className="w-8 h-8 text-success" /> :
                    <XCircle className="w-8 h-8 text-destructive" />
                  }
                </div>
                <div className="flex-1 space-y-4">
                  <div className="font-medium text-lg leading-snug text-foreground">
                    <span className="text-muted-foreground mr-2">{i + 1}.</span>
                    {q.prompt}
                  </div>

                  {q.questionType === "essay" ? (
                    <div className="p-3 rounded-lg bg-secondary/30 border border-border/40">
                      <p className="text-sm font-medium text-muted-foreground mb-1">Submitted Answer:</p>
                      <p className="text-foreground whitespace-pre-wrap text-sm">{q.userEssayAnswer || "No answer submitted"}</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <Badge variant="outline" className="bg-card text-muted-foreground border-border/60">Your Answer</Badge>
                        <span className={`font-medium ${q.isCorrect ? 'text-success' : 'text-destructive'}`}>
                          {q.selectedIndex != null && q.options && q.options[q.selectedIndex] !== undefined
                            ? q.options[q.selectedIndex]
                            : 'Skipped'}
                        </span>
                      </div>
                      {!q.isCorrect && q.correctIndex != null && q.options && q.options[q.correctIndex] !== undefined && (
                        <div className="flex gap-2">
                          <Badge variant="outline" className="bg-success/10 text-success border-success/20">Correct Answer</Badge>
                          <span className="font-medium text-success">{q.options[q.correctIndex]}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {(q.explanation || q.reference) && (
                    <div className="bg-secondary/40 p-4 rounded-lg text-sm space-y-2 mt-2">
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
