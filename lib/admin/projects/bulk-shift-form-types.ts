import type { BulkShiftFormValues } from "./bulk-shift-form-schema";

export type BulkShiftCreateResult = {
  ok: false;
  message?: string;
  fieldErrors?: Partial<Record<keyof BulkShiftFormValues, string>>;
};
