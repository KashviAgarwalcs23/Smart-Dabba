import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin } from "lucide-react";

interface AreaSelectorProps {
  areas: string[];
  selectedArea: string;
  onAreaChange: (area: string) => void;
}

const AreaSelector = ({ areas, selectedArea, onAreaChange }: AreaSelectorProps) => {
  return (
    <div className="w-full max-w-xs">
      <Select value={selectedArea} onValueChange={onAreaChange}>
        <SelectTrigger className="w-full bg-card border-border shadow-soft">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" />
            <SelectValue placeholder="Select your area" />
          </div>
        </SelectTrigger>
        <SelectContent className="bg-card border-border shadow-elevated">
          {areas.map((area) => (
            <SelectItem key={area} value={area}>
              {area}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export default AreaSelector;
