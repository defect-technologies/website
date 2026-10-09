"use client";

import { Key } from "@phosphor-icons/react";
import { useActionState } from "react";
import { createBotKeyAction, type CreateKeyState } from "@/app/admin/(panel)/bots/actions";
import { BOT_KEY_ENV, type Bot } from "@/lib/bots";
import CopyCommand from "./CopyCommand";
import { TextField } from "./fields";
import SubmitButton from "./SubmitButton";
import { Notice } from "./ui";

function NewKey({ value }: { value: string }) {
  return (
    <div className="flex flex-col gap-3">
      <Notice tone="warn">
        Add this to the bot&apos;s Secrets in Grok Bot now, named <code className="font-mono">{BOT_KEY_ENV}</code>. It won&apos;t be shown again.
      </Notice>
      <CopyCommand command={value} label="Copy key" />
    </div>
  );
}

export default function CreateBotKeyForm({ bot }: { bot: Bot }) {
  const [state, action] = useActionState(createBotKeyAction, { key: "", bot, error: "" } as CreateKeyState);
  if (state.key) return <NewKey value={state.key} />;
  return (
    <form action={action} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <input type="hidden" name="bot" value={bot} />
      <div className="flex-1">
        <TextField label="Key name" name="name" defaultValue="Grok Bot" required maxLength={60} id={`key-name-${bot}`} />
      </div>
      <SubmitButton icon={<Key size={18} aria-hidden="true" />}>Create key</SubmitButton>
      {state.error && <Notice tone="bad">{state.error}</Notice>}
    </form>
  );
}
