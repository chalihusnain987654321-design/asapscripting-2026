import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB, Backlink, User, Group } from "@/lib/mongodb";
import { BacklinksClient, type BacklinkRow, type TeamMember, type GroupOption } from "./backlinks-client";

const PAGE_SIZE = 20;

export default async function BacklinksPage({
  searchParams,
}: {
  searchParams: Record<string, string>;
}) {
  const session = await getServerSession(authOptions);
  const role = session?.user.role;
  const isSuperAdmin = role === "super-admin";
  const isSupervisor = role === "sub-lead";
  const currentUserId = session!.user.id;

  await connectDB();

  let teamMembers: TeamMember[] = [];
  let groups: GroupOption[] = [];
  let groupMemberMap: Record<string, string[]> = {};

  if (isSuperAdmin) {
    // Super-admin: all active non-admin members + all groups
    teamMembers = (
      await User.find({ isActive: true, role: { $ne: "super-admin" } }).sort({ name: 1 }).lean()
    ).map((u) => ({ id: u._id.toString(), name: u.name }));

    const rawGroups = await Group.find({}).sort({ name: 1 }).lean();
    groups = rawGroups.map((g) => ({
      id: g._id.toString(),
      name: g.name,
      memberUserIds: [g.leadUserId.toString(), ...g.memberUserIds.map((id) => id.toString())],
    }));
    groupMemberMap = Object.fromEntries(groups.map((g) => [g.id, g.memberUserIds]));
  } else if (isSupervisor) {
    // Supervisor: only their group members
    const myGroup = await Group.findOne({ leadUserId: currentUserId }).lean();
    if (myGroup) {
      const memberIds = myGroup.memberUserIds.map((id) => id.toString());
      const allIds = [currentUserId, ...memberIds];
      teamMembers = (
        await User.find({ _id: { $in: allIds }, isActive: true }).sort({ name: 1 }).lean()
      ).map((u) => ({ id: u._id.toString(), name: u.name }));
    } else {
      // No group assigned — only own data
      teamMembers = [];
    }
  }

  // Selected tab / team
  const canViewTeam = isSuperAdmin || isSupervisor;
  const selectedTab = canViewTeam ? (searchParams.tab ?? "") : currentUserId;
  const selectedTeamId = isSuperAdmin ? (searchParams.teamId ?? "") : "";

  const type = searchParams.type?.trim() ?? "";
  const status = searchParams.status?.trim() ?? "";
  const from = searchParams.from?.trim() ?? "";
  const to = searchParams.to?.trim() ?? "";
  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10));

  const filter: Record<string, unknown> = {};

  if (isSuperAdmin) {
    if (selectedTeamId && groupMemberMap[selectedTeamId]) {
      filter.userId = { $in: groupMemberMap[selectedTeamId] };
    } else if (selectedTab) {
      filter.userId = selectedTab;
    }
    // else: no filter = all
  } else if (isSupervisor) {
    // Supervisor can only see their own group members (including themselves)
    const allowedIds = teamMembers.map((m) => m.id);
    if (selectedTab && allowedIds.includes(selectedTab)) {
      filter.userId = selectedTab;
    } else {
      filter.userId = { $in: allowedIds.length > 0 ? allowedIds : [currentUserId] };
    }
  } else {
    filter.userId = currentUserId;
  }

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

  // Per-member and per-group counts
  const memberCounts: Record<string, number> = {};
  const groupCounts: Record<string, number> = {};
  if (canViewTeam) {
    const allCounts = await Backlink.aggregate([
      { $group: { _id: "$userId", count: { $sum: 1 } } },
    ]);
    for (const c of allCounts) memberCounts[c._id] = c.count;
    for (const g of groups) {
      groupCounts[g.id] = g.memberUserIds.reduce((sum, uid) => sum + (memberCounts[uid] ?? 0), 0);
    }
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
        isSupervisor={isSupervisor}
        currentUserId={currentUserId}
        teamMembers={teamMembers}
        memberCounts={memberCounts}
        selectedTab={selectedTab}
        groups={groups}
        groupCounts={groupCounts}
        selectedTeamId={selectedTeamId}
        filters={{ type, status, from, to }}
      />
    </Suspense>
  );
}
