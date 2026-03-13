import { describe, expect, it } from "vitest";

describe("Supabase Credentials", () => {
  it("should have valid Supabase environment variables", () => {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
    const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

    expect(supabaseUrl).toBeDefined();
    expect(supabaseAnonKey).toBeDefined();
    expect(supabaseSecretKey).toBeDefined();

    // Validate URL format
    expect(supabaseUrl).toMatch(/^https:\/\/[a-z0-9]+\.supabase\.co$/);

    // Validate key formats
    expect(supabaseAnonKey).toMatch(/^sb_publishable_/);
    expect(supabaseSecretKey).toMatch(/^sb_secret_/);
  });

  it("should be able to create Supabase client", async () => {
    const { createClient } = await import("@supabase/supabase-js");

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

    expect(supabaseUrl).toBeDefined();
    expect(supabaseAnonKey).toBeDefined();

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error("Missing Supabase credentials");
    }

    const client = createClient(supabaseUrl, supabaseAnonKey);

    expect(client).toBeDefined();
    expect(client.auth).toBeDefined();
  });
});
