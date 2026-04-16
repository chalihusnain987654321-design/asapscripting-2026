"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import {
  Plus, Trash2, Pencil, ExternalLink, ChevronLeft, ChevronRight,
  Link2, TrendingUp, Clock, AlertTriangle, Loader2, Users, ChevronDown, Search, X as XIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BacklinkRow {
  id: string;
  userId: string;
  userName: string;
  websiteName: string;
  targetUrl: string;
  backlinkUrl: string;
  anchorText: string;
  type: string;
  da: number | null;
  status: "live" | "pending" | "broken" | "removed";
  notes: string;
  createdAt: string;
}

export interface TeamMember {
  id: string;
  name: string;
}

interface BacklinksClientProps {
  rows: BacklinkRow[];
  total: number;
  stats: { total: number; live: number; pending: number; broken: number };
  page: number;
  pageSize: number;
  isSuperAdmin: boolean;
  currentUserId: string;
  teamMembers: TeamMember[];
  memberCounts: Record<string, number>;
  selectedTab: string;
  filters: { type: string; status: string; from: string; to: string };
}

const BACKLINK_TYPES = [
  { value: "guest-post", label: "Guest Post" },
  { value: "directory", label: "Business Listing" },
  { value: "forum", label: "Profiles Creation" },
  { value: "social", label: "Social Bookmarks" },
  { value: "article", label: "Web 2.0" },
  { value: "comment", label: "UGC" },
  { value: "press-release", label: "Forum" },
  { value: "other", label: "Other" },
];

const STATUSES = [
  { value: "live", label: "Live" },
  { value: "pending", label: "Pending" },
  { value: "broken", label: "Broken" },
  { value: "removed", label: "Removed" },
];

// ─── Main component ───────────────────────────────────────────────────────────

