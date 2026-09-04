"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { createClient } from "@/lib/supabase/server";

const status = z.enum(["active", "inactive", "suspended"]);
const base = z.object({ displayName:z.string().trim().min(1,"氏名を入力してください。").max(100), status });
const createSchema=base.extend({staffCode:z.string().trim().min(1,"スタッフIDを入力してください。").max(50),branchId:z.string().uuid()});
const updateSchema=base.extend({id:z.string().uuid(),expectedUpdatedAt:z.string().datetime()});
export type WorkerActionResult={ok:true;id:string}|{ok:false;type:"validation"|"forbidden"|"conflict"|"not_found"|"error";message:string;fieldErrors?:Record<string,string>};
const errors=(issues:z.core.$ZodIssue[])=>Object.fromEntries(issues.map(issue=>[String(issue.path[0]??"form"),issue.message]));

async function systemAdmin(){const auth=await getCurrentProfile();return auth.status==="authenticated"&&auth.profile.account_type==="system_admin";}

export async function createWorker(input:unknown):Promise<WorkerActionResult>{
  const parsed=createSchema.safeParse(input);if(!parsed.success)return{ok:false,type:"validation",message:"入力内容を確認してください。",fieldErrors:errors(parsed.error.issues)};
  if(!await systemAdmin())return{ok:false,type:"forbidden",message:"スタッフの登録はSystem Adminのみ実行できます。"};
  try{const supabase=await createClient();const branch=await supabase.from("branches").select("id").eq("id",parsed.data.branchId).maybeSingle();if(branch.error||!branch.data)return{ok:false,type:"forbidden",message:"指定した支店を利用できません。"};const result=await supabase.from("workers").insert({staff_code:parsed.data.staffCode,branch_id:branch.data.id,display_name:parsed.data.displayName,status:parsed.data.status,auth_profile_id:null}).select("id").single();if(result.error){if(result.error.code==="23505")return{ok:false,type:"validation",message:"入力内容を確認してください。",fieldErrors:{staffCode:"このスタッフIDは使用済みです。"}};throw result.error;}revalidatePath("/admin/workers");return{ok:true,id:result.data.id};}catch(error){console.error("Failed to create worker",error);return{ok:false,type:"error",message:"スタッフを登録できませんでした。"};}
}

export async function updateWorker(input:unknown):Promise<WorkerActionResult>{
  const parsed=updateSchema.safeParse(input);if(!parsed.success)return{ok:false,type:"validation",message:"入力内容を確認してください。",fieldErrors:errors(parsed.error.issues)};
  if(!await systemAdmin())return{ok:false,type:"forbidden",message:"スタッフの編集はSystem Adminのみ実行できます。"};
  try{const supabase=await createClient();const current=await supabase.from("workers").select("id,updated_at").eq("id",parsed.data.id).maybeSingle();if(current.error)throw current.error;if(!current.data)return{ok:false,type:"not_found",message:"対象のスタッフが見つかりません。"};if(current.data.updated_at!==parsed.data.expectedUpdatedAt)return{ok:false,type:"conflict",message:"他の操作で更新されています。再読み込みしてください。"};const result=await supabase.from("workers").update({display_name:parsed.data.displayName,status:parsed.data.status}).eq("id",parsed.data.id).eq("updated_at",parsed.data.expectedUpdatedAt).select("id");if(result.error)throw result.error;if(result.data.length!==1)return{ok:false,type:"conflict",message:"他の操作で更新されています。再読み込みしてください。"};revalidatePath("/admin/workers");revalidatePath(`/admin/workers/${parsed.data.id}`);return{ok:true,id:parsed.data.id};}catch(error){console.error("Failed to update worker",error);return{ok:false,type:"error",message:"スタッフを更新できませんでした。"};}
}
