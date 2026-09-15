import { Avatar, dobFromAge, fingerprintSummary, patientAgeLabel } from "@/components/Capture";
import { Badge } from "@/components/ui/badge";

export const PatientHeader = ({ patient: p, right, children, testid = "patient-header" }) => {
  const dob = p.dob || dobFromAge(p.age, p.createdAt);
  const fp = fingerprintSummary(p.fingerprint);
  const chips = [
    ["Date of Birth", dob || "—"],
    ["Age", patientAgeLabel(p)],
    ["Gender", p.gender || p.sex || "—"],
    ["Weight", `${p.weight} kg`],
    ["Height", p.height ? `${p.height} cm` : "—"],
    ["Blood", p.bloodGroup || "Unknown"],
    ["Phone", p.phone || "—"],
    ["Email", p.email || "—"],
    ["Village", `${p.village}, ${p.district}`],
    ["Province", p.province],
  ];

  return (
    <section className="mb-4 rounded-lg border border-border bg-white p-4" data-testid={testid}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <Avatar patient={p} size="h-16 w-16" testid={`${testid}-photo`} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="font-head text-2xl font-bold tracking-tight sm:text-3xl">{p.name}</h1>
            <Badge variant="outline" className="rounded text-[11px]">{p.status}</Badge>
            <span className="text-xs text-muted-foreground">
              {p.id} · {p.episodeId}
            </span>
            {fp && (
              <span className="text-xs text-muted-foreground">FP {fp}</span>
            )}
          </div>
          <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm" data-testid={`${testid}-details`}>
            {chips.map(([k, v]) => (
              <span key={k} className="flex items-baseline gap-1.5">
                <dt className="text-[11px] text-muted-foreground">{k}</dt>
                <dd className="font-semibold">{v}</dd>
              </span>
            ))}
          </dl>
          {children}
        </div>
        {right && <div className="shrink-0">{right}</div>}
      </div>
    </section>
  );
};
