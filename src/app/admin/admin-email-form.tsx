"use client";

import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import { Button, RichTextEditor } from "@/components/ui";
import { sendAdminEmailAction } from "./actions";
import type { BroadcastRecipientMode } from "@/lib/admin-broadcast";
import { MergeVariableLegend } from "./merge-variable-legend";

interface UserOption {
  id: string;
  name: string;
  email: string;
  hasPaid: boolean | null;
}

export interface EmailTemplateOption {
  id: string;
  name: string;
  subject: string;
  bodyHtml: string;
}

interface AdminEmailFormProps {
  users: UserOption[];
  templates: EmailTemplateOption[];
  // Controlled from the parent so the "Missing Picks" panel can jump
  // straight into "selected" mode with its own list of recipients
  // pre-checked, without this form owning that state itself.
  recipientMode: BroadcastRecipientMode;
  onRecipientModeChange: (mode: BroadcastRecipientMode) => void;
  selectedIds: Set<string>;
  onSelectedIdsChange: (ids: Set<string>) => void;
}

export function AdminEmailForm({
  users,
  templates,
  recipientMode,
  onRecipientModeChange,
  selectedIds,
  onSelectedIdsChange,
}: AdminEmailFormProps) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [isPending, startTransition] = useTransition();

  const toggleUser = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    onSelectedIdsChange(next);
  };

  const handleTemplateChange = (id: string) => {
    setTemplateId(id);
    if (!id) return;
    const template = templates.find((t) => t.id === id);
    if (!template) return;
    setSubject(template.subject);
    setBody(template.bodyHtml);
  };

  const unpaidUsers = users.filter((u) => !u.hasPaid);

  const recipientCount =
    recipientMode === "all"
      ? users.length
      : recipientMode === "unpaid"
        ? unpaidUsers.length
        : selectedIds.size;
  const hasBody = body.replace(/<[^>]*>/g, "").trim().length > 0;
  const canSend = subject.trim().length > 0 && hasBody && recipientCount > 0 && !isPending;

  const handleSend = () => {
    if (!canSend) return;

    const confirmMessage =
      recipientMode === "all"
        ? `Send this email to all ${users.length} user${users.length === 1 ? "" : "s"}?`
        : recipientMode === "unpaid"
          ? `Send this email to ${unpaidUsers.length} unpaid player${unpaidUsers.length === 1 ? "" : "s"}?`
          : `Send this email to ${selectedIds.size} selected user${selectedIds.size === 1 ? "" : "s"}?`;
    if (!confirm(confirmMessage)) return;

    startTransition(async () => {
      const result = await sendAdminEmailAction(subject, body, recipientMode, Array.from(selectedIds));
      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      const failureNote = result.failed > 0 ? ` (${result.failed} failed)` : "";
      toast.success(
        `Sent to ${result.sent} of ${result.total} recipient${result.total === 1 ? "" : "s"}${failureNote}`
      );
      setSubject("");
      setBody("");
      setTemplateId("");
      onSelectedIdsChange(new Set());
    });
  };

  return (
    <div className="space-y-4">
      {templates.length > 0 && (
        <div>
          <label className="label">Load template</label>
          <select
            className="select w-full"
            value={templateId}
            onChange={(e) => handleTemplateChange(e.target.value)}
            disabled={isPending}
          >
            <option value="">Start from scratch</option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="label">Subject</label>
        <input
          type="text"
          className="input w-full"
          placeholder="Subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          disabled={isPending}
        />
      </div>

      <div>
        <label className="label">Message</label>
        <RichTextEditor
          value={body}
          onChange={setBody}
          disabled={isPending}
          placeholder="Write your message..."
        />
        <MergeVariableLegend />
      </div>

      <div>
        <label className="label">Recipients</label>
        <div className="flex gap-2 mb-3">
          <Button
            type="button"
            variant={recipientMode === "all" ? "primary" : "outline"}
            size="sm"
            onClick={() => onRecipientModeChange("all")}
            disabled={isPending}
          >
            All users ({users.length})
          </Button>
          <Button
            type="button"
            variant={recipientMode === "unpaid" ? "primary" : "outline"}
            size="sm"
            onClick={() => onRecipientModeChange("unpaid")}
            disabled={isPending}
          >
            Unpaid players ({unpaidUsers.length})
          </Button>
          <Button
            type="button"
            variant={recipientMode === "selected" ? "primary" : "outline"}
            size="sm"
            onClick={() => onRecipientModeChange("selected")}
            disabled={isPending}
          >
            Choose recipients {selectedIds.size > 0 ? `(${selectedIds.size})` : ""}
          </Button>
        </div>

        {recipientMode === "unpaid" && (
          <div className="max-h-64 overflow-y-auto border border-base-300 rounded-lg divide-y divide-base-300">
            {unpaidUsers.length === 0 && (
              <div className="p-3 text-sm text-base-content/60">Everyone has paid.</div>
            )}
            {unpaidUsers.map((user) => (
              <div key={user.id} className="p-2 text-sm">
                <div className="font-medium">{user.name}</div>
                <div className="text-base-content/60">{user.email}</div>
              </div>
            ))}
          </div>
        )}

        {recipientMode === "selected" && (
          <div className="max-h-64 overflow-y-auto border border-base-300 rounded-lg divide-y divide-base-300">
            {users.length === 0 && (
              <div className="p-3 text-sm text-base-content/60">No users to select.</div>
            )}
            {users.map((user) => (
              <label
                key={user.id}
                className="flex items-center gap-3 p-2 cursor-pointer hover:bg-base-200"
              >
                <input
                  type="checkbox"
                  className="checkbox checkbox-sm"
                  checked={selectedIds.has(user.id)}
                  onChange={() => toggleUser(user.id)}
                  disabled={isPending}
                />
                <div className="text-sm">
                  <div className="font-medium">{user.name}</div>
                  <div className="text-base-content/60">{user.email}</div>
                </div>
              </label>
            ))}
          </div>
        )}
      </div>

      <Button onClick={handleSend} disabled={!canSend} loading={isPending}>
        Send Email{recipientCount > 0 ? ` to ${recipientCount}` : ""}
      </Button>
    </div>
  );
}
