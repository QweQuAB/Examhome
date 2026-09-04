import { Router, type IRouter } from "express";
import { eq, inArray } from "drizzle-orm";
import { db, attemptsTable, attemptQuestionsTable, questionsTable } from "@workspace/db";

const router: IRouter = Router();

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

function buildGradingPrompt(
  examTitle: string,
  gradingMode: string,
  questions: Array<{
    prompt: string;
    essayAnswer: string | null;
    modelAnswer: string | null;
    reference: string | null;
  }>
) {
  const modeDescriptions: Record<string, string> = {
    lenient: "Be generous with marks. Focus on understanding and effort. Give credit for partial correct answers and key concepts mentioned.",
    moderate: "Apply standard academic grading. Require clear understanding and accurate concepts. Balance between lenient and strict.",
    strict: "Apply rigorous academic standards. Require precise, comprehensive answers with proper terminology and complete coverage.",
  };

  const questionsBlock = questions
    .map(
      (q, i) => `--- Question ${i + 1} ---
Prompt: ${q.prompt}
Student Answer: ${q.essayAnswer || "(no answer provided)"}
Model Answer: ${q.modelAnswer || "(none provided)"}
Reference: ${q.reference || "(none)"}`
    )
    .join("\n\n");

  return `You are an expert university professor grading essay answers for "${examTitle}".

Grading Mode: ${gradingMode.toUpperCase()} — ${modeDescriptions[gradingMode] || modeDescriptions.moderate}

Grade each student answer on a scale of 0-10, providing a letter grade (A+, A, A-, B+, B, B-, C+, C, C-, D, F).

For each question, evaluate:
- Accuracy of content
- Completeness of answer
- Use of proper terminology
- Clarity of explanation

Return ONLY a valid JSON object (no markdown, no code fences) with this exact structure:
{
  "overallGrade": "B+",
  "overallScorePct": 78,
  "overallCommentary": "Brief overall assessment...",
  "perQuestion": [
    {
      "questionIndex": 0,
      "score": 8,
      "gradeLetter": "B+",
      "strengths": "What the student did well",
      "missingPoints": "What was missing or incorrect",
      "feedback": "Detailed professor feedback",
      "idealAnswer": "Model answer or key points that should have been covered"
    }
  ]
}

Questions to grade:
${questionsBlock}`;
}

function heuristicGrade(answer: string, modelAnswer: string | null, mode: string) {
  const wordCount = answer.trim().split(/\s+/).length;
  const hasReference = modelAnswer
    ? modelAnswer
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 4)
        .some((w) => answer.toLowerCase().includes(w))
    : false;

  let base = Math.min(10, Math.max(2, Math.floor(wordCount / 15) + (hasReference ? 3 : 0)));

  if (mode === "lenient") base = Math.min(10, base + 2);
  if (mode === "strict") base = Math.max(0, base - 2);

  const pct = (base / 10) * 100;
  const letter =
    base >= 9 ? "A" : base >= 8 ? "B+" : base >= 7 ? "B" : base >= 6 ? "C+" : base >= 5 ? "C" : base >= 3 ? "D" : "F";

  return { score: base, gradeLetter: letter, pct };
}

router.post("/attempts/:attemptId/grade", async (req, res) => {
  const attemptId = req.params.attemptId;
  const { gradingMode = "moderate" } = req.body;

  if (!["lenient", "moderate", "strict"].includes(gradingMode)) {
    res.status(400).json({ error: "gradingMode must be lenient, moderate, or strict" });
    return;
  }

  const [attempt] = await db
    .select()
    .from(attemptsTable)
    .where(eq(attemptsTable.id, attemptId));
  if (!attempt) {
    res.status(404).json({ error: "Attempt not found" });
    return;
  }

  const aqRows = await db
    .select()
    .from(attemptQuestionsTable)
    .where(eq(attemptQuestionsTable.attemptId, attemptId));

  const essayAqs = aqRows.filter((aq) => aq.selectedIndex === -1);

  if (essayAqs.length === 0) {
    res.status(400).json({ error: "No essay answers found to grade" });
    return;
  }

  const questionIds = essayAqs.map((aq) => aq.questionId);
  const qRows = await db
    .select()
    .from(questionsTable)
    .where(inArray(questionsTable.id, questionIds));

  const qById = new Map(qRows.map((q) => [q.id, q]));

  // Get essay answers from the submitted answer data
  const essayAnswers = essayAqs.map((aq) => {
    const q = qById.get(aq.questionId);
    return {
      prompt: q?.prompt || "",
      essayAnswer: (aq as any).essayAnswer || "",
      modelAnswer: q?.essayAnswer || null,
      reference: q?.reference || null,
    };
  });

  // Try Gemini API first, fall back to heuristic
  let gradingResult: any;
  const apiKey = process.env.GEMINI_API_KEY;

  if (apiKey) {
    try {
      const prompt = buildGradingPrompt(attempt.examId, gradingMode, essayAnswers);
      const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3 },
        }),
        signal: AbortSignal.timeout(30000),
      });

      if (response.ok) {
        const data = (await response.json()) as any;
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          gradingResult = JSON.parse(jsonMatch[0]);
        }
      }
    } catch {
      // Fall through to heuristic grading
    }
  }

  if (!gradingResult) {
    // Heuristic fallback
    const perQuestion = essayAnswers.map((qa, i) => {
      const h = heuristicGrade(qa.essayAnswer, qa.modelAnswer, gradingMode);
      return {
        questionIndex: i,
        score: h.score,
        gradeLetter: h.gradeLetter,
        strengths: qa.essayAnswer ? "Answer provided" : "No answer submitted",
        missingPoints: qa.essayAnswer ? "Could not evaluate without API" : "No answer submitted",
        feedback: "Auto-graded offline. Connect GEMINI_API_KEY for detailed AI grading.",
        idealAnswer: qa.modelAnswer || "No model answer available",
      };
    });

    const totalScore = perQuestion.reduce((sum, p) => sum + p.score, 0);
    const avgPct = Math.round((totalScore / (perQuestion.length * 10)) * 100);
    const avgLetter =
      avgPct >= 90 ? "A" : avgPct >= 80 ? "B" : avgPct >= 70 ? "C" : avgPct >= 60 ? "D" : "F";

    gradingResult = {
      overallGrade: avgLetter,
      overallScorePct: avgPct,
      overallCommentary: "Graded using heuristic scoring. Configure GEMINI_API_KEY for AI-powered grading.",
      perQuestion,
    };
  }

  res.json(gradingResult);
});

export default router;
