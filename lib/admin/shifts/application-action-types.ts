export type ApplicationActionResult =
  | { ok: true }
  | { ok: false; message: string };
