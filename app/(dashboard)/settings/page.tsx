import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB, Settings } from "@/lib/mongodb";
import { SettingsClient } from "./settings-client";

export default async function SettingsPage() {
  await getServerSession(authOptions);

  await connectDB();
  const settings = await Settings.findOne({ singleton: true }).lean();

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-2xl font-bold">Settings</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Manage Google service accounts and property lists.
        </p>
      </div>

      <SettingsClient
        serviceAccounts={(settings?.serviceAccounts ?? []).map((a) => ({ name: a.name }))}
        gscProperties={settings?.gscProperties ?? []}
        ga4Properties={settings?.ga4Properties ?? []}
      />
    </div>
  );
}
