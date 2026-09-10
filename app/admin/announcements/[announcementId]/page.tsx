import Link from "next/link";
import { AdminBreadcrumb } from "@/components/admin/admin-breadcrumb";
import { AdminPage } from "@/components/admin/admin-page";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminErrorState,AdminNotFoundState,adminStateActionClass } from "@/components/admin/admin-state";
import { AnnouncementDetail } from "@/components/admin/announcements/announcement-detail";
import { AnnouncementForm } from "@/components/admin/announcements/announcement-form";
import { announcementIdSchema } from "@/lib/admin/announcements/announcement-schema";
import { getAdminAnnouncement,getAnnouncementActor } from "@/lib/admin/announcements/get-announcements";

export default async function AnnouncementDetailPage({params,searchParams}:{params:Promise<{announcementId:string}>;searchParams:Promise<Record<string,string|string[]|undefined>>}){const{id}= {id:(await params).announcementId};const query=await searchParams;if(!announcementIdSchema.safeParse(id).success)return <SafeNotFound/>;const[detail,actor]=await Promise.all([getAdminAnnouncement(id),getAnnouncementActor()]);if(!detail.ok)return detail.reason==="not_found"?<SafeNotFound/>:<AdminPage><AdminErrorState title="お知らせを取得できませんでした。"><Link href="/admin/announcements" className={adminStateActionClass}>一覧へ戻る</Link></AdminErrorState></AdminPage>;if(!actor.ok)return <AdminPage><AdminErrorState title="操作情報を取得できませんでした。"/></AdminPage>;const editing=(Array.isArray(query.edit)?query.edit[0]:query.edit)==="1"&&detail.announcement.state==="draft";return <AdminPage width={editing?"form-wide":"default"}><AdminBreadcrumb items={[{label:"お知らせ",href:"/admin/announcements"},{label:detail.announcement.title||"無題のお知らせ"}]}/>{editing?<><AdminPageHeader title="下書きを編集" description="公開前の内容と対象を編集できます。"/><AnnouncementForm actor={actor.actor} announcement={detail.announcement}/></>:<AnnouncementDetail actor={actor.actor} announcement={detail.announcement}/>}</AdminPage>;}
function SafeNotFound(){return <AdminPage><AdminNotFoundState><Link href="/admin/announcements" className={adminStateActionClass}>お知らせ一覧へ戻る</Link></AdminNotFoundState></AdminPage>;}
