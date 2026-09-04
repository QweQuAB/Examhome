import { Router, type IRouter } from "express";
import { eq, ilike, desc, sql, and } from "drizzle-orm";
import {
  db,
  examsTable,
  questionsTable,
  attemptsTable,
} from "@workspace/db";
import {
  CreateExamBody,
  UpdateExamBody,
  ListExamsQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/exams", async (req, res) => {
  const params = ListExamsQueryParams.parse(req.query);
  const search = params.search?.trim();

  const baseQuery = db
    .select({
      id: examsTable.id,
      title: examsTable.title,
      courseCode: examsTable.courseCode,
      institution: examsTable.institution,
      description: examsTable.description,
      createdAt: examsTable.createdAt,
      updatedAt: examsTable.updatedAt,
      questionCount: sql<number>`COALESCE((
        SELECT COUNT(*)::int FROM "questions" WHERE "questions"."exam_id" = "exams"."id"
      ), 0)`,
      attemptCount: sql<number>`COALESCE((
        SELECT COUNT(*)::int FROM "attempts" WHERE "attempts"."exam_id" = "exams"."id"
      ), 0)`,
      avgScorePct: sql<number | null>`(
        SELECT AVG(
          CASE WHEN "attempts"."total" > 0
            THEN ("attempts"."score"::float / "attempts"."total"::float) * 100
            ELSE NULL END
        )::float
        FROM "attempts"
        WHERE "attempts"."exam_id" = "exams"."id"
          AND "attempts"."status" = 'finished'
      )`,
    })
    .from(examsTable)
    .orderBy(desc(examsTable.updatedAt));

  const rows = search
    ? await baseQuery.where(ilike(examsTable.title, `%${search}%`))
    : await baseQuery;

  res.json(rows);
});

router.post("/exams", async (req, res) => {
  const body = CreateExamBody.parse(req.body);
  const [row] = await db
    .insert(examsTable)
    .values({
      title: body.title,
      courseCode: body.courseCode ?? null,
      institution: body.institution ?? null,
      description: body.description ?? null,
    })
    .returning();
  res.status(201).json(row);
});

router.get("/exams/:examId", async (req, res) => {
  const examId = req.params.examId;
  const [exam] = await db
    .select()
    .from(examsTable)
    .where(eq(examsTable.id, examId));
  if (!exam) {
    res.status(404).json({ error: "Exam not found" });
    return;
  }
  const questions = await db
    .select()
    .from(questionsTable)
    .where(eq(questionsTable.examId, examId))
    .orderBy(questionsTable.position, questionsTable.createdAt);
  res.json({ ...exam, questions });
});

router.patch("/exams/:examId", async (req, res) => {
  const examId = req.params.examId;
  const body = UpdateExamBody.parse(req.body);
  const update: Record<string, unknown> = { updatedAt: new Date() };
  if (body.title !== undefined) update.title = body.title;
  if (body.courseCode !== undefined) update.courseCode = body.courseCode;
  if (body.institution !== undefined) update.institution = body.institution;
  if (body.description !== undefined) update.description = body.description;
  const [row] = await db
    .update(examsTable)
    .set(update)
    .where(eq(examsTable.id, examId))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Exam not found" });
    return;
  }
  res.json(row);
});

router.delete("/exams/:examId", async (req, res) => {
  await db.delete(examsTable).where(eq(examsTable.id, req.params.examId));
  res.status(204).send();
});

router.get("/exams/:examId/stats", async (req, res) => {
  const examId = req.params.examId;
  const [exam] = await db
    .select({ id: examsTable.id })
    .from(examsTable)
    .where(eq(examsTable.id, examId));
  if (!exam) {
    res.status(404).json({ error: "Exam not found" });
    return;
  }

  const [counts] = await db.execute<{
    questionCount: number;
    attemptCount: number;
    avgScorePct: number | null;
    bestScorePct: number | null;
  }>(sql`
    SELECT
      (SELECT COUNT(*)::int FROM "questions" WHERE "exam_id" = ${examId}) AS "questionCount",
      (SELECT COUNT(*)::int FROM "attempts" WHERE "exam_id" = ${examId}) AS "attemptCount",
      (SELECT AVG(
        CASE WHEN "total" > 0
          THEN ("score"::float / "total"::float) * 100
          ELSE NULL END
      )::float FROM "attempts" WHERE "exam_id" = ${examId} AND "status" = 'finished') AS "avgScorePct",
      (SELECT MAX(
        CASE WHEN "total" > 0
          THEN ("score"::float / "total"::float) * 100
          ELSE NULL END
      )::float FROM "attempts" WHERE "exam_id" = ${examId} AND "status" = 'finished') AS "bestScorePct"
  `).then((r) => r.rows);

  const topicRows = await db
    .select({
      topic: sql<string>`COALESCE(${questionsTable.topic}, 'General')`,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(questionsTable)
    .where(eq(questionsTable.examId, examId))
    .groupBy(sql`COALESCE(${questionsTable.topic}, 'General')`)
    .orderBy(desc(sql`COUNT(*)`));

  const repeatRows = await db
    .select({
      questionId: questionsTable.id,
      prompt: questionsTable.prompt,
      repeatNote: questionsTable.repeatNote,
    })
    .from(questionsTable)
    .where(
      and(
        eq(questionsTable.examId, examId),
        sql`${questionsTable.repeatNote} IS NOT NULL`,
      ),
    )
    .orderBy(questionsTable.position);

  res.json({
    examId,
    questionCount: counts?.questionCount ?? 0,
    attemptCount: counts?.attemptCount ?? 0,
    avgScorePct: counts?.avgScorePct ?? null,
    bestScorePct: counts?.bestScorePct ?? null,
    topicBreakdown: topicRows,
    repeatHotlist: repeatRows.map((r) => ({
      questionId: r.questionId,
      prompt: r.prompt,
      repeatNote: r.repeatNote ?? "",
    })),
  });
});

export default router;
