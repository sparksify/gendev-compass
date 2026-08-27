import { Panel, PanelHeader } from "@/components/advisor/v3";
import { formatRelative } from "@/lib/advisor/format";
import { ghlContactUrl, type GhlTagsState } from "@/lib/ghl/contactTags";

/** Tags this app itself applies, so they read as ours rather than the CRM's. */
const OWNED_TAGS = new Set(["fdd_requested"]);

function Tag({ label, highlight }: { label: string; highlight: boolean }) {
  return (
    <span
      className={
        highlight
          ? "rounded-[7px] border border-accent-soft-border bg-warning-soft px-[9px] py-[3px] text-[11.5px] font-bold text-accent-strong"
          : "rounded-[7px] border border-[#e0e7e1] bg-[#eef1ef] px-[9px] py-[3px] text-[11.5px] font-semibold text-secondary-foreground"
      }
    >
      {label}
    </span>
  );
}

/**
 * The lead's GoHighLevel tags. HighLevel is the system of record for these —
 * this app pushes one tag (the FDD request) and reads the rest back — so the
 * card is deliberately read-only and links out to HighLevel to change them.
 *
 * The three states are all rendered honestly: connected (with the time the
 * tags were actually read), reachable-but-failed, and not configured. There is
 * no fabricated "synced N minutes ago" stamp when nothing was synced.
 */
export function TagsCard({ tags }: { tags: GhlTagsState }) {
  const contactUrl = tags.status === "ok" ? ghlContactUrl(tags.contactId) : null;

  return (
    <Panel>
      <PanelHeader
        title="Tags"
        meta={
          <span className="text-[11.5px] font-semibold text-faint-foreground">
            {tags.status === "ok"
              ? `Synced from HighLevel · ${formatRelative(tags.fetchedAt)}`
              : tags.status === "not_configured"
                ? "HighLevel not connected"
                : "HighLevel unavailable"}
          </span>
        }
      />

      {tags.status === "ok" && tags.tags.length > 0 && (
        <div className="mt-[11px] flex flex-wrap gap-1.5">
          {tags.tags.map((tag) => (
            <Tag key={tag} label={tag} highlight={OWNED_TAGS.has(tag.toLowerCase())} />
          ))}
        </div>
      )}

      {tags.status === "ok" && tags.tags.length === 0 && (
        <p className="mt-2.5 text-[12.5px] text-muted-foreground">
          This contact has no tags in HighLevel yet.
        </p>
      )}

      {tags.status === "unavailable" && (
        <p className="mt-2.5 text-[12.5px] text-muted-foreground">
          {tags.reason} Tags are maintained in HighLevel and will appear here once it responds.
        </p>
      )}

      {tags.status === "not_configured" && (
        <p className="mt-2.5 text-[12.5px] text-muted-foreground">
          Set <code className="rounded bg-[#eef1ef] px-1.5 py-px text-[11.5px]">GHL_API_TOKEN</code>{" "}
          to read this contact&rsquo;s HighLevel tags.
        </p>
      )}

      {contactUrl && (
        <a
          href={contactUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-2.5 inline-block text-[12px] font-bold text-primary hover:underline"
        >
          Manage in HighLevel ↗
        </a>
      )}
    </Panel>
  );
}
