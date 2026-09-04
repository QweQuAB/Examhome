import { useState, useEffect, useRef, useCallback } from "react";
import { Pause, Play, Settings2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface TimerBarProps {
  timeLimitMinutes: number | null;
  elapsedSeconds: number;
  isRunning: boolean;
  onTick: (elapsedSeconds: number) => void;
  onExpire: () => void;
  onAdjust: (newTimeLimitMinutes: number | null) => void;
}

const PRESETS = [
  { label: "Untimed", value: null },
  { label: "5m", value: 5 },
  { label: "10m", value: 10 },
  { label: "15m", value: 15 },
  { label: "25m", value: 25 },
  { label: "30m", value: 30 },
  { label: "60m", value: 60 },
];

export function TimerBar({
  timeLimitMinutes,
  elapsedSeconds: initialElapsed,
  isRunning: initialRunning,
  onTick,
  onExpire,
  onAdjust,
}: TimerBarProps) {
  const [elapsed, setElapsed] = useState(initialElapsed);
  const [isPaused, setIsPaused] = useState(!initialRunning);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [customMinutes, setCustomMinutes] = useState("");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onTickRef = useRef(onTick);
  const onExpireRef = useRef(onExpire);

  onTickRef.current = onTick;
  onExpireRef.current = onExpire;

  const totalSeconds = timeLimitMinutes ? timeLimitMinutes * 60 : null;
  const remaining = totalSeconds !== null ? totalSeconds - elapsed : null;
  const progressPct = totalSeconds !== null ? ((totalSeconds - (remaining ?? 0)) / totalSeconds) * 100 : 0;

  const urgencyClass =
    remaining !== null
      ? remaining <= 120
        ? "text-destructive animate-pulse"
        : remaining <= 300
          ? "text-yellow-500"
          : "text-success"
      : "text-muted-foreground";

  const progressColor =
    remaining !== null
      ? remaining <= 120
        ? "bg-destructive"
        : remaining <= 300
          ? "bg-yellow-500"
          : "bg-success"
      : "bg-primary";

  useEffect(() => {
    if (isPaused) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    intervalRef.current = setInterval(() => {
      setElapsed((prev) => {
        const next = prev + 1;
        onTickRef.current(next);
        if (totalSeconds !== null && next >= totalSeconds) {
          onExpireRef.current();
        }
        return next;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPaused, totalSeconds]);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const handlePreset = (minutes: number | null) => {
    onAdjust(minutes);
    setAdjustOpen(false);
  };

  const handleCustomAdjust = (delta: number) => {
    if (timeLimitMinutes === null) return;
    const newMin = Math.max(1, Math.min(300, timeLimitMinutes + delta));
    onAdjust(newMin);
    setAdjustOpen(false);
  };

  const handleCustomSet = () => {
    const val = parseInt(customMinutes, 10);
    if (!isNaN(val) && val >= 1 && val <= 300) {
      onAdjust(val);
      setCustomMinutes("");
      setAdjustOpen(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      {remaining !== null ? (
        <Badge
          className={`font-mono text-sm font-bold px-3 py-1.5 rounded-full ${urgencyClass} bg-secondary border-border/40`}
        >
          <Clock className="w-3.5 h-3.5 mr-1.5" />
          {formatTime(remaining)}
        </Badge>
      ) : (
        <Badge className="font-mono text-sm font-medium px-3 py-1.5 rounded-full text-muted-foreground bg-secondary border-border/40">
          <Clock className="w-3.5 h-3.5 mr-1.5" />
          {formatTime(elapsed)}
        </Badge>
      )}

      {totalSeconds !== null && (
        <div className="flex-1 min-w-[80px]">
          <Progress value={progressPct} className={`h-2 bg-secondary`}>
            <div className={`h-full ${progressColor} transition-colors duration-1000 rounded-full`} />
          </Progress>
        </div>
      )}

      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsPaused(!isPaused)}
        className="h-8 w-8 p-0"
      >
        {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
      </Button>

      <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <Settings2 className="w-4 h-4" />
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Adjust Timer</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">Quick Presets</p>
              <div className="flex flex-wrap gap-2">
                {PRESETS.map((p) => (
                  <Button
                    key={p.label}
                    variant={timeLimitMinutes === p.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => handlePreset(p.value)}
                    className="text-xs"
                  >
                    {p.label}
                  </Button>
                ))}
              </div>
            </div>

            {timeLimitMinutes !== null && (
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Adjust by Steps</p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleCustomAdjust(-5)}>-5m</Button>
                  <Button variant="outline" size="sm" onClick={() => handleCustomAdjust(-1)}>-1m</Button>
                  <Button variant="outline" size="sm" onClick={() => handleCustomAdjust(1)}>+1m</Button>
                  <Button variant="outline" size="sm" onClick={() => handleCustomAdjust(5)}>+5m</Button>
                  <Button variant="outline" size="sm" onClick={() => handleCustomAdjust(10)}>+10m</Button>
                  <Button variant="outline" size="sm" onClick={() => handleCustomAdjust(15)}>+15m</Button>
                </div>
              </div>
            )}

            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">Set Custom Limit</p>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min={1}
                  max={300}
                  placeholder="Minutes (1-300)"
                  value={customMinutes}
                  onChange={(e) => setCustomMinutes(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCustomSet()}
                />
                <Button onClick={handleCustomSet} size="sm">Set</Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
