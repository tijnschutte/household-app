import prisma from '@/lib/prisma';

export default async function Page() {
    const users = await prisma.user.findMany();
    return (
        <ol className="list-decimal list-inside font-[family-name:var(--font-geist-sans)]">
            {users.map((user) => (
                <li key={user.id} className="mb-2">
                    {user.name}
                </li>
            ))}
        </ol>
    );
  }