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
// 0. AUTHENTICATION METHODS (sign-in dashboard)
// ============================================
//
// The sign-in and sign-up pages use Clerk's <SignIn /> and <SignUp />
// components, which auto-render ALL authentication methods enabled in the
// Clerk dashboard. To surface any of the options below on the sign-in page,
// the operator MUST enable them in the dashboard — no code change required.
//
// DASHBOARD PATH: User & Authentication → Authentication
//
// RECOMMENDED ENABLEMENT (full range of sign-in options):
//
//   Email address:
//     - Email + password:           ON
//     - Email + verification code:  ON (OTP — user types a 6-digit code)
//
//   Phone number:
//     - Phone number:               ON (SMS OTP)
//     - Requires a Twilio account linked to Clerk for SMS delivery
//
//   Passkey (WebAuthn / device biometric):
//     - Passkey:                    ON
//     - This adds a "Sign in with Passkey" button to the sign-in page.
//     - Users can enroll a passkey from their account page after sign-up
//       (User & Authentication → Authentication → Passkey → "Allow users to
//       enroll passkeys" must be ON).
//     - Passkeys are stored on the user's device (Face ID, Touch ID,
//       Windows Hello, YubiKey). They cannot be phished — the credential is
//       scoped to pitchcoachai.tech.
//
//   Social connections (OAuth providers):
//     - Google:                     ON (covers ~80% of social sign-ins)
//     - GitHub:                     ON (already configured — see section 1)
//     - LinkedIn:                   ON (already configured — see section 1)
//     - Apple:                      RECOMMENDED (covers iOS users)
//     - Microsoft:                  OPTIONAL
//     - Each provider requires a Client ID + Client Secret from the
//       provider's developer portal, plus the redirect URL:
//         https://clerk.pitchcoachai.tech/v1/oauth_callback
//
//   SSO (SAML / OIDC for enterprise):
//     - OFF unless you have a specific enterprise customer requiring it.
//
// WHY NO "SIGN IN WITH SUPABASE" BUTTON:
//   Supabase is the project's database (Postgres), not its auth provider.
//   Auth is handled by Clerk. The social OAuth buttons above ARE the
//   "full range of sign-in options" — they render through Clerk, which
//   links the OAuth account to the user's Clerk identity. There is no
//   separate "Supabase sign-in" flow to wire up.
//
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

  // Check against known disposable/temporary email domains
  if (BLOCKED_EMAIL_DOMAINS.some((blocked) => domain === blocked || domain.endsWith(`.${blocked}`))) {
    return true;
  }

  // NOTE: Subdomain blocking was REMOVED because it was too aggressive.
  // Previously, any email with 3+ domain parts (e.g., user@dept.company.com)
  // was blocked unless the last two parts matched a known second-level TLD.
  // This blocked legitimate corporate emails like:
  //   - user@engineering.google.com
  //   - user@mail.company.com
  //   - user@dept.university.edu
  // The disposable email domain list above is sufficient for blocking abuse.
  // If subdomain blocking is needed again, consider a warning log instead
  // of hard blocking — users with corporate subdomains should not be prevented
  // from signing up.

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
//   - Minimum length: 6 characters
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
//     - min(6): At least 6 characters
//     - max(128): No more than 128 characters
//
//   We also need to add a custom `.refine()` to the password schema
//   to enforce uppercase, lowercase, number, and special character.

export const PASSWORD_REQUIREMENTS = {
  minLength: 6,
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
