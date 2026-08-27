"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function LogoutButton({ className, variant = "ghost", ...props }: Partial<ButtonProps>) {
  const router = useRouter();

  async function onLogout() {
    await fetch("/api/advisor/auth/logout", { method: "POST" });
    router.push("/advisor/login");
    router.refresh();
  }

  return (
    <Button
      variant={variant}
      size="sm"
      onClick={onLogout}
      className={cn(className)}
      {...props}
    >
      Sign out
    </Button>
  );
}

/**
 * The ink sidebar's sign-out control: just the door icon, colored by the
 * parent. A bare button rather than the Button component, because every one
 * of its variants is drawn for the light ground.
 */
export function LogoutIconButton({ className }: { className?: string }) {
  const router = useRouter();

  async function onLogout() {
    await fetch("/api/advisor/auth/logout", { method: "POST" });
    router.push("/advisor/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={onLogout}
      aria-label="Sign out"
      title="Sign out"
      className={cn(
        "shrink-0 rounded-md p-1 text-[#8fa098] transition-colors hover:text-white",
        className,
      )}
    >
      <LogOut className="size-[13px]" strokeWidth={2} />
    </button>
  );
}
