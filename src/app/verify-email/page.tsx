"use client";

import { useState, Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import {
  Button,
  Card,
  CardBody,
  CardTitle,
  VerificationCodeInput,
} from "@/components/ui";
import { verifyEmailAction } from "./actions";
import { resendVerificationCodeAction } from "../register/actions";
import { EMAIL_FROM_ADDRESS } from "@/lib/site-config";

function VerifyEmailForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState("");
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [autoFocus, setAutoFocus] = useState(false);

  const email = searchParams.get("email") || "";
  const redirectUrl = searchParams.get("redirect") || "/";

  useEffect(() => {
    setAutoFocus(true);
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
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
    formData.set("email", email);
    formData.set("code", fullCode);

    const result = await verifyEmailAction(formData);

    if (result.error) {
      setError(result.error);
      setIsLoading(false);
    } else {
      toast.success("Email verified successfully!");
      router.push(redirectUrl);
      router.refresh();
    }
  };

  const handleResend = async () => {
    setIsResending(true);
    setError("");

    const result = await resendVerificationCodeAction(email);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Verification code sent!");
      setCode(["", "", "", "", "", ""]);
    }
    setIsResending(false);
  };

  if (!email) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <Card className="w-full max-w-md">
          <CardBody>
            <CardTitle className="justify-center text-2xl mb-6">
              Invalid Request
            </CardTitle>
            <p className="text-center text-base-content/70">
              No email address provided. Please start the registration process
              again.
            </p>
            <Button
              variant="primary"
              className="w-full mt-4"
              onClick={() => router.push("/register")}
            >
              Go to Registration
            </Button>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-[70vh]">
      <Card className="w-full max-w-md">
        <CardBody>
          <CardTitle className="justify-center text-2xl mb-2">
            Verify Your Email
          </CardTitle>

          <p className="text-center text-base-content/70 mb-2">
            We sent a 6-digit code to{" "}
            <span className="font-medium text-base-content">{email}</span>
          </p>

          <p className="text-center text-base-content/60 text-sm mb-6">
            Don&apos;t see it? Check your spam/junk folder, and add{" "}
            <span className="font-medium">{EMAIL_FROM_ADDRESS}</span> to your
            safe senders list so future emails land in your inbox.
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex justify-center">
              <VerificationCodeInput
                value={code}
                onChange={setCode}
                autoFocus={autoFocus}
                size="lg"
              />
            </div>

            {error && (
              <p className="text-center text-error text-sm">{error}</p>
            )}

            <Button
              type="submit"
              variant="primary"
              className="w-full"
              loading={isLoading}
            >
              Verify Email
            </Button>
          </form>

          <div className="divider">OR</div>

          <div className="text-center">
            <p className="text-base-content/70 mb-2">
              Didn&apos;t receive the code?
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResend}
              loading={isResending}
            >
              Resend Code
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[70vh]">
          <Card className="w-full max-w-md">
            <CardBody>
              <div className="h-8 w-48 bg-base-200 rounded animate-pulse mx-auto mb-6" />
              <div className="space-y-4">
                <div className="h-14 bg-base-200 rounded animate-pulse" />
                <div className="h-12 bg-base-200 rounded animate-pulse" />
              </div>
            </CardBody>
          </Card>
        </div>
      }
    >
      <VerifyEmailForm />
    </Suspense>
  );
}
