import { signOut } from "@/auth";
import { redirect } from "next/navigation";

export default function Page() {

    return (
      <div>
        <p>Dashboard Page!</p>;
          <button 
            className="bg-green-600"
            onClick={async () => {
              'use server';
              redirect('/dashboard/house');
            }}
          >
            Home
          </button>
          <button 
            className="bg-red-600"
            onClick={async () => {
              'use server';
              await signOut({ redirectTo: '/' });
            }}
          >
            Log out
          </button>
      </div>
  )
}


  