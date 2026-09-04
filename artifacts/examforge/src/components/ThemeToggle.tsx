import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <Button
        id="theme-toggle-skeleton"
        variant="ghost"
        size="icon"
        className="w-9 h-9 opacity-70"
        aria-label="Toggle theme"
      >
        <span className="w-4 h-4 rounded-full bg-muted-foreground/30 animate-pulse" />
      </Button>
    );
  }

  const isDark = resolvedTheme === "dark" || theme === "dark";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          id="theme-toggle-btn"
          variant="ghost"
          size="icon"
          className="w-9 h-9 text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => setTheme(isDark ? "light" : "dark")}
          aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
        >
          {isDark ? (
            <Sun className="h-4 w-4 text-accent transition-transform rotate-0 hover:rotate-45" />
          ) : (
            <Moon className="h-4 w-4 transition-transform rotate-0 hover:-rotate-12" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <p>{isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}</p>
      </TooltipContent>
    </Tooltip>
  );
}
