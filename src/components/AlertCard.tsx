import { Alert } from "@/types/waterQuality";
import { Card } from "@/components/ui/card";
import { AlertTriangle, Info, AlertCircle } from "lucide-react";

interface AlertCardProps {
  alert: Alert;
}

const AlertCard = ({ alert }: AlertCardProps) => {
  const getAlertStyle = () => {
    switch (alert.type) {
      case "critical":
        return {
          bg: "bg-status-critical/5 border-status-critical/20",
          icon: <AlertTriangle className="h-5 w-5 text-status-critical" />,
          text: "text-status-critical",
        };
      case "warning":
        return {
          bg: "bg-status-warning/5 border-status-warning/20",
          icon: <AlertCircle className="h-5 w-5 text-status-warning" />,
          text: "text-status-warning",
        };
      case "info":
        return {
          bg: "bg-status-safe/5 border-status-safe/20",
          icon: <Info className="h-5 w-5 text-status-safe" />,
          text: "text-status-safe",
        };
    }
  };

  const style = getAlertStyle();

  return (
    <Card className={`p-4 ${style.bg} border transition-all hover:shadow-md`}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5">{style.icon}</div>
        <div className="flex-1">
          <p className={`font-medium ${style.text} mb-1`}>{alert.message}</p>
          {alert.value > 0 && (
            <p className="text-sm text-muted-foreground">
              {alert.parameter}: {alert.value.toFixed(2)} (Threshold: {alert.threshold})
            </p>
          )}
        </div>
      </div>
    </Card>
  );
};

export default AlertCard;
