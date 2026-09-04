import { useState, useMemo, useCallback, useEffect } from "react";
import { Link } from "wouter";
import { format } from "date-fns";
import {
  BookOpen,
  History,
  TrendingUp,
  FileText,
  CheckCircle2,
  Trophy,
  Plus,
  Upload,
  Search,
  X,
} from "lucide-react";
import { useGetDashboard, useGetRecentAttempts, useListExams } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  LibraryControls,
  type LibraryPreferences,
  type SortOption,
  type LayoutMode,
} from "@/components/LibraryControls";
import { ExamCard } from "@/components/ExamCard";
import { ImportDialog } from "@/components/ImportDialog";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "examforge_library_prefs";

function loadPreferences(): LibraryPreferences {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {}
  return {
    search: "",
    sortBy: "newest",
    layout: "grid",
    selectedCourse: null,
    selectedInstitution: null,
  };
}

function savePreferences(prefs: LibraryPreferences) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {}
}

function sortExams(exams: any[], sortBy: SortOption) {
  const sorted = [...exams];
  switch (sortBy) {
    case "newest":
      return sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    case "oldest":
      return sorted.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    case "course":
      return sorted.sort((a, b) => (a.courseCode || "").localeCompare(b.courseCode || ""));
    case "title":
      return sorted.sort((a, b) => a.title.localeCompare(b.title));
    case "questions":
      return sorted.sort((a, b) => b.questionCount - a.questionCount);
    case "attempts":
      return sorted.sort((a, b) => b.attemptCount - a.attemptCount);
    default:
      return sorted;
  }
}

