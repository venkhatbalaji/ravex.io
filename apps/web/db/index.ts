import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

let client: ReturnType<typeof postgres> | undefined;

export function getDb() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not configured. Copy apps/web/.env.example to apps/web/.env.local.");

  client ??= postgres(connectionString, { max: 5, idle_timeout: 20 });
  return drizzle(client, { schema });
}
