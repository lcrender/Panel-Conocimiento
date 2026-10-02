"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import type { ProjectAccess } from "@/domain/access";
import type { NavItem } from "@/domain/navigation";
import { signOut } from "@/server/actions/auth";
import { setActiveProject } from "@/server/actions/context";
import { controlClass } from "@/components/ui/primitives";

type ShellUser = { fullName: string; email: string };

const GROUPS = [
  { id: "operacion" as const, label: "Operación" },
  { id: "administracion" as const, label: "Administración" },
];

export function AppShell({
  children,
  items,
  user,
  project,
  projects,
}: {
  children: ReactNode;
  items: NavItem[];
  user: ShellUser;
  project: ProjectAccess | null;
  projects: ProjectAccess[];
}) {
  const pathname = usePathname();
  const [openPath, setOpenPath] = useState<string | null>(null);
  const open = openPath === pathname;

  return (
    <div className="min-h-screen bg-background text-ink">
      {open ? (
        <button
          type="button"
          aria-label="Cerrar menú"
          className="fixed inset-0 z-30 bg-ink/40 lg:hidden"
          onClick={() => setOpenPath(null)}
        />
      ) : null}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-sidebar text-white transition-transform lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="border-b border-white/10 px-5 py-5">
          <p className="text-xs uppercase tracking-[0.16em] text-sidebar-muted">Base de conocimiento</p>
          <p className="mt-1 text-lg font-semibold">Panel de agentes</p>
        </div>
        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
          {GROUPS.map((group) => {
            const links = items.filter((item) => item.group === group.id);
            if (links.length === 0) return null;
            return (
              <div key={group.id}>
                <p className="px-3 text-[11px] font-medium uppercase tracking-[0.14em] text-sidebar-muted">{group.label}</p>
                <ul className="mt-2 space-y-1">
                  {links.map((item) => {
                    const active = item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(`${item.href}/`);
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          aria-current={active ? "page" : undefined}
                          className={`block rounded-lg px-3 py-2 text-sm ${
                            active ? "bg-sidebar-active text-white" : "text-sidebar-muted hover:bg-white/5 hover:text-white"
                          }`}
                        >
                          {item.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </nav>
        <div className="border-t border-white/10 px-4 py-4">
          <p className="truncate text-sm font-medium">{user.fullName || user.email}</p>
          <p className="truncate text-xs text-sidebar-muted">{user.email}</p>
          <form action={signOut} className="mt-3">
            <button type="submit" className="text-sm text-sidebar-muted hover:text-white">
              Cerrar sesión
            </button>
          </form>
        </div>
      </aside>
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-line bg-background/95 px-4 py-3 backdrop-blur sm:px-6">
          <button
            type="button"
            className="rounded-lg px-2 py-1 text-sm ring-1 ring-line lg:hidden"
            onClick={() => setOpenPath(pathname)}
          >
            Menú
          </button>
          <div className="min-w-0 flex-1">
            {projects.length > 1 ? (
              <ProjectSwitcher projects={projects} activeId={project?.id ?? projects[0].id} />
            ) : project ? (
              <p className="truncate text-sm">
                <span className="text-muted">{project.clientName}</span>
                <span className="mx-2 text-line">/</span>
                <span className="font-medium">{project.name}</span>
                {project.status === "inactive" ? <span className="ml-2 text-xs text-muted">Inactivo</span> : null}
              </p>
            ) : (
              <p className="text-sm text-muted">Sin proyecto activo</p>
            )}
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

function ProjectSwitcher({ projects, activeId }: { projects: ProjectAccess[]; activeId: string }) {
  const pathname = usePathname();
  const groups = new Map<string, { name: string; projects: ProjectAccess[] }>();
  for (const item of projects) {
    const group = groups.get(item.clientId) ?? { name: item.clientName, projects: [] };
    group.projects.push(item);
    groups.set(item.clientId, group);
  }

  return (
    <form action={setActiveProject} className="flex max-w-xl items-center gap-2">
      <label htmlFor="projectId" className="sr-only">
        Proyecto activo
      </label>
      <select
        id="projectId"
        name="projectId"
        defaultValue={activeId}
        className={`${controlClass} max-w-md`}
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
      >
        {[...groups.values()].map((group) => (
          <optgroup key={group.name} label={group.name}>
            {group.projects.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
                {item.status === "inactive" ? " (inactivo)" : ""}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      <input type="hidden" name="next" value={pathname} />
      <button type="submit" className="sr-only">
        Cambiar proyecto
      </button>
    </form>
  );
}
