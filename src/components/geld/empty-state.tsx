import { Button } from "@/src/components/ui/button";
import { PiggyBank } from "lucide-react";

export default function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 py-12 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary">
        <PiggyBank className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium">Nog geen vaste posten</p>
      <p className="max-w-xs text-sm text-muted-foreground">
        Voeg de maandelijkse inleg van elk lid en de vaste lasten toe, dan houdt Mandje voor je bij
        wat er al betaald is.
      </p>
      <Button onClick={onAdd} className="mt-1">
        Post toevoegen
      </Button>
    </div>
  );
}
