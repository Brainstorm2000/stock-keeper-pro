import Dexie, { type EntityTable } from "dexie";
import type { Customer } from "@/hooks/useCustomers";
import type { Product } from "@/hooks/useProducts";
import type { Sale, SaleItem } from "@/hooks/useSales";
import type { Staff } from "@/hooks/useStaff";

export interface LocalRecord<T> {
  id: string;
  data: T;
  isSynced: boolean;
  updatedAt: string;
  deletedAt?: string;
  syncError?: string;
  syncBlocked?: boolean;
}

export type LocalProduct = LocalRecord<Product>;
export type LocalCustomer = LocalRecord<Customer>;
export type LocalSale = LocalRecord<Sale>;
export type LocalSaleItem = LocalRecord<SaleItem & { sale_id: string }>;
export type LocalStockHistory = LocalRecord<Record<string, unknown>>;
export type LocalAttendance = LocalRecord<Record<string, unknown>>;
export type LocalStaff = LocalRecord<Staff>;

class StockKeeperDatabase extends Dexie {
  products!: EntityTable<LocalProduct, "id">;
  customers!: EntityTable<LocalCustomer, "id">;
  sales!: EntityTable<LocalSale, "id">;
  saleItems!: EntityTable<LocalSaleItem, "id">;
  stockHistory!: EntityTable<LocalStockHistory, "id">;
  attendance!: EntityTable<LocalAttendance, "id">;
  staff!: EntityTable<LocalStaff, "id">;

  constructor() {
    super("stockflow-local");
    this.version(1).stores({
      products: "id, isSynced, updatedAt, data.branch_id, data.organization_id",
      customers: "id, isSynced, updatedAt, data.organization_id, data.branch_id",
      sales: "id, isSynced, updatedAt, data.organization_id, data.branch_id",
      saleItems: "id, isSynced, updatedAt, data.sale_id, data.product_id",
      stockHistory: "id, isSynced, updatedAt, data.product_id",
    });
    this.version(2).stores({
      attendance: "id, isSynced, updatedAt, data.organization_id, data.staff_id, data.attendance_date",
      staff: "id, isSynced, updatedAt, data.organization_id, data.branch_id",
    });
  }
}

export const localDb = new StockKeeperDatabase();