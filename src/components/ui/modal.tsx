"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  /** Extra classes on the visible box itself (e.g. a wider max-width for
   * content-heavy modals) -- `className` alone only reaches the outer
   * `<dialog>`, which daisyUI doesn't size the box from. */
  boxClassName?: string;
}

export function Modal({ open, onClose, children, className, boxClassName }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      dialog.showModal();
    } else {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog ref={dialogRef} className={cn("modal", className)} onClose={onClose}>
      <div className={cn("modal-box", boxClassName)}>
        {children}
      </div>
      <form method="dialog" className="modal-backdrop">
        <button onClick={onClose}>close</button>
      </form>
    </dialog>
  );
}

export function ModalTitle({ children }: { children: ReactNode }) {
  return <h3 className="font-bold text-lg">{children}</h3>;
}

export function ModalActions({ children }: { children: ReactNode }) {
  return <div className="modal-action">{children}</div>;
}
