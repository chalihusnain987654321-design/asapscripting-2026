import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB, Backlink } from "@/lib/mongodb";

// PATCH /api/backlinks/[id] — owner or super-admin can edit
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const existing = await Backlink.findById(params.id);
  if (!existing) return Response.json({ error: "Not found." }, { status: 404 });

  const isOwner = existing.userId === session.user.id;
  const isSuperAdmin = session.user.role === "super-admin";

  if (!isOwner && !isSuperAdmin) {
    return Response.json({ error: "You can only edit your own backlinks." }, { status: 403 });
  }

  const body = await req.json();
  const allowed = ["websiteName", "targetUrl", "backlinkUrl", "anchorText", "type", "da", "status", "notes"];
  const update: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) update[key] = body[key];
  }
  if (body.date) update.createdAt = new Date(body.date);

  const updated = await Backlink.findByIdAndUpdate(params.id, update, { new: true }).lean();
  if (!updated) return Response.json({ error: "Not found." }, { status: 404 });

  return Response.json({
    id: updated._id.toString(),
    userId: updated.userId,
    userName: updated.userName,
    websiteName: updated.websiteName,
    targetUrl: updated.targetUrl,
    backlinkUrl: updated.backlinkUrl,
    anchorText: updated.anchorText,
    type: updated.type,
    da: updated.da,
    status: updated.status,
    notes: updated.notes,
    createdAt: updated.createdAt.toISOString(),
  });
}

// DELETE /api/backlinks/[id] — owner or super-admin can delete
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const existing = await Backlink.findById(params.id);
  if (!existing) return Response.json({ error: "Not found." }, { status: 404 });

  const isOwner = existing.userId === session.user.id;
  const isSuperAdmin = session.user.role === "super-admin";

  if (!isOwner && !isSuperAdmin) {
    return Response.json({ error: "You can only delete your own backlinks." }, { status: 403 });
  }

  await Backlink.findByIdAndDelete(params.id);
  return Response.json({ success: true });
}
