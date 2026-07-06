import { auth } from "@/src/lib/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/card";
import Link from "next/link";
import { redirect } from "next/navigation";
import SignInForm from "@/src/components/auth/sign-in-form";
import BrandMark from "@/src/components/brand-mark";

const Page = async () => {
  const session = await auth();
  if (session) redirect("/");

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center bg-background p-4">
      <BrandMark />
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-xl font-semibold">Inloggen</CardTitle>
          <CardDescription>
            Voer je gegevens in om toegang te krijgen tot je account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SignInForm />
        </CardContent>
        <CardFooter className="flex flex-col space-y-2">
          <div className="text-sm text-muted-foreground text-center">
            Nog geen account?{" "}
            <Link href="/sign-up" className="font-medium text-primary hover:underline">
              Registreren
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
};

export default Page;
