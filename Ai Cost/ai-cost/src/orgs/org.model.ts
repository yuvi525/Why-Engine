export interface Organization {
  id: string;
  name: string;
  plan: 'free' | 'pro' | 'enterprise';
  daily_budget_usd: number | null;
  monthly_budget_usd: number | null;
  preferred_provider: string | null;
  alert_webhook_url: string | null;
  stripe_customer_id: string | null;
}

export interface ApiKey {
  id: string;
  org_id: string;
  key_hash: string;
  label: string;
  rate_limit_rpm: number;
  is_active: boolean;
}

export interface OrgUsage {
  orgId: string;
  spend_today_usd: number;
  spend_month_usd: number;
  daily_budget_usd: number | null;
}
