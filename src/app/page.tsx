export default function HomePage() {
  return (
    <section className="mx-auto flex max-w-3xl flex-col items-start gap-6 px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
      <span className="rounded-full bg-brand-50 px-3 py-1 text-sm font-medium text-brand-700">
        Project foundation
      </span>
      <h1 className="text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl">
        Fikra AI
      </h1>
      <p className="max-w-xl text-base text-neutral-600 sm:text-lg">
        The production foundation for Fikra AI is set up: Next.js 15, the App
        Router, TypeScript, Tailwind CSS, ESLint, Prettier, and a
        Supabase-ready data layer. No product features are built yet — this
        page exists to confirm the app renders correctly end to end.
      </p>
    </section>
  );
}
