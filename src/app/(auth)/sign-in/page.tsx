import { auth, signIn } from "@/src/lib/auth";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import Link from "next/link";
import { redirect } from "next/navigation";
import { executeAction } from "@/src/lib/executeAction";

const Page = async () => {
  const session = await auth();
  console.log("Session:", session);
  if (session) redirect("/");

  return (
    <div className="flex flex-col w-full h-full justify-center items-center space-y-6 px-10">
      <h1 className="text-2xl font-bold text-center mb-6">Sign In</h1>
      
      {/* Email/Password Sign In */}
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
        <Input
          name="username"
          placeholder="Username"
          type="text"
          required
          autoComplete="username"
        />
        <Input
          name="password"
          placeholder="Password"
          type="password"
          required
          autoComplete="current-password"
        />
        <Button className="w-full" type="submit">
          Sign In
        </Button>
      </form>

      <div className="text-center">
        <Button asChild variant="link">
          <Link href="/sign-up">Don&apos;t have an account? Sign up</Link>
        </Button>
      </div>
    </div>
  );
};

export default Page;