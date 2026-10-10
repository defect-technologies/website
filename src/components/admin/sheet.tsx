import type { ReactNode, TdHTMLAttributes, ThHTMLAttributes } from "react";

/**
 * The spreadsheet the Overview is built from: a sticky header, hairline
 * gridlines and compact rows inside one card. Below the lg breakpoint there
 * isn't room for the columns, so each row stacks into a block and cells name
 * themselves with their label. The explicit roles keep it a table to screen
 * readers once the display changes.
 */
export function Sheet({ caption, columns, children }: { caption: string; columns: string[]; children: ReactNode }) {
  return (
    <div className="bg-surface shadow-card rounded-2xl lg:max-h-[calc(100svh-16rem)] lg:min-h-64 lg:overflow-auto">
      <table role="table" className="w-full border-separate border-spacing-0 text-left text-sm max-lg:block">
        <caption className="sr-only">{caption}</caption>
        <thead className="max-lg:sr-only">
          <tr role="row">
            {columns.map((column) => (
              <th key={column} role="columnheader" scope="col" className="bg-surface text-ink-faint border-ink/10 sticky top-0 z-10 border-b px-3 py-2.5 font-normal whitespace-nowrap">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        {children}
      </table>
    </div>
  );
}

export function SheetBody({ children }: { children: ReactNode }) {
  return (
    <tbody role="rowgroup" className="max-lg:block">
      {children}
    </tbody>
  );
}

const CELL = "align-top lg:border-ink/6 lg:border-b lg:px-3 lg:py-2 max-lg:flex max-lg:gap-3";

/** The label shows only when the row is stacked; in table mode the column header says it. */
function StackLabel({ label }: { label?: string }) {
  if (!label) return null;
  return (
    <span aria-hidden="true" className="text-ink-faint w-20 shrink-0 lg:hidden">
      {label}
    </span>
  );
}

type CellProps = TdHTMLAttributes<HTMLTableCellElement> & { label?: string };

export function Cell({ className = "", label, children, ...rest }: CellProps) {
  return (
    <td role="cell" className={`${CELL} ${className}`} {...rest}>
      <StackLabel label={label} />
      <div className="min-w-0">{children}</div>
    </td>
  );
}

export function RowHeader({ className = "", ...rest }: ThHTMLAttributes<HTMLTableCellElement>) {
  return <th role="rowheader" scope="row" className={`${CELL} font-medium max-lg:order-first max-lg:text-base ${className}`} {...rest} />;
}

export function SheetRow({ children, dim = false }: { children: ReactNode; dim?: boolean }) {
  return (
    <tr
      role="row"
      className={`hover:bg-paper/70 transition-colors duration-100 max-lg:border-ink/8 max-lg:flex max-lg:flex-col max-lg:gap-1 max-lg:border-b max-lg:px-4 max-lg:py-3 max-lg:last:border-b-0 ${dim ? "text-ink-faint" : ""}`}
    >
      {children}
    </tr>
  );
}

/** A row spanning the sheet that heads a group of rows, like a grouped range in a spreadsheet. */
export function GroupRow({ span, children }: { span: number; children: ReactNode }) {
  return (
    <tr role="row" className="max-lg:block">
      <th role="rowheader" scope="rowgroup" colSpan={span} className="bg-paper/60 border-ink/10 border-b px-3 py-2 text-left font-normal max-lg:block max-lg:px-4">
        <div className="flex flex-wrap items-center gap-3">{children}</div>
      </th>
    </tr>
  );
}

export function EmptyRow({ span, children }: { span: number; children: ReactNode }) {
  return (
    <tr role="row" className="max-lg:block">
      <td role="cell" colSpan={span} className="text-ink-soft px-3 py-10 text-center max-lg:block">
        {children}
      </td>
    </tr>
  );
}
