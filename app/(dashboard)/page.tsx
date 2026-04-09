import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB, ExecutionLog } from "@/lib/mongodb";
import { Badge } from "@/components/ui/badge";
import { Play, ScrollText, CheckCircle, XCircle } from "lucide-react";
import { OverviewFilters } from "./overview-filters";

interface SearchParams {
  from?: string;
  to?: string;
}

async function getStats(userId: string, isSuperAdmin: boolean, from?: string, to?: string) {
  await connectDB();

  // Super admin sees all, regular user sees only their own
  const baseFilter: Record<string, unknown> = isSuperAdmin ? {} : { userId };

  // Date range filter
  if (from || to) {
    const dateFilter: Record<string, Date> = {};
    if (from) dateFilter.$gte = new Date(from);
    if (to) {
      const toDate = new Date(to);
      toDate.setHours(23, 59, 59, 999);
      dateFilter.$lte = toDate;
    }
    baseFilter.startedAt = dateFilter;
  }

  const [total, success, error, running] = await Promise.all([
    ExecutionLog.countDocuments(baseFilter),
    ExecutionLog.countDocuments({ ...baseFilter, status: "success" }),
    ExecutionLog.countDocuments({ ...baseFilter, status: "error" }),
    ExecutionLog.countDocuments({ ...baseFilter, status: "running" }),
  ]);

  const recent = await ExecutionLog.find(baseFilter)
    .sort({ startedAt: -1 })
    .limit(20)
    .lean();

  return { total, success, error, running, recent };
}

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await getServerSession(authOptions);
  const isSuperAdmin = session?.user?.role === "super-admin";
  const stats = await getStats(session!.user.id, isSuperAdmin, searchParams.from, searchParams.to);

  const isFiltered = !!(searchParams.from || searchParams.to);

  const statCards = [
    { label: "Total Runs", value: stats.total, icon: ScrollText, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Successful", value: stats.success, icon: CheckCircle, color: "text-green-600", bg: "bg-green-50" },
    { label: "Failed", value: stats.error, icon: XCircle, color: "text-red-600", bg: "bg-red-50" },
    { label: "Running", value: stats.running, icon: Play, color: "text-yellow-600", bg: "bg-yellow-50" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">
          Welcome back, {session?.user?.name?.split(" ")[0]}
        </h2>
        <p className="text-muted-foreground text-sm mt-1">
          {isSuperAdmin ? "You have full admin access." : "Your execution summary."}
        </p>
      </div>

      {/* Date filters */}
      <Suspense>
        <OverviewFilters />
      </Suspense>

      {isFiltered && (
        <p className="text-xs text-muted-foreground -mt-2">
          Showing results
          {searchParams.from ? ` from ${searchParams.from}` : ""}
          {searchParams.to ? ` to ${searchParams.to}` : ""}
        </p>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {statCards.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="rounded-lg border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{label}</p>
              <div className={`rounded-md p-1.5 ${bg}`}>
                <Icon className={`h-4 w-4 ${color}`} />
              </div>
            </div>
            <p className="mt-2 text-3xl font-bold">{value}</p>
          </div>
        ))}
      </div>

      {/* Recent runs table */}
      <div className="rounded-lg border bg-card shadow-sm">
        <div className="border-b px-4 py-3">
          <h3 className="font-semibold">
            {isFiltered ? "Filtered Runs" : "Recent Runs"}
          </h3>
        </div>
        {stats.recent.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            {isFiltered
              ? "No runs found for the selected date range."
              : "No executions yet. Head to Scripts to run your first script."}
          </p>
        ) : (
          <div className="divide-y">
            {stats.recent.map((log) => (
              <div
                key={log._id.toString()}
                className="flex items-center justify-between px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-medium">{log.scriptName}</p>
                  <p className="text-xs text-muted-foreground">
                    {isSuperAdmin && `${log.userName} · `}
                    {new Date(log.startedAt).toLocaleString()}
                    {log.durationMs != null && (
                      <span className="ml-2 text-muted-foreground/60">
                        ({(log.durationMs / 1000).toFixed(1)}s)
                      </span>
                    )}
                  </p>
                </div>
                <Badge
                  variant={
                    log.status === "success"
                      ? "success"
                      : log.status === "error"
                      ? "destructive"
                      : "warning"
                  }
                >
                  {log.status}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
