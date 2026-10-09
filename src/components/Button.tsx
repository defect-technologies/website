import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps, ReactNode } from "react";

type Variant = "solid" | "soft" | "ghost" | "danger";
type Size = "md" | "sm";

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-full font-medium whitespace-nowrap transition-[scale,background-color,opacity] duration-150 ease-knife active:scale-[0.96] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:pointer-events-none disabled:opacity-45";

const SIZES: Record<Size, string> = {
  md: "min-h-11 px-5 text-base",
  sm: "min-h-9 px-3.5 text-sm",
};

const VARIANTS: Record<Variant, string> = {
  solid: "bg-ink text-paper hover:bg-ink/85",
  soft: "bg-paper-shade text-ink hover:bg-paper-shade/70",
  ghost: "text-ink-soft hover:bg-paper-shade hover:text-ink",
  danger: "bg-bad text-paper hover:bg-bad/85",
};

export function buttonClasses(variant: Variant, size: Size = "md", extra = "") {
  return `${BASE} ${SIZES[size]} ${VARIANTS[variant]} ${extra}`;
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; icon?: ReactNode };

export function Button({ variant = "soft", size = "md", icon, className, children, ...rest }: ButtonProps) {
  return (
    <button type="button" className={buttonClasses(variant, size, className)} {...rest}>
      {icon}
      {children}
    </button>
  );
}

type ButtonLinkProps = ComponentProps<typeof Link> & { variant?: Variant; size?: Size; icon?: ReactNode };

export function ButtonLink({ variant = "solid", size = "md", icon, className, children, ...rest }: ButtonLinkProps) {
  return (
    <Link className={buttonClasses(variant, size, className)} {...rest}>
      {children}
      {icon}
    </Link>
  );
}
