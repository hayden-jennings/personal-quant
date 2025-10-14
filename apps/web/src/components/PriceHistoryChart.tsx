// apps/web/src/components/PriceHistoryChart.tsx
import React, { useMemo } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

// If you already export this type elsewhere, import it instead:
export type LinePoint = { t: number; y: number };

const fmtNum = (n: number) =>
  new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(n);
const fmtDate = (ts: number) =>
  new Date(ts).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });

export function PriceHistoryChart({
  data,
  height = 256, // ~h-64
}: {
  data: LinePoint[];
  height?: number;
}) {
  const { yMin, yMax } = useMemo(() => {
    if (!data || data.length < 2) return { yMin: 0, yMax: 1 };
    let minY = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    for (const d of data) {
      if (d.y < minY) minY = d.y;
      if (d.y > maxY) maxY = d.y;
    }
    if (!isFinite(minY) || !isFinite(maxY)) return { yMin: 0, yMax: 1 };

    if (minY === maxY) {
      const pad = Math.abs(minY) * 0.05 || 1;
      return { yMin: minY - pad, yMax: maxY + pad };
    }
    const pad = (maxY - minY) * 0.1; // 10% buffer
    return { yMin: minY - pad, yMax: maxY + pad };
  }, [data]);

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
        >
          <CartesianGrid stroke="rgb(229 231 235)" strokeDasharray="3 3" />
          <XAxis
            dataKey="t"
            tickFormatter={fmtDate}
            stroke="rgb(107 114 128)" // gray-600
            tick={{ fontSize: 12 }}
            axisLine={{ stroke: "rgb(209 213 219)" }} // gray-300
            tickLine={{ stroke: "rgb(209 213 219)" }}
            minTickGap={24}
          />
          <YAxis
            domain={[yMin, yMax]}
            tickFormatter={fmtNum}
            stroke="rgb(107 114 128)"
            tick={{ fontSize: 12 }}
            axisLine={{ stroke: "rgb(209 213 219)" }}
            tickLine={{ stroke: "rgb(209 213 219)" }}
            width={56}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 12,
              borderColor: "rgb(229 231 235)",
              boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
            }}
            labelFormatter={(ts) => fmtDate(Number(ts))}
            formatter={(val: any) => [fmtNum(Number(val)), "Close"]}
          />
          <Line
            type="monotone"
            dataKey="y"
            stroke="rgb(17 24 39)" // gray-900
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
