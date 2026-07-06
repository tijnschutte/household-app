import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

export async function main() {
  const password = await bcrypt.hash('password', 10)
  await prisma.user.upsert({
    where: { name: 'Tijn' },
    update: {},
    create: {
      name: 'Tijn',
      password,
      household: {
        create: {
          name: 'CD26',
          secret: 'LOCALDEV1234',
        },
      },
    },
  })
  console.log('Seeded: user "Tijn" (password "password"), household "CD26" (code LOCALDEV1234)')
}

main()