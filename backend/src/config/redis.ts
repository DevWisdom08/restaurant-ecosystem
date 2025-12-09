import Redis from 'ioredis';
import { logger } from './logger';

let redisClient: Redis | null = null;

export async function connectRedis(): Promise<Redis> {
  try {
    if (redisClient) {
      return redisClient;
    }
    
    redisClient = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD || undefined,
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3
    });
    
    redisClient.on('connect', () => {
      logger.info('Redis connection established');
    });
    
    redisClient.on('error', (error) => {
      logger.error('Redis connection error:', error);
    });
    
    // Test connection
    await redisClient.ping();
    
    return redisClient;
  } catch (error) {
    logger.error('Redis connection failed:', error);
    throw error;
  }
}

export function getRedisClient(): Redis {
  if (!redisClient) {
    throw new Error('Redis client not initialized. Call connectRedis() first.');
  }
  return redisClient;
}

export async function closeRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    logger.info('Redis connection closed');
  }
}

// Cache helpers
export async function setCache(key: string, value: any, ttl: number = 300): Promise<void> {
  const client = getRedisClient();
  await client.setex(key, ttl, JSON.stringify(value));
}

export async function getCache<T>(key: string): Promise<T | null> {
  const client = getRedisClient();
  const value = await client.get(key);
  return value ? JSON.parse(value) : null;
}

export async function deleteCache(key: string): Promise<void> {
  const client = getRedisClient();
  await client.del(key);
}

export async function deleteCachePattern(pattern: string): Promise<void> {
  const client = getRedisClient();
  const keys = await client.keys(pattern);
  if (keys.length > 0) {
    await client.del(...keys);
  }
}

