import { GoogleGenAI } from "@google/genai";

const DO_PREFIX = "do:";
const DO_ENDPOINT = "https://inference.do-ai.run/v1/chat/completions";
const HEDGE_AFTER_MS = 4000;
const DEFAULT_TIMEOUT_MS = 12000;

// Each Gemini model has its own free-tier daily quota, so a quota error falls through to the next.
// DigitalOcean Gradient is paid per token but has no daily cap; it only joins when a key exists.
function modelChain(): string[] {
  const chain = ["gemini-flash-lite-latest", "gemini-3-flash-preview"];
  if (process.env.DO_INFERENCE_KEY) {
    chain.push(`${DO_PREFIX}${process.env.DO_INFERENCE_MODEL || "llama3.3-70b-instruct"}`);
  }
  chain.push("gemma-4-26b-a4b-it", "gemini-flash-latest");
  return chain;
}

interface JsonRequest<T> {
  system: string;
  contents: string;
  /** Gemini responseJsonSchema for the JSON object to return. */
  schema: unknown;
  /** Plain-English description of the JSON shape, for models that only support "JSON mode". */
  shape: string;
  /** Validates and narrows the parsed JSON. Throwing makes the chain move to the next model. */
  parse: (parsed: unknown) => T;
  timeoutMs?: number;
}

/**
 * Asks an LLM for a JSON object, trying a chain of models. The next model starts as soon as one
 * fails or takes too long, and the first valid answer wins.
 */
export function generateJsonObject<T>(request: JsonRequest<T>): Promise<T> {
  const timeout = request.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const ai = new GoogleGenAI({});
  const models = modelChain();

  const callGemini = async (model: string): Promise<unknown> => {
    const response = await ai.models.generateContent({
      model,
      contents: request.contents,
      config: {
        systemInstruction: request.system,
        responseMimeType: "application/json",
        responseJsonSchema: request.schema,
        // Only gemini-flash-latest thinks by default; other models reject an explicit thinking config.
        ...(model === "gemini-flash-latest" ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
        httpOptions: { timeout },
      },
    });
    return JSON.parse(response.text ?? "{}");
  };

  const callGradient = async (model: string): Promise<unknown> => {
    const res = await fetch(DO_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.DO_INFERENCE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.3,
        max_tokens: 1800,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `${request.system}\nRespond with only a JSON object: ${request.shape}`,
          },
          { role: "user", content: request.contents },
        ],
      }),
      signal: AbortSignal.timeout(timeout),
    });
    if (!res.ok) {
      throw new Error(`DigitalOcean inference ${res.status}: ${(await res.text()).slice(0, 160)}`);
    }
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return JSON.parse(data.choices?.[0]?.message?.content ?? "{}");
  };

  const attempt = async (model: string): Promise<T> =>
    request.parse(
      model.startsWith(DO_PREFIX)
        ? await callGradient(model.slice(DO_PREFIX.length))
        : await callGemini(model),
    );

  return new Promise<T>((resolve, reject) => {
    const failures: unknown[] = [];
    let settled = false;
    let started = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const startNext = () => {
      if (settled || started >= models.length) return;
      const model = models[started++];
      timer = setTimeout(startNext, HEDGE_AFTER_MS);
      attempt(model).then(
        (result) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          resolve(result);
        },
        (error) => {
          failures.push(error);
          if (settled) return;
          clearTimeout(timer);
          if (failures.length === models.length) {
            settled = true;
            reject(failures[0]);
          } else {
            startNext();
          }
        },
      );
    };

    startNext();
  });
}
