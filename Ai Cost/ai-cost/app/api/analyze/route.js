import { NextResponse } from "next/server";
import { buildContext } from "@/lib/context-builder";
import { buildCostIntelligence } from "@/lib/cost-engine";
import { detectCostAnomaly } from "@/lib/detection-engine";
import { formatDecisionOutput } from "@/lib/output-formatter";
import { generateWhyDecision } from "@/lib/why-engine";
import { supabase } from "@/lib/db";

function normalizeUsageData(input) {
  if (!Array.isArray(input)) {
    return {
      ok: false,
      error: "Usage data must be a JSON array.",
    };
  }

  if (input.length < 2) {
    return {
      ok: false,
      error: "Provide at least two usage records to analyze trends.",
    };
  }

  const normalized = [];

  for (const entry of input) {
    const model = String(entry?.model || "").trim();
    const tokens = Number(entry?.tokens);
    const cost = Number(entry?.cost);

    if (!model || !Number.isFinite(tokens) || !Number.isFinite(cost)) {
      return {
        ok: false,
        error:
          "Each usage record must include model, tokens, and cost as valid values.",
      };
    }

    if (tokens < 0 || cost < 0) {
      return {
        ok: false,
        error: "Tokens and cost must be zero or greater.",
      };
    }

    normalized.push({
      model,
      tokens,
      cost,
    });
  }

  return {
    ok: true,
    data: normalized,
  };
}

export async function POST(request) {
  console.log("[/api/analyze] Incoming analysis request");

  try {
    let body;

    try {
      body = await request.json();
    } catch (error) {
      console.error("[/api/analyze] Failed to parse request JSON", error);
      return NextResponse.json(
        { error: "Invalid JSON body." },
        { status: 400 }
      );
    }

    const usagePayload = body?.usageData ?? body?.usage;
    const normalizedUsage = normalizeUsageData(usagePayload);

    if (!normalizedUsage.ok) {
      console.error("[/api/analyze] Validation failed", normalizedUsage.error);
      return NextResponse.json(
        { error: normalizedUsage.error },
        { status: 400 }
      );
    }

    const costIntelligence = buildCostIntelligence(normalizedUsage.data);
    console.log("[/api/analyze] Cost intelligence generated", costIntelligence);

    // Generate a session ID that links usage logs to the analysis result.
    const sessionId = crypto.randomUUID();

    // Write 1: Persist raw usage records — fire-and-forget, never blocks the response.
    supabase
      .from("ai_usage_logs")
      .insert(
        normalizedUsage.data.map((entry) => ({
          session_id: sessionId,
          model: entry.model,
          tokens: entry.tokens,
          cost: entry.cost,
        }))
      )
      .then(({ error }) => {
        if (error) {
          console.error("[db] ai_usage_logs insert failed", error.message);
        }
      })
      .catch((err) => {
        console.error("[db] ai_usage_logs unexpected error", err);
      });

    const anomaly = detectCostAnomaly({
      usage: normalizedUsage.data,
      currentCost: costIntelligence.latestCost,
      previousCost: costIntelligence.previousCost,
      costByModel: costIntelligence.costByModel,
      totalCost: costIntelligence.totalCost,
    });

    console.log("[/api/analyze] Detection result", anomaly);

    if (!anomaly.isAnomaly) {
      return NextResponse.json(
        { message: "No significant issue detected" },
        { status: 200 }
      );
    }

    const whyContext = buildContext(costIntelligence, anomaly, normalizedUsage.data);
    console.log("[/api/analyze] WHY context built", whyContext);

    let whyDecision;

    try {
      whyDecision = await generateWhyDecision(whyContext);
    } catch (error) {
      console.error("[/api/analyze] WHY engine failed", error);

      const status =
        error.message === "OPENAI_API_KEY_MISSING" ? 500 : 502;
      const message =
        error.message === "OPENAI_API_KEY_MISSING"
          ? "Server configuration error: missing OpenAI API key."
          : "Failed to generate WHY decision.";

      return NextResponse.json({ error: message }, { status });
    }

    console.log("[/api/analyze] Analysis generated successfully");

    const formattedDecision = formatDecisionOutput(
      {
        ...costIntelligence,
        ...whyDecision,
      },
      anomaly
    );

    // Write 2: Persist the decision result — fire-and-forget, never blocks the response.
    supabase
      .from("analysis_results")
      .insert([
        {
          session_id: sessionId,
          anomaly_type: anomaly.type,
          priority: formattedDecision.priority,
          why: formattedDecision.why,
          impact: formattedDecision.impact,
          action: formattedDecision.action,
          decision: formattedDecision.decision,
          confidence: formattedDecision.confidence,
          total_cost: costIntelligence.totalCost,
          estimated_savings: costIntelligence.estimatedSavings,
        },
      ])
      .then(({ error }) => {
        if (error) {
          console.error("[db] analysis_results insert failed", error.message);
        }
      })
      .catch((err) => {
        console.error("[db] analysis_results unexpected error", err);
      });

    return NextResponse.json(formattedDecision, { status: 200 });
  } catch (error) {
    console.error("[/api/analyze] Unexpected error", error);
    return NextResponse.json(
      { error: "Failed to analyze usage data." },
      { status: 500 }
    );
  }
}
