import { HeroSection } from "@/components/hero/hero-section";
import { HowItWorksSection } from "@/components/how-it-works/how-it-works-section";
import { ServicesStudioSection } from "@/components/services-studio/services-studio-section";

export default function HomePage() {
  return (
    <main className="bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-slate-100">
      <HeroSection />
      <HowItWorksSection />
      <ServicesStudioSection />
    </main>
  );
}
