"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui";
import { sendPasswordResetLinkAction } from "./actions";
import { Mail } from "lucide-react";

export function PasswordForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const handleSendResetLink = async () => {
    setIsLoading(true);

    const result = await sendPasswordResetLinkAction();

    if ("error" in result) {
      toast.error(result.error);
    } else {
      toast.success("Password reset link sent to your email!");
      setEmailSent(true);
    }

    setIsLoading(false);
  };

  if (emailSent) {
    return (
      <div className="space-y-4">
        <div className="bg-success/10 border border-success/20 rounded-lg p-4 flex items-start gap-3">
          <Mail className="w-5 h-5 text-success mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-base-content">
              Reset link sent!
            </p>
            <p className="text-sm text-base-content/70 mt-1">
              Check your email for a link to reset your password. The link will
              expire in 1 hour.
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setEmailSent(false)}
        >
          Send another link
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-base-content/70">
        To change your password, we&apos;ll send a secure reset link to your
        email address.
      </p>
      <Button
        variant="primary"
        onClick={handleSendResetLink}
        loading={isLoading}
      >
        Send Password Reset Link
      </Button>
    </div>
  );
}
