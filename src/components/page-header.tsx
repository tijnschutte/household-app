// Flat brand-blue header shared by every module. Equal-width side slots keep
// the title visually centered even when only one side has a button.
export default function PageHeader({
  title,
  left,
  right,
}: {
  title: string;
  left?: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <header className="flex h-14 w-full shrink-0 items-center bg-primary px-2">
      <div className="flex w-10 shrink-0 justify-start">{left}</div>
      <h2 className="min-w-0 flex-1 truncate text-center text-lg font-semibold tracking-wide text-primary-foreground">
        {title}
      </h2>
      <div className="flex w-10 shrink-0 justify-end">{right}</div>
    </header>
  );
}
