"use client";

import React from "react";
import { AlertCircle, RefreshCw, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  parseOAuthError,
  isOAuthErrorRetryable,
  getOAuthErrorSuggestedAction,
  type OAuthErrorParams,
} from "@/lib/oauth-errors";

interface OAuthErrorDisplayProps {
  errorParams: OAuthErrorParams;
  onRetry?: () => void;
  onContactSupport?: () => void;
  className?: string;
  variant?: "toast" | "card" | "inline";
}

/**
 * OAuth Error Display Component
 *
 * Displays user-friendly error messages for OAuth authentication failures
 * with appropriate retry options and suggested actions.
 */
export function OAuthErrorDisplay({
  errorParams,
  onRetry,
  onContactSupport,
  className,
  variant = "card",
}: OAuthErrorDisplayProps) {
  const error = parseOAuthError(errorParams);

  if (!error) {
    return null;
  }

  const isRetryable = isOAuthErrorRetryable(errorParams);
  const suggestedAction = getOAuthErrorSuggestedAction(errorParams);

  // Toast variant - minimal display
  if (variant === "toast") {
    return (
      <div className={cn("flex items-start space-x-3", className)}>
        <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-destructive">{error.title}</p>
          <p className="text-sm text-muted-foreground mt-1">
            {error.description}
          </p>
          {suggestedAction && (
            <p className="text-xs text-muted-foreground mt-2">
              {suggestedAction}
            </p>
          )}
        </div>
      </div>
    );
  }

  // Inline variant - compact display
  if (variant === "inline") {
    return (
      <div className={cn("flex items-center space-x-2 text-sm", className)}>
        <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0" />
        <span className="text-destructive font-medium">{error.title}:</span>
        <span className="text-muted-foreground">{error.description}</span>
        {isRetryable && onRetry && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRetry}
            className="h-6 px-2 text-xs"
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Retry
          </Button>
        )}
      </div>
    );
  }

  // Card variant - full display (default)
  return (
    <Card className={cn("border-destructive/20 bg-destructive/5", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center space-x-2">
          <AlertCircle className="h-5 w-5 text-destructive" />
          <CardTitle className="text-destructive text-lg">
            {error.title}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground">{error.description}</p>

        {suggestedAction && (
          <div className="p-3 bg-muted/50 rounded-md">
            <p className="text-sm font-medium text-foreground mb-1">
              Suggested Action:
            </p>
            <p className="text-sm text-muted-foreground">{suggestedAction}</p>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2">
          {isRetryable && onRetry && (
            <Button
              onClick={onRetry}
              variant="outline"
              size="sm"
              className="flex items-center space-x-2"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Try Again</span>
            </Button>
          )}

          {onContactSupport && (
            <Button
              onClick={onContactSupport}
              variant="ghost"
              size="sm"
              className="flex items-center space-x-2"
            >
              <ExternalLink className="h-4 w-4" />
              <span>Contact Support</span>
            </Button>
          )}
        </div>

        {/* Technical details for debugging */}
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer hover:text-foreground">
            Technical Details
          </summary>
          <div className="mt-2 p-2 bg-muted/30 rounded text-xs font-mono">
            <div>Error Code: {error.code}</div>
            {errorParams.error_description && (
              <div>Description: {errorParams.error_description}</div>
            )}
            {errorParams.error_uri && <div>URI: {errorParams.error_uri}</div>}
          </div>
        </details>
      </CardContent>
    </Card>
  );
}

/**
 * Hook for handling OAuth errors in components
 */
export function useOAuthError(errorParams: OAuthErrorParams) {
  const error = parseOAuthError(errorParams);

  return {
    error,
    hasError: !!error,
    isRetryable: isOAuthErrorRetryable(errorParams),
    suggestedAction: getOAuthErrorSuggestedAction(errorParams),
    title: error?.title || "Authentication Error",
    description:
      error?.description || "An error occurred during authentication.",
  };
}

/**
 * OAuth Error Boundary Component
 *
 * Wraps OAuth-related components to catch and display errors gracefully
 */
interface OAuthErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error: Error; resetError: () => void }>;
  onError?: (error: Error) => void;
}

interface OAuthErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class OAuthErrorBoundary extends React.Component<
  OAuthErrorBoundaryProps,
  OAuthErrorBoundaryState
> {
  constructor(props: OAuthErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): OAuthErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("OAuth Error Boundary caught an error:", error, errorInfo);
    this.props.onError?.(error);
  }

  resetError = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      const FallbackComponent = this.props.fallback || DefaultErrorFallback;
      return (
        <FallbackComponent
          error={this.state.error}
          resetError={this.resetError}
        />
      );
    }

    return this.props.children;
  }
}

function DefaultErrorFallback({
  error,
  resetError,
}: {
  error: Error;
  resetError: () => void;
}) {
  return (
    <Card className="border-destructive/20 bg-destructive/5">
      <CardHeader>
        <div className="flex items-center space-x-2">
          <AlertCircle className="h-5 w-5 text-destructive" />
          <CardTitle className="text-destructive">
            Authentication Error
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground">
          An unexpected error occurred during authentication. Please try again.
        </p>
        <div className="flex gap-2">
          <Button onClick={resetError} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        </div>
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer hover:text-foreground">
            Error Details
          </summary>
          <div className="mt-2 p-2 bg-muted/30 rounded text-xs font-mono">
            {error.message}
          </div>
        </details>
      </CardContent>
    </Card>
  );
}
