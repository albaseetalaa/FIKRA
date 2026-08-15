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
        // Fixed dark-surface classes (not the light-only bg-surface-canvas /
        // text-secondary semantic tokens) so this nav strip reads correctly
        // both on the light-themed wizard page and on
        // create-project/processing/page.tsx, which is a hard-coded dark
        // surface (bg-slate-950) regardless of light/dark preference — see
        // docs/superpowers/sdd for the theming-clash this fixes.
        <nav aria-label="Account" className="border-b border-white/10 bg-slate-950 px-4 py-2 sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-4xl justify-end">
            <Link
              href="/projects"
              className="text-sm font-medium text-slate-300 transition hover:text-white focus-visible:outline focus-visible:outline-[length:var(--focus-ring-width)] focus-visible:outline-offset-[var(--focus-ring-offset)] focus-visible:outline-[color:var(--color-border-focus)]"
            >
              My Projects
            </Link>
          </div>
        </nav>
      ) : null}
      {/* A plain div, not <main>: CreateProjectWizard (via WizardLayout)
          already renders its own <main> internally. Wrapping it in a
          second <main> here would create nested landmarks (an
          accessibility violation) and, on /create-project specifically,
          stack this nav strip's height on top of an already
          min-h-screen inner main inside a min-h-screen flex-col body,
          producing a real vertical-overflow regression on mobile. */}
      <div className="flex-1">{children}</div>
    </>
  );
}
