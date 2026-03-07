/**
 * UK Home Office Right to Work (RTW) Verification Service
 * 
 * Uses the Employer Checking Service API to verify a worker's right to work
 * using their 9-character share code and date of birth.
 * 
 * API Documentation: https://www.gov.uk/view-right-to-work
 */

import { config } from '../../config';

export interface RTWVerificationRequest {
  shareCode: string; // 9-character code e.g., "A23-994-49H"
  dateOfBirth: string; // Format: YYYY-MM-DD
}

export interface RTWVerificationResult {
  verified: boolean;
  status: 'VALID' | 'INVALID' | 'EXPIRED' | 'NOT_FOUND' | 'ERROR';
  workRestriction?: 'UNLIMITED' | 'LIMITED' | 'TIME_LIMITED';
  expiryDate?: Date;
  firstName?: string;
  lastName?: string;
  nationality?: string;
  documentType?: string;
  checkDate: Date;
  referenceNumber?: string;
  rawResponse?: any;
  errorMessage?: string;
}

export interface RTWCheckRecord {
  shareCode: string;
  dateOfBirth: Date;
  checkedAt: Date;
  result: RTWVerificationResult;
  checkedBy?: string;
}

class RTWVerificationService {
  private apiBaseUrl: string;
  private apiKey: string;
  private clientId: string;
  private isDevelopment: boolean;

  constructor() {
    // Home Office API credentials from environment
    this.apiBaseUrl = process.env.RTW_API_URL || 'https://api.ukho.gov.uk/rtw/v1';
    this.apiKey = process.env.RTW_API_KEY || '';
    this.clientId = process.env.RTW_CLIENT_ID || '';
    this.isDevelopment = process.env.NODE_ENV !== 'production';
  }

  /**
   * Validates the share code format
   * Format: XXX-XXX-XXX (9 alphanumeric characters with optional dashes)
   */
  validateShareCode(code: string): { valid: boolean; normalized: string; error?: string } {
    // Remove dashes and spaces, convert to uppercase
    const normalized = code.replace(/[-\s]/g, '').toUpperCase();
    
    if (normalized.length !== 9) {
      return {
        valid: false,
        normalized,
        error: 'Share code must be exactly 9 characters',
      };
    }

    // Share codes are alphanumeric
    if (!/^[A-Z0-9]+$/.test(normalized)) {
      return {
        valid: false,
        normalized,
        error: 'Share code must contain only letters and numbers',
      };
    }

    return { valid: true, normalized };
  }

  /**
   * Validates date of birth
   */
  validateDateOfBirth(dob: string): { valid: boolean; date?: Date; error?: string } {
    const date = new Date(dob);
    
    if (isNaN(date.getTime())) {
      return { valid: false, error: 'Invalid date format' };
    }

    const now = new Date();
    const age = Math.floor((now.getTime() - date.getTime()) / (365.25 * 24 * 60 * 60 * 1000));

    if (age < 16) {
      return { valid: false, error: 'Worker must be at least 16 years old' };
    }

    if (age > 120) {
      return { valid: false, error: 'Invalid date of birth' };
    }

    return { valid: true, date };
  }

  /**
   * Verifies right to work using the Home Office API
   * In development mode, uses mock responses
   */
  async verify(request: RTWVerificationRequest): Promise<RTWVerificationResult> {
    const checkDate = new Date();

    // Validate inputs
    const codeValidation = this.validateShareCode(request.shareCode);
    if (!codeValidation.valid) {
      return {
        verified: false,
        status: 'ERROR',
        checkDate,
        errorMessage: codeValidation.error,
      };
    }

    const dobValidation = this.validateDateOfBirth(request.dateOfBirth);
    if (!dobValidation.valid) {
      return {
        verified: false,
        status: 'ERROR',
        checkDate,
        errorMessage: dobValidation.error,
      };
    }

    // In development or if no API key, use mock verification
    if (this.isDevelopment || !this.apiKey) {
      return this.mockVerify(codeValidation.normalized, dobValidation.date!, checkDate);
    }

    // Production: Call Home Office API
    try {
      const response = await this.callHomeOfficeAPI(
        codeValidation.normalized,
        request.dateOfBirth
      );
      return this.parseAPIResponse(response, checkDate);
    } catch (error: any) {
      console.error('RTW API Error:', error);
      return {
        verified: false,
        status: 'ERROR',
        checkDate,
        errorMessage: error.message || 'Failed to verify with Home Office API',
      };
    }
  }

