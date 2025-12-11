import { Card } from "@/components/ui/card";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { WaterQualityData } from "@/types/waterQuality";

interface WaterQualityChartProps {
  data: WaterQualityData[];
  title: string;
  dataKeys: { key: keyof WaterQualityData; color: string; name: string }[];
}

const WaterQualityChart = ({ data, title, dataKeys }: WaterQualityChartProps) => {
  const formattedData = data.map((item) => ({
    ...item,
    date: new Date(item.timestamp).toLocaleDateString("en-IN", {
      month: "short",
      day: "numeric",
    }),
  }));

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-6">{title}</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={formattedData}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            dataKey="date"
            stroke="hsl(var(--muted-foreground))"
            fontSize={12}
            tickLine={false}
          />
          <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "var(--radius)",
            }}
          />
          <Legend />
          {dataKeys.map((item) => (
            <Line
              key={item.key}
              type="monotone"
              dataKey={item.key}
              stroke={item.color}
              strokeWidth={2}
              name={item.name}
              dot={{ fill: item.color, r: 4 }}
              activeDot={{ r: 6 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </Card>
  );
};

export default WaterQualityChart;
