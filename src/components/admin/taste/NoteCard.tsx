"use client";

import { Browser, CircleHalf, DotsThree, Layout, Palette, Quotes, Shapes, Stack, TextAa, TreeStructure, X, type Icon } from "@phosphor-icons/react";
import { TASTE_CATEGORY_LABEL, type TasteCategory, type TasteNote, type TasteScope } from "@/lib/taste";

const CATEGORY_ICON: Record<TasteCategory, Icon> = {
  layout: Layout,
  type: TextAa,
  color: Palette,
  contrast: CircleHalf,
  copy: Quotes,
  structure: TreeStructure,
  motif: Shapes,
  other: DotsThree,
};

const SCOPE_OPTIONS: { scope: TasteScope; label: string; icon: Icon }[] = [
  { scope: "site", label: "This site", icon: Browser },
  { scope: "all", label: "Every site", icon: Stack },
];

type Props = { id: string; note: TasteNote; onScope: (scope: TasteScope) => void; onRemove: () => void };

/** One note from what the founder said: what it's about, where it applies, and a way to drop it. */
export default function NoteCard({ id, note, onScope, onRemove }: Props) {
  const CategoryIcon = CATEGORY_ICON[note.category];
  return (
    <li className="bg-surface shadow-card flex flex-col gap-3 rounded-2xl p-4">
      <div className="flex items-start gap-3">
        <span className="text-ink-soft mt-0.5 shrink-0" title={TASTE_CATEGORY_LABEL[note.category]}>
          <CategoryIcon size={20} aria-hidden="true" />
          <span className="sr-only">{TASTE_CATEGORY_LABEL[note.category]}: </span>
        </span>
        <p className="min-w-0 flex-1 text-base text-pretty">{note.text}</p>
        <button
          type="button"
          onClick={onRemove}
          className="text-ink-faint hover:bg-paper-shade hover:text-ink -mt-2 -mr-2 grid size-11 shrink-0 place-items-center rounded-full transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-ink"
        >
          <X size={18} aria-hidden="true" />
          <span className="sr-only">Remove this note</span>
        </button>
      </div>
      <fieldset className="bg-paper-shade flex w-fit rounded-full p-1">
        <legend className="sr-only">Where this applies</legend>
        {SCOPE_OPTIONS.map(({ scope, label, icon: ScopeIcon }) => (
          <label
            key={scope}
            className="has-[:checked]:bg-surface has-[:checked]:text-ink has-[:checked]:shadow-card text-ink-soft has-[:focus-visible]:outline-ink inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-full px-3.5 text-sm font-medium transition-[background-color,color] duration-150 has-[:focus-visible]:outline-2"
          >
            <input type="radio" name={`scope-${id}`} value={scope} checked={note.scope === scope} onChange={() => onScope(scope)} className="sr-only" />
            <ScopeIcon size={16} aria-hidden="true" />
            {label}
          </label>
        ))}
      </fieldset>
    </li>
  );
}
