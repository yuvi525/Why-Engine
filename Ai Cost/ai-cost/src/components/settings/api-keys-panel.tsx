"use client";

import { useState } from "react";
import { GlassCard } from "../ui/glass-card";
import { Badge } from "../ui/badge";
import { Key, Plus, Trash2, Copy, Check } from "lucide-react";
import { apiClient } from "@/src/lib/api-client";
import { motion, AnimatePresence } from "framer-motion";

export function ApiKeysPanel({ initialKeys, addToast }: { initialKeys: any[], addToast: (msg: string, type: "success"|"error") => void }) {
  const [keys, setKeys] = useState(initialKeys);
  const [showModal, setShowModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCreate = async () => {
    if (!newKeyName.trim()) return;
    setIsSubmitting(true);
    try {
      const data = await apiClient<any>("/keys", {
        method: "POST",
        body: JSON.stringify({ name: newKeyName })
      });
      setGeneratedKey(data.raw_key);
      setKeys(prev => [data, ...prev]);
      addToast("API Key created successfully", "success");
    } catch (err: any) {
      addToast(err.message, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevoke = async (id: string) => {
    if (!confirm("Are you sure you want to revoke this key? This action cannot be undone.")) return;
    try {
      await apiClient(`/keys/${id}`, { method: "DELETE" });
      setKeys(prev => prev.filter(k => k.id !== id));
      addToast("Key revoked", "success");
    } catch (err: any) {
      addToast(err.message, "error");
    }
  };

  const handleCopy = () => {
    if (generatedKey) {
      navigator.clipboard.writeText(generatedKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const closeAndReset = () => {
    setShowModal(false);
    setGeneratedKey(null);
    setNewKeyName("");
  };

  return (
    <GlassCard>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-medium text-[#F9FAFB]">API Keys</h3>
          <p className="text-sm text-[#9CA3AF]">Manage your API keys for proxy authentication.</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-[#6366F1] hover:bg-[#4F46E5] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" /> Create Key
        </button>
      </div>

      <div className="space-y-3">
        <AnimatePresence>
          {keys.map(k => (
            <motion.div
              key={k.id}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-center justify-between p-4 rounded-lg border border-[#1F2937] bg-[#111827]/50"
            >
              <div>
                <div className="flex items-center gap-3">
                  <span className="font-medium text-[#F9FAFB]">{k.name}</span>
                  <Badge variant={k.is_active ? "success" : "neutral"}>
                    {k.is_active ? "Active" : "Revoked"}
                  </Badge>
                </div>
                <div className="flex items-center gap-4 mt-2 text-xs text-[#9CA3AF] font-mono">
                  <span className="flex items-center gap-1"><Key className="w-3 h-3"/> {k.prefix}••••••••••••</span>
                  <span>Created: {new Date(k.created_at).toLocaleDateString()}</span>
                </div>
              </div>
              <button
                onClick={() => handleRevoke(k.id)}
                className="p-2 text-[#9CA3AF] hover:text-[#F43F5E] hover:bg-[#F43F5E]/10 rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#111827] border border-[#1F2937] rounded-xl p-6 w-full max-w-md shadow-2xl"
          >
            {generatedKey ? (
              <div>
                <h3 className="text-xl font-bold text-white mb-2">Save your new key</h3>
                <p className="text-sm text-[#F59E0B] mb-4 bg-[#F59E0B]/10 p-3 rounded-lg border border-[#F59E0B]/20">
                  Please copy this key now. You will not be able to see it again!
                </p>
                <div className="flex items-center gap-2 bg-black border border-[#374151] rounded-lg p-3 mb-6">
                  <code className="text-[#38BDF8] flex-1 break-all text-sm">{generatedKey}</code>
                  <button onClick={handleCopy} className="p-2 text-[#9CA3AF] hover:text-white transition-colors">
                    {copied ? <Check className="w-5 h-5 text-[#10B981]" /> : <Copy className="w-5 h-5" />}
                  </button>
                </div>
                <button
                  onClick={closeAndReset}
                  className="w-full bg-[#374151] hover:bg-[#4B5563] text-white py-2 rounded-lg font-medium transition-colors"
                >
                  I have saved my key
                </button>
              </div>
            ) : (
              <div>
                <h3 className="text-xl font-bold text-white mb-4">Create New API Key</h3>
                <label className="block text-sm text-[#9CA3AF] mb-2">Key Name</label>
                <input
                  type="text"
                  value={newKeyName}
                  onChange={e => setNewKeyName(e.target.value)}
                  placeholder="e.g. Production Environment"
                  className="w-full bg-black border border-[#374151] rounded-lg p-3 text-white mb-6 focus:ring-1 focus:ring-[#6366F1] outline-none"
                  autoFocus
                />
                <div className="flex items-center gap-3 justify-end">
                  <button onClick={closeAndReset} className="text-[#9CA3AF] hover:text-white px-4 py-2 font-medium">
                    Cancel
                  </button>
                  <button
                    onClick={handleCreate}
                    disabled={isSubmitting || !newKeyName.trim()}
                    className="bg-[#6366F1] hover:bg-[#4F46E5] disabled:opacity-50 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                  >
                    {isSubmitting ? "Creating..." : "Create"}
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </GlassCard>
  );
}
