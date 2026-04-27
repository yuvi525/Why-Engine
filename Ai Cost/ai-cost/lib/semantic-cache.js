import { getSupabase } from "@/lib/db";

/**
 * A. generateEmbedding(text)
 * Calls OpenAI embeddings API and returns the embedding array.
 */
export async function generateEmbedding(text) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return null;

    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        input: text,
        model: "text-embedding-3-small"
      })
    });

    if (!res.ok) {
      console.error("[semantic-cache] Embedding API failed:", await res.text());
      return null;
    }

    const data = await res.json();
    return data.data[0].embedding;
  } catch (err) {
    console.error("[semantic-cache] generateEmbedding exception:", err.message);
    return null; // fail-safe: continue normal flow if embedding fails
  }
}

/**
 * B. cosineSimilarity(a, b)
 * Standard cosine similarity function.
 */
export function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * C. findSimilarPrompt(embedding)
 * Fetch last 50 records from semantic_cache, compute similarity.
 * Threshold = 0.90. Return best match if found.
 */
export async function findSimilarPrompt(embedding) {
  if (!embedding) return null;

  try {
    const sb = getSupabase();
    if (!sb) return null;

    // Fetch the last 50 records from cache
    const { data, error } = await sb
      .from("semantic_cache")
      .select("embedding, response")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("[semantic-cache] Fetch error:", error.message);
      return null;
    }

    if (!data || data.length === 0) return null;

    let bestMatch = null;
    let highestSim = -1;
    const THRESHOLD = 0.90;

    for (const record of data) {
      if (!record.embedding) continue;
      
      // Parse embedding if stored as a stringified JSON array
      let dbEmbedding = record.embedding;
      if (typeof dbEmbedding === "string") {
        try {
          dbEmbedding = JSON.parse(dbEmbedding);
        } catch (e) {
          continue; // skip malformed
        }
      }

      const sim = cosineSimilarity(embedding, dbEmbedding);
      if (sim > highestSim && sim >= THRESHOLD) {
        highestSim = sim;
        bestMatch = record.response;
      }
    }

    return bestMatch;
  } catch (err) {
    console.error("[semantic-cache] findSimilarPrompt exception:", err.message);
    return null;
  }
}

/**
 * D. saveToCache(data)
 * Inserts the embedding and the response into semantic_cache.
 */
export async function saveToCache({ embedding, response }) {
  if (!embedding || !response) return;

  try {
    const sb = getSupabase();
    if (!sb) return;

    const { error } = await sb.from("semantic_cache").insert([{
      embedding: JSON.stringify(embedding), // Storing as JSON string for fallback compatibility
      response: response, // Storing full response object
      created_at: new Date().toISOString()
    }]);

    if (error) {
      console.error("[semantic-cache] Insert error:", error.message);
    }
  } catch (err) {
    console.error("[semantic-cache] saveToCache exception:", err.message);
  }
}
