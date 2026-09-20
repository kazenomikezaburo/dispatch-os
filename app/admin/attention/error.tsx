"use client";

import { useEffect } from "react";
import { AdminErrorState } from "@/components/admin/admin-state";
import { AdminPage } from "@/components/admin/admin-page";
import { AdminPageHeader } from "@/components/admin/admin-page-header";

export default function ErrorPage({error,reset}:{error:Error&{digest?:string};reset:()=>void}){useEffect(()=>{console.error(error);},[error]);return <AdminPage><AdminPageHeader title="要対応"/><AdminErrorState title="要対応を表示できませんでした。"><button type="button" onClick={reset} className="min-h-11 rounded-control bg-primary px-4 text-sm font-semibold text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring">再試行</button></AdminErrorState></AdminPage>;}
