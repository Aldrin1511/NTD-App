const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/**
 * Original silhouette geometry (dark contiguous figure), subdivided into the
 * required front/back clinical sections. Left parts are mirrored via SVG flip.
 */

const MALE = {
  hair: null,
  // Center (not mirrored)
  frontCenter: [
    // Smaller crown / head
    { id: "Head", label: "Head", d: "M100 6c-12 0-21 8-21 15 0 1 0 2 1 3h40c1-1 1-2 1-3 0-7-9-15-21-15z", cx: 100, cy: 14 },
    // Larger face
    { id: "Face", label: "Face", d: "M77 23c-1 12 4 24 14 31h18c10-7 15-19 14-31H77z", cx: 100, cy: 40 },
    { id: "EyeR", label: "Right eye", d: "M85 28h11v7H85z", cx: 90, cy: 31, noFlip: true },
    { id: "EyeL", label: "Left eye", d: "M104 28h11v7h-11z", cx: 110, cy: 31, noFlip: true },
    { id: "Neck", label: "Neck", d: "M88 54q12 10 24 0v18q-12 7-24 0z", cx: 100, cy: 66 },
    { id: "Chest", label: "Chest", d: "M62 76c10-7 20-10 38-10s28 3 38 10l5 24-12 6-2 40H71l-2-40-12-6z", cx: 100, cy: 110 },
    { id: "Abdomen", label: "Abdomen", d: "M69 148h62l-3 44H72z", cx: 100, cy: 170 },
    { id: "Groin", label: "Groin/Genital", d: "M68 190h64l-6 30q-13-6-26 0-13-6-26 0z", cx: 100, cy: 206 },
  ],
  backCenter: [
    { id: "Scalp", label: "Scalp", d: "M100 6c-13 0-23 10-23 25 0 17 10 29 23 29s23-12 23-29c0-15-10-25-23-25z", cx: 100, cy: 32 },
    { id: "NeckB", label: "Neck", d: "M88 54q12 10 24 0v18q-12 7-24 0z", cx: 100, cy: 66 },
    { id: "UpperBack", label: "Upper back", d: "M62 76c10-7 20-10 38-10s28 3 38 10l5 24-12 6-2 40H71l-2-40-12-6z", cx: 100, cy: 110 },
    { id: "LowerBack", label: "Lower back", d: "M69 148h62l-3 44H72z", cx: 100, cy: 170 },
    { id: "Buttocks", label: "Buttocks", d: "M68 190h64l-6 30q-13-6-26 0-13-6-26 0z", cx: 100, cy: 206 },
  ],
  // Side parts drawn on RIGHT geometrically, then flipped for Left
  frontSide: [
    { id: "Ear", label: "ear", d: "M123 22c4-1 8 3 8 12s-3 14-8 13c-2 0-3-2-3-6V28c0-4 1-6 3-6z", cx: 128, cy: 34 },
    // Combined upper arm + forearm from original into one "arm"
    { id: "Arm", label: "arm", d: "M64 74q-14 2-18 16l-6 48 16 4 10-54zM40 138l16 4-2 48-16-2z", cx: 50, cy: 140 },
    // Wrist / hand base
    { id: "Hand", label: "hand", d: "M39 188h16v8H39z", cx: 47, cy: 192 },
    // Palm
    { id: "Palm", label: "palm", d: "M37 196h20v14q-2 2-10 2t-10-2z", cx: 47, cy: 204 },
    // All five fingers as one selectable region (spread, pointing down)
    {
      id: "Finger",
      label: "fingers",
      d: [
        // pinky (outer)
        "M35 210h3.2v15.5q0 1.8 1.6 1.8t1.6-1.8V210z",
        // ring
        "M39.2 208h3.4v18q0 2 1.7 2t1.7-2V208z",
        // middle
        "M43.6 207h3.6v19.5q0 2.1 1.8 2.1t1.8-2.1V207z",
        // index
        "M48.2 208h3.4v17.5q0 2 1.7 2t1.7-2V208z",
        // thumb (angled outward)
        "M53.2 212l4.2 2.2 3.2 10.5q-1.2 1.6-3.2 1.2l-4.8-9.5z",
      ].join(""),
      cx: 47,
      cy: 220,
    },
    { id: "Thigh", label: "thigh", d: "M72 218h26l-2 72H76z", cx: 85, cy: 254 },
    { id: "Leg", label: "leg", d: "M76 290h20l-2 64H79z", cx: 86, cy: 322 },
    { id: "Foot", label: "foot", d: "M79 354h15l4 8H72q-4-4 2-8z", cx: 84, cy: 360 },
    { id: "Toe", label: "toes", d: "M72 362h26l-2 8H70q-2-4 2-8z", cx: 84, cy: 368 },
  ],
  backSide: [
    // Posterior arm = upper + forearm + hand with fingers
    {
      id: "PostArm",
      label: "posterior arm",
      d: [
        "M64 74q-14 2-18 16l-6 48 16 4 10-54z",
        "M40 138l16 4-2 48-16-2z",
        "M39 188h16v8H39z",
        "M37 196h20v14q-2 2-10 2t-10-2z",
        "M35 210h3.2v15.5q0 1.8 1.6 1.8t1.6-1.8V210z",
        "M39.2 208h3.4v18q0 2 1.7 2t1.7-2V208z",
        "M43.6 207h3.6v19.5q0 2.1 1.8 2.1t1.8-2.1V207z",
        "M48.2 208h3.4v17.5q0 2 1.7 2t1.7-2V208z",
        "M53.2 212l4.2 2.2 3.2 10.5q-1.2 1.6-3.2 1.2l-4.8-9.5z",
      ].join(""),
      cx: 50,
      cy: 150,
    },
    // Posterior leg = thigh + leg
    { id: "PostLeg", label: "posterior leg", d: "M72 218h26l-2 72H76zM76 290h20l-2 64H79z", cx: 85, cy: 290 },
    { id: "FootB", label: "foot", d: "M79 354h15l4 14q-2 4-8 4H70q-4-6 2-10z", cx: 84, cy: 364 },
  ],
};

