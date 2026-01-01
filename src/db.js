import sql from "mssql";

const config = {
  server: process.env.AZURE_SQL_SERVER,
  database: process.env.AZURE_SQL_DATABASE,
  user: process.env.AZURE_SQL_USER,
  password: process.env.AZURE_SQL_PASSWORD,
  options: {
    encrypt: true,
    trustServerCertificate: false,
  },
  pool: {
    max: 5,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

let pool = null;
let poolPromise = null;

async function createPool() {
  const newPool = new sql.ConnectionPool(config);

  newPool.on("error", (err) => {
    console.error("SQL pool error:", err);
    pool = null;
    poolPromise = null;
  });

  await newPool.connect();
  return newPool;
}

export async function getPool() {
  if (pool) return pool;

  if (!poolPromise) {
    poolPromise = createPool()
      .then((p) => {
        pool = p;
        return p;
      })
      .catch((err) => {
        poolPromise = null;
        throw err;
      });
  }

  return poolPromise;
}

export async function executeQuery(query) {
  try {
    const pool = await getPool();
    const result = await pool.request().query(query);
    return result.recordset;
  } catch (err) {
    console.warn("Query failed, resetting pool:", err.message);

    // Force pool reset on connection-level errors
    if (
      err.code === "ECONNCLOSED" ||
      err.code === "ETIMEOUT" ||
      err.code === "ESOCKET" ||
      err.name === "ConnectionError"
    ) {
      try {
        pool?.close();
      } catch {}

      pool = null;
      poolPromise = null;

      // Retry once
      const freshPool = await getPool();
      const result = await freshPool.request().query(query);
      return result.recordset;
    }

    throw err;
  }
}
