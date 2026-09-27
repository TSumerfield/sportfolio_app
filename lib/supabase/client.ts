import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { isLocalRuntime } from "../runtime-env";

// Production values are kept only as a fallback for deployed builds, so an
// existing deployment keeps working even if its env vars are unset. Local
// development, tests and verification must configure Supabase explicitly:
// they FAIL CLOSED instead of silently talking to the production database.
const PRODUCTION_URL = "https://dtarxexjawnxloxrdabw.supabase.co";
const PRODUCTION_PUBLISHABLE_KEY = "sb_publishable_W7Co0s0y8qwg6QiKKttykQ_7Gxl1sMi";

const configuredUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const configuredKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

export const SUPABASE_CONFIG_ERROR =
  "Sportfolio: Supabase is not configured (set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, e.g. in .env.local). Refusing to fall back to the production database outside a deployed environment.";

function failClosedClient(): SupabaseClient {
  if (typeof window !== "undefined") console.error(SUPABASE_CONFIG_ERROR);
  return new Proxy({} as SupabaseClient, {
    get() {
      throw new Error(SUPABASE_CONFIG_ERROR);
    },
  });
}

function resolveClient(): SupabaseClient {
  const configured = Boolean(configuredUrl && configuredKey);
  if (!configured && isLocalRuntime()) return failClosedClient();
  return createClient(configured ? configuredUrl! : PRODUCTION_URL, configured ? configuredKey! : PRODUCTION_PUBLISHABLE_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: "implicit",
    },
  });
}

export const supabase = resolveClient();
