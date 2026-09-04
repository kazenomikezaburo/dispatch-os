import { AdminFeedback } from "@/components/admin/admin-state";

export function ShiftFormError({ message }: { message?: string }) {
  return message ? <AdminFeedback kind="error" message={message} /> : null;
}
