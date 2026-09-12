"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Button, Input } from "@/components/ui";
import { AvatarUpload } from "./avatar-upload";
import { updateProfileAction } from "./actions";
import type { User } from "@/db/schema";

interface ProfileFormProps {
  user: User;
}

export function ProfileForm({ user }: ProfileFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    const result = await updateProfileAction(formData);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Profile updated!");
      router.refresh();
    }

    setIsLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Profile header with avatar and user info */}
      <div className="flex flex-col items-center justify-center gap-3 mb-6">
        <AvatarUpload user={user} />
        <div className="flex flex-col items-center text-center">
          <p className="text-xl font-semibold">{user.name}</p>
          <p className="text-sm text-base-content/70">{user.email}</p>
        </div>
      </div>

      <div className="divider" />

      <Input
        label="Name"
        name="name"
        type="text"
        defaultValue={user.name}
        required
      />

      <Button type="submit" variant="primary" loading={isLoading}>
        Update Profile
      </Button>
    </form>
  );
}
