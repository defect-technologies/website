"use client";

import { Plus } from "@phosphor-icons/react";
import { Button } from "@/components/Button";
import { TextField } from "@/components/admin/fields";
import { DAY_LABEL, DAYS, LIMITS, SECTION_LABEL, type Day, type OpenDay } from "@/lib/siteContent";
import { move, newKey, type Draft, type DraftParagraph, type DraftService } from "./draft";
import { FormSection, LimitedText, RowControls } from "./parts";

type Props = { draft: Draft; update: (patch: Partial<Draft>) => void };

export function WordingFields({ draft, update }: Props) {
  return (
    <FormSection id="wording-title" title="Top of the page">
      <LimitedText id="headline" label="Headline" required value={draft.headline} max={LIMITS.headline} onChange={(headline) => update({ headline })} hint="Usually your business name." />
      <LimitedText id="tagline" label="Tagline" multiline value={draft.tagline} max={LIMITS.tagline} onChange={(tagline) => update({ tagline })} hint="One sentence under the headline that says what you do and where." />
    </FormSection>
  );
}

function ServiceRow({ service, index, count, onChange, onMove, onRemove }: { service: DraftService; index: number; count: number; onChange: (s: DraftService) => void; onMove: (to: number) => void; onRemove: () => void }) {
  const name = service.name.trim() || `service ${index + 1}`;
  return (
    <li className="bg-paper/60 flex flex-col gap-3 rounded-xl p-4">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_9rem]">
        <LimitedText id={`${service.key}-name`} label="Name" required value={service.name} max={LIMITS.serviceName} onChange={(value) => onChange({ ...service, name: value })} />
        <LimitedText id={`${service.key}-price`} label="Price" value={service.price} max={LIMITS.servicePrice} onChange={(price) => onChange({ ...service, price })} placeholder="No price shown" />
      </div>
      <LimitedText id={`${service.key}-description`} label="Description" value={service.description} max={LIMITS.serviceDescription} onChange={(description) => onChange({ ...service, description })} />
      <div className="-mr-2 -mb-2 flex justify-end">
        <RowControls name={name} index={index} count={count} onMove={onMove} onRemove={onRemove} />
      </div>
    </li>
  );
}

export function ServicesFields({ draft, update }: Props) {
  const services = draft.services;
  const set = (next: DraftService[]) => update({ services: next });
  const add = () => set([...services, { key: newKey(), name: "", description: "", price: "" }]);
  const full = services.length >= LIMITS.services;
  return (
    <FormSection
      id="services-title"
      title="Services and prices"
      action={
        <Button variant="soft" size="sm" onClick={add} disabled={full} icon={<Plus size={16} weight="bold" aria-hidden="true" />}>
          Add a service
        </Button>
      }
    >
      {services.length === 0 ? (
        <p className="text-ink-soft text-sm">Your site has no services listed, so that section is hidden. Add one to bring it back.</p>
      ) : (
        <ol className="flex flex-col gap-3">
          {services.map((service, index) => (
            <ServiceRow
              key={service.key}
              service={service}
              index={index}
              count={services.length}
              onChange={(changed) => set(services.map((s) => (s.key === changed.key ? changed : s)))}
              onMove={(to) => set(move(services, index, to))}
              onRemove={() => set(services.filter((s) => s.key !== service.key))}
            />
          ))}
        </ol>
      )}
    </FormSection>
  );
}

export function AboutFields({ draft, update }: Props) {
  const paragraphs = draft.aboutParagraphs;
  const set = (next: DraftParagraph[]) => update({ aboutParagraphs: next });
  const full = paragraphs.length >= LIMITS.aboutParagraphs;
  return (
    <FormSection
      id="about-title"
      title="About"
      action={
        <Button variant="soft" size="sm" disabled={full} onClick={() => set([...paragraphs, { key: newKey(), text: "" }])} icon={<Plus size={16} weight="bold" aria-hidden="true" />}>
          Add a paragraph
        </Button>
      }
    >
      {paragraphs.length === 0 && <p className="text-ink-soft text-sm">Your About section is empty, so it&apos;s hidden on the site.</p>}
      {paragraphs.map((paragraph, index) => (
        <div key={paragraph.key} className="flex flex-col gap-1">
          <LimitedText
            id={paragraph.key}
            label={`Paragraph ${index + 1}`}
            multiline
            required
            value={paragraph.text}
            max={LIMITS.aboutParagraph}
            onChange={(text) => set(paragraphs.map((p) => (p.key === paragraph.key ? { ...p, text } : p)))}
          />
          <div className="-mr-2 flex justify-end">
            <RowControls name={`paragraph ${index + 1}`} index={index} count={paragraphs.length} onMove={(to) => set(move(paragraphs, index, to))} onRemove={() => set(paragraphs.filter((p) => p.key !== paragraph.key))} />
          </div>
        </div>
      ))}
    </FormSection>
  );
}

