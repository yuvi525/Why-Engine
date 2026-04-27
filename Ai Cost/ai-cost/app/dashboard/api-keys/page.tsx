'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AppShell } from '@/src/components/layout/app-shell';
import { useToast } from '@/src/components/ui/toast-provider';
import { KeyRound, Plus, Copy, Trash2, Loader2, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase-browser';
import { DEMO_AUTOPILOT_RULES } from '@/lib/demo-data';

// ── Types ─────────────────────────────────────────────────────────────────────
interface ApiKey {
  id: string;
  name: string;
  prefix: string;           // stored as 'prefix' in DB, shown as key_prefix
  key_prefix?: string;      // alias used by the spec
  created_at: string;
  last_used_at: string | null;
  is_active: boolean;
  revoked_at?: string | null;
}

function fmt(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── Demo keys (when not authenticated) ───────────────────────────────────────
const DEMO_KEYS: ApiKey[] = [
  { id: 'demo-key-1', name: 'Production Pipeline', prefix: 'whye_a1b2', created_at: new Date(Date.now() - 14 * 86400000).toISOString(), last_used_at: new Date(Date.now() - 60000).toISOString(), is_active: true },
  { id: 'demo-key-2', name: 'Staging Env',         prefix: 'whye_c3d4', created_at: new Date(Date.now() - 7  * 86400000).toISOString(), last_used_at: null, is_active: true },
];

// ── KeyRow ────────────────────────────────────────────────────────────────────
function KeyRow({ k, onRevoke, isRevoking }: { k: ApiKey; onRevoke: (id: string) => void; isRevoking: boolean }) {
  const { toast } = useToast();
  const prefix = k.prefix || k.key_prefix || 'whye_???';

  const copyPrefix = () => {
    navigator.clipboard.writeText(prefix + '...');
    toast('Key prefix copied', 'info');
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14,
      background: 'rgba(255,255,255,0.025)',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 12, padding: '12px 16px',
    }}>
      <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <KeyRound size={15} style={{ color: '#818CF8' }} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: '#F9FAFB', margin: '0 0 3px' }}>{k.name}</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <code style={{ fontSize: 11, color: '#6B7280', fontFamily: 'monospace', background: 'rgba(255,255,255,0.04)', padding: '2px 6px', borderRadius: 5 }}>
            {prefix}...
          </code>
          <button onClick={copyPrefix} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: '#6B7280' }} title="Copy prefix">
            <Copy size={12} />
          </button>
        </div>
      </div>

      <div style={{ textAlign: 'right', fontSize: 11, color: '#6B7280', flexShrink: 0 }}>
        <p style={{ margin: '0 0 2px' }}>Created {fmt(k.created_at)}</p>
        <p style={{ margin: 0 }}>Last used: {fmt(k.last_used_at)}</p>
      </div>

      {/* Active badge */}
      <span style={{ fontSize: 10, fontWeight: 700, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', color: '#22c55e', borderRadius: 999, padding: '2px 8px', whiteSpace: 'nowrap', flexShrink: 0 }}>
        Active
      </span>

      {/* Revoke */}
      <button
        onClick={() => onRevoke(k.id)}
        disabled={isRevoking}
        style={{ background: 'none', border: 'none', cursor: isRevoking ? 'not-allowed' : 'pointer', padding: 4, color: '#6B7280', flexShrink: 0, opacity: isRevoking ? 0.4 : 1 }}
        title="Revoke key"
      >
        {isRevoking ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
      </button>
    </div>
  );
}

// ── NewKeyReveal ───────────────────────────────────────────────────────────────
function NewKeyReveal({ rawKey, onDismiss }: { rawKey: string; onDismiss: () => void }) {
  const { toast } = useToast();
  const [visible, setVisible] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(rawKey);
    toast('API key copied — store it somewhere safe!', 'success');
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
      style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 18, padding: '1.5rem' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <ShieldCheck size={16} style={{ color: '#22c55e' }} />
        <p style={{ fontSize: 13, fontWeight: 700, color: '#22c55e', margin: 0 }}>
          Key created — copy it now. You will not see it again.
        </p>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <code style={{ flex: 1, fontFamily: 'monospace', fontSize: 13, color: '#F9FAFB', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px 14px', wordBreak: 'break-all', letterSpacing: visible ? 'normal' : '0.15em' }}>
          {visible ? rawKey : rawKey.replace(/./g, '•')}
        </code>
        <button onClick={() => setVisible(v => !v)} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px', cursor: 'pointer', color: '#9CA3AF', flexShrink: 0 }}>
          {visible ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
        <button onClick={copy} style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', color: '#22c55e', fontWeight: 700, fontSize: 12, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5 }}>
          <Copy size={13} /> Copy
        </button>
      </div>
      <button onClick={onDismiss} style={{ marginTop: 12, background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', fontSize: 12 }}>
        I've saved it — dismiss
      </button>
    </motion.div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ApiKeysPage() {
  const { toast } = useToast();
  const [keys, setKeys]           = useState<ApiKey[]>([]);
  const [newKey, setNewKey]       = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setCreating] = useState(false);
  const [revokingId, setRevoking] = useState<string | null>(null);
  const [name, setName]           = useState('');
  const [isDemo, setIsDemo]       = useState(false);

  // ── Load keys ─────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess?.session) {
        setIsDemo(true);
        setKeys(DEMO_KEYS);
        setIsLoading(false);
        return;
      }
      const res = await fetch('/api/keys');
      if (res.ok) {
        const data = await res.json();
        // Normalise: the API returns `prefix`, spec calls it `key_prefix`
        setKeys((data || []).map((k: any) => ({ ...k, key_prefix: k.prefix })));
      }
      setIsLoading(false);
    })();
  }, []);

  // ── Create key ────────────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!name.trim()) return;
    if (isDemo) {
      const demoKey = `whye_demo_${Math.random().toString(36).slice(2, 14)}`;
      const newEntry: ApiKey = { id: `demo-${Date.now()}`, name, prefix: demoKey.slice(0, 8), created_at: new Date().toISOString(), last_used_at: null, is_active: true };
      setKeys(prev => [newEntry, ...prev]);
      setNewKey(demoKey);
      setName('');
      toast('Key created — copy it now', 'success');
      return;
    }
    setCreating(true);
    try {
      const res = await fetch('/api/keys', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
      if (!res.ok) throw new Error((await res.json()).error);
      const data = await res.json();
      setKeys(prev => [{ ...data, key_prefix: data.prefix }, ...prev]);
      setNewKey(data.raw_key);
      setName('');
      toast('Key created — copy it now', 'success');
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setCreating(false);
    }
  };

  // ── Revoke key ────────────────────────────────────────────────────────────
  const handleRevoke = async (id: string) => {
    if (isDemo) {
      setKeys(prev => prev.filter(k => k.id !== id));
      toast('Key revoked', 'info');
      return;
    }
    setRevoking(id);
    try {
      const res = await fetch(`/api/keys/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error);
      setKeys(prev => prev.filter(k => k.id !== id));
      toast('Key revoked', 'info');
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setRevoking(null);
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <KeyRound size={16} style={{ color: '#818CF8' }} />
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-white">API Keys</h1>
            {isDemo && <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', color: '#F59E0B', borderRadius: 999, padding: '2px 8px' }}>DEMO</span>}
          </div>
          <p style={{ color: '#9CA3AF', fontSize: 14, margin: 0 }}>Manage API keys for accessing the WHY Engine proxy.</p>
        </motion.div>

        {/* Create form */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08, duration: 0.35 }}
          style={{ background: 'rgba(17,24,39,0.8)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: '1.25rem 1.5rem' }}
        >
          <p style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Create new key</p>
          <div style={{ display: 'flex', gap: 10 }}>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              placeholder="Key name (e.g. Production Pipeline)"
              style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '9px 14px', fontSize: 13, color: '#F9FAFB', outline: 'none' }}
            />
            <button
              onClick={handleCreate}
              disabled={isCreating || !name.trim()}
              style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', border: 'none', borderRadius: 10, padding: '9px 18px', fontSize: 13, fontWeight: 700, color: '#fff', cursor: isCreating || !name.trim() ? 'not-allowed' : 'pointer', opacity: !name.trim() ? 0.5 : 1, display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}
            >
              {isCreating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              Create Key
            </button>
          </div>
        </motion.div>

        {/* New key reveal */}
        <AnimatePresence>
          {newKey && (
            <NewKeyReveal key="reveal" rawKey={newKey} onDismiss={() => setNewKey(null)} />
          )}
        </AnimatePresence>

        {/* Key list */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14, duration: 0.35 }}
          style={{ background: 'rgba(17,24,39,0.8)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: '1.25rem 1.5rem' }}
        >
          <p style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>
            Active Keys ({keys.length})
          </p>

          {isLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', gap: 10, color: '#6B7280', fontSize: 13 }}>
              <Loader2 size={16} className="animate-spin" /> Loading keys…
            </div>
          ) : keys.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#6B7280', fontSize: 13 }}>
              No active keys. Create one above.
            </div>
          ) : (
            <AnimatePresence>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {keys.map((key, i) => (
                  <motion.div
                    key={key.id}
                    layout
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 16, height: 0, overflow: 'hidden' }}
                    transition={{ delay: i * 0.05, duration: 0.3 }}
                  >
                    <KeyRow k={key} onRevoke={handleRevoke} isRevoking={revokingId === key.id} />
                  </motion.div>
                ))}
              </div>
            </AnimatePresence>
          )}
        </motion.div>
      </div>
    </AppShell>
  );
}
