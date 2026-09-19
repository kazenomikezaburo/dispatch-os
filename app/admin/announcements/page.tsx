import Link from "next/link";
import { Megaphone, Plus } from "lucide-react";
import { AnnouncementFilters } from "@/components/admin/announcements/announcement-filters";
import { AnnouncementList } from "@/components/admin/announcements/announcement-list";
import { CommunicationWorkspaceHeader } from "@/components/admin/communication/communication-workspace-header";
import { AdminPage } from "@/components/admin/admin-page";
import { AdminEmptyState, AdminErrorState, adminStateActionClass } from "@/components/admin/admin-state";
import { getAdminAnnouncements } from "@/lib/admin/announcements/get-announcements";
import { ANNOUNCEMENT_PAGE_SIZE, announcementListHref, parseAnnouncementQuery } from "@/lib/admin/announcements/announcement-query";

export default async function AnnouncementsPage({ searchParams }: PageProps<"/admin/announcements">) {
  const query = parseAnnouncementQuery(await searchParams);
  const result = await getAdminAnnouncements(query);
  const emptyTitle = query.state === "draft" ? "下書きはありません" : query.state === "published" ? "公開中のお知らせはありません" : query.state === "archived" ? "アーカイブ済みのお知らせはありません" : "お知らせがありません";
  const last = result.ok ? result.items.at(-1) : undefined;
  const cursor = last ? { cursorAt: last.publishedAt ?? last.createdAt, cursorId: last.id } : undefined;

  return (
    <AdminPage>
      <CommunicationWorkspaceHeader />
      <section aria-labelledby="announcements-title" className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div><h2 id="announcements-title" className="text-xl font-semibold text-foreground">お知らせ一覧</h2><p className="mt-1 text-sm text-foreground-muted">Workerへ公開するお知らせの下書き・公開・アーカイブを管理します。</p></div>
          <Link href="/admin/announcements/new" className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-control bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"><Plus aria-hidden className="size-4" />お知らせを作成</Link>
        </div>
        <AnnouncementFilters query={query} />
        {!result.ok ? <AdminErrorState title="お知らせ一覧を取得できませんでした。"><Link href={announcementListHref(query)} className={adminStateActionClass}>再読み込み</Link></AdminErrorState> : result.items.length === 0 ? <AdminEmptyState title={emptyTitle} description={query.cursorAt ? "前の一覧へ戻って選び直してください。" : "新しい下書きを作成すると、ここに表示されます。"}>{query.cursorAt ? <Link href={announcementListHref({ ...query, cursorAt: null, cursorId: null })} className={adminStateActionClass}>最初の一覧へ</Link> : <Link href="/admin/announcements/new" className={adminStateActionClass}><Megaphone aria-hidden className="size-4" />お知らせを作成</Link>}</AdminEmptyState> : <><p className="text-sm text-foreground-muted">最大{ANNOUNCEMENT_PAGE_SIZE}件ずつ表示</p><AnnouncementList items={result.items} /><nav aria-label="お知らせページ" className="flex flex-wrap items-center justify-between gap-3">{query.cursorAt ? <Link href={announcementListHref({ ...query, cursorAt: null, cursorId: null })} className={adminStateActionClass}>最初へ戻る</Link> : <span />}{result.hasNext && cursor ? <Link href={announcementListHref(query, cursor)} className={adminStateActionClass}>次の{ANNOUNCEMENT_PAGE_SIZE}件</Link> : <span className="text-sm text-foreground-muted">最後のページです</span>}</nav></>}
      </section>
    </AdminPage>
  );
}
