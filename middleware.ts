import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const hostname = request.headers.get("host") || "";

  if (hostname.includes("yourhq")) {
    if (request.nextUrl.pathname === "/") {
      return NextResponse.rewrite(new URL("/hq", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/"],
};