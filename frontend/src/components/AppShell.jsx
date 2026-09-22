import { Link, NavLink, useNavigate } from "react-router-dom";
import { useStore } from "@/store";
import {
  Activity,
  Users,
  Shield,
  CloudOff,
  RefreshCw,
  CheckCircle2,
  LogOut,
  Download,
  CalendarDays,
  School,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const nav = [
  // MIS hidden for now — re-enable when ready: { to: "/dashboard", label: "MIS", icon: LayoutDashboard, testid: "nav-dashboard" },
  { to: "/patients", label: "Patients", icon: Users, testid: "nav-patients" },
  { to: "/appointments", label: "Appointments", icon: CalendarDays, testid: "nav-appointments" },
  { to: "/school-health", label: "School Health", icon: School, testid: "nav-school-health" },
  { to: "/sync", label: "Sync", icon: RefreshCw, testid: "nav-sync" },
  { to: "/admin", label: "Admin", icon: Shield, testid: "nav-admin" },
];

export const SyncChip = () => {
  const { online, pendingSync, syncNow } = useStore();
  const state = !online ? "offline" : pendingSync > 0 ? "queued" : "synced";
  const map = {
    offline: { cls: "bg-red-50 text-red-800 border-red-300", Icon: CloudOff, text: "Offline" },
    queued: { cls: "bg-orange-50 text-orange-800 border-orange-300", Icon: RefreshCw, text: `${pendingSync} queued` },
    synced: { cls: "bg-green-50 text-green-800 border-green-300", Icon: CheckCircle2, text: "Synced" },
  }[state];
  return (
    <button
      data-testid="sync-status-chip"
      onClick={() => {
        if (state === "offline") {
          toast.error("No internet. Items stay queued until you are online — then Save again or tap Sync.");
          return;
        }
        if (state === "queued") {
          const n = syncNow();
          if (n) toast.success(`${n} item${n === 1 ? "" : "s"} synced to the cloud`);
        }
      }}
      className={`inline-flex h-10 items-center gap-2 rounded-md border px-3 text-sm font-semibold ${map.cls}`}
    >
      <map.Icon className="h-4 w-4" />
      {map.text}
    </button>
  );
};

const SyncPromptDialog = () => {
  const { syncPrompt, dismissSyncPrompt, syncNow, online, pendingSync } = useStore();
  const count = Number(syncPrompt?.count) || pendingSync;
  const open = Boolean(syncPrompt) && online && count > 0;
  if (!open) return null;

  return (
    <Dialog open onOpenChange={(v) => { if (!v) dismissSyncPrompt(); }}>
      <DialogContent data-testid="sync-prompt" className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Sync pending items?</DialogTitle>
          <DialogDescription>
            You are online. {count} item{count === 1 ? "" : "s"} in the offline queue {count === 1 ? "is" : "are"} waiting to upload.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" className="h-11" data-testid="sync-prompt-later" onClick={dismissSyncPrompt}>
            Later
          </Button>
          <Button
            className="h-11"
            data-testid="sync-prompt-now"
            onClick={() => {
              const n = syncNow();
              if (n) toast.success(`${n} item${n === 1 ? "" : "s"} synced to the cloud`);
            }}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Sync now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default function AppShell({ children, title, subtitle, action }) {
  const { user, branding, logout } = useStore();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background pb-24 lg:pb-0">
      <SyncPromptDialog />
      <header className="sticky top-0 z-40 border-b border-border bg-white">
        <div className="mx-auto flex max-w-[1500px] items-center gap-3 px-4 py-3 sm:px-6">
          <Link to="/patients" className="flex items-center gap-2.5" data-testid="brand-home-link">
            {branding.logo ? (
              <img src={branding.logo} alt="logo" className="h-9 w-9 rounded-md border border-border object-cover" />
            ) : (
              <span className="grid h-9 w-9 place-items-center rounded-md bg-primary text-sm font-extrabold text-white">
                T
              </span>
            )}
            <span className="hidden sm:block">
              <span className="block font-head text-base font-extrabold leading-none tracking-tight">TRIAS</span>
              <span className="block text-[11px] font-medium text-muted-foreground">
                Skin &amp; NTD
              </span>
            </span>
          </Link>

          <nav className="ml-4 hidden items-center gap-1 lg:flex">
            {nav.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.to === "/patients"}
                data-testid={`${n.testid}-desktop`}
                className={({ isActive }) =>
                  `flex h-11 items-center gap-2 rounded-md px-4 text-sm font-semibold transition-colors ${
                    isActive ? "bg-secondary text-secondary-foreground" : "text-muted-foreground hover:bg-muted"
                  }`
                }
              >
                <n.icon className="h-4 w-4" />
                {n.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <SyncChip />
            <span className="hidden text-right sm:block">
              <span className="block text-sm font-semibold leading-tight">{user?.name}</span>
              <span className="block text-[11px] text-muted-foreground">{user?.role}</span>
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-10 w-10"
              data-testid="logout-btn"
              onClick={() => {
                logout();
                navigate("/");
              }}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 sm:py-8">
        {(title || action) && (
          <div className="mb-6 flex flex-col gap-3 border-b border-border pb-5 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="font-head text-3xl font-bold tracking-tight sm:text-4xl" data-testid="page-title">
                {title}
              </h1>
              {subtitle && <p className="mt-1.5 text-sm text-muted-foreground sm:text-base">{subtitle}</p>}
            </div>
            {action}
          </div>
        )}
        {children}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-white lg:hidden">
        <div className="grid grid-cols-5">
          {nav.slice(0, 2).map((n) => (
            <BottomItem key={n.to} {...n} />
          ))}
          <Link
            to="/patients/new"
            data-testid="nav-quick-register"
            className="flex flex-col items-center justify-center py-2"
          >
            <span className="grid h-11 w-11 place-items-center rounded-full bg-primary text-white">
              <Activity className="h-5 w-5" />
            </span>
            <span className="mt-0.5 text-[10px] font-semibold text-primary">New</span>
          </Link>
          {nav.slice(2).map((n) => (
            <BottomItem key={n.to} {...n} />
          ))}
        </div>
      </nav>
    </div>
  );
}

const BottomItem = ({ to, label, icon: Icon, testid }) => (
  <NavLink
    to={to}
    end={to === "/patients"}
    data-testid={testid}
    className={({ isActive }) =>
      `flex h-16 flex-col items-center justify-center gap-1 text-[10px] font-semibold ${
        isActive ? "text-primary" : "text-muted-foreground"
      }`
    }
  >
    <Icon className="h-5 w-5" />
    {label}
  </NavLink>
);

export const InstallPrompt = () => (
  <div className="flex items-start gap-3 rounded-lg border border-border bg-white p-4">
    <Download className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
    <p className="text-sm text-muted-foreground">
      <span className="font-semibold text-foreground">Install TRIAS.</span> Use your browser menu → “Install app” / “Add
      to Home Screen” to run TRIAS offline from your desktop or phone.
    </p>
  </div>
);
