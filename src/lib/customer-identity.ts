export interface CustomerContact {
  id: string;
  name: string;
  branch_id?: string | null;
  email: string | null;
  phone: string | null;
}

export interface CustomerContactInput {
  branch_id?: string | null;
  email?: string | null;
  phone?: string | null;
}

export function normalizeCustomerEmail(email?: string | null) {
  const normalized = email?.trim().toLowerCase();
  return normalized || null;
}

export function normalizeCustomerPhone(phone?: string | null) {
  const normalized = phone?.replace(/\D/g, "");
  return normalized || null;
}

export function findDuplicateCustomerContact(
  input: CustomerContactInput,
  customers: CustomerContact[],
  excludeId?: string,
) {
  const email = normalizeCustomerEmail(input.email);
  if (email) {
    const duplicate = customers.find(
      (customer) =>
        customer.id !== excludeId &&
        (customer.branch_id ?? null) === (input.branch_id ?? null) &&
        normalizeCustomerEmail(customer.email) === email,
    );
    if (duplicate) return { field: "email" as const, customer: duplicate };
  }

  const phone = normalizeCustomerPhone(input.phone);
  if (phone) {
    const duplicate = customers.find(
      (customer) =>
        customer.id !== excludeId &&
        (customer.branch_id ?? null) === (input.branch_id ?? null) &&
        normalizeCustomerPhone(customer.phone) === phone,
    );
    if (duplicate) return { field: "phone" as const, customer: duplicate };
  }

  return null;
}
