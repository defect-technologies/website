import { EnvelopeSimple, UserMinus, UserPlus } from "@phosphor-icons/react/dist/ssr";
import type { ReactNode } from "react";
import SubmitButton from "./SubmitButton";
import { TextField } from "./fields";
import { Card, When } from "./ui";

type FormAction = (form: FormData) => Promise<void>;

export type EditorRow = { email: string; addedBy: string; addedAt: Date };

type Props = {
  slug: string;
  editors: EditorRow[];
  addAction: FormAction;
  removeAction: FormAction;
  /** Founders can email an editor a one-time editor link. Owners can't. */
  sendLinkAction?: FormAction;
  sendLinkDisabled?: boolean;
  /** Who added each editor and when, for the admin. */
  showHistory?: boolean;
  addHint?: ReactNode;
  /** A heading and any notice, inside the card, for pages whose sections are cards. */
  header?: ReactNode;
};

function EditorForm({ action, slug, email, children }: { action: FormAction; slug: string; email: string; children: ReactNode }) {
  return (
    <form action={action}>
      <input type="hidden" name="site" value={slug} />
      <input type="hidden" name="email" value={email} />
      {children}
    </form>
  );
}

function EditorItem({ editor, props }: { editor: EditorRow; props: Props }) {
  const { slug, removeAction, sendLinkAction, sendLinkDisabled, showHistory } = props;
  return (
    <li className="border-ink/8 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b py-3 first:pt-0 last:border-b-0">
      <div className="flex min-w-0 flex-col">
        <span className="truncate font-medium">{editor.email}</span>
        {showHistory && (
          <span className="text-ink-faint text-sm">
            Added by {editor.addedBy}, <When date={editor.addedAt} />
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {sendLinkAction && (
          <EditorForm action={sendLinkAction} slug={slug} email={editor.email}>
            <SubmitButton variant="soft" size="sm" disabled={sendLinkDisabled} icon={<EnvelopeSimple size={16} aria-hidden="true" />}>
              Email a sign-in link
            </SubmitButton>
          </EditorForm>
        )}
        <EditorForm action={removeAction} slug={slug} email={editor.email}>
          <SubmitButton variant="ghost" size="sm" aria-label={`Remove ${editor.email}`} icon={<UserMinus size={16} aria-hidden="true" />}>
            Remove
          </SubmitButton>
        </EditorForm>
      </div>
    </li>
  );
}

/** People besides the owner who can sign in and edit one site: the list, and a field to add one. */
export default function SiteEditors(props: Props) {
  const { slug, editors, addAction, addHint, header } = props;
  return (
    <Card className="flex flex-col gap-5 p-6">
      {header}
      {editors.length > 0 && (
        <ul className="flex flex-col">
          {editors.map((editor) => (
            <EditorItem key={editor.email} editor={editor} props={props} />
          ))}
        </ul>
      )}
      <form action={addAction} className="flex flex-wrap items-end gap-4">
        <input type="hidden" name="site" value={slug} />
        <div className="min-w-64 flex-1">
          <TextField label="Editor's email" name="email" type="email" required autoComplete="off" />
        </div>
        <SubmitButton variant="soft" icon={<UserPlus size={18} aria-hidden="true" />}>
          Add editor
        </SubmitButton>
      </form>
      {addHint && <p className="text-ink-faint -mt-2 text-sm text-pretty">{addHint}</p>}
    </Card>
  );
}
