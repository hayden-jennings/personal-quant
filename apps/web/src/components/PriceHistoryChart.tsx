// apps/web/src/components/PriceHistoryChart.tsx
import React from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import type { LinePoint } from "../lib/timeSeries";

function formatDate(ts: number) {
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function PriceHistoryChart({ data }: { data: LinePoint[] }) {
  return (
    <div className="h-56 md:h-72">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 8, right: 8, bottom: 8, left: 8 }}
        >
          <XAxis
            dataKey="t"
            tickFormatter={formatDate}
            tick={{ fontSize: 12, fill: "#6b7280" }}
            axisLine={{ stroke: "#e5e7eb" }}
            tickLine={{ stroke: "#e5e7eb" }}
          />
          <YAxis
            width={56}
            tick={{ fontSize: 12, fill: "#6b7280" }}
            axisLine={{ stroke: "#e5e7eb" }}
            tickLine={{ stroke: "#e5e7eb" }}
            tickFormatter={(v) => `$${v.toFixed(0)}`}
          />
          <Tooltip
            labelFormatter={(ts) => new Date(Number(ts)).toLocaleDateString()}
            formatter={(y: number) => [`$${y.toFixed(2)}`, "Close"]}
            contentStyle={{ borderRadius: 12 }}
          />
          <Line
            type="monotone"
            dataKey="y"
            stroke="#6b7280" // neutral gray for grayscale theme
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
