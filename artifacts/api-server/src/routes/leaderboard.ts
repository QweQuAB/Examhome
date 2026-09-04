import { Router, type IRouter } from "express";
import { eq, desc, sql } from "drizzle-orm";
import { db, leaderboardTable, examsTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/exams/:examId/leaderboard", async (req, res) => {
  const examId = req.params.examId;
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

  const [exam] = await db
    .select({ id: examsTable.id })
    .from(examsTable)
    .where(eq(examsTable.id, examId));
  if (!exam) {
    res.status(404).json({ error: "Exam not found" });
    return;
  }

  const rows = await db
    .select()
    .from(leaderboardTable)
    .where(eq(leaderboardTable.examId, examId))
    .orderBy(desc(leaderboardTable.scorePct), leaderboardTable.elapsedSeconds)
    .limit(limit);

  res.json(rows);
});

router.post("/exams/:examId/leaderboard", async (req, res) => {
  const examId = req.params.examId;
  const { userName, score, total, elapsedSeconds } = req.body;

  if (!userName || typeof userName !== "string" || userName.trim() === "") {
    res.status(400).json({ error: "userName is required" });
    return;
  }
  if (typeof score !== "number" || score < 0) {
    res.status(400).json({ error: "score must be a non-negative number" });
    return;
  }
  if (typeof total !== "number" || total < 1) {
    res.status(400).json({ error: "total must be at least 1" });
    return;
  }

  const [exam] = await db
    .select({ id: examsTable.id })
    .from(examsTable)
    .where(eq(examsTable.id, examId));
  if (!exam) {
    res.status(404).json({ error: "Exam not found" });
    return;
  }

  const scorePct = total > 0 ? (score / total) * 100 : 0;

  const [row] = await db
    .insert(leaderboardTable)
    .values({
      examId,
      userName: userName.trim(),
      score,
      total,
      scorePct,
      elapsedSeconds: elapsedSeconds ?? 0,
    })
    .returning();

  res.status(201).json(row);
});

export default router;
