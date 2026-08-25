import { PageBody, PageHeader } from "@/components/advisor/PageHeader";
import { PlatformTabs } from "@/components/admin/PlatformTabs";

/**
 * Header + body for the Portal Admin tabs: the same title block as the
 * overview, with the section tab row inside it.
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
    <>
      <PageHeader title={title} subtitle={subtitle} actions={actions} tabs={<PlatformTabs />} />
      <PageBody className={bodyClassName}>{children}</PageBody>
    </>
  );
}
