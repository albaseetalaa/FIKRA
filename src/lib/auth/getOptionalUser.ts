import type { User } from "@supabase/supabase-js";

import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

/**
 * Reads the current Supabase session for use in Server Components and
 * layouts (navigation, page-level redirects) where the absence of a user
 * is a normal, non-exceptional outcome.
 *
 * Route handlers and application services that require a signed-in user
 * must use `requireAuthenticatedUser` instead, which throws.
 */
export async function getOptionalUser(): Promise<User | null> {
  if (!isSupabaseConfigured) {
    return null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    return null;
  }

  return data.user;
}
