import Link from "next/link";

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-neutral-200 bg-white/90 px-4 py-10 dark:border-neutral-800 dark:bg-slate-950/80 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1.3fr_0.7fr]">
        <div className="space-y-4">
          <p className="text-sm font-semibold uppercase tracking-[0.32em] text-brand-600 dark:text-brand-300">
            Fikra AI
          </p>
          <p className="max-w-2xl text-sm leading-7 text-neutral-600 dark:text-neutral-300">
            Build your business from idea to launch with a modern landing page, product storytelling, and launch-ready assets.
          </p>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">© {year} Fikra AI. All rights reserved.</p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-2">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.24em] text-neutral-900 dark:text-white">
              Explore
            </h3>
            <ul className="mt-4 space-y-3 text-sm text-neutral-600 dark:text-neutral-300">
              <li>
                <Link href="#how-it-works" className="transition hover:text-brand-700 dark:hover:text-brand-300">
                  How it works
                </Link>
              </li>
              <li>
                <Link href="#services" className="transition hover:text-brand-700 dark:hover:text-brand-300">
                  Services
                </Link>
              </li>
              <li>
                <Link href="#pricing" className="transition hover:text-brand-700 dark:hover:text-brand-300">
                  Pricing
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.24em] text-neutral-900 dark:text-white">
              Contact
            </h3>
            <ul className="mt-4 space-y-3 text-sm text-neutral-600 dark:text-neutral-300">
              <li>
                <Link href="mailto:hello@fikra.ai" className="transition hover:text-brand-700 dark:hover:text-brand-300">
                  hello@fikra.ai
                </Link>
              </li>
              <li>
                <span>Legal</span>
              </li>
              <li>
                <span>Privacy policy</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </footer>
  );
}
