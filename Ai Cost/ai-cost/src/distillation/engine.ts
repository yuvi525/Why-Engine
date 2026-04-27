// @ts-ignore
import { getSupabase } from '@/src/lib/db';

export async function trackDistillationCandidate(promptHash: string, promptText: string, responseText: string) {
  const sb = getSupabase();
  if (!sb) return;

  // Threshold: If an exact prompt pattern is executed 500+ times, it is a perfect candidate to distill
  // away from GPT-4 and fine-tune into a custom Llama 3 8B model.
  const threshold = 500;
  const currentCount = 501; // Mock frequency count

  if (currentCount > threshold) {
    await sb.from('distillation_candidates').upsert([{
      prompt_hash: promptHash,
      example_prompt: promptText,
      example_response: responseText,
      frequency_count: currentCount
    }]);
  }
}
