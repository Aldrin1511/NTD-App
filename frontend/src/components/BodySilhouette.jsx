const MALE = {
  center: [
    { id: "Head", d: "M100 6c-13 0-23 10-23 25 0 17 10 29 23 29s23-12 23-29c0-15-10-25-23-25z", cx: 100, cy: 32 },
    { id: "Neck", d: "M88 54q12 10 24 0v18q-12 7-24 0z", cx: 100, cy: 66 },
    { id: "Chest", d: "M62 76c10-7 20-10 38-10s28 3 38 10l5 24-12 6-2 40H71l-2-40-12-6z", cx: 100, cy: 110 },
    { id: "Abdomen", d: "M69 148h62l-3 44H72z", cx: 100, cy: 170 },
    { id: "Groin", d: "M68 190h64l-6 30q-13-6-26 0-13-6-26 0z", cx: 100, cy: 206 },
  ],
  side: [
    { id: "upper arm", d: "M64 74q-14 2-18 16l-6 48 16 4 10-54z", cx: 54, cy: 108 },
    { id: "forearm", d: "M40 138l16 4-2 52-16-2z", cx: 48, cy: 168 },
    { id: "hand", d: "M38 192l16 2-1 18q-8 6-16 0z", cx: 46, cy: 204 },
    { id: "thigh", d: "M72 218h26l-2 72H76z", cx: 85, cy: 254 },
    { id: "leg", d: "M76 290h20l-2 64H79z", cx: 86, cy: 322 },
    { id: "foot", d: "M79 354h15l4 14q-2 4-8 4H70q-4-6 2-10z", cx: 84, cy: 364 },
  ],
};

const FEMALE = {
  hair: "M100 4c-16 0-27 11-27 27 0 12 3 20 3 30-4 6-8 14-8 22 4-2 7-6 9-10 2 6 6 10 10 12h26c4-2 8-6 10-12 2 4 5 8 9 10 0-8-4-16-8-22 0-10 3-18 3-30 0-16-11-27-27-27z",
  center: [
    { id: "Head", d: "M100 10c-12 0-21 9-21 23 0 16 9 27 21 27s21-11 21-27c0-14-9-23-21-23z", cx: 100, cy: 34 },
    { id: "Neck", d: "M90 54q10 9 20 0v18q-10 6-20 0z", cx: 100, cy: 66 },
    { id: "Chest", d: "M70 78c8-7 16-10 30-10s22 3 30 10l4 22-8 6-2 32H76l-2-32-8-6z", cx: 100, cy: 110 },
    { id: "Abdomen", d: "M74 142h52l-4 42H78z", cx: 100, cy: 164 },
    { id: "Groin", d: "M65 182h70l-8 34q-14-6-27 0-14-6-27 0z", cx: 100, cy: 200 },
  ],
  side: [
    { id: "upper arm", d: "M70 74q-13 2-17 16l-6 46 15 4 9-52z", cx: 59, cy: 106 },
    { id: "forearm", d: "M47 136l15 4-2 50-15-2z", cx: 54, cy: 166 },
    { id: "hand", d: "M45 188l15 2-1 18q-8 5-15 0z", cx: 52, cy: 200 },
    { id: "thigh", d: "M70 214h28l-3 74H75z", cx: 84, cy: 252 },
    { id: "leg", d: "M75 288h20l-3 64H78z", cx: 85, cy: 320 },
    { id: "foot", d: "M78 352h15l4 14q-2 4-8 4H69q-4-6 2-10z", cx: 84, cy: 362 },
  ],
};

const FRONT_CENTER = { Head: "Head / face", Neck: "Neck", Chest: "Chest", Abdomen: "Abdomen", Groin: "Groin / genital" };
const BACK_CENTER = { Head: "Scalp", Neck: "Neck (back)", Chest: "Upper back", Abdomen: "Lower back", Groin: "Buttocks" };
const FRONT_SIDE = { "upper arm": "upper arm", forearm: "forearm", hand: "hand", thigh: "thigh", leg: "leg", foot: "foot" };
const BACK_SIDE = { "upper arm": "upper arm (back)", forearm: "forearm (back)", hand: "palm", thigh: "thigh (back)", leg: "calf", foot: "sole" };

const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export const bodyRegions = (sex, view) => {
  const base = sex === "Female" ? FEMALE : MALE;
  const cmap = view === "back" ? BACK_CENTER : FRONT_CENTER;
  const smap = view === "back" ? BACK_SIDE : FRONT_SIDE;
  const out = base.center.map((r) => ({ ...r, label: cmap[r.id], side: "c" }));
  ["R", "L"].forEach((s) => base.side.forEach((r) => out.push({ ...r, id: `${s} ${r.id}`, label: `${s === "R" ? "Right" : "Left"} ${smap[r.id]}`, side: s })));
  return out;
};

export default function BodySilhouette({ sex = "Male", view = "front", marks = {}, onPlace, activeCode }) {
  const base = sex === "Female" ? FEMALE : MALE;
  const regions = bodyRegions(sex, view);

  return (
    <svg viewBox="0 0 200 380" className="mx-auto h-[440px] w-full max-w-[300px] select-none" data-testid={`silhouette-${sex.toLowerCase()}-${view}`}>
      {sex === "Female" && <path d={base.hair} fill="#F4C242" opacity="0.85" pointerEvents="none" />}
      {regions.map((r) => {
        const key = `${view}:${r.label}`;
        const m = marks[key];
        const flip = r.side === "L";
        return (
          <g key={r.id} transform={flip ? "translate(200,0) scale(-1,1)" : undefined}>
            <title>{r.label}</title>
            <path
              d={r.d}
              data-testid={`body-region-${slug(r.label)}`}
              onClick={() => onPlace?.(r.label)}
              className={`silhouette-region ${m ? "marked" : ""}`}
            />
          </g>
        );
      })}
      {regions.map((r) => {
        const key = `${view}:${r.label}`;
        const m = marks[key];
        if (!m) return null;
        const x = r.side === "L" ? 200 - r.cx : r.cx;
        return (
          <text key={`t-${r.id}`} x={x} y={r.cy + 4} textAnchor="middle" className="silhouette-code" pointerEvents="none" data-testid={`body-mark-${slug(r.label)}`}>
            {m.code}
          </text>
        );
      })}
    </svg>
  );
}
