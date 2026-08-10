"use client";

import Link from "next/link";
import React, { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { signUpAction, type AuthActionState } from "@/lib/auth/actions";

const initialState: AuthActionState = { status: "idle", error: null };
const SIGNUP_PENDING_LABEL = "Creating account...";

export default function SignupForm({ nextPath }: { nextPath: string }) {
  const signUpWithNext = signUpAction.bind(null, nextPath);
  const [state, formAction, isPending] = useActionState(signUpWithNext, initialState);

  if (state.status === "success") {
    return (
      <div className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col justify-center px-4 py-16">
        <div className="rounded-2xl border border-white/8 bg-white/90 p-8 shadow-sm dark:border-white/6 dark:bg-slate-900/60">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-brand-600 dark:text-brand-300">
            Almost there
          </p>
          <h1 className="mt-3 text-2xl font-semibold text-slate-950 dark:text-white">Check your inbox</h1>
          <p role="status" className="mt-4 text-sm text-slate-600 dark:text-slate-400">
            {state.message}
          </p>
          <Link href="/login" className="mt-6 inline-block text-sm font-medium text-brand-600 dark:text-brand-300">
            Back to log in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col justify-center px-4 py-16">
      <div className="rounded-2xl border border-white/8 bg-white/90 p-8 shadow-sm dark:border-white/6 dark:bg-slate-900/60">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-brand-600 dark:text-brand-300">
          Get started
        </p>
        <h1 className="mt-3 text-2xl font-semibold text-slate-950 dark:text-white">Create your Fikra AI account</h1>

        <form action={formAction} className="mt-8 space-y-5" noValidate>
          <label className="block">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Email</span>
            <input
              type="email"
              name="email"
              required
              autoComplete="email"
              className="mt-2 w-full rounded-lg border border-white/8 bg-white/90 p-3 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-slate-900/70 dark:text-slate-100"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Password</span>
            <input
              type="password"
              name="password"
              required
              minLength={8}
              autoComplete="new-password"
              className="mt-2 w-full rounded-lg border border-white/8 bg-white/90 p-3 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-slate-900/70 dark:text-slate-100"
            />
            <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">At least 8 characters.</span>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Confirm password</span>
            <input
              type="password"
              name="confirmPassword"
              required
              minLength={8}
              autoComplete="new-password"
              className="mt-2 w-full rounded-lg border border-white/8 bg-white/90 p-3 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-slate-900/70 dark:text-slate-100"
            />
          </label>

          {state.error ? (
            <p role="alert" className="text-sm text-rose-500">
              {state.error}
            </p>
          ) : null}

          <span role="status" className="sr-only">
            {isPending ? SIGNUP_PENDING_LABEL : ""}
          </span>
          <Button type="submit" loading={isPending} className="w-full">
            {isPending ? SIGNUP_PENDING_LABEL : "Sign up"}
          </Button>
        </form>

        <p className="mt-6 text-sm text-slate-600 dark:text-slate-400">
          Already have an account?{" "}
          <Link
            href={`/login?next=${encodeURIComponent(nextPath)}`}
            className="font-medium text-brand-600 dark:text-brand-300"
          >
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
