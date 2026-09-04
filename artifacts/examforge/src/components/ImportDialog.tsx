import { useState, useRef, useCallback } from "react";
import { Upload, FileText, AlertCircle, CheckCircle2, Loader2, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useCreateExam,
  useBulkImportQuestions,
  getListExamsQueryKey,
} from "@workspace/api-client-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ImportQuestion {
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
  reference?: string;
  topic?: string;
}

interface ImportExam {
  title: string;
  courseCode?: string;
  institution?: string;
  description?: string;
  questions: ImportQuestion[];
}

type ImportMode = "file" | "paste";
type ImportStatus = "idle" | "parsing" | "preview" | "importing" | "success" | "error";

export function ImportDialog({ open, onOpenChange }: ImportDialogProps) {
  const queryClient = useQueryClient();
  const createExam = useCreateExam();
  const bulkImportQuestions = useBulkImportQuestions();

  const [mode, setMode] = useState<ImportMode>("file");
  const [status, setStatus] = useState<ImportStatus>("idle");
  const [parsedData, setParsedData] = useState<ImportExam | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pasteContent, setPasteContent] = useState("");
  const [importProgress, setImportProgress] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setStatus("idle");
    setParsedData(null);
    setError(null);
    setPasteContent("");
    setImportProgress(0);
  };

  const handleClose = (value: boolean) => {
    if (status !== "importing") {
      reset();
      onOpenChange(value);
    }
  };

  const parseExamForgeFile = (content: string): ImportExam => {
    const data = JSON.parse(content);

    // Support both single exam and array of exams
    const examData = Array.isArray(data) ? data[0] : data;

    if (!examData.title) {
      throw new Error("Missing exam title");
    }

    // Try multiple field names for questions to handle different export versions
    const rawQuestions =
      examData.questions ||
      examData.items ||
      examData.questionList ||
      examData.questionListItems ||
      [];

    const questions: ImportQuestion[] = rawQuestions.map((q: any, i: number) => ({
      prompt: q.prompt || q.text || q.question || `Question ${i + 1}`,
      options: q.options || q.choices || q.answers || [],
      correctIndex: q.correctIndex ?? q.correct ?? q.answer ?? 0,
      explanation: q.explanation || q.rationale || null,
      reference: q.reference || q.source || null,
      topic: q.topic || q.category || null,
    }));

    return {
      title: examData.title,
      courseCode: examData.courseCode || examData.course_code || null,
      institution: examData.institution || examData.organization || null,
      description: examData.description || examData.desc || null,
      questions,
    };
  };

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setStatus("parsing");
    setError(null);

    try {
      const content = await file.text();
      const parsed = parseExamForgeFile(content);
      setParsedData(parsed);
      setStatus("preview");
    } catch (err: any) {
      setError(err.message || "Failed to parse file");
      setStatus("error");
    }
  }, []);

  const handlePasteImport = useCallback(() => {
    if (!pasteContent.trim()) return;

    setStatus("parsing");
    setError(null);

    try {
      const parsed = parseExamForgeFile(pasteContent);
      setParsedData(parsed);
      setStatus("preview");
    } catch (err: any) {
      setError(err.message || "Failed to parse JSON");
      setStatus("error");
    }
  }, [pasteContent]);

  const handleImport = useCallback(async () => {
    if (!parsedData) return;

    if (parsedData.questions.length === 0) {
      setError("No questions found in the file. Check that the file contains a questions array.");
      setStatus("error");
      return;
    }

    setStatus("importing");
    setImportProgress(10);

    try {
      // Create exam
      const examResult = await createExam.mutateAsync({
        data: {
          title: parsedData.title,
          courseCode: parsedData.courseCode || null,
          institution: parsedData.institution || null,
          description: parsedData.description || null,
        },
      });

      setImportProgress(30);

      // Create questions in batches
      const examId = (examResult as any).id || (examResult as any).examId;
      if (parsedData.questions.length > 0) {
        await bulkImportQuestions.mutateAsync({
          examId,
          data: {
            questions: parsedData.questions.map((q) => ({
              prompt: q.prompt,
              options: q.options,
              correctIndex: q.correctIndex,
              explanation: q.explanation || null,
              reference: q.reference || null,
              topic: q.topic || null,
            })),
          },
        });
      }

      setImportProgress(100);
      setStatus("success");

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: getListExamsQueryKey() });

      // Close after success
      setTimeout(() => {
        handleClose(false);
      }, 1500);
    } catch (err: any) {
      setError(err.message || "Failed to import");
      setStatus("error");
    }
  }, [parsedData, createExam, bulkImportQuestions, queryClient]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const file = e.dataTransfer.files[0];
    if (!file) return;

    setStatus("parsing");
    setError(null);

    try {
      const content = await file.text();
      const parsed = parseExamForgeFile(content);
      setParsedData(parsed);
      setStatus("preview");
    } catch (err: any) {
      setError(err.message || "Failed to parse file");
      setStatus("error");
    }
  }, []);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Import Exam Package
          </DialogTitle>
          <DialogDescription>
            Import an .examforge file or paste JSON data to add an exam to your library.
          </DialogDescription>
        </DialogHeader>

        {status === "idle" && (
          <div className="space-y-4">
            {/* Mode Tabs */}
            <div className="flex gap-2">
              <Button
                variant={mode === "file" ? "default" : "outline"}
                size="sm"
                onClick={() => setMode("file")}
                className="flex-1"
              >
                <FileText className="h-4 w-4 mr-2" /> File Upload
              </Button>
              <Button
                variant={mode === "paste" ? "default" : "outline"}
                size="sm"
                onClick={() => setMode("paste")}
                className="flex-1"
              >
                <Upload className="h-4 w-4 mr-2" /> Paste JSON
              </Button>
            </div>

            {mode === "file" ? (
              <div
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-accent/50 transition-colors cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".examforge,.json"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <Upload className="mx-auto h-10 w-10 text-muted-foreground/50 mb-3" />
                <p className="text-sm font-medium mb-1">Drop file here or click to browse</p>
                <p className="text-xs text-muted-foreground">.examforge or .json files</p>
              </div>
            ) : (
              <div className="space-y-3">
                <Textarea
                  placeholder='Paste JSON here... Example:\n{\n  "title": "My Exam",\n  "questions": [\n    {\n      "prompt": "What is 2+2?",\n      "options": ["3", "4", "5"],\n      "correctIndex": 1\n    }\n  ]\n}'
                  value={pasteContent}
                  onChange={(e) => setPasteContent(e.target.value)}
                  className="min-h-[200px] font-mono text-sm"
                />
                <Button
                  onClick={handlePasteImport}
                  disabled={!pasteContent.trim()}
                  className="w-full"
                >
                  Parse JSON
                </Button>
              </div>
            )}
          </div>
        )}

        {status === "parsing" && (
          <div className="flex flex-col items-center py-8 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Parsing file...</p>
          </div>
        )}

        {status === "error" && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/20">
              <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-destructive">Import Failed</p>
                <p className="text-sm text-destructive/80 mt-1">{error}</p>
              </div>
            </div>
            <Button variant="outline" onClick={reset} className="w-full">
              Try Again
            </Button>
          </div>
        )}

        {status === "preview" && parsedData && (
          <div className="space-y-4">
            <div className="p-4 bg-secondary/30 rounded-lg space-y-2">
              <h3 className="font-medium">{parsedData.title}</h3>
              {parsedData.courseCode && (
                <Badge variant="secondary">{parsedData.courseCode}</Badge>
              )}
              {parsedData.institution && (
                <p className="text-sm text-muted-foreground">{parsedData.institution}</p>
              )}
              <p className="text-sm text-muted-foreground">
                {parsedData.questions.length} question{parsedData.questions.length !== 1 ? "s" : ""} found
              </p>
            </div>
            <Button onClick={handleImport} disabled={parsedData.questions.length === 0} className="w-full bg-primary hover:bg-primary/90">
              Import {parsedData.questions.length} Question{parsedData.questions.length !== 1 ? "s" : ""}
            </Button>
          </div>
        )}

        {status === "importing" && (
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span className="text-sm">Importing exam...</span>
            </div>
            <Progress value={importProgress} className="h-2" />
          </div>
        )}

        {status === "success" && (
          <div className="flex flex-col items-center py-8 gap-3">
            <CheckCircle2 className="h-12 w-12 text-success" />
            <p className="font-medium">Import Successful!</p>
            <p className="text-sm text-muted-foreground">Closing automatically...</p>
          </div>
        )}

        {status !== "importing" && status !== "success" && (
          <DialogFooter>
            <Button variant="outline" onClick={() => handleClose(false)}>
              Cancel
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
