import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Define public routes that don't require authentication
const publicRoutes = [
  "/",
  "/signin",
  "/signup",
  "/forgot-password",
  "/verify-otp",
];

// Define auth routes that authenticated users shouldn't access
const authRoutes = ["/signin", "/signup", "/forgot-password"];

// Define routes that require email verification
const protectedRoutes = ["/dashboard", "/pipeline", "/kanban-example"];

// Define routes that require email verification but should not redirect to verify-otp
const emailVerificationRequiredRoutes = [
  "/dashboard",
  "/pipeline",
  "/kanban-example",
];

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Get the session
  const session = await auth();

  // Check if the current route is public
  const isPublicRoute = publicRoutes.some((route) =>
    pathname.startsWith(route)
  );

  // Check if the current route is an auth route
  const isAuthRoute = authRoutes.some((route) => pathname.startsWith(route));

  // Check if the current route requires email verification
  const _isProtectedRoute = protectedRoutes.some((route) =>
    pathname.startsWith(route)
  );

  // If user is authenticated and trying to access auth routes, redirect to dashboard
  if (session && isAuthRoute) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // If user is not authenticated and trying to access protected routes, redirect to signin
  if (!session && !isPublicRoute) {
    const callbackUrl = encodeURIComponent(pathname);
    return NextResponse.redirect(
      new URL(`/signin?callbackUrl=${callbackUrl}`, request.url)
    );
  }

  // If user is authenticated and trying to access routes that require email verification, check email verification
  const isEmailVerificationRequired = emailVerificationRequiredRoutes.some(
    (route) => pathname.startsWith(route)
  );

  if (session && isEmailVerificationRequired) {
    // Check if we have the API URL configured
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl) {
      console.warn(
        "NEXT_PUBLIC_API_URL not configured, skipping email verification check"
      );
      return NextResponse.next();
    }

    try {
      // Fetch user data from backend to check email verification status
      const response = await fetch(`${apiUrl}/auth/me`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.accessToken}`,
        },
        // Add timeout to prevent hanging requests
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });

      if (response.ok) {
        const data = await response.json();
        const user = data?.user as
          | { emailVerified: boolean; email: string }
          | undefined;

        // If email is not verified, redirect to OTP verification
        if (user && !user.emailVerified) {
          // Store email in a cookie for the OTP page to use
          const response = NextResponse.redirect(
            new URL("/verify-otp", request.url)
          );
          response.cookies.set("verificationEmail", user.email, {
            httpOnly: false,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 60 * 15, // 15 minutes
          });
          return response;
        }
      }
    } catch (error) {
      console.error("Error checking email verification:", error);
      // If there's an error fetching user data, allow access but log the error
      // This prevents blocking users due to temporary API issues
      // In production, you might want to be more strict about this
      if (process.env.NODE_ENV === "development") {
        console.warn(
          "Allowing access despite email verification check failure (development mode)"
        );
      }
    }
  }

  // Allow the request to proceed
  return NextResponse.next();
}

// Configure which routes the middleware should run on
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/auth (auth API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    "/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
