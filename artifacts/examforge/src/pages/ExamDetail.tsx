import { useState } from "react";
import { useLocation, useParams, Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { 
  BookOpen, Edit2, Plus, ArrowRight, Settings, Trash2, 
  AlertTriangle, Save, X, Target, History, TrendingUp,
  Star, Upload, Trophy, Download, Share2, Copy, ExternalLink
} from "lucide-react";
import { BulkImportDialog } from "@/components/BulkImportDialog";
import { LeaderboardTab } from "@/components/LeaderboardTab";
import { 
  buildExamPackage,
  downloadAsExamForge,
  copyPackageToClipboard,
  sharePackage,
} from "@/lib/package-utils";
import { 
  useGetExam, 
  useUpdateExam, 
  useDeleteExam, 
  useGetExamStats,
  useListAttemptsForExam,
  useCreateQuestion,
  useUpdateQuestion,
  useDeleteQuestion,
  getGetExamQueryKey,
  getGetExamStatsQueryKey,
  getListExamsQueryKey,
  getListAttemptsForExamQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// -- Form schemas --
const mcqQuestionSchema = z.object({
  questionType: z.literal("mcq"),
  topic: z.string().optional(),
  prompt: z.string().min(1, "Prompt is required"),
  options: z.array(z.string().min(1, "Option cannot be empty")).min(2).max(8),
  correctIndex: z.number().min(0),
  explanation: z.string().optional(),
  reference: z.string().optional(),
  repeatNote: z.string().optional(),
});

const essayQuestionSchema = z.object({
  questionType: z.literal("essay"),
  topic: z.string().optional(),
  prompt: z.string().min(1, "Prompt is required"),
  essayAnswer: z.string().optional(),
  explanation: z.string().optional(),
  reference: z.string().optional(),
  repeatNote: z.string().optional(),
});

const questionSchema = z.discriminatedUnion("questionType", [mcqQuestionSchema, essayQuestionSchema]);
type QuestionFormValues = z.infer<typeof mcqQuestionSchema> | z.infer<typeof essayQuestionSchema>;

const examMetaSchema = z.object({
  title: z.string().min(1, "Title is required"),
  courseCode: z.string().optional(),
  institution: z.string().optional(),
  description: z.string().optional(),
});
type ExamMetaValues = z.infer<typeof examMetaSchema>;

export default function ExamDetail() {
  const { examId } = useParams();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState("questions");
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [isEditingMeta, setIsEditingMeta] = useState(false);
  const [showDeleteExam, setShowDeleteExam] = useState(false);
  const [showAddQuestion, setShowAddQuestion] = useState(false);
  const [showImport, setShowImport] = useState(false);

  // -- Queries --
  const { data: exam, isLoading: isLoadingExam } = useGetExam(examId!, { 
    query: { enabled: !!examId, queryKey: getGetExamQueryKey(examId!) } 
  });
  const { data: stats, isLoading: isLoadingStats } = useGetExamStats(examId!, { 
    query: { enabled: !!examId, queryKey: getGetExamStatsQueryKey(examId!) } 
  });
  const { data: attempts, isLoading: isLoadingAttempts } = useListAttemptsForExam(examId!, { limit: 10 }, {
    query: { enabled: !!examId, queryKey: getListAttemptsForExamQueryKey(examId!, { limit: 10 }) }
  });

  // -- Mutations --
  const updateExam = useUpdateExam();
  const deleteExam = useDeleteExam();
  const createQuestion = useCreateQuestion();
  const updateQuestion = useUpdateQuestion();
  const deleteQuestion = useDeleteQuestion();

  // -- Forms --
  const metaForm = useForm<ExamMetaValues>({
    resolver: zodResolver(examMetaSchema),
    values: exam ? {
      title: exam.title,
      courseCode: exam.courseCode || "",
      institution: exam.institution || "",
      description: exam.description || "",
    } : undefined
  });

  const questionForm = useForm<QuestionFormValues>({
    resolver: zodResolver(questionSchema) as any,
    defaultValues: {
      questionType: "mcq",
      prompt: "",
      topic: "",
      options: ["", "", "", ""],
      correctIndex: 0,
      essayAnswer: "",
      explanation: "",
      reference: "",
      repeatNote: "",
    } as QuestionFormValues
  });

  // -- Handlers --
  const onSaveMeta = (data: ExamMetaValues) => {
    updateExam.mutate({
      examId: examId!,
      data: {
        title: data.title,
        courseCode: data.courseCode || null,
        institution: data.institution || null,
        description: data.description || null
      }
    }, {
      onSuccess: () => {
        setIsEditingMeta(false);
        queryClient.invalidateQueries({ queryKey: getGetExamQueryKey(examId!) });
        queryClient.invalidateQueries({ queryKey: getListExamsQueryKey() });
      }
    });
  };

  const onDeleteExam = () => {
    deleteExam.mutate({ examId: examId! }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListExamsQueryKey() });
        setLocation("/");
      }
    });
  };

  // -- Export Handlers --
  const handleExportExamForge = () => {
    if (!exam) return;
    const pkg = buildExamPackage(exam, exam.questions);
    downloadAsExamForge(pkg);
    toast.success("Package downloaded as .examforge file");
  };

  const handleCopyJson = async () => {
    if (!exam) return;
    const pkg = buildExamPackage(exam, exam.questions);
    const success = await copyPackageToClipboard(pkg);
    if (success) {
      toast.success("Package JSON copied to clipboard");
    } else {
      toast.error("Failed to copy to clipboard");
    }
  };

  const handleShare = async () => {
    if (!exam) return;
    const pkg = buildExamPackage(exam, exam.questions);
    const success = await sharePackage(pkg);
    if (success) {
      toast.success("Package shared successfully");
    }
  };

  const handleShareQuestion = async (questionIndex: number) => {
    if (!exam) return;
    const { shareSingleQuestion } = await import("@/lib/package-utils");
    const pkg = buildExamPackage(exam, exam.questions);
    const success = await shareSingleQuestion(pkg, questionIndex);
    if (success) {
      toast.success("Question shared");
    }
  };

  const handleCopyQuestion = async (questionIndex: number) => {
    if (!exam) return;
    const { copySingleQuestionToClipboard } = await import("@/lib/package-utils");
    const pkg = buildExamPackage(exam, exam.questions);
    const success = await copySingleQuestionToClipboard(pkg, questionIndex);
    if (success) {
      toast.success("Question JSON copied");
    } else {
      toast.error("Failed to copy");
    }
  };

  const onSaveQuestion = (data: QuestionFormValues) => {
    const qType = data.questionType;
    const baseData = {
      questionType: qType,
      prompt: data.prompt,
      topic: data.topic || null,
      explanation: data.explanation || null,
      reference: data.reference || null,
      repeatNote: data.repeatNote || null,
    };

    const payload = qType === "mcq"
      ? { ...baseData, options: data.options, correctIndex: data.correctIndex }
      : { ...baseData, essayAnswer: data.essayAnswer || null, options: [], correctIndex: 0 };

    if (editingQuestionId) {
      updateQuestion.mutate({
        questionId: editingQuestionId,
        data: payload,
      }, {
        onSuccess: () => {
          setEditingQuestionId(null);
          queryClient.invalidateQueries({ queryKey: getGetExamQueryKey(examId!) });
        }
      });
    } else {
      createQuestion.mutate({
        examId: examId!,
        data: payload,
      }, {
        onSuccess: () => {
          setShowAddQuestion(false);
          questionForm.reset({ questionType: qType } as QuestionFormValues);
          queryClient.invalidateQueries({ queryKey: getGetExamQueryKey(examId!) });
          queryClient.invalidateQueries({ queryKey: getGetExamStatsQueryKey(examId!) });
        }
      });
    }
  };

  const openEditQuestion = (q: any) => {
    const qType = q.questionType || "mcq";
    questionForm.reset({
      questionType: qType,
      prompt: q.prompt,
      topic: q.topic || "",
      options: qType === "mcq" ? [...q.options] : [],
      correctIndex: qType === "mcq" ? q.correctIndex : 0,
      essayAnswer: q.essayAnswer || "",
      explanation: q.explanation || "",
      reference: q.reference || "",
      repeatNote: q.repeatNote || "",
    });
    setEditingQuestionId(q.id);
  };

  const cancelQuestionEdit = () => {
    setEditingQuestionId(null);
    setShowAddQuestion(false);
    questionForm.reset({
      questionType: "mcq",
      prompt: "",
      topic: "",
      options: ["", "", "", ""],
      correctIndex: 0,
      essayAnswer: "",
      explanation: "",
      reference: "",
      repeatNote: "",
    } as QuestionFormValues);
  };

  if (isLoadingExam) {
    return <div className="max-w-5xl mx-auto space-y-6"><Skeleton className="h-32 w-full" /><Skeleton className="h-96 w-full" /></div>;
  }

  if (!exam) {
    return <div className="text-center py-20">Exam not found</div>;
  }

  return (
    <div className="max-w-5xl mx-auto w-full animate-in fade-in duration-500 space-y-8">
      {/* Header */}
      <Card className="border-border/60 shadow-sm bg-gradient-to-br from-card to-card/50">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-6 justify-between items-start">
            <div className="flex-1 space-y-4">
              {isEditingMeta ? (
                <Form {...metaForm}>
                  <form onSubmit={metaForm.handleSubmit(onSaveMeta)} className="space-y-4">
                    <FormField control={metaForm.control} name="title" render={({ field }) => (
                      <FormItem><FormControl><Input {...field} className="font-serif text-lg font-bold" /></FormControl></FormItem>
                    )} />
                    <div className="flex gap-4">
                      <FormField control={metaForm.control} name="courseCode" render={({ field }) => (
                        <FormItem className="flex-1"><FormControl><Input placeholder="Course Code" {...field} /></FormControl></FormItem>
                      )} />
                      <FormField control={metaForm.control} name="institution" render={({ field }) => (
                        <FormItem className="flex-1"><FormControl><Input placeholder="Institution" {...field} /></FormControl></FormItem>
                      )} />
                    </div>
                    <FormField control={metaForm.control} name="description" render={({ field }) => (
                      <FormItem><FormControl><Textarea placeholder="Description" {...field} /></FormControl></FormItem>
                    )} />
                    <div className="flex gap-2">
                      <Button size="sm" type="submit" disabled={updateExam.isPending}><Save className="w-4 h-4 mr-2"/> Save</Button>
                      <Button size="sm" variant="outline" onClick={() => setIsEditingMeta(false)}>Cancel</Button>
                    </div>
                  </form>
                </Form>
              ) : (
                <>
                  <div>
                    {exam.courseCode && <Badge className="mb-2 bg-secondary text-secondary-foreground hover:bg-secondary/80">{exam.courseCode}</Badge>}
                    <h1 className="text-3xl font-serif font-bold text-primary tracking-tight">{exam.title}</h1>
                    {exam.institution && <p className="text-sm font-medium text-muted-foreground mt-1">{exam.institution}</p>}
                  </div>
                  {exam.description && <p className="text-muted-foreground">{exam.description}</p>}
                </>
              )}
            </div>

            <div className="flex flex-col gap-3 min-w-[200px]">
              <Link href={`/exams/${exam.id}/take`}>
                <Button size="lg" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-md gap-2">
                  Take Quiz <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              {!isEditingMeta && (
                <div className="flex gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="flex-1 gap-2">
                        <Share2 className="w-4 h-4" /> Share
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem onClick={handleExportExamForge}>
                        <Download className="w-4 h-4 mr-2" /> Download .examforge
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={handleCopyJson}>
                        <Copy className="w-4 h-4 mr-2" /> Copy JSON
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={handleShare}>
                        <ExternalLink className="w-4 h-4 mr-2" /> Share...
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => setIsEditingMeta(true)}>
                    <Settings className="w-4 h-4 mr-2" /> Edit
                  </Button>
                  <Dialog open={showDeleteExam} onOpenChange={setShowDeleteExam}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="icon" className="text-destructive border-destructive/20 hover:bg-destructive/10"><Trash2 className="w-4 h-4"/></Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Delete Exam?</DialogTitle>
                        <DialogDescription>This action cannot be undone. All questions and attempts will be permanently deleted.</DialogDescription>
                      </DialogHeader>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setShowDeleteExam(false)}>Cancel</Button>
                        <Button variant="destructive" onClick={onDeleteExam} disabled={deleteExam.isPending}>Yes, Delete</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full justify-start h-12 bg-transparent border-b border-border/40 rounded-none p-0">
          <TabsTrigger value="questions" className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none px-6 h-12 font-medium">
            Questions ({exam.questions.length})
          </TabsTrigger>
          <TabsTrigger value="stats" className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none px-6 h-12 font-medium">
            Stats & Attempts
          </TabsTrigger>
          <TabsTrigger value="leaderboard" className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none px-6 h-12 font-medium gap-2">
            <Trophy className="w-4 h-4" /> Leaderboard
          </TabsTrigger>
        </TabsList>

        <TabsContent value="questions" className="pt-6 space-y-6">
          {!showAddQuestion && !editingQuestionId && (
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowImport(true)} className="gap-2">
                <Upload className="w-4 h-4" /> Import
              </Button>
              <Button onClick={() => setShowAddQuestion(true)} className="gap-2 bg-accent hover:bg-accent/90 text-accent-foreground">
                <Plus className="w-4 h-4" /> Add Question
              </Button>
            </div>
          )}

          {showAddQuestion && (
            <Card className="border-accent shadow-md relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-accent"></div>
              <CardHeader>
                <CardTitle className="text-lg">New Question</CardTitle>
              </CardHeader>
              <CardContent>
                <QuestionEditorForm form={questionForm} onSave={onSaveQuestion} onCancel={cancelQuestionEdit} isPending={createQuestion.isPending} />
              </CardContent>
            </Card>
          )}

          <div className="space-y-4">
            {exam.questions.map((q, index) => (
              editingQuestionId === q.id ? (
                <Card key={q.id} className="border-primary shadow-md relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-primary"></div>
                  <CardHeader>
                    <CardTitle className="text-lg">Edit Question {index + 1}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <QuestionEditorForm form={questionForm} onSave={onSaveQuestion} onCancel={cancelQuestionEdit} isPending={updateQuestion.isPending} />
                  </CardContent>
                </Card>
              ) : (
                <Card key={q.id} className="hover:border-primary/30 transition-colors shadow-sm">
                  <CardContent className="p-6">
                    <div className="flex gap-4">
                      <div className="flex-none pt-1">
                        <span className="flex items-center justify-center w-8 h-8 rounded-full bg-secondary text-secondary-foreground font-bold text-sm">
                          {index + 1}
                        </span>
                      </div>
                      <div className="flex-1 space-y-4">
                        <div className="flex justify-between items-start">
                          <div>
                            {q.topic && <Badge variant="outline" className="mb-2 text-accent border-accent/30 bg-accent/5">{q.topic}</Badge>}
                            <div className="font-medium text-lg leading-snug">
                              {q.prompt}
                              {q.repeatNote && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="inline-flex ml-2 align-middle cursor-help text-accent hover:scale-110 transition-transform">
                                      <Star className="w-5 h-5 fill-current" />
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent className="bg-primary text-primary-foreground p-3 max-w-xs text-sm">
                                    <div dangerouslySetInnerHTML={{ __html: q.repeatNote }} />
                                  </TooltipContent>
                                </Tooltip>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-1 ml-4 opacity-0 hover:opacity-100 transition-opacity" style={{ opacity: 1 }}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <Share2 className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleShareQuestion(index)}>
                                  <Share2 className="w-4 h-4 mr-2" /> Share Question
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleCopyQuestion(index)}>
                                  <Copy className="w-4 h-4 mr-2" /> Copy JSON
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditQuestion(q)}>
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => {
                                if (confirm("Delete this question?")) {
                                  deleteQuestion.mutate({ questionId: q.id }, {
                                    onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetExamQueryKey(examId!) })
                                  });
                                }
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>

                        <div className="grid sm:grid-cols-2 gap-3">
                          {q.options.map((opt, i) => (
                            <div key={i} className={`p-3 rounded-lg border text-sm flex gap-3 ${i === q.correctIndex ? 'border-success bg-success/5 font-medium' : 'border-border/60 bg-card'}`}>
                              <span className={`flex-none w-6 h-6 rounded-full flex items-center justify-center text-xs ${i === q.correctIndex ? 'bg-success text-success-foreground' : 'bg-secondary text-secondary-foreground'}`}>
                                {String.fromCharCode(65 + i)}
                              </span>
                              <span>{opt}</span>
                            </div>
                          ))}
                        </div>

                        {(q.explanation || q.reference) && (
                          <div className="bg-secondary/30 p-4 rounded-lg text-sm space-y-2 mt-4 border border-border/40">
                            {q.explanation && (
                              <div><span className="font-semibold text-primary">Explanation:</span> <span className="text-muted-foreground">{q.explanation}</span></div>
                            )}
                            {q.reference && (
                              <div><span className="font-semibold text-primary">Reference:</span> <span className="text-muted-foreground">{q.reference}</span></div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            ))}

            {exam.questions.length === 0 && !showAddQuestion && (
              <div className="text-center py-16 border-2 border-dashed border-border/60 rounded-xl">
                <Target className="mx-auto h-12 w-12 text-muted-foreground/40 mb-4" />
                <h3 className="text-lg font-medium">No questions yet</h3>
                <p className="text-muted-foreground mt-1 mb-4">Start building your exam by adding questions one by one, or import a batch from a JSON file.</p>
                <div className="flex items-center justify-center gap-2">
                  <Button variant="outline" onClick={() => setShowImport(true)} className="gap-2">
                    <Upload className="w-4 h-4" /> Bulk Import
                  </Button>
                  <Button onClick={() => setShowAddQuestion(true)} className="bg-accent hover:bg-accent/90 text-accent-foreground gap-2">
                    <Plus className="w-4 h-4" /> Add First Question
                  </Button>
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="stats" className="pt-6 space-y-6">
          {isLoadingStats ? (
             <Skeleton className="h-64 w-full" />
          ) : (
            <div className="grid gap-6 md:grid-cols-3">
              <Card className="shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2"><History className="w-4 h-4"/> Total Attempts</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{stats?.attemptCount || 0}</div>
                </CardContent>
              </Card>
              <Card className="shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2"><TrendingUp className="w-4 h-4"/> Average Score</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{stats?.avgScorePct != null ? `${Math.round(stats.avgScorePct)}%` : '—'}</div>
                </CardContent>
              </Card>
              <Card className="shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2"><Target className="w-4 h-4"/> Best Score</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-accent">{stats?.bestScorePct != null ? `${Math.round(stats.bestScorePct)}%` : '—'}</div>
                </CardContent>
              </Card>
              
              {stats?.topicBreakdown && stats.topicBreakdown.length > 0 && (
                <Card className="md:col-span-3 shadow-sm">
                  <CardHeader>
                    <CardTitle className="font-serif">Topic Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {stats.topicBreakdown.map((t, i) => (
                        <Badge key={i} variant="secondary" className="px-3 py-1 text-sm bg-secondary text-secondary-foreground border-border/40">
                          {t.topic || "Uncategorized"} <span className="ml-2 opacity-50">{t.count}</span>
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          <div>
            <h3 className="text-lg font-serif font-semibold mb-4">Recent Attempts</h3>
            <Card className="shadow-sm">
              <CardContent className="p-0">
                {isLoadingAttempts ? (
                  <div className="p-6"><Skeleton className="h-20 w-full" /></div>
                ) : attempts?.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">No attempts recorded yet.</div>
                ) : (
                  <div className="divide-y divide-border/40">
                    {attempts?.map(attempt => (
                      <div key={attempt.id} className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
                        <div>
                          <div className="font-medium">{format(new Date(attempt.startedAt), "PPP 'at' p")}</div>
                          <div className="text-sm text-muted-foreground">{attempt.status === 'finished' ? `Score: ${attempt.score}/${attempt.total}` : 'In Progress'}</div>
                        </div>
                        <div className="flex items-center gap-4">
                          {attempt.status === 'finished' ? (
                            <Badge className="bg-success text-success-foreground hover:bg-success">
                              {Math.round(attempt.scorePct)}%
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground border-border/60">
                              Ongoing
                            </Badge>
                          )}
                          <Link href={`/attempts/${attempt.id}`}>
                            <Button variant="ghost" size="sm">Review</Button>
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="leaderboard" className="pt-6">
          <LeaderboardTab examId={examId!} />
        </TabsContent>
      </Tabs>

      <BulkImportDialog open={showImport} onOpenChange={setShowImport} examId={examId!} />
    </div>
  );
}

function QuestionEditorForm({ form, onSave, onCancel, isPending }: { form: any, onSave: any, onCancel: any, isPending: boolean }) {
  const questionType = form.watch("questionType");

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSave)} className="space-y-6">
        {/* Question Type Toggle */}
        <FormField control={form.control} name="questionType" render={({ field }) => (
          <FormItem>
            <FormLabel>Question Type</FormLabel>
            <FormControl>
              <div className="flex gap-2">
                <Button type="button" variant={questionType === "mcq" ? "default" : "outline"} size="sm" onClick={() => {
                  field.onChange("mcq");
                  form.setValue("options", ["", "", "", ""]);
                  form.setValue("correctIndex", 0);
                }}>MCQ</Button>
                <Button type="button" variant={questionType === "essay" ? "default" : "outline"} size="sm" onClick={() => {
                  field.onChange("essay");
                  form.setValue("options", []);
                  form.setValue("correctIndex", 0);
                }}>Essay</Button>
              </div>
            </FormControl>
          </FormItem>
        )} />

        <div className="grid sm:grid-cols-2 gap-4">
          <FormField control={form.control} name="topic" render={({ field }) => (
            <FormItem>
              <FormLabel>Topic tag</FormLabel>
              <FormControl><Input placeholder="e.g. Scope & Objectives" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )} />
        </div>

        <FormField control={form.control} name="prompt" render={({ field }) => (
          <FormItem>
            <FormLabel>Question Prompt <span className="text-destructive">*</span></FormLabel>
            <FormControl><Textarea className="min-h-[80px]" placeholder="What is the main objective of..." {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />

        {/* MCQ: Options */}
        {questionType === "mcq" && (
          <div className="space-y-4">
            <Label>Options & Correct Answer <span className="text-destructive">*</span></Label>
            <FormField control={form.control} name="correctIndex" render={({ field }) => (
              <FormItem>
                <FormControl>
                  <RadioGroup
                    value={field.value.toString()}
                    onValueChange={(val) => field.onChange(parseInt(val))}
                    className="space-y-3"
                  >
                    {[0, 1, 2, 3].map((index) => (
                      <div key={index} className={`flex items-start space-x-3 p-3 border rounded-lg transition-colors ${field.value === index ? 'border-primary bg-primary/5' : 'border-border/60'}`}>
                        <RadioGroupItem value={index.toString()} id={`opt-${index}`} className="mt-2" />
                        <div className="flex-1">
                          <FormField control={form.control} name={`options.${index}`} render={({ field: optField }) => (
                            <FormItem>
                              <FormControl>
                                <Input placeholder={`Option ${String.fromCharCode(65 + index)}`} {...optField} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                        </div>
                      </div>
                    ))}
                  </RadioGroup>
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
          </div>
        )}

        {/* Essay: Model Answer */}
        {questionType === "essay" && (
          <FormField control={form.control} name="essayAnswer" render={({ field }) => (
            <FormItem>
              <FormLabel>Model Answer (for reference)</FormLabel>
              <FormControl><Textarea className="min-h-[100px]" placeholder="Provide a model answer or key points for grading reference..." {...field} /></FormControl>
              <CardDescription>This answer will be used as a reference for AI-assisted grading.</CardDescription>
            </FormItem>
          )} />
        )}

        <div className="grid sm:grid-cols-2 gap-6 pt-4 border-t border-border/40">
          <FormField control={form.control} name="explanation" render={({ field }) => (
            <FormItem>
              <FormLabel>Explanation</FormLabel>
              <FormControl><Textarea placeholder="Why is this correct?" className="h-24 resize-none" {...field} /></FormControl>
            </FormItem>
          )} />
          <FormField control={form.control} name="reference" render={({ field }) => (
            <FormItem>
              <FormLabel>Reference</FormLabel>
              <FormControl><Textarea placeholder="Unit 1 Section 4.1" className="h-24 resize-none" {...field} /></FormControl>
            </FormItem>
          )} />
        </div>

        <FormField control={form.control} name="repeatNote" render={({ field }) => (
          <FormItem>
            <FormLabel className="flex items-center gap-2">Repeat Star Note <Star className="w-3 h-3 text-accent fill-current"/></FormLabel>
            <FormControl><Textarea placeholder="Appears 3 times in Exams:<br>• 2018 Q1" className="h-20 font-mono text-sm" {...field} /></FormControl>
            <CardDescription>Supports basic HTML like &lt;br&gt; for line breaks.</CardDescription>
          </FormItem>
        )} />

        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>Cancel</Button>
          <Button type="submit" disabled={isPending} className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground">
            <Save className="w-4 h-4" /> Save Question
          </Button>
        </div>
      </form>
    </Form>
  );
}
