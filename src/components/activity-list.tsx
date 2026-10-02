import Link from "next/link";
import { actionLabel, entityHref } from "@/domain/labels";
import type { ActivityRecord } from "@/lib/data/activity";
import { formatDate } from "@/lib/format";

export function ActivityList({
  items,
  empty = "Todavía no hay actividad en este proyecto.",
}: {
  items: ActivityRecord[];
  empty?: string;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-muted">{empty}</p>;
  }

  return (
    <ul className="divide-y divide-line">
      {items.map((item) => {
        const href = entityHref(item.entityType, item.entityId);
        return (
          <li key={item.id} className="py-3 text-sm">
            <p>
              <span className="font-medium">{item.actorName}</span> {actionLabel(item.action)}
              {item.label ? <span className="text-muted"> · {item.label}</span> : null}
              {item.role ? <span className="text-muted"> · {item.role}</span> : null}
            </p>
            <p className="mt-1 text-xs text-muted">
              {formatDate(item.createdAt)}
              {href ? (
                <>
                  {" · "}
                  <Link href={href} className="text-accent hover:underline">
                    Ver registro
                  </Link>
                </>
              ) : null}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
