export type UserRole =
  | "OWNER"
  | "SPV"
  | "ADMIN"
  | "MANAGER"
  | "HR"
  | "PURCHASING"
  | "USER"
  | "PRODUKSI"
  | "SALES"
  | "FINANCE"
  | "SUPPLY_CHAIN"
  | "WAREHOUSE"
  | "OPERATIONS";

export type ActiveStatus = "Active" | "Inactive";

export type DocStatus =
  | "Draft"
  | "Sent"
  | "Approved"
  | "Rejected"
  | "Revised"
  | "Final"
  | "Review"
  | "Cancelled";

export type InvoiceStatus =
  | "Draft"
  | "Sent"
  | "Partial Paid"
  | "Paid"
  | "Overdue"
  | "Cancelled";

export type PaymentMethod = "Cash" | "Transfer" | "Cheque" | "Giro";

export interface User {
  id: string;
  email: string;
  username: string;
  role: UserRole;
  name?: string | null;
  isActive: boolean;
  createdAt?: string;
  fullName?: string;
  status?: ActiveStatus;
  phone?: string;
  department?: string;
  lastLogin?: string | null;
}
