"use client";

import { FloppyDisk } from "@phosphor-icons/react";
import { useActionState } from "react";
import { saveLeadAction, type FormResult } from "@/app/admin/(panel)/pipeline/actions";
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
        <TextField label="Owner's first name" name="ownerFirstName" defaultValue={business.ownerFirstName} hint='Left empty, the email opens with "Hi there".' />
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
        <TextField label="Preview link" name="previewUrl" type="url" defaultValue={business.previewUrl} hint="Filled in by the preview builder." />
        <div className="sm:col-span-2">
          <TextField
            label="Problem line"
            name="emailProblem"
            defaultValue={business.emailProblem}
            hint={`Follows "Hi ${business.ownerFirstName || "there"}," in the first email.${business.problemSummary ? ` The lead finder found: ${business.problemSummary}.` : ""}`}
          />
        </div>
      </fieldset>
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-2 text-lg font-semibold">After they pay</legend>
        <TextField label="Owner email for change requests" name="ownerEmail" type="email" defaultValue={business.ownerEmail} />
        <TextField label="Live site" name="siteUrl" type="url" defaultValue={business.siteUrl} />
        <TextField label="Vercel project ID" name="vercelProjectId" defaultValue={business.vercelProjectId} className="font-mono" />
      </fieldset>
      <TextAreaField label="Notes" name="note" defaultValue={business.note} rows={4} />
      {state.message && <Notice tone={state.ok ? "good" : "bad"}>{state.message}</Notice>}
      <div>
        <SubmitButton variant="solid" icon={<FloppyDisk size={18} aria-hidden="true" />}>
          Save
        </SubmitButton>
      </div>
    </form>
  );
}
