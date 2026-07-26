interface PricingCardProps {
  name: string;
  description: string;
  price: string;
  frequency: string;
  features: string[];
  popular?: boolean;
}

export function PricingCard({
  name,
  description,
  price,
  frequency,
  features,
  popular = false,
}: PricingCardProps) {
  return (
    <article className={`group relative overflow-hidden rounded-[2rem] border p-8 shadow-sm transition duration-500 ${
      popular
        ? "border-brand-500 bg-brand-50/80 shadow-[0_30px_90px_rgba(58,99,245,0.12)] dark:bg-brand-900/20"
        : "border-neutral-200 bg-white/95 hover:-translate-y-1 hover:shadow-[0_20px_60px_rgba(15,23,42,0.08)] dark:border-neutral-800 dark:bg-slate-900/85"
    }`}>
      {popular ? (
        <div className="pointer-events-none absolute inset-x-0 top-0 mx-auto mt-5 flex w-max rounded-full bg-brand-600 px-4 py-1.5 text-sm font-semibold text-white shadow-lg shadow-brand-600/25">
          Most popular
        </div>
      ) : null}
      <div className="space-y-4 pt-8">
        <div className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-[0.32em] text-brand-600 dark:text-brand-300">
            {name}
          </p>
          <p className="text-base text-neutral-600 dark:text-neutral-300">{description}</p>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-5xl font-semibold tracking-tight text-neutral-950 dark:text-white">
            {price}
          </span>
          <span className="text-sm text-neutral-600 dark:text-neutral-300">{frequency}</span>
        </div>
      </div>
      <ul className="mt-8 space-y-4 text-sm leading-7 text-neutral-600 dark:text-neutral-300">
        {features.map((feature) => (
          <li key={feature} className="flex gap-3">
            <span className="mt-1 shrink-0 text-brand-600 dark:text-brand-300">✓</span>
            <span>{feature}</span>
          </li>
        ))}
      </ul>
      <button className="mt-10 w-full rounded-3xl bg-brand-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:focus-visible:ring-brand-300">
        Start free trial
      </button>
    </article>
  );
}
