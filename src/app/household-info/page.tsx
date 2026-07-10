import { redirect } from "next/navigation";

// The household info page moved into the Huis tab; keep the old URL working
// for installed PWAs and bookmarks.
export default function HouseholdInfoPage() {
  redirect("/huis");
}
