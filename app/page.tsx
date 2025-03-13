import { redirect } from "next/navigation";

export default async function Page() { 
    return (
        <>
            <div>
                <p>Home Page!</p>;
                <button 
                    className="bg-green-600"
                    onClick={async () => {
                        redirect('/login');
                    }}
                >
                    Sign-in
                </button>
            </div>
        </>
    );
  }