/**
 * Error message sanitizer utility
 * Prevents database schema and implementation details from leaking to users
 */

// Common Supabase/Postgres error patterns that reveal schema details
const SENSITIVE_PATTERNS = [
  /column "[\w_]+" of relation/gi,
  /table "[\w_]+"/gi,
  /relation "[\w_]+"/gi,
  /constraint "[\w_]+"/gi,
  /foreign key constraint/gi,
  /violates row-level security policy/gi,
  /duplicate key value/gi,
  /null value in column/gi,
  /PGRST\d+/gi,
  /invalid input syntax for type/gi,
  /function [\w_]+\(/gi,
  /schema "[\w_]+"/gi,
];

// Map of error types to user-friendly messages
const ERROR_TYPE_MAP: Record<string, string> = {
  '23505': 'This item already exists.',
  '23503': 'This action cannot be completed due to related data.',
  '23502': 'Required information is missing.',
  '42501': 'You do not have permission to perform this action.',
  '42P01': 'Unable to complete this request.',
  'PGRST301': 'You do not have permission to access this resource.',
  'PGRST116': 'No data found.',
};

/**
 * Sanitizes error messages for display to users
 * Removes database schema details and implementation specifics
 * 
 * @param error - The error object or message
 * @param fallbackMessage - Default message if sanitization removes all content
 * @returns A user-friendly error message
 */
export function sanitizeErrorMessage(
  error: unknown,
  fallbackMessage = 'An error occurred. Please try again.'
): string {
  if (!error) return fallbackMessage;

  // Extract message from various error formats
  let message = '';
  
  if (typeof error === 'string') {
    message = error;
  } else if (error instanceof Error) {
    message = error.message;
  } else if (typeof error === 'object' && error !== null) {
    const errorObj = error as Record<string, unknown>;
    
    // Check for Supabase error code
    const code = errorObj.code as string;
    if (code && ERROR_TYPE_MAP[code]) {
      return ERROR_TYPE_MAP[code];
    }
    
    // Extract message from common error structures
    message = (errorObj.message || errorObj.error_description || errorObj.error || '') as string;
  }

  if (!message) return fallbackMessage;

  // Check if message contains sensitive patterns
  const containsSensitiveInfo = SENSITIVE_PATTERNS.some(pattern => pattern.test(message));
  
  if (containsSensitiveInfo) {
    // Return generic message if sensitive info detected
    return fallbackMessage;
  }

  // Truncate very long messages
  if (message.length > 200) {
    return fallbackMessage;
  }

  return message;
}

/**
 * Logs error details securely (for debugging) while returning sanitized message
 * Use this in catch blocks to maintain debugging capability
 * 
 * @param context - Description of where the error occurred
 * @param error - The error object
 * @param fallbackMessage - User-friendly fallback message
 * @returns Sanitized error message for user display
 */
export function logAndSanitizeError(
  context: string,
  error: unknown,
  fallbackMessage = 'An error occurred. Please try again.'
): string {
  // In development, log the full error for debugging
  if (import.meta.env.DEV) {
    console.error(`[${context}]`, error);
  }
  
  return sanitizeErrorMessage(error, fallbackMessage);
}

/**
 * Input validation constants to prevent DoS and maintain data integrity
 */
export const INPUT_LIMITS = {
  // Content limits
  POST_CONTENT_MAX: 10000,
  COMMENT_MAX: 2000,
  TITLE_MAX: 200,
  BIO_MAX: 500,
  
  // Name limits
  NAME_MAX: 100,
  EMAIL_MAX: 255,
  
  // General limits
  SHORT_TEXT_MAX: 100,
  MEDIUM_TEXT_MAX: 500,
  LONG_TEXT_MAX: 5000,
  
  // Rate limiting (for reference, actual implementation should be server-side)
  MAX_POSTS_PER_HOUR: 10,
  MAX_COMMENTS_PER_HOUR: 30,
} as const;

/**
 * Validates text input against length limits
 * @param text - The text to validate
 * @param maxLength - Maximum allowed length
 * @returns true if valid, false if exceeds limit
 */
export function validateTextLength(text: string | undefined | null, maxLength: number): boolean {
  if (!text) return true;
  return text.length <= maxLength;
}
