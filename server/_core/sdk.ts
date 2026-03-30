import { ForbiddenError } from "../../shared/_core/errors.js";
import type { User } from "../../drizzle/schema.js";
import * as db from "../db.js";
import { COOKIE_NAME } from "../../shared/const.js";
import { jwtVerify } from "jose";
import { ENV } from "./env.js";

const rawJwtSecret = ENV.cookieSecret.trim();
if (rawJwtSecret.length < 32) {
  throw new Error("JWT_SECRET must be set with at least 32 characters");
}
const JWT_SECRET = new TextEncoder().encode(rawJwtSecret);

class SDKServer {
  async authenticateRequest(req: any): Promise<User> {
    // 1. Try Cookie Auth (JWT)
    const token = req.cookies?.[COOKIE_NAME];
    
    if (token) {
      try {
        const { payload } = await jwtVerify(token, JWT_SECRET);
        const userId = payload.sub ? parseInt(payload.sub) : null;
        
        if (userId) {
          try {
            const user = await db.getUserById(userId);
            if (user) {
              return user;
            }
          } catch (dbError) {
            console.error("[Auth] Database error during authentication:", dbError);
            throw dbError; // Repassa o erro do banco para ser capturado no context/router
          }
        }
      } catch (e) {
        if ((e as any).code === "ERR_JWT_EXPIRED" || (e as any).code === "ERR_JWS_INVALID") {
          console.warn("[Auth] Invalid or expired JWT token");
        } else {
          console.error("[Auth] JWT verification error:", e);
          throw e;
        }
      }
    }

    throw ForbiddenError("Invalid session");
  }
}

export const sdk = new SDKServer();
