"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import { Button, Input, Card, CardBody, CardTitle } from "@/components/ui";
import { resetPasswordAction, validateResetToken } from "./actions";
import { CheckCircle, XCircle } from "lucide-react";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [isValidating, setIsValidating] = useState(true);
  const [isValidToken, setIsValidToken] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState(false);

  const token = searchParams.get("token") || "";

  useEffect(() => {
    const checkToken = async () => {
      if (!token) {
        setIsValidating(false);
        return;
      }
      const valid = await validateResetToken(token);
      setIsValidToken(valid);
      setIsValidating(false);
    };
    checkToken();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setErrors({});

    const formData = new FormData(e.currentTarget);
    formData.set("token", token);

    const result = await resetPasswordAction(formData);

    if (result.error) {
      if (result.fieldErrors) {
        setErrors(result.fieldErrors);
      } else {
        toast.error(result.error);
      }
      setIsLoading(false);
    } else {
      setSuccess(true);
      toast.success("Password reset successfully!");
    }
  };

  if (isValidating) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <Card className="w-full max-w-md">
          <CardBody className="text-center">
            <div className="loading loading-spinner loading-lg text-primary mb-4" />
            <p className="text-base-content/70">Validating reset link...</p>
          </CardBody>
        </Card>
      </div>
    );
  }

  if (!token || !isValidToken) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <Card className="w-full max-w-md">
          <CardBody className="text-center">
            <div className="mx-auto w-16 h-16 bg-error/10 rounded-full flex items-center justify-center mb-4">
              <XCircle className="w-8 h-8 text-error" />
            </div>
            <CardTitle className="justify-center text-2xl mb-4">
              Invalid or Expired Link
            </CardTitle>
            <p className="text-base-content/70 mb-6">
              This password reset link is invalid or has expired. Please request
              a new one.
            </p>
            <Link href="/forgot-password">
              <Button variant="primary" className="w-full">
                Request New Link
              </Button>
            </Link>
          </CardBody>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <Card className="w-full max-w-md">
          <CardBody className="text-center">
            <div className="mx-auto w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="w-8 h-8 text-success" />
            </div>
            <CardTitle className="justify-center text-2xl mb-4">
              Password Reset!
            </CardTitle>
            <p className="text-base-content/70 mb-6">
              Your password has been reset successfully. You are now logged in.
            </p>
            <Button
              variant="primary"
              className="w-full"
              onClick={() => router.push("/")}
            >
              Go to Dashboard
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
            Reset Password
          </CardTitle>
          <p className="text-center text-base-content/70 mb-6">
            Enter your new password below.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="New Password"
              name="password"
              type="password"
              placeholder="••••••••"
              error={errors.password}
              required
            />

            <Input
              label="Confirm Password"
              name="passwordConfirm"
              type="password"
              placeholder="••••••••"
              error={errors.passwordConfirm}
              required
            />

            <div className="text-xs text-base-content/60">
              Password must be at least 8 characters with a letter, number, and
              special character.
            </div>

            <Button
              type="submit"
              variant="primary"
              className="w-full"
              loading={isLoading}
            >
              Reset Password
            </Button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[70vh]">
          <Card className="w-full max-w-md">
            <CardBody className="text-center">
              <div className="loading loading-spinner loading-lg text-primary mb-4" />
              <p className="text-base-content/70">Loading...</p>
            </CardBody>
          </Card>
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
