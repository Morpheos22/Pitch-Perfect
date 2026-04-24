// ═══════════════════════════════════════════════════════════════════════
// CLERK CONFIGURATION — SSO, Email Validation, Password Policy
// ═══════════════════════════════════════════════════════════════════════
//
// This file documents the Clerk configuration that MUST be set in the
// Clerk Dashboard (https://dashboard.clerk.com). Some of these settings
// cannot be configured in code — they are dashboard-only settings.
//
// ═══════════════════════════════════════════════════════════════════════

// ============================================
// 1. SOCIAL SSO — LinkedIn & GitHub
// ============================================
//
// These MUST be configured in the Clerk Dashboard:
//   Navigate to: User & Authentication → Social Connections
//
// LINKEDIN:
//   - Enable: Yes
//   - Client ID: Obtain from LinkedIn Developer Portal
//     → https://www.linkedin.com/developers/apps
//   - Client Secret: Same portal
//   - Scopes: r_liteprofile, r_emailaddress
//   - Redirect URL: https://clerk.pitchcoachai.tech/v1/oauth_callback
//     (Clerk provides this — copy from the Dashboard)
//
// GITHUB:
//   - Enable: Yes
//   - Client ID: Obtain from GitHub Developer Settings
//     → https://github.com/settings/developers
//   - Client Secret: Same portal
//   - Scopes: user:email, read:user
//   - Redirect URL: https://clerk.pitchcoachai.tech/v1/oauth_callback
//     (Clerk provides this — copy from the Dashboard)
//
// IMPORTANT: Both SSO providers must be enabled in Clerk Dashboard
// before they appear on the sign-in/sign-up pages. The Clerk <SignUp>
// and <SignIn> components automatically render enabled SSO buttons.

// ============================================
// 2. SUBDOMAIN EMAIL BLOCKING
// ============================================
//
// Block subdomain email addresses during sign-up to prevent
// disposable/temporary email abuse.
//
// CONFIGURATION LOCATION: Clerk Dashboard
//   Navigate to: User & Authentication → Email → Restrictions
//
// SETTINGS:
//   - Allowlist: Disabled (we use a blocklist instead)
//   - Blocklist: Add the following patterns:
//     * *.mailinator.com
//     * *.guerrillamail.com
//     * *.guerrillamailblock.com
//     * *.sharklasers.com
//     * *.grr.la
//     * *.guerrillamail.biz
//     * *.guerrillamail.de
//     * *.guerrillamail.info
//     * *.guerrillamail.net
//     * *.guerrillamail.org
//     * *.spam4.me
//     * *.tempmail.com
//     * *.throwaway.email
//     * *.yopmail.com
//     * *.yopmail.fr
//     * *.dispostable.com
//     * *.trashmail.ws
//     * *.10minutemail.com
//     * *.temp-mail.org
//
// CUSTOM BLOCKLIST (subdomain detection):
//   Also add a custom rule to block emails where the domain
//   has more than one dot BEFORE the TLD (subdomain detection):
//   Regex pattern: .*@.*\..*\..*
//   This blocks: user@sub.domain.com, user@dept.company.co.uk
//   But allows: user@gmail.com, user@company.com, user@company.co.uk
//
// IMPLEMENTATION NOTE: If Clerk's built-in blocklist doesn't support
// regex, we enforce subdomain blocking in our Clerk webhook handler
// (see /api/webhooks/clerk/route.ts).

export const BLOCKED_EMAIL_DOMAINS = [
  'mailinator.com',
  'guerrillamail.com',
  'guerrillamailblock.com',
  'sharklasers.com',
  'grr.la',
  'guerrillamail.biz',
  'guerrillamail.de',
  'guerrillamail.info',
  'guerrillamail.net',
  'guerrillamail.org',
  'spam4.me',
  'tempmail.com',
  'throwaway.email',
  'yopmail.com',
  'yopmail.fr',
  'dispostable.com',
  'trashmail.ws',
  '10minutemail.com',
  'temp-mail.org',
] as const;

/**
 * Check if an email address uses a blocked domain or subdomain.
 * Returns true if the email should be blocked.
 */
export function isBlockedEmail(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) return true; // No domain = block

  // Check against blocked domains
  if (BLOCKED_EMAIL_DOMAINS.some((blocked) => domain === blocked || domain.endsWith(`.${blocked}`))) {
    return true;
  }

  // Subdomain detection: block emails where the local part of the domain
  // has more than one dot (e.g., user@sub.domain.com)
  // But allow second-level TLDs (e.g., user@company.co.uk)
  const domainParts = domain.split('.');
  if (domainParts.length > 2) {
    // Allow known second-level TLDs (co.uk, com.au, co.za, etc.)
    const secondLevelTLDs = ['co.uk', 'com.au', 'co.za', 'co.nz', 'co.in', 'com.br', 'com.mx', 'co.jp', 'or.jp', 'ac.uk', 'org.uk'];
    const lastTwoParts = domainParts.slice(-2).join('.');
    if (!secondLevelTLDs.includes(lastTwoParts)) {
      return true; // This looks like a subdomain
    }
  }

  return false;
}

// ============================================
// 3. CUSTOM PASSWORD POLICY
// ============================================
//
// CONFIGURATION LOCATION: Clerk Dashboard
//   Navigate to: User & Authentication → Email → Password Settings
//
// SETTINGS:
//   - Minimum length: 10 characters
//   - Require uppercase: Yes
//   - Require lowercase: Yes
//   - Require numbers: Yes
//   - Require special characters: Yes
//   - Maximum length: 128 characters
//   - Prevent common passwords: Yes (Clerk built-in)
//   - Prevent breached passwords: Yes (Clerk built-in)
//
// CUSTOM VALIDATION (additional to Clerk's built-in):
//   Our /api/user/change-password endpoint also enforces these rules
//   via the changePasswordSchema in validation/schemas.ts.
//   The Zod schema validates:
//     - min(10): At least 10 characters
//     - max(128): No more than 128 characters
//
//   We also need to add a custom `.refine()` to the password schema
//   to enforce uppercase, lowercase, number, and special character.

export const PASSWORD_REQUIREMENTS = {
  minLength: 10,
  maxLength: 128,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSpecialChar: true,
  specialChars: '!@#$%^&*()_+-=[]{}|;:,.<>?',
} as const;

/**
 * Validate a password against the custom policy.
 * Returns { valid: boolean, errors: string[] }
 */
export function validatePasswordPolicy(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (password.length < PASSWORD_REQUIREMENTS.minLength) {
    errors.push(`Password must be at least ${PASSWORD_REQUIREMENTS.minLength} characters`);
  }
  if (password.length > PASSWORD_REQUIREMENTS.maxLength) {
    errors.push(`Password must be no more than ${PASSWORD_REQUIREMENTS.maxLength} characters`);
  }
  if (PASSWORD_REQUIREMENTS.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (PASSWORD_REQUIREMENTS.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (PASSWORD_REQUIREMENTS.requireNumber && !/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  if (PASSWORD_REQUIREMENTS.requireSpecialChar && !new RegExp(`[${PASSWORD_REQUIREMENTS.specialChars}]`).test(password)) {
    errors.push('Password must contain at least one special character');
  }

  return { valid: errors.length === 0, errors };
}
