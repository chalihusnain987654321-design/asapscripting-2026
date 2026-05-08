"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Loader2, Link2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export interface BacklinkSiteRow {
  id:          string;
  url:         string;
  da:          number | null;
  spamScore:   number | null;
  niche:       string;
  notes:       string;
  addedBy:     string;
  addedByName: string;
  createdAt:   string;
}

interface Props {
  sites:         BacklinkSiteRow[];
  viewerRole:    string;
  currentUserId: string;
}

export function BacklinkSitesClient({ sites: initial, viewerRole, currentUserId }: Props) {
  const router = useRouter();
  const [sites,     setSites]     = useState(initial);
  const [addOpen,   setAddOpen]   = useState(false);
  const [deleteId,  setDeleteId]  = useState<string | null>(null);
  const [deleting,  setDeleting]  = useState(false);

  const isSuperAdmin = viewerRole === "super-admin";

  function canDelete(site: BacklinkSiteRow) {
    return isSuperAdmin || site.addedBy === currentUserId;
  }

  async function confirmDelete() {
    if (!deleteId) return;
    setDeleting(true);
    const res = await fetch(`/api/backlink-sites/${deleteId}`, { method: "DELETE" });
    setDeleting(false);
    if (res.ok) {
      setSites((prev) => prev.filter((s) => s.id !== deleteId));
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
          <h2 className="text-2xl font-bold">Backlink Sites</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Approved source sites for team members to build backlinks on
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4" />
          Add Site
        </Button>
      </div>

      {/* Table */}
      {sites.length === 0 ? (
        <div className="rounded-lg border bg-card p-12 text-center">
          <Link2 className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No approved sites yet. Add the first one.</p>
        </div>
      ) : (
        <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">URL</th>
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">DA</th>
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Spam Score</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Niche</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Notes</th>
                  {isSuperAdmin && (
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Added By</th>
                  )}
                  <th className="px-4 py-3 w-16" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {sites.map((site) => (
                  <tr key={site.id} className="hover:bg-muted/20 transition-colors group">
                    <td className="px-4 py-3 max-w-[280px]">
                      <a
                        href={site.url.startsWith("http") ? site.url : `https://${site.url}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-blue-600 hover:underline text-xs font-medium"
                      >
                        <span className="truncate">{site.url}</span>
                        <ExternalLink className="h-3 w-3 shrink-0" />
                      </a>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {site.da != null ? (
                        <span className={`font-semibold ${site.da >= 40 ? "text-green-600" : site.da >= 20 ? "text-yellow-600" : "text-red-500"}`}>
                          {site.da}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {site.spamScore != null ? (
                        <span className={`font-semibold ${site.spamScore <= 5 ? "text-green-600" : site.spamScore <= 15 ? "text-yellow-600" : "text-red-500"}`}>
                          {site.spamScore}%
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{site.niche || "—"}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground max-w-[200px]">
                      <span className="truncate block" title={site.notes}>{site.notes || "—"}</span>
                    </td>
                    {isSuperAdmin && (
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <div className="h-5 w-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold uppercase shrink-0">
                            {site.addedByName[0]}
                          </div>
                          {site.addedByName.split(" ")[0]}
                        </div>
                      </td>
                    )}
                    <td className="px-4 py-3">
                      {canDelete(site) && (
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex justify-end">
                          <Button
                            variant="ghost" size="sm"
                            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                            onClick={() => setDeleteId(site.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Add Backlink Sites</DialogTitle></DialogHeader>
          <AddSiteForm
            onSaved={(newSites) => {
              setSites((prev) => [...newSites, ...prev]);
              setAddOpen(false);
              router.refresh();
            }}
            onCancel={() => setAddOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteId} onOpenChange={(o) => { if (!o) setDeleteId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Remove this site?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will remove the site from the approved pool. Existing backlinks using this site won&apos;t be affected.
          </p>
          <div className="flex gap-2 justify-end mt-2">
            <Button variant="outline" onClick={() => setDeleteId(null)} disabled={deleting}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleting}>
              {deleting && <Loader2 className="h-4 w-4 animate-spin" />} Remove
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Add Site Form ────────────────────────────────────────────────────────────

function AddSiteForm({ onSaved, onCancel }: {
  onSaved: (sites: BacklinkSiteRow[]) => void;
  onCancel: () => void;
}) {
  const [urlsText,  setUrlsText]  = useState("");
  const [da,        setDa]        = useState("");
  const [spamScore, setSpamScore] = useState("");
  const [niche,     setNiche]     = useState("");
  const [notes,     setNotes]     = useState("");
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState("");

  const urlCount = urlsText.split("\n").map((u) => u.trim()).filter(Boolean).length;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const urls = urlsText.split("\n").map((u) => u.trim()).filter(Boolean);
    if (urls.length === 0) { setError("Enter at least one URL."); return; }
    setError(""); setLoading(true);

    const res = await fetch("/api/backlink-sites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ urls, da, spamScore, niche, notes }),
    });

    setLoading(false);
    if (!res.ok) { setError((await res.json()).error ?? "Something went wrong."); return; }
    onSaved(await res.json());
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label>Site URLs <span className="text-destructive">*</span></Label>
          {urlCount > 0 && (
            <span className="text-xs text-muted-foreground">{urlCount} site{urlCount !== 1 ? "s" : ""}</span>
          )}
        </div>
        <textarea
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
          rows={6}
          placeholder={"example.com\nhttps://another-site.com\nthirdsite.net\n…"}
          value={urlsText}
          onChange={(e) => setUrlsText(e.target.value)}
          required
        />
        <p className="text-xs text-muted-foreground">One URL per line. DA, Spam Score, Niche, and Notes will apply to all.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>DA (Domain Authority)</Label>
          <Input
            type="number" min="0" max="100" placeholder="e.g. 35"
            value={da} onChange={(e) => setDa(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Spam Score (%)</Label>
          <Input
            type="number" min="0" max="100" placeholder="e.g. 3"
            value={spamScore} onChange={(e) => setSpamScore(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Niche / Category</Label>
        <Input
          placeholder="e.g. Aviation, Technology"
          value={niche} onChange={(e) => setNiche(e.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <Label>Notes</Label>
        <textarea
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
          rows={2}
          placeholder="Any notes about these sites (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-2 justify-end pt-1">
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>Cancel</Button>
        <Button type="submit" disabled={loading || urlCount === 0}>
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          Add {urlCount > 0 ? `${urlCount} Site${urlCount !== 1 ? "s" : ""}` : "Sites"}
        </Button>
      </div>
    </form>
  );
}
