"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:
    | "default"
    | "primary"
    | "secondary"
    | "accent"
    | "ghost"
    | "link"
    | "outline"
    | "info"
    | "success"
    | "warning"
    | "error";
  size?: "xs" | "sm" | "md" | "lg";
  loading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "default",
      size = "md",
      loading = false,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const variantClasses = {
      default: "btn",
      primary: "btn btn-primary",
      secondary: "btn btn-secondary",
      accent: "btn btn-accent",
      ghost: "btn btn-ghost",
      link: "btn btn-link",
      outline: "btn btn-outline",
      info: "btn btn-info",
      success: "btn btn-success",
      warning: "btn btn-warning",
      error: "btn btn-error",
    };

    const sizeClasses = {
      xs: "btn-xs",
      sm: "btn-sm",
      md: "",
      lg: "btn-lg",
    };

    return (
      <button
        ref={ref}
        className={cn(
          variantClasses[variant],
          sizeClasses[size],
          loading && "loading",
          className
        )}
        disabled={disabled || loading}
        {...props}
      >
        {loading && <span className="loading loading-spinner loading-sm" />}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";

export { Button };
