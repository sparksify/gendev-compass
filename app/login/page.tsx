import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Lock, Shield, TrendingUp, UsersRound } from "lucide-react";
import { LoginForm } from "@/components/advisor/LoginForm";
import { getCurrentStaffUser } from "@/lib/advisor/auth";
import { getSiteAssets } from "@/lib/assets";
import { brand } from "@/lib/config/brand";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Advisor Sign In" };
export const dynamic = "force-dynamic";

/** Decorative dot grid used on both halves of the split layout. */
function DotGrid({ className, color }: { className?: string; color: string }) {
  return (
    <div
      aria-hidden
      className={cn("pointer-events-none absolute h-[90px] w-[110px]", className)}
      style={{
        backgroundImage: `radial-gradient(${color} 1.6px, transparent 1.6px)`,
        backgroundSize: "16px 16px",
      }}
    />
  );
}

/**
 * The uploaded dashboard logo (site-logo slot, same asset the advisor
 * sidebar shows). No bundled fallback mark here — until an admin uploads
 * one, an empty placeholder slot renders instead.
 */
function LogoSlot({ logoUrl }: { logoUrl: string | null }) {
  if (logoUrl) {
    // eslint-disable-next-line @next/next/no-img-element -- dynamic admin-uploaded asset
    return <img src={logoUrl} alt={brand.productName} className="h-12 w-auto max-w-[250px] object-contain object-left" />;
  }
  return (
    <div className="flex h-12 w-44 items-center justify-center rounded-lg border border-dashed border-white/35 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/65">
      Your logo
    </div>
  );
}

const FEATURES = [
  {
    icon: UsersRound,
    title: "All-in-One Platform",
    description: "Manage leads, clients, and tasks in one place.",
  },
  {
    icon: TrendingUp,
    title: "Track What Matters",
    description: "See real-time insights and team performance.",
  },
  {
    icon: Lock,
    title: "Secure & Reliable",
    description: "Enterprise-grade security for your data.",
  },
];

export default async function AdvisorLoginPage() {
  const user = await getCurrentStaffUser();
  if (user) redirect("/advisor");

  const assets = await getSiteAssets();
  const logoUrl = assets["site-logo"]?.url ?? null;

  return (
    <main className="flex min-h-screen bg-[#f5f6f4]">
      {/* Left brand panel (desktop only). */}
      <section className="relative hidden shrink-0 flex-col justify-between overflow-hidden bg-[#12402f] p-12 lg:flex lg:w-[46%] xl:p-16">
        {/* Soft concentric circles + dot grids behind the content. */}
        <div aria-hidden className="pointer-events-none absolute -left-44 -top-44 h-[520px] w-[520px] rounded-full bg-white/[0.05]" />
        <div aria-hidden className="pointer-events-none absolute -left-24 top-40 h-[640px] w-[640px] rounded-full border border-white/[0.07]" />
        <div aria-hidden className="pointer-events-none absolute -bottom-56 right-[-120px] h-[440px] w-[440px] rounded-full bg-white/[0.04]" />
        <DotGrid className="right-10 top-14" color="rgba(255,255,255,0.28)" />
        <DotGrid className="bottom-32 left-6" color="rgba(255,255,255,0.18)" />

        <div className="relative">
          <LogoSlot logoUrl={logoUrl} />

          <h1 className="mt-20 text-[40px] font-semibold leading-[1.18] text-white xl:text-[44px]">
            Welcome back,
            <br />
            let&rsquo;s <span className="text-[#f2c14b]">grow together.</span>
          </h1>

          <p className="mt-6 max-w-[420px] text-[15.5px] leading-[1.65] text-[#cfe0d7]">
            {brand.productName} helps your team{" "}
            <strong className="font-semibold text-white">manage leads,</strong>{" "}
            <strong className="font-semibold text-white">track activity</strong>, and close more
            deals.
          </p>

          <ul className="mt-12 space-y-7">
            {FEATURES.map((feature) => (
              <li key={feature.title} className="flex items-center gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/[0.08]">
                  <feature.icon className="h-5 w-5 text-white" strokeWidth={2} />
                </span>
                <span>
                  <span className="block text-[15px] font-semibold text-white">{feature.title}</span>
                  <span className="mt-0.5 block text-[13.5px] leading-[1.5] text-[#b9cdc3]">
                    {feature.description}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative flex items-center gap-2.5 text-[13.5px] text-[#b9cdc3]">
          <Shield className="h-[18px] w-[18px]" strokeWidth={2} />
          Trusted by growth-driven teams
        </div>
      </section>

      {/* Right sign-in panel. */}
      <section className="relative flex min-w-0 flex-1 flex-col items-center justify-center overflow-hidden px-4 py-10 sm:px-8">
        <div aria-hidden className="pointer-events-none absolute -right-40 -top-40 h-[420px] w-[420px] rounded-full bg-[#12402f]/[0.04]" />
        <div aria-hidden className="pointer-events-none absolute -bottom-52 -left-32 h-[460px] w-[460px] rounded-full bg-[#12402f]/[0.03]" />
        <DotGrid className="right-8 top-10" color="rgba(18,64,47,0.14)" />
        <DotGrid className="bottom-16 right-16" color="rgba(18,64,47,0.10)" />
        <DotGrid className="left-10 top-1/3 hidden sm:block" color="rgba(18,64,47,0.08)" />

        {/* Mobile logo (the brand panel is hidden below lg). */}
        <div className="relative z-10 mb-6 lg:hidden">
          <div className="flex items-center justify-center rounded-xl bg-[#12402f] px-6 py-3.5">
            <LogoSlot logoUrl={logoUrl} />
          </div>
        </div>

        <div className="relative z-10 w-full max-w-[450px] rounded-2xl bg-white p-7 shadow-[0_18px_55px_-20px_rgba(15,40,30,0.22)] sm:p-10">
          <h2 className="text-center text-[25px] font-bold leading-[1.25] text-[#101828]">
            Sign in to your account
          </h2>
          <p className="mt-2 text-center text-[14.5px] leading-[1.5] text-[#69737e]">
            Enter your credentials to access your dashboard.
          </p>
          <div className="mt-8">
            <LoginForm />
          </div>
        </div>

        <p className="relative z-10 mt-6 flex items-center justify-center gap-2 text-[13px] text-[#8b959d]">
          <Lock className="h-3.5 w-3.5" strokeWidth={2} />
          Your data is secure and encrypted
        </p>
      </section>
    </main>
  );
}
