"use client";

import { CircleNotch } from "@phosphor-icons/react";
import type { ComponentProps, ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "../Button";

/** A form's submit button that shows it's working and can't be pressed twice. */
export default function SubmitButton({ icon, children, ...rest }: ComponentProps<typeof Button> & { icon?: ReactNode }) {
  const { pending } = useFormStatus();
  const spinner = <CircleNotch size={18} weight="bold" className="animate-spin motion-reduce:animate-none" aria-hidden="true" />;
  return (
    <Button type="submit" disabled={pending || rest.disabled} aria-busy={pending} icon={pending ? spinner : icon} {...rest}>
      {children}
    </Button>
  );
}
