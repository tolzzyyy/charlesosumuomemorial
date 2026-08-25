import "dotenv/config";
import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { migrateDatabase, openDatabase } from "./database.js";
import { seedDatabase } from "./seed.js";

const config = loadConfig();
const database = openDatabase(config.databasePath);

migrateDatabase(database);
seedDatabase(database);

const app = createApp({ database, config });
const server = app.listen(config.port, () => {
  console.log(`Tribute API listening on http://localhost:${config.port}`);
});

function shutdown(signal: string) {
  console.log(`${signal} received. Closing the API.`);
  server.close(() => {
    database.close();
    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
