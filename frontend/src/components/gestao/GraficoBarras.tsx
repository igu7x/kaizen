import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface GraficoBarrasProps {
  title: string;
  data: Record<string, string | number>[];
  dataKeys: { key: string; name: string; color: string }[];
  xAxisKey: string;
}

export function GraficoBarras({
  title,
  data,
  dataKeys,
  xAxisKey,
}: GraficoBarrasProps) {
  return (
    <Card
      className="flex flex-col border-0 shadow-md rounded-lg"
      style={{ height: "400px" }}
    >
      <CardHeader className="pb-2 py-3 flex-shrink-0">
        <CardTitle className="text-base leading-none">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex items-center justify-center p-4 overflow-hidden">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={xAxisKey} />
            <YAxis />
            <Tooltip />
            <Legend />
            {dataKeys.map((dk) => (
              <Bar
                key={dk.key}
                dataKey={dk.key}
                name={dk.name}
                fill={dk.color}
                stackId="a"
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
