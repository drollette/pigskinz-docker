"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import { Button, Input, Card, CardBody, CardTitle } from "@/components/ui";
import { loginAction } from "./actions";
import { POOL_NAME } from "@/lib/site-config";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Get redirect URL from query params
  const redirectUrl = searchParams.get("redirect") || "/";

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setErrors({});

    const formData = new FormData(e.currentTarget);
    const result = await loginAction(formData);

    if (result.error) {
      if ("requiresVerification" in result && result.requiresVerification) {
        toast.error("Please verify your email to continue");
        const verifyUrl = redirectUrl !== "/"
          ? `/verify-email?email=${encodeURIComponent(result.email || "")}&redirect=${encodeURIComponent(redirectUrl)}`
          : `/verify-email?email=${encodeURIComponent(result.email || "")}`;
        router.push(verifyUrl);
      } else if (result.fieldErrors) {
        setErrors(result.fieldErrors);
        setIsLoading(false);
      } else {
        toast.error(result.error);
        setIsLoading(false);
      }
    } else {
      toast.success("Welcome back!");
      router.push(redirectUrl);
      router.refresh();
    }
  };

  // Build register link with redirect param
  const registerUrl = redirectUrl !== "/"
    ? `/register?redirect=${encodeURIComponent(redirectUrl)}`
    : "/register";

  return (
    <div className="flex items-center justify-center min-h-[70vh]">
      <Card className="w-full max-w-md">
        <CardBody>
          <CardTitle className="justify-center text-2xl mb-6">
            Login to {POOL_NAME}
          </CardTitle>

          <form onSubmit={handleSubmit} className="space-y-4">
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

            <div className="text-right">
              <Link
                href="/forgot-password"
                className="text-sm link link-primary"
              >
                Forgot password?
              </Link>
            </div>

            <Button
              type="submit"
              variant="primary"
              className="w-full"
              loading={isLoading}
            >
              Login
            </Button>
          </form>

          <div className="divider">OR</div>

          <p className="text-center text-base-content/70">
            Don&apos;t have an account?{" "}
            <Link href={registerUrl} className="link link-primary">
              Register
            </Link>
          </p>
        </CardBody>
      </Card>
    </div>
  );
}

export default function LoginPage() {
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
            </div>
          </CardBody>
        </Card>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
