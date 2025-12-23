import { auth, signIn } from "@/src/lib/auth";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
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
import { executeAction } from "@/src/lib/executeAction";

const Page = async () => {
  const session = await auth();
  console.log("Session:", session);
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
          <form
            className="space-y-4"
            action={async (formData) => {
              "use server";
              await executeAction({
                actionFn: async () => {
                  await signIn("credentials", formData);
                },
              });
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="username">Gebruikersnaam</Label>
              <Input
                id="username"
                name="username"
                placeholder="Voer je gebruikersnaam in"
                type="text"
                required
                autoComplete="username"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Wachtwoord</Label>
              <Input
                id="password"
                name="password"
                placeholder="Voer je wachtwoord in"
                type="password"
                required
                autoComplete="current-password"
              />
            </div>
            <Button className="w-full" type="submit">
              Inloggen
            </Button>
          </form>
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