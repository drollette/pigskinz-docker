"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Button, Input, VerificationCodeInput } from "@/components/ui";
import {
  updateEmailAction,
  verifyEmailChangeAction,
  cancelEmailChangeAction,
  resendEmailChangeCodeAction,
} from "./actions";
import type { User } from "@/db/schema";

interface EmailFormProps {
  user: User;
}

export function EmailForm({ user }: EmailFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const result = await updateEmailAction(formData);

    if ("error" in result) {
      toast.error(result.error);
      setIsLoading(false);
    } else {
      toast.success("Verification code sent to your new email!");
      setPendingEmail(result.newEmail);
      setCode(["", "", "", "", "", ""]);
      setIsLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    const fullCode = code.join("");
    if (fullCode.length !== 6) {
      setError("Please enter all 6 digits");
      setIsLoading(false);
      return;
    }

    const formData = new FormData();
    formData.set("code", fullCode);

    const result = await verifyEmailChangeAction(formData);

    if ("error" in result) {
      setError(result.error);
      setIsLoading(false);
    } else {
      toast.success("Email updated successfully!");
      setPendingEmail(null);
      setCode(["", "", "", "", "", ""]);
      router.refresh();
      setIsLoading(false);
    }
  };

  const handleCancel = async () => {
    setIsLoading(true);
    await cancelEmailChangeAction();
    setPendingEmail(null);
    setCode(["", "", "", "", "", ""]);
    setError("");
    setIsLoading(false);
  };

  const handleResend = async () => {
    setIsResending(true);
    setError("");

    const result = await resendEmailChangeCodeAction();

    if ("error" in result) {
      toast.error(result.error);
    } else {
      toast.success("Verification code resent!");
      setCode(["", "", "", "", "", ""]);
    }
    setIsResending(false);
  };

  if (pendingEmail) {
    return (
      <div className="space-y-4">
        <div className="bg-info/10 border border-info/20 rounded-lg p-4">
          <p className="text-sm text-info-content">
            We sent a verification code to{" "}
            <strong className="text-base-content">{pendingEmail}</strong>
          </p>
        </div>

        <form onSubmit={handleVerify} className="space-y-4">
          <div>
            <label className="label">Verification Code</label>
            <VerificationCodeInput
              value={code}
              onChange={setCode}
              autoFocus
              size="sm"
            />
            {error && <p className="text-error text-sm mt-2">{error}</p>}
          </div>

          <div className="flex gap-2">
            <Button type="submit" variant="primary" loading={isLoading}>
              Verify
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={handleCancel}
              disabled={isLoading}
            >
              Cancel
            </Button>
          </div>
        </form>

        <div className="text-sm text-base-content/70">
          Didn&apos;t receive the code?{" "}
          <button
            type="button"
            onClick={handleResend}
            disabled={isResending}
            className="link link-primary"
          >
            {isResending ? "Sending..." : "Resend"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        key={user.email}
        label="Email"
        name="email"
        type="email"
        defaultValue={user.email}
        required
      />

      <Button type="submit" variant="primary" loading={isLoading}>
        Update Email
      </Button>
    </form>
  );
}
