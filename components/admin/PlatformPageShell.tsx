import { PageTitle, V3Page } from "@/components/advisor/v3";
import { PlatformTabs } from "@/components/admin/PlatformTabs";

/**
 * Title + tab row + body for the Portal Admin tabs: the same title block as
 * the overview, with the section tab row under it.
 */
export function PlatformPageShell({
  title = "Portal Admin",
  subtitle,
  actions,
  bodyClassName,
  children,
}: {
  title?: string;
  subtitle: string;
  actions?: React.ReactNode;
  bodyClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <V3Page className={bodyClassName}>
      <PageTitle title={title} meta={subtitle} actions={actions} />
      <PlatformTabs />
      {children}
    </V3Page>
  );
}
