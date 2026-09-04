import { Router, type IRouter } from "express";
import { eq, desc, sql } from "drizzle-orm";
import {
  db,
  examsTable,
  questionsTable,
  attemptsTable,
} from "@workspace/db";
import { GetRecentAttemptsQueryParams } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/dashboard", async (_req, res) => {
  const [counts] = await db
    .select({
      examCount: sql<number>`(SELECT COUNT(*)::int FROM ${examsTable})`,
      questionCount: sql<number>`(SELECT COUNT(*)::int FROM ${questionsTable})`,
      attemptCount: sql<number>`(SELECT COUNT(*)::int FROM ${attemptsTable})`,
      finishedAttemptCount: sql<number>`(
        SELECT COUNT(*)::int FROM ${attemptsTable}
        WHERE ${attemptsTable.status} = 'finished'
      )`,
      avgScorePct: sql<number | null>`(
        SELECT AVG(
          CASE WHEN ${attemptsTable.total} > 0
            THEN (${attemptsTable.score}::float / ${attemptsTable.total}::float) * 100
            ELSE NULL END
        )::float
        FROM ${attemptsTable}
        WHERE ${attemptsTable.status} = 'finished'
      )`,
    })
    .from(sql`(SELECT 1) AS dummy`);

  const topExams = await db
    .select({
      examId: examsTable.id,
      title: examsTable.title,
      courseCode: examsTable.courseCode,
      attemptCount: sql<number>`COUNT(${attemptsTable.id})::int`,
      avgScorePct: sql<number | null>`AVG(
        CASE WHEN ${attemptsTable.total} > 0 AND ${attemptsTable.status} = 'finished'
          THEN (${attemptsTable.score}::float / ${attemptsTable.total}::float) * 100
          ELSE NULL END
      )::float`,
    })
    .from(examsTable)
    .leftJoin(attemptsTable, eq(attemptsTable.examId, examsTable.id))
    .groupBy(examsTable.id, examsTable.title, examsTable.courseCode)
    .orderBy(desc(sql`COUNT(${attemptsTable.id})`))
    .limit(5);

  res.json({
    examCount: counts?.examCount ?? 0,
    questionCount: counts?.questionCount ?? 0,
    attemptCount: counts?.attemptCount ?? 0,
    finishedAttemptCount: counts?.finishedAttemptCount ?? 0,
    avgScorePct: counts?.avgScorePct ?? null,
    topExams,
  });
});

router.get("/dashboard/recent-attempts", async (req, res) => {
  const params = GetRecentAttemptsQueryParams.parse(req.query);
  const limit = params.limit ?? 10;

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
    .orderBy(desc(attemptsTable.startedAt))
    .limit(limit);

  res.json(
    rows.map((r) => ({
      ...r,
      scorePct: r.total > 0 ? (r.score / r.total) * 100 : 0,
    })),
  );
});

export default router;
