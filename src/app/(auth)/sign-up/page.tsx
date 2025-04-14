import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/src/lib/auth";
import { signUp } from "@/src/lib/actions";

const Page = async () => {
  const session = await auth();
  if (session) redirect("/");

  return (
    <div className="w-full max-w-sm mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-center mb-6">Create Account</h1>

      {/* Email/Password Sign Up */}
      <form
        className="space-y-4"
        action={async (formData) => {
          "use server";
          const res = await signUp(formData);
          if (res.success) {
            redirect("/sign-in");
          }
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
          autoComplete="new-password"
        />
        <Button className="w-full" type="submit">
          Sign Up
        </Button>
      </form>

      <div className="text-center">
        <Button asChild variant="link">
          <Link href="/sign-in">Already have an account? Sign in</Link>
        </Button>
      </div>
    </div>
  );
};

export default Page;