import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: "postgresql://o:V4xzmUsgj1SW41qzkAEQ0QZMbLJg7Rnj@dpg-d56g8hchg0os73am2amg-a.frankfurt-postgres.render.com/o_9nk3" });
export const db = drizzle(pool, { schema });
