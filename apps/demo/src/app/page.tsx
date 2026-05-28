import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { Hero } from "@/components/marketing/Hero";
import { MissingLayer } from "@/components/marketing/MissingLayer";
import { Modules } from "@/components/marketing/Modules";
import { Passport } from "@/components/marketing/Passport";
import { Stack } from "@/components/marketing/Stack";
import { FinalCTA } from "@/components/marketing/FinalCTA";

export default function Home() {
  return (
    <main className="relative bg-obsidian text-bone overflow-x-hidden">
      <MarketingHeader />
      <Hero />
      <MissingLayer />
      <Modules />
      <Passport />
      <Stack />
      <FinalCTA />
    </main>
  );
}
