import Link from "next/link";

const NAV_LINKS = [
  { href: "/", label: "Home" },
] as const;

export function Header() {
  return (
    <header className="border-b border-neutral-200">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="text-base font-semibold tracking-tight text-neutral-900"
        >
          Fikra AI
        </Link>
        <nav aria-label="Primary" className="flex items-center gap-6">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-neutral-600 transition-colors hover:text-neutral-900"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
