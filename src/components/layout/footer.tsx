export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-neutral-200">
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-2 px-4 py-6 text-sm text-neutral-500 sm:flex-row sm:items-center sm:px-6 lg:px-8">
        <p>&copy; {year} Fikra AI. All rights reserved.</p>
      </div>
    </footer>
  );
}
