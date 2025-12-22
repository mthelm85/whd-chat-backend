import sql from 'mssql';

const config = {
  server: process.env.AZURE_SQL_SERVER,
  database: process.env.AZURE_SQL_DATABASE,
  user: process.env.AZURE_SQL_USER,
  password: process.env.AZURE_SQL_PASSWORD,
  options: {
    encrypt: true,
    trustServerCertificate: false
  }
};

let pool;

export async function getPool() {
  if (!pool) {
    pool = sql.connect(config);
  }
  return pool;
}

export async function executeQuery(query) {
  try {
    const pool = await getPool();
    const result = await pool.request().query(query);
    return result.recordset;
  } catch (err) {
    console.error('Database query error:', err);
    throw err;
  }
}