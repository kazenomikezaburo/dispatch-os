"use server";

import { revalidatePath } from "next/cache";
import { requireWorker } from "@/lib/auth/require-worker";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createClient } from "@/lib/supabase/server";
import { createOperationalIncidentSchema, retractOperationalIncidentSchema, type CreateOperationalIncidentInput, type RetractOperationalIncidentInput } from "@/lib/worker/incidents/operational-incident-schema";
import { workerIncidentError } from "@/lib/worker/incidents/worker-incident-ui";
import { adminIncidentTransitionSchema, type AdminIncidentTransitionInput } from "@/lib/admin/incidents/incident-action-schema";

export type OperationalIncidentActionResult = { ok: true } | { ok: false; message: string; refresh: boolean };
type RpcResult = { ok?: boolean; code?: string };

function adminIncidentError(code: string | undefined) {
  if (code === "VERSION_CONFLICT" || code === "STATE_CONFLICT") return { message: "ヘルプリクエストの状態が更新されました。最新の状態を表示します。", refresh: true };
  if (code === "NOT_FOUND" || code === "FORBIDDEN") return { message: "このヘルプリクエストを操作できません。", refresh: true };
  if (code === "INVALID_INPUT" || code === "IDEMPOTENCY_CONFLICT") return { message: "操作を完了できませんでした。内容を確認して再度お試しください。", refresh: false };
  return { message: "操作を完了できませんでした。時間をおいて再度お試しください。", refresh: false };
}

async function transitionAdminIncident(command: "acknowledge" | "resolve", input: AdminIncidentTransitionInput): Promise<OperationalIncidentActionResult> {
  const parsed=adminIncidentTransitionSchema.safeParse(input);
  if(!parsed.success)return{ok:false,message:"入力内容を確認してください。",refresh:false};
  await requireAdmin();
  try {
    const supabase=await createClient();
    const response=await supabase.rpc(`${command}_operational_incident`,{p_incident_id:parsed.data.incidentId,p_expected_version:parsed.data.expectedVersion,p_idempotency_key:parsed.data.idempotencyKey});
    if(response.error)throw response.error;
    const result=response.data as RpcResult;
    if(!result.ok)return{ok:false,...adminIncidentError(result.code)};
    revalidatePath("/admin/incidents"); revalidatePath("/admin/day-of"); revalidatePath("/worker");
    return{ok:true};
  } catch(error:unknown){console.error(`Failed to ${command} operational incident`,error);return{ok:false,...adminIncidentError(undefined)};}
}

export async function acknowledgeOperationalIncident(input:AdminIncidentTransitionInput){return transitionAdminIncident("acknowledge",input);}
export async function resolveOperationalIncident(input:AdminIncidentTransitionInput){return transitionAdminIncident("resolve",input);}

export async function createOperationalIncident(input: CreateOperationalIncidentInput): Promise<OperationalIncidentActionResult> {
  const parsed = createOperationalIncidentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "入力内容を確認してください。", refresh: false };
  await requireWorker();
  try {
    const supabase = await createClient();
    const response = await supabase.rpc("create_operational_incident", {
      p_assignment_id: parsed.data.assignmentId,
      p_category: parsed.data.category,
      p_message: parsed.data.message,
      p_idempotency_key: parsed.data.idempotencyKey,
    });
    if (response.error) throw response.error;
    const result = response.data as RpcResult;
    if (!result.ok) return { ok: false, ...workerIncidentError(result.code, "create") };
    revalidatePath("/worker");
    revalidatePath(`/worker/assignments/${parsed.data.assignmentId}`);
    return { ok: true };
  } catch (error: unknown) {
    console.error("Failed to create operational incident", error);
    return { ok: false, ...workerIncidentError(undefined, "create") };
  }
}

export async function retractOperationalIncident(input: RetractOperationalIncidentInput): Promise<OperationalIncidentActionResult> {
  const parsed = retractOperationalIncidentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "入力内容を確認してください。", refresh: false };
  await requireWorker();
  try {
    const supabase = await createClient();
    const response = await supabase.rpc("retract_operational_incident", {
      p_incident_id: parsed.data.incidentId,
      p_expected_version: parsed.data.expectedVersion,
      p_idempotency_key: parsed.data.idempotencyKey,
    });
    if (response.error) throw response.error;
    const result = response.data as RpcResult;
    if (!result.ok) return { ok: false, ...workerIncidentError(result.code, "retract") };
    revalidatePath("/worker");
    revalidatePath(`/worker/assignments/${parsed.data.assignmentId}`);
    return { ok: true };
  } catch (error: unknown) {
    console.error("Failed to retract operational incident", error);
    return { ok: false, ...workerIncidentError(undefined, "retract") };
  }
}
