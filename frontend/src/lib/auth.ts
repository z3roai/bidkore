import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import type { Provider } from "next-auth/providers";
import Google from "next-auth/providers/google";
import AzureAD from "next-auth/providers/azure-ad";

export const authConfig: NextAuthConfig = {
  providers: [
    // Credentials provider for email/password and token handoff
    Credentials({
      id: "credentials",
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        token: { label: "Token", type: "text" },
      },
      async authorize(credentials) {
        // Direct token handoff (e.g., after OAuth callback from backend)
        if (credentials?.token) {
          try {
            const meResp = await fetch(
              `${process.env.NEXT_PUBLIC_API_URL}/auth/me`,
              {
                method: "GET",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${credentials.token as string}`,
                },
              }
            );

            if (meResp.ok) {
              const meData = await meResp.json();
              const u = meData?.user as
                | {
                    id: string;
                    email: string;
                    firstName?: string | null;
                    lastName?: string | null;
                    name?: string | null;
                    avatar?: string | null;
                    image?: string | null;
                  }
                | undefined;

              if (u?.id && u?.email) {
                const fullName =
                  [u.firstName, u.lastName].filter(Boolean).join(" ") ||
                  u.name ||
                  undefined;

                return {
                  id: u.id,
                  email: u.email,
                  name: fullName,
                  image: u.avatar ?? u.image ?? undefined,
                  emailVerified: (u as { emailVerified?: boolean })
                    .emailVerified,
                  backendToken: credentials.token as string,
                } as unknown as import("next-auth").User;
              }
            }
          } catch (e) {
            console.error("Credentials token authorize error:", e);
          }
        }

        if (!credentials?.email) {
          return null;
        }

        try {
          const response = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/auth/login`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                email: credentials.email,
                password: credentials.password,
              }),
            }
          );

          if (!response.ok) {
            return null;
          }

          const data = await response.json();

          // Expected backend shape: { message, token, user }
          if (data?.token && data?.user) {
            const user = data.user as {
              id: string;
              email: string;
              firstName?: string | null;
              lastName?: string | null;
              name?: string | null;
              avatar?: string | null;
              image?: string | null;
            };

            const fullName =
              [user.firstName, user.lastName].filter(Boolean).join(" ") ||
              user.name ||
              undefined;

            return {
              id: user.id,
              email: user.email,
              name: fullName,
              image: user.avatar ?? user.image ?? undefined,
              emailVerified: (user as { emailVerified?: boolean })
                .emailVerified,
              backendToken: data.token,
            } as unknown as import("next-auth").User;
          }

          // Fallback: if backend returns only a token, fetch user via /auth/me
          if (data?.token && !data?.user) {
            try {
              const meResp = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL}/auth/me`,
                {
                  method: "GET",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${data.token}`,
                  },
                }
              );

              if (meResp.ok) {
                const meData = await meResp.json();
                const u = meData?.user as
                  | {
                      id: string;
                      email: string;
                      firstName?: string | null;
                      lastName?: string | null;
                      name?: string | null;
                      avatar?: string | null;
                      image?: string | null;
                    }
                  | undefined;

                if (u?.id && u?.email) {
                  const fullName =
                    [u.firstName, u.lastName].filter(Boolean).join(" ") ||
                    u.name ||
                    undefined;

                  return {
                    id: u.id,
                    email: u.email,
                    name: fullName,
                    image: u.avatar ?? u.image ?? undefined,
                    emailVerified: (u as { emailVerified?: boolean })
                      .emailVerified,
                    backendToken: data.token,
                  } as unknown as import("next-auth").User;
                }
              }
            } catch (e) {
              console.error("Fetch /auth/me failed:", e);
            }
          }

          return null;
        } catch (error) {
          console.error("Authentication error:", error);
          return null;
        }
      },
    }),

    // WebAuthn/Passkey provider
    Credentials({
      id: "passkey",
      name: "Passkey",
      credentials: {
        response: { label: "Response", type: "text" },
        email: { label: "Email", type: "email" },
      },
      async authorize(credentials) {
        if (!credentials?.response || !credentials?.email) {
          return null;
        }

        try {
          const resp = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/webauthn/login/verify`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                email: credentials.email,
                credential: JSON.parse(credentials.response as string),
              }),
            }
          );

          if (!resp.ok) {
            return null;
          }

          const data = await resp.json();

          // Expected backend shape: { message, token, user }
          if (data?.token && data?.user) {
            const user = data.user as {
              id: string;
              email: string;
              firstName?: string | null;
              lastName?: string | null;
              name?: string | null;
              avatar?: string | null;
              image?: string | null;
            };

            const fullName =
              [user.firstName, user.lastName].filter(Boolean).join(" ") ||
              user.name ||
              undefined;

            return {
              id: user.id,
              email: user.email,
              name: fullName,
              image: user.avatar ?? user.image ?? undefined,
              emailVerified: (user as { emailVerified?: boolean })
                .emailVerified,
              backendToken: data.token,
            } as unknown as import("next-auth").User;
          }

          return null;
        } catch (error) {
          console.error("Passkey authentication error:", error);
          return null;
        }
      },
    }),

    // Google OAuth provider
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        url: "https://accounts.google.com/o/oauth2/v2/auth",
        params: {
          scope:
            "openid profile email https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send",
        },
      },
      token: "https://oauth2.googleapis.com/token",
      userinfo: "https://openidconnect.googleapis.com/v1/userinfo",
      async profile(profile) {
        // Google profile
        return {
          id: profile.sub,
          name: profile.name,
          email: profile.email,
          image: profile.picture,
        };
      },
    }),

    // Microsoft Azure AD provider
    AzureAD({
      clientId: process.env.MICROSOFT_CLIENT_ID!,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: "openid profile email User.Read",
          tenant: process.env.MICROSOFT_TENANT_ID || "common",
        },
      },
      async profile(profile) {
        // Microsoft profile
        return {
          id: profile.sub,
          name: profile.name,
          email: profile.email,
          image: undefined, // Microsoft profiles don't include picture by default
        };
      },
    }),
  ] as Provider[],

  pages: {
    signIn: "/signin",
    signOut: "/signin",
    error: "/signin",
    verifyRequest: "/verify-otp",
    newUser: "/dashboard",
  },

  callbacks: {
    async jwt({ token, user, account: _account }) {
      // Persist backend JWT and id to the token on sign-in
      if (user) {
        const u = user as unknown as {
          backendToken?: string;
          id?: string;
          emailVerified?: boolean;
        };
        if (u.backendToken) {
          token.accessToken = u.backendToken;
        }
        if (u.id) {
          token.id = u.id;
        }
        if (u.emailVerified !== undefined) {
          token.emailVerified = u.emailVerified;
        }
        token.provider = "backend";
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        if (token.emailVerified !== undefined) {
          // Type assertion needed because next-auth v5 expects emailVerified as Date | null
          // but we use it as boolean from our backend
          Object.assign(session.user, { emailVerified: token.emailVerified });
        }
        session.accessToken = token.accessToken as string;
        session.provider = token.provider as string;
      }
      return session;
    },

    async signIn({ user, account, profile: _profile }) {
      // For OAuth providers (Google, Microsoft), create/update user in backend
      if (account?.provider === "google" || account?.provider === "azure-ad") {
        try {
          // Call backend to create/update user
          const response = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/auth/oauth-handler`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                provider: account.provider,
                providerId: user.id,
                email: user.email,
                name: user.name,
                image: user.image,
                accessToken: account.access_token,
                refreshToken: account.refresh_token,
                expiresAt: account.expires_at,
              }),
            }
          );

          if (response.ok) {
            const data = await response.json();
            // Attach backend user data to NextAuth user object
            (user as unknown as Record<string, unknown>).backendToken =
              data.token;
            (user as unknown as Record<string, unknown>).id = data.user.id;
            (user as unknown as Record<string, unknown>).emailVerified =
              data.user.emailVerified;
            return true;
          } else {
            console.error(
              "Backend user creation failed:",
              await response.text()
            );
            return false;
          }
        } catch (error) {
          console.error("Error creating user in backend:", error);
          return false;
        }
      }

      // For credentials provider, user creation is handled by the authorize function
      return true;
    },
  },

  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === "development",
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
