"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { uuidSchema } from "@/lib/utils/uuid-schema";

const inputSchema=z.object({jobId:uuidSchema,masterId:uuidSchema,kind:z.enum(["skill","qualification"]),operation:z.enum(["add","remove"])});
export type JobRequirementActionResult={ok:true}|{ok:false;type:"validation"|"forbidden"|"unavailable"|"error";message:string};

export async function mutateJobRequirement(input:unknown):Promise<JobRequirementActionResult>{
  const parsed=inputSchema.safeParse(input);if(!parsed.success)return{ok:false,type:"validation",message:"入力内容を確認してください。"};
  const actor=await getCurrentProfile();if(actor.status!=="authenticated"||actor.profile.account_type==="worker")return{ok:false,type:"forbidden",message:"この業務の必須要件を変更できません。"};
  const {jobId,masterId,kind,operation}=parsed.data;
  const fn=kind==="skill"?(operation==="add"?"add_job_skill_requirement":"remove_job_skill_requirement"):(operation==="add"?"add_job_qualification_requirement":"remove_job_qualification_requirement");
  const args=kind==="skill"?{p_job_id:jobId,p_skill_id:masterId}:{p_job_id:jobId,p_qualification_id:masterId};
  try{const supabase=await createClient();const result=await supabase.rpc(fn,args);if(result.error){if(result.error.code==="42501"||result.error.code==="P0002")return{ok:false,type:"unavailable",message:"対象が見つからないか、変更する権限がありません。"};if(result.error.code==="23505")return{ok:false,type:"validation",message:"この必須要件は既に追加されています。"};if(result.error.message.includes("inactive_or_missing"))return{ok:false,type:"validation",message:"無効なマスタは新しく必須要件に追加できません。"};throw result.error;}revalidatePath("/admin/projects");return{ok:true};}catch(error){console.error("Failed to mutate structured Job requirement",error);return{ok:false,type:"error",message:"必須要件を更新できませんでした。"};}
}
