import { ShoppingBasket } from "lucide-react";

// Shared brand moment above the auth card: basket mark + app name. Used on
// sign-in and sign-up so both screens open with the same identity beat.
export default function BrandMark() {
  return (
    <div className="mb-6 flex flex-col items-center gap-2">
      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
        <ShoppingBasket className="h-6 w-6" />
      </span>
      <span className="text-lg font-semibold tracking-wide text-foreground">Mandje</span>
    </div>
  );
}
