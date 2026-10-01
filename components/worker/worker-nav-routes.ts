export type WorkerNavKey = "home" | "recruitment" | "shifts" | "support" | "mypage";

function isRoute(pathname: string, route: string) {
  return pathname === route || pathname.startsWith(`${route}/`);
}

export function getWorkerActiveNav(pathname: string): WorkerNavKey | null {
  if (isRoute(pathname, "/worker/notifications")) return null;
  if (pathname === "/worker") return "home";
  if (isRoute(pathname, "/worker/recruitment")) return "recruitment";
  if (isRoute(pathname, "/worker/shifts") || isRoute(pathname, "/worker/assignments")) return "shifts";
  if (isRoute(pathname, "/worker/support") || isRoute(pathname, "/worker/announcements")) return "support";
  if (isRoute(pathname, "/worker/mypage") || pathname === "/worker/availability" || pathname === "/worker/settings/line") return "mypage";
  return null;
}
