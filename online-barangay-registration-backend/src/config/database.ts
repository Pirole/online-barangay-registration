import { Pool, PoolClient } from 'pg';
import { logger } from '../utils/logger';

let pool: Pool | null = null;

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'barangay_registration',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
};

export async function connectDatabase(): Promise<Pool> {
  if (!pool) {
    try {
      pool = new Pool(dbConfig);
      
      // Test the connection
      const client = await pool.connect();
      await client.query('SELECT NOW()');
      client.release();
      
      logger.info('Database pool created successfully');
      
      // Handle pool errors
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
  const client = await pool?.connect();
  if (!client) {
    throw new Error('Database pool not initialized');
  }
  
  try {
    const start = Date.now();
    const result = await client.query(text, params);
    const duration = Date.now() - start;
    
    if (duration > 1000) {
      logger.warn(`Slow query detected (${duration}ms):`, text);
    }
    
    return result;
  } catch (error) {
    logger.error('Database query error:', { query: text, params, error });
    throw error;
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