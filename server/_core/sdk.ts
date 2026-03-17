import { ForbiddenError } from "../../shared/_core/errors.js";
import { createClient } from "@supabase/supabase-js";
import type { User } from "../../drizzle/schema.js";
import * as db from "../db.js";
import { ENV } from "./env.js";

class SDKServer {
  private readonly supabase: any;

  constructor() {
    this.supabase = createClient(ENV.supabaseUrl, ENV.supabaseAnonKey);
  }

  async authenticateRequest(req: any): Promise<User> {
    // 1. Try Supabase Auth first
    const authHeader = req.headers?.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      const {
        data: { user: supabaseUser },
        error,
      } = await this.supabase.auth.getUser(token);

      if (!error && supabaseUser) {
        let user = await db.getUserByOpenId(supabaseUser.id);
        if (!user) {
          await db.upsertUser({
            openId: supabaseUser.id,
            name:
              supabaseUser.user_metadata?.full_name ||
              supabaseUser.email?.split("@")[0] ||
              "User",
            email: supabaseUser.email,
            loginMethod: "supabase",
            lastSignedIn: new Date(),
          });
          user = await db.getUserByOpenId(supabaseUser.id);
        }
        if (user) {
          await db.upsertUser({
            openId: user.openId,
            lastSignedIn: new Date(),
          });
          return user;
        }
      }
    }

    throw ForbiddenError("Invalid session");
  }
}

export const sdk = new SDKServer();
