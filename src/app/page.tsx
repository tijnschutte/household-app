import { redirect } from "next/navigation";
import { isSignedIn } from "@/src/lib/membership/gate";

const Page = async () => {
  if (!(await isSignedIn())) redirect("/sign-in");

  // /home itself redirects to /household-setup when the user has no
  // household, so nothing beyond isSignedIn's own check is needed here.
  redirect("/home");
};

export default Page;
