import { useState, useEffect } from "react";
import { User, Check, Sparkles, Trophy, BookOpen } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useUserIdentity } from "@/lib/user-identity";
import { toast } from "sonner";

interface UserIdentityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UserIdentityDialog({ open, onOpenChange }: UserIdentityDialogProps) {
  const { username, setUsername } = useUserIdentity();
  const [inputValue, setInputValue] = useState(username);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setInputValue(username);
      setError(null);
    }
  }, [open, username]);

  const handleSave = () => {
    const trimmed = inputValue.trim();
    if (!trimmed) {
      setError("Please enter a username or nickname.");
      return;
    }
    if (trimmed.length < 2) {
      setError("Username must be at least 2 characters.");
      return;
    }
    if (trimmed.length > 30) {
      setError("Username must be 30 characters or fewer.");
      return;
    }

    setUsername(trimmed);
    toast.success(`Welcome, ${trimmed}! Your profile has been updated.`);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent id="user-identity-modal" className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1 text-accent">
            <User className="w-5 h-5" />
            <span className="text-xs uppercase tracking-wider font-bold">Platform Identity</span>
          </div>
          <DialogTitle className="text-xl font-serif">Your Nickname & Identification</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
            Create a unique nickname so you can recognize your own questions, track your contributions in the community repository, and see your score on leaderboards.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-3">
          <div className="space-y-2">
            <Label htmlFor="user-nickname-input" className="text-sm font-medium">
              Nickname / Display Name
            </Label>
            <div className="relative">
              <Input
                id="user-nickname-input"
                placeholder="e.g. AlexK, ScholarDev, BioNerd"
                value={inputValue}
                onChange={(e) => {
                  setInputValue(e.target.value);
                  if (error) setError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleSave();
                  }
                }}
                maxLength={30}
                className={error ? "border-destructive focus-visible:ring-destructive" : ""}
                autoFocus
              />
              {inputValue.trim() && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <Badge variant="secondary" className="text-xs font-mono">
                    {inputValue.trim().slice(0, 2).toUpperCase()}
                  </Badge>
                </div>
              )}
            </div>
            {error ? (
              <p className="text-xs text-destructive mt-1">{error}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                No password required. This identifies your submissions and quiz scores.
              </p>
            )}
          </div>

          <div className="bg-secondary/40 rounded-lg p-3.5 space-y-2 border border-border/60 text-xs">
            <div className="flex items-center gap-2 text-foreground font-medium">
              <Sparkles className="w-4 h-4 text-accent" />
              <span>How your nickname is used:</span>
            </div>
            <ul className="space-y-1.5 text-muted-foreground list-disc list-inside">
              <li>
                <strong className="text-foreground font-medium">Identify your questions:</strong> Quickly locate packages & questions you posted in the Community.
              </li>
              <li>
                <strong className="text-foreground font-medium">Quiz Leaderboards:</strong> Your scores and attempts will display under this handle.
              </li>
              <li>
                <strong className="text-foreground font-medium">Comments & Discussions:</strong> Post feedback and ratings under your name.
              </li>
            </ul>
          </div>
        </div>

        <DialogFooter className="flex sm:justify-between items-center gap-2 pt-2">
          {username && (
            <Button
              id="clear-nickname-btn"
              type="button"
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground hover:text-destructive"
              onClick={() => {
                setUsername("");
                setInputValue("");
                toast.info("Nickname removed.");
                onOpenChange(false);
              }}
            >
              Clear Nickname
            </Button>
          )}
          <div className="flex gap-2 w-full sm:w-auto sm:ml-auto">
            <Button
              id="cancel-nickname-btn"
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              id="save-nickname-btn"
              type="button"
              onClick={handleSave}
              className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              <Check className="w-4 h-4" /> Save Nickname
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
