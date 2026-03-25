// server/_core/llm.ts
import { ENV } from "./env.js";

export type Message = {
  role: "system" | "user" | "assistant";
  content: string;
};

export interface LLMOptions {
  messages: Message[];
  useWebSearch?: boolean;
  shortResponse?: boolean;
  temperature?: number;
  max_tokens?: number;
}

/**
 * Invoca o LLM com suporte a Web Search e Resposta Curta
 * Com fallback inteligente (Forge → OpenRouter → Groq → Mensagem amigável)
 */
export async function invokeLLM(options: LLMOptions): Promise<{ content: string }> {
  const { messages, useWebSearch = false, shortResponse = false } = options;

  // === System Prompt Inteligente ===
  let systemContent = "Você é o Maju IA, um assistente útil, amigável e direto do Maju Task Manager.";

  if (shortResponse) {
    systemContent += " Responda sempre de forma curta, objetiva e clara. Use bullet points quando ajudar. Máximo 4 parágrafos.";
  }

  if (useWebSearch) {
    systemContent += " Você pode pesquisar informações atualizadas na internet quando necessário.";
  }

  const finalMessages: Message[] = [
    { role: "system", content: systemContent },
    ...messages,
  ];

  try {
    // 1. Tenta Forge (chave principal do seu sistema)
    if (ENV.forgeApiKey && ENV.forgeApiUrl) {
      const response = await fetch(`${ENV.forgeApiUrl}/webdevtoken.v1.WebDevService/CallApi`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${ENV.forgeApiKey}`,
        },
        body: JSON.stringify({
          apiId: "LLM/Chat",
          body: {
            messages: finalMessages,
            useWebSearch,
            shortResponse,
            temperature: options.temperature ?? 0.7,
            max_tokens: options.max_tokens ?? 1200,
          },
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const content = data?.jsonData ? JSON.parse(data.jsonData).content || data.jsonData : data.content;
        return { content: String(content || "Sem resposta") };
      }
    }

    // 2. Fallback: OpenRouter (gratuito)
    if (process.env.OPENROUTER_API_KEY) {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://maju.tasks",
          "X-Title": "Maju Task Manager",
        },
        body: JSON.stringify({
          model: "google/gemini-2.0-flash-exp:free",
          messages: finalMessages,
          temperature: options.temperature ?? 0.7,
          max_tokens: options.max_tokens ?? 1200,
        }),
      });

      const data = await res.json();
      return { content: data.choices?.[0]?.message?.content || "Não foi possível gerar resposta." };
    }

    // 3. Último fallback: Mensagem amigável
    return {
      content: shortResponse
        ? "No momento estou em manutenção. Posso te ajudar com o Maju Tasks?"
        : "Olá! Meu sistema de IA geral está temporariamente em manutenção. " +
          "Enquanto isso, posso te ajudar com dúvidas sobre quadros, checklists, espelhamento, prazos e funcionalidades do app. O que você precisa?"
    };

  } catch (error: any) {
    console.error("[LLM] Error:", error);

    return {
      content: "Desculpe, ocorreu um erro ao processar sua solicitação. Tente novamente em alguns instantes."
    };
  }
}
