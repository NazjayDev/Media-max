// Prints the newest feedback people sent through the site.
// Usage: node --env-file=.env.local scripts/read-feedback.mjs [count]
import { MongoClient } from "mongodb";

const count = Number(process.argv[2]) || 30;
const client = await new MongoClient(process.env.MONGODB_URI).connect();
const docs = await client
  .db("mediamax")
  .collection("feedback")
  .find({})
  .sort({ createdAt: -1 })
  .limit(count)
  .toArray();

if (docs.length === 0) console.log("No feedback yet.");
for (const d of docs) {
  console.log(
    `\n[${d.createdAt.toISOString().slice(0, 16).replace("T", " ")}] ${d.kind.toUpperCase()}` +
      `  ${d.path || ""}${d.contact ? `  reply: ${d.contact}` : ""}${d.userId ? "  (signed in)" : ""}`,
  );
  console.log(d.message);
}
await client.close();
