import { createExam, bulkImportQuestions } from "@workspace/api-client-react";
import { incrementDownloadCount, type ExamPackage } from "@/lib/firestore-service";

export interface AddToCollectionResult {
  examId: string;
  title: string;
  totalImported: number;
}

/**
 * Adds a community exam package to the user's dashboard collection.
 * Creates the exam entity and bulk imports all MCQ and Essay questions.
 */
export async function addPackageToDashboard(pkg: ExamPackage): Promise<AddToCollectionResult> {
  if (!pkg || !pkg.title) {
    throw new Error("Invalid exam package data.");
  }

  // 1. Create the exam container
  const createdExam = await createExam({
    title: pkg.title,
    courseCode: pkg.courseCode || null,
    institution: pkg.institution || null,
    description: pkg.description || `Imported from ExamForge Community Repository (Author: ${pkg.postedByUsername || pkg.author || "Community"})`,
  });

  const examId = createdExam?.id || (createdExam as any)?.data?.id;
  if (!examId) {
    throw new Error("Failed to create exam record: No valid exam ID returned from server.");
  }

  // 2. Prepare questions with strict validation
  const mcqList = Array.isArray(pkg.mcqQuestions) ? pkg.mcqQuestions : [];
  const essayList = Array.isArray(pkg.essayQuestions) ? pkg.essayQuestions : [];
  
  // Also check if questions array is directly present (for generic formats)
  const genericQuestions = Array.isArray((pkg as any).questions) ? (pkg as any).questions : [];
  
  const formattedQuestions: Array<{
    questionType: "mcq" | "essay";
    prompt: string;
    options?: string[];
    correctIndex?: number;
    essayAnswer?: string | null;
    explanation?: string | null;
    reference?: string | null;
    topic?: string | null;
    repeatNote?: string | null;
  }> = [];

  // Add MCQs
  for (let i = 0; i < mcqList.length; i++) {
    const q = mcqList[i];
    if (!q || !q.prompt) continue;

    let options: string[] = Array.isArray(q.options) && q.options.length >= 2
      ? q.options.map((opt: any) => String(opt))
      : ["True", "False"]; // Fallback if fewer than 2 options

    let correctIndex = typeof q.correctIndex === "number" ? q.correctIndex : 0;
    if (correctIndex < 0 || correctIndex >= options.length) {
      correctIndex = 0;
    }

    formattedQuestions.push({
      questionType: "mcq",
      prompt: String(q.prompt).trim(),
      options,
      correctIndex,
      explanation: q.explanation || null,
      reference: q.reference || null,
      topic: q.topic || null,
      repeatNote: q.repeatNote || null,
    });
  }

  // Add Essays (Backend requires omitting options and correctIndex for essay types)
  for (let i = 0; i < essayList.length; i++) {
    const q = essayList[i];
    if (!q || !q.prompt) continue;

    formattedQuestions.push({
      questionType: "essay",
      prompt: String(q.prompt).trim(),
      essayAnswer: q.essayAnswer || q.answer || null,
      explanation: q.explanation || null,
      reference: q.reference || null,
      topic: q.topic || null,
      repeatNote: q.repeatNote || null,
    });
  }

  // Add any generic questions that might not be partitioned yet
  for (const q of genericQuestions) {
    if (!q || !q.prompt) continue;
    const isMcq = (q.questionType || (Array.isArray(q.options) && q.options.length > 0)) !== "essay";
    if (isMcq) {
      let options: string[] = Array.isArray(q.options) && q.options.length >= 2
        ? q.options.map((opt: any) => String(opt))
        : ["Option A", "Option B"];
      let correctIndex = typeof q.correctIndex === "number" ? q.correctIndex : 0;
      if (correctIndex < 0 || correctIndex >= options.length) correctIndex = 0;

      formattedQuestions.push({
        questionType: "mcq",
        prompt: String(q.prompt).trim(),
        options,
        correctIndex,
        explanation: q.explanation || null,
        reference: q.reference || null,
        topic: q.topic || null,
        repeatNote: q.repeatNote || null,
      });
    } else {
      formattedQuestions.push({
        questionType: "essay",
        prompt: String(q.prompt).trim(),
        essayAnswer: q.essayAnswer || q.answer || null,
        explanation: q.explanation || null,
        reference: q.reference || null,
        topic: q.topic || null,
        repeatNote: q.repeatNote || null,
      });
    }
  }

  // 3. Bulk import questions if any exist
  if (formattedQuestions.length > 0) {
    await bulkImportQuestions(examId, {
      questions: formattedQuestions,
    });
  }

  // 4. Increment download count in Firestore community repository (non-blocking)
  if (pkg.id && !pkg.id.startsWith("seed_")) {
    incrementDownloadCount(pkg.id).catch((err) => {
      console.warn("Could not increment download count in firestore:", err);
    });
  }

  return {
    examId,
    title: createdExam.title || pkg.title,
    totalImported: formattedQuestions.length,
  };
}
