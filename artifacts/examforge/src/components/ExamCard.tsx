import { Link } from "wouter";
import { format } from "date-fns";
import {
  FileText,
  History,
  ArrowRight,
  Share2,
  Trash2,
  MoreVertical,
  School,
  Calendar,
  MoreHorizontal,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { LayoutMode } from "./LibraryControls";

interface Exam {
  id: string;
  title: string;
  courseCode?: string | null;
  institution?: string | null;
  questionCount: number;
  attemptCount: number;
  description?: string | null;
  createdAt: string;
}

interface ExamCardProps {
  exam: Exam;
  layout: LayoutMode;
  onShare?: (examId: string) => void;
  onDelete?: (examId: string) => void;
}

export function ExamCard({ exam, layout, onShare, onDelete }: ExamCardProps) {
  if (layout === "stacked") {
    return (
      <ExamCardStacked exam={exam} onShare={onShare} onDelete={onDelete} />
    );
  }
  return (
    <ExamCardGrid exam={exam} onShare={onShare} onDelete={onDelete} />
  );
}

function ExamCardStacked({ exam, onShare, onDelete }: Omit<ExamCardProps, "layout">) {
  return (
    <Card className="shadow-sm transition-all hover:shadow-md border-border/60 hover:border-accent/40">
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              {exam.courseCode && (
                <Badge variant="secondary" className="bg-secondary text-secondary-foreground truncate max-w-[120px]">
                  {exam.courseCode}
                </Badge>
              )}
              {exam.institution && (
                <Badge variant="outline" className="text-xs gap-1 truncate max-w-[150px]">
                  <School className="h-3 w-3 shrink-0" />
                  {exam.institution}
                </Badge>
              )}
            </div>

            <h3 className="font-serif font-semibold text-lg leading-tight line-clamp-2">
              {exam.title}
            </h3>

            {exam.description && (
              <p className="text-sm text-muted-foreground line-clamp-2">{exam.description}</p>
            )}

            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <FileText className="w-3 h-3 shrink-0" /> {exam.questionCount} questions
              </span>
              <span className="flex items-center gap-1">
                <History className="w-3 h-3 shrink-0" /> {exam.attemptCount} attempts
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3 shrink-0" /> {format(new Date(exam.createdAt), "MMM d, yyyy")}
              </span>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onShare?.(exam.id)}>
                <Share2 className="h-4 w-4 mr-2" /> Share
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onDelete?.(exam.id)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex gap-2 mt-4">
          <Link href={`/exams/${exam.id}`} className="flex-1">
            <Button variant="secondary" className="w-full">Manage</Button>
          </Link>
          <Link href={`/exams/${exam.id}/take`} className="flex-1">
            <Button variant="default" className="w-full bg-primary hover:bg-primary/90 gap-1">
              Take Quiz <ArrowRight className="w-3 h-3" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

function ExamCardGrid({ exam, onShare, onDelete }: Omit<ExamCardProps, "layout">) {
  return (
    <Card className="flex flex-col shadow-sm transition-all hover:shadow-md border-border/60 hover:border-accent/40">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start gap-4">
          <div className="flex-1 min-w-0">
            {exam.courseCode && (
              <Badge variant="secondary" className="mb-2 bg-secondary text-secondary-foreground truncate max-w-full block">
                {exam.courseCode}
              </Badge>
            )}
            <CardTitle className="line-clamp-2 text-lg leading-tight font-serif">
              {exam.title}
            </CardTitle>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onShare?.(exam.id)}>
                <Share2 className="h-4 w-4 mr-2" /> Share
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onDelete?.(exam.id)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {exam.institution && (
          <CardDescription className="flex items-center gap-1 truncate">
            <School className="h-3 w-3 shrink-0" /> {exam.institution}
          </CardDescription>
        )}
      </CardHeader>

      <CardContent className="flex-1 pb-3 text-sm text-muted-foreground">
        {exam.description && (
          <p className="line-clamp-2 mb-3">{exam.description}</p>
        )}
        <div className="flex justify-between items-center">
          <span className="flex items-center gap-1">
            <FileText className="w-3 h-3 shrink-0" /> {exam.questionCount} questions
          </span>
          <span className="flex items-center gap-1">
            <History className="w-3 h-3 shrink-0" /> {exam.attemptCount} attempts
          </span>
        </div>
        <div className="flex items-center gap-1 mt-2 text-xs">
          <Calendar className="w-3 h-3 shrink-0" /> {format(new Date(exam.createdAt), "MMM d, yyyy")}
        </div>
      </CardContent>

      <CardFooter className="pt-3 border-t border-border/40 gap-2">
        <Link href={`/exams/${exam.id}`} className="flex-1">
          <Button variant="secondary" className="w-full">Manage</Button>
        </Link>
        <Link href={`/exams/${exam.id}/take`} className="flex-1">
          <Button variant="default" className="w-full bg-primary hover:bg-primary/90 gap-1">
            Take Quiz <ArrowRight className="w-3 h-3" />
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
}
