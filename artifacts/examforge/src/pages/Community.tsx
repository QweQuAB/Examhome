import { useState, useEffect, useMemo } from "react";
import { Link } from "wouter";
import { format } from "date-fns";
import {
  Search,
  Download,
  Heart,
  MessageSquare,
  Filter,
  SortAsc,
  Users,
  BookOpen,
  ArrowRight,
  RefreshCw,
} from "lucide-react";
import { fetchPackages, type ExamPackage } from "@/lib/firestore-service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CATEGORIES } from "@/lib/firestore-service";

export default function Community() {
  const [packages, setPackages] = useState<ExamPackage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [sortBy, setSortBy] = useState<"newest" | "popular" | "downloads">("newest");

  const loadPackages = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchPackages({ category, sortBy, search });
      setPackages(data);
    } catch (err: any) {
      setError(err.message || "Failed to load packages");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPackages();
  }, [category, sortBy]);

  const handleSearch = () => {
    loadPackages();
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold text-primary tracking-tight">
            Community Repository
          </h1>
          <p className="text-muted-foreground mt-2">
            Browse and share exam packages with the community
          </p>
        </div>
        <Link href="/community/upload">
          <Button className="gap-2 bg-accent hover:bg-accent/90 text-accent-foreground">
            <BookOpen className="w-4 h-4" /> Publish Package
          </Button>
        </Link>
      </div>

      {/* Search and Filters */}
      <Card className="shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by title, course, or institution..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="pl-9"
              />
            </div>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-full md:w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All Categories</SelectItem>
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={sortBy}
              onValueChange={(v) => setSortBy(v as typeof sortBy)}
            >
              <SelectTrigger className="w-full md:w-[160px]">
                <SortAsc className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest</SelectItem>
                <SelectItem value="popular">Most Liked</SelectItem>
                <SelectItem value="downloads">Most Downloaded</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              onClick={loadPackages}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span className="flex items-center gap-1">
          <Users className="w-4 h-4" /> {packages.length} packages
        </span>
      </div>

      {/* Error State */}
      {error && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="p-4 text-destructive text-sm">
            {error}
            <Button variant="outline" size="sm" className="ml-4" onClick={loadPackages}>
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array(6)
            .fill(0)
            .map((_, i) => (
              <Card key={i} className="shadow-sm">
                <CardContent className="p-4">
                  <Skeleton className="h-6 w-20 mb-2" />
                  <Skeleton className="h-5 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-1/2 mb-4" />
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-8 w-full" />
                </CardContent>
              </Card>
            ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && packages.length === 0 && (
        <div className="py-16 text-center border-2 border-dashed border-border rounded-xl">
          <BookOpen className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-medium mb-2">No packages found</h3>
          <p className="text-muted-foreground mb-4">
            {search ? "Try a different search term" : "Be the first to publish a package!"}
          </p>
          <Link href="/community/upload">
            <Button>Publish Package</Button>
          </Link>
        </div>
      )}

      {/* Package Grid */}
      {!isLoading && packages.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {packages.map((pkg) => (
            <PackageCard key={pkg.id} pkg={pkg} />
          ))}
        </div>
      )}
    </div>
  );
}

function PackageCard({ pkg }: { pkg: ExamPackage }) {
  const totalQuestions = pkg.mcqQuestions.length + pkg.essayQuestions.length;
  const mcqCount = pkg.mcqQuestions.length;
  const essayCount = pkg.essayQuestions.length;

  return (
    <Card className="shadow-sm transition-all hover:shadow-md border-border/60 hover:border-accent/40">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            {pkg.courseCode && (
              <Badge variant="secondary" className="mb-1 text-xs">
                {pkg.courseCode}
              </Badge>
            )}
            <h3 className="font-medium line-clamp-2">{pkg.title}</h3>
          </div>
          <Badge variant="outline" className="text-xs shrink-0">
            {pkg.category}
          </Badge>
        </div>

        {pkg.institution && (
          <p className="text-xs text-muted-foreground">{pkg.institution}</p>
        )}

        {pkg.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {pkg.description}
          </p>
        )}

        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <BookOpen className="w-3 h-3" /> {totalQuestions} Qs
          </span>
          {mcqCount > 0 && (
            <span className="text-muted-foreground/70">MCQ: {mcqCount}</span>
          )}
          {essayCount > 0 && (
            <span className="text-muted-foreground/70">Essay: {essayCount}</span>
          )}
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border/40">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <Heart className="w-3 h-3" /> {pkg.likeCount}
            </span>
            <span className="flex items-center gap-1">
              <Download className="w-3 h-3" /> {pkg.downloadCount}
            </span>
          </div>
          <span>by {pkg.postedByUsername || pkg.author}</span>
        </div>

        <div className="flex gap-2 pt-2">
          <Link href={`/community/${pkg.id}`} className="flex-1">
            <Button variant="secondary" className="w-full" size="sm">
              View Details
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
