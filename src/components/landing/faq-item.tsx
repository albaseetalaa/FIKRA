interface FAQItemProps {
  question: string;
  answer: string;
}

export function FAQItem({ question, answer }: FAQItemProps) {
  return (
    <article className="rounded-[1.75rem] border border-neutral-200 bg-white/90 p-6 shadow-sm transition duration-300 hover:border-brand-300 hover:bg-brand-50/50 dark:border-neutral-800 dark:bg-slate-900/80 dark:hover:border-brand-700">
      <h3 className="text-base font-semibold text-neutral-950 dark:text-white">{question}</h3>
      <p className="mt-3 text-sm leading-7 text-neutral-600 dark:text-neutral-300">{answer}</p>
    </article>
  );
}
