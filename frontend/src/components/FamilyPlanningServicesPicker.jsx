import { TextField, CheckGrid } from "@/components/Fields";
import FamilyPlanningServiceDetails from "@/components/FamilyPlanningServiceDetails";
import {
  buildServiceRow,
  SERVICE_CHILD_FIELDS,
} from "@/mock/familyPlanning";
import { localISODate } from "@/mock/specs";

const rowService = (row) =>
  row?.service || row?.familyPlanningService || row?.rawData?.parentData?.familyPlanningService || "";

const rowChild = (row) => row?.rawData?.childData || {};

const rowDate = (row) =>
  row?.dateOfServiceIso || row?.rawData?.parentData?.date || localISODate();

/** Convert a legacy single ANC/WB familyPlanning string into service rows. */
export function legacyFamilyPlanningToRows(delivery = {}) {
  const list = Array.isArray(delivery.familyPlanningServices) ? delivery.familyPlanningServices : [];
  if (list.length) return list.filter((r) => rowService(r) && !["None", "Planned"].includes(rowService(r)));
  const service = String(delivery.familyPlanning || "").trim();
  if (!service || service === "None" || service === "Planned") return [];
  // Comma-joined multi from a previous save
  const names = service.includes(",")
    ? service.split(",").map((s) => s.trim()).filter(Boolean)
    : [service];
  const details = delivery.familyPlanningDetails || {};
  return names
    .filter((n) => n && n !== "None" && n !== "Planned")
    .map((n, i) =>
      buildServiceRow(
        { familyPlanningService: n, date: delivery.date || delivery.deliveryDate || localISODate() },
        i === 0 && !Array.isArray(details) ? details : {},
      ),
    );
}

export function exclusiveFamilyPlanningValue(delivery = {}) {
  const raw = String(delivery.familyPlanning || "").trim();
  if (raw === "None" || raw === "Planned") return raw;
  return "";
}

/**
 * Multi-select Family Planning services (risk-factor-style chips).
 * Selected services each get date + detail fields stacked below for one scroll.
 * When "Planned" is selected, a planned date is required.
 */
export default function FamilyPlanningServicesPicker({
  options = [],
  value = [],
  onChange,
  exclusiveOptions = [],
  exclusiveValue = "",
  onExclusiveChange,
  plannedDate = "",
  onPlannedDateChange,
  label = "Family Planning services",
  testid = "fp-services",
}) {
  const rows = Array.isArray(value) ? value : [];
  const selected = [
    ...(exclusiveValue && exclusiveOptions.includes(exclusiveValue) ? [exclusiveValue] : []),
    ...rows.map(rowService).filter(Boolean),
  ];

  const setSelected = (nextNames) => {
    const exclusiveHit = exclusiveOptions.find((x) => nextNames.includes(x));
    // Toggling an exclusive option on → clear real services
    if (exclusiveHit && exclusiveHit !== exclusiveValue) {
      onExclusiveChange?.(exclusiveHit);
      onChange?.([]);
      if (exclusiveHit === "Planned") {
        onPlannedDateChange?.(plannedDate || localISODate());
      } else {
        onPlannedDateChange?.("");
      }
      return;
    }
    // Real services selected → clear exclusive
    const realNames = nextNames.filter((n) => !exclusiveOptions.includes(n));
    if (exclusiveValue && onExclusiveChange) onExclusiveChange("");
    if (exclusiveValue === "Planned") onPlannedDateChange?.("");

    const nextRows = realNames.map((name) => {
      const existing = rows.find((r) => rowService(r) === name);
      if (existing) return existing;
      return buildServiceRow({ familyPlanningService: name, date: localISODate() }, {});
    });
    onChange?.(nextRows);
  };

  const patchRow = (serviceName, { date, childPatch, childReplace } = {}) => {
    const next = rows.map((r) => {
      if (rowService(r) !== serviceName) return r;
      const child =
        childReplace != null
          ? childReplace
          : { ...rowChild(r), ...(childPatch || {}) };
      return buildServiceRow(
        {
          id: r.id,
          familyPlanningService: serviceName,
          date: date ?? rowDate(r),
        },
        child,
      );
    });
    onChange?.(next);
  };

  // Keep chip list order stable as options; append any unknown selected values
  const chipOptions = [...options];
  selected.forEach((s) => {
    if (s && !chipOptions.includes(s)) chipOptions.push(s);
  });

  const detailRows = rows.filter((r) => {
    const name = rowService(r);
    return name && (SERVICE_CHILD_FIELDS[name]?.length || true);
  });

  return (
    <div className="space-y-4" data-testid={testid}>
      <CheckGrid
        label={label}
        options={chipOptions}
        value={selected}
        onChange={setSelected}
        testid={testid}
        cols="sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
      />

      {exclusiveValue === "Planned" && (
        <div
          className="space-y-3 rounded-md border border-border bg-muted/15 p-3"
          data-testid={`${testid}-panel-Planned`}
        >
          <p className="text-sm font-semibold text-primary">Planned</p>
          <TextField
            label="Planned date"
            type="date"
            testid={`${testid}-date-Planned`}
            value={plannedDate || localISODate()}
            onChange={(e) => onPlannedDateChange?.(e.target.value)}
          />
        </div>
      )}

      {detailRows.map((row) => {
        const name = rowService(row);
        const child = rowChild(row);
        const hasFields = (SERVICE_CHILD_FIELDS[name] || []).length > 0;
        return (
          <div
            key={row.id || name}
            className="space-y-3 rounded-md border border-border bg-muted/15 p-3"
            data-testid={`${testid}-panel-${name}`}
          >
            <p className="text-sm font-semibold text-primary">{name}</p>
            <TextField
              label="Date of service"
              type="date"
              testid={`${testid}-date-${name}`}
              value={rowDate(row)}
              onChange={(e) => patchRow(name, { date: e.target.value })}
            />
            {hasFields ? (
              <FamilyPlanningServiceDetails
                service={name}
                value={child}
                embedded
                onChange={(next) => patchRow(name, { childReplace: next })}
                testid={`${testid}-details-${name}`}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
