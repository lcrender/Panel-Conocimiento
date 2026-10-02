import Link from "next/link";
import type { ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

export function buttonClass(variant: ButtonVariant = "primary", size: "md" | "sm" = "md") {
  const sizes = size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-2 text-sm";
  const variants: Record<ButtonVariant, string> = {
    primary: "bg-accent text-white hover:bg-accent-strong",
    secondary: "bg-white text-ink ring-1 ring-line hover:bg-stone-50",
    ghost: "text-ink hover:bg-black/5",
    danger: "bg-white text-danger ring-1 ring-red-200 hover:bg-red-50",
  };
  return `inline-flex items-center justify-center rounded-lg font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${sizes} ${variants[variant]}`;
}

export function ButtonLink({
  href,
  children,
  variant = "primary",
  size = "md",
}: {
  href: string;
  children: ReactNode;
  variant?: ButtonVariant;
  size?: "md" | "sm";
}) {
  return (
    <Link href={href} className={buttonClass(variant, size)}>
      {children}
    </Link>
  );
}

export const controlClass =
  "w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20";

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-ink">{label}</span>
      <div className="mt-1.5">{children}</div>
      {hint ? <span className="mt-1.5 block text-xs leading-5 text-muted">{hint}</span> : null}
    </label>
  );
}

export function Alert({
  tone = "danger",
  children,
}: {
  tone?: "danger" | "ok" | "info";
  children: ReactNode;
}) {
  const tones = {
    danger: "bg-red-50 text-red-900 ring-red-200",
    ok: "bg-emerald-50 text-emerald-900 ring-emerald-200",
    info: "bg-teal-50 text-teal-950 ring-teal-200",
  };
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={`rounded-lg px-3 py-2 text-sm ring-1 ${tones[tone]}`}>
      {children}
    </div>
  );
}

export function Badge({
  tone = "muted",
  children,
}: {
  tone?: "ok" | "muted" | "warning" | "danger";
  children: ReactNode;
}) {
  const tones = {
    ok: "bg-emerald-50 text-emerald-800 ring-emerald-200",
    muted: "bg-stone-100 text-stone-600 ring-stone-200",
    warning: "bg-amber-50 text-amber-900 ring-amber-200",
    danger: "bg-red-50 text-red-800 ring-red-200",
  };
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${tones[tone]}`}>{children}</span>;
}

export function StatusBadge({ status }: { status: "active" | "inactive" | boolean }) {
  const active = status === true || status === "active";
  return <Badge tone={active ? "ok" : "muted"}>{active ? "Activo" : "Inactivo"}</Badge>;
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
        {description ? <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="rounded-2xl bg-surface px-6 py-12 text-center ring-1 ring-line">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">{body}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl bg-surface p-4 ring-1 ring-line sm:p-5 ${className}`}>{children}</div>;
}

export function DataTable({
  columns,
  rows,
  empty,
}: {
  columns: string[];
  rows: { id: string; cells: ReactNode[] }[];
  empty: string;
}) {
  if (rows.length === 0) return <EmptyState title="Sin resultados" body={empty} />;
  return (
    <div className="overflow-x-auto rounded-2xl bg-surface ring-1 ring-line">
      <table className="min-w-full border-collapse text-left text-sm">
        <thead className="border-b border-line text-xs uppercase tracking-wide text-muted">
          <tr>
            {columns.map((column) => (
              <th key={column} className="px-3 py-3 font-medium">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-line last:border-0">
              {row.cells.map((cell, index) => (
                <td key={`${row.id}-${index}`} className="px-3 py-3 align-middle text-ink">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
