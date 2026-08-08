import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

// dev の Fast Refresh でクライアントが増殖して接続を食い潰すのを防ぐ
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL が未設定です");

  // Prisma 7 はドライバアダプタ必須。
  // idleTimeoutMillis を短くしているのは、サーバー側（prisma dev のプロキシや Neon の
  // プーラー）が先にアイドル接続を切ると、プールが死んだ接続を配って
  // "Connection terminated unexpectedly" になるため。こちらから先に捨てる。
  return new PrismaClient({
    adapter: new PrismaPg({
      connectionString,
      max: 10,
      idleTimeoutMillis: 1_000,
      connectionTimeoutMillis: 10_000,
    }),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
