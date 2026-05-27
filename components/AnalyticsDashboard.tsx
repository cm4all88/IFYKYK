"use client";

import { useEffect, useState } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface ChartPoint {
  date: string;
  label: string;
  subscribers: number;
  earnings: number;
  newSubs: number;
}

interface Summary {
  totalSubscribers: number;
  allTimeEarnings: number;
  monthEarnings: number;
  newSubsInPeriod: number;
}

type Period = 7 | 30 | 90;

const PERIOD_LABELS: Record<Period, string> = {
  7: "7 days",
  30: "30 days",
  90: "90 days",
};

function fmt(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function fmtMoney(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

// Thin every-other label for dense x-axes
function tickFormatter(label: string, index: number, period: Period) {
  if (period === 7) return label;
  if (period === 30) return index % 5 === 0 ? label : "";
  return index % 15 === 0 ? label : "";
}

const CustomTooltipSubs = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "#111118",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 6,
      padding: "10px 14px",
      fontSize: 13,
    }}>
      <p style={{ color: "#71717a", marginBottom: 4 }}>{label}</p>
      <p style={{ color: "#F0B429", fontWeight: 600 }}>{payload[0].value} subscribers</p>
      {payload[1] && <p style={{ color: "#a78bfa" }}>+{payload[1].value} new</p>}
    </div>
  );
};

const CustomTooltipEarnings = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "#111118",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 6,
      padding: "10px 14px",
      fontSize: 13,
    }}>
      <p style={{ color: "#71717a", marginBottom: 4 }}>{label}</p>
      <p style={{ color: "#34d399", fontWeight: 600 }}>{fmtMoney(payload[0].value)}</p>
    </div>
  );
};

export default function AnalyticsDashboard() {
  const [period, setPeriod] = useState<Period>(30);
  const [data, setData] = useState<ChartPoint[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    fetch(`/api/analytics?days=${period}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.error) { setError(json.error); return; }
        setData(json.chartData ?? []);
        setSummary(json.summary ?? null);
      })
      .catch(() => setError("Failed to load analytics"))
      .finally(() => setLoading(false));
  }, [period]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

      {/* Summary stat row */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
        gap: 2,
      }}>
        {[
          {
            label: "Total Subscribers",
            value: summary ? fmt(summary.totalSubscribers) : "—",
            accent: "#F0B429",
          },
          {
            label: `New This Period`,
            value: summary ? `+${summary.newSubsInPeriod}` : "—",
            accent: "#a78bfa",
          },
          {
            label: "This Month",
            value: summary ? fmtMoney(summary.monthEarnings) : "—",
            accent: "#34d399",
          },
          {
            label: "All-Time Earnings",
            value: summary ? fmtMoney(summary.allTimeEarnings) : "—",
            accent: "#60a5fa",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            style={{
              background: "#111118",
              border: "1px solid rgba(255,255,255,0.07)",
              padding: "20px 24px",
            }}
          >
            <p style={{ fontSize: 11, color: "#71717a", marginBottom: 6, letterSpacing: "0.1em", textTransform: "uppercase" }}>
              {stat.label}
            </p>
            <p style={{ fontSize: 28, fontWeight: 700, color: stat.accent, fontFamily: "var(--font-mono, monospace)", lineHeight: 1 }}>
              {loading ? <span style={{ opacity: 0.3 }}>···</span> : stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Period selector */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <p style={{ fontSize: 13, color: "#71717a" }}>Showing last {PERIOD_LABELS[period]}</p>
        <div style={{ display: "flex", gap: 2 }}>
          {([7, 30, 90] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              style={{
                padding: "6px 14px",
                fontSize: 12,
                fontFamily: "monospace",
                letterSpacing: "0.05em",
                background: period === p ? "#F0B429" : "#111118",
                color: period === p ? "#09090C" : "#71717a",
                border: "1px solid",
                borderColor: period === p ? "#F0B429" : "rgba(255,255,255,0.08)",
                cursor: "pointer",
                borderRadius: 3,
                transition: "all 0.15s",
              }}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p style={{ color: "#f87171", fontSize: 13, padding: "12px 16px", background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", borderRadius: 4 }}>
          {error}
        </p>
      )}

      {/* Subscriber growth chart */}
      <div style={{
        background: "#111118",
        border: "1px solid rgba(255,255,255,0.07)",
        padding: "28px 24px 16px",
      }}>
        <p style={{ fontSize: 12, color: "#71717a", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 20 }}>
          Subscriber Growth
        </p>
        {loading ? (
          <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center", color: "#3f3f46" }}>
            Loading…
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="subGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#F0B429" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#F0B429" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="newSubGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.12} />
                  <stop offset="95%" stopColor="#a78bfa" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: "#52525b", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v, i) => tickFormatter(v, i, period)}
              />
              <YAxis
                tick={{ fill: "#52525b", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={fmt}
              />
              <Tooltip content={<CustomTooltipSubs />} cursor={{ stroke: "rgba(255,255,255,0.06)" }} />
              <Area
                type="monotone"
                dataKey="subscribers"
                stroke="#F0B429"
                strokeWidth={2}
                fill="url(#subGrad)"
                dot={false}
                activeDot={{ r: 4, fill: "#F0B429" }}
              />
              <Area
                type="monotone"
                dataKey="newSubs"
                stroke="#a78bfa"
                strokeWidth={1.5}
                fill="url(#newSubGrad)"
                dot={false}
                activeDot={{ r: 3, fill: "#a78bfa" }}
                strokeDasharray="4 2"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
        <div style={{ display: "flex", gap: 20, marginTop: 12 }}>
          <span style={{ fontSize: 11, color: "#71717a", display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 20, height: 2, background: "#F0B429", display: "inline-block" }} />
            Total subscribers
          </span>
          <span style={{ fontSize: 11, color: "#71717a", display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 20, height: 2, background: "#a78bfa", display: "inline-block", opacity: 0.7 }} />
            New per day
          </span>
        </div>
      </div>

      {/* Earnings chart */}
      <div style={{
        background: "#111118",
        border: "1px solid rgba(255,255,255,0.07)",
        padding: "28px 24px 16px",
      }}>
        <p style={{ fontSize: 12, color: "#71717a", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 20 }}>
          Daily Earnings
        </p>
        {loading ? (
          <div style={{ height: 180, display: "flex", alignItems: "center", justifyContent: "center", color: "#3f3f46" }}>
            Loading…
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: "#52525b", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v, i) => tickFormatter(v, i, period)}
              />
              <YAxis
                tick={{ fill: "#52525b", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `$${v}`}
              />
              <Tooltip content={<CustomTooltipEarnings />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
              <Bar
                dataKey="earnings"
                fill="#34d399"
                radius={[3, 3, 0, 0]}
                maxBarSize={24}
                opacity={0.85}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

    </div>
  );
}