const FEMALE = {
  hair: "M100 4c-16 0-27 11-27 27 0 12 3 20 3 30-4 6-8 14-8 22 4-2 7-6 9-10 2 6 6 10 10 12h26c4-2 8-6 10-12 2 4 5 8 9 10 0-8-4-16-8-22 0-10 3-18 3-30 0-16-11-27-27-27z",
  frontCenter: [
    { id: "Head", label: "Head", d: "M100 10c-11 0-19 7-19 13 0 1 0 2 1 3h36c1-1 1-2 1-3 0-6-8-13-19-13z", cx: 100, cy: 16 },
    { id: "Face", label: "Face", d: "M79 25c-1 11 4 22 13 29h16c9-7 14-18 13-29H79z", cx: 100, cy: 40 },
    { id: "EyeR", label: "Right eye", d: "M87 30h10v7H87z", cx: 92, cy: 33, noFlip: true },
    { id: "EyeL", label: "Left eye", d: "M103 30h10v7h-10z", cx: 108, cy: 33, noFlip: true },
    { id: "Neck", label: "Neck", d: "M90 54q10 9 20 0v18q-10 6-20 0z", cx: 100, cy: 66 },
    { id: "Chest", label: "Chest", d: "M70 78c8-7 16-10 30-10s22 3 30 10l4 22-8 6-2 32H76l-2-32-8-6z", cx: 100, cy: 110 },
    { id: "Abdomen", label: "Abdomen", d: "M74 142h52l-4 42H78z", cx: 100, cy: 164 },
    { id: "Groin", label: "Groin/Genital", d: "M65 182h70l-8 34q-14-6-27 0-14-6-27 0z", cx: 100, cy: 200 },
  ],
  backCenter: [
    { id: "Scalp", label: "Scalp", d: "M100 10c-12 0-21 9-21 23 0 16 9 27 21 27s21-11 21-27c0-14-9-23-21-23z", cx: 100, cy: 34 },
    { id: "NeckB", label: "Neck", d: "M90 54q10 9 20 0v18q-10 6-20 0z", cx: 100, cy: 66 },
    { id: "UpperBack", label: "Upper back", d: "M70 78c8-7 16-10 30-10s22 3 30 10l4 22-8 6-2 32H76l-2-32-8-6z", cx: 100, cy: 110 },
    { id: "LowerBack", label: "Lower back", d: "M74 142h52l-4 42H78z", cx: 100, cy: 164 },
    { id: "Buttocks", label: "Buttocks", d: "M65 182h70l-8 34q-14-6-27 0-14-6-27 0z", cx: 100, cy: 200 },
  ],
  frontSide: [
    { id: "Ear", label: "ear", d: "M121 24c4-1 7 3 7 11s-2 13-7 12c-2 0-3-2-3-6V30c0-4 1-6 3-6z", cx: 126, cy: 36 },
    { id: "Arm", label: "arm", d: "M70 74q-13 2-17 16l-6 46 15 4 9-52zM47 136l15 4-2 46-15-2z", cx: 56, cy: 138 },
    { id: "Hand", label: "hand", d: "M46 184h15v8H46z", cx: 53, cy: 188 },
    { id: "Palm", label: "palm", d: "M44 192h19v14q-2 2-9.5 2t-9.5-2z", cx: 53, cy: 200 },
    {
      id: "Finger",
      label: "fingers",
      d: [
        "M42 206h3.1v15q0 1.7 1.55 1.7t1.55-1.7V206z",
        "M46 204h3.3v17.5q0 1.9 1.65 1.9t1.65-1.9V204z",
        "M50.3 203h3.4v18.5q0 2 1.7 2t1.7-2V203z",
        "M54.7 204h3.3v16.5q0 1.9 1.65 1.9t1.65-1.9V204z",
        "M59.5 208l4 2.1 3 10q-1.1 1.5-3 1.1l-4.5-9z",
      ].join(""),
      cx: 53,
      cy: 216,
    },
    { id: "Thigh", label: "thigh", d: "M70 214h28l-3 74H75z", cx: 84, cy: 252 },
    { id: "Leg", label: "leg", d: "M75 288h20l-3 64H78z", cx: 85, cy: 320 },
    { id: "Foot", label: "foot", d: "M78 352h15l4 8H71q-4-4 2-8z", cx: 84, cy: 358 },
    { id: "Toe", label: "toes", d: "M71 360h26l-2 8H69q-2-4 2-8z", cx: 84, cy: 366 },
  ],
  backSide: [
    {
      id: "PostArm",
      label: "posterior arm",
      d: [
        "M70 74q-13 2-17 16l-6 46 15 4 9-52z",
        "M47 136l15 4-2 46-15-2z",
        "M46 184h15v8H46z",
        "M44 192h19v14q-2 2-9.5 2t-9.5-2z",
        "M42 206h3.1v15q0 1.7 1.55 1.7t1.55-1.7V206z",
        "M46 204h3.3v17.5q0 1.9 1.65 1.9t1.65-1.9V204z",
        "M50.3 203h3.4v18.5q0 2 1.7 2t1.7-2V203z",
        "M54.7 204h3.3v16.5q0 1.9 1.65 1.9t1.65-1.9V204z",
        "M59.5 208l4 2.1 3 10q-1.1 1.5-3 1.1l-4.5-9z",
      ].join(""),
      cx: 56,
      cy: 148,
    },
    { id: "PostLeg", label: "posterior leg", d: "M70 214h28l-3 74H75zM75 288h20l-3 64H78z", cx: 84, cy: 288 },
    { id: "FootB", label: "foot", d: "M78 352h15l4 14q-2 4-8 4H69q-4-6 2-10z", cx: 84, cy: 362 },
  ],
};

