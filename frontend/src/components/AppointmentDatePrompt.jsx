import { useCallback, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { localISODate } from "@/mock/specs";
import { visitDateRelation, visitDay } from "@/lib/appointmentDate";

/**
 * Past-due or future: Yes/No whether to move appointment date to today.
 * Yes → today; No → keep the selected date. Today / empty → continue immediately.
 */
export function useAppointmentDateGate() {
  const [prompt, setPrompt] = useState(null);

  const gate = useCallback((dateStr, continueWithDate) => {
    const today = localISODate();
    const day = visitDay(dateStr) || today;
    const relation = visitDateRelation(day, today);
    if (!relation || relation === "today") {
      continueWithDate(day);
      return;
    }
    setPrompt({
      kind: relation,
      scheduled: day,
      onYes: () => {
        setPrompt(null);
        continueWithDate(today);
      },
      onNo: () => {
        setPrompt(null);
        continueWithDate(day);
      },
    });
  }, []);

  const dialog = (
    <Dialog
      open={Boolean(prompt)}
      onOpenChange={(o) => {
        if (!o) setPrompt(null);
      }}
    >
      <DialogContent className="sm:max-w-md" data-testid="appointment-date-prompt">
        <DialogHeader>
          <DialogTitle className="font-head text-xl">
            {prompt?.kind === "future" ? "Appointment date is in the future" : "Appointment date is past due"}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            The appointment date will be changed to today. Do you want to continue with today’s date?
          </DialogDescription>
        </DialogHeader>
        {prompt?.scheduled ? (
          <p className="text-sm text-muted-foreground" data-testid="appointment-date-scheduled">
            Scheduled: <span className="font-semibold text-foreground">{prompt.scheduled}</span>
            {" · "}Today: <span className="font-semibold text-foreground">{localISODate()}</span>
          </p>
        ) : null}
        <DialogFooter className="gap-2 sm:justify-end">
          <Button
            variant="outline"
            className="h-11"
            data-testid="appointment-date-no"
            onClick={() => prompt?.onNo?.()}
          >
            No
          </Button>
          <Button className="h-11" data-testid="appointment-date-yes" onClick={() => prompt?.onYes?.()}>
            Yes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return { gate, dialog };
}
