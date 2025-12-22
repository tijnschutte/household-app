import { auth } from "@/src/lib/auth";
import { redirect } from "next/navigation";
import { findHomeByUserId } from "@/src/lib/actions";

const Page = async () => {
  const session = await auth();
  if (!session) redirect("/sign-in");

  const home = await findHomeByUserId(Number(session.user?.id));

  if (home) {
    redirect("/home");
  } else {
    redirect("/household-setup");
  }
};

export default Page;