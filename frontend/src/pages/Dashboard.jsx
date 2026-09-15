import { useMemo, useState } from "react";
import AppShell, { InstallPrompt } from "@/components/AppShell";
import { useStore } from "@/store";
import { SelectField, TextField, AlertPanel } from "@/components/Fields";
import { MIS_TREND, MIS_VILLAGE, MIS_AGE, MIS_CLASS, GEO, DISEASES } from "@/mock/data";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Button } from "@/components/ui/button";
import { SlidersHorizontal, TrendingUp, Users, Home, Baby, Syringe, AlertTriangle, RotateCcw, Percent } from "lucide-react";

const Kpi = ({ label, value, sub, icon: Icon, tone = "primary", testid }) => {
  const tones = {
    primary: "text-primary bg-secondary",
    urgent: "text-red-700 bg-red-50",
    review: "text-orange-700 bg-orange-50",
    routine: "text-green-700 bg-green-50",
  };
  return (
    <div className="rounded-lg border border-border bg-white p-5" data-testid={testid}>
      <div className="flex items-start justify-between">
        <p className="text-xs font-semibold text-muted-foreground">{label}</p>
        <span className={`grid h-9 w-9 place-items-center rounded-md ${tones[tone]}`}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-4 font-head text-3xl font-extrabold tracking-tight">{value}</p>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
};

export default function Dashboard() {
  const { visiblePatients, encounters, households, user, users } = useStore();
  const patients = visiblePatients();
  const [f, setF] = useState({ province: "", district: "", village: "", disease: "Scabies", period: "Last 6 months", clinician: "", from: "", to: "" });
  const [showFilters, setShowFilters] = useState(false);
  const [asTable, setAsTable] = useState(false);
  const activeFilters = [f.province, f.district, f.village, f.clinician].filter(Boolean).length;

  const districts = f.province ? Object.keys(GEO[f.province] || {}) : [];
  const villages = f.province && f.district ? GEO[f.province]?.[f.district] || [] : [];

  const rows = useMemo(
    () =>
      patients.filter(
        (p) =>
          (!f.province || p.province === f.province) &&
          (!f.district || p.district === f.district) &&
          (!f.village || p.village === f.village) &&
          (!f.clinician || encounters.some((e) => e.patientId === p.id && e.worker === f.clinician))
      ),
    [patients, f, encounters]
  );

  const confirmed = rows.filter((p) => p.status === "Confirmed").length;
  const children = rows.filter((p) => p.age < 15).length;
  const crusted = rows.filter((p) => p.status === "Crusted").length;
  const hhIds = [...new Set(rows.map((p) => p.household))];
  const hh = households.filter((h) => hhIds.includes(h.id));
  const coverage = hh.length
    ? Math.round((hh.reduce((a, h) => a + h.treated, 0) / hh.reduce((a, h) => a + h.members, 0)) * 100)
    : 0;

  return (
    <AppShell
      title="MIS Dashboard"
      subtitle={`Programme indicators for the data you can access — ${
        user?.scope === "all" ? "all facilities" : user?.scope === "province" ? `${user.province} Province` : "your own records"
      }`}
    >
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Button variant={activeFilters ? "default" : "outline"} className="h-12 px-4" data-testid="mis-filter-toggle-btn" onClick={() => setShowFilters((v) => !v)}>
          <SlidersHorizontal className="h-4 w-4" />
          {activeFilters > 0 && <span className="ml-2 text-xs font-bold">{activeFilters}</span>}
        </Button>
        <span className="text-sm text-muted-foreground" data-testid="filter-result-count">{rows.length} patient records in scope</span>
        <Button variant="outline" className="ml-auto h-12" data-testid="mis-view-toggle-btn" onClick={() => setAsTable((v) => !v)}>
          {asTable ? "Show graphs" : "Show tables"}
        </Button>
        <Button variant="outline" className="h-12" data-testid="export-mis-btn">Export indicators (CSV)</Button>
      </div>

      {showFilters && (
      <div className="mb-6 rounded-lg border border-border bg-white p-5" data-testid="mis-filter-panel">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SelectField
            label="Period"
            options={["Last 30 days", "Last 3 months", "Last 6 months", "This year", "Custom"]}
            value={f.period}
            onChange={(v) => setF({ ...f, period: v })}
            testid="filter-period"
          />
          <SelectField
            label="Province"
            options={Object.keys(GEO)}
            value={f.province}
            onChange={(v) => setF({ ...f, province: v, district: "", village: "" })}
            testid="filter-province"
          />
          <SelectField
            label="District"
            options={districts}
            value={f.district}
            onChange={(v) => setF({ ...f, district: v, village: "" })}
            testid="filter-district"
          />
          <SelectField label="Village" options={villages} value={f.village} onChange={(v) => setF({ ...f, village: v })} testid="filter-village" />
          <SelectField
            label="Disease"
            options={DISEASES.map((d) => d.name)}
            value={f.disease}
            onChange={(v) => setF({ ...f, disease: v })}
            testid="filter-disease"
          />
          <SelectField label="Clinician" options={users.map((u) => u.name)} value={f.clinician} onChange={(v) => setF({ ...f, clinician: v })} testid="filter-clinician" />
          {f.period === "Custom" && (
            <>
              <TextField label="From" type="date" testid="filter-from" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} />
              <TextField label="To" type="date" testid="filter-to" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} />
            </>
          )}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            variant="ghost"
            className="h-11"
            data-testid="clear-filters-btn"
            onClick={() => setF({ province: "", district: "", village: "", disease: "Scabies", period: "Last 6 months", clinician: "", from: "", to: "" })}
          >
            Clear filters
          </Button>
        </div>
      </div>
      )}

      <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="New episodes" value={rows.length} sub="Scabies episodes opened" icon={TrendingUp} testid="kpi-episodes" />
        <Kpi label="Patients" value={rows.length} sub={`${children} children under 15`} icon={Users} testid="kpi-patients" />
        <Kpi label="Households" value={hh.length} sub={`${hh.reduce((a, h) => a + h.members, 0)} members listed`} icon={Home} testid="kpi-households" />
        <Kpi label="Household coverage" value={`${coverage}%`} sub="Members treated simultaneously" icon={Percent} tone="routine" testid="kpi-coverage" />
        <Kpi label="Confirmed cases" value={confirmed} sub={`${rows.length - confirmed} suspected / clinical`} icon={Syringe} testid="kpi-confirmed" />
        <Kpi label="Treatment completion" value="78%" sub="Second dose recorded" icon={Percent} tone="routine" testid="kpi-completion" />
        <Kpi label="Treatment failure" value="9%" sub="Recurrence rate 6%" icon={RotateCcw} tone="review" testid="kpi-failure" />
        <Kpi label="Crusted scabies" value={crusted} sub="Secondary infection rate 14%" icon={AlertTriangle} tone="urgent" testid="kpi-crusted" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="rounded-lg border border-border bg-white p-5 lg:col-span-2">
          <h3 className="font-head text-xl font-semibold tracking-tight">Episodes by month</h3>
          <p className="mb-4 text-sm text-muted-foreground">New scabies episodes vs confirmed cases</p>
          {asTable ? (
            <div className="overflow-x-auto rounded-md border border-border" data-testid="mis-trend-table">
              <table className="w-full text-sm">
                <thead className="bg-muted"><tr><th className="p-2 text-left font-semibold">Month</th><th className="p-2 text-left font-semibold">Episodes</th><th className="p-2 text-left font-semibold">Confirmed</th></tr></thead>
                <tbody>{MIS_TREND.map((r) => (<tr key={r.month} className="border-t border-border"><td className="p-2 font-semibold">{r.month}</td><td className="p-2">{r.episodes}</td><td className="p-2">{r.confirmed}</td></tr>))}</tbody>
              </table>
            </div>
          ) : (
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={MIS_TREND}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
              <XAxis dataKey="month" stroke="#475569" fontSize={12} />
              <YAxis stroke="#475569" fontSize={12} />
              <Tooltip />
              <Area type="monotone" dataKey="episodes" stroke="#0F52BA" fill="#DBEAFE" strokeWidth={2.5} />
              <Area type="monotone" dataKey="confirmed" stroke="#F97316" fill="#FFEDD5" strokeWidth={2.5} />
            </AreaChart>
          </ResponsiveContainer>
          )}
        </div>

        <div className="rounded-lg border border-border bg-white p-5">
          <h3 className="font-head text-xl font-semibold tracking-tight">IACS classification</h3>
          <p className="mb-4 text-sm text-muted-foreground">Case mix across the programme</p>
          <ResponsiveContainer width="100%" height={230}>
            <PieChart>
              <Pie data={MIS_CLASS} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                {["#0F52BA", "#F97316", "#94A3B8"].map((c) => (
                  <Cell key={c} fill={c} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <ul className="mt-2 space-y-1 text-sm">
            {MIS_CLASS.map((c, i) => (
              <li key={c.name} className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: ["#0F52BA", "#F97316", "#94A3B8"][i] }} />
                {c.name} — <b>{c.value}</b>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-lg border border-border bg-white p-5">
          <h3 className="font-head text-xl font-semibold tracking-tight">Geographic hotspots</h3>
          <p className="mb-4 text-sm text-muted-foreground">Cases by village</p>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={MIS_VILLAGE} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={false} />
              <XAxis type="number" stroke="#475569" fontSize={12} />
              <YAxis type="category" dataKey="village" width={70} stroke="#475569" fontSize={12} />
              <Tooltip />
              <Bar dataKey="cases" fill="#0F52BA" radius={[0, 4, 4, 0]} barSize={16} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-lg border border-border bg-white p-5">
          <h3 className="font-head text-xl font-semibold tracking-tight">Cases by age band</h3>
          <p className="mb-4 text-sm text-muted-foreground">School-age children carry the highest burden</p>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={MIS_AGE}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
              <XAxis dataKey="band" stroke="#475569" fontSize={12} />
              <YAxis stroke="#475569" fontSize={12} />
              <Tooltip />
              <Bar dataKey="cases" fill="#F97316" radius={[4, 4, 0, 0]} barSize={26} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="space-y-4">
          <AlertPanel level="urgent" title="🔴 Urgent — clinician review" testid="alert-urgent">
            {crusted} suspected crusted scabies case(s) with extensive involvement require urgent clinician assessment.
          </AlertPanel>
          <AlertPanel level="review" title="🟠 Review" testid="alert-review">
            2 households below 50% treatment coverage; 1 patient with suspected treatment failure.
          </AlertPanel>
          <AlertPanel level="routine" title="🟢 Routine" testid="alert-routine">
            {encounters.filter((e) => e.outcome).length} treatment episodes closed with recorded outcomes.
          </AlertPanel>
          <InstallPrompt />
        </div>
      </div>
    </AppShell>
  );
}
