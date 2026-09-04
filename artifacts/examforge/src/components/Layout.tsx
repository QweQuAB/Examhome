import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { BookOpen, Home, LayoutDashboard, History, Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background text-foreground">
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 md:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6 md:gap-10">
            <Link href="/" className="flex items-center gap-2 transition-colors hover:text-foreground/80">
              <BookOpen className="h-6 w-6 text-accent" />
              <span className="font-serif font-bold text-xl tracking-tight hidden sm:inline-block">
                ExamForge
              </span>
            </Link>
            <nav className="flex items-center gap-4 text-sm font-medium text-muted-foreground">
              <Link href="/" className={`transition-colors hover:text-foreground ${location === "/" ? "text-foreground" : ""}`}>
                Dashboard
              </Link>
              <Link
                href="/community"
                className={`transition-colors hover:text-foreground ${
                  location.startsWith("/community") ? "text-foreground" : ""
                }`}
              >
                Community
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/exams/new" className="hidden md:inline-flex">
              <Button size="sm" variant="outline" className="gap-2 border-accent text-accent hover:bg-accent hover:text-accent-foreground font-semibold">
                <Plus className="h-4 w-4" />
                Create Exam
              </Button>
            </Link>
          </div>
        </div>
      </header>
      <main className="flex-1 container mx-auto px-4 md:px-8 py-8 flex flex-col">
        {children}
      </main>
      <footer className="py-6 md:px-8 md:py-0 border-t border-border/40">
        <div className="container mx-auto flex flex-col items-center justify-between gap-4 md:h-16 md:flex-row text-center text-sm text-muted-foreground">
          <p>
            ExamForge — scholarly study companion.
          </p>
        </div>
      </footer>
    </div>
  );
}
