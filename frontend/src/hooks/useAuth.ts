"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useCallback } from "react";

/**
 * Custom authentication hook
 * Provides easy access to session data and authentication methods
 */
export function useAuth() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const isLoading = status === "loading";
  const isAuthenticated = status === "authenticated";
  const isUnauthenticated = status === "unauthenticated";

  /**
   * Sign in with email and password
   */
  const loginWithCredentials = useCallback(
    async (email: string, password: string, redirectTo?: string) => {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        throw new Error(result.error);
      }

      if (redirectTo) {
        router.push(redirectTo);
        router.refresh();
      }

      return result;
    },
    [router]
  );

  /**
   * Sign in with Microsoft OAuth
   */
  const loginWithMicrosoft = useCallback(
    async (callbackUrl: string = "/dashboard") => {
      await signIn("azure-ad", {
        callbackUrl,
      });
    },
    []
  );

  /**
   * Sign in with passkey
   */
  const loginWithPasskey = useCallback(
    async (email: string, response: string, redirectTo?: string) => {
      const result = await signIn("passkey", {
        email,
        response,
        redirect: false,
      });

      if (result?.error) {
        throw new Error(result.error);
      }

      if (redirectTo) {
        router.push(redirectTo);
        router.refresh();
      }

      return result;
    },
    [router]
  );

  /**
   * Sign out
   */
  const logout = useCallback(async (callbackUrl: string = "/signin") => {
    await signOut({ callbackUrl });
  }, []);

  /**
   * Get access token from session
   */
  const getAccessToken = useCallback(() => {
    return session?.accessToken;
  }, [session]);

  /**
   * Get user from session
   */
  const getUser = useCallback(() => {
    return session?.user;
  }, [session]);

  /**
   * Check if user has a specific role or permission
   */
  const hasPermission = useCallback((_permission: string) => {
    // Implement your permission logic here
    // This is a placeholder
    return true;
  }, []);

  /**
   * Redirect to sign in page
   */
  const redirectToSignIn = useCallback(
    (callbackUrl?: string) => {
      const url = callbackUrl
        ? `/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`
        : "/signin";
      router.push(url);
    },
    [router]
  );

  return {
    // Session data
    session,
    user: session?.user,
    accessToken: session?.accessToken,
    provider: session?.provider,

    // Status flags
    isLoading,
    isAuthenticated,
    isUnauthenticated,

    // Authentication methods
    loginWithCredentials,
    loginWithMicrosoft,
    loginWithPasskey,
    logout,

    // Utility methods
    getAccessToken,
    getUser,
    hasPermission,
    redirectToSignIn,
  };
}