  /**
   * Mock verification for development/testing
   * Simulates different scenarios based on share code patterns
   */
  private mockVerify(shareCode: string, dob: Date, checkDate: Date): RTWVerificationResult {
    // Simulate API delay
    const referenceNumber = `RTW-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    // Test scenarios based on share code prefix
    const prefix = shareCode.substring(0, 1);

    switch (prefix) {
      case 'A':
        // Valid unlimited right to work
        return {
          verified: true,
          status: 'VALID',
          workRestriction: 'UNLIMITED',
          firstName: 'Test',
          lastName: 'Worker',
          nationality: 'British',
          documentType: 'British Passport',
          checkDate,
          referenceNumber,
        };

      case 'B':
        // Valid time-limited right to work
        const expiryDate = new Date();
        expiryDate.setFullYear(expiryDate.getFullYear() + 2);
        return {
          verified: true,
          status: 'VALID',
          workRestriction: 'TIME_LIMITED',
          expiryDate,
          firstName: 'Test',
          lastName: 'Worker',
          nationality: 'EU Settlement',
          documentType: 'EU Settlement Scheme',
          checkDate,
          referenceNumber,
        };

      case 'C':
        // Valid limited right to work (hours restriction)
        return {
          verified: true,
          status: 'VALID',
          workRestriction: 'LIMITED',
          firstName: 'Test',
          lastName: 'Student',
          nationality: 'International',
          documentType: 'Student Visa',
          checkDate,
          referenceNumber,
        };

      case 'X':
        // Expired
        return {
          verified: false,
          status: 'EXPIRED',
          checkDate,
          referenceNumber,
          errorMessage: 'Share code has expired',
        };

      case 'Z':
        // Not found
        return {
          verified: false,
          status: 'NOT_FOUND',
          checkDate,
          errorMessage: 'Share code not found or date of birth does not match',
        };

      default:
        // Default: valid unlimited
        return {
          verified: true,
          status: 'VALID',
          workRestriction: 'UNLIMITED',
          firstName: 'Verified',
          lastName: 'Worker',
          checkDate,
          referenceNumber,
        };
    }
  }

  /**
   * Calls the Home Office Employer Checking Service API
   */
  private async callHomeOfficeAPI(shareCode: string, dateOfBirth: string): Promise<any> {
    const response = await fetch(`${this.apiBaseUrl}/check`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
        'X-Client-ID': this.clientId,
      },
      body: JSON.stringify({
        shareCode,
        dateOfBirth,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({})) as { message?: string };
      throw new Error(errorData.message || `API returned ${response.status}`);
    }

    return response.json();
  }

  /**
   * Parses the Home Office API response
   */
  private parseAPIResponse(response: any, checkDate: Date): RTWVerificationResult {
    // Map Home Office API response to our interface
    // This structure depends on the actual API response format
    
    if (response.status === 'valid') {
      return {
        verified: true,
        status: 'VALID',
        workRestriction: this.mapWorkRestriction(response.workRestriction),
        expiryDate: response.expiryDate ? new Date(response.expiryDate) : undefined,
        firstName: response.firstName,
        lastName: response.lastName,
        nationality: response.nationality,
        documentType: response.documentType,
        checkDate,
        referenceNumber: response.referenceNumber,
        rawResponse: response,
      };
    }

    if (response.status === 'expired') {
      return {
        verified: false,
        status: 'EXPIRED',
        checkDate,
        errorMessage: 'Right to work has expired',
        rawResponse: response,
      };
    }

    if (response.status === 'not_found') {
      return {
        verified: false,
        status: 'NOT_FOUND',
        checkDate,
        errorMessage: 'Share code not found or details do not match',
        rawResponse: response,
      };
    }

    return {
      verified: false,
      status: 'INVALID',
      checkDate,
      errorMessage: response.message || 'Verification failed',
      rawResponse: response,
    };
  }

  private mapWorkRestriction(restriction: string): 'UNLIMITED' | 'LIMITED' | 'TIME_LIMITED' {
    switch (restriction?.toLowerCase()) {
      case 'unlimited':
        return 'UNLIMITED';
      case 'limited':
        return 'LIMITED';
      case 'time_limited':
      case 'time-limited':
        return 'TIME_LIMITED';
      default:
        return 'UNLIMITED';
    }
  }

  /**
   * Generates an audit URL for storing the check result
   */
  generateAuditUrl(referenceNumber: string): string {
    return `${this.apiBaseUrl}/audit/${referenceNumber}`;
  }
}

export const rtwService = new RTWVerificationService();
export default RTWVerificationService;
