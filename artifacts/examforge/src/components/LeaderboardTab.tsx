import { format } from "date-fns";
import { Trophy, Medal, Clock, User } from "lucide-react";
import { useGetLeaderboard } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface LeaderboardTabProps {
  examId: string;
}

function formatTime(seconds: number): string {
  if (!seconds) return "—";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

function getRankColor(rank: number): string {
  if (rank === 1) return "text-yellow-500";
  if (rank === 2) return "text-gray-400";
  if (rank === 3) return "text-amber-600";
  return "text-muted-foreground";
}

function getRankBg(rank: number): string {
  if (rank === 1) return "bg-yellow-500/10 border-yellow-500/30";
  if (rank === 2) return "bg-gray-400/10 border-gray-400/30";
  if (rank === 3) return "bg-amber-600/10 border-amber-600/30";
  return "bg-secondary/50 border-border/60";
}

export function LeaderboardTab({ examId }: LeaderboardTabProps) {
  const { data: entries, isLoading } = useGetLeaderboard(examId, { limit: 20 });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array(5)
          .fill(0)
          .map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
      </div>
    );
  }

  if (!entries || entries.length === 0) {
    return (
      <div className="text-center py-12">
        <Trophy className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
        <h3 className="text-lg font-medium mb-2">No leaderboard entries yet</h3>
        <p className="text-muted-foreground text-sm">
          Take a quiz to set the first high score!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {entries.map((entry, index) => {
        const rank = index + 1;
        const isTop3 = rank <= 3;

        return (
          <Card
            key={entry.id}
            className={`transition-all hover:shadow-md ${getRankBg(rank)}`}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                {/* Rank */}
                <div className={`flex-none w-10 text-center ${getRankColor(rank)}`}>
                  {isTop3 ? (
                    <Medal className="w-6 h-6 mx-auto" />
                  ) : (
                    <span className="text-lg font-bold">#{rank}</span>
                  )}
                </div>

                {/* User Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium truncate">{entry.userName}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatTime(entry.elapsedSeconds)}
                    </span>
                    <span>
                      {format(new Date(entry.completedAt), "MMM d, yyyy")}
                    </span>
                  </div>
                </div>

                {/* Score */}
                <div className="flex-none text-right">
                  <div className={`text-xl font-bold ${getRankColor(rank)}`}>
                    {Math.round(entry.scorePct)}%
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {entry.score}/{entry.total}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