const sideLabel = (side, base) => {
  const sideWord = side === "R" ? "Right" : "Left";
  // base already like "arm", "hand", "ear", "posterior arm"
  if (base === "ear") return `${sideWord} ear`;
  if (base === "arm") return `${sideWord} arm`;
  if (base === "hand") return `${sideWord} hand`;
  if (base === "palm") return `${sideWord} palm`;
  if (base === "fingers") return `${sideWord} fingers`;
  if (base === "thigh") return `${sideWord} thigh`;
  if (base === "leg") return `${sideWord} leg`;
  if (base === "foot") return `${sideWord} foot`;
  if (base === "toes") return `${sideWord} toes`;
  if (base === "posterior arm") return `${sideWord} posterior arm`;
  if (base === "posterior leg") return `${sideWord} posterior leg`;
  return `${sideWord} ${base}`;
};

export const bodyRegions = (sex, view) => {
  const base = sex === "Female" ? FEMALE : MALE;
  const isBack = view === "back";
  const center = isBack ? base.backCenter : base.frontCenter;
  const side = isBack ? base.backSide : base.frontSide;
  const out = center.map((r) => ({ ...r, side: "c" }));
  ["R", "L"].forEach((s) => {
    side.forEach((r) => {
      out.push({
        ...r,
        id: `${s}-${r.id}`,
        label: sideLabel(s, r.label),
        side: s,
        cx: r.cx,
        cy: r.cy,
      });
    });
  });
  return out;
};

