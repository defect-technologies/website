"use client";

import { CalendarCheck, CheckCircle, VideoCamera } from "@phosphor-icons/react";
import { startTransition, useActionState, useState, type FormEvent } from "react";
import { submitCall, type CallField, type CallFormState } from "@/app/call/actions";
import { CALL_HOURS, clockLabel, type CallDay } from "@/lib/callSlots";
import { TextAreaField, TextField } from "./admin/fields";
import KnifeStroke from "./admin/KnifeStroke";
import SubmitButton from "./admin/SubmitButton";
import { Card, Notice } from "./admin/ui";

const TILE =
  "relative isolate flex cursor-pointer items-center justify-center rounded-control bg-surface text-ink shadow-sm transition-[background-color,box-shadow] duration-150 hover:bg-paper-shade has-checked:ring-2 has-checked:ring-ink has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ink";

function DayPicker({ days, dayKey, onPick }: { days: CallDay[]; dayKey: string; onPick: (day: CallDay) => void }) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-3 text-lg font-semibold">Day</legend>
      <div className="flex flex-wrap gap-2">
        {days.map((day) => (
          <label key={day.key} className={`${TILE} min-h-16 w-[4.75rem] flex-col gap-0.5 has-checked:bg-ink has-checked:text-paper`}>
            <input type="radio" name="day" value={day.key} checked={day.key === dayKey} onChange={() => onPick(day)} className="sr-only" aria-label={day.fullDate} />
            <span className="text-sm opacity-75">{day.weekday}</span>
            <span className="font-semibold tabular-nums">{day.date}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function TimePicker({ day, start, onPick, error }: { day: CallDay; start: number | null; onPick: (start: number) => void; error?: string }) {
  return (
    <fieldset className="flex flex-col" aria-describedby={error ? "start-error" : undefined}>
      <legend className="mb-3 text-lg font-semibold">Time ({CALL_HOURS.timeZoneName})</legend>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {day.slots.map((slot, index) => (
          <label key={slot} className={`${TILE} min-h-11 font-medium tabular-nums has-checked:font-semibold`}>
            <input type="radio" name="start" value={slot} checked={slot === start} onChange={() => onPick(slot)} className="peer sr-only" />
            <KnifeStroke variant={index} className="text-vermilion/35 absolute inset-x-2 inset-y-2 -z-10 hidden h-[calc(100%-1rem)] w-[calc(100%-1rem)] peer-checked:block" />
            {clockLabel(slot)}
          </label>
        ))}
      </div>
      {error && (
        <p id="start-error" className="text-bad mt-2 text-sm font-medium">
          {error}
        </p>
      )}
    </fieldset>
  );
}

function chosenLabel(days: CallDay[], start: number | null) {
  const day = days.find((candidate) => start !== null && candidate.slots.includes(start));
  return day && start !== null ? `${day.fullDate} at ${clockLabel(start)}` : null;
}

function Booked({ email, when }: { email: string; when: string }) {
  return (
    <Card className="flex max-w-2xl flex-col items-start gap-4 p-6 sm:p-8" role="status">
      <CheckCircle size={40} weight="fill" className="text-good" aria-hidden="true" />
      <h2 className="font-display text-4xl leading-none font-black">You&apos;re booked</h2>
      <p className="text-ink-soft text-lg text-pretty">
        <span className="text-ink font-medium">{when}</span> {CALL_HOURS.timeZoneName}. Google is sending the invite and the Meet link to{" "}
        <span className="text-ink font-medium">{email}</span>.
      </p>
    </Card>
  );
}

function Problem({ state }: { state: CallFormState }) {
  if (state.state === "taken") return <Notice tone="bad">Someone took that time a moment ago. Pick another time.</Notice>;
  if (state.state === "unavailable")
    return (
      <Notice tone="bad">
        Unable to book the call. Email <a href="mailto:hello@defect.tech?subject=A%20call" className="font-medium underline underline-offset-4">hello@defect.tech</a> and
        we&apos;ll find a time.
      </Notice>
    );
  return null;
}

function Details({ when, errors, pending, state }: { when: string | null; errors: Partial<Record<CallField, string>>; pending: boolean; state: CallFormState }) {
  return (
    <Card className="relative flex flex-col gap-5 p-6 sm:p-8 lg:sticky lg:top-24">
      <div className="flex flex-col gap-1">
        <p className={`text-xl font-semibold text-balance ${when ? "" : "text-ink-faint"}`}>{when ?? "Pick a day and a time"}</p>
        <p className="text-ink-soft flex items-center gap-2">
          <VideoCamera size={18} aria-hidden="true" />
          {CALL_HOURS.minutes} minutes on Google Meet
        </p>
      </div>
      <div aria-hidden="true" className="absolute -left-[9999px] size-px overflow-hidden">
        <label>
          Company
          <input type="text" name="company" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <TextField label="Your name" name="name" autoComplete="name" error={errors.name} required />
      <TextField label="Email" name="email" type="email" autoComplete="email" inputMode="email" placeholder="name@example.com" error={errors.email} required />
      <TextField label="Business (optional)" name="business" autoComplete="organization" error={errors.business} />
      <TextAreaField label="What would you like to talk about? (optional)" name="note" rows={3} maxLength={1000} error={errors.note} />
      <Problem state={state} />
      <div>
        <SubmitButton variant="solid" pending={pending} icon={<CalendarCheck size={18} weight="bold" aria-hidden="true" />}>
          Book the call
        </SubmitButton>
      </div>
    </Card>
  );
}

export default function CallBooking({ days: initialDays }: { days: CallDay[] }) {
  const [state, action, pending] = useActionState(submitCall, { state: "idle" } as CallFormState);
  const days = state.state === "taken" ? state.days : initialDays;
  const [dayKey, setDayKey] = useState(initialDays[0]?.key ?? "");
  const [start, setStart] = useState<number | null>(null);
  const day = days.find((candidate) => candidate.key === dayKey) ?? days[0];

  if (state.state === "booked") return <Booked email={state.email} when={chosenLabel(days, state.start) ?? ""} />;
  if (!day) return <Notice tone="warn">Brendan has no free times in the next two weeks. Email hello@defect.tech and we&apos;ll find one.</Notice>;

  const errors = state.state === "invalid" ? state.errors : {};
  const pickDay = (picked: CallDay) => {
    setDayKey(picked.key);
    setStart(null);
  };
  // Sent from code, so a form with an error keeps what the owner typed.
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => action(data));
  };
  return (
    <form onSubmit={submit} noValidate className="relative grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
      <div className="flex flex-col gap-10">
        <DayPicker days={days} dayKey={day.key} onPick={pickDay} />
        <TimePicker day={day} start={start} onPick={setStart} error={errors.start} />
      </div>
      <Details when={chosenLabel(days, start)} errors={errors} pending={pending} state={state} />
    </form>
  );
}
