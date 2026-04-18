import { cn } from "@/lib/utils";

type BadgeStatus = "active" | "pending" | "paused" | "connected" | "operational";

const statusStyles: Record<BadgeStatus, string> = {
  active: "bg-success/15 text-success border-success/20",
  connected: "bg-success/15 text-success border-success/20",
  operational: "bg-success/15 text-success border-success/20",
  pending: "bg-warning/15 text-warning border-warning/20",
  paused: "bg-muted text-muted-foreground border-border",
};

const statusDot: Record<BadgeStatus, string> = {
  active: "bg-success",
  connected: "bg-success",
  operational: "bg-success",
  pending: "bg-warning",
  paused: "bg-muted-foreground",
};

interface StatusBadgeProps {
  status: BadgeStatus;
  label?: string;
  className?: string;
}

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        statusStyles[status],
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", statusDot[status])} />
      {label || status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}
