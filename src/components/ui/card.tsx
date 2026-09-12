import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface CardProps {
  children: ReactNode;
  className?: string;
  id?: string;
}

export function Card({ children, className, id }: CardProps) {
  return (
    <div id={id} className={cn("card bg-base-100 shadow-xl", className)}>
      {children}
    </div>
  );
}

export function CardBody({ children, className }: CardProps) {
  return <div className={cn("card-body", className)}>{children}</div>;
}

export function CardTitle({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <h2 className={cn("card-title", className)}>{children}</h2>;
}

export function CardActions({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("card-actions justify-end", className)}>{children}</div>
  );
}
