import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  FolderPlus,
  BookOpen,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  LayoutDashboard,
  Check,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { addPackageToDashboard } from "@/lib/collection-service";
import { getListExamsQueryKey } from "@workspace/api-client-react";
import type { ExamPackage } from "@/lib/firestore-service";

interface AddToCollectionDialogProps {
  packageData: ExamPackage | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (examId: string) => void;
}

export function AddToCollectionDialog({
  packageData,
  open,
  onOpenChange,
  onSuccess,
}: AddToCollectionDialogProps) {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<"confirm" | "importing" | "success" | "error">("confirm");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createdExamId, setCreatedExamId] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setStatus("confirm");
      setErrorMessage(null);
      setCreatedExamId(null);
    }
  }, [open]);

  if (!packageData) return null;

  const mcqCount = Array.isArray(packageData.mcqQuestions) ? packageData.mcqQuestions.length : 0;
  const essayCount = Array.isArray(packageData.essayQuestions) ? packageData.essayQuestions.length : 0;
  const totalQuestions = mcqCount + essayCount;

  const handleConfirmAdd = async () => {
    setStatus("importing");
    setErrorMessage(null);

    try {
      const result = await addPackageToDashboard(packageData);
      setCreatedExamId(result.examId);
      setStatus("success");

      // Invalidate queries so dashboard reflects newly added exam immediately
      queryClient.invalidateQueries({ queryKey: getListExamsQueryKey() });
      toast.success(`"${packageData.title}" added to your collection!`);

      if (onSuccess) {
        onSuccess(result.examId);
      }
    } catch (err: any) {
      console.error("Error adding package to collection:", err);
      setStatus("error");
      setErrorMessage(err.message || "Failed to import package to collection. Please try again.");
    }
  };

  const handleGoToDashboard = () => {
    onOpenChange(false);
    setLocation("/");
  };

  const handleOpenExam = () => {
    if (createdExamId) {
      onOpenChange(false);
      setLocation(`/exams/${createdExamId}`);
    } else {
      handleGoToDashboard();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent id="add-to-collection-dialog" className="sm:max-w-lg">
        {status === "confirm" && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2 mb-1 text-accent">
                <FolderPlus className="w-5 h-5" />
                <span className="text-xs uppercase tracking-wider font-bold">Community Integration</span>
              </div>
              <DialogTitle className="text-xl font-serif">
                Add to Dashboard Collection?
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
                Do you want to add this community exam package to your personal collection on the dashboard?
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="p-4 rounded-xl border border-border/70 bg-card/50 space-y-3">
                <div>
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    {packageData.courseCode && (
                      <Badge variant="secondary" className="font-mono text-xs">
                        {packageData.courseCode}
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-xs">
                      {packageData.category}
                    </Badge>
                  </div>
                  <h4 className="font-serif font-bold text-base text-foreground leading-snug">
                    {packageData.title}
                  </h4>
                  {packageData.institution && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {packageData.institution}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/50 text-center">
                  <div className="bg-secondary/30 rounded p-2">
                    <span className="text-xs text-muted-foreground block">Total</span>
                    <span className="text-sm font-bold">{totalQuestions} Questions</span>
                  </div>
                  <div className="bg-secondary/30 rounded p-2">
                    <span className="text-xs text-muted-foreground block">MCQ</span>
                    <span className="text-sm font-bold text-accent">{mcqCount}</span>
                  </div>
                  <div className="bg-secondary/30 rounded p-2">
                    <span className="text-xs text-muted-foreground block">Essay</span>
                    <span className="text-sm font-bold text-primary">{essayCount}</span>
                  </div>
                </div>

                {packageData.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {packageData.description}
                  </p>
                )}
              </div>

              <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground space-y-1">
                <div className="font-medium text-foreground flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-success" />
                  <span>What happens next:</span>
                </div>
                <p>
                  The exam and questions will be saved to your dashboard, allowing you to take mock tests, practice flashcards, and review full answers anytime.
                </p>
              </div>
            </div>

            <DialogFooter className="flex gap-2 sm:justify-end">
              <Button
                id="cancel-add-collection-btn"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                id="confirm-add-collection-btn"
                className="gap-2 bg-accent hover:bg-accent/90 text-accent-foreground font-semibold"
                onClick={handleConfirmAdd}
              >
                <FolderPlus className="w-4 h-4" /> Add to Dashboard
              </Button>
            </DialogFooter>
          </>
        )}

        {status === "importing" && (
          <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
            <Loader2 className="w-10 h-10 text-accent animate-spin" />
            <div>
              <h3 className="text-lg font-serif font-bold text-foreground">
                Adding to Your Collection...
              </h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                Creating exam container and importing {totalQuestions} questions into your personal library.
              </p>
            </div>
          </div>
        )}

        {status === "success" && (
          <>
            <div className="py-6 flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-success/15 flex items-center justify-center text-success">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-xl font-serif font-bold text-foreground">
                  Added to Your Collection!
                </h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                  <strong className="text-foreground">{packageData.title}</strong> has been added to your dashboard collection with {totalQuestions} questions.
                </p>
              </div>
            </div>

            <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:justify-between items-center pt-2">
              <Button
                id="return-dashboard-btn"
                variant="outline"
                className="w-full sm:w-auto gap-2"
                onClick={handleGoToDashboard}
              >
                <LayoutDashboard className="w-4 h-4" /> Return to Dashboard
              </Button>
              <Button
                id="open-exam-now-btn"
                className="w-full sm:w-auto gap-2 bg-primary hover:bg-primary/90 text-primary-foreground"
                onClick={handleOpenExam}
              >
                <span>Open & Practice Now</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </DialogFooter>
          </>
        )}

        {status === "error" && (
          <>
            <div className="py-6 flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-destructive/15 flex items-center justify-center text-destructive">
                <AlertCircle className="w-7 h-7" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-xl font-serif font-bold text-foreground">
                  Import Failed
                </h3>
                <p className="text-sm text-destructive max-w-sm">
                  {errorMessage}
                </p>
              </div>
            </div>

            <DialogFooter className="flex gap-2 sm:justify-end">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              <Button onClick={handleConfirmAdd} className="gap-2">
                Retry Import
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
