import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps, ReactNode } from "react";

type Variant = "solid" | "soft";

const BASE =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-base font-medium transition-[scale,background-color] duration-150 ease-knife active:scale-[0.96] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

const VARIANTS: Record<Variant, string> = {
  solid: "bg-ink text-paper hover:bg-ink/85",
  soft: "bg-paper-shade text-ink hover:bg-paper-shade/70",
};

function classesFor(variant: Variant, extra = "") {
  return `${BASE} ${VARIANTS[variant]} ${extra}`;
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; icon?: ReactNode };

export function Button({ variant = "soft", icon, className, children, ...rest }: ButtonProps) {
  return (
    <button type="button" className={classesFor(variant, className)} {...rest}>
      {icon}
      {children}
    </button>
  );
}

type ButtonLinkProps = ComponentProps<typeof Link> & { variant?: Variant; icon?: ReactNode };

export function ButtonLink({ variant = "solid", icon, className, children, ...rest }: ButtonLinkProps) {
  return (
    <Link className={classesFor(variant, className)} {...rest}>
      {children}
      {icon}
    </Link>
  );
}
