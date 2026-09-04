import { useState, useEffect } from "react";
import { useParams, Link, useLocation } from "wouter";
import { format } from "date-fns";
import {
  ArrowLeft,
  Download,
  Heart,
  MessageSquare,
  Share2,
  Flag,
  BookOpen,
  FileText,
  Edit,
  ChevronDown,
  ChevronUp,
  Send,
  Trash2,
  AlertCircle,
  FolderPlus,
} from "lucide-react";
import { AddToCollectionDialog } from "@/components/AddToCollectionDialog";
import {
  fetchPackageById,
  likePackage,
  incrementDownloadCount,
  fetchComments,
  addComment,
  likeComment,
  deleteComment,
  getUsername,
  submitReport,
  isCommentLiked,
  toggleLikedComment,
  getLikedComments,
  type ExamPackage,
  type PackageComment,
} from "@/lib/firestore-service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export default function CommunityPackageDetail() {
  const { packageId } = useParams();
  const [, setLocation] = useLocation();
  const [pkg, setPkg] = useState<ExamPackage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [liked, setLiked] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [showAddToCollection, setShowAddToCollection] = useState(false);

  useEffect(() => {
    loadPackage();
  }, [packageId]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (
        params.get("action") === "addToCollection" ||
        params.get("add") === "true" ||
        params.get("import") === "true"
      ) {
        setShowAddToCollection(true);
      }
    }
  }, [packageId, pkg]);

  const loadPackage = async () => {
    if (!packageId) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchPackageById(packageId);
      if (!data) {
        setError("Package not found");
      } else {
        setPkg(data);
        // Check if liked
        const likedPackages = JSON.parse(localStorage.getItem("liked_packages") || "[]");
        setLiked(likedPackages.includes(packageId));
      }
    } catch (err: any) {
      setError(err.message || "Failed to load package");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLike = async () => {
    if (!packageId || liked) return;
    try {
      await likePackage(packageId);
      setLiked(true);
      setPkg((prev) => (prev ? { ...prev, likeCount: prev.likeCount + 1 } : null));
      const likedPackages = JSON.parse(localStorage.getItem("liked_packages") || "[]");
      likedPackages.push(packageId);
      localStorage.setItem("liked_packages", JSON.stringify(likedPackages));
      toast.success("Liked!");
    } catch (err: any) {
      toast.error("Failed to like");
    }
  };

  const handleDownload = async () => {
    if (!packageId || !pkg) return;
    try {
      await incrementDownloadCount(packageId);
      setPkg((prev) => (prev ? { ...prev, downloadCount: prev.downloadCount + 1 } : null));

      // Generate and download JSON
      const exportData = {
        formatIdentifier: "EXAMFORGE_PACKAGE",
        schemaVersion: 1,
        title: pkg.title,
        courseCode: pkg.courseCode,
        institution: pkg.institution,
        description: pkg.description,
        questions: [...(pkg.mcqQuestions || []), ...(pkg.essayQuestions || [])].sort(
          (a, b) => a.position - b.position
        ),
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${pkg.title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.examforge`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("Package downloaded!");
    } catch (err: any) {
      toast.error("Failed to download");
    }
  };

  const handleShare = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    toast.success("Link copied to clipboard!");
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !pkg) {
    return (
      <div className="max-w-4xl mx-auto text-center py-20">
        <AlertCircle className="mx-auto h-12 w-12 text-destructive mb-4" />
        <h2 className="text-xl font-medium mb-2">{error || "Package not found"}</h2>
        <Link href="/community">
          <Button variant="outline" className="mt-4">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Community
          </Button>
        </Link>
      </div>
    );
  }

  const mcqQuestions = pkg.mcqQuestions || [];
  const essayQuestions = pkg.essayQuestions || [];
  const totalQuestions = mcqQuestions.length + essayQuestions.length;

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500">
      {/* Back Button */}
      <Link href="/community">
        <Button variant="ghost" size="sm" className="gap-2">
          <ArrowLeft className="w-4 h-4" /> Back to Community
        </Button>
      </Link>

      {/* Package Header */}
      <Card className="shadow-sm">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                {pkg.courseCode && <Badge variant="secondary">{pkg.courseCode}</Badge>}
                <Badge variant="outline">{pkg.category}</Badge>
              </div>
              <h1 className="text-2xl font-serif font-bold text-primary mb-2">
                {pkg.title}
              </h1>
              {pkg.institution && (
                <p className="text-sm text-muted-foreground mb-2">{pkg.institution}</p>
              )}
              {pkg.description && (
                <p className="text-muted-foreground">{pkg.description}</p>
              )}
              <div className="flex items-center gap-4 mt-4 text-sm text-muted-foreground">
                <span>By {pkg.postedByUsername || pkg.author}</span>
                <span>{format(new Date(pkg.postedAt), "MMM d, yyyy")}</span>
                <span>{totalQuestions} questions</span>
              </div>
            </div>

            <div className="flex flex-col gap-2 min-w-[150px]">
              <Button
                id="add-to-collection-btn"
                onClick={() => setShowAddToCollection(true)}
                className="gap-2 bg-accent hover:bg-accent/90 text-accent-foreground font-semibold shadow-sm"
              >
                <FolderPlus className="w-4 h-4" /> Add to Collection
              </Button>
              <Button onClick={handleDownload} variant="outline" className="gap-2">
                <Download className="w-4 h-4" /> Download .examforge
              </Button>
              <div className="flex gap-2">
                <Button
                  variant={liked ? "default" : "outline"}
                  size="sm"
                  onClick={handleLike}
                  disabled={liked}
                  className="gap-1 flex-1"
                >
                  <Heart className={`w-4 h-4 ${liked ? "fill-current" : ""}`} />
                  {pkg.likeCount}
                </Button>
                <Button variant="outline" size="sm" onClick={handleShare} className="gap-1">
                  <Share2 className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowReportDialog(true)}
                  className="gap-1 text-destructive"
                  title="Report package"
                >
                  <Flag className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Questions */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <BookOpen className="w-5 h-5" /> Questions ({totalQuestions})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {mcqQuestions.length > 0 && (
            <div>
              <h3 className="font-medium mb-3 text-sm text-muted-foreground uppercase tracking-wider">
                MCQ Questions ({mcqQuestions.length})
              </h3>
              <div className="space-y-3">
                {mcqQuestions.map((q, i) => (
                  <QuestionPreview key={q.id || i} question={q} index={i} type="mcq" />
                ))}
              </div>
            </div>
          )}

          {essayQuestions.length > 0 && (
            <div>
              <h3 className="font-medium mb-3 text-sm text-muted-foreground uppercase tracking-wider">
                Essay Questions ({essayQuestions.length})
              </h3>
              <div className="space-y-3">
                {essayQuestions.map((q, i) => (
                  <QuestionPreview key={q.id || i} question={q} index={i + mcqQuestions.length} type="essay" />
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Comments Section */}
      <CommentsSection packageId={pkg.id} />

      {/* Report Dialog */}
      <ReportDialog
        open={showReportDialog}
        onOpenChange={setShowReportDialog}
        packageId={pkg.id}
        packageTitle={pkg.title}
        packageAuthor={pkg.author || pkg.postedByUsername}
        packageCategory={pkg.category}
      />

      {/* Add to Collection Dialog */}
      <AddToCollectionDialog
        packageData={pkg}
        open={showAddToCollection}
        onOpenChange={setShowAddToCollection}
      />
    </div>
  );
}

function QuestionPreview({
  question,
  index,
  type,
}: {
  question: any;
  index: number;
  type: "mcq" | "essay";
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="border-border/60">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <span className="flex-none w-6 h-6 rounded-full bg-secondary flex items-center justify-center text-xs font-bold">
            {index + 1}
          </span>
          <div className="flex-1">
            <p className="font-medium">{question.prompt}</p>
            {type === "mcq" && question.options && (
              <div className="mt-2 space-y-1">
                {question.options.map((opt: string, i: number) => (
                  <div
                    key={i}
                    className={`text-sm px-3 py-1 rounded ${
                      i === question.correctIndex
                        ? "bg-success/10 text-success font-medium"
                        : "text-muted-foreground"
                    }`}
                  >
                    {String.fromCharCode(65 + i)}. {opt}
                  </div>
                ))}
              </div>
            )}
            {(question.explanation || question.reference) && (
              <div className="mt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setExpanded(!expanded)}
                  className="gap-1 text-xs h-7"
                >
                  {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  {expanded ? "Hide" : "Show"} Explanation
                </Button>
                {expanded && (
                  <div className="mt-2 text-sm text-muted-foreground space-y-1">
                    {question.explanation && (
                      <p><span className="font-medium">Explanation:</span> {question.explanation}</p>
                    )}
                    {question.reference && (
                      <p><span className="font-medium">Reference:</span> {question.reference}</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CommentsSection({ packageId }: { packageId: string }) {
  const [comments, setComments] = useState<PackageComment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [likedComments, setLikedComments] = useState<Set<string>>(new Set());
  const username = getUsername();

  useEffect(() => {
    loadComments();
    setLikedComments(getLikedComments());
  }, [packageId]);

  const loadComments = async () => {
    setIsLoading(true);
    try {
      const data = await fetchComments(packageId);
      setComments(data);
    } catch (err: any) {
      toast.error("Failed to load comments");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!newComment.trim()) return;
    if (!username) {
      toast.error("Please set your username in Settings first");
      return;
    }

    setIsSubmitting(true);
    try {
      await addComment(packageId, newComment.trim());
      setNewComment("");
      await loadComments();
      toast.success("Comment posted!");
    } catch (err: any) {
      toast.error(err.message || "Failed to post comment");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLike = async (commentId: string) => {
    if (likedComments.has(commentId)) return; // Already liked
    try {
      await likeComment(commentId);
      toggleLikedComment(commentId);
      setLikedComments(getLikedComments());
      setComments((prev) =>
        prev.map((c) =>
          c.id === commentId ? { ...c, likeCount: c.likeCount + 1 } : c
        )
      );
    } catch (err: any) {
      toast.error("Failed to like comment");
    }
  };

  const handleDelete = async (commentId: string) => {
    try {
      await deleteComment(commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      toast.success("Comment deleted");
    } catch (err: any) {
      toast.error("Failed to delete comment");
    }
  };

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <MessageSquare className="w-5 h-5" /> Discussion ({comments.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* New Comment */}
        <div className="flex gap-2">
          <Input
            placeholder={username ? `Comment as ${username}...` : "Set your username in Settings first..."}
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            disabled={!username || isSubmitting}
          />
          <Button
            onClick={handleSubmit}
            disabled={!newComment.trim() || !username || isSubmitting}
            size="icon"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>

        {/* Comments List */}
        {isLoading ? (
          <div className="space-y-3">
            {Array(3)
              .fill(0)
              .map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
          </div>
        ) : comments.length === 0 ? (
          <p className="text-center text-muted-foreground py-6">
            No comments yet. Be the first to comment!
          </p>
        ) : (
          <div className="space-y-3">
            {comments.map((comment) => (
              <div
                key={comment.id}
                className="p-3 bg-secondary/30 rounded-lg border border-border/40"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="font-medium text-sm">{comment.username}</span>
                    <span className="text-xs text-muted-foreground ml-2">
                      {format(new Date(comment.createdAt), "MMM d, yyyy 'at' h:mm a")}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleLike(comment.id)}
                      disabled={likedComments.has(comment.id)}
                      className={`h-7 gap-1 text-xs ${likedComments.has(comment.id) ? "text-primary" : ""}`}
                    >
                      <Heart className={`w-3 h-3 ${likedComments.has(comment.id) ? "fill-current" : ""}`} /> {comment.likeCount}
                    </Button>
                    {comment.username === username && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(comment.id)}
                        className="h-7 text-destructive"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                </div>
                <p className="text-sm mt-2">{comment.content}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ReportDialog({
  open,
  onOpenChange,
  packageId,
  packageTitle,
  packageAuthor,
  packageCategory,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  packageId: string;
  packageTitle: string;
  packageAuthor: string;
  packageCategory: string;
}) {
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const username = getUsername();

  const reasons = [
    { value: "broken_link", label: "Broken Link" },
    { value: "inappropriate", label: "Inappropriate Content" },
    { value: "incorrect_answers", label: "Incorrect Answers" },
    { value: "spam", label: "Spam" },
    { value: "other", label: "Other" },
  ];

  const handleSubmit = async () => {
    if (!reason) return;
    if (!username) {
      toast.error("Please set your username first");
      return;
    }

    setIsSubmitting(true);
    try {
      await submitReport({
        packageId,
        packageTitle,
        author: packageAuthor,
        category: packageCategory,
        reason,
        reasonLabel: reasons.find((r) => r.value === reason)?.label || reason,
        details,
        reportedBy: username,
      });
      toast.success("Report submitted. Thank you!");
      onOpenChange(false);
      setReason("");
      setDetails("");
    } catch (err: any) {
      toast.error("Failed to submit report");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Report Package</DialogTitle>
          <DialogDescription>
            Help us maintain quality by reporting issues with this package.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Reason</label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue placeholder="Select a reason" />
              </SelectTrigger>
              <SelectContent>
                {reasons.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Details (optional)</label>
            <Textarea
              placeholder="Provide additional details..."
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              className="min-h-[100px]"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!reason || isSubmitting}>
            Submit Report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
