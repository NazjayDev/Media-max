import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { auth } from "@/auth";
import {
  HIDE_AFTER_REPORTS,
  REPORT_REASONS,
  SPOILER_AFTER_REPORTS,
  commentsCollection,
  type ReportReason,
} from "@/lib/comments";
import { allowRequest } from "@/lib/rateLimit";

export async function POST(request: NextRequest) {
  const userId = (await auth())?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  if (!(await allowRequest("report", userId, 20, 3600))) {
    return NextResponse.json({ error: "Too many reports. Try again later." }, { status: 429 });
  }

  const body = (await request.json().catch(() => null)) as { id?: string; reason?: string } | null;
  if (!body?.id || !ObjectId.isValid(body.id)) {
    return NextResponse.json({ error: "Invalid comment" }, { status: 400 });
  }
  if (!REPORT_REASONS.includes(body.reason as ReportReason)) {
    return NextResponse.json({ error: "Choose a reason" }, { status: 400 });
  }
  const reason = body.reason as ReportReason;

  const collection = await commentsCollection();
  if (!collection) {
    return NextResponse.json({ error: "Discussion is unavailable" }, { status: 503 });
  }

  const _id = new ObjectId(body.id);
  const comment = await collection.findOne({ _id, userId: { $ne: userId } });
  if (!comment) {
    return NextResponse.json({ error: "Nothing to report" }, { status: 404 });
  }

  // One report per person per comment; repeat reports are accepted but not counted twice.
  if (!comment.reports?.some((r) => r.userId === userId)) {
    const updated = await collection.findOneAndUpdate(
      { _id, "reports.userId": { $ne: userId } },
      { $push: { reports: { userId, reason, at: new Date() } } },
      { returnDocument: "after" }
    );

    const reports = updated?.reports ?? [];
    const spoilerReports = reports.filter((r) => r.reason === "spoiler").length;
    const harmfulReports = reports.length - spoilerReports;

    if (harmfulReports >= HIDE_AFTER_REPORTS && !updated?.hidden) {
      // Hurtful, off-topic or spam: hidden until someone reviews it.
      await collection.updateOne({ _id }, { $set: { hidden: true } });
    } else if (spoilerReports >= SPOILER_AFTER_REPORTS && !updated?.spoiler) {
      // Unmarked spoiler: cover it instead of removing it.
      await collection.updateOne({ _id }, { $set: { spoiler: true, spoilerFlagged: true } });
    }
  }

  return NextResponse.json({ ok: true });
}
