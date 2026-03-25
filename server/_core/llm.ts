import { ENV } from "./env.js";

export type Role = "system" | "user" | "assistant" | "tool" | "function";

export type Message = {
  role: Role;
  content: string;
};

export interface LLMOptions {
  messages: Message[];
  temperature?: number;
  max_tokens?: number;
}

// Fallback robusto para múltiplas chaves de API
const getApiKey = () => {
  return (
    process.env.BUILT_IN_FORGE_API_KEY || 
    process.env.VITE_OPENAI_API_KEY || 
    process.env.OPENAI_API_KEY ||
    process.env.GROQ_API_KEY ||
    process.env.OPENROUTER_API_KEY ||
    "sk-or-v1-free-model-placeholder"
  );
};

const getApiUrl = () => {
  if (process.env.GROQ_API_KEY) return "https://api.groq.com/openai/v1/chat/completions";
  if (process.env.OPENROUTER_API_KEY) return "https://openrouter.ai/api/v1/chat/completions";
  if (!process.env.BUILT_IN_FORGE_API_KEY && !process.env.VITE_OPENAI_API_KEY && !process.env.OPENAI_API_KEY) {
    return "https://openrouter.ai/api/v1/chat/completions";
  }
  return process.env.BUILT_IN_FORGE_API_URL || "https://api.openai.com/v1/chat/completions";
};

export async function invokeLLM(options: LLMOptions) {
  const apiKey = getApiKey();
  const apiUrl = getApiUrl();

  // Se não houver chave real e for o placeholder, o router usará o manual local
  if (apiKey === "sk-or-v1-free-model-placeholder" && !process.env.OPENROUTER_API_KEY) {
    throw new Error("NO_API_KEY");
  }

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": "https://maju-tasks.vercel.app",
      "X-Title": "Maju Task Manager",
    },
    body: JSON.stringify({
      model: apiUrl.includes("openrouter") 
        ? "google/gemini-2.0-flash-lite-preview-02-05:free" 
        : (process.env.GROQ_API_KEY ? "mixtral-8x7b-32768" : "gpt-3.5-turbo"),
      messages: options.messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.max_tokens ?? 1000,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Erro na API de IA: ${JSON.stringify(error)}`);
  }

  return await response.json();
}