export default function Home() {
  const { data: dashboard, isLoading: isLoadingDashboard } = useGetDashboard();
  const { data: recentAttempts, isLoading: isLoadingAttempts } = useGetRecentAttempts({ limit: 5 });
  const { data: exams, isLoading: isLoadingExams } = useListExams();

  const [preferences, setPreferences] = useState<LibraryPreferences>(loadPreferences);
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  useEffect(() => {
    savePreferences(preferences);
  }, [preferences]);

  const availableCourses = useMemo(() => {
    if (!exams) return [];
    const courses = new Set<string>();
    exams.forEach((e) => {
      if (e.courseCode) courses.add(e.courseCode);
    });
    return Array.from(courses).sort();
  }, [exams]);

  const availableInstitutions = useMemo(() => {
    if (!exams) return [];
    const institutions = new Set<string>();
    exams.forEach((e) => {
      if (e.institution) institutions.add(e.institution);
    });
    return Array.from(institutions).sort();
  }, [exams]);

  const filteredExams = useMemo(() => {
    if (!exams) return [];

    let result = exams;

    // Search filter
    if (preferences.search) {
      const query = preferences.search.toLowerCase();
      result = result.filter(
        (e) =>
          e.title.toLowerCase().includes(query) ||
          (e.courseCode && e.courseCode.toLowerCase().includes(query)) ||
          (e.institution && e.institution.toLowerCase().includes(query))
      );
    }

    // Course filter
    if (preferences.selectedCourse) {
      result = result.filter((e) => e.courseCode === preferences.selectedCourse);
    }

    // Institution filter
    if (preferences.selectedInstitution) {
      result = result.filter((e) => e.institution === preferences.selectedInstitution);
    }

    // Sort
    return sortExams(result, preferences.sortBy);
  }, [exams, preferences]);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-serif font-bold text-primary tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-2">Overview of your study progress and exam statistics.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Exams</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoadingDashboard ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-3xl font-bold">{dashboard?.examCount || 0}</div>
            )}
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Questions</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoadingDashboard ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-3xl font-bold">{dashboard?.questionCount || 0}</div>
            )}
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Attempts Completed</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoadingDashboard ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-3xl font-bold">{dashboard?.finishedAttemptCount || 0}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Out of {dashboard?.attemptCount || 0} started
            </p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Score</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoadingDashboard ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-3xl font-bold">
                {dashboard?.avgScorePct ? `${Math.round(dashboard.avgScorePct)}%` : "—"}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Exams List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-serif font-semibold text-primary">Library</h2>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="gap-1 border-accent text-accent hover:bg-accent hover:text-accent-foreground font-semibold"
                onClick={() => setImportDialogOpen(true)}
              >
                <Upload className="h-4 w-4" /> Import
              </Button>
              <Link href="/exams/new">
                <Button
                  size="sm"
                  className="gap-1 bg-primary hover:bg-primary/90"
                >
                  <Plus className="h-4 w-4" /> Create
                </Button>
              </Link>
            </div>
          </div>

          {/* Library Controls */}
          {!isLoadingExams && exams && exams.length > 0 && (
            <LibraryControls
              preferences={preferences}
              onPreferencesChange={setPreferences}
              availableCourses={availableCourses}
              availableInstitutions={availableInstitutions}
              examCount={exams.length}
              filteredCount={filteredExams.length}
            />
          )}

          {/* Exam Cards */}
          {isLoadingExams ? (
            <div
              className={cn(
                "gap-4",
                preferences.layout === "grid"
                  ? "grid sm:grid-cols-2"
                  : "flex flex-col"
              )}
            >
              {Array(4)
                .fill(0)
                .map((_, i) => (
                  <Card key={i} className="shadow-sm">
                    <CardContent className="p-6">
                      <Skeleton className="h-24 w-full" />
                    </CardContent>
                  </Card>
                ))}
            </div>
          ) : exams?.length === 0 ? (
            /* Empty State - No Exams */
            <div className="py-16 text-center border-2 border-dashed border-border rounded-xl">
              <BookOpen className="mx-auto h-16 w-16 text-muted-foreground/30 mb-4" />
              <h3 className="text-xl font-medium mb-2">No exams yet</h3>
              <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                Create your first exam or import an existing package to get started.
              </p>
              <div className="flex justify-center gap-3">
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={() => setImportDialogOpen(true)}
                >
                  <Upload className="h-4 w-4" /> Import Package
                </Button>
                <Link href="/exams/new">
                  <Button className="gap-2 bg-primary hover:bg-primary/90">
                    <Plus className="h-4 w-4" /> Create Exam
                  </Button>
                </Link>
              </div>
            </div>
          ) : filteredExams.length === 0 ? (
            /* Empty State - No Results */
            <div className="py-12 text-center border-2 border-dashed border-border rounded-xl">
              <Search className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-medium mb-2">No matching exams</h3>
              <p className="text-muted-foreground mb-4">
                Try adjusting your search or filters.
              </p>
              <Button
                variant="outline"
                onClick={() =>
                  setPreferences({
                    search: "",
                    sortBy: "newest",
                    layout: preferences.layout,
                    selectedCourse: null,
                    selectedInstitution: null,
                  })
                }
                className="gap-2"
              >
                <X className="h-4 w-4" /> Clear Filters
              </Button>
            </div>
          ) : (
            <div
              className={cn(
                "gap-4",
                preferences.layout === "grid"
                  ? "grid sm:grid-cols-2"
                  : "flex flex-col"
              )}
            >
              {filteredExams.map((exam) => (
                <ExamCard key={exam.id} exam={exam} layout={preferences.layout} />
              ))}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-8">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2 font-serif">
                <Trophy className="h-5 w-5 text-accent" />
                Top Exams
              </CardTitle>
              <CardDescription>Most attempted exams</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoadingDashboard ? (
                <Skeleton className="h-32 w-full" />
              ) : dashboard?.topExams.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No data yet</p>
              ) : (
                dashboard?.topExams.map((exam, i) => (
                  <div key={exam.examId} className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-secondary text-xs font-bold text-muted-foreground">
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <Link
                        href={`/exams/${exam.examId}`}
                        className="text-sm font-medium hover:underline truncate block"
                      >
                        {exam.courseCode ? `${exam.courseCode}: ` : ""}
                        {exam.title}
                      </Link>
                      <p className="text-xs text-muted-foreground">{exam.attemptCount} attempts</p>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2 font-serif">
                <History className="h-5 w-5" />
                Recent Attempts
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoadingAttempts ? (
                <Skeleton className="h-32 w-full" />
              ) : recentAttempts?.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No attempts yet</p>
              ) : (
                recentAttempts?.map((attempt) => (
                  <div
                    key={attempt.id}
                    className="flex flex-col gap-1 border-b border-border/40 pb-3 last:border-0 last:pb-0"
                  >
                    <Link
                      href={`/attempts/${attempt.id}`}
                      className="text-sm font-medium hover:underline truncate"
                    >
                      {attempt.examTitle}
                    </Link>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        {format(new Date(attempt.startedAt), "MMM d, yyyy")}
                      </span>
                      {attempt.status === "finished" ? (
                        <Badge
                          variant="outline"
                          className="bg-success/10 text-success border-success/20"
                        >
                          {Math.round(attempt.scorePct)}%
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          In Progress
                        </Badge>
                      )}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <ImportDialog open={importDialogOpen} onOpenChange={setImportDialogOpen} />
    </div>
  );
}
