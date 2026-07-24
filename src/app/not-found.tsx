import Link from "next/link";

export default function NotFound() {
  return (
    <section className="mx-auto flex max-w-3xl flex-col items-start gap-4 px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
      <h1 className="text-2xl font-semibold text-neutral-900 sm:text-3xl">
        Page not found
      </h1>
      <p className="text-base text-neutral-600">
        The page you&apos;re looking for doesn&apos;t exist or has moved.
      </p>
      <Link
        href="/"
        className="text-sm font-medium text-brand-600 hover:text-brand-700"
      >
        Return home
      </Link>
    </section>
  );
}
