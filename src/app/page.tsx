import { SignOut } from "@/src/components/sign-out";
import { auth } from "@/src/lib/auth";
import { redirect } from "next/navigation";
import { findHomeByUserId } from "@/src/lib/actions";
import { Button } from "../components/ui/button";
import Link from "next/link";

const Page = async () => {
  const session = await auth();
  if (!session) redirect("/sign-in");
  
  const home = await findHomeByUserId(Number(session.user?.id));
  
  return (
    <>
      <div className="bg-gray-100 rounded-lg p-4 text-center mb-6">
        <p className="text-gray-600">Signed in as:</p>
        <p className="font-medium">{session.user?.name}</p>
      </div>
      <div className="flex flex-col gap-4">
        <Link href="/home">
          <Button className="w-full flex justify-center" variant="destructive">
            {home ? "Manage Home" : "Create Home"}
          </Button>
        </Link>
        <SignOut />
      </div>
    </>
  );
};

export default Page;