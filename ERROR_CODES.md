# Backend Error Codes Documentation

## Authentication Error Codes

### 4xx Client Errors

#### 400 Bad Request
- `VALIDATION_ERROR` - Request validation failed
- `INVALID_OTP` - Invalid verification code provided
- `OTP_NOT_FOUND` - No verification code found for this email
- `OTP_EXPIRED` - Verification code has expired
- `INVALID_CREDENTIALS` - Invalid email or password
- `INVALID_INVITE_CODE` - Invalid or expired invite code
- `WEAK_PASSWORD` - Password does not meet security requirements

#### 401 Unauthorized
- `UNAUTHORIZED` - Authentication required
- `INVALID_TOKEN` - Invalid or expired JWT token
- `USER_NOT_FOUND` - No account found with this email address
- `INCORRECT_PASSWORD` - Incorrect password provided
- `INVALID_CREDENTIALS` - Generic invalid credentials (legacy)

#### 403 Forbidden
- `ACCOUNT_SUSPENDED` - Account has been suspended
- `ACCOUNT_PENDING` - Account not yet activated (onboarding incomplete)
- `ACCOUNT_INACTIVE` - Account not active
- `FORBIDDEN` - Access to resource is forbidden

#### 404 Not Found
- `ACCOUNT_NOT_FOUND` - User account not found
- `NOT_FOUND` - General resource not found

#### 409 Conflict
- `DUPLICATE_ENTRY` - Resource already exists (email, phone, etc.)
- `EMAIL_ALREADY_EXISTS` - Email address already registered
- `PHONE_ALREADY_EXISTS` - Phone number already registered

## Error Response Format

All errors follow this consistent format:

```json
{
  "success": false,
  "error": "Human readable error message",
  "code": "ERROR_CODE"
}
```

### Validation Errors (400)
```json
{
  "success": false,
  "error": "Validation failed",
  "details": [
    {
      "field": "email",
      "message": "Invalid email format"
    }
  ]
}
```

## Usage Examples

### Login Errors
```typescript
// User not found
throw new AppError('No account found with this email address', 401, 'USER_NOT_FOUND');

// Incorrect password
throw new AppError('Incorrect password. Please try again.', 401, 'INCORRECT_PASSWORD');

// Account suspended
throw new AppError('Account suspended. Please contact your agency.', 403, 'ACCOUNT_SUSPENDED');

// Account pending onboarding
throw new AppError('Account not yet activated. Please complete onboarding.', 403, 'ACCOUNT_PENDING');
```

### OTP Errors
```typescript
// No OTP found
throw new AppError('No verification code found. Please request a new one.', 400, 'OTP_NOT_FOUND');

// OTP expired
throw new AppError('Verification code expired. Please request a new one.', 400, 'OTP_EXPIRED');

// Invalid OTP
throw new AppError('Invalid verification code', 400, 'INVALID_OTP');
```

### Account Errors
```typescript
// Account not found
throw new AppError('Account not found', 404, 'ACCOUNT_NOT_FOUND');

// Email already exists
throw new AppError('Email address already registered', 409, 'EMAIL_ALREADY_EXISTS');
```

## Mobile App Error Handling

The mobile app should handle errors in this priority order:

1. **Primary**: `err?.status === 401 && err?.data?.error` - Specific 401 backend errors
2. **Secondary**: `err?.data?.error` - General backend error field  
3. **Tertiary**: `err?.data?.message` - Backend message field
4. **Fallback**: `err?.message` - Network/system errors
5. **Default**: Appropriate generic message

This ensures users get the most specific and helpful error messages from the backend.
