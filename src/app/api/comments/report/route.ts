import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { auth } from "@/auth";
import { HIDE_AFTER_REPORTS, commentsCollection } from "@/lib/comments";
import { allowRequest } from "@/lib/rateLimit";

export async function POST(request: NextRequest) {
  const userId = (await auth())?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  if (!(await allowRequest("report", userId, 20, 3600))) {
    return NextResponse.json({ error: "Too many reports. Try again later." }, { status: 429 });
  }

  const body = (await request.json().catch(() => null)) as { id?: string } | null;
  if (!body?.id || !ObjectId.isValid(body.id)) {
    return NextResponse.json({ error: "Invalid comment" }, { status: 400 });
  }

  const collection = await commentsCollection();
  if (!collection) {
    return NextResponse.json({ error: "Discussion is unavailable" }, { status: 503 });
  }

  const _id = new ObjectId(body.id);
  const updated = await collection.findOneAndUpdate(
    { _id, userId: { $ne: userId } },
    { $addToSet: { reports: userId } },
    { returnDocument: "after" }
  );
  if (!updated) {
    return NextResponse.json({ error: "Nothing to report" }, { status: 404 });
  }

  // A comment reported by enough different people is hidden until someone reviews it.
  if ((updated.reports?.length ?? 0) >= HIDE_AFTER_REPORTS && !updated.hidden) {
    await collection.updateOne({ _id }, { $set: { hidden: true } });
  }
  return NextResponse.json({ ok: true });
}
