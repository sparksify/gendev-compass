import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Disclosure } from "./Disclosure";
import { formatDateTime } from "@/lib/advisor/format";
import type { LeadRecord } from "@/types/lead";

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="min-w-0">
      <p className="text-[12px] text-faint-foreground">{label}</p>
      {value ? (
        <p className="truncate text-[14px] font-medium text-foreground" title={value}>
          {value}
        </p>
      ) : (
        <p className="text-[14px] text-[#c2c9d4]">—</p>
      )}
    </div>
  );
}

/** First-touch marketing attribution, kept for the record; the deeper
 * last-touch and Facebook Lead Ads detail lives behind a disclosure. */
export function AttributionCard({ lead }: { lead: LeadRecord }) {
  return (
    <Card id="attribution" className="scroll-mt-4">
      <CardContent className="px-[15px] py-[13px]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[16.5px] font-bold text-foreground">
            Attribution · first touch
          </p>
          {lead.qualification_result === "review_required" && (
            <Badge variant="outline">Review required</Badge>
          )}
          {lead.qualification_result === "qualified" && <Badge variant="success">Qualified</Badge>}
        </div>

        <div className="mt-2.5 grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-x-[18px] gap-y-[7px]">
          <Field label="Source" value={lead.source} />
          <Field label="Campaign" value={lead.campaign} />
          <Field label="Ad set" value={lead.ad_set} />
          <Field label="Ad" value={lead.ad} />
          <Field label="Landing page" value={lead.first_landing_page} />
          <Field label="UTM source" value={lead.first_utm_source} />
          <Field label="UTM campaign" value={lead.first_utm_campaign} />
          <Field label="UTM medium" value={lead.first_utm_medium} />
          <Field label="Referrer" value={lead.first_referrer} />
          <Field
            label="Portal first opened"
            value={lead.portal_first_opened_at ? formatDateTime(lead.portal_first_opened_at) : null}
          />
        </div>

        {(lead.last_touch_at ||
          lead.facebook_lead_id ||
          lead.facebook_campaign_id ||
          lead.facebook_adset_id ||
          lead.facebook_ad_id ||
          lead.facebook_form_id) && (
          <Disclosure summary="More attribution detail" className="mt-2.5">
            <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-x-[18px] gap-y-[7px]">
              <Field label="Facebook lead ID" value={lead.facebook_lead_id} />
              <Field label="FB campaign ID" value={lead.facebook_campaign_id} />
              <Field label="FB ad set ID" value={lead.facebook_adset_id} />
              <Field label="FB ad ID" value={lead.facebook_ad_id} />
              <Field label="FB form ID" value={lead.facebook_form_id} />
              <Field label="Facebook click ID" value={lead.first_fbclid} />
              <Field label="Google click ID" value={lead.first_gclid} />
              <Field label="Last UTM source" value={lead.last_utm_source} />
              <Field label="Last UTM campaign" value={lead.last_utm_campaign} />
              <Field label="Last referrer" value={lead.last_referrer} />
              <Field
                label="Last touch at"
                value={lead.last_touch_at ? formatDateTime(lead.last_touch_at) : null}
              />
            </div>
          </Disclosure>
        )}
      </CardContent>
    </Card>
  );
}
