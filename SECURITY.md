# PULSE Pickleball App - Security Documentation

## Overview
This document outlines the security measures implemented in the PULSE Pickleball application.

## Critical Security Fixes Implemented

### 1. User Data Protection (PII)
**Issue**: Email addresses, phone numbers, and full names were publicly readable.  
**Fix**: 
- Restricted `profiles` table SELECT policy to authenticated users only
- Users can view their own full profile
- Others only see limited public information
- Created `profiles_public` view for safe public access
- Excluded: email, phone_number, accessibility_needs, partner_preferences

### 2. Location Tracking Prevention
**Issue**: `check_ins` and `court_checkins` tables allowed anonymous location tracking.  
**Fix**:
- Both tables now require authentication to view
- Prevents stalking and real-time location harvesting

### 3. MFA Code Security
**Issue**: Direct INSERT/UPDATE/DELETE on `mfa_verification_codes` table.  
**Fix**:
- Blocked all direct data manipulation via RLS policies
- Created security definer functions:
  - `insert_mfa_code()` - Only edge functions can insert codes
  - `verify_and_use_mfa_code()` - Atomic verify and mark as used
- Added rate limiting in edge functions (5 attempts per 10 minutes for sending, 10 attempts per 15 minutes for verification)

### 4. Edge Function Security
**Improvements**:
- Comprehensive input validation (email format, code format, required fields)
- Rate limiting to prevent abuse
- Proper error messages without leaking sensitive information
- CORS headers properly configured
- Authorization checks on all protected endpoints

## Row Level Security (RLS) Policies

### Tables with Public Read Access (Intentional)
- `badges` - Badge definitions
- `courts` - Court locations
- `sessions` - Active sessions (status='active')
- `matches` - Match history
- `rating_parameters` - Rating calculation parameters

### Tables with Authenticated-Only Access
- `profiles` - User profiles (limited public view available)
- `check_ins` - Session check-ins
- `court_checkins` - Court check-ins
- `user_availability` - User-only access
- `match_participants` - Participants can view their matches
- `round_robin_events` - Organizers and participants only

### Tables with Strict Access Control
- `mfa_verification_codes` - No direct access, security definer functions only
- `user_roles` - Admins only
- `match_edits` - Admins can view audit trail
- `round_robin_audit` - Organizers and admins

## Authentication & Authorization

### Multi-Factor Authentication
- **TOTP (Authenticator App)**: Supabase native MFA
- **Email Codes**: Custom implementation with 6-digit codes
- **SMS Codes**: Placeholder (not yet implemented)

### Admin Role Management
- Roles stored in separate `user_roles` table
- Security definer function `has_role()` prevents recursive RLS issues
- Never check admin status client-side

## Rate Limiting

### MFA Edge Functions
- **Send Code**: 5 attempts per 10 minutes per user
- **Verify Code**: 10 attempts per 15 minutes per email
- In-memory tracking (resets on function cold start)

### Recommendations
- Implement database-backed rate limiting for production
- Add IP-based rate limiting for additional protection

## Input Validation

### Edge Functions
All edge functions validate:
- Request body structure
- Email format (regex: `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`)
- Code format (6 digits: `/^\d{6}$/`)
- Required fields presence
- Data types

### Frontend
- Zod schemas for form validation
- Example: `NewMatch` uses comprehensive match schema
- Recommendation: Standardize Zod validation across all forms

## Security Headers

### CORS
```javascript
{
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
}
```

### Content Security
- All responses include `Content-Type: application/json`
- Proper HTTP status codes for different error scenarios

## Sensitive Data Handling

### Never Log to Console
- Do NOT log sensitive data (passwords, tokens, emails, codes)
- Production builds should remove console.error statements
- Use structured logging for backend errors

### Environment Variables
Required secrets:
- `RESEND_API_KEY` - For MFA email sending
- `SUPABASE_URL` - Auto-configured
- `SUPABASE_ANON_KEY` - Auto-configured  
- `SUPABASE_SERVICE_ROLE_KEY` - Auto-configured (backend only)

## Known Security Warnings

### From Supabase Linter

1. **Leaked Password Protection Disabled** (WARN)
   - Status: Auth configuration warning
   - Recommendation: Enable in production via Supabase auth settings
   - Impact: Users can use compromised passwords

## Security Best Practices

### Frontend
1. Never store sensitive data in localStorage/sessionStorage
2. Always validate user input with Zod schemas
3. Use proper TypeScript types to prevent type-related bugs
4. Handle errors gracefully without exposing internal details

### Backend (Edge Functions)
1. Always validate authorization headers
2. Use security definer functions for privileged operations
3. Implement rate limiting on all public endpoints
4. Never execute raw SQL queries
5. Use Supabase client methods (`.from()`, `.rpc()`)

### Database
1. Enable RLS on all tables
2. Use security definer functions to prevent recursive RLS
3. Create audit trails for sensitive operations
4. Use views for safe public data exposure

## Audit Trails

### Implemented
- `match_edits` - Track all match modifications
- `round_robin_audit` - Track round robin event changes

### Recommended
- Admin action logging (badge assignments, role changes)
- Authentication attempt logging
- Sensitive data access logging

## Future Security Enhancements

1. **Email Notifications**
   - Notify users of MFA enrollment/changes
   - Alert on suspicious login attempts
   - Weekly security digest

2. **Advanced Rate Limiting**
   - Database-backed rate limiting
   - IP-based throttling
   - Progressive delays for repeated failures

3. **Data Privacy**
   - GDPR compliance features
   - User data export functionality
   - Data retention policies
   - Right to be forgotten implementation

4. **Enhanced MFA**
   - Backup codes
   - SMS implementation (Twilio)
   - Biometric options (WebAuthn)

5. **Security Monitoring**
   - Real-time anomaly detection
   - Failed login attempt monitoring
   - Automated security scans

## Incident Response

### If Security Issue Detected
1. Identify affected systems and users
2. Contain the issue (disable features if needed)
3. Investigate root cause
4. Implement fix
5. Notify affected users
6. Document lessons learned

### Reporting Security Issues
Contact: [Add security contact email]

## Compliance

### Data Protection
- User emails and phone numbers are protected
- Location data requires authentication
- MFA codes expire after 10 minutes
- Used codes cannot be reused

### Access Control
- Role-based access control (RBAC) via `user_roles`
- Principle of least privilege
- Separation of duties for admin operations

## Regular Security Tasks

### Weekly
- Review Supabase linter warnings
- Check for failed authentication attempts
- Monitor rate limit violations

### Monthly
- Review and update dependencies
- Audit RLS policies
- Review admin action logs
- Test MFA flows

### Quarterly
- Full security audit
- Penetration testing
- Update security documentation
- Review and update security policies

---

Last Updated: 2025-10-27  
Version: 1.0
