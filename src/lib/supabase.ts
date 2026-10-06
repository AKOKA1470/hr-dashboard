import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

const urlIsValid = (() => {
  if (!supabaseUrl) return false;
  try {
    const url = new URL(supabaseUrl);
    return (
      url.protocol === "https:" ||
      (url.protocol === "http:" &&
        ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
    );
  } catch {
    return false;
  }
})();

export const supabaseConfiguration:
  | "ready"
  | "incomplete"
  | "invalid"
  | "missing" =
  !supabaseUrl && !supabaseAnonKey
    ? "missing"
    : !supabaseUrl || !supabaseAnonKey
      ? "incomplete"
      : !urlIsValid
        ? "invalid"
        : "ready";

export const supabase =
  supabaseConfiguration === "ready"
    ? createClient<Database>(supabaseUrl!, supabaseAnonKey!, {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true,
        },
      })
    : null;
