import React from "react";
import Link from "next/link";

import { getOptionalUser } from "@/lib/auth/getOptionalUser";

// Scoped to the (onboarding) route group only (create-project and
// create-project/processing today). header.tsx (marketing-only chrome)
// and TopNav (workspace-only, dark-themed, raw-Tailwind-styled) are both
// deliberately not extended for this — see
// docs/superpowers/specs/2026-08-13-project-creation-reliability-recovery-design.md
// for why neither was a clean fit. This gives an authenticated user a
// normal, always-present route to /projects independent of any error
// state or of already being inside the workspace shell.
export default async function OnboardingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getOptionalUser();

  return (
    <>
      {user ? (
        <div className="border-b border-border-default bg-surface-canvas px-4 py-2 sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-4xl justify-end">
            <Link
              href="/projects"
              className="text-sm font-medium text-text-secondary transition hover:text-text-primary focus-visible:outline focus-visible:outline-[length:var(--focus-ring-width)] focus-visible:outline-offset-[var(--focus-ring-offset)] focus-visible:outline-[color:var(--color-border-focus)]"
            >
              My Projects
            </Link>
          </div>
        </div>
      ) : null}
      <main className="flex-1">{children}</main>
    </>
  );
}
