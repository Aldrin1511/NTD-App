import { useState } from "react";
import AppShell, { InstallPrompt } from "@/components/AppShell";
import { useStore } from "@/store";
import { Button } from "@/components/ui/button";
import { SectionCard, AlertPanel } from "@/components/Fields";
import { toast } from "sonner";
import { CloudUpload, Database, WifiOff, CheckCircle2, AlertTriangle } from "lucide-react";

const OP_LABEL = {
  REGISTER_PATIENT: "Register patient",
  START_EPISODE: "Start episode",
  ADD_VISIT: "Add visit",
  START_SUSPECT: "Suspect screening",
  SAVE_ENCOUNTER_FORM: "Disease form",
};

export default function Sync() {
  const { pendingSync, syncNow, online, outboxOps = [], refreshOutboxState } = useStore();
  const [busy, setBusy] = useState(false);
  const queued = outboxOps.filter((o) => o.status === "pending" || o.status === "failed" || o.status === "in_progress");

  const runSync = async () => {
    if (!online) {
      toast.error("No internet. Sync when you are back online.");
      return;
    }
    if (pendingSync === 0) return;
    setBusy(true);
    try {
      const result = await syncNow();
      await refreshOutboxState?.();
      if (result?.synced) {
        toast.success(`${result.synced} item${result.synced === 1 ? "" : "s"} uploaded to HMIS`);
      }
      if (result?.failed) {
        const first = result.errors?.[0]?.message;
        toast.error(`${result.failed} failed${first ? `: ${first}` : ""}`);
      }
      if (!result?.synced && !result?.failed) {
        toast.message("Nothing to sync");
      }
    } catch (err) {
      toast.error(err?.message || "Sync failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell title="Sync &amp; offline" subtitle="Offline work is stored in IndexedDB, then replayed to HMIS when you sync">
      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <SectionCard
          title="Local queue"
          desc={`${pendingSync} operation(s) waiting to upload`}
          right={
            <Button
              className="h-12"
              data-testid="sync-now-btn"
              disabled={!online || pendingSync === 0 || busy}
              onClick={runSync}
            >
              <CloudUpload className="mr-2 h-4 w-4" /> {busy ? "Syncing…" : "Sync now"}
            </Button>
          }
        >
          {queued.length === 0 ? (
            <div className="flex items-center gap-3 rounded-md border border-border p-6" data-testid="queue-empty">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <p className="text-sm font-semibold">Everything is synced with HMIS.</p>
            </div>
          ) : (
            <ul className="space-y-2" data-testid="sync-queue">
              {queued.map((op) => (
                <li key={op.id} className="flex items-center justify-between gap-4 rounded-md border border-border p-4">
                  <div className="min-w-0">
                    <p className="font-semibold truncate">
                      {op.label || OP_LABEL[op.type] || op.type}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {op.type}
                      {op.error ? ` · ${op.error}` : ""}
                    </p>
                  </div>
                  <span
                    className={`rounded border px-2 py-1 text-[11px] font-bold ${
                      op.status === "failed"
                        ? "border-red-300 bg-red-50 text-red-800"
                        : "border-orange-300 bg-orange-50 text-orange-800"
                    }`}
                  >
                    {op.status === "failed" ? "Failed" : "Queued"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <div className="space-y-6">
          <SectionCard title="Device storage">
            <div className="grid grid-cols-2 gap-3">
              {[
                ["Pending ops", pendingSync, Database],
                ["Failed", queued.filter((o) => o.status === "failed").length, AlertTriangle],
              ].map(([k, v, Icon]) => (
                <div key={k} className="rounded-md border border-border p-4">
                  <Icon className="h-4 w-4 text-primary" />
                  <p className="mt-2 text-xs text-muted-foreground">{k}</p>
                  <p className="mt-1 font-head text-2xl font-bold">{v}</p>
                </div>
              ))}
            </div>
            {online ? (
              <AlertPanel level="routine" title="Online" testid="online-note">
                Tap Sync now to upload register → episode → form answers and photographs to HMIS.
              </AlertPanel>
            ) : (
              <AlertPanel level="urgent" title="Offline" testid="offline-alert">
                <span className="flex items-center gap-2">
                  <WifiOff className="h-4 w-4" /> Continue working — data stays in IndexedDB on this device.
                </span>
              </AlertPanel>
            )}
          </SectionCard>
          <InstallPrompt />
        </div>
      </div>
    </AppShell>
  );
}
