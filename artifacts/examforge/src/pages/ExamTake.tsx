import { useState, useEffect, useMemo } from "react";
import { useParams, useLocation, Link } from "wouter";
import { useGetExam, useStartAttempt, getGetExamQueryKey } from "@workspace/api-client-react";
import { BookOpen, AlertCircle, Loader2, RefreshCw, Clock, User, PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";

const TIMER_PRESETS = [
  { label: "Untimed", value: null },
  { label: "5 min", value: 5 },
  { label: "10 min", value: 10 },
  { label: "15 min", value: 15 },
  { label: "25 min", value: 25 },
  { label: "30 min", value: 30 },
  { label: "60 min", value: 60 },
];

export default function ExamTake() {
  const { examId } = useParams();
  const [, setLocation] = useLocation();
  const [resumeAttemptId, setResumeAttemptId] = useState<string | null>(null);
  const [timeLimit, setTimeLimit] = useState<number | null>(null);
  const [userName, setUserName] = useState("");
  const [sectionType, setSectionType] = useState<"mcq" | "essay" | null>(null);

  const { data: exam, isLoading } = useGetExam(examId!, {
    query: { enabled: !!examId, queryKey: getGetExamQueryKey(examId!) }
  });

  const startAttempt = useStartAttempt();

  useEffect(() => {
    if (examId) {
      const saved = localStorage.getItem(`examforge_resume_${examId}`);
      if (saved) {
        setResumeAttemptId(saved);
      }
      const savedName = localStorage.getItem("examforge_user_name");
      if (savedName) setUserName(savedName);
    }
  }, [examId]);

  const questionTypes = useMemo(() => {
    if (!exam?.questions) return { hasMcq: false, hasEssay: false };
    const hasMcq = exam.questions.some((q: any) => q.questionType === "mcq");
    const hasEssay = exam.questions.some((q: any) => q.questionType === "essay");
    return { hasMcq, hasEssay };
  }, [exam?.questions]);

  const effectiveSectionType = useMemo(() => {
    if (sectionType) return sectionType;
    if (questionTypes.hasMcq && !questionTypes.hasEssay) return "mcq";
    if (!questionTypes.hasMcq && questionTypes.hasEssay) return "essay";
    return "mcq";
  }, [sectionType, questionTypes]);

  const handleStart = () => {
    if (userName.trim()) {
      localStorage.setItem("examforge_user_name", userName.trim());
    }
    startAttempt.mutate({
      examId: examId!,
      data: {
        shuffleQuestions: true,
        shuffleOptions: true,
        sectionType: effectiveSectionType,
        timeLimitMinutes: timeLimit,
        userName: userName.trim() || undefined,
      }
    }, {
      onSuccess: (attempt) => {
        localStorage.setItem(`examforge_resume_${examId}`, attempt.id);
        setLocation(`/attempts/${attempt.id}`);
      }
    });
  };

  const handleResume = () => {
    if (resumeAttemptId) {
      setLocation(`/attempts/${resumeAttemptId}`);
    }
  };

  if (isLoading) {
    return <div className="max-w-2xl mx-auto py-20 space-y-4"><Skeleton className="h-64 w-full" /></div>;
  }

  if (!exam) {
    return <div className="text-center py-20 text-muted-foreground">Exam not found</div>;
  }

  const questions = exam.questions || [];

  if (questions.length === 0) {
    return (
      <div className="max-w-2xl mx-auto py-20">
        <Card className="border-border/60 shadow-sm text-center py-12">
          <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
          <h2 className="text-xl font-medium mb-2">No Questions Available</h2>
          <p className="text-muted-foreground mb-6">This exam doesn't have any questions yet.</p>
          <Link href={`/exams/${exam.id}`}>
            <Button>Back to Exam</Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto w-full animate-in fade-in zoom-in-95 duration-500 pt-6 sm:pt-10 px-3 sm:px-4 overflow-x-hidden">
      <Card className="border-primary shadow-xl bg-gradient-to-b from-card to-card/50 overflow-hidden">
        <div className="h-2 w-full bg-primary"></div>
        <CardContent className="pt-6 sm:pt-12 pb-8 sm:pb-12 px-4 sm:px-8 text-center">
          {exam.courseCode && (
             <div className="inline-block bg-primary text-primary-foreground font-bold text-xs tracking-wider px-3 py-1 rounded-full mb-4">
               {exam.courseCode}
             </div>
          )}
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-serif font-bold text-primary mb-3 sm:mb-4 leading-tight">
            {exam.title}
          </h1>
          <p className="text-muted-foreground bg-accent/10 border-l-4 border-accent p-2 sm:p-3 rounded-r-lg inline-block text-left text-xs sm:text-sm max-w-md mx-auto mb-6 sm:mb-10">
            <span className="text-accent font-bold">Note:</span> Key topics that repeat in final exams are marked with a star. Pay attention to the explanations.
          </p>

          <div className="flex flex-wrap justify-center gap-4 sm:gap-6 mb-6 sm:mb-10">
            <div className="bg-secondary rounded-2xl p-3 sm:p-4 min-w-[80px] sm:min-w-[100px]">
              <div className="text-2xl sm:text-3xl font-bold text-primary">{questions.length}</div>
              <div className="text-[10px] sm:text-xs text-muted-foreground font-medium mt-1">QUESTIONS</div>
            </div>
            <div className="bg-secondary rounded-2xl p-3 sm:p-4 min-w-[80px] sm:min-w-[100px]">
              <div className="text-2xl sm:text-3xl font-bold text-primary"><RefreshCw className="w-6 h-6 sm:w-8 sm:h-8 mx-auto" /></div>
              <div className="text-[10px] sm:text-xs text-muted-foreground font-medium mt-1">SHUFFLED</div>
            </div>
          </div>

          {/* Quiz Configuration */}
          <div className="max-w-sm mx-auto space-y-3 sm:space-y-4 mb-6 sm:mb-10 text-left">
            <div>
              <label className="text-xs sm:text-sm font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5">
                <User className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> Your Name (optional, for leaderboard)
              </label>
              <Input
                type="text"
                placeholder="Enter your name"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                className="bg-secondary/50"
              />
            </div>

            {questionTypes.hasMcq && questionTypes.hasEssay && (
              <div>
                <label className="text-xs sm:text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                  <PenLine className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> Section
                </label>
                <div className="flex gap-2">
                  <Button
                    variant={effectiveSectionType === "mcq" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSectionType("mcq")}
                    className="text-xs"
                  >
                    MCQ
                  </Button>
                  <Button
                    variant={effectiveSectionType === "essay" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSectionType("essay")}
                    className="text-xs"
                  >
                    Essay
                  </Button>
                </div>
              </div>
            )}

            <div>
              <label className="text-xs sm:text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> Time Limit
              </label>
              <div className="flex flex-wrap gap-2">
                {TIMER_PRESETS.map((p) => (
                  <Button
                    key={p.label}
                    variant={timeLimit === p.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTimeLimit(p.value)}
                    className="text-xs"
                  >
                    {p.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-center gap-3 sm:gap-4">
            <Button
              size="lg"
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-base sm:text-lg px-6 sm:px-8 py-4 sm:py-6 h-auto"
              onClick={handleStart}
              disabled={startAttempt.isPending}
            >
              {startAttempt.isPending ? <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin mr-2"/> : <BookOpen className="w-4 h-4 sm:w-5 sm:h-5 mr-2"/>}
              Start New Quiz
            </Button>

            {resumeAttemptId && (
              <Button
                size="lg"
                variant="outline"
                className="font-semibold text-base sm:text-lg px-6 sm:px-8 py-4 sm:py-6 h-auto"
                onClick={handleResume}
              >
                Resume Saved
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
