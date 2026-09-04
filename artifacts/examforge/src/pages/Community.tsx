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
  FolderPlus,
  ExternalLink,
  User,
  CheckCircle2,
} from "lucide-react";
import { fetchPackages, type ExamPackage } from "@/lib/firestore-service";
import { getStoredUsername } from "@/lib/user-identity";
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
import { AddToCollectionDialog } from "@/components/AddToCollectionDialog";

export default function Community() {
  const [packages, setPackages] = useState<ExamPackage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [sortBy, setSortBy] = useState<"newest" | "popular" | "downloads">("newest");
  const [myUploadsOnly, setMyUploadsOnly] = useState(false);
  const [selectedPackageForAdd, setSelectedPackageForAdd] = useState<ExamPackage | null>(null);

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

  const currentUsername = getStoredUsername().trim().toLowerCase();

  const filteredPackages = useMemo(() => {
    if (!myUploadsOnly) return packages;
    if (!currentUsername) return packages;
    return packages.filter(
      (p) =>
        (p.postedByUsername && p.postedByUsername.toLowerCase() === currentUsername) ||
        (p.author && p.author.toLowerCase() === currentUsername)
    );
  }, [packages, myUploadsOnly, currentUsername]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold text-primary tracking-tight">
            Community Repository
          </h1>
          <p className="text-muted-foreground mt-2">
            Browse, import, and share verified exam packages with the community
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" className="gap-2" asChild>
            <a
              href="https://github.com/QweQuAB/Examhome"
              target="_blank"
              rel="noopener noreferrer"
              title="Remote repository on GitHub"
            >
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                />
              </svg>
              <span>GitHub Repo</span>
              <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
            </a>
          </Button>
          <Link href="/community/upload">
            <Button className="gap-2 bg-accent hover:bg-accent/90 text-accent-foreground font-semibold">
              <BookOpen className="w-4 h-4" /> Publish Package
            </Button>
          </Link>
        </div>
      </div>

      {/* Search and Filters */}
      <Card className="shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by title, course code, or topic..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="pl-9"
              />
            </div>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-full md:w-[170px]">
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
              variant={myUploadsOnly ? "default" : "outline"}
              onClick={() => setMyUploadsOnly(!myUploadsOnly)}
              className="gap-1.5 whitespace-nowrap"
              title={currentUsername ? `Filter packages by ${currentUsername}` : "Set username to filter your uploads"}
            >
              <User className="w-4 h-4" />
              <span>My Uploads</span>
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={loadPackages}
              disabled={isLoading}
              title="Refresh packages"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Users className="w-4 h-4" /> {filteredPackages.length} {filteredPackages.length === 1 ? "package" : "packages"} available
        </span>
        {myUploadsOnly && (
          <Badge variant="secondary" className="gap-1">
            Filtered by author: {currentUsername || "None"}
          </Badge>
        )}
      </div>

      {/* Error State */}
      {error && (
        <Card className="border-destructive/30 bg-destructive/10">
          <CardContent className="p-4 text-destructive flex items-center justify-between">
            <span>{error}</span>
            <Button variant="outline" size="sm" onClick={loadPackages}>
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="shadow-sm">
              <CardContent className="p-4 space-y-3">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <div className="flex gap-2 pt-2">
                  <Skeleton className="h-8 flex-1" />
                  <Skeleton className="h-8 flex-1" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && filteredPackages.length === 0 && (
        <div className="text-center py-12 space-y-4">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-medium">No packages found</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {myUploadsOnly
                ? "You have not published any packages yet with your current nickname."
                : search
                ? "Try adjusting your search query or filters."
                : "Be the first to share an exam package with the community!"}
            </p>
          </div>
          <Link href="/community/upload">
            <Button>Publish Package</Button>
          </Link>
        </div>
      )}

      {/* Package Grid */}
      {!isLoading && filteredPackages.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredPackages.map((pkg) => (
            <PackageCard
              key={pkg.id}
              pkg={pkg}
              onAddToCollection={(p) => setSelectedPackageForAdd(p)}
            />
          ))}
        </div>
      )}

      {/* Add to Collection Modal */}
      <AddToCollectionDialog
        packageData={selectedPackageForAdd}
        open={!!selectedPackageForAdd}
        onOpenChange={(open) => {
          if (!open) setSelectedPackageForAdd(null);
        }}
      />
    </div>
  );
}

function PackageCard({
  pkg,
  onAddToCollection,
}: {
  pkg: ExamPackage;
  onAddToCollection: (pkg: ExamPackage) => void;
}) {
  const mcqCount = (pkg.mcqQuestions || []).length;
  const essayCount = (pkg.essayQuestions || []).length;
  const totalQuestions = mcqCount + essayCount;

  return (
    <Card className="shadow-sm transition-all hover:shadow-md border-border/60 hover:border-accent/40 flex flex-col justify-between">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            {pkg.courseCode && (
              <Badge variant="secondary" className="mb-1 text-xs font-mono">
                {pkg.courseCode}
              </Badge>
            )}
            <h3 className="font-serif font-bold text-base line-clamp-2 text-foreground">
              {pkg.title}
            </h3>
          </div>
          <Badge variant="outline" className="text-xs shrink-0">
            {pkg.category}
          </Badge>
        </div>

        {pkg.institution && (
          <p className="text-xs text-muted-foreground">{pkg.institution}</p>
        )}

        {pkg.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
            {pkg.description}
          </p>
        )}

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1 font-medium text-foreground">
            <BookOpen className="w-3.5 h-3.5 text-primary" /> {totalQuestions} Questions
          </span>
          {mcqCount > 0 && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
              MCQ: {mcqCount}
            </Badge>
          )}
          {essayCount > 0 && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
              Essay: {essayCount}
            </Badge>
          )}
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border/40">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <Heart className="w-3 h-3 text-rose-500 fill-rose-500/20" /> {pkg.likeCount}
            </span>
            <span className="flex items-center gap-1">
              <Download className="w-3 h-3 text-primary" /> {pkg.downloadCount}
            </span>
          </div>
          <span className="truncate max-w-[120px]" title={pkg.postedByUsername || pkg.author}>
            by {pkg.postedByUsername || pkg.author}
          </span>
        </div>

        <div className="flex gap-2 pt-2">
          <Link href={`/community/${pkg.id}`} className="flex-1">
            <Button variant="outline" className="w-full text-xs" size="sm">
              View Details
            </Button>
          </Link>
          <Button
            variant="default"
            size="sm"
            className="flex-1 gap-1.5 text-xs bg-accent hover:bg-accent/90 text-accent-foreground font-semibold"
            onClick={() => onAddToCollection(pkg)}
          >
            <FolderPlus className="w-3.5 h-3.5" /> Add to Dashboard
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
