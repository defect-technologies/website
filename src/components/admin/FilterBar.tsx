"use client";

import { Funnel, MagnifyingGlass, X } from "@phosphor-icons/react";
import Form from "next/form";
import Link from "next/link";
import type { ReactNode } from "react";
import { buttonClasses } from "../Button";

export type FilterSelect = { name: string; label: string; value: string; options: [value: string, label: string][] };

const CONTROL =
  "bg-surface border-ink/15 min-h-9 rounded-lg border px-2.5 text-sm text-ink focus-visible:border-ink focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-ink/20";

/**
 * Search and filters that live in the URL, so the page reads them on the server and a
 * filtered view can be linked to. `keep` carries other filters on the page through a
 * submit. Picking from a list applies it at once; the search applies on Enter.
 */
export default function FilterBar({
  action,
  search,
  selects,
  keep = {},
  clearHref,
  children,
}: {
  action: string;
  search: { name: string; value: string; placeholder: string; label: string };
  selects: FilterSelect[];
  keep?: Record<string, string>;
  clearHref?: string;
  children?: ReactNode;
}) {
  return (
    <Form action={action} scroll={false} replace className="flex flex-wrap items-center gap-2">
      {Object.entries(keep)
        .filter(([, value]) => value)
        .map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
      <label className="relative min-w-0 flex-1 basis-40">
        <span className="sr-only">{search.label}</span>
        <MagnifyingGlass size={16} className="text-ink-faint pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2" aria-hidden="true" />
        <input type="search" name={search.name} defaultValue={search.value} placeholder={search.placeholder} className={`${CONTROL} w-full pl-8`} />
      </label>
      {selects.map((select) => (
        <label key={select.name}>
          <span className="sr-only">{select.label}</span>
          <select name={select.name} defaultValue={select.value} className={CONTROL} onChange={(event) => event.currentTarget.form?.requestSubmit()}>
            {select.options.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      ))}
      {children}
      <button type="submit" title="Apply" className={buttonClasses("soft", "icon", "size-9")}>
        <Funnel size={16} aria-hidden="true" />
        <span className="sr-only">Apply the search and filters</span>
      </button>
      {clearHref && (
        <Link href={clearHref} scroll={false} replace className={buttonClasses("ghost", "sm")}>
          <X size={16} aria-hidden="true" />
          Clear
        </Link>
      )}
    </Form>
  );
}