const DEFAULT_DAY = { open: "09:00", close: "17:00" };

function DayRow({ day, hours, onChange }: { day: Day; hours: OpenDay | undefined; onChange: (hours: OpenDay | undefined) => void }) {
  const label = DAY_LABEL[day];
  const open = Boolean(hours);
  return (
    <li className="flex min-h-12 flex-wrap items-center gap-x-3 gap-y-1">
      <label className="flex min-h-11 w-32 items-center gap-2.5 font-medium">
        <input type="checkbox" className="accent-ink size-4.5" checked={open} onChange={(event) => onChange(event.target.checked ? { day, ...DEFAULT_DAY } : undefined)} />
        {label}
      </label>
      {hours ? (
        <div className="flex min-w-[16rem] flex-1 items-center gap-2">
          <TimeInput label={`${label} opens`} value={hours.open} onChange={(value) => onChange({ ...hours, open: value })} />
          <span className="text-ink-faint" aria-hidden="true">to</span>
          <TimeInput label={`${label} closes`} value={hours.close} onChange={(value) => onChange({ ...hours, close: value })} />
        </div>
      ) : (
        <span className="text-ink-faint">Closed</span>
      )}
    </li>
  );
}

function TimeInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <input
      type="time"
      aria-label={label}
      value={value}
      required
      onChange={(event) => onChange(event.target.value)}
      className="bg-surface border-ink/15 text-ink min-w-0 flex-1 rounded-lg border px-2.5 py-2 tabular-nums focus-visible:border-ink focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-ink/20"
    />
  );
}

export function HoursFields({ draft, update }: Props) {
  const byDay = new Map(draft.hours.map((h) => [h.day, h]));
  const setDay = (day: Day, hours: OpenDay | undefined) => {
    const next = DAYS.map((d) => (d === day ? hours : byDay.get(d))).filter((h): h is OpenDay => Boolean(h));
    update({ hours: next });
  };
  return (
    <FormSection id="hours-title" title="Opening hours">
      <ul className="flex flex-col gap-1">
        {DAYS.map((day) => (
          <DayRow key={day} day={day} hours={byDay.get(day)} onChange={(hours) => setDay(day, hours)} />
        ))}
      </ul>
      <LimitedText id="hours-note" label="Note under your hours" value={draft.hoursNote} max={LIMITS.hoursNote} onChange={(hoursNote) => update({ hoursNote })} placeholder="Wedding consultations by appointment." />
    </FormSection>
  );
}

export function ContactFields({ draft, update }: Props) {
  return (
    <FormSection id="contact-title" title="Contact details">
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField id="phone" label="Phone" type="tel" autoComplete="off" value={draft.phone} maxLength={LIMITS.phone} onChange={(event) => update({ phone: event.target.value })} />
        <TextField id="email" label="Email" type="email" autoComplete="off" value={draft.email} maxLength={LIMITS.email} onChange={(event) => update({ email: event.target.value })} />
      </div>
      <TextField id="booking-url" label="Booking or ordering link" type="url" placeholder="https://" value={draft.bookingUrl} maxLength={LIMITS.bookingUrl} onChange={(event) => update({ bookingUrl: event.target.value })} hint="Leave it blank and your main button calls your phone instead." />
      <LimitedText id="booking-label" label="Button wording" value={draft.bookingLabel} max={LIMITS.bookingLabel} onChange={(bookingLabel) => update({ bookingLabel })} placeholder="Book online" />
    </FormSection>
  );
}

export function SectionOrderFields({ draft, update }: Props) {
  const order = draft.sectionOrder;
  return (
    <FormSection id="order-title" title="Order of sections">
      <ol className="flex flex-col gap-1.5">
        {order.map((section, index) => (
          <li key={section} className="bg-paper/60 flex items-center gap-3 rounded-xl py-1 pr-1 pl-4">
            <span className="text-ink-faint w-5 tabular-nums" aria-hidden="true">
              {index + 1}
            </span>
            <span className="flex-1 font-medium">{SECTION_LABEL[section]}</span>
            <RowControls name={SECTION_LABEL[section]} index={index} count={order.length} onMove={(to) => update({ sectionOrder: move(order, index, to) })} />
          </li>
        ))}
      </ol>
    </FormSection>
  );
}
