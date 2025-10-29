/**
 * OAuth Error Handling Utilities
 *
 * Provides comprehensive error handling for OAuth authentication flows,
 * including Google, Microsoft, and other OAuth providers.
 */

export interface OAuthError {
  code: string;
  title: string;
  description: string;
  isRetryable: boolean;
  suggestedAction?: string;
}

export interface OAuthErrorParams {
  error?: string | null;
  error_description?: string | null;
  error_uri?: string | null;
}

/**
 * OAuth error codes and their corresponding user-friendly messages
 */
export const OAUTH_ERRORS: Record<string, OAuthError> = {
  // NextAuth.js specific errors
  AccessDenied: {
    code: "AccessDenied",
    title: "Access Denied",
    description:
      "You cancelled the authentication or denied the required permissions. Please try again and ensure you grant all necessary permissions.",
    isRetryable: true,
    suggestedAction:
      "Try signing in again and make sure to grant all requested permissions.",
  },

  Configuration: {
    code: "Configuration",
    title: "Configuration Error",
    description:
      "There is a problem with the server configuration. This is a technical issue that needs to be resolved by our support team.",
    isRetryable: false,
    suggestedAction: "Please contact support if this issue persists.",
  },

  Verification: {
    code: "Verification",
    title: "Verification Failed",
    description:
      "The verification token has expired or has already been used. Please request a new verification link.",
    isRetryable: true,
    suggestedAction:
      "Please request a new verification email or try signing in again.",
  },

  Default: {
    code: "Default",
    title: "Authentication Error",
    description:
      "An unexpected error occurred during authentication. Please try again.",
    isRetryable: true,
    suggestedAction:
      "Try signing in again. If the problem persists, contact support.",
  },

  // OAuth 2.0 standard errors
  invalid_request: {
    code: "invalid_request",
    title: "Invalid Request",
    description:
      "The authentication request was malformed or missing required parameters.",
    isRetryable: false,
    suggestedAction:
      "Please contact support as this appears to be a technical issue.",
  },

  unauthorized_client: {
    code: "unauthorized_client",
    title: "Unauthorized Client",
    description:
      "The client application is not authorized to request authentication.",
    isRetryable: false,
    suggestedAction:
      "Please contact support as this appears to be a configuration issue.",
  },

  access_denied: {
    code: "access_denied",
    title: "Access Denied",
    description:
      "You denied the authentication request or cancelled the sign-in process.",
    isRetryable: true,
    suggestedAction:
      "Try signing in again and make sure to grant all requested permissions.",
  },

  unsupported_response_type: {
    code: "unsupported_response_type",
    title: "Unsupported Response Type",
    description:
      "The authentication server does not support the requested response type.",
    isRetryable: false,
    suggestedAction:
      "Please contact support as this appears to be a technical issue.",
  },

  invalid_scope: {
    code: "invalid_scope",
    title: "Invalid Scope",
    description: "The requested scope is invalid, unknown, or malformed.",
    isRetryable: false,
    suggestedAction:
      "Please contact support as this appears to be a configuration issue.",
  },

  server_error: {
    code: "server_error",
    title: "Server Error",
    description: "The authentication server encountered an unexpected error.",
    isRetryable: true,
    suggestedAction:
      "Please try again in a few moments. If the problem persists, contact support.",
  },

  temporarily_unavailable: {
    code: "temporarily_unavailable",
    title: "Service Temporarily Unavailable",
    description:
      "The authentication server is temporarily unable to handle the request.",
    isRetryable: true,
    suggestedAction: "Please try again in a few moments.",
  },

  // Google OAuth specific errors
  consent_required: {
    code: "consent_required",
    title: "Consent Required",
    description:
      "Additional consent is required to complete the authentication process.",
    isRetryable: true,
    suggestedAction:
      "Please try signing in again and complete the consent process.",
  },

  // Microsoft OAuth specific errors
  interaction_required: {
    code: "interaction_required",
    title: "Interaction Required",
    description:
      "Additional user interaction is required to complete authentication.",
    isRetryable: true,
    suggestedAction:
      "Please try signing in again and complete any required interactions.",
  },

  login_required: {
    code: "login_required",
    title: "Login Required",
    description: "You need to sign in to your account to continue.",
    isRetryable: true,
    suggestedAction: "Please try signing in again.",
  },
};

/**
 * Parse OAuth error parameters and return a structured error object
 */
export function parseOAuthError(params: OAuthErrorParams): OAuthError | null {
  const { error, error_description } = params;

  if (!error) {
    return null;
  }

  // Check if we have a predefined error
  const predefinedError = OAUTH_ERRORS[error];
  if (predefinedError) {
    return {
      ...predefinedError,
      description: error_description || predefinedError.description,
    };
  }

  // Handle unknown errors
  return {
    code: error,
    title: "Authentication Error",
    description:
      error_description ||
      "An unexpected error occurred during authentication. Please try again.",
    isRetryable: true,
    suggestedAction:
      "Try signing in again. If the problem persists, contact support.",
  };
}

/**
 * Get a user-friendly error message for display in UI
 */
export function getOAuthErrorMessage(params: OAuthErrorParams): string {
  const error = parseOAuthError(params);
  return error?.description || "Authentication failed. Please try again.";
}

/**
 * Get a user-friendly error title for display in UI
 */
export function getOAuthErrorTitle(params: OAuthErrorParams): string {
  const error = parseOAuthError(params);
  return error?.title || "Authentication Error";
}

/**
 * Check if an OAuth error is retryable
 */
export function isOAuthErrorRetryable(params: OAuthErrorParams): boolean {
  const error = parseOAuthError(params);
  return error?.isRetryable || false;
}

/**
 * Get suggested action for an OAuth error
 */
export function getOAuthErrorSuggestedAction(
  params: OAuthErrorParams
): string | undefined {
  const error = parseOAuthError(params);
  return error?.suggestedAction;
}

/**
 * Common OAuth error scenarios and their handling
 */
export const OAUTH_ERROR_SCENARIOS = {
  /**
   * User cancelled the OAuth flow
   */
  USER_CANCELLED: {
    error: "AccessDenied",
    description:
      "You cancelled the sign-in process. Please try again if you'd like to continue.",
  },

  /**
   * User denied permissions
   */
  PERMISSIONS_DENIED: {
    error: "AccessDenied",
    description:
      "You denied the required permissions. Please try again and grant all necessary permissions.",
  },

  /**
   * Network or server issues
   */
  SERVER_ERROR: {
    error: "server_error",
    description:
      "The authentication service is temporarily unavailable. Please try again in a few moments.",
  },

  /**
   * Configuration issues
   */
  CONFIG_ERROR: {
    error: "Configuration",
    description:
      "There's a configuration issue with the authentication service. Please contact support.",
  },
} as const;
