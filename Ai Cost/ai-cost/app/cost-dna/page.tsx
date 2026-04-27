import { AppShell } from "@/src/components/layout/app-shell";
import { WasteScoreGauge } from "@/src/components/cost-dna/waste-score-gauge";
import { ModelDistributionWaste } from "@/src/components/cost-dna/model-distribution-waste";
import { RecommendationsList } from "@/src/components/cost-dna/recommendations-list";
import { FingerprintStats } from "@/src/components/cost-dna/fingerprint-stats";
import { createServerSupabaseClient } from "@/src/lib/supabase/server";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Cost DNA Profile | WHY Engine",
  description: "Deep analysis of your organization's AI usage patterns and waste vectors."
};

export default async function CostDnaPage() {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const orgId = user.id;

  // Fetch the latest Cost DNA Snapshot
  const { data: dna } = await supabase
    .from("cost_dna_snapshots")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  // Fetch Efficiency Score for metrics
  const { data: score } = await supabase
    .from("efficiency_scores")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  const wasteScore = dna?.waste_score || 45;
  const recommendations = dna?.recommendations || [];
  const metrics = score?.metrics || {};

  return (
    <AppShell>
      <div className="space-y-6 max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">Cost DNA Profile</h1>
            <p className="text-[#9CA3AF] mt-1">Deep analysis of your organization's AI usage patterns and waste vectors.</p>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-[#1F2937] hover:bg-[#374151] border border-[#374151] text-white text-sm font-medium rounded-lg transition-colors">
            Refresh Analysis
          </button>
        </div>

        {!dna && !score ? (
          <div className="flex flex-col items-center justify-center p-12 border border-dashed border-[#374151] rounded-xl text-center bg-[#111827]/50 mt-8 min-h-[300px]">
            <div className="w-16 h-16 rounded-full bg-[#1F2937] flex items-center justify-center mb-4 border border-[#374151]">
              <span className="text-2xl text-[#9CA3AF]">🧬</span>
            </div>
            <h3 className="text-xl font-bold text-white mb-2">No DNA Profile Yet</h3>
            <p className="text-[#9CA3AF] max-w-md">Run your first requests to generate your Cost DNA profile. The system requires at least a few proxy events to analyze your usage fingerprint.</p>
          </div>
        ) : (
          <>
            <FingerprintStats metrics={metrics} />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <WasteScoreGauge score={wasteScore} />
              <div className="lg:col-span-2">
                <ModelDistributionWaste data={[]} />
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <RecommendationsList recommendations={recommendations} />
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
