import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB, Backlink, User } from "@/lib/mongodb";
import { BacklinksClient, type BacklinkRow, type TeamMember } from "./backlinks-client";

const PAGE_SIZE = 20;

export default async function BacklinksPage({
  searchParams,
}: {
  searchParams: Record<string, string>;
}) {
  const session = await getServerSession(authOptions);
  const isSuperAdmin = session?.user.role === "super-admin";
  const currentUserId = session!.user.id;

  await connectDB();

  // For admin: fetch all members for tabs
  const teamMembers: TeamMember[] = isSuperAdmin
    ? (await User.find({ isActive: true, role: { $ne: "super-admin" } }).sort({ name: 1 }).lean()).map((u) => ({
        id: u._id.toString(),
        name: u.name,
      }))
    : [];

  // For admin: selectedTab = "" means "All", or a userId
  // For user: always filter by their own userId
  const selectedTab = isSuperAdmin ? (searchParams.tab ?? "") : currentUserId;

  const type = searchParams.type?.trim() ?? "";
  const status = searchParams.status?.trim() ?? "";
  const from = searchParams.from?.trim() ?? "";
  const to = searchParams.to?.trim() ?? "";
  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10));

  const filter: Record<string, unknown> = {};

  // Admin: filter by tab (all or specific user). User: always own
  if (isSuperAdmin && selectedTab) filter.userId = selectedTab;
  if (!isSuperAdmin) filter.userId = currentUserId;

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

  const [rawRows, total, liveCount, pendingCount, brokenCount] = await Promise.all([
    Backlink.find(filter).sort({ createdAt: -1 }).skip((page - 1) * PAGE_SIZE).limit(PAGE_SIZE).lean(),
    Backlink.countDocuments(filter),
    Backlink.countDocuments({ ...filter, status: "live" }),
    Backlink.countDocuments({ ...filter, status: "pending" }),
    Backlink.countDocuments({ ...filter, status: "broken" }),
  ]);

  // For admin tabs: per-member counts
  const memberCounts: Record<string, number> = {};
  if (isSuperAdmin) {
    const allCounts = await Backlink.aggregate([
      { $group: { _id: "$userId", count: { $sum: 1 } } },
    ]);
    for (const c of allCounts) memberCounts[c._id] = c.count;
  }

  const rows: BacklinkRow[] = rawRows.map((b) => ({
    id: b._id.toString(),
    userId: b.userId,
    userName: b.userName,
    websiteName: b.websiteName,
    targetUrl: b.targetUrl,
    backlinkUrl: b.backlinkUrl,
    anchorText: b.anchorText,
    type: b.type,
    da: b.da ?? null,
    status: b.status as BacklinkRow["status"],
    notes: b.notes ?? "",
    createdAt: b.createdAt.toISOString(),
  }));

  return (
    <Suspense>
      <BacklinksClient
        rows={rows}
        total={total}
        stats={{ total, live: liveCount, pending: pendingCount, broken: brokenCount }}
        page={page}
        pageSize={PAGE_SIZE}
        isSuperAdmin={isSuperAdmin}
        currentUserId={currentUserId}
        teamMembers={teamMembers}
        memberCounts={memberCounts}
        selectedTab={selectedTab}
        filters={{ type, status, from, to }}
      />
    </Suspense>
  );
}
