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
// Accepts { urls: string[], da, spamScore, niche, notes } for bulk add
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const role = session.user.role;
  if (role !== "super-admin" && role !== "sub-lead") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { urls, da, spamScore, niche, notes } = body as {
    urls: string[];
    da?: string | number;
    spamScore?: string | number;
    niche?: string;
    notes?: string;
  };

  if (!Array.isArray(urls) || urls.length === 0) {
    return Response.json({ error: "At least one URL is required." }, { status: 400 });
  }

  const cleanUrls = urls.map((u) => u.trim()).filter(Boolean);
  if (cleanUrls.length === 0) {
    return Response.json({ error: "At least one URL is required." }, { status: 400 });
  }

  await connectDB();

  const daVal        = da != null && da !== "" ? Number(da) : null;
  const spamVal      = spamScore != null && spamScore !== "" ? Number(spamScore) : null;
  const nicheVal     = niche?.trim() ?? "";
  const notesVal     = notes?.trim() ?? "";
  const addedBy      = session.user.id;
  const addedByName  = session.user.name ?? "";

  const created = await BacklinkSite.insertMany(
    cleanUrls.map((url) => ({ url, da: daVal, spamScore: spamVal, niche: nicheVal, notes: notesVal, addedBy, addedByName }))
  );

  return Response.json(
    created.map((s) => ({
      id:          s._id.toString(),
      url:         s.url,
      da:          s.da ?? null,
      spamScore:   s.spamScore ?? null,
      niche:       s.niche ?? "",
      notes:       s.notes ?? "",
      addedBy:     s.addedBy,
      addedByName: s.addedByName,
      createdAt:   s.createdAt.toISOString(),
    })),
    { status: 201 }
  );
}
