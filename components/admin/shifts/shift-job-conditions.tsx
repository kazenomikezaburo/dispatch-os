import { safeHttpUrl } from "@/lib/admin/shifts/shift-detail-rules";
import type { AdminShiftDetail } from "@/lib/admin/shifts/shift-detail-types";
import { Item, Section } from "./shift-info-section";

export function ShiftJobConditions({ detail }: { detail: AdminShiftDetail }) {
  const job = detail.job;
  const manualUrl = safeHttpUrl(job.manualUrl);
  return <Section title="業務条件"><dl className="grid gap-5 sm:grid-cols-2"><Item label="時給">{job.hourlyWage === null ? "未設定" : `${job.hourlyWage.toLocaleString("ja-JP")}円`}</Item><Item label="交通費">{job.transportationFeeCap === null ? "未設定" : `上限${job.transportationFeeCap.toLocaleString("ja-JP")}円`}</Item>{job.description && <Item label="仕事内容">{job.description}</Item>}{job.dressCode && <Item label="服装">{job.dressCode}</Item>}{job.requirements && <Item label="応募条件">{job.requirements}</Item>}{job.mealNotes && <Item label="食事案内">{job.mealNotes}</Item>}{job.recruitmentNotes && <Item label="募集補足">{job.recruitmentNotes}</Item>}{manualUrl && <Item label="業務資料"><a href={manualUrl} target="_blank" rel="noreferrer" className="font-semibold text-blue-700 underline underline-offset-2 hover:text-blue-900">業務資料を開く</a></Item>}</dl></Section>;
}
