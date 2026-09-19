import { Archive, CircleDot, FilePenLine } from "lucide-react";
import type { AnnouncementState } from "@/lib/admin/announcements/announcement-types";
import { AdminStatusBadge, type AdminVisualTone } from "@/components/admin/admin-visual-primitives";

const config: Record<AnnouncementState, { label: string; tone: AdminVisualTone; Icon: typeof Archive }> = {draft:{label:"下書き",tone:"neutral",Icon:FilePenLine},published:{label:"公開中",tone:"success",Icon:CircleDot},archived:{label:"アーカイブ",tone:"neutral",Icon:Archive}};
export function AnnouncementStatusBadge({state}:{state:AnnouncementState}){const {label,tone,Icon}=config[state];return <AdminStatusBadge tone={tone} icon={<Icon aria-hidden className="size-3.5"/>}>{label}</AdminStatusBadge>;}
