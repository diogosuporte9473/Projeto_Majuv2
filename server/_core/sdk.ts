import { ForbiddenError } from "../../shared/_core/errors.js";
import type { User } from "../../drizzle/schema.js";
import * as db from "../db.js";
import { COOKIE_NAME } from "../../shared/const.js";
import { jwtVerify, createRemoteJWKSet } from "jose";
import { ENV } from "./env.js";

const rawJwtSecret = (ENV.cookieSecret || "").trim();
const JWT_SECRET = rawJwtSecret.length >= 32 ? new TextEncoder().encode(rawJwtSecret) : null;
const JWKS = createRemoteJWKSet(new URL(ENV.supabaseJwksUrl));

class SDKServer {
  async authenticateRequest(req: any): Promise<User> {
    // 1. Try Cookie Auth (JWT)
    const token = req.cookies?.[COOKIE_NAME];
    
    if (token) {
      let payload: any = null;
      let error: any = null;

      // 1.1 Tenta verificar como token do Supabase (JWKS)
      try {
        const result = await jwtVerify(token, JWKS);
        payload = result.payload;
      } catch (e) {
        error = e;
      }

      // 1.2 Se falhar e tivermos uma chave interna, tenta verificar como token interno (HS256)
      if (!payload && JWT_SECRET) {
        try {
          const result = await jwtVerify(token, JWT_SECRET);
          payload = result.payload;
          error = null; // Limpa erro anterior se funcionar com a chave interna
        } catch (e) {
          error = e;
        }
      }

      if (payload) {
        // 2. Identificar o usuário
        // Se for token do Supabase, o 'sub' é um UUID. Se for interno, é o ID (int).
        const sub = payload.sub;
        let user: User | null = null;

        if (sub) {
          if (/^\d+$/.test(sub)) {
            // ID numérico (token interno)
            user = await db.getUserById(parseInt(sub));
          } else {
            // UUID ou string (token do Supabase)
            // Tenta buscar por email ou username que venha no token
            const email = payload.email;
            const username = payload.user_metadata?.username || email?.split('@')[0];
            
            if (username) {
              user = await db.getUserByUsername(username);
            }
          }
        }

        if (user) {
          return user;
        }
      }

      if (error) {
        if (error.code === "ERR_JWT_EXPIRED" || error.code === "ERR_JWS_INVALID" || error.code === "ERR_JWT_CLAIM_INVALID") {
          console.warn("[Auth] Invalid, expired or claim-mismatched JWT token");
        } else {
          console.error("[Auth] JWT verification error:", error);
          throw error;
        }
      }
    }

    throw ForbiddenError("Invalid session");
  }
}

export const sdk = new SDKServer();
