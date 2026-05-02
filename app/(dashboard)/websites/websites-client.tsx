"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Loader2, Users, Globe, ExternalLink, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WebsiteRow {
  id: string;
  name: string;
  url: string;
  assignedTo: { userId: string; userName: string }[];
  createdAt: string;
}

export interface MemberOption {
  id: string;
  name: string;
}

interface Props {
  websites: WebsiteRow[];
  members: MemberOption[];
  viewerRole: string;
  currentUserId: string;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function WebsitesClient({ websites: initial, members, viewerRole }: Props) {
  const router = useRouter();
  const [websites, setWebsites] = useState(initial);
  const [addOpen,    setAddOpen]    = useState(false);
  const [editItem,   setEditItem]   = useState<WebsiteRow | null>(null);
  const [deleteId,   setDeleteId]   = useState<string | null>(null);
  const [deleting,   setDeleting]   = useState(false);
  const [assignItem, setAssignItem] = useState<WebsiteRow | null>(null);

  const isSuperAdmin  = viewerRole === "super-admin";
  const canFilter     = viewerRole === "super-admin" || viewerRole === "sub-lead";
  const [filterMember, setFilterMember] = useState("");

  const filtered = filterMember
    ? websites.filter((w) => w.assignedTo.some((a) => a.userId === filterMember))
    : websites;

  function onAdded(w: WebsiteRow) {
    setWebsites((prev) => [w, ...prev].sort((a, b) => a.name.localeCompare(b.name)));
    setAddOpen(false);
    router.refresh();
  }

  function onEdited(w: WebsiteRow) {
    setWebsites((prev) => prev.map((x) => (x.id === w.id ? w : x)));
    setEditItem(null);
    router.refresh();
  }

  function onAssigned(w: WebsiteRow) {
    setWebsites((prev) => prev.map((x) => (x.id === w.id ? w : x)));
    setAssignItem(null);
    router.refresh();
  }

  async function confirmDelete() {
    if (!deleteId) return;
    setDeleting(true);
    const res = await fetch(`/api/websites/${deleteId}`, { method: "DELETE" });
    setDeleting(false);
    if (res.ok) {
      setWebsites((prev) => prev.filter((w) => w.id !== deleteId));
      setDeleteId(null);
      router.refresh();
    } else {
      alert((await res.json()).error);
    }
  }

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold">Websites</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isSuperAdmin
              ? `${filtered.length} of ${websites.length} website${websites.length !== 1 ? "s" : ""}`
              : `${filtered.length} website${filtered.length !== 1 ? "s" : ""} assigned to you`}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          {canFilter && members.length > 0 && (
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground whitespace-nowrap">Filter by member:</Label>
              <select
                value={filterMember}
                onChange={(e) => setFilterMember(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">All members</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
              {filterMember && (
                <button onClick={() => setFilterMember("")} className="text-xs text-muted-foreground hover:text-foreground underline">
                  Clear
                </button>
              )}
            </div>
          )}
          {isSuperAdmin && (
            <Button onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4" />
              Add Website
            </Button>
          )}
        </div>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="rounded-lg border bg-card p-12 text-center">
          <Globe className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            {websites.length === 0
              ? isSuperAdmin ? "No websites added yet." : "No websites assigned to you yet."
              : "No websites match the selected filter."}
          </p>
        </div>
      ) : (
        <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Website</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">URL</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Assigned Members</th>
                {isSuperAdmin && <th className="px-4 py-3 w-28" />}
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((w) => (
                <tr key={w.id} className="hover:bg-muted/20 transition-colors group">
                  <td className="px-4 py-3 font-medium">{w.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {w.url ? (
                      <a href={w.url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 text-blue-600 hover:underline text-xs max-w-[220px]">
                        <span className="truncate">{w.url.replace(/^https?:\/\/(www\.)?/, "")}</span>
                        <ExternalLink className="h-3 w-3 shrink-0" />
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground/50">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {w.assignedTo.length === 0 ? (
                      <span className="text-xs text-muted-foreground/50">Unassigned</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {w.assignedTo.map((a) => (
                          <span key={a.userId}
                            className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium">
                            {a.userName.split(" ")[0]}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  {isSuperAdmin && (
                    <td className="px-4 py-3">
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1"
                          onClick={() => setAssignItem(w)}>
                          <UserPlus className="h-3.5 w-3.5" />
                          Assign
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
                          onClick={() => setEditItem(w)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                          onClick={() => setDeleteId(w.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Website</DialogTitle></DialogHeader>
          <WebsiteForm onSaved={onAdded} onCancel={() => setAddOpen(false)} />
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editItem} onOpenChange={(o) => { if (!o) setEditItem(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Edit Website</DialogTitle></DialogHeader>
          {editItem && (
            <WebsiteForm existing={editItem} onSaved={onEdited} onCancel={() => setEditItem(null)} />
          )}
        </DialogContent>
      </Dialog>

      {/* Assign dialog */}
      <Dialog open={!!assignItem} onOpenChange={(o) => { if (!o) setAssignItem(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Assign Members — {assignItem?.name}
            </DialogTitle>
          </DialogHeader>
          {assignItem && (
            <AssignForm
              website={assignItem}
              members={members}
              onSaved={onAssigned}
              onCancel={() => setAssignItem(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteId} onOpenChange={(o) => { if (!o) setDeleteId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Delete website?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">This will permanently delete the website and all its assignments.</p>
          <div className="flex gap-2 justify-end mt-2">
            <Button variant="outline" onClick={() => setDeleteId(null)} disabled={deleting}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleting}>
              {deleting && <Loader2 className="h-4 w-4 animate-spin" />} Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Website Form (Add / Edit) ────────────────────────────────────────────────

function WebsiteForm({ existing, onSaved, onCancel }: {
  existing?: WebsiteRow;
  onSaved: (w: WebsiteRow) => void;
  onCancel: () => void;
}) {
  const [name,    setName]    = useState(existing?.name ?? "");
  const [url,     setUrl]     = useState(existing?.url  ?? "");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("Website name is required."); return; }
    setError(""); setLoading(true);

    const endpoint = existing ? `/api/websites/${existing.id}` : "/api/websites";
    const method   = existing ? "PATCH" : "POST";

    const res = await fetch(endpoint, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), url: url.trim() }),
    });

    setLoading(false);
    if (!res.ok) { setError((await res.json()).error ?? "Something went wrong."); return; }
    onSaved(await res.json());
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label>Website Name <span className="text-destructive">*</span></Label>
        <Input placeholder="e.g. Aviation Axis" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div className="space-y-1.5">
        <Label>URL <span className="text-xs text-muted-foreground">(optional)</span></Label>
        <Input placeholder="https://aviationaxis.com" value={url} onChange={(e) => setUrl(e.target.value)} />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-2 justify-end pt-1">
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>Cancel</Button>
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {existing ? "Save Changes" : "Add Website"}
        </Button>
      </div>
    </form>
  );
}

// ─── Assign Form ──────────────────────────────────────────────────────────────

function AssignForm({ website, members, onSaved, onCancel }: {
  website: WebsiteRow;
  members: MemberOption[];
  onSaved: (w: WebsiteRow) => void;
  onCancel: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(
    new Set(website.assignedTo.map((a) => a.userId))
  );
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function handleSave() {
    setError(""); setLoading(true);
    const assignedTo = members
      .filter((m) => selected.has(m.id))
      .map((m) => ({ userId: m.id, userName: m.name }));

    const res = await fetch(`/api/websites/${website.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignedTo }),
    });

    setLoading(false);
    if (!res.ok) { setError((await res.json()).error ?? "Something went wrong."); return; }
    onSaved(await res.json());
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Select the team members who should work on <span className="font-medium text-foreground">{website.name}</span>.
      </p>

      {members.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">No team members found.</p>
      ) : (
        <div className="space-y-1 max-h-72 overflow-y-auto rounded-lg border p-2">
          {members.map((m) => {
            const isChecked = selected.has(m.id);
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => toggle(m.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors text-left",
                  isChecked ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted/50"
                )}
              >
                <div className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold uppercase shrink-0",
                  isChecked ? "bg-primary text-primary-foreground" : "bg-muted"
                )}>
                  {m.name[0]}
                </div>
                <span className="flex-1">{m.name}</span>
                <div className={cn(
                  "h-4 w-4 rounded border-2 flex items-center justify-center shrink-0",
                  isChecked ? "bg-primary border-primary" : "border-muted-foreground/40"
                )}>
                  {isChecked && (
                    <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {selected.size} member{selected.size !== 1 ? "s" : ""} selected
      </p>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={onCancel} disabled={loading}>Cancel</Button>
        <Button onClick={handleSave} disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          Save Assignments
        </Button>
      </div>
    </div>
  );
}
