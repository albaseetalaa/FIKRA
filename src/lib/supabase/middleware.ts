import { createServerClient, type SetAllCookies, type CookieOptions } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

type SupabaseCookieList = Parameters<SetAllCookies>[0];

/**
 * Refreshes the Supabase auth session on every request and keeps the
 * browser/server cookies in sync. Wire this into middleware.ts once
 * authentication is introduced.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return supabaseResponse;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: SupabaseCookieList) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }: {
          name: string;
          value: string;
          options: CookieOptions;
        }) => supabaseResponse.cookies.set(name, value, options));
      },
    },
  });

  // Refreshes the session if expired. Required for Server Components,
  // which cannot write cookies themselves.
  await supabase.auth.getUser();

  return supabaseResponse;
}
