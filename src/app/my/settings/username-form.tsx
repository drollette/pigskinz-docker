"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Button, Input } from "@/components/ui";
import { updateUsernameAction } from "./actions";
import type { User } from "@/db/schema";

interface UsernameFormProps {
  user: User;
}

export function UsernameForm({ user }: UsernameFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const result = await updateUsernameAction(formData);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Username updated!");
      router.refresh();
    }

    setIsLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="Username"
        name="username"
        type="text"
        defaultValue={user.username ?? ""}
        placeholder="Choose a username"
        required
      />
      <p className="text-xs text-base-content/60">
        Username must be 3-15 characters. Spaces and special characters are allowed, but not at the beginning or end.
      </p>

      <Button type="submit" variant="primary" loading={isLoading}>
        Update Username
      </Button>
    </form>
  );
}
