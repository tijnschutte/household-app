"use client";
import { Button } from "@/src/components/ui/button";
import { signOut } from "next-auth/react";

const SignOut = () => {
  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <div className="flex justify-center">
      <Button 
        className="bg-red-500" 
        variant="destructive" 
        onClick={handleSignOut}
      >
        Sign Out
      </Button>
    </div>
  );
};

export { SignOut };