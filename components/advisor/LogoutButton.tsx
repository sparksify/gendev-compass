"use client";

import { useRouter } from "next/navigation";
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
