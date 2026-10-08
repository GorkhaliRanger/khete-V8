"use client";

import { Check, ChevronDown, Search, X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";

export type SearchableOption = {
  value: string;
  label: string;
  keywords?: string;
};

type SearchableSelectProps = {
  value: string;
  options: SearchableOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
};

export function SearchableSelect({
  value,
  options,
  onChange,
  placeholder = "Choose an option",
  searchPlaceholder = "Type to search…",
  emptyMessage = "No matching options",
  disabled = false,
}: SearchableSelectProps) {
  const root = useRef<HTMLDivElement>(null);
  const optionsId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = options.find((option) => option.value === value);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return options;
    return options.filter((option) => `${option.label} ${option.keywords ?? ""}`.toLowerCase().includes(needle));
  }, [options, query]);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <div className={`searchable-select ${open ? "is-open" : ""}`} ref={root}>
      <div
        className="searchable-select-trigger"
      >
        <Search className="searchable-select-leading-icon" />
        <input
          value={open ? query : selected?.label ?? ""}
          disabled={disabled}
          placeholder={open ? searchPlaceholder : placeholder}
          aria-label={searchPlaceholder}
          role="combobox"
          aria-autocomplete="list"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={optionsId}
          onFocus={() => {
            setQuery("");
            setOpen(true);
          }}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setOpen(false);
              setQuery("");
              event.currentTarget.blur();
            }
            if (event.key === "Enter" && filtered[0]) {
              event.preventDefault();
              onChange(filtered[0].value);
              setOpen(false);
              setQuery("");
            }
          }}
        />
        {open && query ? <button className="searchable-select-clear" type="button" aria-label="Clear search" onClick={() => setQuery("")}><X /></button> : null}
        <button
          className="searchable-select-toggle"
          type="button"
          disabled={disabled}
          aria-label={open ? "Close options" : "Open options"}
          onClick={() => {
            setOpen((current) => !current);
            setQuery("");
          }}
        >
          <ChevronDown />
        </button>
      </div>
      {open ? (
        <div className="searchable-select-popover">
          <div className="searchable-select-options" id={optionsId} role="listbox">
            {filtered.map((option) => (
              <button
                type="button"
                role="option"
                aria-selected={option.value === value}
                className={option.value === value ? "selected" : ""}
                key={option.value}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                  setQuery("");
                }}
              >
                <span>{option.label}</span>
                {option.value === value ? <Check /> : null}
              </button>
            ))}
            {!filtered.length ? <p>{emptyMessage}</p> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
