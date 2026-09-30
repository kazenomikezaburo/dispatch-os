import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { NOTIFICATION_CONTINUATION_COOKIE, TEN_MINUTES_SECONDS } from "@/lib/line/constants";
import { randomOpaque } from "@/lib/line/crypto";
import { createNotificationContinuation } from "@/lib/line/signed-cookie";

const notificationPath = /^\/worker\/notifications\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i;

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !supabasePublishableKey) return response;

  const supabase = createServerClient(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  const claims = await supabase.auth.getClaims();
  const match = notificationPath.exec(request.nextUrl.pathname);
  if (match && !claims.data?.claims?.sub) {
    const secret = process.env.OPSCUE_CONTINUATION_SECRET;
    if (secret && secret.length >= 32) {
      const expiresAt = Date.now() + TEN_MINUTES_SECONDS * 1000;
      const redirectResponse = NextResponse.redirect(new URL("/login", request.url), 303);
      redirectResponse.cookies.set(NOTIFICATION_CONTINUATION_COOKIE, createNotificationContinuation({ notificationId: match[1], nonce: randomOpaque(), expiresAt }, secret), {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: TEN_MINUTES_SECONDS,
      });
      return redirectResponse;
    }
  }
  return response;
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"] };
