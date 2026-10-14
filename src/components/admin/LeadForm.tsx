"use client";

import { CaretRight, FloppyDisk } from "@phosphor-icons/react";
import { useActionState } from "react";
import { saveLeadAction, type FormResult } from "@/app/admin/(panel)/sites/actions";
import { STAGE_LABEL, STAGES } from "@/lib/stages";
import type { Business } from "@/server/db/schema";
import { SelectField, TextAreaField, TextField } from "./fields";
import SubmitButton from "./SubmitButton";
import { Notice } from "./ui";

export default function LeadForm({ business }: { business: Business }) {
  const [state, action] = useActionState(saveLeadAction.bind(null, business.id), { ok: false, message: "" } as FormResult);
  return (
    <form action={action} className="flex flex-col gap-6">
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="sr-only">Outreach</legend>
        <TextField label="Business name" name="businessName" defaultValue={business.businessName} required />
        <TextField label="Owner's first name" name="ownerFirstName" defaultValue={business.ownerFirstName} placeholder="Hi there" />
        <TextField label="Email" name="email" type="email" defaultValue={business.email} />
        <SelectField label="Price" name="priceArm" defaultValue={business.priceArm ? String(business.priceArm) : ""}>
          <option value="">Not set</option>
          <option value="59">$59 a month</option>
          <option value="79">$79 a month</option>
        </SelectField>
        <SelectField label="Stage" name="stage" defaultValue={business.stage}>
          {STAGES.map((stage) => (
            <option key={stage} value={stage}>
              {STAGE_LABEL[stage]}
            </option>
          ))}
        </SelectField>
        <TextField label="Preview link" name="previewUrl" type="url" defaultValue={business.previewUrl} />
        {business.source === "request" ? (
          <input type="hidden" name="emailProblem" value={business.emailProblem} />
        ) : (
          <div className="sm:col-span-2">
            <TextField
              label="Problem line"
              name="emailProblem"
              defaultValue={business.emailProblem}
              placeholder={business.problemSummary}
            />
          </div>
        )}
      </fieldset>
      <details open={Boolean(business.paidAt)} className="group/paid">
        <summary className="text-ink-soft hover:text-ink flex w-fit cursor-pointer list-none items-center gap-1.5 text-sm font-medium [&::-webkit-details-marker]:hidden">
          <CaretRight size={14} weight="bold" className="transition-transform duration-150 group-open/paid:rotate-90 motion-reduce:transition-none" aria-hidden="true" />
          After they pay
        </summary>
        <fieldset className="mt-3 grid gap-4 sm:grid-cols-2">
          <legend className="sr-only">After they pay</legend>
          <TextField label="Owner email for change requests" name="ownerEmail" type="email" defaultValue={business.ownerEmail} />
          <TextField label="Live site" name="siteUrl" type="url" defaultValue={business.siteUrl} />
          <TextField label="Vercel project ID" name="vercelProjectId" defaultValue={business.vercelProjectId} className="font-mono" />
        </fieldset>
      </details>
      <TextAreaField label="Notes" name="note" defaultValue={business.note} rows={4} />
      {state.message && <Notice tone={state.ok ? "good" : "bad"}>{state.message}</Notice>}
      <div>
        <SubmitButton variant="solid" icon={<FloppyDisk size={18} aria-hidden="true" />}>
          Save details
        </SubmitButton>
      </div>
    </form>
  );
}
