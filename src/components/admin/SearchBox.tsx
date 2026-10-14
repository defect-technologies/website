"use client";

import { MagnifyingGlass } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import type { SearchHit } from "@/server/search";
import LeadStatusMark from "./overview/LeadStatusMark";

const DEBOUNCE_MS = 150;

function useHits(query: string) {
  const [hits, setHits] = useState<SearchHit[]>([]);
  useEffect(() => {
    if (query.trim().length < 2) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      fetch(`/api/admin/search?q=${encodeURIComponent(query)}`, { signal: controller.signal })
        .then((response) => (response.ok ? response.json() : { hits: [] }))
        .then((body: { hits: SearchHit[] }) => setHits(body.hits))
        .catch(() => {});
    }, DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);
  return query.trim().length < 2 ? [] : hits;
}

/** "/" or ⌘K jumps to the search box from anywhere in the admin, unless you're typing somewhere else. */
function useShortcut(input: React.RefObject<HTMLInputElement | null>) {
  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      const typing = event.target instanceof HTMLElement && (event.target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName));
      const slash = event.key === "/" && !typing;
      const commandK = event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey);
      if (!slash && !commandK) return;
      event.preventDefault();
      input.current?.focus();
      input.current?.select();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [input]);
}

/** Finds any business by name, website or email and opens its site page. */
export default function SearchBox() {
  const router = useRouter();
  const listId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const hits = useHits(query);
  const open = hits.length > 0;
  useShortcut(input);

  const go = (hit: SearchHit | undefined) => {
    if (!hit) return;
    setQuery("");
    input.current?.blur();
    router.push(`/admin/sites/${hit.id}`);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const moves: Record<string, () => void> = {
      ArrowDown: () => setActive((index) => Math.min(index + 1, hits.length - 1)),
      ArrowUp: () => setActive((index) => Math.max(index - 1, 0)),
      Enter: () => go(hits[active]),
      Escape: () => setQuery(""),
    };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    move();
  };

  return (
    <div className="relative">
      <label className="bg-surface shadow-card focus-within:ring-ink/30 flex min-h-11 items-center gap-2 rounded-xl px-3 focus-within:ring-2">
        <MagnifyingGlass size={18} className="text-ink-faint shrink-0" aria-hidden="true" />
        <span className="sr-only">Search sites</span>
        <input
          ref={input}
          type="search"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={open ? `${listId}-${active}` : undefined}
          aria-autocomplete="list"
          placeholder="Search sites"
          autoComplete="off"
          spellCheck={false}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
          onBlur={() => window.setTimeout(() => document.activeElement !== input.current && setQuery(""), 150)}
          className="placeholder:text-ink-faint min-w-0 flex-1 bg-transparent text-base outline-none"
        />
        <kbd className="text-ink-faint border-ink/15 hidden rounded border px-1.5 text-xs lg:inline">/</kbd>
      </label>
      {open && (
        <ul id={listId} role="listbox" aria-label="Sites" className="bg-surface shadow-lifted absolute inset-x-0 top-full z-30 mt-1.5 max-h-96 overflow-auto rounded-xl p-1.5 lg:w-96">
          {hits.map((hit, index) => (
            <li
              key={hit.id}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === active}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => go(hit)}
              onMouseEnter={() => setActive(index)}
              className={`flex cursor-pointer flex-col gap-0.5 rounded-lg px-3 py-2 text-sm ${index === active ? "bg-paper-shade" : ""}`}
            >
              <span className="flex items-center justify-between gap-3">
                <span className="truncate font-semibold">{hit.name}</span>
                <LeadStatusMark status={hit.status} />
              </span>
              <span className="text-ink-faint truncate">{hit.where}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
