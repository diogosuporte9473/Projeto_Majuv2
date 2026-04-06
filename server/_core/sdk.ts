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
    
    if (!token) {
      throw ForbiddenError("No session token found");
    }

    // 1. TENTATIVA PRIMÁRIA: Supabase Auth Service
    try {
      const { data: { user: sbUser }, error: sbError } = await supabase.auth.getUser(token);

      if (!sbError && sbUser) {
        // 1.1 TENTATIVA POR AUTH_ID (UUID)
        const userByAuthId = await db.getUserByAuthId(sbUser.id);
        if (userByAuthId) {
          console.log(`[Auth] User authenticated via Auth ID: ${userByAuthId.username}`);
          return userByAuthId;
        }

        // 1.2 FALLBACK: Username/Email
        const email = sbUser.email;
        const username = sbUser.user_metadata?.username || email?.split('@')[0];
        if (username) {
          const user = await db.getUserByUsername(username);
          if (user) {
            console.log(`[Auth] User authenticated via Username fallback: ${user.username}`);
            return user;
          }
        }
      }

      if (sbError) {
        console.warn("[Auth] Supabase getUser failed, trying manual fallback:", sbError.message);
      }
    } catch (err) {
      console.warn("[Auth] Supabase getUser exception, trying manual fallback");
    }

    // 2. FALLBACK: Verificação Manual (Importante para tokens Supabase se o client falhar)
    // O JWT_SECRET deve ser o "JWT Secret" encontrado no painel do Supabase.
    if (JWT_SECRET) {
      try {
        const { payload } = await jwtVerify(token, JWT_SECRET);
        const sub = payload.sub; // No Supabase, 'sub' é o UUID do usuário
        
        if (sub) {
          let user: User | null = null;
          
          // Se o sub for um UUID (padrão Supabase)
          if (sub.length > 10) {
            user = await db.getUserByAuthId(sub);
          } 
          
          // Se for um ID numérico (legado/manual)
          if (!user && /^\d+$/.test(sub)) {
            user = await db.getUserById(parseInt(sub));
          }

          if (user) {
            console.log(`[Auth] User authenticated via Manual JWT: ${user.username}`);
            return user;
          }
        }
      } catch (manualError) {
        console.error("[Auth] Manual JWT fallback failed:", (manualError as any).message);
      }
    }

    throw ForbiddenError("Invalid session");
  }
}

export const sdk = new SDKServer();
