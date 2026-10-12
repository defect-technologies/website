import type { ReactNode } from "react";

export default function SectionHeading({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <h2 id={id} className="font-display text-ink text-5xl leading-[0.95] font-black text-balance sm:text-6xl">
      {children}
    </h2>
  );
}
