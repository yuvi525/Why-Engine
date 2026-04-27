import { AppShell } from "@/src/components/layout/app-shell";
import { UsageTable } from "@/src/components/usage/usage-table";
import { CostBreakdown } from "@/src/components/usage/cost-breakdown";
import { SpendTrend } from "@/src/components/usage/spend-trend";
import { createServerSupabaseClient } from "@/src/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Download } from "lucide-react";

export const metadata = {
  title: "Usage & Spend | WHY Engine",
  description: "Detailed cost breakdown and request ledger."
};

export default async function UsagePage({ searchParams }: { searchParams: { range?: string } }) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const orgId = user.id;
  const range = searchParams.range || "30d";

  // Calculate date filter
  const days = range === "7d" ? 7 : range === "month" ? 30 : 30;
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data: usage } = await supabase
    .from("usage_records")
    .select("*")
    .eq("org_id", orgId)
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: false });

  // Get org budget for SpendTrend reference line
  const { data: policy } = await supabase
    .from("org_policies")
    .select("daily_budget_usd")
    .eq("org_id", orgId)
    .single();

  const usageData = usage || [];
  const dailyBudget = policy?.daily_budget_usd || 100;

  return (
    <AppShell>
      <div className="flex flex-col h-full space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">Usage & Spend</h1>
            <p className="text-[#9CA3AF] mt-1">Detailed cost breakdown and request history.</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex p-1 rounded-lg bg-[#111827] border border-[#1F2937]">
              <Link 
                href="/usage?range=7d" 
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${range === '7d' ? 'bg-[#1F2937] text-white' : 'text-[#9CA3AF] hover:text-white'}`}
              >
                7d
              </Link>
              <Link 
                href="/usage?range=30d" 
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${range === '30d' ? 'bg-[#1F2937] text-white' : 'text-[#9CA3AF] hover:text-white'}`}
              >
                30d
              </Link>
            </div>
            
            <a 
              href={`/api/usage?range=${range}&format=csv`}
              download="usage.csv"
              className="flex items-center gap-2 px-4 py-2 bg-[#1F2937] hover:bg-[#374151] text-white text-sm font-medium rounded-lg transition-colors border border-[#374151]"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </a>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <SpendTrend data={usageData} dailyBudget={dailyBudget} />
          <CostBreakdown data={usageData} />
        </div>

        <div className="mt-8">
          <h3 className="text-lg font-medium text-[#F9FAFB] mb-4">Request Ledger</h3>
          {usageData.length === 0 ? (
            <div className="p-12 border border-dashed border-[#374151] rounded-xl flex flex-col items-center justify-center text-center">
              <div className="text-[#9CA3AF] mb-2">No usage yet.</div>
              <p className="text-sm text-[#6B7280]">Send your first request via the Analyze page to see data here.</p>
            </div>
          ) : (
            <UsageTable data={usageData} />
          )}
        </div>
      </div>
    </AppShell>
  );
}
