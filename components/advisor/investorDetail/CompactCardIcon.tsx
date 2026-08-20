export function CompactCardIcon({ icon: Icon }: { icon: React.ComponentType<{ className?: string }> }) {
  return (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-control bg-primary-soft text-primary">
      <Icon className="size-4" />
    </span>
  );
}
