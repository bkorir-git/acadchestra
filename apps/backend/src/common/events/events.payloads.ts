/**
 * @description Typed payloads for each emitted event.
 */
export interface TermActivatedPayload {
  tenantId: string;
  termId: string;
  academicYearId: string;
  actorId: string;
  termName: string;
}

export interface TermStartingSoonPayload {
  tenantId: string;
  termId: string;
  termName: string;
  startDate: Date;
  daysUntilStart: number;
}

export interface TermOverduePayload {
  tenantId: string;
  termId: string;
  termName: string;
  startDate: Date;
  daysOverdue: number;
}

export interface BillingGeneratedPayload {
  tenantId: string;
  feeStructureId: string;
  termId?: string;
  generated: number;
  skipped: number;
  total: number;
  actorId: string;
}

export interface StudentFeeCreatedPayload {
  tenantId: string;
  studentId: string;
  studentFeeId: string;
  amount: number;
  dueDate?: Date | null;
}

export interface PaymentRecordedPayload {
  tenantId: string;
  studentId: string;
  paymentId: string;
  amount: number;
  receiptNumber: string;
  studentFeeId: string;
}

export interface PaymentVoidedPayload {
  tenantId: string;
  studentId: string;
  paymentId: string;
  receiptNumber: string;
  reason: string;
}

export interface OverpaymentDetectedPayload {
  tenantId: string;
  studentId: string;
  paymentId: string;
  amount: number;
}

export interface DiscountAppliedPayload {
  tenantId: string;
  studentId: string;
  discountId: string;
  amount: number;
}

export interface FeeDueSoonPayload {
  tenantId: string;
  studentId: string;
  studentFeeId: string;
  amount: number;
  dueDate: Date;
  daysUntilDue: number;
}

export interface FeeOverduePayload {
  tenantId: string;
  studentId: string;
  studentFeeId: string;
  amount: number;
  dueDate: Date;
  daysOverdue: number;
}

export interface StudentPromotedPayload {
  tenantId: string;
  studentId: string;
  fromClassId: string | null;
  toClassId: string | null;
  academicYearId: string;
  actorId: string;
}

export interface ArrearsRolledOverPayload {
  tenantId: string;
  studentId: string;
  amount: number;
  fromTermId?: string;
  toStudentFeeId: string;
}