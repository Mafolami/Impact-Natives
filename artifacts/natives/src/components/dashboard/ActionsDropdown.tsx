import { useState, useRef, useEffect } from "react";
import { Link } from "wouter";
import { MoreHorizontal } from "lucide-react";

export interface DropdownAction {
  label: string;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  destructive?: boolean;
}

export default function ActionsDropdown({ actions }: { actions: DropdownAction[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  if (actions.length === 0) return null;

  return (
    <div className="relative inline-block" ref={ref}>
      <button type="button" onClick={() => setOpen((o) => !o)}
        className="p-1.5 rounded-full hover:bg-muted text-black dark:text-white transition-colors">
        <MoreHorizontal className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute right-0 mt-1 z-30 w-44 rounded-xl border border-border bg-white dark:bg-card shadow-lg py-1">
          {actions.map((a, i) =>
            a.href ? (
              <Link key={i} href={a.href}>
                <span
                  onClick={() => setOpen(false)}
                  className="block px-3 py-2 text-sm text-black dark:text-white hover:bg-muted cursor-pointer whitespace-nowrap"
                >
                  {a.label}
                </span>
              </Link>
            ) : (
              <button key={i} type="button" disabled={a.disabled}
                onClick={() => { setOpen(false); a.onClick?.(); }}
                className={`block w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors disabled:opacity-40 whitespace-nowrap ${
                  a.destructive ? "text-red-600" : "text-black dark:text-white"
                }`}
              >
                {a.label}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}