import { Pool, QueryResult } from 'pg';
import { logger } from '../utils/logger';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Enhanced connection monitoring
pool.on('connect', () => {
  logger.info('New database connection established');
});

pool.on('error', (err: Error) => {
  logger.error('Database connection error:', err);
  process.exit(-1);
});

// Simple query wrapper for logging (development only)
export const query = async (text: string, params?: any[]): Promise<QueryResult> => {
  const start = Date.now();
  
  if (process.env.NODE_ENV === 'development') {
    logger.debug('Executing query:', {
      query: text,
      params: params || []
    });
  }
  
  try {
    const result = await pool.query(text, params);
    
    if (process.env.NODE_ENV === 'development') {
      const duration = Date.now() - start;
      logger.debug('Query completed:', {
        duration: `${duration}ms`,
        rows: result.rowCount || 0
      });
    }
    
    return result;
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      const duration = Date.now() - start;
      logger.error('Query error:', {
        duration: `${duration}ms`,
        error: (error as Error).message,
        query: text,
        params: params || []
      });
    }
    throw error;
  }
};

// Test database connection
export const testConnection = async (): Promise<void> => {
  try {
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();
    logger.info('Database connection test successful');
  } catch (error) {
    logger.error('Database connection test failed:', error);
    throw error;
  }
};

// Get a client from the pool
export const getClient = () => {
  return pool.connect();
};

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Closing database connection pool...');
  await pool.end();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Closing database connection pool...');
  await pool.end();
  process.exit(0);
});

export default pool;