import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, questionsTable, examsTable } from "@workspace/db";
import {
  BulkImportQuestionsBody,
  CreateQuestionBody,
  UpdateQuestionBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.post("/exams/:examId/questions", async (req, res) => {
  const examId = req.params.examId;
  const body = CreateQuestionBody.parse(req.body);

  const questionType = body.questionType ?? "mcq";

  if (questionType === "mcq") {
    if (!body.options || body.options.length < 2) {
      res.status(400).json({ error: "MCQ questions require at least 2 options" });
      return;
    }
    if (body.correctIndex === undefined || body.correctIndex < 0 || body.correctIndex >= body.options.length) {
      res.status(400).json({ error: "correctIndex out of range" });
      return;
    }
  }

  const [exam] = await db
    .select({ id: examsTable.id })
    .from(examsTable)
    .where(eq(examsTable.id, examId));
  if (!exam) {
    res.status(404).json({ error: "Exam not found" });
    return;
  }

  const [{ next }] = await db
    .select({
      next: sql<number>`COALESCE(MAX(${questionsTable.position}) + 1, 0)::int`,
    })
    .from(questionsTable)
    .where(eq(questionsTable.examId, examId));

  const [row] = await db
    .insert(questionsTable)
    .values({
      examId,
      questionType: questionType as "mcq" | "essay",
      topic: body.topic ?? null,
      prompt: body.prompt,
      options: body.options ?? [],
      correctIndex: body.correctIndex ?? 0,
      essayAnswer: body.essayAnswer ?? null,
      explanation: body.explanation ?? null,
      reference: body.reference ?? null,
      repeatNote: body.repeatNote ?? null,
      position: next,
    })
    .returning();

  await db
    .update(examsTable)
    .set({ updatedAt: new Date() })
    .where(eq(examsTable.id, examId));

  res.status(201).json(row);
});

router.post("/exams/:examId/questions/bulk", async (req, res) => {
  const examId = req.params.examId;

  // Strip options/correctIndex from essay questions before Zod parsing.
  // The schema marks them .optional(), but older generated versions may not,
  // and an empty options[] fails the .min(2) constraint regardless.
  const sanitized = {
    ...req.body,
    questions: (req.body.questions ?? []).map((q: any) => {
      if (q.questionType === "essay") {
        const { options, correctIndex, ...rest } = q;
        return rest;
      }
      return q;
    }),
  };
  const body = BulkImportQuestionsBody.parse(sanitized);

  const [exam] = await db
    .select({ id: examsTable.id })
    .from(examsTable)
    .where(eq(examsTable.id, examId));
  if (!exam) {
    res.status(404).json({ error: "Exam not found" });
    return;
  }

  for (let i = 0; i < body.questions.length; i++) {
    const q = body.questions[i]!;
    const qType = q.questionType ?? "mcq";
    if (qType === "mcq") {
      if (!q.options || q.options.length < 2) {
        res.status(400).json({
          error: `Question #${i + 1}: MCQ questions require at least 2 options.`,
        });
        return;
      }
      if (q.correctIndex === undefined || q.correctIndex < 0 || q.correctIndex >= q.options.length) {
        res.status(400).json({
          error: `Question #${i + 1}: correctIndex ${q.correctIndex} is out of range for ${q.options.length} options.`,
        });
        return;
      }
    }
  }

  const [{ next }] = await db
    .select({
      next: sql<number>`COALESCE(MAX(${questionsTable.position}) + 1, 0)::int`,
    })
    .from(questionsTable)
    .where(eq(questionsTable.examId, examId));

  const rows = body.questions.map((q, idx) => ({
    examId,
    questionType: (q.questionType ?? "mcq") as "mcq" | "essay",
    topic: q.topic ?? null,
    prompt: q.prompt,
    options: q.options ?? [],
    correctIndex: q.correctIndex ?? 0,
    essayAnswer: q.essayAnswer ?? null,
    explanation: q.explanation ?? null,
    reference: q.reference ?? null,
    repeatNote: q.repeatNote ?? null,
    position: next + idx,
  }));

  const inserted = await db.insert(questionsTable).values(rows).returning({
    id: questionsTable.id,
  });

  await db
    .update(examsTable)
    .set({ updatedAt: new Date() })
    .where(eq(examsTable.id, examId));

  res.status(201).json({ insertedCount: inserted.length, examId });
});

router.patch("/questions/:questionId", async (req, res) => {
  const questionId = req.params.questionId;
  const body = UpdateQuestionBody.parse(req.body);

  const [existing] = await db
    .select()
    .from(questionsTable)
    .where(eq(questionsTable.id, questionId));
  if (!existing) {
    res.status(404).json({ error: "Question not found" });
    return;
  }

  const update: Record<string, unknown> = {};
  if (body.questionType !== undefined) update.questionType = body.questionType;
  if (body.topic !== undefined) update.topic = body.topic;
  if (body.prompt !== undefined) update.prompt = body.prompt;
  if (body.options !== undefined) update.options = body.options;
  if (body.correctIndex !== undefined) update.correctIndex = body.correctIndex;
  if (body.essayAnswer !== undefined) update.essayAnswer = body.essayAnswer;
  if (body.explanation !== undefined) update.explanation = body.explanation;
  if (body.reference !== undefined) update.reference = body.reference;
  if (body.repeatNote !== undefined) update.repeatNote = body.repeatNote;
  if (body.position !== undefined) update.position = body.position;

  const finalType = (update.questionType as string | undefined) ?? existing.questionType;
  if (finalType === "mcq") {
    const finalOptions = (update.options as string[] | undefined) ?? existing.options;
    const finalCorrect =
      (update.correctIndex as number | undefined) ?? existing.correctIndex;
    if (finalCorrect < 0 || finalCorrect >= finalOptions.length) {
      res.status(400).json({ error: "correctIndex out of range" });
      return;
    }
  }

  const [row] = await db
    .update(questionsTable)
    .set(update)
    .where(eq(questionsTable.id, questionId))
    .returning();

  await db
    .update(examsTable)
    .set({ updatedAt: new Date() })
    .where(eq(examsTable.id, existing.examId));

  res.json(row);
});

router.delete("/questions/:questionId", async (req, res) => {
  await db
    .delete(questionsTable)
    .where(eq(questionsTable.id, req.params.questionId));
  res.status(204).send();
});

export default router;
