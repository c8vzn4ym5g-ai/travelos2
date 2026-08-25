import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { TRAVELOS_PATHNAME_HEADER } from "@/lib/travelpayouts-drive";

export function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(TRAVELOS_PATHNAME_HEADER, request.nextUrl.pathname);
  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
