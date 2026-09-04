import { useState, useEffect, useCallback } from "react";

const USERNAME_KEY = "examforge_username";
const LEGACY_USERNAME_KEY = "examforge_user_name";
const EVENT_NAME = "examforge-username-change";

export function getStoredUsername(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(USERNAME_KEY) || localStorage.getItem(LEGACY_USERNAME_KEY) || "";
}

export function saveUsername(name: string): void {
  const trimmed = name.trim();
  if (typeof window !== "undefined") {
    if (trimmed) {
      localStorage.setItem(USERNAME_KEY, trimmed);
      localStorage.setItem(LEGACY_USERNAME_KEY, trimmed);
    } else {
      localStorage.removeItem(USERNAME_KEY);
      localStorage.removeItem(LEGACY_USERNAME_KEY);
    }
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: trimmed }));
  }
}

export function useUserIdentity() {
  const [username, setUsernameState] = useState<string>(getStoredUsername);

  useEffect(() => {
    const handleUpdate = () => {
      setUsernameState(getStoredUsername());
    };

    window.addEventListener(EVENT_NAME, handleUpdate);
    window.addEventListener("storage", handleUpdate);
    return () => {
      window.removeEventListener(EVENT_NAME, handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, []);

  const updateUsername = useCallback((name: string) => {
    saveUsername(name);
    setUsernameState(name.trim());
  }, []);

  return {
    username,
    isIdentified: Boolean(username),
    setUsername: updateUsername,
  };
}
