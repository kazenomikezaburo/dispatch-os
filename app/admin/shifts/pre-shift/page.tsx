import { PreShiftScreen } from "@/app/admin/pre-shift/page";

export default async function CanonicalPreShiftPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <PreShiftScreen searchParams={props.searchParams} basePath="/admin/shifts/pre-shift" />;
}
