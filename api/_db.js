// Shared database client. The Neon integration on Vercel sets DATABASE_URL
// automatically when you create the database (Storage -> Create Database -> Neon).
import { neon } from "@neondatabase/serverless";

const connectionString =
  process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL;

if (!connectionString) {
  console.warn("[db] No DATABASE_URL set - create a Neon database in Vercel Storage.");
}

export const sql = neon(connectionString);
export const hasDb = !!connectionString;
