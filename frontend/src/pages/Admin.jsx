import { useLayoutEffect } from "react";
import AppShell from "@/components/AppShell";
import { AlertPanel } from "@/components/Fields";
import { scrollViewToTop } from "@/lib/scroll";
import { Construction } from "lucide-react";

/** Admin module placeholder — full users/facilities/masters UI is not exposed yet. */
export default function Admin() {
  useLayoutEffect(() => {
    scrollViewToTop();
  }, []);

  return (
    <AppShell title="Admin" subtitle="Programme administration">
      <div className="mx-auto max-w-xl py-10" data-testid="admin-in-progress">
        <div className="mb-6 flex justify-center">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-secondary text-primary">
            <Construction className="h-7 w-7" />
          </span>
        </div>
        <AlertPanel level="info" title="Admin is in progress" testid="admin-in-progress-alert">
          User management, facilities and master data will be available here later. For now, manage users and access in
          Apex / HMIS. Clinical work (patients, episodes, sync) continues as usual.
        </AlertPanel>
      </div>
    </AppShell>
  );
}
