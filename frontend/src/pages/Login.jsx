import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "@/store";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/Fields";
import { toast } from "sonner";

export default function Login() {
  const { login } = useStore();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const set = (k) => (v) => setForm({ ...form, [k]: v });

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const u = await login(form.email, form.password);
      if (!u) {
        toast.error("Invalid email or password");
        return;
      }
      toast.success(`Welcome back, ${u.name}`, { duration: 2000 });
      navigate("/patients");
    } catch (err) {
      toast.error(err?.message || "Invalid email or password");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="relative flex min-h-screen flex-col items-center justify-center bg-primary px-4 py-8 sm:px-6"
      style={{
        backgroundImage: "url(/login/login-bg.png)",
        backgroundRepeat: "no-repeat",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
      data-testid="login-page"
    >
      <div
        className="flex w-full max-w-5xl overflow-hidden rounded-[2.5rem] bg-white shadow-xl lg:h-[min(70vh,640px)]"
        data-testid="login-card"
      >
        {/* Apex LHS image panel */}
        <div className="relative hidden w-[45%] shrink-0 bg-[#e4ecff] p-4 lg:block">
          <div
            className="flex h-full flex-col-reverse items-center rounded-[1.75rem] bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: "url(/login/login-image.png)" }}
            data-testid="login-lhs-image"
          >
            <span className="p-4 text-sm font-medium text-white drop-shadow">
              Contact your relationship manager
            </span>
          </div>
        </div>

        {/* RHS form — same credentials flow as before */}
        <div className="flex min-w-0 flex-1 flex-col px-6 py-8 sm:px-10 lg:px-12 lg:py-10">
          <div className="mb-6 flex justify-center lg:hidden">
            <span className="grid h-10 w-10 place-items-center rounded-md bg-primary font-head text-lg font-extrabold text-white">
              T
            </span>
          </div>

          <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center">
            <h1 className="font-head text-3xl font-bold tracking-tight sm:text-4xl">Login</h1>
            <p className="mt-2 text-sm font-semibold text-foreground/80">
              Welcome back! Please enter your details.
            </p>

            <form onSubmit={submit} className="mt-8 space-y-5">
              <TextField
                label="User Id / Email"
                type="email"
                testid="login-email"
                placeholder="Enter Email"
                value={form.email}
                onChange={(e) => set("email")(e.target.value)}
              />
              <TextField
                label="Password"
                type="password"
                testid="login-password"
                placeholder="Enter Password"
                value={form.password}
                onChange={(e) => set("password")(e.target.value)}
              />
              <Button
                type="submit"
                className="h-12 w-full text-base"
                data-testid="login-submit"
                disabled={busy}
              >
                {busy ? "Signing in…" : "Sign in"}
              </Button>
            </form>
          </div>

          <p className="mt-8 text-center text-xs text-muted-foreground">
            By logging in you agree to{" "}
            <span className="font-medium text-primary">Privacy policy | Terms &amp; Conditions</span>
          </p>
        </div>
      </div>

      <div className="mt-6 flex items-center gap-2 text-sm text-white" data-testid="login-powered-by">
        <span>Powered by</span>
        <img src="/login/trias.png" alt="TRIAS" className="h-5 w-auto object-contain" />
      </div>
    </div>
  );
}
