import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema.js";
import { sdk } from "./sdk.js";

export type TrpcContext = {
  req: any;
  res: any;
  user: User | null;
};

export async function createContext(
  opts: any
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error: any) {
    // A autenticação é opcional para procedimentos públicos.
    // Silencia erros de "sessão inválida" para evitar spam nos logs, 
    // mas loga erros críticos (como falha na conexão com o banco).
    if (error?.message !== "Invalid session") {
      console.error("[Context] Unexpected Auth Error:", error);
    }
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
