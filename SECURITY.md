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

## Recent Security Enhancements (2025-11-05)

### 1. Admin Audit Logging ✅
**Implementation**: Complete admin action tracking system
- New `admin_audit_log` table with immutable records
- Tracks: action, resource_type, resource_id, details, timestamp
- Security definer function `log_admin_action()` for controlled access
- RLS policies: Admins view only, no updates/deletes (immutable)
- Indexes for efficient querying by admin, date, resource, action

### 2. GDPR Data Export ✅
**Implementation**: Complete user data portability
- Security definer function `export_user_data()` 
- Exports ALL user data in JSON format:
  - Profile information
  - Match history and statistics
  - Badges and achievements
  - Event participation (round-robin, tournaments, calendar)
  - Social activity (posts, comments, LFG)
  - Disputes and issues reported
- Complies with GDPR right to data portability

### 3. Enhanced RLS Policies ✅
**Critical PII Protection**:
- `profiles` table: Restricted to authenticated users
- `profiles_public` view: Safe public data exposure (no PII)
- Location tracking prevention: `queue_entries`, `check_ins`, `court_checkins`
- Rating changes: Only visible to participants and admins
- Tournament data: Partner info restricted to captain/partner/admin
- Match disputes: Only visible to participants and admins

### 4. Auth Configuration ✅
- Auto-confirm email enabled for non-production
- Anonymous signups disabled
- Leaked password protection: Configured

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

### Implemented ✅
- `match_edits` - Track all match modifications
- `round_robin_audit` - Track round robin event changes  
- `admin_audit_log` - **NEW** Complete admin action logging:
  - Badge assignments/removals
  - Session management
  - Player management
  - Match editing
  - Tournament administration
  - All admin portal actions

### Usage Example
```javascript
// Log admin action
await supabase.rpc('log_admin_action', {
  p_action: 'badge_awarded',
  p_resource_type: 'player_badge',
  p_resource_id: badgeId,
  p_details: { player_id, badge_code }
});
```

### Recommended
- Authentication attempt logging
- Sensitive data access logging  
- Failed authorization attempt tracking

## Future Security Enhancements

1. **Email Notifications**
   - Notify users of MFA enrollment/changes
   - Alert on suspicious login attempts
   - Weekly security digest

2. **Advanced Rate Limiting**
   - Database-backed rate limiting
   - IP-based throttling
   - Progressive delays for repeated failures

3. **Data Privacy** - ✅ PARTIALLY COMPLETE
   - ✅ GDPR data export functionality
   - ⏳ Data retention policies
   - ⏳ Right to be forgotten implementation (account deletion with data wipe)
   - ⏳ Privacy policy and terms of service pages

4. **Enhanced MFA**
   - Backup codes
   - SMS implementation (Twilio)
   - Biometric options (WebAuthn)

5. **Security Monitoring**
   - ⏳ Real-time anomaly detection
   - ⏳ Failed login attempt monitoring
   - ⏳ Automated security scans
   - ⏳ Admin audit log dashboard

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

## Quick Reference: Security Functions

### Admin Audit Logging
```sql
SELECT log_admin_action(
  'action_name',           -- e.g., 'badge_awarded', 'session_created'
  'resource_type',         -- e.g., 'badge', 'session', 'match'
  'resource_id',           -- UUID or identifier
  '{"key": "value"}'::jsonb -- Additional details
);
```

### GDPR Data Export
```sql
SELECT export_user_data(); -- Returns complete user data as JSONB
```

---

Last Updated: 2025-11-05  
Version: 2.0
