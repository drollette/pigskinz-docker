"use client";

import { useState, useTransition } from "react";
import { useTheme, type ThemePreference } from "@/components/theme-provider";
import { updateThemeAction } from "./actions";
import toast from "react-hot-toast";

const themeOptions: { value: ThemePreference; label: string; description: string }[] = [
  {
    value: "light",
    label: "Light",
    description: "Always use light theme",
  },
  {
    value: "dark",
    label: "Dark",
    description: "Always use dark theme",
  },
  {
    value: "system",
    label: "System",
    description: "Follow your device settings",
  },
];

interface ThemeFormProps {
  initialTheme?: ThemePreference;
}

export function ThemeForm({ initialTheme = "system" }: ThemeFormProps) {
  const { theme, setTheme } = useTheme();
  const [isPending, startTransition] = useTransition();
  const [selectedTheme, setSelectedTheme] = useState<ThemePreference>(
    initialTheme
  );

  const handleThemeChange = (newTheme: ThemePreference) => {
    setSelectedTheme(newTheme);
    setTheme(newTheme); // Apply immediately for instant feedback

    // Save to server
    startTransition(async () => {
      const result = await updateThemeAction(newTheme);
      if ("error" in result) {
        toast.error(result.error);
        // Revert on error
        setSelectedTheme(theme);
        setTheme(theme);
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3">
        {themeOptions.map((option) => (
          <label
            key={option.value}
            className={`flex items-center gap-4 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
              selectedTheme === option.value
                ? "border-primary bg-primary/5"
                : "border-base-300 hover:border-base-content/30"
            }`}
          >
            <input
              type="radio"
              name="theme"
              value={option.value}
              checked={selectedTheme === option.value}
              onChange={() => handleThemeChange(option.value)}
              className="radio radio-primary"
              disabled={isPending}
            />
            <div className="flex-1">
              <div className="font-medium">{option.label}</div>
              <div className="text-sm text-base-content/60">
                {option.description}
              </div>
            </div>
            {option.value === "light" && (
              <svg
                className="w-5 h-5 text-base-content/60"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                />
              </svg>
            )}
            {option.value === "dark" && (
              <svg
                className="w-5 h-5 text-base-content/60"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                />
              </svg>
            )}
            {option.value === "system" && (
              <svg
                className="w-5 h-5 text-base-content/60"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
            )}
          </label>
        ))}
      </div>
      {isPending && (
        <p className="text-sm text-base-content/60">Saving preference...</p>
      )}
    </div>
  );
}
