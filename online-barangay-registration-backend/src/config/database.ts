import { Pool } from 'pg';
import { logger } from '../utils/logger';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20, // maximum number of connections in the pool
  idleTimeoutMillis: 30000, // how long a client is allowed to remain idle
  connectionTimeoutMillis: 2000, // how long to wait when connecting a new client
});

// Test database connection
pool.on('connect', () => {
  logger.info('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  logger.error('Unexpected error on idle client', err);
  process.exit(-1);
});

export const query = (text: string, params?: any[]): Promise<any> => {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    pool.query(text, params, (err, res) => {
      const duration = Date.now() - start;
      logger.debug('Executed query', { text, duration, rows: res?.rowCount });
      
      if (err) {
        logger.error('Query error', { text, error: err.message });
        reject(err);
      } else {
        resolve(res);
      }
    });
  });
};

export const getClient = () => {
  return pool.connect();
};

export { pool };