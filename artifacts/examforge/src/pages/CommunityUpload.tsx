import { useState, useRef } from "react";
import { Link, useLocation } from "wouter";
import {
  ArrowLeft,
  Upload,
  FileText,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Plus,
  X,
} from "lucide-react";
import { publishPackage, getUsername, CATEGORIES } from "@/lib/firestore-service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface QuestionData {
  id: string;
  questionType: "mcq" | "essay";
  topic: string | null;
  prompt: string;
  options: string[];
  correctIndex: number | null;
  explanation: string | null;
  reference: string | null;
  repeatNote: string | null;
  position: number;
}

export default function CommunityUpload() {
  const [, setLocation] = useLocation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [courseCode, setCourseCode] = useState("");
  const [institution, setInstitution] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("General");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [questions, setQuestions] = useState<QuestionData[]>([]);
  const [author, setAuthor] = useState(getUsername());

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const content = await file.text();
      const data = JSON.parse(content);

      // Support both single exam and array
      const examData = Array.isArray(data) ? data[0] : data;

      if (examData.title) setTitle(examData.title);
      if (examData.courseCode) setCourseCode(examData.courseCode);
      if (examData.institution) setInstitution(examData.institution);
      if (examData.description) setDescription(examData.description);

      // Parse questions
      const rawQuestions = examData.questions || [];
      const parsed: QuestionData[] = rawQuestions.map((q: any, i: number) => ({
        id: q.id || `q_${Date.now()}_${i}`,
        questionType: q.questionType || "mcq",
        topic: q.topic || null,
        prompt: q.prompt || "",
        options: q.options || [],
        correctIndex: q.correctIndex ?? null,
        explanation: q.explanation || null,
        reference: q.reference || null,
        repeatNote: q.repeatNote || null,
        position: i,
      }));

      setQuestions(parsed);
      toast.success(`Loaded ${parsed.length} questions from file`);
    } catch (err: any) {
      toast.error("Failed to parse file: " + err.message);
    }
  };

  const addTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput("");
    }
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (!author.trim()) {
      toast.error("Author name is required");
      return;
    }
    if (questions.length === 0) {
      toast.error("At least one question is required");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const mcqQuestions = questions
        .filter((q) => q.questionType === "mcq")
        .map((q, i) => ({ ...q, position: i }));

      const essayQuestions = questions
        .filter((q) => q.questionType === "essay")
        .map((q, i) => ({ ...q, position: i + mcqQuestions.length }));

      await publishPackage({
        packageId: `pkg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        formatIdentifier: "EXAMFORGE_PACKAGE",
        schemaVersion: 1,
        title: title.trim(),
        courseCode: courseCode.trim() || null,
        institution: institution.trim() || null,
        description: description.trim() || null,
        category,
        author: author.trim(),
        authorRole: "Contributor",
        postedByUsername: author.trim(),
        tags,
        exportedAt: Date.now(),
        postedAt: Date.now(),
        mcqQuestions,
        essayQuestions,
      });

      toast.success("Package published successfully!");
      setLocation("/community");
    } catch (err: any) {
      setError(err.message || "Failed to publish package");
      toast.error("Failed to publish package");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-500">
      {/* Back Button */}
      <Link href="/community">
        <Button variant="ghost" size="sm" className="gap-2">
          <ArrowLeft className="w-4 h-4" /> Back to Community
        </Button>
      </Link>

      {/* Header */}
      <div>
        <h1 className="text-3xl font-serif font-bold text-primary tracking-tight">
          Publish Package
        </h1>
        <p className="text-muted-foreground mt-2">
          Share your exam package with the community
        </p>
      </div>

      {/* Error State */}
      {error && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="p-4 flex items-center gap-2 text-destructive text-sm">
            <AlertCircle className="w-4 h-4" />
            {error}
          </CardContent>
        </Card>
      )}

      {/* File Upload */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Import from File</CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-accent/50 transition-colors cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".examforge,.json"
              onChange={handleFileUpload}
              className="hidden"
            />
            <Upload className="mx-auto h-10 w-10 text-muted-foreground/50 mb-3" />
            <p className="text-sm font-medium mb-1">Drop file here or click to browse</p>
            <p className="text-xs text-muted-foreground">.examforge or .json files</p>
          </div>
        </CardContent>
      </Card>

      {/* Package Details */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Package Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Title *</label>
            <Input
              placeholder="e.g., CS101 Midterm Exam 2024"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Course Code</label>
              <Input
                placeholder="e.g., CS101"
                value={courseCode}
                onChange={(e) => setCourseCode(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Institution</label>
              <Input
                placeholder="e.g., University of Cape Coast"
                value={institution}
                onChange={(e) => setInstitution(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Description</label>
            <Textarea
              placeholder="Describe the exam package..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-[100px]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Category</label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Author *</label>
              <Input
                placeholder="Your name"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Tags</label>
            <div className="flex gap-2">
              <Input
                placeholder="Add a tag"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
              />
              <Button type="button" variant="outline" onClick={addTag}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="gap-1">
                    {tag}
                    <X
                      className="w-3 h-3 cursor-pointer"
                      onClick={() => removeTag(tag)}
                    />
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Questions Preview */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg flex items-center justify-between">
            <span>Questions ({questions.length})</span>
            <Badge variant="outline">
              {questions.filter((q) => q.questionType === "mcq").length} MCQ,{" "}
              {questions.filter((q) => q.questionType === "essay").length} Essay
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {questions.length === 0 ? (
            <div className="py-8 text-center border-2 border-dashed border-border rounded-xl">
              <FileText className="mx-auto h-8 w-8 text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">
                No questions loaded. Upload a .examforge file to import questions.
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {questions.slice(0, 20).map((q, i) => (
                <div
                  key={q.id}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/30"
                >
                  <span className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center text-xs font-bold">
                    {i + 1}
                  </span>
                  <Badge
                    variant={q.questionType === "mcq" ? "default" : "secondary"}
                    className="text-xs"
                  >
                    {q.questionType.toUpperCase()}
                  </Badge>
                  <span className="flex-1 text-sm truncate">{q.prompt}</span>
                </div>
              ))}
              {questions.length > 20 && (
                <p className="text-center text-sm text-muted-foreground py-2">
                  ...and {questions.length - 20} more questions
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Submit */}
      <div className="flex justify-end gap-4">
        <Link href="/community">
          <Button variant="outline">Cancel</Button>
        </Link>
        <Button
          onClick={handleSubmit}
          disabled={isSubmitting || !title.trim() || questions.length === 0}
          className="gap-2 bg-accent hover:bg-accent/90 text-accent-foreground"
        >
          {isSubmitting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Upload className="w-4 h-4" />
          )}
          Publish Package
        </Button>
      </div>
    </div>
  );
}
