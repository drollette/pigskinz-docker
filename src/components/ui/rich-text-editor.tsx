"use client";

import { useEffect, useRef } from "react";
import {
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Link2,
  RemoveFormatting,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

/**
 * Minimal contentEditable-based WYSIWYG (bold/italic/underline/lists/link)
 * using document.execCommand — deprecated but still universally supported,
 * and avoids pulling in a full editor framework for a single admin-only
 * text field. Output is raw HTML; the server sanitizes it on save
 * (see updateHomeMessageAction) since contentEditable allows pasting
 * arbitrary HTML from the clipboard.
 */
export function RichTextEditor({
  value,
  onChange,
  disabled,
  placeholder,
  className,
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  // Tracks the last HTML this editor itself emitted via onChange, so the
  // sync effect below can tell "value changed because the user typed"
  // (onChange round-tripped back through the parent's own state) apart from
  // "value changed because the parent set new content out-of-band" (e.g.
  // loading an email template into an already-mounted editor, or switching
  // which record a form is editing). Only the latter should overwrite
  // editorRef's innerHTML -- doing it unconditionally on every value change
  // would reset the cursor to the start on every keystroke.
  const lastEmitted = useRef<string | null>(null);

  useEffect(() => {
    if (!editorRef.current || value === lastEmitted.current) return;
    editorRef.current.innerHTML = value;
    lastEmitted.current = value;
  }, [value]);

  const emitChange = (html: string) => {
    lastEmitted.current = html;
    onChange(html);
  };

  const exec = (command: string, arg?: string) => {
    if (disabled) return;
    editorRef.current?.focus();
    document.execCommand(command, false, arg);
    emitChange(editorRef.current?.innerHTML ?? "");
  };

  const handleLink = () => {
    if (disabled) return;
    const url = window.prompt("Link URL");
    if (url) exec("createLink", url);
  };

  const handleInput = () => {
    emitChange(editorRef.current?.innerHTML ?? "");
  };

  return (
    <div
      className={cn(
        "border border-base-300 rounded-lg overflow-hidden",
        disabled && "opacity-60",
        className
      )}
    >
      <div className="flex flex-wrap gap-1 border-b border-base-300 bg-base-200/50 p-1.5">
        <ToolbarButton title="Bold" onClick={() => exec("bold")} disabled={disabled}>
          <Bold size={16} />
        </ToolbarButton>
        <ToolbarButton title="Italic" onClick={() => exec("italic")} disabled={disabled}>
          <Italic size={16} />
        </ToolbarButton>
        <ToolbarButton title="Underline" onClick={() => exec("underline")} disabled={disabled}>
          <Underline size={16} />
        </ToolbarButton>
        <ToolbarButton
          title="Bullet list"
          onClick={() => exec("insertUnorderedList")}
          disabled={disabled}
        >
          <List size={16} />
        </ToolbarButton>
        <ToolbarButton
          title="Numbered list"
          onClick={() => exec("insertOrderedList")}
          disabled={disabled}
        >
          <ListOrdered size={16} />
        </ToolbarButton>
        <ToolbarButton title="Link" onClick={handleLink} disabled={disabled}>
          <Link2 size={16} />
        </ToolbarButton>
        <ToolbarButton
          title="Clear formatting"
          onClick={() => exec("removeFormat")}
          disabled={disabled}
        >
          <RemoveFormatting size={16} />
        </ToolbarButton>
      </div>
      <div
        ref={editorRef}
        contentEditable={!disabled}
        onInput={handleInput}
        data-placeholder={placeholder}
        suppressContentEditableWarning
        className="prose prose-sm max-w-none min-h-[100px] p-3 focus:outline-none empty:before:content-[attr(data-placeholder)] empty:before:text-base-content/40"
      />
    </div>
  );
}

function ToolbarButton({
  title,
  onClick,
  disabled,
  children,
}: {
  title: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      // Prevent the toolbar button from stealing focus/selection away from
      // the editor before the command runs.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="btn btn-ghost btn-xs btn-square"
    >
      {children}
    </button>
  );
}
