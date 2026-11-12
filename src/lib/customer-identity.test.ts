import { describe, expect, it } from "vitest";
import {
  findDuplicateCustomerContact,
  normalizeCustomerEmail,
  normalizeCustomerPhone,
  type CustomerContact,
} from "./customer-identity";

const customers: CustomerContact[] = [
  {
    id: "customer-1",
    name: "Alex Doe",
    branch_id: null,
    email: "alex@example.com",
    phone: "+1 (555) 010-0200",
  },
];

describe("customer contact identity", () => {
  it("normalizes email casing and surrounding whitespace", () => {
    expect(normalizeCustomerEmail("  Alex@Example.com ")).toBe("alex@example.com");
  });

  it("normalizes phone numbers to digits", () => {
    expect(normalizeCustomerPhone("+1 (555) 010-0200")).toBe("15550100200");
  });

  it("finds duplicate email and phone values independent of formatting", () => {
    expect(findDuplicateCustomerContact({ email: " ALEX@example.com " }, customers))
      .toMatchObject({ field: "email", customer: { id: "customer-1" } });
    expect(findDuplicateCustomerContact({ phone: "1555-010-0200" }, customers))
      .toMatchObject({ field: "phone", customer: { id: "customer-1" } });
  });

  it("allows the current customer to retain their own contact details", () => {
    expect(
      findDuplicateCustomerContact(
        { email: "alex@example.com", phone: "+1 555 010 0200" },
        customers,
        "customer-1",
      ),
    ).toBeNull();
  });

  it("rejects duplicate contacts within the same branch", () => {
    const branchCustomers = [
      { ...customers[0], branch_id: "branch-1" },
    ];
    expect(
      findDuplicateCustomerContact(
        { branch_id: "branch-1", email: "alex@example.com" },
        branchCustomers,
      ),
    ).toMatchObject({ field: "email", customer: { id: "customer-1" } });
  });

  it("allows duplicate contacts in different branches", () => {
    const branchCustomers = [
      { ...customers[0], branch_id: "branch-1" },
    ];
    expect(
      findDuplicateCustomerContact(
        {
          branch_id: "branch-2",
          email: "alex@example.com",
          phone: "+1 555 010 0200",
        },
        branchCustomers,
      ),
    ).toBeNull();
  });

  it("ignores empty contact values", () => {
    expect(findDuplicateCustomerContact({ email: " ", phone: "(---)" }, customers)).toBeNull();
  });
});
