import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, GraduationCap, CheckCircle, XCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface GradingResult {
  overallGrade: string;
  overallScorePct: number;
  overallCommentary: string;
  perQuestion: Array<{
    questionIndex: number;
    score: number;
    gradeLetter: string;
    strengths: string;
    missingPoints: string;
    feedback: string;
    idealAnswer: string;
  }>;
}

interface AiGradingCardProps {
  attemptId: string;
  examTitle: string;
}

export function AiGradingCard({ attemptId, examTitle }: AiGradingCardProps) {
  const [mode, setMode] = useState<"lenient" | "moderate" | "strict">("moderate");
  const [result, setResult] = useState<GradingResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGrade = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await customFetch<GradingResult>(`/api/attempts/${attemptId}/grade`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gradingMode: mode }),
      });
      setResult(data);
    } catch (err: any) {
      setError(err?.message || "Grading failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const scoreColor =
    result && result.overallScorePct >= 80
      ? "text-success"
      : result && result.overallScorePct >= 60
        ? "text-yellow-500"
        : "text-destructive";

  return (
    <Card className="border-accent/30 shadow-md">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <GraduationCap className="w-5 h-5 text-accent" />
          AI Professor Grading
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!result && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Grade essay answers using AI-powered analysis.
            </p>
            <div className="flex gap-2">
              {(["lenient", "moderate", "strict"] as const).map((m) => (
                <Button
                  key={m}
                  variant={mode === m ? "default" : "outline"}
                  size="sm"
                  onClick={() => setMode(m)}
                  className="text-xs capitalize"
                >
                  {m}
                </Button>
              ))}
            </div>
            <Button
              onClick={handleGrade}
              disabled={loading}
              className="gap-2 bg-accent hover:bg-accent/90 text-accent-foreground"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <GraduationCap className="w-4 h-4" />}
              {loading ? "Grading..." : "Grade with AI Professor"}
            </Button>
          </div>
        )}

        {error && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
            {error}
          </div>
        )}

        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <div className="flex items-center gap-4 p-4 bg-secondary/50 rounded-xl">
                <div className={`text-4xl font-black ${scoreColor}`}>
                  {result.overallGrade}
                </div>
                <div>
                  <div className={`text-2xl font-bold ${scoreColor}`}>{result.overallScorePct}%</div>
                  <div className="text-sm text-muted-foreground">Overall Score</div>
                </div>
              </div>

              <p className="text-sm text-muted-foreground">{result.overallCommentary}</p>

              <div className="space-y-3">
                {result.perQuestion.map((pq, i) => (
                  <div key={i} className="p-3 border border-border/60 rounded-lg space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">Q{pq.questionIndex + 1}</Badge>
                      <span className="font-bold text-sm">{pq.score}/10</span>
                      <Badge variant="secondary" className="text-xs">{pq.gradeLetter}</Badge>
                    </div>
                    <p className="text-sm">{pq.feedback}</p>
                    {pq.strengths && (
                      <div className="flex items-start gap-1 text-xs text-success">
                        <CheckCircle className="w-3 h-3 mt-0.5 shrink-0" />
                        {pq.strengths}
                      </div>
                    )}
                    {pq.missingPoints && (
                      <div className="flex items-start gap-1 text-xs text-destructive">
                        <XCircle className="w-3 h-3 mt-0.5 shrink-0" />
                        {pq.missingPoints}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <Button variant="outline" size="sm" onClick={() => setResult(null)}>
                Grade Again
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
