import Link from "next/link";
import { getStore } from "@/lib/store";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { STATUS_META } from "@/components/territory/statusMeta";
import { TERRITORY_RESULT_STATUSES } from "@/types/territory";
import { TerritoryPageShell } from "@/components/advisor/territories/TerritoryPageShell";

export const dynamic = "force-dynamic";

type SearchParams = { brand?: string; status?: string; state?: string };

export default async function SearchActivityPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const store = getStore();
  const [brands, leads, allSearches] = await Promise.all([
    store.listBrands(),
    store.listLeads(),
    store.listTerritorySearches(),
  ]);
  const leadById = new Map(leads.map((l) => [l.id, l]));
  const brandById = new Map(brands.map((b) => [b.id, b]));

  const filtered = allSearches.filter((s) => {
    if (params.brand && brandById.get(s.brand_id)?.slug !== params.brand) return false;
    if (params.status && s.result_status !== params.status) return false;
    if (params.state && s.state_code !== params.state.toUpperCase()) return false;
    return true;
  });

  const states = [...new Set(allSearches.map((s) => s.state_code).filter((s): s is string => Boolean(s)))].sort();

  function buildHref(overrides: Partial<SearchParams>): string {
    const q = new URLSearchParams({ ...params, ...overrides } as Record<string, string>);
    for (const [k, v] of [...q.entries()]) if (!v) q.delete(k);
    return `/advisor/territories/searches?${q.toString()}`;
  }

  return (
    <TerritoryPageShell subtitle="Every territory search a prospect has run">
      <div className="flex flex-wrap items-center gap-4">
        <p className="text-[15.5px] leading-[1.45] text-muted-foreground">
          {filtered.length} of {allSearches.length} searches
        </p>
        <div className="flex flex-wrap gap-1.5">
          <Link href={buildHref({ status: undefined })} className={`rounded-full border px-2.5 py-1 text-[13px] font-medium ${!params.status ? "border-primary-soft-border bg-primary-soft text-primary" : "border-border text-muted-foreground"}`}>
            All results
          </Link>
          {TERRITORY_RESULT_STATUSES.map((status) => (
            <Link
              key={status}
              href={buildHref({ status })}
              className={`rounded-full border px-2.5 py-1 text-[13px] font-medium ${params.status === status ? "border-primary-soft-border bg-primary-soft text-primary" : "border-border text-muted-foreground"}`}
            >
              {STATUS_META[status].label}
            </Link>
          ))}
        </div>
      </div>

      {states.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <Link href={buildHref({ state: undefined })} className={`rounded-full border px-2.5 py-1 text-[13px] font-medium ${!params.state ? "border-primary-soft-border bg-primary-soft text-primary" : "border-border text-muted-foreground"}`}>
            All states
          </Link>
          {states.map((s) => (
            <Link key={s} href={buildHref({ state: s })} className={`rounded-full border px-2.5 py-1 text-[13px] font-medium ${params.state === s ? "border-primary-soft-border bg-primary-soft text-primary" : "border-border text-muted-foreground"}`}>
              {s}
            </Link>
          ))}
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-left text-[14.5px]">
            <thead>
              <tr className="border-b border-border text-[12.5px] uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">Prospect</th>
                <th className="px-4 py-2.5 font-medium">Brand</th>
                <th className="px-4 py-2.5 font-medium">Query</th>
                <th className="px-4 py-2.5 font-medium">Result</th>
                <th className="px-4 py-2.5 font-medium">Review?</th>
                <th className="px-4 py-2.5 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 200).map((s) => {
                const lead = leadById.get(s.lead_id);
                const meta = STATUS_META[s.result_status];
                return (
                  <tr key={s.id} className="border-b border-border-soft last:border-0">
                    <td className="px-4 py-2.5">
                      {lead ? (
                        <Link href={`/advisor/investors/${lead.id}`} className="font-medium text-primary hover:text-primary-hover">
                          {lead.first_name} {lead.last_name}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{brandById.get(s.brand_id)?.name ?? "—"}</td>
                    <td className="px-4 py-2.5">
                      <p className="text-foreground">{s.normalized_location ?? s.raw_query}</p>
                      <p className="text-[13px] text-muted-foreground">&ldquo;{s.raw_query}&rdquo; · {s.radius_miles ?? "—"} mi</p>
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge className={meta.badgeClass}>{meta.label}</Badge>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{s.request_manual_review ? "Yes" : "No"}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{new Date(s.created_at).toLocaleString()}</td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                    No searches match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </TerritoryPageShell>
  );
}
