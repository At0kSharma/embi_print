// HTTP Basic Auth gate on /admin/*. We accept the same credentials as
// the backend so a single login covers both the page UI and the API
// calls the page makes (the page forwards the same Authorization header
// it received). In production set ADMIN_USER + ADMIN_PASSWORD as
// platform env vars (Railway/DO).

import { NextResponse, type NextRequest } from "next/server";

export const config = {
  matcher: ["/admin/:path*"],
};

export function middleware(req: NextRequest) {
  const expectedUser = process.env.ADMIN_USER;
  const expectedPass = process.env.ADMIN_PASSWORD;

  if (!expectedUser || !expectedPass) {
    return new NextResponse(
      "Admin auth is not configured. Set ADMIN_USER + ADMIN_PASSWORD.",
      { status: 503 },
    );
  }

  const auth = req.headers.get("authorization") ?? "";
  if (auth.startsWith("Basic ")) {
    const decoded = atob(auth.slice("Basic ".length));
    const [user, ...rest] = decoded.split(":");
    const pass = rest.join(":");
    if (user === expectedUser && pass === expectedPass) {
      // Pass auth header through to server components / route handlers
      // via a custom header so they can re-use it for backend calls.
      const res = NextResponse.next();
      res.headers.set("x-admin-auth", auth);
      return res;
    }
  }

  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="embi_print admin"' },
  });
}
