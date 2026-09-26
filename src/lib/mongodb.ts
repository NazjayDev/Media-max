import { MongoClient, type Db } from "mongodb";

const globalForMongo = globalThis as unknown as { mongoClient?: Promise<MongoClient> };

/** Returns the shared database handle, or null when MongoDB isn't configured or reachable. */
export async function getDb(): Promise<Db | null> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    return null;
  }

  try {
    globalForMongo.mongoClient ??= new MongoClient(uri, {
      serverSelectionTimeoutMS: 5000,
    }).connect();
    const client = await globalForMongo.mongoClient;
    return client.db("mediamax");
  } catch (error) {
    globalForMongo.mongoClient = undefined;
    console.error("MongoDB unavailable:", error instanceof Error ? error.name : error);
    return null;
  }
}
