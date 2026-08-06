import { getAdminTestPassword, isProduction } from "@/lib/config/env";
import { requireStaffApi } from "./auth";
import { isAdmin } from "./access";

/**
 * Dual authorization for platform-admin API routes (asset uploads, data
 * imports, FDD tooling): a logged-in staff session with the ADMIN role —
 * the unified /advisor dashboard's normal path — OR the legacy
 * x-admin-password header still used by the standalone /admin page. With
 * neither configured, requests are only allowed outside production (the
 * long-standing dev fallback).
 */
export async function authorizedAdminRequest(request: Request): Promise<boolean> {
  const adminPassword = getAdminTestPassword();
  const provided = request.headers.get("x-admin-password");
  if (adminPassword && provided != null) return provided === adminPassword;

  const auth = await requireStaffApi();
  if (!("response" in auth) && isAdmin(auth.user)) return true;

  if (adminPassword) return false;
  return !isProduction();
}
