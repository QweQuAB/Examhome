import { useState, useRef, useMemo } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Upload, Download, CheckCircle2, AlertTriangle, Loader2, FileJson } from "lucide-react";
import { useBulkImportQuestions } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetExamQueryKey, getGetExamStatsQueryKey } from "@workspace/api-client-react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  examId: string;
};

type RawQuestion = {
  questionType?: "mcq" | "essay";
  topic?: string | null;
  prompt: string;
  options?: string[];
  correctIndex?: number;
  essayAnswer?: string | null;
  explanation?: string | null;
  reference?: string | null;
  repeatNote?: string | null;
};

const TEMPLATE: RawQuestion[] = [
  {
    topic: "Sample Topic",
    prompt: "What is the capital of Ghana?",
    options: ["Accra", "Lagos", "Nairobi", "Cairo"],
    correctIndex: 0,
    explanation: "Accra has been the capital of Ghana since 1877.",
    reference: "Geography Ch. 2",
    repeatNote: "Appears 3 times in past papers",
  },
  {
    topic: "Sample Topic",
    prompt: "Which of these is a renewable energy source?",
    options: ["Coal", "Solar", "Natural Gas", "Petroleum"],
    correctIndex: 1,
    explanation: "Solar energy from the sun is replenishable.",
    reference: null,
    repeatNote: null,
  },
];

type ParseResult =
  | { ok: true; questions: RawQuestion[]; warnings: string[] }
  | { ok: false; error: string };

function parseInput(text: string): ParseResult {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, error: "Paste some JSON or upload a file." };

  let data: unknown;
  try {
    data = JSON.parse(trimmed);
  } catch (err) {
    return {
      ok: false,
      error: `Not valid JSON: ${(err as Error).message}. Tip: make sure every key & string is wrapped in double quotes, and there are no trailing commas.`,
    };
  }

  if (!Array.isArray(data)) {
    return {
      ok: false,
      error: "Top-level value must be a JSON array of question objects (start with [ and end with ]).",
    };
  }

  if (data.length === 0) {
    return { ok: false, error: "The array is empty — no questions to import." };
  }

  const warnings: string[] = [];
  const cleaned: RawQuestion[] = [];

  for (let i = 0; i < data.length; i++) {
    const raw = data[i] as Record<string, unknown> | null;
    const idx = i + 1;
    if (!raw || typeof raw !== "object") {
      return { ok: false, error: `Question #${idx} is not an object.` };
    }

    const prompt = typeof raw.prompt === "string" ? raw.prompt.trim() : "";
    if (!prompt) {
      return { ok: false, error: `Question #${idx}: "prompt" is required and must be a non-empty string.` };
    }

    const qType = (typeof raw.questionType === "string" && raw.questionType === "essay") ? "essay" : "mcq";

    const topic = typeof raw.topic === "string" ? raw.topic.trim() || null : null;
    const explanation = typeof raw.explanation === "string" ? raw.explanation.trim() || null : null;
    const reference = typeof raw.reference === "string" ? raw.reference.trim() || null : null;
    const repeatNote = typeof raw.repeatNote === "string" ? raw.repeatNote.trim() || null : null;

    if (qType === "essay") {
      const essayAnswer = typeof raw.essayAnswer === "string" ? raw.essayAnswer.trim() || null : null;
      if (!explanation) warnings.push(`Q#${idx}: no explanation provided.`);
      cleaned.push({ questionType: "essay", topic, prompt, essayAnswer, explanation, reference, repeatNote });
    } else {
      const options = Array.isArray(raw.options)
        ? raw.options.map((o) => (typeof o === "string" ? o : String(o ?? "")))
        : [];
      if (options.length < 2) {
        return { ok: false, error: `Question #${idx}: needs at least 2 options.` };
      }
      if (options.length > 8) {
        return { ok: false, error: `Question #${idx}: maximum 8 options allowed.` };
      }
      if (options.some((o) => !o.trim())) {
        return { ok: false, error: `Question #${idx}: all options must be non-empty.` };
      }

      const correctIndex = typeof raw.correctIndex === "number" ? raw.correctIndex : NaN;
      if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= options.length) {
        return {
          ok: false,
          error: `Question #${idx}: "correctIndex" must be an integer between 0 and ${options.length - 1} (option indices are 0-based).`,
        };
      }

      if (!explanation) warnings.push(`Q#${idx}: no explanation provided.`);
      cleaned.push({ questionType: "mcq", topic, prompt, options, correctIndex, explanation, reference, repeatNote });
    }
  }

  return { ok: true, questions: cleaned, warnings };
}

