import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function seed() {
  const usersToSeed = [
    { email: 'yuvrajsingh2351@gmail.com', password: '123456', role: 'owner' },
    { email: 'testuser123@gmail.com', password: '123456', role: 'customer' }
  ]

  for (const { email, password, role } of usersToSeed) {
    const normalizedEmail = email.trim().toLowerCase()
    
    // Check for duplicates
    const existingUsers = await prisma.user.findMany({
      where: { email: normalizedEmail },
      orderBy: { createdAt: 'desc' }
    })

    let targetUserId = null

    if (existingUsers.length > 0) {
      targetUserId = existingUsers[0].id
      // delete duplicates
      if (existingUsers.length > 1) {
        for (let i = 1; i < existingUsers.length; i++) {
          await prisma.user.delete({ where: { id: existingUsers[i].id } })
          console.log(`Deleted duplicate user ${existingUsers[i].id}`)
        }
      }
    }

    const passwordHash = await bcrypt.hash(password, 10)

    if (targetUserId) {
      await prisma.user.update({
        where: { id: targetUserId },
        data: { passwordHash, role }
      })
      console.log(`Updated existing user: ${normalizedEmail}`)
    } else {
      await prisma.user.create({
        data: { email: normalizedEmail, passwordHash, role }
      })
      console.log(`Created new user: ${normalizedEmail}`)
    }
  }
}

seed()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect())
