import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CircleHelp } from "lucide-react";

const STAGES = [
  {
    code: "S1",
    title: "Stage 1 — Swelling is reversible overnight",
    desc: "The swelling increases during the day and goes away overnight as the patient lies flat in bed.",
    img: "/lf/stage-1.png",
  },
  {
    code: "S2",
    title: "Stage 2 — Swelling is not reversible",
    desc: "The swelling does not go away without lymphoedema management.",
    img: "/lf/stage-2.png",
  },
  {
    code: "S3",
    title: "Stage 3 — Shallow skin folds",
    desc: "One or more shallow skin folds, in which the base of the fold can be seen when the patient moves the leg or foot.",
    img: "/lf/stage-3.png",
  },
  {
    code: "S4",
    title: "Stage 4 — Knobs",
    desc: "Knobs: bumps, lumps, or protrusions of the skin.",
    img: "/lf/stage-4.png",
  },
  {
    code: "S5",
    title: "Stage 5 — Deep skin folds",
    desc: "One or more deep skin folds whose base cannot be seen when the patient moves the leg or foot.",
    img: "/lf/stage-5.png",
  },
  {
    code: "S6",
    title: "Stage 6 — Mossy lesions",
    desc: "Mossy lesions on the skin: small elongated or rounded growths that are usually clustered together.",
    img: "/lf/stage-6.png",
  },
  {
    code: "S7",
    title: "Stage 7 — Unable to care for self",
    desc: "The most advanced stage: unable to independently perform daily activities such as walking, bathing, or cooking.",
    img: "/lf/stage-7.png",
  },
];

export default function LfStageHelp() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className="h-11" data-testid="lf-stage-help-btn">
          <CircleHelp className="mr-2 h-4 w-4" /> Help — LF stages
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-3xl" data-testid="lf-stage-help-dialog">
        <DialogHeader>
          <DialogTitle className="font-head text-xl">Lymphatic Filariasis — staging guide</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Dreyer seven-stage classification for lymphoedema. Select a stage, then tap the body region. Set secondary infection for each marked site (default None).
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {STAGES.map((s) => (
            <div key={s.code} className="rounded-lg border border-border bg-white p-3" data-testid={`lf-stage-card-${s.code}`}>
              <div className="mb-2 flex items-center gap-2">
                <span className="rounded bg-secondary px-2 py-0.5 text-xs font-bold text-primary">{s.code}</span>
                <p className="font-semibold text-sm leading-snug">{s.title}</p>
              </div>
              <img src={s.img} alt={s.title} className="mx-auto h-48 w-auto object-contain" />
              <p className="mt-2 text-xs text-muted-foreground">{s.desc}</p>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
