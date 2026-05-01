import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const COOKIE_NAME = "lng_auth";
const AUTH_SECRET = process.env.AUTH_SECRET ?? "Keijo_Kojootti#64";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow login page and auth API through
  if (pathname === "/login" || pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  const cookie = request.cookies.get(COOKIE_NAME);
  if (cookie?.value === AUTH_SECRET) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("from", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
