import { getGhlConfig } from "@/lib/config/fdd";
import { listMappingsForEntity } from "@/lib/domain/mappings";
import type { LeadRecord } from "@/types/lead";

export interface GhlContact {
  id: string;
  locationId: string;
  email?: string;
  assignedTo?: string;
  customFields?: Array<{ id: string; value: unknown }>;
}
export class GhlHttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export class GhlClient {
  readonly locationId: string;
  private readonly token: string;
  constructor() {
    const config = getGhlConfig();
    if (!config.apiToken || !config.locationId) throw new Error("HighLevel API is not configured");
    this.token = config.apiToken; this.locationId = config.locationId;
  }
  async request<T>(path: string, method = "GET", body?: unknown): Promise<T> {
    const response = await fetch(`https://services.leadconnectorhq.com${path}`, {
      method, headers: { Authorization: `Bearer ${this.token}`, Version: "2021-07-28", "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(15_000), cache: "no-store",
    });
    // Never persist response bodies: they can contain credentials or answers.
    if (!response.ok) throw new GhlHttpError(response.status, `HighLevel ${method} ${path.split("?")[0]}: HTTP ${response.status}`);
    return response.json() as Promise<T>;
  }
  async contact(id: string): Promise<GhlContact> {
    const { contact } = await this.request<{ contact: GhlContact }>(`/contacts/${encodeURIComponent(id)}`);
    if (!contact?.id || contact.locationId !== this.locationId) throw new Error("Mapped contact is missing or belongs to a different HighLevel location");
    return contact;
  }
  async resolveContact(lead: LeadRecord): Promise<GhlContact> {
    if (lead.client_id) {
      const mapped = (await listMappingsForEntity(lead.client_id)).filter(m => m.provider === "gohighlevel" && m.entity_type === "client" && m.organization_id === lead.organization_id);
      if (mapped.length > 1) throw new Error("Multiple HighLevel contact mappings; reconcile before syncing");
      if (mapped[0]) return this.contact(mapped[0].external_id);
    }
    // Exact, location-scoped filter. Request two so duplicates are explicit.
    const result = await this.request<{ contacts: GhlContact[]; total?: number }>("/contacts/search", "POST", {
      locationId: this.locationId, page: 1, pageLimit: 2,
      filters: [{ field: "email", operator: "eq", value: lead.email.trim().toLowerCase() }],
    });
    return selectExactContact(result.contacts, lead.email, this.locationId, result.total);
  }
}
export function selectExactContact(contacts: GhlContact[], email: string, locationId: string, total?: number): GhlContact {
  if (total !== undefined && total > 1) throw new Error("Duplicate HighLevel email matches; reconcile before syncing");
  const exact = contacts.filter(c => c.locationId === locationId && c.email?.trim().toLowerCase() === email.trim().toLowerCase());
  if (exact.length !== 1 || contacts.length !== 1) throw new Error(exact.length > 1 ? "Duplicate HighLevel email matches; reconcile before syncing" : "No unambiguous exact, location-scoped HighLevel contact match");
  return exact[0];
}
