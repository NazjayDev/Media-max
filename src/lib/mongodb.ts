import {
  MongoClient,
  type Collection,
  type CreateIndexesOptions,
  type Db,
  type Document,
  type IndexSpecification,
} from "mongodb";

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

const ensuredIndexes = new Set<string>();

/** Creates an index once per server instance instead of on every request. */
export async function ensureIndex<T extends Document>(
  collection: Collection<T>,
  spec: IndexSpecification,
  options?: CreateIndexesOptions,
): Promise<void> {
  const key = `${collection.collectionName}:${JSON.stringify(spec)}`;
  if (ensuredIndexes.has(key)) return;
  ensuredIndexes.add(key);
  await collection.createIndex(spec, options).catch(() => ensuredIndexes.delete(key));
}
