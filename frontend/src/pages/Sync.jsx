import AppShell, { InstallPrompt } from "@/components/AppShell";
import { useStore } from "@/store";
import { Button } from "@/components/ui/button";
import { SectionCard, AlertPanel } from "@/components/Fields";
import { toast } from "sonner";
import { CloudUpload, Database, WifiOff, CheckCircle2 } from "lucide-react";

export default function Sync() {
  const { encounters, patients, pendingSync, syncNow, online } = useStore();
  const queued = encounters.filter((e) => !e.synced);

  return (
    <AppShell title="Sync &amp; offline" subtitle="Everything is written to the device first, then pushed to the cloud">
      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <SectionCard
          title="Local queue"
          desc={`${pendingSync} item(s) waiting to upload`}
          right={
            <Button
              className="h-12"
              data-testid="sync-now-btn"
              disabled={!online || pendingSync === 0}
              onClick={() => {
                const n = syncNow();
                if (n) toast.success(`${n} item${n === 1 ? "" : "s"} synced to the cloud`);
                else if (!online) toast.error("No internet. Sync when you are back online.");
              }}
            >
              <CloudUpload className="mr-2 h-4 w-4" /> Sync now
            </Button>
          }
        >
          {queued.length === 0 ? (
            <div className="flex items-center gap-3 rounded-md border border-border p-6" data-testid="queue-empty">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <p className="text-sm font-semibold">Everything is synced with the cloud.</p>
            </div>
          ) : (
            <ul className="space-y-2" data-testid="sync-queue">
              {queued.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-4 rounded-md border border-border p-4">
                  <div>
                    <p className="font-semibold">
                      Encounter {e.id} · {e.diagnosis || e.suspectFlag}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {e.patientId} · {new Date(e.date).toLocaleString()}
                    </p>
                  </div>
                  <span className="rounded border border-orange-300 bg-orange-50 px-2 py-1 text-[11px] font-bold text-orange-800">
                    Queued
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
                ["Patients cached", patients.length, Database],
                ["Encounters cached", encounters.length, Database],
              ].map(([k, v, Icon]) => (
                <div key={k} className="rounded-md border border-border p-4">
                  <Icon className="h-4 w-4 text-primary" />
                  <p className="mt-2 text-xs text-muted-foreground">{k}</p>
                  <p className="mt-1 font-head text-2xl font-bold">{v}</p>
                </div>
              ))}
            </div>
            {online ? (
              <AlertPanel level="routine" title="🟢 Online" testid="online-note">
                Save a record or tap Sync now to upload the offline queue.
              </AlertPanel>
            ) : (
              <AlertPanel level="urgent" title="🔴 Offline" testid="offline-alert">
                <span className="flex items-center gap-2">
                  <WifiOff className="h-4 w-4" /> Continue working — data stays on this device. When internet returns, Save again or tap Sync.
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
