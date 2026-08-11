import { CheckCircle2, XCircle } from "lucide-react";
import { getStore } from "@/lib/store";
import { Card, CardContent } from "@/components/ui/card";
import { CSV_TEMPLATE_HEADER } from "@/lib/territory/csv";
import { getDefaultRadiusMiles } from "@/lib/config/territory";
import { getTerritoryWebhookUrl } from "@/lib/territory/webhook";

export const dynamic = "force-dynamic";

function ConfigRow({ label, configured, detail }: { label: string; configured: boolean; detail?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border-soft py-3 last:border-0">
      <div>
        <p className="text-[13.5px] font-medium text-foreground">{label}</p>
        {detail && <p className="text-[12px] text-muted-foreground">{detail}</p>}
      </div>
      {configured ? (
        <span className="flex items-center gap-1.5 text-[12.5px] font-medium text-success">
          <CheckCircle2 className="size-4" strokeWidth={1.8} /> Configured
        </span>
      ) : (
        <span className="flex items-center gap-1.5 text-[12.5px] font-medium text-muted-foreground">
          <XCircle className="size-4" strokeWidth={1.8} /> Not set
        </span>
      )}
    </div>
  );
}

export default async function TerritorySettingsPage() {
  const brands = await getStore().listBrands();

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-5">
          <p className="text-[13.5px] font-bold text-foreground">Environment configuration</p>
          <p className="mt-1 text-[12.5px] text-muted-foreground">
            Read-only status — set these in your deployment environment (see .env.example). Secrets are
            never displayed here.
          </p>
          <div className="mt-3">
            <ConfigRow
              label="Geocoding provider"
              configured
              detail={`GEOCODING_PROVIDER=${process.env.GEOCODING_PROVIDER ?? "local (built-in, no API key required)"}`}
            />
            <ConfigRow
              label="Default evaluation radius"
              configured
              detail={`${getDefaultRadiusMiles()} miles (DEFAULT_TERRITORY_RADIUS_MILES)`}
            />
            <ConfigRow
              label="Territory review webhook"
              configured={Boolean(getTerritoryWebhookUrl())}
              detail={
                getTerritoryWebhookUrl()
                  ? "TERRITORY_REVIEW_WEBHOOK_URL is set — review requests are dispatched to it."
                  : "TERRITORY_REVIEW_WEBHOOK_URL is not set — requests are only recorded in the admin queue (simulated in dev)."
              }
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
          <p className="text-[13.5px] font-bold text-foreground">Brands</p>
          <div className="mt-3 space-y-2">
            {brands.map((b) => (
              <div key={b.id} className="flex items-center justify-between rounded-control border border-border-soft px-3 py-2 text-[13px]">
                <span className="font-medium text-foreground">{b.name}</span>
                <span className="text-muted-foreground">
                  slug: {b.slug} · default radius: {b.default_radius_miles} mi · {b.active ? "active" : "inactive"}
                </span>
              </div>
            ))}
            {brands.length === 0 && <p className="text-muted-foreground">No brands configured.</p>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
          <p className="text-[13.5px] font-bold text-foreground">ZIP-code CSV import template</p>
          <p className="mt-1 text-[12.5px] text-muted-foreground">Use on the Territory Records tab.</p>
          <pre className="mt-2 overflow-x-auto rounded-control border border-border bg-surface p-3 text-[11.5px]">
{CSV_TEMPLATE_HEADER}
{"\n"}cmdt,Dallas Uptown Territory,DAL-01,sold,75201,generalized,
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
