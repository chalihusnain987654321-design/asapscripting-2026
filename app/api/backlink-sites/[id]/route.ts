import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB, BacklinkSite } from "@/lib/mongodb";

// DELETE /api/backlink-sites/[id] — own site for sub-lead, any for super-admin
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role;
  if (role !== "super-admin" && role !== "sub-lead") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  await connectDB();
  const site = await BacklinkSite.findById(params.id);
  if (!site) return Response.json({ error: "Not found." }, { status: 404 });

  if (role === "sub-lead" && site.addedBy !== session.user.id) {
    return Response.json({ error: "You can only delete sites you added." }, { status: 403 });
  }

  await site.deleteOne();
  return Response.json({ success: true });
}
