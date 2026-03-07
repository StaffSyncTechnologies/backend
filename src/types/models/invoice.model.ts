import { InvoiceStatus } from '@prisma/client';

export interface IInvoice {
  id: string;
  invoiceNumber: string;
  clientCompanyId: string;
  organizationId: string;
  status: InvoiceStatus;
  issueDate: Date;
  dueDate: Date;
  subtotal: number;
  taxAmount: number;
  total: number;

  // Computed
  isOverdue: boolean;
  daysPastDue: number;
  isPaid: boolean;
}

export interface InvoiceLineItem {
  id: string;
  invoiceId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  amount: number;
  shiftId?: string;
  workerId?: string;
}

export interface InvoiceGeneration {
  clientCompanyId: string;
  periodStart: Date;
  periodEnd: Date;
  includeShiftIds?: string[];
  excludeShiftIds?: string[];
  groupBy?: 'SHIFT' | 'WORKER' | 'LOCATION' | 'DAY';
  notes?: string;
}

export interface InvoiceSummary {
  organizationId: string;
  period: 'week' | 'month' | 'quarter' | 'year';
  totalInvoiced: number;
  totalPaid: number;
  totalOutstanding: number;
  totalOverdue: number;
  invoiceCount: number;
  avgDaysToPay: number;
}

export interface PaymentRecord {
  invoiceId: string;
  amount: number;
  paidAt: Date;
  paymentMethod: 'BANK_TRANSFER' | 'CARD' | 'CASH' | 'OTHER';
  reference?: string;
  notes?: string;
}

export interface InvoiceReminder {
  invoiceId: string;
  type: 'UPCOMING_DUE' | 'DUE_TODAY' | 'OVERDUE' | 'FINAL_NOTICE';
  sentAt: Date;
  sentTo: string[];
  channel: 'EMAIL' | 'SMS';
}

export interface CreditNote {
  id: string;
  invoiceId: string;
  creditNumber: string;
  amount: number;
  reason: string;
  issuedAt: Date;
  issuedBy: string;
}
