import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import type { QualificationExpiryPolicy, StaffCredentialMasterData } from "./types";

export async function getStaffCredentialMasters():Promise<{ok:true;data:StaffCredentialMasterData}|{ok:false;reason:"forbidden"|"error"}> {
  const actor=await getCurrentProfile();
  if(actor.status!=="authenticated"||actor.profile.account_type!=="system_admin")return{ok:false,reason:"forbidden"};
  try{const supabase=await createClient();const [skills,qualifications]=await Promise.all([supabase.from("skills").select("id,code,name,description,is_active,updated_at").order("name").order("id"),supabase.from("qualifications").select("id,code,name,description,expiry_policy,is_active,updated_at").order("name").order("id")]);if(skills.error||qualifications.error)throw skills.error??qualifications.error;return{ok:true,data:{canEdit:true,skills:(skills.data??[]).map(row=>({id:row.id,code:row.code,name:row.name,description:row.description,isActive:row.is_active,updatedAt:row.updated_at})),qualifications:(qualifications.data??[]).map(row=>({id:row.id,code:row.code,name:row.name,description:row.description,expiryPolicy:row.expiry_policy as QualificationExpiryPolicy,isActive:row.is_active,updatedAt:row.updated_at}))}};}catch(error){console.error("Failed to load Skill and Qualification masters",error);return{ok:false,reason:"error"};}
}
