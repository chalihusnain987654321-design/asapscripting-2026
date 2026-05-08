import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB, BacklinkSite } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

// GET /api/backlink-sites — all authenticated users can see the pool
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const sites = await BacklinkSite.find({}).sort({ createdAt: -1 }).lean();

  return Response.json(
    sites.map((s) => ({
      id:          s._id.toString(),
      url:         s.url,
      da:          s.da ?? null,
      spamScore:   s.spamScore ?? null,
      niche:       s.niche ?? "",
      notes:       s.notes ?? "",
      addedBy:     s.addedBy,
      addedByName: s.addedByName,
      createdAt:   s.createdAt.toISOString(),
    }))
  );
}

// POST /api/backlink-sites — sub-lead and super-admin only
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role;
  if (role !== "super-admin" && role !== "sub-lead") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { url, da, spamScore, niche, notes } = body;

  if (!url?.trim()) {
    return Response.json({ error: "URL is required." }, { status: 400 });
  }

  await connectDB();

  const site = await BacklinkSite.create({
    url:         url.trim(),
    da:          da != null && da !== "" ? Number(da) : null,
    spamScore:   spamScore != null && spamScore !== "" ? Number(spamScore) : null,
    niche:       niche?.trim() ?? "",
    notes:       notes?.trim() ?? "",
    addedBy:     session.user.id,
    addedByName: session.user.name ?? "",
  });

  return Response.json({
    id:          site._id.toString(),
    url:         site.url,
    da:          site.da ?? null,
    spamScore:   site.spamScore ?? null,
    niche:       site.niche ?? "",
    notes:       site.notes ?? "",
    addedBy:     site.addedBy,
    addedByName: site.addedByName,
    createdAt:   site.createdAt.toISOString(),
  }, { status: 201 });
}
