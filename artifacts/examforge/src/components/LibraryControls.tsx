import { useState, useMemo } from "react";
import { Search, X, ArrowUpDown, LayoutGrid, LayoutList, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type SortOption = "newest" | "oldest" | "course" | "title" | "questions" | "attempts";
export type LayoutMode = "grid" | "stacked";

export interface LibraryPreferences {
  search: string;
  sortBy: SortOption;
  layout: LayoutMode;
  selectedCourse: string | null;
  selectedInstitution: string | null;
}

interface LibraryControlsProps {
  preferences: LibraryPreferences;
  onPreferencesChange: (prefs: LibraryPreferences) => void;
  availableCourses: string[];
  availableInstitutions: string[];
  examCount: number;
  filteredCount: number;
}

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "newest", label: "Newest Created" },
  { value: "oldest", label: "Oldest Created" },
  { value: "course", label: "Course (A-Z)" },
  { value: "title", label: "Title (A-Z)" },
  { value: "questions", label: "Most Questions" },
  { value: "attempts", label: "Most Practiced" },
];

export function LibraryControls({
  preferences,
  onPreferencesChange,
  availableCourses,
  availableInstitutions,
  examCount,
  filteredCount,
}: LibraryControlsProps) {
  const [filterOpen, setFilterOpen] = useState(false);

  const updatePref = (partial: Partial<LibraryPreferences>) => {
    onPreferencesChange({ ...preferences, ...partial });
  };

  const hasActiveFilters = preferences.selectedCourse || preferences.selectedInstitution;

  const clearFilters = () => {
    updatePref({ selectedCourse: null, selectedInstitution: null });
  };

  return (
    <div className="space-y-3">
      {/* Main Controls Row */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by title, course, or institution..."
            value={preferences.search}
            onChange={(e) => updatePref({ search: e.target.value })}
            className="pl-9 pr-9"
          />
          {preferences.search && (
            <button
              onClick={() => updatePref({ search: "" })}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Sort */}
        <Select
          value={preferences.sortBy}
          onValueChange={(value) => updatePref({ sortBy: value as SortOption })}
        >
          <SelectTrigger className="w-[180px]">
            <ArrowUpDown className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Filter Button */}
        <Popover open={filterOpen} onOpenChange={setFilterOpen}>
          <PopoverTrigger asChild>
            <Button
              variant={hasActiveFilters ? "default" : "outline"}
              size="icon"
              className={cn(hasActiveFilters && "bg-accent text-accent-foreground")}
            >
              <Filter className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64" align="end">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Filters</span>
                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" onClick={clearFilters} className="h-7 text-xs">
                    Clear all
                  </Button>
                )}
              </div>

              {/* Course Filter */}
              {availableCourses.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs text-muted-foreground">Course</span>
                  <div className="flex flex-wrap gap-1">
                    <Badge
                      variant={preferences.selectedCourse === null ? "default" : "outline"}
                      className="cursor-pointer text-xs"
                      onClick={() => updatePref({ selectedCourse: null })}
                    >
                      All
                    </Badge>
                    {availableCourses.map((course) => (
                      <Badge
                        key={course}
                        variant={preferences.selectedCourse === course ? "default" : "outline"}
                        className="cursor-pointer text-xs"
                        onClick={() =>
                          updatePref({
                            selectedCourse: preferences.selectedCourse === course ? null : course,
                          })
                        }
                      >
                        {course}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Institution Filter */}
              {availableInstitutions.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs text-muted-foreground">Institution</span>
                  <div className="flex flex-wrap gap-1">
                    <Badge
                      variant={preferences.selectedInstitution === null ? "default" : "outline"}
                      className="cursor-pointer text-xs"
                      onClick={() => updatePref({ selectedInstitution: null })}
                    >
                      All
                    </Badge>
                    {availableInstitutions.map((inst) => (
                      <Badge
                        key={inst}
                        variant={preferences.selectedInstitution === inst ? "default" : "outline"}
                        className="cursor-pointer text-xs"
                        onClick={() =>
                          updatePref({
                            selectedInstitution:
                              preferences.selectedInstitution === inst ? null : inst,
                          })
                        }
                      >
                        {inst}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>

        {/* Layout Toggle */}
        <div className="flex border border-border rounded-lg">
          <Button
            variant={preferences.layout === "grid" ? "secondary" : "ghost"}
            size="icon"
            className="h-9 w-9 rounded-l-lg rounded-r-none"
            onClick={() => updatePref({ layout: "grid" })}
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            variant={preferences.layout === "stacked" ? "secondary" : "ghost"}
            size="icon"
            className="h-9 w-9 rounded-r-lg rounded-l-none"
            onClick={() => updatePref({ layout: "stacked" })}
          >
            <LayoutList className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Active Filters + Count */}
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          {hasActiveFilters && (
            <div className="flex items-center gap-2">
              {preferences.selectedCourse && (
                <Badge variant="secondary" className="gap-1">
                  {preferences.selectedCourse}
                  <X
                    className="h-3 w-3 cursor-pointer"
                    onClick={() => updatePref({ selectedCourse: null })}
                  />
                </Badge>
              )}
              {preferences.selectedInstitution && (
                <Badge variant="secondary" className="gap-1">
                  {preferences.selectedInstitution}
                  <X
                    className="h-3 w-3 cursor-pointer"
                    onClick={() => updatePref({ selectedInstitution: null })}
                  />
                </Badge>
              )}
            </div>
          )}
        </div>
        <span className="text-muted-foreground">
          {preferences.search || hasActiveFilters
            ? `${filteredCount} of ${examCount} exams`
            : `${examCount} exams`}
        </span>
      </div>
    </div>
  );
}
