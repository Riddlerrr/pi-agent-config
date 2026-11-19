import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { parseEnv } from "node:util";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const provider = "openai-codex";
const lanes = {
  fast: { id: "gpt-6-luna", thinkingLevel: "low" },
  normal: { id: "gpt-6.2-sol", thinkingLevel: "xhigh" },
  deep: { id: "gpt-6.2-astra", thinkingLevel: "high" },
} as const;

// Local fallback when the homelab classifier can't decide.
const rules: [RegExp, keyof typeof lanes, string][] = [
  [/\b(architecture|trade-?offs?|root cause|deadlock|diagnose)\b/i, "deep", "design or diagnosis"],
  [/^(summari[sz]e|translate|rephrase|define)\b/i, "fast", "text task"],
];

async function classify(text: string, token: string, signal?: AbortSignal) {
  const body = { state: text.slice(0, 4000), questions: { lane: {
    type: "choice", instructions: "Which lane fits the requested work?", criteria: {
      fast: "Simple lookup, translation, summary, or rewrite.",
      normal: "Routine implementation, fixes, reviews, or explanations.",
      deep: "Hard diagnosis, architectural trade-offs, or cross-cutting design.",
    },
  } } };
  const timeout = AbortSignal.timeout(2500);
  const response = await fetch("https://decide.test/v1/systemone", {
    method: "POST", redirect: "error",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
    body: JSON.stringify(body), signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  });
  if (!response.ok) {
    await response.body?.cancel();
    return undefined;
  }
  return (await response.json()).answers?.lane?.choice;
}

async function choose(text: string, signal?: AbortSignal) {
  text = text.trim();
  const prefix = /^(fast|deep):/i.exec(text)?.[1].toLowerCase();
  if (prefix === "fast" || prefix === "deep") return { ...lanes[prefix], why: prefix + ": override" };

  signal?.throwIfAborted();
  let token = process.env.HINDSIGHT_API_DECISION_MODEL_API_KEY?.trim();
  if (text) {
    try {
      if (!token) {
        const file = await readFile(join(homedir(), ".pi", "agent", "hindsight.env"), "utf8");
        token = parseEnv(file).HINDSIGHT_API_DECISION_MODEL_API_KEY?.trim();
      }
      const lane = token && await classify(text, token, signal);
      if (lane === "fast" || lane === "normal" || lane === "deep") {
        return { ...lanes[lane], why: "hs-decide-1-flash: " + lane };
      }
    } catch {
      signal?.throwIfAborted(); // An outage falls back, but a cancelled turn stays cancelled.
    }
  }
  const rule = rules.find(([pattern]) => pattern.test(text));
  return { ...lanes[rule?.[1] ?? "normal"], why: "local fallback: " + (rule?.[2] ?? "default") + (token ? "" : " (no decision token)") };
}

export default function (pi: ExtensionAPI) {
  pi.registerCommand("route-test", {
    description: "Preview a routing decision (sends prompt text to decide.test unless overridden): /route-test <prompt>",
    async handler(args, ctx) {
      if (!args.trim()) return ctx.ui.notify("Try /route-test Diagnose this timeout", "info");
      const { id, thinkingLevel, why } = await choose(args, ctx.signal);
      ctx.ui.notify(`${why} → ${id} · ${thinkingLevel}`, "info");
    },
  });

  pi.registerVirtualModel({
    provider, id: "smart", name: "Smart (Hindsight + rules)",
    async route(request, ctx) {
      const sticky = request.reason === "retry" ? request.failed : request.previous;
      if ((request.reason === "continuation" || request.reason === "retry") && sticky) {
        return { model: sticky.model, thinkingLevel: sticky.thinkingLevel ?? "medium" };
      }
      const content = request.messages.findLast(m => m.role === "user")?.content ?? "";
      const text = typeof content === "string" ? content : content.flatMap(b => b.type === "text" ? [b.text] : []).join("\n");
      const { id, thinkingLevel } = request.reason === "user" ? await choose(text, request.signal) : lanes.normal;
      const model = ctx.modelRegistry.find(provider, id);
      if (!model) throw new Error(`Smart router: missing ${provider}/${id}; update lanes in smart-router/index.ts`);
      return { model, thinkingLevel };
    },
  });
}
