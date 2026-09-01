import { getCurrentProfile } from "@/lib/auth/get-current-profile";

export type EditActor = {
  id: string;
  accountType: "manager" | "system_admin";
};

export type EditActorResult =
  | { ok: true; actor: EditActor }
  | { ok: false; reason: "forbidden" };

/**
 * Edit Action共通の入口。支店・親子関係・状態の判定は、
 * RLS経由で再取得した行を使って各EntityのUpdate Coreで行う。
 */
export async function getEditActor(): Promise<EditActorResult> {
  const current = await getCurrentProfile();

  if (
    current.status !== "authenticated" ||
    current.profile.account_type === "worker"
  ) {
    return { ok: false, reason: "forbidden" };
  }

  return {
    ok: true,
    actor: {
      id: current.profile.id,
      accountType: current.profile.account_type,
    },
  };
}
