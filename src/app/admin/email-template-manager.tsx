"use client";

import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import { Button, RichTextEditor } from "@/components/ui";
import { Pencil, Trash2, Plus } from "lucide-react";
import {
  createEmailTemplateAction,
  updateEmailTemplateAction,
  deleteEmailTemplateAction,
} from "./actions";
import { MergeVariableLegend } from "./merge-variable-legend";

export interface EmailTemplateData {
  id: string;
  name: string;
  subject: string;
  bodyHtml: string;
}

interface EmailTemplateManagerProps {
  templates: EmailTemplateData[];
  onTemplatesChange: (templates: EmailTemplateData[]) => void;
}

export function EmailTemplateManager({ templates, onTemplatesChange }: EmailTemplateManagerProps) {
  // "new" opens a blank form; a template id opens that template for editing;
  // null means the form is closed and only the list shows.
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [isPending, startTransition] = useTransition();

  const openNew = () => {
    setEditingId("new");
    setName("");
    setSubject("");
    setBody("");
  };

  const openEdit = (template: EmailTemplateData) => {
    setEditingId(template.id);
    setName(template.name);
    setSubject(template.subject);
    setBody(template.bodyHtml);
  };

  const closeForm = () => {
    setEditingId(null);
    setName("");
    setSubject("");
    setBody("");
  };

  const hasBody = body.replace(/<[^>]*>/g, "").trim().length > 0;
  const canSave = name.trim().length > 0 && subject.trim().length > 0 && hasBody && !isPending;

  const handleSave = () => {
    if (!canSave) return;

    startTransition(async () => {
      const result =
        editingId === "new"
          ? await createEmailTemplateAction(name, subject, body)
          : await updateEmailTemplateAction(editingId as string, name, subject, body);

      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      if (editingId === "new") {
        onTemplatesChange([{ id: result.id, name: name.trim(), subject: subject.trim(), bodyHtml: body }, ...templates]);
        toast.success("Template created");
      } else {
        onTemplatesChange(
          templates.map((t) =>
            t.id === result.id ? { id: result.id, name: name.trim(), subject: subject.trim(), bodyHtml: body } : t
          )
        );
        toast.success("Template updated");
      }
      closeForm();
    });
  };

  const handleDelete = (template: EmailTemplateData) => {
    if (!confirm(`Delete the "${template.name}" template? This can't be undone.`)) return;

    startTransition(async () => {
      const result = await deleteEmailTemplateAction(template.id);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      onTemplatesChange(templates.filter((t) => t.id !== template.id));
      if (editingId === template.id) closeForm();
      toast.success("Template deleted");
    });
  };

  return (
    <div className="space-y-4">
      {templates.length === 0 && editingId === null && (
        <p className="text-sm text-base-content/60">No templates yet.</p>
      )}

      {templates.length > 0 && (
        <div className="border border-base-300 rounded-lg divide-y divide-base-300">
          {templates.map((template) => (
            <div key={template.id} className="flex items-center justify-between gap-3 p-3">
              <div className="min-w-0">
                <div className="font-medium truncate">{template.name}</div>
                <div className="text-sm text-base-content/60 truncate">{template.subject}</div>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => openEdit(template)}
                  disabled={isPending}
                  title="Edit template"
                >
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(template)}
                  disabled={isPending}
                  title="Delete template"
                  className="text-error hover:bg-error/10"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editingId === null ? (
        <Button variant="outline" size="sm" onClick={openNew}>
          <Plus className="w-4 h-4" />
          New Template
        </Button>
      ) : (
        <div className="border border-base-300 rounded-lg p-4 space-y-4">
          <div>
            <label className="label">Template name</label>
            <input
              type="text"
              className="input w-full"
              placeholder="e.g. Payment Reminder"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isPending}
            />
          </div>
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
              placeholder="Write the template body..."
            />
            <MergeVariableLegend />
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={!canSave} loading={isPending}>
              {editingId === "new" ? "Create Template" : "Save Changes"}
            </Button>
            <Button variant="ghost" onClick={closeForm} disabled={isPending}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
