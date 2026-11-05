export { auth as proxy } from "@/auth";

export const config = {
  // Everything requires a session except auth routes, the cron endpoint (Bearer CRON_SECRET),
  // the sign-in and privacy pages, and static assets.
  matcher: ["/((?!api/auth|api/cron|signin|privacy|_next/static|_next/image|icon.svg).*)"],
};
