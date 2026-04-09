import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB, ExecutionLog, User } from "@/lib/mongodb";
import { LogsPageClient, type LogRow, type UserTab } from "./logs-client";

const PAGE_SIZE = 15;

function yesterdayStr() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split("T")[0];
}

export default async function LogsPage({
  searchParams,
}: {
  searchParams: Record<string, string>;
}) {
  const session = await getServerSession(authOptions);

  await connectDB();

  const rawUsers = await User.find({ isActive: true }).sort({ name: 1 }).lean();
  const users: UserTab[] = rawUsers.map((u) => ({
    id: u._id.toString(),
    name: u.name,
    email: u.email,
    role: u.role,
  }));

  // "" = all users (overall view); specific id = filter by user
  const selectedUserId = searchParams.userId ?? "";
  const from = searchParams.from ?? yesterdayStr();
  const to = searchParams.to ?? yesterdayStr();
  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10));

  const filter: Record<string, unknown> = {};
  if (selectedUserId) filter.userId = selectedUserId;

  if (from || to) {
    const dateFilter: Record<string, Date> = {};
    if (from) dateFilter.$gte = new Date(from);
    if (to) {
      const toDate = new Date(to);
      toDate.setHours(23, 59, 59, 999);
      dateFilter.$lte = toDate;
    }
    filter.startedAt = dateFilter;
  }

  const [rawLogs, total, successCount, errorCount] = await Promise.all([
    ExecutionLog.find(filter)
      .sort({ startedAt: -1 })
      .skip((page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .lean(),
    ExecutionLog.countDocuments(filter),
    ExecutionLog.countDocuments({ ...filter, status: "success" }),
    ExecutionLog.countDocuments({ ...filter, status: "error" }),
  ]);

  const logs: LogRow[] = rawLogs.map((l) => ({
    id: l._id.toString(),
    scriptName: l.scriptName,
    scriptSlug: l.scriptSlug,
    userName: l.userName,
    userEmail: l.userEmail,
    status: l.status as LogRow["status"],
    exitCode: l.exitCode ?? null,
    startedAt: l.startedAt.toISOString(),
    durationMs: l.durationMs ?? null,
    output: l.output ?? "",
  }));

  return (
    <Suspense>
      <LogsPageClient
        users={users}
        selectedUserId={selectedUserId}
        logs={logs}
        stats={{ total, success: successCount, error: errorCount }}
        from={from}
        to={to}
        page={page}
        total={total}
        pageSize={PAGE_SIZE}
        currentAdminId={session!.user.id}
      />
    </Suspense>
  );
}
