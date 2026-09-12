"use client";

import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import { Button, RichTextEditor } from "@/components/ui";
import { updateHomeMessageAction } from "./actions";

interface HomeMessageFormProps {
  initialMessage: string;
}

function hasVisibleText(html: string): boolean {
  return html.replace(/<[^>]*>/g, "").trim().length > 0;
}

export function HomeMessageForm({ initialMessage }: HomeMessageFormProps) {
  const [message, setMessage] = useState(initialMessage);
  const [isPending, startTransition] = useTransition();

  const handleSave = () => {
    startTransition(async () => {
      const result = await updateHomeMessageAction(message);
      if ("error" in result) {
        toast.error(result.error);
      } else {
        toast.success(hasVisibleText(message) ? "Home message saved" : "Home message cleared");
      }
    });
  };

  return (
    <div className="space-y-3">
      <RichTextEditor
        value={message}
        onChange={setMessage}
        disabled={isPending}
        placeholder="Shown to everyone on the Home page. Leave blank to hide it."
      />
      <Button onClick={handleSave} disabled={isPending} loading={isPending}>
        Save
      </Button>
    </div>
  );
}
