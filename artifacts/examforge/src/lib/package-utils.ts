// Package export/import utilities for ExamForge

export interface ExamPackageExport {
  formatIdentifier: "EXAMFORGE_PACKAGE";
  schemaVersion: number;
  packageId: string;
  title: string;
  courseCode?: string | null;
  institution?: string | null;
  description?: string | null;
  category?: string;
  author?: string;
  authorRole?: string;
  tags?: string[];
  exportedAt: number;
  questions: QuestionExport[];
}

export interface QuestionExport {
  id: string;
  questionType: "mcq" | "essay";
  topic?: string | null;
  prompt: string;
  options: string[];
  correctIndex: number | null;
  explanation?: string | null;
  reference?: string | null;
  repeatNote?: string | null;
  position: number;
}

/**
 * Generate a UUID v4
 */
function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Clean a string for use as filename
 */
function cleanFilename(name: string, maxLength = 30): string {
  return name
    .replace(/[^a-zA-Z0-9\s-_]/g, "")
    .replace(/\s+/g, "_")
    .slice(0, maxLength);
}

/**
 * Build an ExamPackageExport from exam and questions
 */
export function buildExamPackage(
  exam: {
    id: string;
    title: string;
    courseCode?: string | null;
    institution?: string | null;
    description?: string | null;
  },
  questions: Array<{
    id: string;
    questionType?: string;
    topic?: string | null;
    prompt: string;
    options: string[];
    correctIndex?: number;
    essayAnswer?: string | null;
    explanation?: string | null;
    reference?: string | null;
    repeatNote?: string | null;
  }>,
  options?: {
    author?: string;
    category?: string;
    tags?: string[];
  }
): ExamPackageExport {
  const mcqQuestions = questions
    .filter((q) => !q.questionType || q.questionType === "mcq")
    .map((q, i) => ({
      id: q.id,
      questionType: "mcq" as const,
      topic: q.topic || null,
      prompt: q.prompt,
      options: q.options,
      correctIndex: q.correctIndex ?? 0,
      explanation: q.explanation || null,
      reference: q.reference || null,
      repeatNote: q.repeatNote || null,
      position: i,
    }));

  const essayQuestions = questions
    .filter((q) => q.questionType === "essay")
    .map((q, i) => ({
      id: q.id,
      questionType: "essay" as const,
      topic: q.topic || null,
      prompt: q.prompt,
      options: [],
      correctIndex: null,
      explanation: q.explanation || null,
      reference: q.reference || null,
      repeatNote: q.repeatNote || null,
      position: i + mcqQuestions.length,
    }));

  return {
    formatIdentifier: "EXAMFORGE_PACKAGE",
    schemaVersion: 1,
    packageId: exam.id,
    title: exam.title,
    courseCode: exam.courseCode || undefined,
    institution: exam.institution || undefined,
    description: exam.description || undefined,
    category: options?.category || "General",
    author: options?.author || "ExamForge User",
    authorRole: "Creator",
    tags: options?.tags || [],
    exportedAt: Date.now(),
    questions: [...mcqQuestions, ...essayQuestions],
  };
}

/**
 * Build a single-question package for sharing
 */
export function buildSingleQuestionPackage(
  exam: { title: string; courseCode?: string | null },
  question: {
    id: string;
    questionType?: string;
    topic?: string | null;
    prompt: string;
    options: string[];
    correctIndex?: number;
    explanation?: string | null;
    reference?: string | null;
  }
): ExamPackageExport {
  return {
    formatIdentifier: "EXAMFORGE_PACKAGE",
    schemaVersion: 1,
    packageId: generateUUID(),
    title: exam.title,
    courseCode: exam.courseCode || undefined,
    exportedAt: Date.now(),
    questions: [
      {
        id: question.id,
        questionType: (question.questionType as "mcq" | "essay") || "mcq",
        topic: question.topic || null,
        prompt: question.prompt,
        options: question.options || [],
        correctIndex: question.correctIndex ?? null,
        explanation: question.explanation || null,
        reference: question.reference || null,
        position: 0,
      },
    ],
  };
}

/**
 * Serialize package to JSON string
 */
export function packageToJson(pkg: ExamPackageExport): string {
  return JSON.stringify(pkg, null, 2);
}

/**
 * Download JSON as .examforge file
 */
export function downloadAsExamForge(pkg: ExamPackageExport): void {
  const json = packageToJson(pkg);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const filename = pkg.courseCode
    ? `${cleanFilename(pkg.courseCode)}_${cleanFilename(pkg.title)}.examforge`
    : `${cleanFilename(pkg.title)}.examforge`;

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Copy package JSON to clipboard
 */
export async function copyPackageToClipboard(pkg: ExamPackageExport): Promise<boolean> {
  try {
    const json = packageToJson(pkg);
    await navigator.clipboard.writeText(json);
    return true;
  } catch {
    return false;
  }
}

/**
 * Share package using Web Share API (with clipboard fallback)
 */
export async function sharePackage(pkg: ExamPackageExport): Promise<boolean> {
  const json = packageToJson(pkg);
  const filename = pkg.courseCode
    ? `${cleanFilename(pkg.courseCode)}_${cleanFilename(pkg.title)}.examforge`
    : `${cleanFilename(pkg.title)}.examforge`;

  // Try Web Share API with file
  if (navigator.share && navigator.canShare) {
    try {
      const file = new File([json], filename, { type: "application/json" });
      const shareData = {
        title: `ExamForge: ${pkg.title}`,
        text: `Exam package: ${pkg.title} (${pkg.questions.length} questions)`,
        files: [file],
      };

      if (navigator.canShare(shareData)) {
        await navigator.share(shareData);
        return true;
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        console.error("Share failed:", err);
      }
    }
  }

  // Fallback: copy to clipboard
  return copyPackageToClipboard(pkg);
}

/**
 * Share a single question
 */
export async function shareSingleQuestion(
  pkg: ExamPackageExport,
  questionIndex: number
): Promise<boolean> {
  const question = pkg.questions[questionIndex];
  if (!question) return false;

  const singlePkg: ExamPackageExport = {
    ...pkg,
    packageId: generateUUID(),
    questions: [{ ...question, position: 0 }],
  };

  return sharePackage(singlePkg);
}

/**
 * Copy single question JSON to clipboard
 */
export async function copySingleQuestionToClipboard(
  pkg: ExamPackageExport,
  questionIndex: number
): Promise<boolean> {
  const question = pkg.questions[questionIndex];
  if (!question) return false;

  const singlePkg: ExamPackageExport = {
    ...pkg,
    packageId: generateUUID(),
    questions: [{ ...question, position: 0 }],
  };

  return copyPackageToClipboard(singlePkg);
}
