import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { CookieOptions, SetAllCookies } from "@supabase/ssr";

type SupabaseCookieList = Parameters<SetAllCookies>[0];

/**
 * Creates a Supabase client for use in Server Components, Server Actions,
 * and Route Handlers. Reads/writes the session via Next.js cookies.
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
 * to be set (see .env.example).
 */
export async function createClient() {
  const cookieStore = await cookies();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing Supabase environment variables. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: SupabaseCookieList) {
        try {
          cookiesToSet.forEach(({ name, value, options }: {
            name: string;
            value: string;
            options: CookieOptions;
          }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component with no request context to
          // write to — safe to ignore when middleware refreshes sessions.
        }
      },
    },
  });
}
