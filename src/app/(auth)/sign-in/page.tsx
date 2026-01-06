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

const Page = async () => {
  const session = await auth();
  if (session) redirect("/");

  return (
    <div className="flex min-h-screen w-full items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Inloggen</CardTitle>
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
            <Link
              href="/sign-up"
              className="font-medium text-primary hover:underline"
            >
              Registreren
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
};

export default Page;