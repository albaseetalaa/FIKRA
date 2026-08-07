"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

import { sanitizeNextPath } from "./nextPath";

export type AuthActionState = {
  status: "idle" | "error" | "success";
  error: string | null;
  message?: string;
};

// Generic, fixed messages only. Supabase's own error text (which can
// reveal whether an email is registered, rate-limit internals, etc.) is
// never forwarded to the client.
const GENERIC_SIGN_IN_ERROR = "Invalid email or password.";
const GENERIC_SIGN_UP_ERROR = "Could not create your account. Please try again.";

const signInSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email is required.")
    .email("Enter a valid email address."),
  password: z.string().min(1, "Password is required."),
});

const signUpSchema = z
  .object({
    email: z
      .string()
      .trim()
      .min(1, "Email is required.")
      .email("Enter a valid email address."),
    password: z.string().min(8, "Password must be at least 8 characters."),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export async function signInAction(
  nextPath: string,
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return { status: "error", error: GENERIC_SIGN_IN_ERROR };
  }

  redirect(sanitizeNextPath(nextPath, "/"));
}

export async function signUpAction(
  nextPath: string,
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = signUpSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    return { status: "error", error: GENERIC_SIGN_UP_ERROR };
  }

  if (!data.session) {
    return {
      status: "success",
      error: null,
      message: "Check your email to confirm your account before logging in.",
    };
  }

  redirect(sanitizeNextPath(nextPath, "/"));
}

export async function signOutAction(_formData: FormData): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
