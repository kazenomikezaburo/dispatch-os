import Link from "next/link";
import { announcementListHref, type AnnouncementQuery } from "@/lib/admin/announcements/announcement-query";

const options=[{value:"all",label:"すべて"},{value:"draft",label:"下書き"},{value:"published",label:"公開中"},{value:"archived",label:"アーカイブ"}] as const;
export function AnnouncementFilters({query}:{query:AnnouncementQuery}){return <nav aria-label="お知らせの状態" className="flex flex-wrap gap-2 border-b border-border">{options.map(option=><Link key={option.value} href={announcementListHref({...query,state:option.value,cursorAt:null,cursorId:null})} aria-current={query.state===option.value?"page":undefined} className={`inline-flex min-h-11 items-center border-b-2 px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring ${query.state===option.value?"border-link text-link":"border-transparent text-foreground-secondary hover:text-foreground"}`}>{option.label}</Link>)}</nav>;}

