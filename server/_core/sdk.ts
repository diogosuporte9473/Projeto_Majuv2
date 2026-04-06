import { ForbiddenError } from "../../shared/_core/errors.js";
import type { User } from "../../drizzle/schema.js";
import * as db from "../db.js";
import { COOKIE_NAME } from "../../shared/const.js";
import { jwtVerify, createRemoteJWKSet, decodeJwt } from "jose";
import { ENV } from "./env.js";
import { supabase } from "./supabase.js";

const rawJwtSecret = (ENV.cookieSecret || "").trim();
const JWKS_URL = ENV.supabaseJwksUrl || `${ENV.supabaseUrl}/auth/v1/.well-known/jwks.json`;

// Cache para o JWKSet remoto para evitar buscas repetitivas por requisição
let remoteJWKSet: any = null;
function getRemoteJWKSet() {
  if (!remoteJWKSet && JWKS_URL) {
    remoteJWKSet = createRemoteJWKSet(new URL(JWKS_URL));
  }
  return remoteJWKSet;
}

class SDKServer {
  private async getVerifyKey(token: string) {
    try {
      const header = decodeJwt(token) as any;
      
      // Se for HS256 (Padrão Supabase local), usamos o segredo do projeto
      if (header?.alg === "HS256") {
        if (!rawJwtSecret) return null;
        return new TextEncoder().encode(rawJwtSecret);
      }
      
      // Se for RS256 ou ES256, usamos o JWKS remoto do Supabase Auth
      if (header?.alg === "RS256" || header?.alg === "ES256") {
        return getRemoteJWKSet();
      }
      
      return null;
    } catch (err) {
      console.error("[Auth] Failed to decode JWT header:", err);
      return null;
    }
  }

  async authenticateRequest(req: any): Promise<User> {
    // 1. Extração do Token (Prioridade: Header Authorization > Cookies)
    let token = "";
    const authHeader = req.headers?.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      token = authHeader.substring(7);
    } else {
      token = req.cookies?.[COOKIE_NAME];
    }
    
    if (!token) {
      console.warn("[Auth] No token found in request headers or cookies");
      throw ForbiddenError("No session token found");
    }

    // 2. TENTATIVA PRIMÁRIA: Supabase Auth Service (getUser)
    try {
      // O supabase.auth.getUser(token) é a forma oficial e mais segura.
      const { data: { user: sbUser }, error: sbError } = await supabase.auth.getUser(token);

      if (!sbError && sbUser) {
        console.log(`[Auth] Supabase getUser success for: ${sbUser.email}`);
        
        // 2.1 Busca o usuário no nosso banco pelo AuthID (UUID)
        const userByAuthId = await db.getUserByAuthId(sbUser.id);
        if (userByAuthId) {
          return userByAuthId;
        }

        // 2.2 Fallback por Username/Email se o vínculo UUID falhar
        const email = sbUser.email;
        const username = sbUser.user_metadata?.username || email?.split('@')[0];
        if (username) {
          const user = await db.getUserByUsername(username);
          if (user) {
            console.log(`[Auth] User linked via username fallback: ${username}`);
            return user;
          }
        }
      }

      if (sbError) {
        console.warn(`[Auth] Supabase getUser failed (${sbError.status}): ${sbError.message}`);
      }
    } catch (err) {
      console.error("[Auth] Supabase getUser exception, trying manual fallback:", err);
    }

    // 3. FALLBACK: Verificação Manual (Apenas se o serviço do Supabase estiver indisponível ou falhar)
    const verifyKey = await this.getVerifyKey(token);
    if (verifyKey) {
      try {
        // Tenta verificar o JWT manualmente como redundância
        const { payload } = await jwtVerify(token, verifyKey);
        
        const authId = payload.sub;
        if (authId) {
          const user = await db.getUserByAuthId(authId);
          if (user) {
            console.log(`[Auth] Manual JWT fallback success for AuthID: ${authId}`);
            return user;
          }
        }
      } catch (manualError: any) {
        console.error(`[Auth] Manual JWT fallback failed: ${manualError.message}`);
      }
    }

    throw ForbiddenError("Invalid session");
  }
}

export const sdk = new SDKServer();
