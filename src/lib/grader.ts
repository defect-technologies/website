import Groq from "groq-sdk";
import type { ScoringResult } from "@/types";

function getGroq() {
  return new Groq({ apiKey: process.env.GROQ_API_KEY || "" });
}

export async function gradePost(content: string): Promise<ScoringResult> {
  if (!process.env.GROQ_API_KEY) {
    return { score: 50, reasoning: "Scoring not configured (no GROQ_API_KEY)" };
  }

  try {
    const groq = getGroq();
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: `You analyze devlog posts and score them. Return ONLY valid JSON, no other text.`,
        },
        {
          role: "user",
          content: `Analyze this devlog post and score 0-100 on:
1. Insightfulness — does it show learning, problem-solving, or interesting observations?
2. Specificity — concrete details vs vague statements?
3. Authenticity — personal voice and genuine reflection?

Post: "${content}"

Return JSON: {"score": number, "reasoning": string}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 256,
      response_format: { type: "json_object" },
    });

    const text = completion.choices[0]?.message?.content || '{"score": 50, "reasoning": "Unable to analyze"}';
    const result = JSON.parse(text);

    return {
      score: Math.min(100, Math.max(0, Number(result.score) || 50)),
      reasoning: String(result.reasoning || ""),
    };
  } catch {
    return { score: 50, reasoning: "Scoring unavailable" };
  }
}
