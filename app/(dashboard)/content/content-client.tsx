"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, Trash2, Pencil, ExternalLink, Loader2,
  ChevronDown, CheckCircle, Clock, AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export type TaskType = "landing-request" | "blog-request" | "landing-update" | "blog-publish";
export type TaskStatus = "pending" | "in-progress" | "done";

export interface ContentTaskRow {
  id: string;
  userId: string;
  userName: string;
  taskType: TaskType;
  websiteName: string;
  websiteUrl: string;
  status: TaskStatus;
  date: string;
  docsLink: string;
  pageUrls: string[];
  sheetLink: string;
  updatedPageLinks: string[];
  publishedBlogLinks: string[];
}

interface ContentClientProps {
  tasks: ContentTaskRow[];
  currentUserId: string;
  viewerRole: string;
}

const PKT = "Asia/Karachi";

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "in-progress", label: "In Progress" },
  { value: "done", label: "Done" },
];

function StatusBadge({ status }: { status: TaskStatus }) {
  if (status === "done") return (
    <Badge className="gap-1 bg-green-500/15 text-green-700 border-green-400/30 hover:bg-green-500/15">
      <CheckCircle className="h-3 w-3" /> Done
    </Badge>
  );
  if (status === "in-progress") return (
    <Badge className="gap-1 bg-blue-500/15 text-blue-700 border-blue-400/30 hover:bg-blue-500/15">
      <Clock className="h-3 w-3" /> In Progress
    </Badge>
  );
  return (
    <Badge className="gap-1 bg-yellow-500/15 text-yellow-700 border-yellow-400/30 hover:bg-yellow-500/15">
      <AlertCircle className="h-3 w-3" /> Pending
    </Badge>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    timeZone: PKT, day: "numeric", month: "short", year: "numeric",
  });
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ContentClient({ tasks: initial, currentUserId, viewerRole }: ContentClientProps) {
  const router = useRouter();
  const [tasks, setTasks] = useState(initial);
  useEffect(() => { setTasks(initial); }, [initial]);

  const [mainTab, setMainTab] = useState<"request" | "update">("request");
  const [requestTab, setRequestTab] = useState<"landing-request" | "blog-request">("landing-request");
  const [updateTab, setUpdateTab] = useState<"landing-update" | "blog-publish">("landing-update");

  const [addOpen, setAddOpen] = useState(false);
  const [editItem, setEditItem] = useState<ContentTaskRow | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const activeType: TaskType = mainTab === "request" ? requestTab : updateTab;
  const filtered = tasks.filter((t) => t.taskType === activeType);
  const canEdit = viewerRole !== "super-admin";

  async function onSaved(task: ContentTaskRow, isNew: boolean) {
    if (isNew) {
      setTasks((prev) => [task, ...prev]);
    } else {
      setTasks((prev) => prev.map((t) => (t.id === task.id ? task : t)));
    }
    setAddOpen(false);
    setEditItem(null);
    router.refresh();
  }

  async function confirmDelete() {
    if (!deleteId) return;
    setDeleting(true);
    const res = await fetch(`/api/content-tasks/${deleteId}`, { method: "DELETE" });
    setDeleting(false);
    if (res.ok) {
      setTasks((prev) => prev.filter((t) => t.id !== deleteId));
      setDeleteId(null);
      router.refresh();
    }
  }

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Content Tasks</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Track content requests and updates for your websites.
          </p>
        </div>
        {canEdit && (
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" />
            Add Record
          </Button>
        )}
      </div>

      {/* ── Main Tabs ── */}
      <div className="flex gap-1 p-1 bg-muted rounded-xl w-fit">
        {(["request", "update"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setMainTab(tab)}
            className={cn(
              "px-5 py-2 rounded-lg text-sm font-medium transition-all",
              mainTab === tab
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab === "request" ? "Content Request" : "Content Update"}
          </button>
        ))}
      </div>

      {/* ── Inner Tabs ── */}
      <div className="flex gap-2 border-b">
        {mainTab === "request" ? (
          <>
            {(["landing-request", "blog-request"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setRequestTab(tab)}
                className={cn(
                  "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
                  requestTab === tab
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                {tab === "landing-request" ? "Landing Pages Request" : "Blogs Request"}
              </button>
            ))}
          </>
        ) : (
          <>
            {(["landing-update", "blog-publish"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setUpdateTab(tab)}
                className={cn(
                  "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
                  updateTab === tab
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                {tab === "landing-update" ? "Landing Pages Update" : "Blogs Publish"}
              </button>
            ))}
          </>
        )}
      </div>

      {/* ── Table ── */}
      <TaskTable
        rows={filtered}
        taskType={activeType}
        canEdit={canEdit}
        viewerRole={viewerRole}
        onEdit={setEditItem}
        onDelete={setDeleteId}
      />

      {/* ── Add dialog ── */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Record</DialogTitle>
          </DialogHeader>
          <TaskForm
            taskType={activeType}
            onSaved={(t) => onSaved(t, true)}
            onCancel={() => setAddOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* ── Edit dialog ── */}
      <Dialog open={!!editItem} onOpenChange={(o) => { if (!o) setEditItem(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Record</DialogTitle>
          </DialogHeader>
          {editItem && (
            <TaskForm
              taskType={activeType}
              existing={editItem}
              onSaved={(t) => onSaved(t, false)}
              onCancel={() => setEditItem(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* ── Delete confirm ── */}
      <Dialog open={!!deleteId} onOpenChange={(o) => { if (!o) setDeleteId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete this record?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">This action cannot be undone.</p>
          <div className="flex gap-2 justify-end mt-2">
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleting}>
              {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Task Table ───────────────────────────────────────────────────────────────

function TaskTable({
  rows, taskType, canEdit, viewerRole, onEdit, onDelete,
}: {
  rows: ContentTaskRow[];
  taskType: TaskType;
  canEdit: boolean;
  viewerRole: string;
  onEdit: (r: ContentTaskRow) => void;
  onDelete: (id: string) => void;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-12 text-center">
        <p className="text-muted-foreground text-sm">No records yet.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              {viewerRole !== "admin" && (
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Member</th>
              )}
              <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Website</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Date</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Status</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Links</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((row) => (
              <TaskRow
                key={row.id}
                row={row}
                taskType={taskType}
                canEdit={canEdit}
                showMember={viewerRole !== "admin"}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TaskRow({
  row, taskType, canEdit, showMember, onEdit, onDelete,
}: {
  row: ContentTaskRow;
  taskType: TaskType;
  canEdit: boolean;
  showMember: boolean;
  onEdit: (r: ContentTaskRow) => void;
  onDelete: (id: string) => void;
}) {
  const [linksOpen, setLinksOpen] = useState(false);

  const links = taskType === "landing-request"
    ? row.pageUrls
    : taskType === "landing-update"
    ? row.updatedPageLinks
    : row.publishedBlogLinks;

  const mainLink = taskType === "landing-request"
    ? row.docsLink
    : taskType === "blog-request"
    ? row.sheetLink
    : null;

  return (
    <tr className="hover:bg-muted/30 transition-colors">
      {showMember && (
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold uppercase shrink-0">
              {row.userName[0]}
            </div>
            <span className="text-sm font-medium">{row.userName}</span>
          </div>
        </td>
      )}
      <td className="px-4 py-3">
        <div>
          <p className="font-medium">{row.websiteName}</p>
          <a href={row.websiteUrl} target="_blank" rel="noopener noreferrer"
            className="text-xs text-muted-foreground hover:text-primary flex items-center gap-0.5 w-fit">
            {row.websiteUrl.replace(/^https?:\/\//, "").slice(0, 30)}
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </td>
      <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">
        {formatDate(row.date)}
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={row.status} />
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-col gap-1">
          {mainLink && (
            <a href={mainLink} target="_blank" rel="noopener noreferrer"
              className="text-xs text-primary hover:underline flex items-center gap-1">
              {taskType === "landing-request" ? "Docs" : "Sheet"}
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
          {links.length > 0 && (
            <button
              onClick={() => setLinksOpen((v) => !v)}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              {links.length} page{links.length !== 1 ? "s" : ""}
              <ChevronDown className={cn("h-3 w-3 transition-transform", linksOpen && "rotate-180")} />
            </button>
          )}
          {linksOpen && (
            <div className="space-y-0.5 mt-1">
              {links.map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                  className="block text-xs text-primary hover:underline truncate max-w-[200px]">
                  {url.replace(/^https?:\/\//, "")}
                </a>
              ))}
            </div>
          )}
        </div>
      </td>
      <td className="px-4 py-3">
        {canEdit && (
          <div className="flex gap-1 justify-end">
            <Button variant="ghost" size="sm" onClick={() => onEdit(row)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onDelete(row.id)}>
              <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          </div>
        )}
      </td>
    </tr>
  );
}

// ─── Task Form ────────────────────────────────────────────────────────────────

function TaskForm({
  taskType,
  existing,
  onSaved,
  onCancel,
}: {
  taskType: TaskType;
  existing?: ContentTaskRow;
  onSaved: (task: ContentTaskRow) => void;
  onCancel: () => void;
}) {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: PKT });

  const [websiteName, setWebsiteName] = useState(existing?.websiteName ?? "");
  const [websiteUrl, setWebsiteUrl] = useState(existing?.websiteUrl ?? "");
  const [status, setStatus] = useState<TaskStatus>(existing?.status ?? "pending");
  const [date, setDate] = useState(existing ? existing.date.slice(0, 10) : today);
  const [docsLink, setDocsLink] = useState(existing?.docsLink ?? "");
  const [pageUrlsText, setPageUrlsText] = useState((existing?.pageUrls ?? []).join("\n"));
  const [sheetLink, setSheetLink] = useState(existing?.sheetLink ?? "");
  const [updatedLinksText, setUpdatedLinksText] = useState((existing?.updatedPageLinks ?? []).join("\n"));
  const [publishedLinksText, setPublishedLinksText] = useState((existing?.publishedBlogLinks ?? []).join("\n"));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function parseLines(text: string): string[] {
    return text.split("\n").map((l) => l.trim()).filter(Boolean);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);

    const body = {
      taskType,
      websiteName,
      websiteUrl,
      status,
      date,
      docsLink,
      pageUrls: parseLines(pageUrlsText),
      sheetLink,
      updatedPageLinks: parseLines(updatedLinksText),
      publishedBlogLinks: parseLines(publishedLinksText),
    };

    const url = existing ? `/api/content-tasks/${existing.id}` : "/api/content-tasks";
    const method = existing ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    setLoading(false);

    if (!res.ok) {
      setError((await res.json()).error ?? "Something went wrong.");
      return;
    }

    // Build updated row
    const saved: ContentTaskRow = {
      id: existing?.id ?? (await res.json()).id,
      userId: existing?.userId ?? "",
      userName: existing?.userName ?? "",
      taskType,
      websiteName,
      websiteUrl,
      status,
      date: new Date(date).toISOString(),
      docsLink,
      pageUrls: parseLines(pageUrlsText),
      sheetLink,
      updatedPageLinks: parseLines(updatedLinksText),
      publishedBlogLinks: parseLines(publishedLinksText),
    };

    onSaved(saved);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Common fields */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Website Name</Label>
          <Input placeholder="e.g. Example.com" value={websiteName}
            onChange={(e) => setWebsiteName(e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label>Website URL</Label>
          <Input placeholder="https://example.com" value={websiteUrl}
            onChange={(e) => setWebsiteUrl(e.target.value)} required />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Date</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label>Status</Label>
          <select
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={status}
            onChange={(e) => setStatus(e.target.value as TaskStatus)}
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Type-specific fields */}
      {taskType === "landing-request" && (
        <>
          <div className="space-y-1.5">
            <Label>Docs Link</Label>
            <Input placeholder="https://docs.google.com/..." value={docsLink}
              onChange={(e) => setDocsLink(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Pages URLs <span className="text-muted-foreground text-xs">(one per line)</span></Label>
            <Textarea
              placeholder={"https://example.com/page-1\nhttps://example.com/page-2"}
              className="min-h-[100px] font-mono text-xs"
              value={pageUrlsText}
              onChange={(e) => setPageUrlsText(e.target.value)}
            />
          </div>
        </>
      )}

      {taskType === "blog-request" && (
        <div className="space-y-1.5">
          <Label>Sheet Link</Label>
          <Input placeholder="https://docs.google.com/spreadsheets/..." value={sheetLink}
            onChange={(e) => setSheetLink(e.target.value)} />
        </div>
      )}

      {taskType === "landing-update" && (
        <div className="space-y-1.5">
          <Label>Updated Pages Links <span className="text-muted-foreground text-xs">(one per line)</span></Label>
          <Textarea
            placeholder={"https://example.com/page-1\nhttps://example.com/page-2"}
            className="min-h-[100px] font-mono text-xs"
            value={updatedLinksText}
            onChange={(e) => setUpdatedLinksText(e.target.value)}
          />
        </div>
      )}

      {taskType === "blog-publish" && (
        <div className="space-y-1.5">
          <Label>Published Blogs Links <span className="text-muted-foreground text-xs">(one per line)</span></Label>
          <Textarea
            placeholder={"https://example.com/blog-1\nhttps://example.com/blog-2"}
            className="min-h-[100px] font-mono text-xs"
            value={publishedLinksText}
            onChange={(e) => setPublishedLinksText(e.target.value)}
          />
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-2 justify-end pt-1">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {existing ? "Save Changes" : "Add Record"}
        </Button>
      </div>
    </form>
  );
}
