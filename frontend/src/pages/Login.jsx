import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "@/store";
import { Button } from "@/components/ui/button";
import { TextField, AlertPanel } from "@/components/Fields";
import { toast } from "sonner";
import { ShieldCheck, WifiOff, Layers, Activity } from "lucide-react";

export default function Login() {
  const { login, branding } = useStore();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const set = (k) => (v) => setForm({ ...form, [k]: v });

  const submit = (e) => {
    e.preventDefault();
    const u = login(form.email, form.password);
    if (!u) return toast.error("Invalid email or password");
    toast.success(`Welcome back, ${u.name}`);
    navigate("/patients");
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <div className="trias-grid relative hidden flex-col justify-between bg-primary p-10 text-white lg:flex xl:p-14">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-md bg-white font-head text-lg font-extrabold text-primary">
            T
          </span>
          <span>
            <span className="block font-head text-lg font-extrabold leading-none">TRIAS</span>
            <span className="text-[11px] font-medium uppercase tracking-[0.2em] text-white/70">Skin &amp; NTD</span>
          </span>
        </div>

        <div className="stagger max-w-xl">
          <h1 className="font-head text-4xl font-extrabold leading-[1.05] tracking-tight xl:text-5xl">
            Scabies case &amp; household management, built for the field.
          </h1>
          <p className="mt-6 max-w-md text-base leading-relaxed text-white/80">
            Clinical care, household control and NTD surveillance in one offline-first record — designed for community
            health workers in Papua New Guinea.
          </p>
          <ul className="mt-10 space-y-4 text-sm">
            {[
              [WifiOff, "Works fully offline; syncs when a signal returns"],
              [Layers, "Patient → Episode → Encounter → Household model"],
              [Activity, "Weight-based dosing and automatic clinical alerts"],
              [ShieldCheck, "Role-based access to your own, facility or all data"],
            ].map(([Icon, text]) => (
              <li key={text} className="flex items-start gap-3">
                <Icon className="mt-0.5 h-5 w-5 shrink-0 text-white/80" />
                <span className="text-white/85">{text}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs uppercase tracking-[0.2em] text-white/50">{branding.clientName}</p>
      </div>

      <div className="flex items-center justify-center bg-background px-5 py-12 sm:px-10">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="grid h-10 w-10 place-items-center rounded-md bg-primary font-head font-extrabold text-white">
              T
            </span>
            <span className="font-head text-lg font-extrabold tracking-tight">TRIAS Skin &amp; NTD</span>
          </div>

          <h2 className="font-head text-3xl font-bold tracking-tight">Sign in</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Use your programme credentials to open your caseload. Accounts are created by your programme administrator.
          </p>

          <form onSubmit={submit} className="mt-6 space-y-5">
            <TextField
              label="Email"
              type="email"
              testid="login-email"
              placeholder="you@trias.health"
              value={form.email}
              onChange={(e) => set("email")(e.target.value)}
            />
            <TextField
              label="Password"
              type="password"
              testid="login-password"
              placeholder="••••••••"
              value={form.password}
              onChange={(e) => set("password")(e.target.value)}
            />
            <Button type="submit" className="h-12 w-full text-base" data-testid="login-submit">
              Sign in
            </Button>
          </form>

          <div className="mt-6">
            <AlertPanel level="info" title="Prototype demo accounts" testid="demo-accounts">
              <ul className="space-y-1">
                <li>
                  <b>Admin (all data):</b> admin@trias.health / Admin@123
                </li>
                <li>
                  <b>Health worker (own data):</b> joseph@trias.health / Health@123
                </li>
                <li>
                  <b>Supervisor (facility, view only):</b> mary@trias.health / Health@123
                </li>
              </ul>
            </AlertPanel>
          </div>
        </div>
      </div>
    </div>
  );
}
