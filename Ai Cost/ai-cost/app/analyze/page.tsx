"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { AppShell } from "@/src/components/layout/app-shell";
import { PromptInput } from "@/src/components/analyze/prompt-input";
import { ResponseOutput } from "@/src/components/analyze/response-output";
import { MetadataPanel } from "@/src/components/analyze/metadata-panel";
import { WhyExplanation } from "@/src/components/analyze/why-explanation";
import { RequestHistory } from "@/src/components/analyze/request-history";
import { DecisionCard } from "@/components/decision-card";
import { Loader2, Zap, Activity, Info } from "lucide-react";

// ── Mini action-priority bar chart (Step 14) ───────────────────
const BAR_COLORS = ["#6366f1", "#818CF8", "#a5b4fc", "#c7d2fe"];

function ActionPriorityChart({ actions }: { actions: string[] }) {
  if (!actions?.length) return null;
  const data = actions.map((action, i) => ({
    name: `Action ${i + 1}`,
    value: Math.max(10, 100 - i * 18),
    label: String(action).slice(0, 38) + (action.length > 38 ? '…' : ''),
  }));
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2, duration: 0.4 }}
      style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)", borderRadius: 14, padding: "1rem 1.25rem", marginTop: 12 }}
    >
      <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>
        Action Priority
      </p>
      <ResponsiveContainer width="100%" height={120}>
        <BarChart data={data} layout="vertical" margin={{ left: 0, right: 0 }}>
          <XAxis type="number" hide />
          <Tooltip
            cursor={{ fill: "rgba(255,255,255,0.03)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0];
              return (
                <div style={{ background: "#1a2234", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "8px 12px", fontSize: 11, maxWidth: 240 }}>
                  <p style={{ color: "#fff", margin: 0 }}>{(d.payload as any).label}</p>
                </div>
              );
            }}
          />
          <Bar dataKey="value" radius={[0, 6, 6, 0]} maxBarSize={18}>
            {data.map((_, i) => (
              <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </motion.div>
  );
}

// ── Types ─────────────────────────────────────────────────────
interface AnalysisResult {
  priority?: string;
  change?: string;
  why?: string;
  impact?: string;
  action?: string[];
  decision?: string;
  confidence?: string;
  totalCost?: number;
  estimatedSavings?: number;
  anomalyType?: string;
  // "no issue" case
  message?: string;
}

// ── Skeleton card shown while loading ─────────────────────────
function SkeletonCard() {
  return (
    <div
      style={{
        background: "var(--bg-subtle)",
        border: "1px solid var(--border)",
        borderRadius: 16,
        padding: "1.5rem",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      {[100, 70, 90, 60].map((w, i) => (
        <div
          key={i}
          className="shimmer"
          style={{
            height: 14,
            width: `${w}%`,
            borderRadius: 6,
          }}
        />
      ))}
    </div>
  );
}

// ── Empty state when no analysis run yet ──────────────────────
function EmptyState() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "3rem 1.5rem",
        textAlign: "center",
        border: "1px dashed rgba(255,255,255,0.08)",
        borderRadius: 16,
        gap: 12,
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: "50%",
          background: "rgba(99,102,241,0.08)",
          border: "1px solid rgba(99,102,241,0.18)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 22,
        }}
      >
        🔍
      </div>
      <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)", margin: 0 }}>
        No analysis yet
      </p>
      <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0, maxWidth: 280, lineHeight: 1.6 }}>
        Add usage rows and run the spend intelligence engine to see your cost breakdown and recommended actions.
      </p>
    </div>
  );
}

// ── Tab button ────────────────────────────────────────────────
function TabBtn({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "8px 16px",
        borderRadius: 10,
        border: "none",
        cursor: "pointer",
        fontSize: 13,
        fontWeight: 600,
        transition: "all 0.2s",
        background: active ? "rgba(99,102,241,0.14)" : "transparent",
        color: active ? "#818cf8" : "var(--text-muted)",
        outline: active ? "1px solid rgba(99,102,241,0.22)" : "1px solid transparent",
      }}
    >
      {icon}
      {label}
    </button>
  );
}

