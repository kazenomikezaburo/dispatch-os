import { DayOfScreen } from "@/app/admin/day-of/page";

export default async function CanonicalDayOfPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <DayOfScreen searchParams={props.searchParams} basePath="/admin/shifts/day-of" />;
}
