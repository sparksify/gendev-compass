/** Standard heading block for admin section pages. */
export function AdminPageHeader({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h2 className="font-serif text-2xl font-semibold text-foreground">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
