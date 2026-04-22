import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB, Backlink } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

// GET /api/backlinks — all users see all backlinks (filtered)
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search")?.trim() ?? "";
  const websiteName = searchParams.get("websiteName")?.trim() ?? "";
  const type = searchParams.get("type")?.trim() ?? "";
  const status = searchParams.get("status")?.trim() ?? "";
  const userId = searchParams.get("userId")?.trim() ?? "";
  const from = searchParams.get("from")?.trim() ?? "";
  const to = searchParams.get("to")?.trim() ?? "";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = 20;

  await connectDB();

  const filter: Record<string, unknown> = {};

  if (userId) filter.userId = userId;
  if (websiteName) filter.websiteName = { $regex: websiteName, $options: "i" };
  if (type) filter.type = type;
  if (status) filter.status = status;

  if (from || to) {
    const dateFilter: Record<string, Date> = {};
    if (from) dateFilter.$gte = new Date(from);
    if (to) {
      const toDate = new Date(to);
      toDate.setHours(23, 59, 59, 999);
      dateFilter.$lte = toDate;
    }
    filter.createdAt = dateFilter;
  }

  if (search) {
    filter.$or = [
      { websiteName: { $regex: search, $options: "i" } },
      { backlinkUrl: { $regex: search, $options: "i" } },
      { targetUrl: { $regex: search, $options: "i" } },
      { anchorText: { $regex: search, $options: "i" } },
    ];
  }

  const [rows, total] = await Promise.all([
    Backlink.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Backlink.countDocuments(filter),
  ]);

  return Response.json({
    backlinks: rows.map((b) => ({
      id: b._id.toString(),
      userId: b.userId,
      userName: b.userName,
      websiteName: b.websiteName,
      targetUrl: b.targetUrl,
      backlinkUrl: b.backlinkUrl,
      anchorText: b.anchorText,
      type: b.type,
      da: b.da,
      status: b.status,
      notes: b.notes,
      createdAt: b.createdAt.toISOString(),
    })),
    total,
    page,
    pages: Math.ceil(total / limit),
  });
}

// POST /api/backlinks — bulk insert (one record per URL)
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { websiteName, backlinkUrls, type, status, date } = body;

  if (!websiteName?.trim()) {
    return Response.json({ error: "Website name is required." }, { status: 400 });
  }

  const urls: string[] = (backlinkUrls as string[])
    .map((u: string) => u.trim())
    .filter(Boolean);

  if (urls.length === 0) {
    return Response.json({ error: "At least one backlink URL is required." }, { status: 400 });
  }

  await connectDB();

  const createdAt = date ? new Date(date) : new Date();

  const docs = urls.map((url) => ({
    userId: session.user.id,
    userName: session.user.name ?? "",
    userEmail: session.user.email ?? "",
    websiteName: websiteName.trim(),
    backlinkUrl: url,
    targetUrl: "",
    anchorText: "",
    type: type ?? "other",
    da: null,
    status: status ?? "live",
    notes: "",
    createdAt,
  }));

  const created = await Backlink.insertMany(docs);

  return Response.json(
    created.map((b) => ({
      id: b._id.toString(),
      userId: b.userId,
      userName: b.userName,
      websiteName: b.websiteName,
      targetUrl: b.targetUrl,
      backlinkUrl: b.backlinkUrl,
      anchorText: b.anchorText,
      type: b.type,
      da: b.da,
      status: b.status,
      notes: b.notes,
      createdAt: b.createdAt.toISOString(),
    })),
    { status: 201 }
  );
}
