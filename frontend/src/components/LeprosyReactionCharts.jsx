import { useState } from "react";

/** Shared interactive point — checkbox/circle on the chart image. */
function ChartPoint({ label, code, color, active, onClick, shape = "circle", testid, x, y }) {
  const marked = !!code;
  return (
    <button
      type="button"
      title={`${label}${code ? ` · ${code}` : ""}`}
      data-testid={testid}
      onClick={onClick}
      className={`absolute grid place-items-center border-2 shadow-sm transition ${
        shape === "square" ? "h-[18px] w-[18px] rounded-[2px]" : "h-[18px] w-[18px] rounded-full"
      } ${active ? "ring-2 ring-offset-1 ring-offset-black ring-white" : ""}`}
      style={{
        background: marked ? color || "#fff" : "#fff",
        borderColor: marked ? (color || "#94a3b8") : "#94a3b8",
        left: x,
        top: y,
        transform: "translate(-50%, -50%)",
      }}
    >
      {marked && shape === "square" && (
        <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden>
          <path d="M2.5 6.2 L5 8.5 L9.5 3.5" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}

function LegendBar({ options, activeCode, onSelect, testid }) {
  return (
    <div className="flex flex-wrap gap-2" data-testid={testid}>
      {options.map((o) => (
        <button
          key={o.code}
          type="button"
          onClick={() => onSelect(activeCode === o.code ? "" : o.code)}
          className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-left text-xs font-semibold ${
            activeCode === o.code ? "border-primary bg-primary text-white" : "border-border bg-white text-foreground"
          }`}
          data-testid={`${testid}-${o.code.toLowerCase()}`}
        >
          <span className="inline-block h-3 w-3 rounded-sm" style={{ background: o.color }} />
          {o.label}
        </button>
      ))}
    </div>
  );
}

function SidePair({ title, left, right }) {
  return (
    <div className="space-y-2">
      {title && <p className="text-center text-xs font-semibold uppercase tracking-wider text-white/80">{title}</p>}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="mb-1 text-center text-[10px] font-semibold uppercase tracking-wider text-white/60">Right</p>
          {right}
        </div>
        <div>
          <p className="mb-1 text-center text-[10px] font-semibold uppercase tracking-wider text-white/60">Left</p>
          {left}
        </div>
      </div>
    </div>
  );
}

const SENSORY_HAND_FOOT = [
  { code: "WITHSENS", label: "With sensation", color: "#22c55e" },
  { code: "WITHOUTSENS", label: "Without sensation", color: "#eab308" },
];

const SENSORY_EYE = [
  { code: "BLINKNORM", label: "Blinking normally / often", color: "#07ba75" },
  { code: "BLINKNOTNORM", label: "Not blinking often / normally", color: "#eb3637" },
];

const colorFor = (code, options) => options.find((o) => o.code === code)?.color || "#fff";

const ST_ART = {
  "right-eye": {
    src: "/leprosy/st/right-eye.svg?v=5",
    points: [{ id: "Right Eye", x: "16.9%", y: "49.5%", shape: "circle" }],
  },
  "left-eye": {
    src: "/leprosy/st/left-eye.svg?v=5",
    points: [{ id: "Left Eye", x: "82.8%", y: "49.5%", shape: "circle" }],
  },
  "right-hand": {
    src: "/leprosy/st/right-hand.svg?v=5",
    points: [
      { id: "Right Little Finger", x: "70.7%", y: "78.4%", shape: "square" },
      { id: "Right Lower Palm below thumb", x: "62.8%", y: "15.8%", shape: "square" },
      { id: "Right Lower Palm below pinky", x: "31.6%", y: "15.8%", shape: "square" },
      { id: "Right Index Finger", x: "28.3%", y: "84.6%", shape: "square" },
    ],
  },
  "left-hand": {
    src: "/leprosy/st/left-hand.svg?v=5",
    points: [
      { id: "Left Little Finger", x: "8.9%", y: "74.2%", shape: "square" },
      { id: "Left Lower Palm below pinky", x: "17.8%", y: "14.8%", shape: "square" },
      { id: "Left Lower Palm below thumb", x: "53.5%", y: "14.8%", shape: "square" },
      { id: "Left Index Finger", x: "57.5%", y: "80.1%", shape: "square" },
    ],
  },
  "right-foot": {
    src: "/leprosy/st/right-foot.svg?v=5",
    points: [
      { id: "Right Foot Thumb", x: "16.8%", y: "14.6%", shape: "square" },
      { id: "Right Foot Medial", x: "26.1%", y: "34.8%", shape: "square" },
      { id: "Right Foot Lateral", x: "64.1%", y: "34.8%", shape: "square" },
      { id: "Right Foot Mid", x: "58.1%", y: "64.9%", shape: "square" },
    ],
  },
  "left-foot": {
    src: "/leprosy/st/left-foot.svg?v=5",
    points: [
      { id: "Left Foot Thumb", x: "64.9%", y: "14.6%", shape: "square" },
      { id: "Left Foot Medial", x: "56.1%", y: "34.4%", shape: "square" },
      { id: "Left Foot Lateral", x: "20.4%", y: "34.8%", shape: "square" },
      { id: "Left Foot Mid", x: "25.5%", y: "64.9%", shape: "square" },
    ],
  },
};

function StFigure({ artKey, value, options, onPlace, prefix }) {
  const art = ST_ART[artKey];
  return (
    <div className="relative mx-auto w-full max-w-[9.5rem]">
      <img src={art.src} alt="" className="block h-auto w-full" draggable={false} />
      {art.points.map((p) => (
        <ChartPoint
          key={p.id}
          label={p.id}
          code={value[p.id]}
          color={value[p.id] ? colorFor(value[p.id], options) : undefined}
          active={!!value[p.id]}
          shape={p.shape}
          x={p.x}
          y={p.y}
          testid={`${prefix}-${p.id}`}
          onClick={() => onPlace(p.id, options)}
        />
      ))}
    </div>
  );
}

export function SensoryTestingChart({ value = {}, onChange, readOnly, id = "st-chart" }) {
  const [activeCode, setActiveCode] = useState("");
  const points = value.points || {};

  const place = (pointId, options) => {
    if (readOnly) return;
    if (!activeCode || !options.some((o) => o.code === activeCode)) return;
    const next = { ...points };
    if (next[pointId] === activeCode) delete next[pointId];
    else next[pointId] = activeCode;
    onChange({ ...value, points: next });
  };

  return (
    <div className="space-y-4 rounded-lg border border-border bg-muted/20 p-4" data-testid={id}>
      <div>
        <p className="font-head text-base font-semibold">Sensory Testing (ST)</p>
        <p className="text-xs text-muted-foreground">1. Choose a finding · 2. Tap a checkbox on the chart</p>
      </div>
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Eyes (blink)</p>
        <LegendBar options={SENSORY_EYE} activeCode={activeCode} onSelect={setActiveCode} testid={`${id}-eye-legend`} />
      </div>
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Hands &amp; feet (sensation)</p>
        <LegendBar options={SENSORY_HAND_FOOT} activeCode={activeCode} onSelect={setActiveCode} testid={`${id}-hf-legend`} />
      </div>
      <div className="rounded-lg bg-black p-4">
        <p className="mb-3 text-center text-sm font-semibold text-white">Sensory Testing(ST)</p>
        <SidePair
          title=""
          right={<StFigure artKey="right-eye" value={points} options={SENSORY_EYE} onPlace={place} prefix={`${id}-eye`} />}
          left={<StFigure artKey="left-eye" value={points} options={SENSORY_EYE} onPlace={place} prefix={`${id}-eye`} />}
        />
        <div className="my-4 border-t border-white/20" />
        <SidePair
          title="Hands"
          right={<StFigure artKey="right-hand" value={points} options={SENSORY_HAND_FOOT} onPlace={place} prefix={`${id}-hand`} />}
          left={<StFigure artKey="left-hand" value={points} options={SENSORY_HAND_FOOT} onPlace={place} prefix={`${id}-hand`} />}
        />
        <div className="mt-6">
          <SidePair
            title="Feet"
            right={<StFigure artKey="right-foot" value={points} options={SENSORY_HAND_FOOT} onPlace={place} prefix={`${id}-foot`} />}
            left={<StFigure artKey="left-foot" value={points} options={SENSORY_HAND_FOOT} onPlace={place} prefix={`${id}-foot`} />}
          />
        </div>
      </div>
      {!activeCode && !readOnly && (
        <p className="text-xs text-muted-foreground">Select a legend option above, then tap chart points.</p>
      )}
    </div>
  );
}

const VMT_OPTS = [
  { code: "STRONG", label: "Strong (0)", color: "#22c55e", short: "S" },
  { code: "WEAK", label: "Weak (1)", color: "#a16207", short: "W" },
  { code: "PARALYZED", label: "Paralyzed (2)", color: "#2563eb", short: "P" },
];

/** Apex VMT artwork (extracted from tri-apex) + hotspot overlay positions. */
const VMT_ART = {
  "right-tight-eye": { src: "/leprosy/vmt/right-tight-eye.svg?v=2", x: "19.9%", y: "37.8%", h: "h-36" },
  "left-tight-eye": { src: "/leprosy/vmt/left-tight-eye.svg?v=2", x: "83.1%", y: "31.5%", h: "h-36" },
  "right-little-finger": { src: "/leprosy/vmt/right-little-finger.svg?v=2", x: "57.6%", y: "32.4%", h: "h-44" },
  "left-little-finger": { src: "/leprosy/vmt/left-little-finger.svg?v=2", x: "42.4%", y: "32.4%", h: "h-44" },
  "right-thumb": { src: "/leprosy/vmt/right-thumb.svg", x: "23.7%", y: "25.2%", h: "h-32" },
  "left-thumb": { src: "/leprosy/vmt/left-thumb.svg", x: "76.3%", y: "25.2%", h: "h-32" },
  "right-wrist": { src: "/leprosy/vmt/right-wrist.svg", x: "53.6%", y: "49.1%", h: "h-40" },
  "left-wrist": { src: "/leprosy/vmt/left-wrist.svg", x: "46.4%", y: "49.1%", h: "h-40" },
  "right-foot": { src: "/leprosy/vmt/right-foot.svg", x: "59.4%", y: "77.2%", h: "h-32" },
  "left-foot": { src: "/leprosy/vmt/left-foot.svg", x: "40.6%", y: "77.2%", h: "h-32" },
};

const VMT_TESTS = [
  {
    name: "Tight Eye Closure",
    points: [
      { id: "right-tight-eye", side: "right" },
      { id: "left-tight-eye", side: "left" },
    ],
  },
  {
    name: "Little Finger Out",
    points: [
      { id: "right-little-finger", side: "right" },
      { id: "left-little-finger", side: "left" },
    ],
  },
  {
    name: "Thumb Up",
    points: [
      { id: "right-thumb", side: "right" },
      { id: "left-thumb", side: "left" },
    ],
  },
  {
    name: "Wrist Up",
    points: [
      { id: "right-wrist", side: "right" },
      { id: "left-wrist", side: "left" },
    ],
  },
  {
    name: "Foot Up",
    points: [
      { id: "right-foot", side: "right" },
      { id: "left-foot", side: "left" },
    ],
  },
];

function VmtSideButton({ pointId, side, code, onClick, testid }) {
  const art = VMT_ART[pointId];
  const opt = VMT_OPTS.find((o) => o.code === code);
  return (
    <button
      type="button"
      data-testid={testid}
      onClick={onClick}
      title={`${side} — ${opt?.label || "tap to mark"}`}
      className="relative flex flex-col items-center gap-1 rounded-md p-1 text-white hover:bg-white/5"
    >
      <span className={`relative block w-full max-w-[10.5rem] ${art.h}`}>
        <img src={art.src} alt="" className="h-full w-full object-contain" draggable={false} />
        <span
          className="absolute h-4 w-4 rounded-full border-2 border-black shadow"
          style={{
            left: art.x,
            top: art.y,
            transform: "translate(-50%, -50%)",
            background: opt?.color || "#ffffff",
          }}
        />
      </span>
      <span className="text-[10px] font-semibold uppercase tracking-wider text-white/70">{side}</span>
    </button>
  );
}

export function VmtChart({ value = {}, onChange, readOnly, id = "vmt-chart" }) {
  const [activeCode, setActiveCode] = useState("");
  const points = value.points || {};

  const place = (pointId) => {
    if (readOnly || !activeCode) return;
    const next = { ...points };
    if (next[pointId] === activeCode) delete next[pointId];
    else next[pointId] = activeCode;
    onChange({ ...value, points: next });
  };

  return (
    <div className="space-y-4 rounded-lg border border-border bg-muted/20 p-4" data-testid={id}>
      <div>
        <p className="font-head text-base font-semibold">Voluntary Muscle Testing (VMT)</p>
        <p className="text-xs text-muted-foreground">1. Choose Strong / Weak / Paralyzed · 2. Tap the marker on each diagram</p>
      </div>
      <LegendBar options={VMT_OPTS} activeCode={activeCode} onSelect={setActiveCode} testid={`${id}-legend`} />
      <div className="space-y-2 rounded-lg bg-black p-3 sm:p-5">
        <p className="text-center text-sm font-semibold text-white">Voluntary Muscle Testing(VMT)</p>
        <div className="mb-1 grid grid-cols-[1fr_auto_1fr] text-center text-[10px] font-semibold uppercase tracking-wider text-white/60">
          <span>Right</span>
          <span />
          <span>Left</span>
        </div>
        {VMT_TESTS.map((test) => {
          const [right, left] = test.points;
          return (
            <div key={test.name} className="grid grid-cols-[1fr_auto_1fr] items-center gap-1 border-t border-white/10 py-3 first:border-0">
              <VmtSideButton
                pointId={right.id}
                side="Right"
                code={points[right.id]}
                testid={`${id}-${right.id}`}
                onClick={() => place(right.id)}
              />
              <p className="max-w-[5.5rem] px-1 text-center text-[11px] font-semibold uppercase leading-tight tracking-wider text-white/85">
                {test.name}
              </p>
              <VmtSideButton
                pointId={left.id}
                side="Left"
                code={points[left.id]}
                testid={`${id}-${left.id}`}
                onClick={() => place(left.id)}
              />
            </div>
          );
        })}
        <div className="grid grid-cols-[1fr_auto_1fr] text-center text-[10px] font-semibold uppercase tracking-wider text-white/60">
          <span>Right</span>
          <span />
          <span>Left</span>
        </div>
      </div>
      {!activeCode && !readOnly && (
        <p className="text-xs text-muted-foreground">Select Strong, Weak or Paralyzed, then tap a diagram.</p>
      )}
    </div>
  );
}

const VISION_OPTS = [
  { code: "660", label: "6/60 — Able to count fingers at 6 meters", color: "#07ba75" },
  { code: "LES60", label: "Lesser than 6/60 — Unable to count fingers at 6 meters", color: "#eb3637" },
];

const VISION_ART = {
  "right-eye": { src: "/leprosy/vision/right.svg?v=1", x: "68.2%", y: "34.5%", label: "Right" },
  "left-eye": { src: "/leprosy/vision/left.svg?v=1", x: "31.8%", y: "34.5%", label: "Left" },
};

export function VisionAcuityChart({ value = {}, onChange, readOnly, id = "vision-chart" }) {
  const [activeCode, setActiveCode] = useState("");
  const points = value.points || {};

  const place = (pointId) => {
    if (readOnly || !activeCode) return;
    const next = { ...points };
    if (next[pointId] === activeCode) delete next[pointId];
    else next[pointId] = activeCode;
    onChange({ ...value, points: next });
  };

  return (
    <div className="space-y-4 rounded-lg border border-border bg-muted/20 p-4" data-testid={id}>
      <div>
        <p className="font-head text-base font-semibold">Vision Acuity</p>
        <p className="text-xs text-muted-foreground">1. Choose acuity result · 2. Tap the circle on Right or Left</p>
      </div>
      <LegendBar options={VISION_OPTS} activeCode={activeCode} onSelect={setActiveCode} testid={`${id}-legend`} />
      <div className="rounded-lg bg-black p-4">
        <p className="mb-4 text-center text-sm font-semibold text-white">Vision acuity</p>
        <div className="grid grid-cols-2 gap-4">
          {["right-eye", "left-eye"].map((eyeId) => {
            const art = VISION_ART[eyeId];
            const code = points[eyeId];
            return (
              <div key={eyeId} className="flex flex-col items-center gap-2">
                <div className="relative w-full max-w-[11rem]">
                  <img src={art.src} alt="" className="block h-auto w-full" draggable={false} />
                  <ChartPoint
                    label={art.label}
                    code={code}
                    color={code ? colorFor(code, VISION_OPTS) : undefined}
                    active={!!code}
                    shape="circle"
                    x={art.x}
                    y={art.y}
                    testid={`${id}-${eyeId}`}
                    onClick={() => place(eyeId)}
                  />
                </div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-white/70">{art.label}</span>
              </div>
            );
          })}
        </div>
      </div>
      {!activeCode && !readOnly && (
        <p className="text-xs text-muted-foreground">Select 6/60 or Lesser than 6/60, then tap a circle.</p>
      )}
    </div>
  );
}

export const emptySensory = () => ({ points: {} });
export const emptyVmt = () => ({ points: {} });
export const emptyVision = () => ({ points: {} });

const VMT_LABEL = { STRONG: "Strong (0)", WEAK: "Weak (1)", PARALYZED: "Paralysed (2)" };
const vmtRank = (code) => (code === "PARALYZED" ? 2 : code === "WEAK" ? 1 : code === "STRONG" ? 0 : -1);

/** Worst of right/left VMT codes → legacy choice label. */
function worstVmtLabel(points, rightId, leftId) {
  const a = points[rightId];
  const b = points[leftId];
  const ra = vmtRank(a);
  const rb = vmtRank(b);
  if (ra < 0 && rb < 0) return "";
  const code = ra >= rb ? a : b;
  return VMT_LABEL[code] || "";
}

function sideFromPoints(points, rightIds, leftIds, lossCodes) {
  const hit = (ids) => ids.some((id) => lossCodes.includes(points[id]));
  const r = hit(rightIds);
  const l = hit(leftIds);
  if (r && l) return "Both";
  if (r) return "Right";
  if (l) return "Left";
  if (Object.keys(points).some((k) => [...rightIds, ...leftIds].includes(k))) return "None";
  return "";
}

const HAND_R = ["Right Index Finger", "Right Little Finger", "Right Lower Palm below thumb", "Right Lower Palm below pinky"];
const HAND_L = ["Left Index Finger", "Left Little Finger", "Left Lower Palm below thumb", "Left Lower Palm below pinky"];
const FOOT_R = ["Right Foot Thumb", "Right Foot Medial", "Right Foot Lateral", "Right Foot Mid"];
const FOOT_L = ["Left Foot Thumb", "Left Foot Medial", "Left Foot Lateral", "Left Foot Mid"];

/** Merge chart values into assessment, keeping legacy fields for disability scoring. */
export function applyVmtChart(data, chart) {
  const points = chart?.points || {};
  return {
    ...data,
    vmtChart: chart,
    vmtEye: worstVmtLabel(points, "right-tight-eye", "left-tight-eye"),
    vmtWrist: worstVmtLabel(points, "right-wrist", "left-wrist"),
    vmtFinger: worstVmtLabel(points, "right-little-finger", "left-little-finger"),
    vmtThumb: worstVmtLabel(points, "right-thumb", "left-thumb"),
    vmtFoot: worstVmtLabel(points, "right-foot", "left-foot"),
  };
}

export function applySensoryChart(data, chart) {
  const points = chart?.points || {};
  return {
    ...data,
    sensoryChart: chart,
    sensoryHands: sideFromPoints(points, HAND_R, HAND_L, ["WITHOUTSENS"]),
    sensoryFeet: sideFromPoints(points, FOOT_R, FOOT_L, ["WITHOUTSENS"]),
    sensoryEyes: sideFromPoints(points, ["Right Eye"], ["Left Eye"], ["BLINKNOTNORM"]),
  };
}

export function applyVisionChart(data, chart) {
  const points = chart?.points || {};
  const parts = [];
  if (points["right-eye"]) {
    parts.push(`Right: ${points["right-eye"] === "660" ? "6/60" : "lesser than 6/60"}`);
  }
  if (points["left-eye"]) {
    parts.push(`Left: ${points["left-eye"] === "660" ? "6/60" : "lesser than 6/60"}`);
  }
  return {
    ...data,
    visionChart: chart,
    visionAcuity: parts.join("; ") || data.visionAcuity || "",
  };
}
