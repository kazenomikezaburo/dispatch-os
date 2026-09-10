import { AlertTriangle } from "lucide-react";

export function WorkerAnnouncementImportance({important}:{important:boolean}){if(!important)return null;return <span className="inline-flex items-center gap-1 rounded-pill bg-warning-subtle px-2.5 py-1 text-xs font-semibold text-warning-foreground"><AlertTriangle aria-hidden className="size-4"/>重要なお知らせ</span>;}
