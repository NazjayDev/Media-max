import { GoogleGenAI } from "@google/genai";
import { cached } from "@/lib/cache";

export const EMBED_MODEL = "gemini-embedding-001";
const EMBED_DIMENSIONS = 768;

const EMBED_CACHE_TTL_SECONDS = 30 * 24 * 60 * 60;

/** Embeds a search query (vibe text or a title description) for catalog retrieval. */
export async function embedQuery(text: string): Promise<number[]> {
  const normalized = text.toLowerCase().replace(/\s+/g, " ").trim();
  return cached(`embed:${normalized}`, EMBED_CACHE_TTL_SECONDS, async () => {
    const ai = new GoogleGenAI({});
    const res = await ai.models.embedContent({
      model: EMBED_MODEL,
      contents: [text],
      config: { taskType: "RETRIEVAL_QUERY", outputDimensionality: EMBED_DIMENSIONS },
    });
    const values = res.embeddings?.[0]?.values;
    if (!values || values.length !== EMBED_DIMENSIONS) {
      throw new Error("Embedding response was empty");
    }
    return values;
  });
}
