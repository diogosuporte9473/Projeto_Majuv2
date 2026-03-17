import { ForbiddenError } from "../../shared/_core/errors.js";
import type { User } from "../../drizzle/schema.js";
import * as db from "../db.js";
import { COOKIE_NAME } from "../../shared/const.js";
import { jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "your-secret-key");

class SDKServer {
  async authenticateRequest(req: any): Promise<User> {
    // 1. Try Cookie Auth (JWT)
    const token = req.cookies?.[COOKIE_NAME];
    
    if (token) {
      try {
        const { payload } = await jwtVerify(token, JWT_SECRET);
        const userId = payload.sub ? parseInt(payload.sub) : null;
        
        if (userId) {
          const user = await db.getUserById(userId);
          if (user) {
            return user;
          }
        }
      } catch (e) {
        console.warn("[Auth] Invalid JWT token");
      }
    }

    throw ForbiddenError("Invalid session");
  }
}

export const sdk = new SDKServer();
