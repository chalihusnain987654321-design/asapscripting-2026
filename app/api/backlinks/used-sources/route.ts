import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB, Backlink } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

// GET /api/backlinks/used-sources?targetWebsiteId=X
// Returns source site IDs that already have a pending/approved backlink for this target.
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const targetWebsiteId = searchParams.get("targetWebsiteId")?.trim() ?? "";

  if (!targetWebsiteId) return Response.json({ usedSiteIds: [] });

  await connectDB();

  const used = await Backlink.find({
    targetWebsiteId,
    approvalStatus: { $in: ["pending", "approved"] },
  }).select("sourceSiteId").lean();

  const usedSiteIds = Array.from(
    new Set(used.map((b) => (b as unknown as Record<string, string>).sourceSiteId).filter(Boolean))
  );

  return Response.json({ usedSiteIds });
}
