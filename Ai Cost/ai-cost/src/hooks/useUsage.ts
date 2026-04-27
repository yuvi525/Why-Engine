import { useState, useEffect } from 'react';

export function useUsage(orgId: string) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orgId) return;
    
    // Connect to actual API, abandoning demo data completely
    fetch(`/api/admin/orgs/${orgId}/usage`, {
      headers: { 'x-admin-secret': process.env.NEXT_PUBLIC_ADMIN_SECRET || '' }
    })
      .then(res => res.json())
      .then(d => {
        setData(d);
        setLoading(false);
      })
      .catch(e => {
        setError(e.message);
        setLoading(false);
      });
  }, [orgId]);

  return { data, loading, error };
}
