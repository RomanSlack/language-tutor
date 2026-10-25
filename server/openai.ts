import { OPENAI_API_KEY } from "./config.js";

// Structured-output call to the Responses API. Returns the parsed JSON.
export async function structured<T>(opts: {
  model: string;
  effort: "none" | "low" | "medium";
  system: string;
  user: string;
  name: string;
  schema: object;
}): Promise<T> {
  const r = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: opts.model,
      reasoning: { effort: opts.effort },
      input: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.user },
      ],
      text: { format: { type: "json_schema", name: opts.name, strict: true, schema: opts.schema } },
    }),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error?.message ?? `OpenAI ${r.status}`);
  const text = data.output
    ?.flatMap((o: { content?: { type: string; text: string }[] }) => o.content ?? [])
    .find((c: { type: string }) => c.type === "output_text")?.text;
  if (!text) throw new Error("Empty response from model");
  return JSON.parse(text) as T;
}
