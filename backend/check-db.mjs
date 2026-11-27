import pg from "pg";

const client = new pg.Client({
  connectionString: "postgresql://stockflow:stockflow_local@127.0.0.1:5433/stockflow",
  connectionTimeoutMillis: 5000,
});

const t0 = Date.now();
try {
  await client.connect();
  const { rows } = await client.query("SELECT current_database() AS db, now() AS ts");
  console.log(`✅ connected in ${Date.now() - t0}ms`, rows[0]);
  await client.end();
} catch (e) {
  console.log(`❌ failed after ${Date.now() - t0}ms: ${e.message}`);
}
