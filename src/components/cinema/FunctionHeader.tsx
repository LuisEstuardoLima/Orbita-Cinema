export function FunctionHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <div className="card-surface mb-8 overflow-hidden">
      <div className="border-l-4 border-primary px-8 py-6 text-center">
        <h1 className="text-4xl uppercase tracking-[0.15em] md:text-5xl">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground md:text-base">{subtitle}</p>
      </div>
    </div>
  );
}
