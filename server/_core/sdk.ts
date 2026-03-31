import { ForbiddenError } from "../../shared/_core/errors.js";
import type { User } from "../../drizzle/schema.js";
import * as db from "../db.js";
import { COOKIE_NAME } from "../../shared/const.js";
import { jwtVerify } from "jose";
import { ENV } from "./env.js";
import { supabase } from "./supabase.js";

const rawJwtSecret = (ENV.cookieSecret || "").trim();
const JWT_SECRET = rawJwtSecret.length >= 32 ? new TextEncoder().encode(rawJwtSecret) : null;

class SDKServer {
  async authenticateRequest(req: any): Promise<User> {
    const token = req.cookies?.[COOKIE_NAME];
    
    if (token) {
      // 1. TENTATIVA PRIMÁRIA: Supabase Auth Service (Fonte da Verdade)
      // O SDK lida corretamente com HS256 usando o JWT_SECRET configurado internamente.
      const { data: { user: sbUser }, error: sbError } = await supabase.auth.getUser(token);

      if (!sbError && sbUser) {
        const email = sbUser.email;
        const username = sbUser.user_metadata?.username || email?.split('@')[0];
        
        if (username) {
          const user = await db.getUserByUsername(username);
          if (user) {
            console.log(`[Auth] User authenticated via Supabase: ${user.username}`);
            return user;
          }
        }
      }

      // 2. FALLBACK: Verificação Manual (Para usuários antigos ou tokens internos)
      if (JWT_SECRET) {
        try {
          const { payload } = await jwtVerify(token, JWT_SECRET);
          const sub = payload.sub;
          
          if (sub) {
            let user: User | null = null;
            if (/^\d+$/.test(sub)) {
              user = await db.getUserById(parseInt(sub));
            } else {
              const username = payload.user_metadata?.username || (payload.email as string)?.split('@')[0];
              if (username) user = await db.getUserByUsername(username);
            }

            if (user) {
              console.log(`[Auth] User authenticated via Manual JWT: ${user.username}`);
              return user;
            }
          }
        } catch (manualError) {
          // Apenas loga aviso, pois o erro final será lançado no final da função
          console.warn("[Auth] Manual JWT fallback failed or expired");
        }
      }

      if (sbError) {
        console.error("[Auth] Supabase verification error:", sbError.message);
      }
    }

    throw ForbiddenError("Invalid session");
  }
}

export const sdk = new SDKServer();
