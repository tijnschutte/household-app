import { FolderOpen } from "lucide-react";

// No inline CTA — the page's footer "Document toevoegen" button covers it.
export default function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary">
        <FolderOpen className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium">Nog geen documenten</p>
      <p className="max-w-xs text-sm text-muted-foreground">
        Voeg contracten, handleidingen en andere belangrijke bestanden toe.
      </p>
    </div>
  );
}
