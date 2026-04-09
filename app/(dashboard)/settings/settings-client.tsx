"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Plus, Loader2, ShieldAlert, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

interface ServiceAccount { name: string }
interface GscProperty { url: string; displayName: string }
interface Ga4Property { propertyId: string; displayName: string }

interface SettingsClientProps {
  serviceAccounts: ServiceAccount[];
  gscProperties: GscProperty[];
  ga4Properties: Ga4Property[];
}

export function SettingsClient(props: SettingsClientProps) {
  return (
    <div className="space-y-6">
      <ServiceAccountsCard initial={props.serviceAccounts} />
      <GscPropertiesCard initial={props.gscProperties} />
      <Ga4PropertiesCard initial={props.ga4Properties} />
    </div>
  );
}

// ─── Service Accounts ────────────────────────────────────────────────────────

function ServiceAccountsCard({ initial }: { initial: ServiceAccount[] }) {
  const router = useRouter();
  const [accounts, setAccounts] = useState(initial);
  const [name, setName] = useState("");
  const [json, setJson] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setSuccess(""); setLoading(true);

    const res = await fetch("/api/settings/credentials", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, credentialsJson: json }),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json();
      setError(data.error);
      return;
    }

    const data = await res.json();
    setAccounts(data.serviceAccounts);
    setName(""); setJson("");
    setSuccess(`"${name}" added successfully.`);
    router.refresh();
  }

  async function handleRemove(accountName: string) {
    if (!confirm(`Remove service account "${accountName}"? Scripts using it will stop working.`)) return;
    setLoading(true);

    const res = await fetch("/api/settings/credentials", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: accountName }),
    });

    setLoading(false);

    if (res.ok) {
      const data = await res.json();
      setAccounts(data.serviceAccounts);
      router.refresh();
    }
  }

  return (
    <div className="rounded-lg border bg-card p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Google Service Accounts</h3>
          <p className="text-sm text-muted-foreground">
            Add one per Google Cloud project. Scripts will let you pick which one to use.
          </p>
        </div>
        <Badge variant={accounts.length > 0 ? "success" : "outline"}
          className={accounts.length === 0 ? "text-yellow-700 border-yellow-300 bg-yellow-50" : ""}>
          {accounts.length > 0
            ? `${accounts.length} configured`
            : <><ShieldAlert className="h-3 w-3 inline mr-1" />None</>}
        </Badge>
      </div>

      {/* Existing accounts list */}
      {accounts.length > 0 && (
        <div className="space-y-2">
          {accounts.map((account) => (
            <div key={account.name}
              className="flex items-center justify-between rounded-md border px-3 py-2">
              <div className="flex items-center gap-2 text-sm">
                <KeyRound className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{account.name}</span>
              </div>
              <Button variant="ghost" size="sm" onClick={() => handleRemove(account.name)}
                disabled={loading}>
                <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Add new account form */}
      <form onSubmit={handleAdd} className="space-y-3 pt-2 border-t">
        <p className="text-sm font-medium pt-1">Add a service account</p>
        <div className="space-y-1.5">
          <Label htmlFor="sa-name">Account name / label</Label>
          <Input
            id="sa-name"
            placeholder="e.g. ASAP Main Account"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sa-json">Service account JSON</Label>
          <Textarea
            id="sa-json"
            className="font-mono text-xs min-h-[140px]"
            placeholder={'{\n  "type": "service_account",\n  "project_id": "...",\n  ...\n}'}
            value={json}
            onChange={(e) => setJson(e.target.value)}
            required
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {success && <p className="text-sm text-green-600">{success}</p>}
        <Button type="submit" size="sm" disabled={loading || !name.trim() || !json.trim()}>
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          <Plus className="h-4 w-4" />
          Add account
        </Button>
      </form>
    </div>
  );
}

// ─── GSC Properties ──────────────────────────────────────────────────────────

function GscPropertiesCard({ initial }: { initial: GscProperty[] }) {
  const router = useRouter();
  const [properties, setProperties] = useState(initial);
  const [newUrl, setNewUrl] = useState("");
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);

  async function save(updated: GscProperty[]) {
    setSaving(true);
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gscProperties: updated }),
    });
    setSaving(false);
    if (res.ok) {
      const data = await res.json();
      setProperties(data.gscProperties);
      router.refresh();
    }
  }

  function add() {
    if (!newUrl.trim() || !newName.trim()) return;
    save([...properties, { url: newUrl.trim(), displayName: newName.trim() }]);
    setNewUrl(""); setNewName("");
  }

  return (
    <div className="rounded-lg border bg-card p-5 shadow-sm space-y-4">
      <div>
        <h3 className="font-semibold">Google Search Console Properties</h3>
        <p className="text-sm text-muted-foreground">Properties available for use in GSC scripts.</p>
      </div>

      {properties.length > 0 && (
        <div className="space-y-2">
          {properties.map((p, i) => (
            <div key={i} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
              <div>
                <span className="font-medium">{p.displayName}</span>
                <span className="text-muted-foreground ml-2 text-xs">{p.url}</span>
              </div>
              <Button variant="ghost" size="sm"
                onClick={() => save(properties.filter((_, j) => j !== i))} disabled={saving}>
                <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2 items-end">
        <div className="space-y-1 flex-1">
          <Label className="text-xs">Property URL</Label>
          <Input placeholder="https://example.com/" value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())} />
        </div>
        <div className="space-y-1 flex-1">
          <Label className="text-xs">Display name</Label>
          <Input placeholder="Example.com" value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())} />
        </div>
        <Button size="sm" onClick={add} disabled={saving || !newUrl.trim() || !newName.trim()}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

// ─── GA4 Properties ───────────────────────────────────────────────────────────

function Ga4PropertiesCard({ initial }: { initial: Ga4Property[] }) {
  const router = useRouter();
  const [properties, setProperties] = useState(initial);
  const [newId, setNewId] = useState("");
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);

  async function save(updated: Ga4Property[]) {
    setSaving(true);
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ga4Properties: updated }),
    });
    setSaving(false);
    if (res.ok) {
      const data = await res.json();
      setProperties(data.ga4Properties);
      router.refresh();
    }
  }

  function add() {
    if (!newId.trim() || !newName.trim()) return;
    save([...properties, { propertyId: newId.trim(), displayName: newName.trim() }]);
    setNewId(""); setNewName("");
  }

  return (
    <div className="rounded-lg border bg-card p-5 shadow-sm space-y-4">
      <div>
        <h3 className="font-semibold">GA4 Properties</h3>
        <p className="text-sm text-muted-foreground">Properties available for the GA4 Reporter script.</p>
      </div>

      {properties.length > 0 && (
        <div className="space-y-2">
          {properties.map((p, i) => (
            <div key={i} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
              <div>
                <span className="font-medium">{p.displayName}</span>
                <span className="text-muted-foreground ml-2 text-xs font-mono">{p.propertyId}</span>
              </div>
              <Button variant="ghost" size="sm"
                onClick={() => save(properties.filter((_, j) => j !== i))} disabled={saving}>
                <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2 items-end">
        <div className="space-y-1 flex-1">
          <Label className="text-xs">Property ID</Label>
          <Input placeholder="properties/123456789" value={newId}
            onChange={(e) => setNewId(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())} />
        </div>
        <div className="space-y-1 flex-1">
          <Label className="text-xs">Display name</Label>
          <Input placeholder="Example.com (GA4)" value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())} />
        </div>
        <Button size="sm" onClick={add} disabled={saving || !newId.trim() || !newName.trim()}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
