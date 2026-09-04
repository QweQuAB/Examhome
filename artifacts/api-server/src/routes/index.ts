import { Router, type IRouter } from "express";
import healthRouter from "./health";
import dashboardRouter from "./dashboard";
import examsRouter from "./exams";
import questionsRouter from "./questions";
import attemptsRouter from "./attempts";
import leaderboardRouter from "./leaderboard";
import userPreferencesRouter from "./user-preferences";
import gradingRouter from "./grading";

const router: IRouter = Router();

router.use(healthRouter);
router.use(dashboardRouter);
router.use(examsRouter);
router.use(questionsRouter);
router.use(attemptsRouter);
router.use(leaderboardRouter);
router.use(userPreferencesRouter);
router.use(gradingRouter);

export default router;
