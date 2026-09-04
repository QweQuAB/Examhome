import {
  pgTable,
  text,
  integer,
  real,
  timestamp,
  jsonb,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const attemptStatusEnum = pgEnum("attempt_status", [
  "in_progress",
  "finished",
]);

export const questionTypeEnum = pgEnum("question_type", ["mcq", "essay"]);

export const examsTable = pgTable("exams", {
  id: text("id")
    .primaryKey()
    .default(sql`gen_random_uuid()::text`),
  title: text("title").notNull(),
  courseCode: text("course_code"),
  institution: text("institution"),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const questionsTable = pgTable(
  "questions",
  {
    id: text("id")
      .primaryKey()
      .default(sql`gen_random_uuid()::text`),
    examId: text("exam_id")
      .notNull()
      .references(() => examsTable.id, { onDelete: "cascade" }),
    questionType: questionTypeEnum("question_type").notNull().default("mcq"),
    topic: text("topic"),
    prompt: text("prompt").notNull(),
    options: jsonb("options").notNull().$type<string[]>().default(sql`'[]'::jsonb`),
    correctIndex: integer("correct_index").notNull().default(0),
    essayAnswer: text("essay_answer"),
    explanation: text("explanation"),
    reference: text("reference"),
    repeatNote: text("repeat_note"),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("questions_exam_id_idx").on(t.examId, t.position)],
);

export const attemptsTable = pgTable(
  "attempts",
  {
    id: text("id")
      .primaryKey()
      .default(sql`gen_random_uuid()::text`),
    examId: text("exam_id")
      .notNull()
      .references(() => examsTable.id, { onDelete: "cascade" }),
    status: attemptStatusEnum("status").notNull().default("in_progress"),
    score: integer("score").notNull().default(0),
    total: integer("total").notNull().default(0),
    userName: text("user_name"),
    sectionType: text("section_type").notNull().default("mcq"),
    timeLimitMinutes: integer("time_limit_minutes"),
    elapsedSeconds: integer("elapsed_seconds").notNull().default(0),
    startedAt: timestamp("started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (t) => [index("attempts_exam_id_idx").on(t.examId, t.startedAt)],
);

export const attemptQuestionsTable = pgTable(
  "attempt_questions",
  {
    id: text("id")
      .primaryKey()
      .default(sql`gen_random_uuid()::text`),
    attemptId: text("attempt_id")
      .notNull()
      .references(() => attemptsTable.id, { onDelete: "cascade" }),
    questionId: text("question_id")
      .notNull()
      .references(() => questionsTable.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    /** indices into the original question.options, in the order shown to the user */
    optionOrder: jsonb("option_order").notNull().$type<number[]>(),
    /** correctIndex remapped into the shuffled order */
    correctIndex: integer("correct_index").notNull(),
    /** what the user picked, in the shuffled order */
    selectedIndex: integer("selected_index"),
    isCorrect: integer("is_correct"),
    /** essay answer text submitted by the user */
    essayAnswer: text("essay_answer"),
    answeredAt: timestamp("answered_at", { withTimezone: true }),
  },
  (t) => [index("attempt_questions_attempt_id_idx").on(t.attemptId, t.position)],
);

export type ExamRow = typeof examsTable.$inferSelect;
export type QuestionRow = typeof questionsTable.$inferSelect;
export type AttemptRow = typeof attemptsTable.$inferSelect;
export type AttemptQuestionRow = typeof attemptQuestionsTable.$inferSelect;

export const leaderboardTable = pgTable(
  "leaderboard",
  {
    id: text("id")
      .primaryKey()
      .default(sql`gen_random_uuid()::text`),
    examId: text("exam_id")
      .notNull()
      .references(() => examsTable.id, { onDelete: "cascade" }),
    userName: text("user_name").notNull(),
    score: integer("score").notNull().default(0),
    total: integer("total").notNull().default(0),
    scorePct: real("score_pct").notNull().default(0),
    elapsedSeconds: integer("elapsed_seconds").notNull().default(0),
    completedAt: timestamp("completed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("leaderboard_exam_id_idx").on(t.examId, t.scorePct)],
);

export const userPreferencesTable = pgTable("user_preferences", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type LeaderboardRow = typeof leaderboardTable.$inferSelect;
export type UserPreferenceRow = typeof userPreferencesTable.$inferSelect;
