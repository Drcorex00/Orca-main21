import { createFileRoute } from "@tanstack/react-router";
import { streamText } from "ai";

const SYSTEM_PROMPT = `You are ORCA (Marine EcOsystem Reasoning with Collaborative Agents), a marine intelligence assistant for fishermen, researchers, coastal authorities and disaster-management teams.

You are given a LIVE DATA block with real observations/forecasts fetched moments ago from Open-Meteo Marine, Open-Meteo Forecast, Open-Meteo Air Quality and OpenStreetMap Nominatim. Ground every number you state in that block; never invent readings. If the block has no data, say so plainly and ask for a location.

Language:
- ALWAYS reply in the LANGUAGE the user wrote in, written in that language's own native script. Hindi question -> Hindi answer in Devanagari. Marathi -> Marathi. Tamil -> Tamil. Telugu, Malayalam, Kannada, Bengali, Gujarati, Odia, Konkani likewise.
- IMPORTANT: if the user types an Indian language using Latin/English letters (Hinglish/romanised, e.g. "kal samundar safe hai kya", "kadal safe irukka", "machli kahan milegi"), that is NOT an English question. Detect the underlying language and answer in that language's native script (Hindi -> Devanagari, Tamil -> Tamil script, etc.). Do NOT answer in English and do NOT answer in romanised letters. Only a genuinely English question gets an English answer.
- If the user mixes languages, follow the language of most of their message. If they switch language mid-conversation, switch with them.
- Translate the table headings, parameter names and safety wording too; keep units (m, °C, km/h) and place names as-is. Never apologise for the language or mention translation.

Style:
- Answer in concise Markdown.
- ALWAYS present current observations/readings as a Markdown table with two columns: | Parameter | Reading |. Include units in the Reading (e.g. "1.04 m", "29.6 °C", "246° (WSW)"). Never list readings as plain text or bullet points — always a table.
- Lead with the direct answer (e.g. "Yes — conditions are safe until ~18:00"), then the table.
- Include a short safety line when waves >= 2.5 m, wind >= 35 km/h, or gusts >= 50 km/h.
- Mention that PFZ bulletins for Indian waters come from INCOIS when fishing zones are asked about.
- Never claim to be an official forecast authority; advise monitoring VHF Ch.16 for emergencies.`;

/** Chat brains, in the order they are tried. Whichever key exists is used. */
type Brain = { label: string; build: () => Promise<any> };

async function availableBrains(): Promise<Brain[]> {
  const brains: Brain[] = [];
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const openaiKey = process.env["OPENAI_API_KEY"];
  const geminiKey = process.env["GEMINI_API_KEY"] ?? process.env["GOOGLE_API_KEY"];

  if (lovableKey) {
    brains.push({
      label: "lovable",
      build: async () => {
        const { createLovableAiGatewayProvider } = await import("@/lib/ai-gateway.server");
        return createLovableAiGatewayProvider(lovableKey)("google/gemini-3.7-flash");
      },
    });
  }

  if (openaiKey) {
    brains.push({
      label: "openai",
      build: async () => {
        const { createOpenAICompatible } = await import("@ai-sdk/openai-compatible");
        return createOpenAICompatible({
          name: "openai",
          baseURL: "https://api.openai.com/v1",
          headers: { Authorization: `Bearer ${openaiKey}` },
        })(process.env["OPENAI_MODEL"] ?? "gpt-4o-mini");
      },
    });
  }

  if (geminiKey) {
    brains.push({
      label: "gemini",
      build: async () => {
        const { createOpenAICompatible } = await import("@ai-sdk/openai-compatible");
        return createOpenAICompatible({
          name: "gemini",
          baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
          headers: { Authorization: `Bearer ${geminiKey}` },
        })(process.env["GEMINI_MODEL"] ?? "gemini-3.6-flash");
      },
    });
  }

  return brains;
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const brains = await availableBrains();
        if (brains.length === 0) {
          return new Response(
            JSON.stringify({
              error:
                "AI is not configured. Add LOVABLE_API_KEY, OPENAI_API_KEY or GEMINI_API_KEY.",
            }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }

        let body: any;
        try {
          body = await request.json();
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const messages = Array.isArray(body?.messages) ? body.messages : [];
        const context = body?.context ?? null;

        const liveData = context
          ? `LIVE DATA (fetched ${context.fetchedAt ?? "now"}):\n${JSON.stringify(context, null, 1)}`
          : "LIVE DATA: none available (no location resolved from the user's question).";

        const chatMessages = messages.slice(-12).map((m: any) => ({
          role: m.role === "assistant" ? "assistant" : ("user" as const),
          content: String(m.content ?? ""),
        }));

        let lastError: unknown = null;

        for (const brain of brains) {
          try {
            const model = await brain.build();
            const result = streamText({
              model,
              system: `${SYSTEM_PROMPT}\n\n${liveData}`,
              messages: chatMessages,
            });

            const text = await result.text;
            if (!text.trim()) throw new Error("AI provider returned an empty response");
            return new Response(text, {
              headers: {
                "Content-Type": "text/plain; charset=utf-8",
                "Cache-Control": "no-store",
                "X-Orca-Brain": brain.label,
              },
            });
          } catch (error) {
            lastError = error;
            console.error(`[orca] chat brain "${brain.label}" failed`, error);
            // try the next configured brain
          }
        }

        const status = (lastError as any)?.statusCode ?? (lastError as any)?.status ?? 500;
        const message =
          status === 429
            ? "ORCA is rate limited right now. Please retry in a moment."
            : status === 402
              ? "AI credits are exhausted. Add credits, or set OPENAI_API_KEY / GEMINI_API_KEY as a fallback."
              : "The AI service returned an error.";
        return new Response(JSON.stringify({ error: message }), {
          status,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
