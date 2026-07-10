import { formatEuro } from "@/src/lib/geld/money";
import type { GeldMonth } from "@/src/lib/geld/data";

// One clean card: the all-time pot balance is the headline, the month's
// netto and any still-unpaid items are a subtle line underneath. No
// stacked boxes-in-boxes.
export default function BalanceCard({ data }: { data: GeldMonth }) {
  return (
    <div className="rounded-xl border border-border bg-card px-5 py-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Op rekening
      </p>
      <p className="mt-1 text-3xl font-semibold tabular-nums">{formatEuro(data.balanceCents)}</p>
      <p className="mt-2 text-sm text-muted-foreground">
        Netto deze maand: <span className="tabular-nums">{formatEuro(data.netto)}</span>
        {data.unpaidCount > 0 && (
          <span>
            {" · "}
            {data.unpaidCount} nog niet betaald
          </span>
        )}
      </p>
    </div>
  );
}
