import { prisma } from '../lib/prisma';
import { AppError } from './AppError';

export type DeploymentMode = 'AGENCY' | 'DIRECT_COMPANY';

/**
 * Check if organization is in Agency mode
 */
export const isAgencyMode = async (organizationId: string): Promise<boolean> => {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { deploymentMode: true },
  });
  return org?.deploymentMode === 'AGENCY';
};

/**
 * Check if organization is in Direct Company mode
 */
export const isDirectCompanyMode = async (organizationId: string): Promise<boolean> => {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { deploymentMode: true },
  });
  return org?.deploymentMode === 'DIRECT_COMPANY';
};

/**
 * Require Agency mode for certain operations
 */
export const requireAgencyMode = async (organizationId: string): Promise<void> => {
  const isAgency = await isAgencyMode(organizationId);
  if (!isAgency) {
    throw new AppError(
      'This feature is only available for staffing agencies',
      400,
      'AGENCY_MODE_REQUIRED'
    );
  }
};

/**
 * Get deployment mode specific defaults
 */
export const getModeDefaults = (mode: DeploymentMode) => {
  if (mode === 'AGENCY') {
    return {
      hasClientCompanies: true,
      hasChargeRates: true,
      hasInvoicing: true,
      hasClientPortal: true,
      workerLabel: 'Temps',
      onboardingSteps: ['BRANDING', 'LOCATION', 'SHIFT', 'WORKER', 'CLIENT', 'TEAM'],
    };
  }

  // DIRECT_COMPANY mode
  return {
    hasClientCompanies: false,
    hasChargeRates: false,
    hasInvoicing: false,
    hasClientPortal: false,
    workerLabel: 'Employees',
    onboardingSteps: ['BRANDING', 'LOCATION', 'SHIFT', 'WORKER', 'TEAM'], // No CLIENT step
  };
};

/**
 * Validate operation is allowed for deployment mode
 */
export const validateModeOperation = async (
  organizationId: string,
  operation: 'clients' | 'invoices' | 'chargeRates' | 'clientPortal'
): Promise<void> => {
  const isAgency = await isAgencyMode(organizationId);
  
  const agencyOnlyOperations = ['clients', 'invoices', 'chargeRates', 'clientPortal'];
  
  if (agencyOnlyOperations.includes(operation) && !isAgency) {
    throw new AppError(
      `${operation} is only available in Agency mode`,
      400,
      'AGENCY_MODE_REQUIRED'
    );
  }
};
