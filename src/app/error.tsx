"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section className="mx-auto flex max-w-3xl flex-col items-start gap-4 px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
      <h1 className="text-2xl font-semibold text-neutral-900 sm:text-3xl">
        Something went wrong
      </h1>
      <p className="text-base text-neutral-600">
        An unexpected error occurred. Try again, and if the problem persists,
        contact support.
      </p>
      <button
        type="button"
        onClick={reset}
        className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
      >
        Try again
      </button>
    </section>
  );
}
