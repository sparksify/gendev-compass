"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";
import { brand } from "@/lib/config/brand";

const inputClass =
  "h-12 w-full rounded-lg border border-[#e2e7e3] bg-white pl-11 text-[15px] text-[#101828] placeholder:text-[#9aa3ae] focus:border-[#12402f] focus:outline-none focus:ring-2 focus:ring-[#12402f]/15";

/** Google's official multicolor "G", required styling for the sign-in button. */
function GoogleMark() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5 shrink-0">
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.63h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.58-5.17 3.58-8.8Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.88-3c-1.07.72-2.45 1.15-4.06 1.15-3.13 0-5.78-2.11-6.72-4.95H1.27v3.1A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.29a7.2 7.2 0 0 1 0-4.58v-3.1H1.27a12 12 0 0 0 0 10.78l4.01-3.1Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.76 0 3.34.6 4.59 1.79l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.27 6.61l4.01 3.1C6.22 6.88 8.87 4.77 12 4.77Z"
      />
    </svg>
  );
}

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setSubmitting(true);
    try {
      const response = await fetch("/api/advisor/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, rememberMe }),
      });
      const data = (await response.json()) as { success: boolean; error?: string };
      if (!data.success) {
        setError(data.error ?? "Sign-in failed. Please try again.");
        return;
      }
      router.push("/advisor");
      router.refresh();
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <div>
        <label htmlFor="email" className="mb-2 block text-[14px] font-semibold text-[#101828]">
          Email address
        </label>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[#9aa3ae]" strokeWidth={2} />
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={`${inputClass} pr-4`}
          />
        </div>
      </div>

      <div>
        <label htmlFor="password" className="mb-2 block text-[14px] font-semibold text-[#101828]">
          Password
        </label>
        <div className="relative">
          <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[#9aa3ae]" strokeWidth={2} />
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={`${inputClass} pr-12`}
          />
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#9aa3ae] hover:text-[#69737e]"
          >
            {showPassword ? (
              <EyeOff className="h-[18px] w-[18px]" strokeWidth={2} />
            ) : (
              <Eye className="h-[18px] w-[18px]" strokeWidth={2} />
            )}
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <label className="flex cursor-pointer items-center gap-2 text-[13.5px] text-[#69737e]">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            className="h-4 w-4 rounded border-[#d3dad4] accent-[#12402f]"
          />
          Remember me
        </label>
        <a
          href={`mailto:${brand.supportEmail}?subject=Password%20reset%20request`}
          className="text-[13.5px] font-semibold text-[#12402f] hover:underline"
        >
          Forgot password?
        </a>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={submitting}
        className="h-12 w-full rounded-lg bg-[#12402f] text-[15px] font-semibold text-white transition-colors hover:bg-[#0d3324] disabled:opacity-60"
      >
        {submitting ? "Signing in…" : "Sign In"}
      </button>

      <div className="flex items-center gap-4" aria-hidden>
        <span className="h-px flex-1 bg-[#e9ecea]" />
        <span className="text-[13px] text-[#9aa3ae]">or</span>
        <span className="h-px flex-1 bg-[#e9ecea]" />
      </div>

      <button
        type="button"
        onClick={() =>
          setNotice("Google sign-in isn't enabled yet — please use your email and password.")
        }
        className="flex h-12 w-full items-center justify-center gap-3 rounded-lg border border-[#e2e7e3] bg-white text-[14.5px] font-medium text-[#101828] transition-colors hover:bg-[#f7f8f7]"
      >
        <GoogleMark />
        Sign in with Google
      </button>

      {notice ? <p className="text-center text-[13px] text-[#69737e]">{notice}</p> : null}

      <p className="pt-1 text-center text-[13.5px] text-[#69737e]">
        Don&rsquo;t have an account?{" "}
        <a
          href={`mailto:${brand.supportEmail}?subject=Account%20access%20request`}
          className="font-semibold text-[#12402f] hover:underline"
        >
          Contact your administrator
        </a>
      </p>
    </form>
  );
}
