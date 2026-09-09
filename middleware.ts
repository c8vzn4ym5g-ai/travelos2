import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { canonicalSiteUrl, isSpareVercelHost } from "@/lib/site-url";
import { TRAVELOS_PATHNAME_HEADER } from "@/lib/travelpayouts-drive";

export function middleware(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  if (isSpareVercelHost(host)) {
    return NextResponse.redirect(
      canonicalSiteUrl(`${request.nextUrl.pathname}${request.nextUrl.search}`),
      308,
    );
  }

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
