import { Badge } from "@/components/ui/badge";
// StatusBadge.tsx
import { AreaStatus } from "@/types/waterQuality";

interface StatusBadgeProps {
  // Widen the type to include all possible statuses the badge is expected to display
  status: "Safe" | "Soft" | "Moderately Hard" | "Hard" | "Very Hard";
  size?: "sm" | "md" | "lg";
}

const StatusBadge = ({ status, size = "md" }: StatusBadgeProps) => {
  const getStatusColor = () => {
    switch (status) {
      case "Safe":
      case "Soft":
        return "bg-status-safe/10 text-status-safe border-status-safe/20";
      case "Moderately Hard":
        return "bg-status-caution/10 text-status-caution border-status-caution/20";
      case "Hard":
        return "bg-status-warning/10 text-status-warning border-status-warning/20";
      case "Very Hard":
        return "bg-status-critical/10 text-status-critical border-status-critical/20";
      default:
        return "bg-muted text-muted-foreground border-border";
    }
  };

  const sizeClasses = {
    sm: "text-xs px-2 py-0.5",
    md: "text-sm px-3 py-1",
    lg: "text-base px-4 py-1.5",
  };

  return (
    <Badge
      variant="outline"
      className={`${getStatusColor()} ${sizeClasses[size]} font-medium border`}
    >
      {status}
    </Badge>
  );
};

export default StatusBadge;
