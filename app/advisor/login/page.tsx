import { redirect } from "next/navigation";

/** The sign-in screen moved to /login; keep old bookmarks working. */
export default function LegacyAdvisorLoginPage() {
  redirect("/login");
}
