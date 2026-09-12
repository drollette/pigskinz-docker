"use client";

import { useState, useRef, useEffect } from "react";

interface VerificationCodeInputProps {
  value: string[];
  onChange: (code: string[]) => void;
  autoFocus?: boolean;
  size?: "sm" | "lg";
}

export function VerificationCodeInput({
  value,
  onChange,
  autoFocus = false,
  size = "lg",
}: VerificationCodeInputProps) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (autoFocus) {
      inputRefs.current[0]?.focus();
    }
  }, [autoFocus]);

  const handleInputChange = (index: number, inputValue: string) => {
    // Handle paste that comes through as onChange (some browsers)
    if (inputValue.length > 1) {
      const digits = inputValue.replace(/\D/g, "");
      if (digits.length >= 1) {
        const newCode = [...value];
        for (let i = 0; i < digits.length && index + i < 6; i++) {
          newCode[index + i] = digits[i];
        }
        onChange(newCode);
        const nextIndex = Math.min(index + digits.length, 5);
        inputRefs.current[nextIndex]?.focus();
        return;
      }
    }

    // Only allow single digit
    if (inputValue && !/^\d$/.test(inputValue)) return;

    const newCode = [...value];
    newCode[index] = inputValue;
    onChange(newCode);

    // Auto-focus next input
    if (inputValue && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key === "Backspace" && !value[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").replace(/\D/g, "");
    if (pastedData.length > 0) {
      const newCode = [...value];
      for (let i = 0; i < pastedData.length && i < 6; i++) {
        newCode[i] = pastedData[i];
      }
      onChange(newCode);
      const focusIndex = Math.min(pastedData.length, 5);
      inputRefs.current[focusIndex]?.focus();
    }
  };

  const sizeClasses =
    size === "lg"
      ? "w-12 h-14 text-2xl"
      : "w-10 h-12 text-xl";

  return (
    <div className="flex gap-2">
      {value.map((digit, index) => (
        <input
          key={index}
          ref={(el) => {
            inputRefs.current[index] = el;
          }}
          type="text"
          inputMode="numeric"
          value={digit}
          onChange={(e) => handleInputChange(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onPaste={handlePaste}
          className={`${sizeClasses} text-center font-bold border border-base-300 rounded-lg focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 bg-base-100`}
        />
      ))}
    </div>
  );
}
