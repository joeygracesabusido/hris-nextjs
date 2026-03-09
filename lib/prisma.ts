import { PrismaClient } from "@prisma/client";

// Last updated: 2026-03-09T03:30:00.000Z
const prismaClientSingleton = () => {
  return new PrismaClient()
}

declare const globalThis: {
  prismaGlobal: ReturnType<typeof prismaClientSingleton>;
} & typeof global;

const prisma = globalThis.prismaGlobal ?? prismaClientSingleton()

export default prisma;

if (process.env.NODE_ENV !== "production") globalThis.prismaGlobal = prisma
