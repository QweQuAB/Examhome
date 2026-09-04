import { Router, type IRouter } from "express";
import { eq, desc, sql, asc } from "drizzle-orm";
import {
  db,
  examsTable,
  questionsTable,
  attemptsTable,
  attemptQuestionsTable,
  type AttemptQuestionRow,
  type AttemptRow,
  type ExamRow,
  type QuestionRow,
} from "@workspace/db";
import {
  StartAttemptBody,
  SubmitAnswerBody,
  ListAttemptsForExamQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

function serializeAttempt(
  attempt: AttemptRow,
  exam: Pick<ExamRow, "title" | "courseCode">,
  rows: { aq: AttemptQuestionRow; q: QuestionRow }[],
) {
  const total = rows.length;
  const score = attempt.score;
  const scorePct = total > 0 ? (score / total) * 100 : 0;
  return {
    id: attempt.id,
    examId: attempt.examId,
    examTitle: exam.title,
    examCourseCode: exam.courseCode,
    startedAt: attempt.startedAt,
    finishedAt: attempt.finishedAt,
    score,
    total,
    scorePct,
    status: attempt.status,
    userName: attempt.userName,
    sectionType: attempt.sectionType,
    timeLimitMinutes: attempt.timeLimitMinutes,
    elapsedSeconds: attempt.elapsedSeconds,
    questions: rows.map(({ aq, q }) => {
      const isAnswered = aq.selectedIndex !== null;
      const orderedOptions = aq.optionOrder.map((idx) => q.options[idx]!);
      return {
        id: aq.id,
        questionId: q.id,
        questionType: q.questionType,
        topic: q.topic,
        prompt: q.prompt,
        options: orderedOptions,
        essayAnswer: q.essayAnswer,
        explanation: q.explanation,
        reference: q.reference,
        repeatNote: q.repeatNote,
        position: aq.position,
        selectedIndex: aq.selectedIndex,
        // Reveal correctIndex only after the user has answered this question
        correctIndex: isAnswered ? aq.correctIndex : null,
        isAnswered,
        isCorrect: isAnswered ? aq.isCorrect === 1 : null,
      };
    }),
  };
}

async function loadAttemptDetail(attemptId: string) {
  const [attempt] = await db
    .select()
    .from(attemptsTable)
    .where(eq(attemptsTable.id, attemptId));
  if (!attempt) return null;
  const [exam] = await db
    .select({ title: examsTable.title, courseCode: examsTable.courseCode })
    .from(examsTable)
    .where(eq(examsTable.id, attempt.examId));
  if (!exam) return null;

  const aqRows = await db
    .select()
    .from(attemptQuestionsTable)
    .where(eq(attemptQuestionsTable.attemptId, attemptId))
    .orderBy(asc(attemptQuestionsTable.position));

  if (aqRows.length === 0) {
    return serializeAttempt(attempt, exam, []);
  }

  const qRows = await db
    .select()
    .from(questionsTable)
    .where(
      sql`${questionsTable.id} IN (${sql.join(
        aqRows.map((r) => sql`${r.questionId}`),
        sql`, `,
      )})`,
    );
  const qById = new Map(qRows.map((q) => [q.id, q] as const));
  const merged = aqRows
    .map((aq) => {
      const q = qById.get(aq.questionId);
      return q ? { aq, q } : null;
    })
    .filter((x): x is { aq: AttemptQuestionRow; q: QuestionRow } => x !== null);

  return serializeAttempt(attempt, exam, merged);
}

router.post("/exams/:examId/attempts", async (req, res) => {
  const examId = req.params.examId;
  const body = StartAttemptBody.parse(req.body ?? {});
  const shuffleQs = body.shuffleQuestions ?? true;
  const shuffleOpts = body.shuffleOptions ?? true;
  const sectionType = body.sectionType ?? "mcq";

  const [exam] = await db
    .select()
    .from(examsTable)
    .where(eq(examsTable.id, examId));
  if (!exam) {
    res.status(404).json({ error: "Exam not found" });
    return;
  }

  const allQuestions = await db
    .select()
    .from(questionsTable)
    .where(eq(questionsTable.examId, examId))
    .orderBy(questionsTable.position, questionsTable.createdAt);

  if (allQuestions.length === 0) {
    res.status(400).json({ error: "Exam has no questions" });
    return;
  }

  // Filter questions by section type
  const filteredQuestions = allQuestions.filter((q) => q.questionType === sectionType);
  if (filteredQuestions.length === 0) {
    res.status(400).json({ error: `No ${sectionType.toUpperCase()} questions found` });
    return;
  }

  const ordered = shuffleQs ? shuffle(filteredQuestions) : filteredQuestions;

  const [attempt] = await db
    .insert(attemptsTable)
    .values({
      examId,
      total: ordered.length,
      score: 0,
      status: "in_progress",
      sectionType: sectionType as "mcq" | "essay",
      timeLimitMinutes: body.timeLimitMinutes ?? null,
      userName: body.userName ?? null,
    })
    .returning();
  if (!attempt) {
    res.status(500).json({ error: "Failed to create attempt" });
    return;
  }

  const aqInserts = ordered.map((q, i) => {
    const indices = q.options.map((_, idx) => idx);
    const order = shuffleOpts ? shuffle(indices) : indices;
    const correctInOrder = order.indexOf(q.correctIndex);
    return {
      attemptId: attempt.id,
      questionId: q.id,
      position: i,
      optionOrder: order,
      correctIndex: correctInOrder,
    };
  });

  await db.insert(attemptQuestionsTable).values(aqInserts);

  const detail = await loadAttemptDetail(attempt.id);
  res.status(201).json(detail);
});

router.get("/exams/:examId/attempts", async (req, res) => {
  const examId = req.params.examId;
  const q = ListAttemptsForExamQueryParams.parse(req.query);
  const limit = q.limit ?? 10;

  const rows = await db
    .select({
      id: attemptsTable.id,
      examId: attemptsTable.examId,
      examTitle: examsTable.title,
      examCourseCode: examsTable.courseCode,
      startedAt: attemptsTable.startedAt,
      finishedAt: attemptsTable.finishedAt,
      score: attemptsTable.score,
      total: attemptsTable.total,
      status: attemptsTable.status,
    })
    .from(attemptsTable)
    .innerJoin(examsTable, eq(attemptsTable.examId, examsTable.id))
    .where(eq(attemptsTable.examId, examId))
    .orderBy(desc(attemptsTable.startedAt))
    .limit(limit);

  res.json(
    rows.map((r) => ({
      ...r,
      scorePct: r.total > 0 ? (r.score / r.total) * 100 : 0,
    })),
  );
});

router.get("/attempts/:attemptId", async (req, res) => {
  const detail = await loadAttemptDetail(req.params.attemptId);
  if (!detail) {
    res.status(404).json({ error: "Attempt not found" });
    return;
  }
  res.json(detail);
});

router.post("/attempts/:attemptId/answers", async (req, res) => {
  const attemptId = req.params.attemptId;
  const body = SubmitAnswerBody.parse(req.body);

  const [attempt] = await db
    .select()
    .from(attemptsTable)
    .where(eq(attemptsTable.id, attemptId));
  if (!attempt) {
    res.status(404).json({ error: "Attempt not found" });
    return;
  }
  if (attempt.status !== "in_progress") {
    res.status(409).json({ error: "Attempt already finished" });
    return;
  }

  // Update elapsed time if provided
  if (body.elapsedSeconds !== undefined) {
    await db
      .update(attemptsTable)
      .set({ elapsedSeconds: body.elapsedSeconds })
      .where(eq(attemptsTable.id, attemptId));
  }

  const [aq] = await db
    .select()
    .from(attemptQuestionsTable)
    .where(eq(attemptQuestionsTable.id, body.attemptQuestionId));
  if (!aq || aq.attemptId !== attemptId) {
    res.status(404).json({ error: "Attempt question not found" });
    return;
  }
  if (aq.selectedIndex !== null) {
    res.status(409).json({ error: "Question already answered" });
    return;
  }

  // Handle essay answers (no correctIndex comparison)
  if (body.essayAnswer !== undefined) {
    await db
      .update(attemptQuestionsTable)
      .set({
        selectedIndex: -1, // Essay questions don't have a selected index
        isCorrect: null, // Essay correctness is determined by AI grading later
        answeredAt: new Date(),
      })
      .where(eq(attemptQuestionsTable.id, aq.id));

    res.json({
      attemptQuestionId: aq.id,
      selectedIndex: null,
      correctIndex: null,
      isCorrect: null,
      score: attempt.score,
      total: attempt.total,
      essayAnswer: body.essayAnswer,
    });
    return;
  }

  // MCQ answer handling
  if (body.selectedIndex === undefined) {
    res.status(400).json({ error: "selectedIndex required for MCQ questions" });
    return;
  }

  const isCorrect = body.selectedIndex === aq.correctIndex;
  await db
    .update(attemptQuestionsTable)
    .set({
      selectedIndex: body.selectedIndex,
      isCorrect: isCorrect ? 1 : 0,
      answeredAt: new Date(),
    })
    .where(eq(attemptQuestionsTable.id, aq.id));

  let newScore = attempt.score;
  if (isCorrect) {
    newScore += 1;
    await db
      .update(attemptsTable)
      .set({ score: newScore })
      .where(eq(attemptsTable.id, attemptId));
  }

  res.json({
    attemptQuestionId: aq.id,
    selectedIndex: body.selectedIndex,
    correctIndex: aq.correctIndex,
    isCorrect,
    score: newScore,
    total: attempt.total,
  });
});

router.post("/attempts/:attemptId/finish", async (req, res) => {
  const attemptId = req.params.attemptId;
  const body = req.body ? req.body : {};
  const [attempt] = await db
    .select()
    .from(attemptsTable)
    .where(eq(attemptsTable.id, attemptId));
  if (!attempt) {
    res.status(404).json({ error: "Attempt not found" });
    return;
  }
  if (attempt.status !== "finished") {
    const updateData: Record<string, unknown> = {
      status: "finished",
      finishedAt: new Date(),
    };
    if (body.elapsedSeconds !== undefined) {
      updateData.elapsedSeconds = body.elapsedSeconds;
    }
    await db
      .update(attemptsTable)
      .set(updateData)
      .where(eq(attemptsTable.id, attemptId));
  }
  const detail = await loadAttemptDetail(attemptId);
  res.json(detail);
});

export default router;
