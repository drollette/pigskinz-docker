"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import { Button, Input, Card, CardBody, CardTitle } from "@/components/ui";
import { registerAction } from "./actions";

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Get redirect URL from query params
  const redirectUrl = searchParams.get("redirect") || "";

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setErrors({});

    const formData = new FormData(e.currentTarget);
    const result = await registerAction(formData);

    if (result.error) {
      if (result.fieldErrors) {
        setErrors(result.fieldErrors);
      } else {
        toast.error(result.error);
      }
      setIsLoading(false);
    } else if (result.success && result.email) {
      toast.success("Account created! Please verify your email.");
      // Redirect to verification page with email
      const verifyUrl = redirectUrl
        ? `/verify-email?email=${encodeURIComponent(result.email)}&redirect=${encodeURIComponent(redirectUrl)}`
        : `/verify-email?email=${encodeURIComponent(result.email)}`;
      router.push(verifyUrl);
    }
  };

  // Build login link with redirect param
  const loginUrl = redirectUrl
    ? `/login?redirect=${encodeURIComponent(redirectUrl)}`
    : "/login";

  return (
    <div className="flex items-center justify-center min-h-[70vh]">
      <Card className="w-full max-w-md">
        <CardBody>
          <CardTitle className="justify-center text-2xl mb-6">
            Create Account
          </CardTitle>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Name"
              name="name"
              type="text"
              placeholder="John Doe"
              error={errors.name}
              required
            />

            <Input
              label="Username"
              name="username"
              type="text"
              placeholder="johndoe"
              error={errors.username}
              minLength={3}
              maxLength={15}
              required
            />

            <Input
              label="Email"
              name="email"
              type="email"
              placeholder="you@example.com"
              error={errors.email}
              required
            />

            <Input
              label="Password"
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

            <Input
              label="Invitation Code"
              name="invitationCode"
              type="text"
              placeholder="Ask whoever invited you"
              error={errors.invitationCode}
              required
            />

            <Button
              type="submit"
              variant="primary"
              className="w-full"
              loading={isLoading}
            >
              Create Account
            </Button>
          </form>

          <div className="divider">OR</div>

          <p className="text-center text-base-content/70">
            Already have an account?{" "}
            <Link href={loginUrl} className="link link-primary">
              Login
            </Link>
          </p>
        </CardBody>
      </Card>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[70vh]">
        <Card className="w-full max-w-md">
          <CardBody>
            <div className="h-8 w-48 bg-base-200 rounded animate-pulse mx-auto mb-6" />
            <div className="space-y-4">
              <div className="h-12 bg-base-200 rounded animate-pulse" />
              <div className="h-12 bg-base-200 rounded animate-pulse" />
              <div className="h-12 bg-base-200 rounded animate-pulse" />
              <div className="h-12 bg-base-200 rounded animate-pulse" />
              <div className="h-12 bg-base-200 rounded animate-pulse" />
              <div className="h-12 bg-base-200 rounded animate-pulse" />
            </div>
          </CardBody>
        </Card>
      </div>
    }>
      <RegisterForm />
    </Suspense>
  );
}
