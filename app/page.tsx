"use client"
import { redirect } from "next/navigation";
import { useRouter } from "next/navigation";

export default function Page() {
    const router = useRouter();

    return (
        <>
            <div>
                <p>Home Page!</p>;
                <button 
                    className="bg-green-600"
                    onClick={() => {
                        router.push('/login');
                    }}
                >
                    Sign-in
                </button>
            </div>
        </>
    );
  }