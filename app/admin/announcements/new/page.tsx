import Link from "next/link";
import { AdminBreadcrumb } from "@/components/admin/admin-breadcrumb";
import { AdminPage } from "@/components/admin/admin-page";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminErrorState,adminStateActionClass } from "@/components/admin/admin-state";
import { AnnouncementForm } from "@/components/admin/announcements/announcement-form";
import { getAnnouncementActor } from "@/lib/admin/announcements/get-announcements";

export default async function NewAnnouncementPage(){const result=await getAnnouncementActor();return <AdminPage width="form-wide"><AdminBreadcrumb items={[{label:"お知らせ",href:"/admin/announcements"},{label:"新規作成"}]}/><AdminPageHeader title="お知らせを作成" description="内容と公開対象を設定し、まず下書きとして保存します。"/>{result.ok?<AnnouncementForm actor={result.actor}/>:<AdminErrorState title="作成画面を準備できませんでした。"><Link href="/admin/announcements" className={adminStateActionClass}>一覧へ戻る</Link></AdminErrorState>}</AdminPage>;}

