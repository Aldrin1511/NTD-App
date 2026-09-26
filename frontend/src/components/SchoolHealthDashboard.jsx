import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertPanel, SelectField } from "@/components/Fields";
import { FeatureCard } from "@/components/EntryKit";
import { PendingSyncChip } from "@/components/StatusChips";
import { useStore } from "@/store";
import { GEO } from "@/mock/data";
import { fmtDate, fmtDateTime, groupDiseaseEpisodes } from "@/mock/specs";
import {
  SCHOOL_HEALTH_ID,
  SCHOOL_FORM_TYPES,
  formatChildAge,
  negativeExamItems,
  immunSummary,
  childStatus,
  isSuspectedNtd,
} from "@/mock/schoolhealth";
import { Pencil, Plus, Search, SlidersHorizontal, Info, CloudOff } from "lucide-react";

const dot = { red: "bg-red-500", amber: "bg-amber-500", green: "bg-green-500" };

export default function SchoolHealthDashboard({ patient, encounters, canEdit, onEdit, onAddVisit }) {
  const { schools, donors, users } = useStore();
  const episodes = useMemo(() => groupDiseaseEpisodes(encounters, SCHOOL_HEALTH_ID, null), [encounters]);
  const episode = episodes[0];
  const visits = useMemo(
    () => [...(episode?.visits || [])].sort((a, b) => String(b.date).localeCompare(String(a.date))),
    [episode]
  );

  const [q, setQ] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [fProvince, setFProvince] = useState("");
  const [fDistrict, setFDistrict] = useState("");
  const [fSchool, setFSchool] = useState("");
  const [fDonor, setFDonor] = useState("");
  const [fCreatedBy, setFCreatedBy] = useState("");
  const [fFormType, setFFormType] = useState("");
  const [offlineInfo, setOfflineInfo] = useState(null);

  const schoolNames = (schools || []).map((s) => s.name);
  const donorNames = (donors || []).map((d) => d.name);
  const creatorOptions = useMemo(() => {
    const names = new Set((users || []).map((u) => u.name).filter(Boolean));
    visits.forEach((v) => { if (v.worker) names.add(v.worker); });
    return [...names].sort();
  }, [users, visits]);

  const activeFilters = [fProvince, fDistrict, fSchool, fDonor, fCreatedBy, fFormType].filter(Boolean).length;

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return visits.filter((v) => {
      const d = v.data || {};
      if (fProvince && d.province !== fProvince) return false;
      if (fDistrict && d.district !== fDistrict) return false;
      if (fSchool && d.school !== fSchool) return false;
      if (fDonor && d.donor !== fDonor) return false;
      if (fFormType && d.formType !== fFormType) return false;
      if (fCreatedBy && v.worker !== fCreatedBy) return false;
      if (qq) {
        const hay = [patient?.name, patient?.lastName, d.school, d.donor, d.formType, d.province, d.district, v.worker, v.id]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(qq)) return false;
      }
      return true;
    });
  }, [visits, q, fProvince, fDistrict, fSchool, fDonor, fCreatedBy, fFormType, patient]);

  const totals = filtered.reduce(
    (acc, v) => {
      const d = v.data || {};
      if (d.immun?.mr === "Yes") acc.mr += 1;
      if (d.immun?.vita === "Yes") acc.vita += 1;
      if (d.immun?.tt === "Yes") acc.tt += 1;
      if (d.immun?.deworm === "Yes") acc.deworm += 1;
      if (isSuspectedNtd(d)) acc.ntd += 1;
      return acc;
    },
    { mr: 0, vita: 0, tt: 0, deworm: 0, ntd: 0 }
  );

  const latest = visits[0];

  return (
    <div className="space-y-4" data-testid="sh-dashboard">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/25 bg-secondary px-4 py-3">
        <div>
          <p className="font-semibold">School Health · {visits.length} visit{visits.length === 1 ? "" : "s"}</p>
          <p className="mt-0.5 text-xs font-medium text-secondary-foreground/80">
            {latest?.data?.school || "—"} · {latest?.data?.formType || "—"} · Status {latest?.data?.status || latest?.outcome || "New"}
          </p>
        </div>
        {canEdit && (
          <Button className="h-10" data-testid="sh-dash-add" onClick={onAddVisit}>
            <Plus className="mr-1 h-4 w-4" /> Add School health visit
          </Button>
        )}
      </div>

      {!episode ? (
        <AlertPanel level="info" title="No School Health data yet" testid="sh-dash-empty">
          Add an encounter and choose School Health, or use Add School health visit above.
        </AlertPanel>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[200px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-11 pl-9"
                placeholder="Search school, donor, form type, created by…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                data-testid="sh-dash-search"
              />
            </div>
            <Button
              variant={activeFilters ? "default" : "outline"}
              className="h-11"
              data-testid="sh-dash-filters-toggle"
              onClick={() => setShowFilters((x) => !x)}
            >
              <SlidersHorizontal className="mr-2 h-4 w-4" /> Filters
              {activeFilters > 0 && <span className="ml-2 text-xs font-bold">{activeFilters}</span>}
            </Button>
          </div>

          {showFilters && (
            <div className="grid gap-3 rounded-lg border border-border bg-white p-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="sh-dash-filters">
              <SelectField label="Province" options={Object.keys(GEO)} value={fProvince} onChange={(x) => { setFProvince(x); setFDistrict(""); }} placeholder="All provinces" testid="sh-dash-filter-province" />
              <SelectField label="District" options={Object.keys(GEO[fProvince] || {})} value={fDistrict} onChange={setFDistrict} placeholder="All districts" testid="sh-dash-filter-district" />
              <SelectField label="School" options={schoolNames} value={fSchool} onChange={setFSchool} placeholder="All schools" testid="sh-dash-filter-school" />
              <SelectField label="Donor" options={donorNames} value={fDonor} onChange={setFDonor} placeholder="All donors" testid="sh-dash-filter-donor" />
              <SelectField label="Created by" options={creatorOptions} value={fCreatedBy} onChange={setFCreatedBy} placeholder="Anyone" testid="sh-dash-filter-created-by" />
              <SelectField label="Form type" options={SCHOOL_FORM_TYPES} value={fFormType} onChange={setFFormType} placeholder="All form types" testid="sh-dash-filter-form-type" />
              <Button
                variant="ghost"
                className="h-12"
                data-testid="sh-dash-clear-filters"
                onClick={() => { setFProvince(""); setFDistrict(""); setFSchool(""); setFDonor(""); setFCreatedBy(""); setFFormType(""); }}
              >
                Clear filters
              </Button>
            </div>
          )}

          <dl className="grid grid-cols-2 gap-2 rounded-lg border border-border bg-white p-4 text-sm sm:grid-cols-5" data-testid="sh-dash-totals">
            <div><dt className="text-[11px] text-muted-foreground">Measles Rubella</dt><dd className="font-semibold text-lg">{totals.mr}</dd></div>
            <div><dt className="text-[11px] text-muted-foreground">Vitamin A</dt><dd className="font-semibold text-lg">{totals.vita}</dd></div>
            <div><dt className="text-[11px] text-muted-foreground">TT</dt><dd className="font-semibold text-lg">{totals.tt}</dd></div>
            <div><dt className="text-[11px] text-muted-foreground">Deworming</dt><dd className="font-semibold text-lg">{totals.deworm}</dd></div>
            <div><dt className="text-[11px] text-muted-foreground">Suspected NTD</dt><dd className="font-semibold text-lg">{totals.ntd}</dd></div>
          </dl>

          <FeatureCard title="Visits (L1)" count={filtered.length} testid="sh-dash-visits" defaultOpen>
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="sh-dash-table">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="p-2 font-semibold">Name</th>
                    <th className="p-2 font-semibold">School / Form</th>
                    <th className="p-2 font-semibold">Negative exam</th>
                    <th className="p-2 font-semibold">Immunization</th>
                    <th className="p-2 font-semibold">Status</th>
                    <th className="p-2 font-semibold">Visit</th>
                    <th className="p-2" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr><td colSpan={7} className="p-3 text-muted-foreground">No visits match the filters.</td></tr>
                  )}
                  {filtered.map((v) => {
                    const d = v.data || {};
                    const pending = v.synced === false;
                    const offline = d.offlineEntered || pending;
                    return (
                      <tr key={v.id} className="border-b border-border/60" data-testid={`sh-dash-row-${v.id}`}>
                        <td className="p-2">
                          <div className="flex items-start gap-2">
                            <div className="min-w-0">
                              <p className="font-semibold">{patient?.name}{patient?.lastName ? ` ${patient.lastName}` : ""}</p>
                              <p className="text-xs text-muted-foreground">{formatChildAge(d)} · {d.gender || patient?.sex || "—"}</p>
                            </div>
                            {offline && (
                              <button
                                type="button"
                                className="mt-0.5 rounded p-1 text-orange-700 hover:bg-orange-50"
                                title="Offline entered details"
                                data-testid={`sh-dash-offline-${v.id}`}
                                onClick={() => setOfflineInfo(v)}
                              >
                                <Info className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="p-2 text-xs">
                          <p className="font-medium">{d.school || "—"}</p>
                          <p className="text-muted-foreground">{d.formType || "—"} · {d.donor || "—"}</p>
                        </td>
                        <td className="p-2 text-xs">{negativeExamItems(d).join(", ") || "—"}</td>
                        <td className="p-2 text-xs">{immunSummary(d)}</td>
                        <td className="p-2">
                          <span className="inline-flex items-center gap-1.5 font-semibold capitalize">
                            <span className={`h-2.5 w-2.5 rounded-full ${dot[childStatus(d)]}`} />
                            {childStatus(d)}
                          </span>
                          <div className="mt-1 flex flex-wrap gap-1">
                            <Badge variant="outline" className="rounded text-[10px]">{d.status || v.outcome || "New"}</Badge>
                            <PendingSyncChip pending={pending} testid={`sh-dash-pending-${v.id}`} />
                          </div>
                        </td>
                        <td className="p-2 text-xs text-muted-foreground">
                          {fmtDateTime(v.date)}
                          <br />
                          Created by {v.worker || "—"}
                        </td>
                        <td className="p-2 text-right">
                          {canEdit && onEdit && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => onEdit(v)} data-testid={`sh-dash-edit-${v.id}`}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </FeatureCard>
        </>
      )}

      <Dialog open={!!offlineInfo} onOpenChange={(o) => !o && setOfflineInfo(null)}>
        <DialogContent className="sm:max-w-md" data-testid="sh-dash-offline-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><CloudOff className="h-5 w-5 text-orange-700" /> Offline entry details</DialogTitle>
            <DialogDescription>This School Health visit was entered offline or is waiting to sync.</DialogDescription>
          </DialogHeader>
          {offlineInfo && (
            <dl className="space-y-2 text-sm">
              <div><dt className="text-[11px] text-muted-foreground">Visit</dt><dd className="font-semibold">{offlineInfo.id}</dd></div>
              <div><dt className="text-[11px] text-muted-foreground">Saved at</dt><dd className="font-semibold">{fmtDate(offlineInfo.date)} {offlineInfo.date ? new Date(offlineInfo.date).toLocaleTimeString() : ""}</dd></div>
              <div><dt className="text-[11px] text-muted-foreground">Created by</dt><dd className="font-semibold">{offlineInfo.worker || "—"}</dd></div>
              <div><dt className="text-[11px] text-muted-foreground">Offline at</dt><dd className="font-semibold">{offlineInfo.data?.offlineAt ? new Date(offlineInfo.data.offlineAt).toLocaleString() : "—"}</dd></div>
              <div><dt className="text-[11px] text-muted-foreground">School</dt><dd className="font-semibold">{offlineInfo.data?.school || "—"}</dd></div>
              <div><dt className="text-[11px] text-muted-foreground">Immunization</dt><dd className="font-semibold">{immunSummary(offlineInfo.data || {})}</dd></div>
              <div><dt className="text-[11px] text-muted-foreground">Negative exam</dt><dd className="font-semibold">{negativeExamItems(offlineInfo.data || {}).join(", ") || "—"}</dd></div>
              <div><dt className="text-[11px] text-muted-foreground">Sync status</dt><dd className="font-semibold">{offlineInfo.synced === false ? "Pending sync" : "Synced"}</dd></div>
            </dl>
          )}
          <DialogFooter>
            <Button className="h-11" onClick={() => setOfflineInfo(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
