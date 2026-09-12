"use client";

import { useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { Button, Input, Card, CardBody, CardTitle } from "@/components/ui";
import { forgotPasswordAction } from "./actions";
import { Mail } from "lucide-react";

export default function ForgotPasswordPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [emailSent, setEmailSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setErrors({});

    const formData = new FormData(e.currentTarget);
    const result = await forgotPasswordAction(formData);

    if ("error" in result) {
      setErrors(result.fieldErrors);
      toast.error(result.error);
      setIsLoading(false);
    } else {
      setEmailSent(true);
      setIsLoading(false);
    }
  };

  if (emailSent) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <Card className="w-full max-w-md">
          <CardBody className="text-center">
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <Mail className="w-8 h-8 text-primary" />
            </div>
            <CardTitle className="justify-center text-2xl mb-4">
              Check Your Email
            </CardTitle>
            <p className="text-base-content/70 mb-6">
              If an account exists with that email address, we&apos;ve sent
              instructions on how to reset your password.
            </p>
            <p className="text-base-content/50 text-sm mb-6">
              The link will expire in 1 hour.
            </p>
            <Link href="/login">
              <Button variant="primary" className="w-full">
                Back to Login
              </Button>
            </Link>
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
            Forgot Password
          </CardTitle>
          <p className="text-center text-base-content/70 mb-6">
            Enter your email address and we&apos;ll send you a link to reset
            your password.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Email"
              name="email"
              type="email"
              placeholder="you@example.com"
              error={errors.email}
              required
            />

            <Button
              type="submit"
              variant="primary"
              className="w-full"
              loading={isLoading}
            >
              Send Reset Link
            </Button>
          </form>

          <div className="divider">OR</div>

          <p className="text-center text-base-content/70">
            Remember your password?{" "}
            <Link href="/login" className="link link-primary">
              Login
            </Link>
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
