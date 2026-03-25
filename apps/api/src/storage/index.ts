import { Pool } from "pg";

import { config } from "../config.js";
import { MemoryStore } from "./memoryStore.js";
import { PostgresStore } from "./postgresStore.js";
import type { Store } from "./store.js";

export function createStore(): Store {
  if (!config.databaseUrl) {
    return new MemoryStore();
  }

  return new PostgresStore(
    new Pool({
      connectionString: config.databaseUrl,
      ssl: config.databaseUrl.includes("localhost")
        ? false
        : {
            rejectUnauthorized: false,
          },
    }),
  );
}