/** Leprosy peripheral nerves for diagnosis (6 front + 6 back = 12). */
const NERVE_MARKERS = [
  // Front: Neck, Wrist, Foot × Left/Right
  { id: "n-neck-r", label: "Right neck nerve", cx: 72, cy: 58, view: "front" },
  { id: "n-neck-l", label: "Left neck nerve", cx: 128, cy: 58, view: "front" },
  { id: "n-wrist-r", label: "Right wrist nerve", cx: 48, cy: 178, view: "front" },
  { id: "n-wrist-l", label: "Left wrist nerve", cx: 152, cy: 178, view: "front" },
  { id: "n-foot-r", label: "Right foot nerve", cx: 80, cy: 318, view: "front" },
  { id: "n-foot-l", label: "Left foot nerve", cx: 120, cy: 318, view: "front" },
  // Back: Elbow, Wrist, behind the knee × Left/Right
  { id: "n-elbow-br", label: "Right elbow nerve", cx: 48, cy: 130, view: "back" },
  { id: "n-elbow-bl", label: "Left elbow nerve", cx: 152, cy: 130, view: "back" },
  { id: "n-wrist-br", label: "Right wrist nerve (back)", cx: 48, cy: 178, view: "back" },
  { id: "n-wrist-bl", label: "Left wrist nerve (back)", cx: 152, cy: 178, view: "back" },
  { id: "n-knee-br", label: "Right nerve behind the knee", cx: 78, cy: 268, view: "back" },
  { id: "n-knee-bl", label: "Left nerve behind the knee", cx: 122, cy: 268, view: "back" },
];

export default function BodySilhouette({ sex = "Male", view = "front", marks = {}, onPlace, showNerves = false, nerveOnly = false }) {
  const base = sex === "Female" ? FEMALE : MALE;
  const regions = bodyRegions(sex, view);
  const nerves = showNerves ? NERVE_MARKERS.filter((n) => n.view === (view === "back" ? "back" : "front")) : [];

  return (
    <svg viewBox="0 0 200 380" className="mx-auto h-[440px] w-full max-w-[300px] select-none" data-testid={`silhouette-${sex.toLowerCase()}-${view}`}>
      {sex === "Female" && view === "front" && base.hair && (
        <path d={base.hair} fill="#F4C242" opacity="0.85" pointerEvents="none" />
      )}

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
              onClick={() => { if (!nerveOnly) onPlace?.(r.label); }}
              className={`silhouette-region ${m ? "marked" : ""}`}
            />
          </g>
        );
      })}

      {nerves.map((n) => {
        const key = `${view}:${n.label}`;
        const m = marks[key];
        return (
          <g key={n.id} data-testid={`nerve-${slug(n.label)}`} onClick={() => onPlace?.(n.label)} className="cursor-pointer">
            <title>{n.label}</title>
            <circle cx={n.cx} cy={n.cy} r={7} className={`silhouette-nerve ${m ? "marked" : ""}`} />
            <text x={n.cx} y={n.cy + 3} textAnchor="middle" className="silhouette-nerve-label" pointerEvents="none">N</text>
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

      {nerves.map((n) => {
        const key = `${view}:${n.label}`;
        const m = marks[key];
        if (!m) return null;
        return (
          <text key={`nt-${n.id}`} x={n.cx} y={n.cy - 10} textAnchor="middle" className="silhouette-code" pointerEvents="none">
            {m.code}
          </text>
        );
      })}
    </svg>
  );
}
