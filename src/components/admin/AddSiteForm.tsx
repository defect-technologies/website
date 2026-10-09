"use client";

import { Plus } from "@phosphor-icons/react";
import { useActionState } from "react";
import { addSiteAction, type AddSiteResult } from "@/app/admin/(panel)/sites/actions";
import SubmitButton from "./SubmitButton";
import { SelectField, TextAreaField, TextField } from "./fields";
import { Card, Notice } from "./ui";

export type ClientOption = { id: string; name: string };

const EMPTY: AddSiteResult = { problems: [], values: { slug: "", ownerEmail: "", liveUrl: "", businessId: "", content: "" } };

function Problems({ problems }: { problems: string[] }) {
  if (problems.length === 0) return null;
  if (problems.length === 1) return <Notice tone="bad">{problems[0]}</Notice>;
  return (
    <Notice tone="bad">
      <p>Fix these, then add the site again:</p>
      <ul className="mt-1 list-disc pl-5">
        {problems.map((problem) => (
          <li key={problem}>{problem}</li>
        ))}
      </ul>
    </Notice>
  );
}

export default function AddSiteForm({ clients }: { clients: ClientOption[] }) {
  const [state, action] = useActionState(addSiteAction, EMPTY);
  const { values } = state;
  return (
    <form action={action} className="flex flex-col gap-6">
      <Problems problems={state.problems} />
      <Card className="grid gap-5 p-6 sm:grid-cols-2">
        <TextField
          label="Site address"
          name="slug"
          required
          defaultValue={values.slug}
          placeholder="sunrise-florist"
          autoCapitalize="none"
          spellCheck={false}
          hint="Lowercase, with hyphens. The owner edits the site at defect.tech/edit/ followed by this."
        />
        <TextField label="Owner's email" name="ownerEmail" type="email" required defaultValue={values.ownerEmail} autoComplete="off" hint="Sign-in links go here. Only this address can edit the site." />
        <TextField label="Live address" name="liveUrl" type="url" defaultValue={values.liveUrl} placeholder="https://sunriseflorist.com" hint="Optional. Photo paths in content.json load from here." />
        {clients.length > 0 && (
          <SelectField label="Client" name="businessId" defaultValue={values.businessId} hint="Optional. Links the site to a paid lead in the pipeline.">
            <option value="">Not linked</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </SelectField>
        )}
        <div className="sm:col-span-2">
          <TextAreaField
            label="content.json"
          name="content"
          required
            defaultValue={values.content}
            spellCheck={false}
            rows={14}
            className="font-mono text-sm"
            hint="Paste the whole file the preview builder wrote. It becomes version 1."
          />
        </div>
      </Card>
      <SubmitButton variant="solid" className="w-fit" icon={<Plus size={18} weight="bold" aria-hidden="true" />}>
        Add site
      </SubmitButton>
    </form>
  );
}
