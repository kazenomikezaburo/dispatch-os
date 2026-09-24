import type { QualificationExpiryPolicy, QualificationMasterItem, SkillMasterItem } from "@/lib/admin/workers/worker-types";

export type { QualificationExpiryPolicy, QualificationMasterItem, SkillMasterItem };
export type StaffCredentialMasterData={skills:SkillMasterItem[];qualifications:QualificationMasterItem[];canEdit:boolean};
export type CredentialActionResult={ok:true}|{ok:false;type:"validation"|"forbidden"|"error";message:string;fieldErrors?:Record<string,string>};
