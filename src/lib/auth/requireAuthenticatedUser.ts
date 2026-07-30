import type { User } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";

export class AuthenticationRequiredError extends Error {
  constructor() {
    super("Authentication required.");
    this.name = "AuthenticationRequiredError";
  }
}

/**
 * Verifies the current Supabase session against the Auth server.
 *
 * Route handlers and server-side application services should call this
 * before accessing user-owned resources.
 */
export async function requireAuthenticatedUser(): Promise<User> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    throw new AuthenticationRequiredError();
  }

  return data.user;
}
