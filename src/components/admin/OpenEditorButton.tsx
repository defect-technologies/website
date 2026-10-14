import { PencilSimple } from "@phosphor-icons/react/dist/ssr";
import type { ComponentProps } from "react";
import { openEditorAction } from "@/app/admin/(panel)/clients/actions";
import SubmitButton from "./SubmitButton";

type Props = { slug: string; label: string } & Pick<ComponentProps<typeof SubmitButton>, "variant" | "size" | "disabled">;

/** Signs the founder into a client's site editor as themselves. */
export default function OpenEditorButton({ slug, label, ...button }: Props) {
  return (
    <form action={openEditorAction}>
      <input type="hidden" name="slug" value={slug} />
      <SubmitButton icon={<PencilSimple size={button.size === "sm" ? 16 : 18} aria-hidden="true" />} {...button}>
        {label}
      </SubmitButton>
    </form>
  );
}
