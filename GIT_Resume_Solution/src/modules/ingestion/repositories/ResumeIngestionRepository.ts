import { MongoClient, Db, ObjectId } from 'mongodb';
import env from '../../../config/env';

export interface StoredResumeDocument {
  _id?: ObjectId;
  fileName?: string;
  rawText?: string;
  name?: string;
  email?: string | null;
  phone?: string | null;
  location?: string | null;
  company?: string | null;
  role?: string | null;
  education?: string | null;
  totalExperience?: number | null;
  relevantExperience?: number | null;
  skills?: string[];
  jobTitles?: string[];
  experienceSummary?: string;
  embedding?: number[];
  embeddingModel?: string;
  embeddingDimension?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export class ResumeIngestionRepository {
  private client: MongoClient | null = null;
  private db: Db | null = null;

  async connect(): Promise<Db> {
    if (this.db) return this.db;

    this.client = new MongoClient(env.mongoUri);
    await this.client.connect();
    this.db = this.client.db(env.mongoDbName);
    return this.db;
  }

  async insertResume(document: StoredResumeDocument): Promise<string> {
    const db = await this.connect();
    const result = await db.collection('resumes').insertOne({
      ...document,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return result.insertedId.toString();
  }

  async close(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.db = null;
    }
  }
}
