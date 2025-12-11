import { Card } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string | number;
  unit?: string;
  icon: LucideIcon;
  status?: "safe" | "caution" | "warning" | "critical";
  trend?: "up" | "down" | "stable";
}

const MetricCard = ({ title, value, unit, icon: Icon, status = "safe", trend }: MetricCardProps) => {
  const getStatusColor = () => {
    switch (status) {
      case "safe":
        return "text-status-safe";
      case "caution":
        return "text-status-caution";
      case "warning":
        return "text-status-warning";
      case "critical":
        return "text-status-critical";
      default:
        return "text-primary";
    }
  };

  return (
    <Card className="p-6 hover:shadow-elevated transition-all">
      <div className="flex items-start justify-between mb-4">
        <div className={`p-3 rounded-xl bg-gradient-primary`}>
          <Icon className="h-5 w-5 text-primary-foreground" />
        </div>
        {trend && (
          <div className={`text-sm font-medium ${getStatusColor()}`}>
            {trend === "up" ? "↑" : trend === "down" ? "↓" : "→"}
          </div>
        )}
      </div>
      <h3 className="text-sm font-medium text-muted-foreground mb-2">{title}</h3>
      <div className="flex items-baseline gap-2">
        <span className={`text-3xl font-bold ${getStatusColor()}`}>
          {typeof value === "number" ? value.toFixed(1) : value}
        </span>
        {unit && <span className="text-lg text-muted-foreground">{unit}</span>}
      </div>
    </Card>
  );
};

export default MetricCard;
