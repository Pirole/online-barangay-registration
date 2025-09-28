import { Pool, PoolClient } from 'pg';
import { logger } from '../utils/logger';

let pool: Pool | null = null;

export async function connectDatabase(): Promise<Pool> {
  if (!pool) {
    try {
      pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
      });

      // Test connection
      const client = await pool.connect();
      await client.query('SELECT NOW()');
      client.release();

      logger.info('Database pool created successfully');

      pool.on('error', (err) => {
        logger.error('Unexpected error on idle client', err);
      });
    } catch (error) {
      logger.error('Failed to create database pool:', error);
      throw error;
    }
  }
  return pool;
}

export async function query(text: string, params?: any[]): Promise<any> {
  if (!pool) {
    throw new Error('Database pool not initialized');
  }

  const client = await pool.connect();
  try {
    return await client.query(text, params);
  } finally {
    client.release();
  }
}

export async function getClient(): Promise<PoolClient> {
  if (!pool) {
    throw new Error('Database pool not initialized');
  }
  return pool.connect();
}
