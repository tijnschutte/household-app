import { auth } from "@/src/lib/auth";
import { redirect } from "next/navigation";

const Page = async () => {
  const session = await auth();
  if (!session) redirect("/sign-in");

  // /home itself redirects to /household-setup when the user has no
  // household, so no DB lookup is needed on this hot startup path.
  redirect("/home");
};

export default Page;
