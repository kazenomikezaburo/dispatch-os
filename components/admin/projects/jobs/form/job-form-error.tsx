import { AdminFeedback } from "@/components/admin/admin-state";

export function JobFormError({ message }: { message?: string }) {
  return message ? <AdminFeedback kind="error" message={message} /> : null;
}
