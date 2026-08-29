import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/card";
import { redirect } from "next/navigation";
import Link from "next/link";
import { isSignedIn } from "@/src/lib/membership/gate";
import { signUp } from "@/src/lib/account/actions";
import SignUpForm from "@/src/components/auth/sign-up-form";
import BrandMark from "@/src/components/brand-mark";

const Page = async () => {
  // See sign-in/page.tsx: a raw JWT check here would loop against "/" for a
  // session whose user row is gone.
  if (await isSignedIn()) redirect("/");

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center bg-background p-4">
      <BrandMark />
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-xl font-semibold">Account aanmaken</CardTitle>
          <CardDescription>Voer je gegevens in om een account aan te maken</CardDescription>
        </CardHeader>
        <CardContent>
          <SignUpForm onSignUp={signUp} />
        </CardContent>
        <CardFooter className="flex flex-col space-y-2">
          <div className="text-sm text-muted-foreground text-center">
            Al een account?{" "}
            <Link href="/sign-in" className="font-medium text-primary hover:underline">
              Inloggen
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
};

export default Page;
