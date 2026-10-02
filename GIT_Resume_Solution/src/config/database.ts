import { MongoClient, Db } from 'mongodb';
import env from './env';

let client: MongoClient | null = null;
let db: Db | null = null;

export const connectToDatabase = async (): Promise<Db> => {
  if (db) {
    return db;
  }

  client = new MongoClient(env.mongoUri);
  await client.connect();

  db = client.db(env.mongoDbName);
  console.log(`Connected to MongoDB database: ${env.mongoDbName}`);

  return db;
};

export const getDatabase = (): Db => {
  if (!db) {
    throw new Error('Database not initialized. Call connectToDatabase() first.');
  }

  return db;
};

export const pingDatabase = async (): Promise<{ connected: boolean; latencyMs: number; errorCode?: string }> => {
  try {
    const database = await connectToDatabase();
    const start = Date.now();
    await database.command({ ping: 1 });
    const latencyMs = Date.now() - start;

    return {
      connected: true,
      latencyMs,
    };
  } catch (error) {
    return {
      connected: false,
      latencyMs: 0,
      errorCode: 'DB_CONNECTION_FAILED',
    };
  }
};

export const ensureDatabaseReady = async (): Promise<void> => {
  await connectToDatabase();
};