export function BulkImportDialog({ open, onOpenChange, examId }: Props) {
  const [text, setText] = useState("");
  const [serverError, setServerError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const bulkImport = useBulkImportQuestions({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetExamQueryKey(examId) });
        queryClient.invalidateQueries({ queryKey: getGetExamStatsQueryKey(examId) });
      },
    },
  });

  const parsed = useMemo(() => parseInput(text), [text]);

  const handleFile = async (file: File) => {
    setServerError(null);
    try {
      const content = await file.text();
      setText(content);
    } catch (err) {
      setServerError(`Failed to read file: ${(err as Error).message}`);
    }
  };

  const downloadTemplate = () => {
    const blob = new Blob([JSON.stringify(TEMPLATE, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "examforge-questions-template.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    setServerError(null);
    if (!parsed.ok) return;
    bulkImport.mutate(
      { examId, data: { questions: parsed.questions } },
      {
        onSuccess: (result) => {
          setText("");
          onOpenChange(false);
          // Small delay so the dialog closes cleanly
          setTimeout(() => {
            // eslint-disable-next-line no-alert
            alert(`Imported ${result.insertedCount} question(s) successfully.`);
          }, 100);
        },
        onError: (err) => {
          const anyErr = err as unknown as { message?: string; response?: { data?: { error?: string } } };
          setServerError(anyErr?.response?.data?.error ?? anyErr?.message ?? "Import failed. Please try again.");
        },
      }
    );
  };

  const handleClose = (next: boolean) => {
    if (!next) {
      setText("");
      setServerError(null);
    }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl flex items-center gap-2">
            <Upload className="w-5 h-5 text-accent" /> Bulk Import Questions
          </DialogTitle>
          <DialogDescription>
            Paste a JSON array of questions or upload a <code className="px-1 py-0.5 rounded bg-muted text-xs">.json</code> file.
            Use the template below as your starting point.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-border/60 bg-muted/30 p-4 space-y-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-start gap-2">
              <FileJson className="w-5 h-5 text-accent mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-medium">JSON template</p>
                <p className="text-muted-foreground">
                  Each question needs <code className="text-xs">prompt</code>, <code className="text-xs">options</code> (2–8 strings), and <code className="text-xs">correctIndex</code> (0-based).
                  Optional fields: <code className="text-xs">topic</code>, <code className="text-xs">explanation</code>, <code className="text-xs">reference</code>, <code className="text-xs">repeatNote</code>.
                </p>
              </div>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={downloadTemplate} className="gap-2 flex-shrink-0">
              <Download className="w-4 h-4" /> Download template
            </Button>
          </div>
          <pre className="text-xs bg-background/80 border border-border/60 rounded p-3 overflow-x-auto max-h-48 overflow-y-auto">
{`[
  {
    "topic": "Sample Topic",
    "prompt": "What is the capital of Ghana?",
    "options": ["Accra", "Lagos", "Nairobi", "Cairo"],
    "correctIndex": 0,
    "explanation": "Accra has been the capital since 1877.",
    "reference": "Geography Ch. 2",
    "repeatNote": "Appears 3 times in past papers"
  }
]`}
          </pre>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <Label htmlFor="bulk-text">Paste JSON</Label>
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                  e.target.value = "";
                }}
              />
              <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="gap-2">
                <Upload className="w-4 h-4" /> Upload .json file
              </Button>
            </div>
          </div>
          <Textarea
            id="bulk-text"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setServerError(null);
            }}
            placeholder='[\n  {\n    "prompt": "...",\n    "options": ["A", "B", "C", "D"],\n    "correctIndex": 0\n  }\n]'
            className="font-mono text-xs min-h-[180px] max-h-[280px]"
          />
        </div>

        {text.trim() && (
          <div
            className={`rounded-lg border p-3 text-sm flex items-start gap-2 ${
              parsed.ok
                ? "border-green-500/40 bg-green-500/5 text-green-900 dark:text-green-100"
                : "border-destructive/40 bg-destructive/5 text-destructive"
            }`}
          >
            {parsed.ok ? (
              <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            )}
            <div className="space-y-1 flex-1 min-w-0">
              {parsed.ok ? (
                <>
                  <p className="font-medium">
                    Ready to import <Badge variant="secondary" className="ml-1">{parsed.questions.length}</Badge> question{parsed.questions.length === 1 ? "" : "s"}.
                  </p>
                  {parsed.warnings.length > 0 && (
                    <details className="text-xs text-muted-foreground">
                      <summary className="cursor-pointer">Notes ({parsed.warnings.length})</summary>
                      <ul className="mt-1 list-disc list-inside">
                        {parsed.warnings.slice(0, 8).map((w, i) => (
                          <li key={i}>{w}</li>
                        ))}
                        {parsed.warnings.length > 8 && <li>…and {parsed.warnings.length - 8} more</li>}
                      </ul>
                    </details>
                  )}
                </>
              ) : (
                <p>{parsed.error}</p>
              )}
            </div>
          </div>
        )}

        {serverError && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 text-destructive p-3 text-sm flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <p>{serverError}</p>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => handleClose(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleImport}
            disabled={!parsed.ok || bulkImport.isPending}
            className="gap-2 bg-accent hover:bg-accent/90 text-accent-foreground"
          >
            {bulkImport.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Importing…
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" /> Import {parsed.ok ? `${parsed.questions.length} question${parsed.questions.length === 1 ? "" : "s"}` : ""}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
