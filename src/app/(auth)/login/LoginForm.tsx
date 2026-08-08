"use client";

import Link from "next/link";
import React, { useActionState } from "react";

import { signInAction, type AuthActionState } from "@/lib/auth/actions";

const initialState: AuthActionState = { status: "idle", error: null };

export default function LoginForm({ nextPath }: { nextPath: string }) {
  const signInWithNext = signInAction.bind(null, nextPath);
  const [state, formAction, isPending] = useActionState(signInWithNext, initialState);

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col justify-center px-4 py-16">
      <div className="rounded-2xl border border-white/8 bg-white/90 p-8 shadow-sm dark:border-white/6 dark:bg-slate-900/60">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-brand-600 dark:text-brand-300">
          Welcome back
        </p>
        <h1 className="mt-3 text-2xl font-semibold text-slate-950 dark:text-white">Log in to Fikra AI</h1>

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
              autoComplete="current-password"
              className="mt-2 w-full rounded-lg border border-white/8 bg-white/90 p-3 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:bg-slate-900/70 dark:text-slate-100"
            />
          </label>

          {state.error ? (
            <p role="alert" className="text-sm text-rose-500">
              {state.error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isPending}
            aria-busy={isPending}
            className={`w-full rounded-full px-6 py-3 text-sm font-semibold text-white ${
              isPending ? "cursor-not-allowed bg-white/8" : "bg-brand-700 hover:bg-brand-800"
            }`}
          >
            {isPending ? "Signing in..." : "Log in"}
          </button>
        </form>

        <p className="mt-6 text-sm text-slate-600 dark:text-slate-400">
          Don&apos;t have an account?{" "}
          <Link
            href={`/signup?next=${encodeURIComponent(nextPath)}`}
            className="font-medium text-brand-600 dark:text-brand-300"
          >
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
