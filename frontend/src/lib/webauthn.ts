import {
  startRegistration,
  startAuthentication,
} from "@simplewebauthn/browser";

import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from "@simplewebauthn/types";
import { getSession } from "next-auth/react";

/**

 * Register a new passkey for the user

 * Uses backend routes:
 * - GET /api/webauthn/register/options
 * - POST /api/webauthn/register/verify
 * @param email - User's email address (not sent to backend for registration options; user must be authenticated)

 * @returns Registration verification response or throws on error
 */
export async function registerPasskey(_email: string) {
  try {
    const session = await getSession();
    const accessToken = session?.accessToken;
    // Get registration options from your backend (authenticated GET)

    const optionsResponse = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/webauthn/register/options`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!optionsResponse.ok) {
      throw new Error("Failed to get registration options");
    }

    const options: PublicKeyCredentialCreationOptionsJSON =
      await optionsResponse.json();

    // Start the WebAuthn registration

    const registrationResponse = await startRegistration(options);

    // Send the registration response to your backend for verification

    const verificationResponse = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/webauthn/register/verify`,
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",

          Authorization: `Bearer ${accessToken}`,
        },

        body: JSON.stringify({
          credential: registrationResponse,
        }),
      }
    );

    if (!verificationResponse.ok) {
      throw new Error("Failed to verify registration");
    }

    const verification = await verificationResponse.json();

    return verification;
  } catch (error) {
    console.error("Passkey registration error:", error);

    throw error;
  }
}

/**

 * Authenticate using a passkey

 * Uses backend routes:
 * - POST /api/webauthn/login/options
 * @param email - User's email address (required by backend to generate options)
 * @returns Authentication response (client assertion) or throws on error
 */
export async function authenticateWithPasskey(email?: string) {
  try {
    // Get authentication options from your backend

    const optionsResponse = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/webauthn/login/options`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({ email }),
      }
    );

    if (!optionsResponse.ok) {
      throw new Error("Failed to get authentication options");
    }

    const options: PublicKeyCredentialRequestOptionsJSON =
      await optionsResponse.json();

    // Start the WebAuthn authentication

    const authenticationResponse = await startAuthentication(options);

    return authenticationResponse;
  } catch (error) {
    console.error("Passkey authentication error:", error);

    throw error;
  }
}

/**

 * Check if WebAuthn is supported in the current browser

 * @returns true if WebAuthn is supported, false otherwise

 */

export function isPasskeySupported(): boolean {
  return (
    window?.PublicKeyCredential !== undefined &&
    navigator?.credentials !== undefined
  );
}

/**

 * Check if platform authenticator (like Face ID, Touch ID, Windows Hello) is available

 * @returns Promise that resolves to true if available, false otherwise

 */

export async function isPlatformAuthenticatorAvailable(): Promise<boolean> {
  if (!isPasskeySupported()) {
    return false;
  }

  try {
    const session = await getSession();
    const _accessToken = session?.accessToken;

    const available =
      await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();

    return available;
  } catch {
    return false;
  }
}

/**

 * Check if conditional UI (autofill) is supported

 * @returns Promise that resolves to true if supported, false otherwise

 */

export async function isConditionalMediationAvailable(): Promise<boolean> {
  if (!isPasskeySupported()) {
    return false;
  }

  try {
    const available =
      await PublicKeyCredential.isConditionalMediationAvailable();

    return available;
  } catch {
    return false;
  }
}
