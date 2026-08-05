"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const router = useRouter();

  async function onLogout() {
    await fetch("/api/advisor/auth/logout", { method: "POST" });
    router.push("/advisor/login");
    router.refresh();
  }

  return (
    <Button variant="ghost" size="sm" onClick={onLogout}>
      Sign out
    </Button>
  );
}
