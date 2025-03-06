import { fetchHouseholds } from "@/app/lib/data";

export default async function Page() {
    const households = await fetchHouseholds();
    return (
        <main>
      </main>
    );
  }