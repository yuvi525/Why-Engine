"use client";

import { useState } from "react";
import { Send, Loader2 } from "lucide-react";

export function PromptInput({
  onSubmit,
  isLoading,
}: {
  onSubmit: (prompt: string, model: string) => void;
  isLoading: boolean;
}) {
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState("auto");

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <select
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className="bg-[#1F2937] border border-[#374151] text-[#F9FAFB] text-sm rounded-lg focus:ring-[#6366F1] focus:border-[#6366F1] block w-48 p-2.5 outline-none"
        >
          <option value="auto">Auto-Route (Best Value)</option>
          <option value="gpt-4o">GPT-4o</option>
          <option value="claude-3-5-sonnet-20240620">Claude 3.5 Sonnet</option>
          <option value="gpt-4o-mini">GPT-4o-mini</option>
        </select>
      </div>
      <div className="relative">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (prompt.trim() && !isLoading) onSubmit(prompt, model);
            }
          }}
          placeholder="Enter your prompt here... (Press Enter to send)"
          className="w-full h-32 bg-[#111827]/80 backdrop-blur-[12px] border border-[rgba(255,255,255,0.08)] rounded-xl p-4 text-[#F9FAFB] placeholder-[#6B7280] focus:ring-1 focus:ring-[#6366F1] focus:border-[#6366F1] outline-none resize-none transition-all"
        />
        <button
          onClick={() => {
            if (prompt.trim() && !isLoading) onSubmit(prompt, model);
          }}
          disabled={isLoading || !prompt.trim()}
          className="absolute bottom-4 right-4 bg-[#6366F1] hover:bg-[#4F46E5] disabled:opacity-50 disabled:hover:bg-[#6366F1] text-white p-2 rounded-lg transition-colors flex items-center justify-center"
        >
          {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
        </button>
      </div>
    </div>
  );
}