// ── Usage row type for the cost analysis form ─────────────────
interface UsageRow {
  model: string;
  tokens: number;
  cost: number;
}

const MODEL_OPTIONS = [
  "gpt-4o",
  "gpt-4o-mini",
  "claude-3-5-sonnet-20240620",
  "claude-3-haiku-20240307",
  "gemini-1.5-pro",
  "gemini-1.5-flash",
];

// ── Main page ─────────────────────────────────────────────────
export default function AnalyzePage() {
  const [activeTab, setActiveTab] = useState<"proxy" | "cost">("proxy");

  // ── Proxy tab state ────────────────────────────────────────
  const [isLoadingProxy, setIsLoadingProxy] = useState(false);
  const [response, setResponse] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<Record<string, string> | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [proxyError, setProxyError] = useState<string | null>(null);

  // ── Cost analysis tab state ────────────────────────────────
  const [usageRows, setUsageRows] = useState<UsageRow[]>([
    { model: "gpt-4o", tokens: 8500, cost: 0.085 },
  ]);
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [noIssue, setNoIssue] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // ── Proxy submit ───────────────────────────────────────────
  const handleProxySubmit = async (prompt: string, selectedModel: string) => {
    setIsLoadingProxy(true);
    setResponse(null);
    setMetadata(null);
    setProxyError(null);

    try {
      const res = await fetch("/api/proxy/llm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: selectedModel === "auto" ? undefined : selectedModel,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Proxy error ${res.status}`);

      const responseText =
        data.choices?.[0]?.message?.content || "No content returned.";
      setResponse(responseText);

      const headersMap: Record<string, string> = {};
      res.headers.forEach((value, key) => {
        if (key.toLowerCase().startsWith("x-")) {
          headersMap[key] = value;
          headersMap[key.toUpperCase()] = value;
        }
      });
      if (data.proxy_metadata) {
        headersMap["X-Cost-USD"] = data.proxy_metadata.cost_usd;
      }
      setMetadata(headersMap);
      setHistory((prev) =>
        [{ prompt, model: selectedModel, response: responseText, metadata: headersMap }, ...prev].slice(0, 5)
      );
    } catch (err: any) {
      setProxyError(err.message);
    } finally {
      setIsLoadingProxy(false);
    }
  };

  const handleRestore = (item: any) => {
    setResponse(item.response);
    setMetadata(item.metadata);
  };

  // ── Cost analysis submit ───────────────────────────────────
  const handleAnalysisSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (usageRows.length === 0) return;

    setIsLoadingAnalysis(true);
    setAnalysisResult(null);
    setNoIssue(false);
    setAnalysisError(null);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usage: usageRows }),
      });

      const data: AnalysisResult = await res.json();

      // Handle "no significant issue" case as info, not error
      if (data?.message === "No significant issue detected") {
        setNoIssue(true);
        return;
      }

      if (!res.ok) {
        throw new Error((data as any)?.error || `Analysis error ${res.status}`);
      }

      setAnalysisResult(data);
    } catch (err: any) {
      setAnalysisError(err.message);
    } finally {
      setIsLoadingAnalysis(false);
    }
  };

  // ── Usage row helpers ──────────────────────────────────────
  const addRow = () =>
    setUsageRows((prev) => [...prev, { model: "gpt-4o-mini", tokens: 1000, cost: 0.01 }]);

  const removeRow = (i: number) =>
    setUsageRows((prev) => prev.filter((_, idx) => idx !== i));

  const updateRow = (i: number, field: keyof UsageRow, value: string) =>
    setUsageRows((prev) =>
      prev.map((row, idx) =>
        idx === i
          ? { ...row, [field]: field === "model" ? value : Number(value) }
          : row
      )
    );

  const inputCls =
    "bg-[#111827]/80 border border-[rgba(255,255,255,0.08)] rounded-lg p-2 text-[#F9FAFB] text-sm focus:ring-1 focus:ring-[#6366F1] focus:border-[#6366F1] outline-none transition-all";

  return (
    <AppShell>
      <div className="flex flex-col h-full">
        {/* ── Page header ──────────────────────────────────── */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight text-white">Analyze</h1>
          <p className="text-[#9CA3AF] mt-1">
            Send prompts through the WHY proxy, or run the spend intelligence engine on usage data.
          </p>
        </div>

        {/* ── Tab switcher ─────────────────────────────────── */}
        <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
          <TabBtn
            active={activeTab === "proxy"}
            onClick={() => setActiveTab("proxy")}
            icon={<Activity size={14} />}
            label="LLM Proxy"
          />
          <TabBtn
            active={activeTab === "cost"}
            onClick={() => setActiveTab("cost")}
            icon={<Zap size={14} />}
            label="Spend Intelligence"
          />
        </div>

        <AnimatePresence mode="wait">
          {/* ══════════════════════════════════════════════════
              TAB 1 — LLM PROXY (existing flow, unchanged)
          ══════════════════════════════════════════════════ */}
          {activeTab === "proxy" && (
            <motion.div
              key="proxy"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22 }}
              className="flex flex-col lg:flex-row gap-6 flex-1"
            >
              {/* Left: Interaction */}
              <div className="w-full lg:w-3/5 flex flex-col">
                <PromptInput onSubmit={handleProxySubmit} isLoading={isLoadingProxy} />

                {proxyError && (
                  <div className="mt-4 p-4 rounded-lg bg-[#F43F5E]/10 border border-[#F43F5E]/20 text-[#F43F5E] text-sm">
                    Error: {proxyError}
                  </div>
                )}

                <ResponseOutput responseText={response} />
                <WhyExplanation
                  requestId={
                    metadata?.["X-Request-Id"] || metadata?.["x-request-id"] || null
                  }
                />
              </div>

              {/* Right: Metadata + History */}
              <div className="w-full lg:w-2/5 flex flex-col gap-6">
                <MetadataPanel metadata={metadata} />
                <RequestHistory history={history} onRestore={handleRestore} />
              </div>
            </motion.div>
          )}

          {/* ══════════════════════════════════════════════════
              TAB 2 — SPEND INTELLIGENCE (POST /api/analyze)
          ══════════════════════════════════════════════════ */}
          {activeTab === "cost" && (
            <motion.div
              key="cost"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22 }}
              className="flex flex-col lg:flex-row gap-6 flex-1"
            >
              {/* Left: Usage input form */}
              <div className="w-full lg:w-2/5 flex flex-col gap-4">
                <div
                  style={{
                    background: "var(--bg-subtle)",
                    border: "1px solid var(--border)",
                    borderRadius: 16,
                    padding: "1.25rem",
                  }}
                >
                  <p
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: "0.2em",
                      textTransform: "uppercase",
                      color: "var(--text-muted)",
                      marginBottom: 14,
                    }}
                  >
                    Usage Data
                  </p>

                  <form onSubmit={handleAnalysisSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {/* Row headers */}
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 100px 100px 32px",
                        gap: 8,
                        alignItems: "center",
                      }}
                    >
                      <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>Model</span>
                      <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>Tokens</span>
                      <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>Cost ($)</span>
                      <span />
                    </div>

                    {usageRows.map((row, i) => (
                      <div
                        key={i}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 100px 100px 32px",
                          gap: 8,
                          alignItems: "center",
                        }}
                      >
                        <select
                          value={row.model}
                          onChange={(e) => updateRow(i, "model", e.target.value)}
                          className={inputCls}
                        >
                          {MODEL_OPTIONS.map((m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          min={1}
                          value={row.tokens}
                          onChange={(e) => updateRow(i, "tokens", e.target.value)}
                          className={inputCls}
                        />
                        <input
                          type="number"
                          min={0}
                          step={0.0001}
                          value={row.cost}
                          onChange={(e) => updateRow(i, "cost", e.target.value)}
                          className={inputCls}
                        />
                        <button
                          type="button"
                          onClick={() => removeRow(i)}
                          disabled={usageRows.length === 1}
                          style={{
                            background: "none",
                            border: "none",
                            cursor: usageRows.length === 1 ? "not-allowed" : "pointer",
                            color: "var(--text-muted)",
                            fontSize: 16,
                            lineHeight: 1,
                            opacity: usageRows.length === 1 ? 0.3 : 1,
                          }}
                        >
                          ×
                        </button>
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={addRow}
                      style={{
                        background: "transparent",
                        border: "1px dashed rgba(255,255,255,0.1)",
                        borderRadius: 8,
                        padding: "6px",
                        color: "var(--text-muted)",
                        fontSize: 12,
                        cursor: "pointer",
                        transition: "border-color 0.2s",
                      }}
                    >
                      + Add model row
                    </button>

                    <button
                      type="submit"
                      disabled={isLoadingAnalysis}
                      className="btn-accent"
                      style={{
                        width: "100%",
                        padding: "11px",
                        fontSize: 13,
                        fontWeight: 700,
                        border: "none",
                        cursor: isLoadingAnalysis ? "not-allowed" : "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                        marginTop: 4,
                        opacity: isLoadingAnalysis ? 0.7 : 1,
                      }}
                    >
                      {isLoadingAnalysis ? (
                        <>
                          <Loader2 size={14} className="animate-spin" />
                          Running Intelligence...
                        </>
                      ) : (
                        <>
                          <Zap size={14} />
                          Run Spend Intelligence
                        </>
                      )}
                    </button>
                  </form>
                </div>
              </div>

              {/* Right: Result panel */}
              <div className="w-full lg:w-3/5 flex flex-col">
                {/* Loading skeleton */}
                {isLoadingAnalysis && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3 }}
                  >
                    <SkeletonCard />
                  </motion.div>
                )}

                {/* "No issue" info banner */}
                <AnimatePresence>
                  {noIssue && !isLoadingAnalysis && (
                    <motion.div
                      key="no-issue"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.3 }}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 12,
                        background: "rgba(56,189,248,0.06)",
                        border: "1px solid rgba(56,189,248,0.2)",
                        borderRadius: 14,
                        padding: "1rem 1.25rem",
                      }}
                    >
                      <Info size={18} style={{ color: "var(--sky)", flexShrink: 0, marginTop: 1 }} />
                      <div>
                        <p style={{ fontSize: 14, fontWeight: 700, color: "var(--sky)", marginBottom: 4 }}>
                          No significant issue detected
                        </p>
                        <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
                          Your current usage is within normal cost ranges. No anomalies or high-impact optimizations were identified. Keep monitoring as your usage scales.
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Error banner */}
                <AnimatePresence>
                  {analysisError && !isLoadingAnalysis && (
                    <motion.div
                      key="error"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="p-4 rounded-lg bg-[#F43F5E]/10 border border-[#F43F5E]/20 text-[#F43F5E] text-sm"
                    >
                      Error: {analysisError}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Empty state */}
                {!isLoadingAnalysis && !analysisResult && !noIssue && !analysisError && (
                  <EmptyState />
                )}

                {/* ── DecisionCard result with Framer Motion reveal ── */}
                <AnimatePresence mode="wait">
                  {analysisResult && !isLoadingAnalysis && (
                    <motion.div
                      key="result"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
                    >
                      <DecisionCard
                        decision={analysisResult}
                        totalCost={analysisResult.totalCost}
                        anomalyType={String(analysisResult.anomalyType ?? "").replace(/_/g, " ")}
                        estimatedSavings={analysisResult.estimatedSavings}
                        severity={String((analysisResult as any).severity ?? "").toLowerCase()}
                        isDemo={false}
                        domain={null}
                        suggestedModel={null}
                        fromModel={null}
                      />
                      {/* Mini action-priority chart for spike/overuse anomalies */}
                      {['cost_spike','model_overuse'].includes(String(analysisResult.anomalyType ?? '')) && (
                        <ActionPriorityChart actions={analysisResult.action ?? []} />
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AppShell>
  );
}
