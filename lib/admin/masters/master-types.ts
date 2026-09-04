export type MasterQuery = { q: string; status: "all" | "active" | "inactive"; page: number };
export type BranchOption = { id: string; name: string };
export type ClientItem = { id:string;branchId:string;name:string;note:string|null;isActive:boolean;createdAt:string;updatedAt:string;projectCount:number };
export type WorkplaceItem = { id:string;branchId:string;name:string;postalCode:string|null;address:string;defaultTransportNote:string|null;accessNote:string|null;meetingNote:string|null;isActive:boolean;createdAt:string;updatedAt:string;jobCount:number };
export type MasterResult<T> = {ok:true;items:T[];total:number;active:number;branches:BranchOption[]}|{ok:false};
export type MasterActionResult = {ok:true;type:"created"|"updated"|"no_change";id:string;updatedAt:string}|{ok:false;type:"validation"|"forbidden"|"conflict"|"not_found"|"error";message:string;fieldErrors?:Record<string,string>};
