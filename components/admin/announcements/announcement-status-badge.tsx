import { Archive, CircleDot, FilePenLine } from "lucide-react";
import type { AnnouncementState } from "@/lib/admin/announcements/announcement-types";

const config={draft:{label:"下書き",className:"bg-surface-muted text-foreground-secondary",Icon:FilePenLine},published:{label:"公開中",className:"bg-success-subtle text-success-foreground",Icon:CircleDot},archived:{label:"アーカイブ",className:"bg-surface-muted text-foreground-secondary",Icon:Archive}} as const;
export function AnnouncementStatusBadge({state}:{state:AnnouncementState}){const {label,className,Icon}=config[state];return <span className={`inline-flex items-center gap-1.5 rounded-ds-pill px-2.5 py-1 text-xs font-semibold ${className}`}><Icon aria-hidden className="size-3.5"/>{label}</span>;}