export function BacklinksClient({
  rows: initialRows,
  total,
  stats,
  page,
  pageSize,
  isSuperAdmin,
  currentUserId,
  teamMembers,
  memberCounts,
  selectedTab,
  filters,
}: BacklinksClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [rows, setRows] = useState(initialRows);
  useEffect(() => { setRows(initialRows); }, [initialRows]);
  const [addOpen, setAddOpen] = useState(false);
  const [editItem, setEditItem] = useState<BacklinkRow | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [memberDropdownOpen, setMemberDropdownOpen] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");

  const totalPages = Math.ceil(total / pageSize);
  const isAllTab = isSuperAdmin && selectedTab === "";
  const totalMemberBacklinks = Object.values(memberCounts).reduce((a, b) => a + b, 0);

  function navigate(params: Record<string, string | undefined>) {
    const p = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(params)) {
      if (v) p.set(k, v); else p.delete(k);
    }
    p.delete("page");
    router.push(`/backlinks?${p.toString()}`);
  }

  function setFilter(key: string, value: string) {
    navigate({ [key]: value || undefined });
  }

  function switchTab(tabValue: string) {
    const p = new URLSearchParams();
    if (tabValue) p.set("tab", tabValue);
    // keep filters when switching tabs
    if (filters.type) p.set("type", filters.type);
    if (filters.status) p.set("status", filters.status);
    if (filters.from) p.set("from", filters.from);
    if (filters.to) p.set("to", filters.to);
    router.push(`/backlinks?${p.toString()}`);
  }

  function goToPage(p: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(p));
    router.push(`/backlinks?${params.toString()}`);
  }

  function onAdded(newRows: BacklinkRow[]) {
    setRows((prev) => [...newRows, ...prev]);
    setAddOpen(false);
    router.refresh();
  }

  function onEdited(row: BacklinkRow) {
    setRows((prev) => prev.map((r) => (r.id === row.id ? row : r)));
    setEditItem(null);
    router.refresh();
  }

  async function confirmDelete() {
    if (!deleteId) return;
    setDeleting(true);
    const res = await fetch(`/api/backlinks/${deleteId}`, { method: "DELETE" });
    setDeleting(false);
    if (res.ok) {
      setRows((prev) => prev.filter((r) => r.id !== deleteId));
      setDeleteId(null);
      router.refresh();
    } else {
      alert((await res.json()).error);
    }
  }

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Backlinks Tracker</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isSuperAdmin
              ? `${totalMemberBacklinks} backlinks across ${teamMembers.length} team members`
              : "Your backlink history"}
          </p>
        </div>
        {/* Only users (non-admins) can add backlinks */}
        {!isSuperAdmin && (
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" />
            Add Backlink
          </Button>
        )}
      </div>

      {/* ── Admin member selector dropdown ── */}
      {isSuperAdmin && (
        <div className="relative w-72">
          <label className="text-xs text-muted-foreground block mb-1.5 font-medium">Viewing backlinks for</label>

          {/* Trigger */}
          <button
            type="button"
            onClick={() => { setMemberDropdownOpen((v) => !v); setMemberSearch(""); }}
            className="w-full flex items-center gap-3 h-11 px-3 rounded-xl border border-input bg-card text-sm font-medium shadow-sm hover:bg-muted/40 transition-colors"
          >
            {isAllTab ? (
              <>
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 shrink-0">
                  <Users className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 text-left">
                  <span>All Members</span>
                  <span className="ml-2 text-xs text-muted-foreground">({totalMemberBacklinks})</span>
                </div>
              </>
            ) : (
              <>
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold uppercase shrink-0">
                  {teamMembers.find((m) => m.id === selectedTab)?.name[0] ?? "?"}
                </div>
                <div className="flex-1 text-left">
                  <span>{teamMembers.find((m) => m.id === selectedTab)?.name ?? "Unknown"}</span>
                  <span className="ml-2 text-xs text-muted-foreground">({memberCounts[selectedTab] ?? 0})</span>
                </div>
              </>
            )}
            <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform shrink-0", memberDropdownOpen && "rotate-180")} />
          </button>

          {/* Dropdown panel */}
          {memberDropdownOpen && (
            <div className="absolute z-50 top-full left-0 mt-1.5 w-full rounded-xl border bg-card shadow-lg overflow-hidden">
              {/* Search box */}
              <div className="p-2 border-b">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <input
                    autoFocus
                    type="text"
                    placeholder="Search member…"
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    className="w-full h-8 pl-8 pr-3 rounded-lg border border-input bg-background text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  {memberSearch && (
                    <button onClick={() => setMemberSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2">
                      <XIcon className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                    </button>
                  )}
                </div>
              </div>

              {/* Options */}
              <div className="max-h-60 overflow-y-auto py-1">
                {/* All Members option */}
                {!memberSearch && (
                  <button
                    onClick={() => { switchTab(""); setMemberDropdownOpen(false); }}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 text-sm transition-colors hover:bg-muted/50",
                      isAllTab && "bg-primary/5 text-primary font-medium"
                    )}
                  >
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted shrink-0">
                      <Users className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <span className="flex-1 text-left">All Members</span>
                    <span className="text-xs text-muted-foreground">{totalMemberBacklinks}</span>
                  </button>
                )}

                {/* Filtered members */}
                {teamMembers
                  .filter((m) => m.name.toLowerCase().includes(memberSearch.toLowerCase()))
                  .map((member) => {
                    const isSelected = selectedTab === member.id;
                    const count = memberCounts[member.id] ?? 0;
                    return (
                      <button
                        key={member.id}
                        onClick={() => { switchTab(member.id); setMemberDropdownOpen(false); setMemberSearch(""); }}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2 text-sm transition-colors hover:bg-muted/50",
                          isSelected && "bg-primary/5 text-primary font-medium"
                        )}
                      >
                        <div className={cn(
                          "flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold uppercase shrink-0",
                          isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                        )}>
                          {member.name[0]}
                        </div>
                        <span className="flex-1 text-left">{member.name}</span>
                        <span className="text-xs text-muted-foreground">{count}</span>
                      </button>
                    );
                  })}

                {memberSearch && teamMembers.filter((m) => m.name.toLowerCase().includes(memberSearch.toLowerCase())).length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">No members found</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Stats cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={Link2} label="Total" value={stats.total} color="blue" />
        <StatCard icon={TrendingUp} label="Live" value={stats.live} color="green" />
        <StatCard icon={Clock} label="Pending" value={stats.pending} color="yellow" />
        <StatCard icon={AlertTriangle} label="Broken" value={stats.broken} color="red" />
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl border bg-card">
        <select
          className="h-9 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          value={filters.type}
          onChange={(e) => setFilter("type", e.target.value)}
        >
          <option value="">All Types</option>
          {BACKLINK_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>

        <select
          className="h-9 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          value={filters.status}
          onChange={(e) => setFilter("status", e.target.value)}
        >
          <option value="">All Statuses</option>
          {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>

        <div className="flex items-center gap-2 ml-auto">
          <span className="text-xs text-muted-foreground">Date:</span>
          <input
            type="date"
            value={filters.from}
            onChange={(e) => setFilter("from", e.target.value)}
            className="h-8 rounded-lg border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <span className="text-xs text-muted-foreground">–</span>
          <input
            type="date"
            value={filters.to}
            onChange={(e) => setFilter("to", e.target.value)}
            className="h-8 rounded-lg border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          {(filters.type || filters.status || filters.from || filters.to) && (
            <button
              onClick={() => navigate({ type: undefined, status: undefined, from: undefined, to: undefined })}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors underline"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* ── Table ── */}
      {rows.length === 0 ? (
        <div className="rounded-xl border bg-card flex flex-col items-center justify-center py-16 gap-3">
          <Link2 className="h-10 w-10 text-muted-foreground/20" />
          <p className="text-sm font-medium text-muted-foreground">
            {isSuperAdmin
              ? isAllTab ? "No backlinks added yet by any team member" : "This member has no backlinks yet"
              : "You haven't added any backlinks yet"}
          </p>
          {!isSuperAdmin && (
            <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
              <Plus className="h-3.5 w-3.5" />Add your first backlink
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide whitespace-nowrap">Website</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide whitespace-nowrap">Backlink URL</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide whitespace-nowrap">Type</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide whitespace-nowrap">Status</th>
                    {/* Show "Added By" only on All tab */}
                    {isSuperAdmin && isAllTab && (
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide whitespace-nowrap">
                        <div className="flex items-center gap-1"><Users className="h-3 w-3" />Member</div>
                      </th>
                    )}
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide whitespace-nowrap">Date</th>
                    {!isSuperAdmin && <th className="px-4 py-3 w-20" />}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map((row) => (
                    <BacklinkTableRow
                      key={row.id}
                      row={row}
                      isSuperAdmin={isSuperAdmin}
                      currentUserId={currentUserId}
                      showMember={isSuperAdmin && isAllTab}
                      onEdit={() => setEditItem(row)}
                      onDelete={() => setDeleteId(row.id)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
              <span>{(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total} backlinks</span>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => goToPage(page - 1)} disabled={page <= 1}>
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <span className="px-2">{page} / {totalPages}</span>
                <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => goToPage(page + 1)} disabled={page >= totalPages}>
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Add dialog (users only) ── */}
      {!isSuperAdmin && (
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Add Backlinks</DialogTitle></DialogHeader>
            <AddBacklinksForm onSuccess={onAdded} onCancel={() => setAddOpen(false)} />
          </DialogContent>
        </Dialog>
      )}

      {/* ── Edit dialog (users only) ── */}
      {!isSuperAdmin && (
        <Dialog open={!!editItem} onOpenChange={(o) => { if (!o) setEditItem(null); }}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Edit Backlink</DialogTitle></DialogHeader>
            {editItem && (
              <EditBacklinkForm initial={editItem} onSuccess={onEdited} onCancel={() => setEditItem(null)} />
            )}
          </DialogContent>
        </Dialog>
      )}

      {/* ── Delete confirm (users only) ── */}
      {!isSuperAdmin && (
        <Dialog open={!!deleteId} onOpenChange={(o) => { if (!o) setDeleteId(null); }}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Delete Backlink</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground">Are you sure? This cannot be undone.</p>
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setDeleteId(null)} disabled={deleting}>Cancel</Button>
              <Button variant="destructive" onClick={confirmDelete} disabled={deleting}>
                {deleting && <Loader2 className="h-4 w-4 animate-spin" />}Delete
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, color }: {
  icon: React.ElementType; label: string; value: number;
  color: "blue" | "green" | "yellow" | "red";
}) {
  const colors = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-green-50 text-green-600",
    yellow: "bg-yellow-50 text-yellow-600",
    red: "bg-red-50 text-red-500",
  };
  return (
    <div className="rounded-xl border bg-card p-4 flex items-center gap-3">
      <div className={cn("rounded-lg p-2.5 shrink-0", colors[color])}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-2xl font-bold leading-none">{value}</p>
        <p className="text-xs text-muted-foreground mt-1">{label}</p>
      </div>
    </div>
  );
}

// ─── Table row ────────────────────────────────────────────────────────────────

function BacklinkTableRow({ row, isSuperAdmin, currentUserId, showMember, onEdit, onDelete }: {
  row: BacklinkRow;
  isSuperAdmin: boolean;
  currentUserId: string;
  showMember: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const canModify = !isSuperAdmin && row.userId === currentUserId;

  return (
    <tr className="hover:bg-muted/30 transition-colors group">
      <td className="px-4 py-3 font-medium max-w-[160px]">
        <span className="truncate block" title={row.websiteName}>{row.websiteName}</span>
      </td>
      <td className="px-4 py-3 max-w-[300px]">
        <a href={row.backlinkUrl} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1 text-blue-600 hover:underline text-xs" title={row.backlinkUrl}>
          <span className="truncate">{stripProtocol(row.backlinkUrl)}</span>
          <ExternalLink className="h-3 w-3 shrink-0" />
        </a>
      </td>
      <td className="px-4 py-3"><TypeBadge type={row.type} /></td>
      <td className="px-4 py-3"><StatusBadge status={row.status} /></td>
      {showMember && (
        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
          <div className="flex items-center gap-1.5">
            <div className="h-5 w-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold uppercase shrink-0">
              {row.userName[0]}
            </div>
            {row.userName.split(" ")[0]}
          </div>
        </td>
      )}
      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
        {new Date(row.createdAt).toLocaleDateString([], { day: "numeric", month: "short", year: "2-digit" })}
      </td>
      {!isSuperAdmin && (
        <td className="px-4 py-3">
          {canModify && (
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onEdit}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={onDelete}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </td>
      )}
    </tr>
  );
}

// ─── Add form (bulk) ─────────────────────────────────────────────────────────

function AddBacklinksForm({ onSuccess, onCancel }: {
  onSuccess: (rows: BacklinkRow[]) => void;
  onCancel: () => void;
}) {
  const [websiteName, setWebsiteName] = useState("");
  const [type, setType] = useState("other");
  const [status, setStatus] = useState("live");
  const [urlsText, setUrlsText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const urlCount = urlsText.split("\n").map((u) => u.trim()).filter(Boolean).length;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const backlinkUrls = urlsText.split("\n").map((u) => u.trim()).filter(Boolean);
    if (backlinkUrls.length === 0) { setError("Enter at least one backlink URL."); return; }
    setLoading(true);
    const res = await fetch("/api/backlinks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ websiteName, type, status, backlinkUrls }),
    });
    setLoading(false);
    if (!res.ok) { setError((await res.json()).error ?? "Something went wrong."); return; }
    onSuccess(await res.json());
  }

  const selectClass = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label>Website Name <span className="text-destructive">*</span></Label>
        <Input
          placeholder="e.g. Aviation Axis"
          value={websiteName}
          onChange={(e) => setWebsiteName(e.target.value)}
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Type</Label>
          <select className={selectClass} value={type} onChange={(e) => setType(e.target.value)}>
            {BACKLINK_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label>Status</Label>
          <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label>Backlink URLs <span className="text-destructive">*</span></Label>
          {urlCount > 0 && (
            <span className="text-xs text-muted-foreground">{urlCount} URL{urlCount !== 1 ? "s" : ""}</span>
          )}
        </div>
        <textarea
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
          rows={8}
          placeholder={"https://site1.com/page\nhttps://site2.com/page\nhttps://site3.com/page\n…"}
          value={urlsText}
          onChange={(e) => setUrlsText(e.target.value)}
          required
        />
        <p className="text-xs text-muted-foreground">One URL per line. All URLs will be saved under the same website, type, and status.</p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-2 justify-end pt-1">
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>Cancel</Button>
        <Button type="submit" disabled={loading || !websiteName.trim() || urlCount === 0}>
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          Save {urlCount > 0 ? `${urlCount} Backlink${urlCount !== 1 ? "s" : ""}` : "Backlinks"}
        </Button>
      </div>
    </form>
  );
}

// ─── Edit form (single) ───────────────────────────────────────────────────────

function EditBacklinkForm({ initial, onSuccess, onCancel }: {
  initial: BacklinkRow;
  onSuccess: (row: BacklinkRow) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    websiteName: initial.websiteName,
    backlinkUrl: initial.backlinkUrl,
    type: initial.type,
    status: initial.status,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await fetch(`/api/backlinks/${initial.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setLoading(false);
    if (!res.ok) { setError((await res.json()).error ?? "Something went wrong."); return; }
    onSuccess(await res.json());
  }

  const selectClass = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label>Website Name <span className="text-destructive">*</span></Label>
        <Input value={form.websiteName} onChange={(e) => set("websiteName", e.target.value)} required />
      </div>
      <div className="space-y-1.5">
        <Label>Backlink URL <span className="text-destructive">*</span></Label>
        <Input type="url" value={form.backlinkUrl} onChange={(e) => set("backlinkUrl", e.target.value)} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Type</Label>
          <select className={selectClass} value={form.type} onChange={(e) => set("type", e.target.value)}>
            {BACKLINK_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label>Status</Label>
          <select className={selectClass} value={form.status} onChange={(e) => set("status", e.target.value)}>
            {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-2 justify-end pt-1">
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>Cancel</Button>
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          Save Changes
        </Button>
      </div>
    </form>
  );
}

// ─── Badges & helpers ─────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: BacklinkRow["status"] }) {
  const map = {
    live: "bg-green-100 text-green-700 border-green-200",
    pending: "bg-yellow-100 text-yellow-700 border-yellow-200",
    broken: "bg-red-100 text-red-700 border-red-200",
    removed: "bg-gray-100 text-gray-600 border-gray-200",
  };
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border", map[status])}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function TypeBadge({ type }: { type: string }) {
  const label = BACKLINK_TYPES.find((t) => t.value === type)?.label ?? type;
  return <Badge variant="secondary" className="text-xs whitespace-nowrap">{label}</Badge>;
}

function stripProtocol(url: string): string {
  return url.replace(/^https?:\/\/(www\.)?/, "");
}
