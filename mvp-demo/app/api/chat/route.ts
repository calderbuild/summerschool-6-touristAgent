import { ROUTES } from "@/lib/data";

// DeepSeek key is server-side only; the browser never sees it.
export const runtime = "nodejs";
export const maxDuration = 60;

type ChatMessage = { role: "user" | "assistant"; content: string };

function routeCatalogue(): string {
  return ROUTES.map((r) => {
    const legs = r.nodes
      .map((n) => {
        const bits: string[] = [n.name, `access:${n.at}`];
        if (n.steps === null) bits.push("steps:unknown");
        else if (typeof n.steps === "number" && n.steps > 0) bits.push(`steps:${n.steps}`);
        if (n.barrier) bits.push(`barrier:"${n.barrier.en}"`);
        if (n.alt) bits.push(`step-free-alt:"${n.alt.en}"`);
        return "    - " + bits.join(", ");
      })
      .join("\n");
    return `  id "${r.id}": ${r.from} -> ${r.to}\n${legs}`;
  }).join("\n");
}

function systemPrompt(): string {
  return `You are Voie Libre, a Paris step-free travel assistant. You help travellers who cannot take stairs (wheelchair users, people with strollers, older or low-energy travellers) get across Paris.

Facts you must respect:
- Only Metro Line 14 is fully step-free. About 30 of 300+ stations have a working lift.
- When accessibility data is unknown, say "unknown". Never invent a step count, a lift status, or a route. An honest gap is more useful than a wrong figure.
- When a lift is out of service, always offer the step-free alternative (a level-boarding bus, another line, or a different station).

You have these prepared routes with verified demo data:
${routeCatalogue()}

When the traveller's need matches one of these routes, put the marker [[route:<id>]] on its own line in your reply (for example [[route:gdl-eiffel]]). The app renders that route as a visual card with the step-by-step accessibility spine and a map, so you do not need to repeat every leg in prose. Briefly explain why you chose it and call out the main barrier and the step-free alternative.

If the request does not match a prepared route, answer helpfully in the same spirit (step-free thinking, honest about unknowns) without inventing specific station data.

Reply in the same language the traveller writes in (English, French, or Chinese). Be concise, warm, and practical. Do not use emojis.`;
}

export async function POST(req: Request) {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) {
    return new Response(JSON.stringify({ error: "DEEPSEEK_API_KEY not set" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  let messages: ChatMessage[];
  try {
    const body = await req.json();
    messages = Array.isArray(body.messages) ? body.messages : [];
  } catch {
    return new Response(JSON.stringify({ error: "bad request" }), { status: 400 });
  }

  const upstream = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: "deepseek-reasoner",
      stream: true,
      messages: [
        { role: "system", content: systemPrompt() },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ],
    }),
  });

  if (!upstream.ok || !upstream.body) {
    return new Response(
      JSON.stringify({ error: `upstream ${upstream.status}` }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const send = (obj: unknown) => encoder.encode(JSON.stringify(obj) + "\n");

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = upstream.body!.getReader();
      let buffer = "";
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            const t = line.trim();
            if (!t.startsWith("data:")) continue;
            const payload = t.slice(5).trim();
            if (payload === "[DONE]") continue;
            try {
              const json = JSON.parse(payload);
              const delta = json.choices?.[0]?.delta ?? {};
              if (delta.reasoning_content) {
                controller.enqueue(send({ type: "reasoning", text: delta.reasoning_content }));
              }
              if (delta.content) {
                controller.enqueue(send({ type: "content", text: delta.content }));
              }
            } catch {
              // ignore malformed keep-alive lines
            }
          }
        }
      } catch {
        controller.enqueue(send({ type: "error", text: "stream interrupted" }));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
