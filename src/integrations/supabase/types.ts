export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      branches: {
        Row: {
          address: string | null
          created_at: string
          created_by: string | null
          id: string
          name: string
          organization_id: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          organization_id?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          organization_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "branches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      brands: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "brands_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          organization_id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          organization_id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          organization_id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_categories: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_categories_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          branch_id: string | null
          category_id: string | null
          created_at: string
          created_by: string | null
          description: string
          expense_date: string
          id: string
          notes: string | null
          organization_id: string
          receipt_url: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          branch_id?: string | null
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          description: string
          expense_date?: string
          id?: string
          notes?: string | null
          organization_id: string
          receipt_url?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          branch_id?: string | null
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          expense_date?: string
          id?: string
          notes?: string | null
          organization_id?: string
          receipt_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      held_orders: {
        Row: {
          branch_id: string | null
          created_at: string
          created_by: string | null
          customer_name: string | null
          id: string
          items: Json
          notes: string | null
          organization_id: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_name?: string | null
          id?: string
          items?: Json
          notes?: string | null
          organization_id: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_name?: string | null
          id?: string
          items?: Json
          notes?: string | null
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "held_orders_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "held_orders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          address: string | null
          created_at: string
          email: string | null
          id: string
          logo_url: string | null
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          logo_url?: string | null
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          branch_id: string
          brand_id: string | null
          category: Database["public"]["Enums"]["product_category"]
          cost_price: number
          created_at: string
          created_by: string | null
          current_stock: number
          description: string | null
          id: string
          item_type: Database["public"]["Enums"]["item_type"]
          low_stock_threshold: number
          name: string
          opening_stock: number
          organization_id: string
          out_of_stock_threshold: number
          selling_price: number
          sku: string | null
          supplier_id: string | null
          unit_id: string
          updated_at: string
        }
        Insert: {
          branch_id: string
          brand_id?: string | null
          category?: Database["public"]["Enums"]["product_category"]
          cost_price?: number
          created_at?: string
          created_by?: string | null
          current_stock?: number
          description?: string | null
          id?: string
          item_type?: Database["public"]["Enums"]["item_type"]
          low_stock_threshold?: number
          name: string
          opening_stock?: number
          organization_id: string
          out_of_stock_threshold?: number
          selling_price?: number
          sku?: string | null
          supplier_id?: string | null
          unit_id: string
          updated_at?: string
        }
        Update: {
          branch_id?: string
          brand_id?: string | null
          category?: Database["public"]["Enums"]["product_category"]
          cost_price?: number
          created_at?: string
          created_by?: string | null
          current_stock?: number
          description?: string | null
          id?: string
          item_type?: Database["public"]["Enums"]["item_type"]
          low_stock_threshold?: number
          name?: string
          opening_stock?: number
          organization_id?: string
          out_of_stock_threshold?: number
          selling_price?: number
          sku?: string | null
          supplier_id?: string | null
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          organization_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          organization_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          organization_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_items: {
        Row: {
          created_at: string
          id: string
          product_id: string
          purchase_id: string
          quantity: number
          total_cost: number
          unit_cost: number
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          purchase_id: string
          quantity: number
          total_cost: number
          unit_cost: number
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          purchase_id?: string
          quantity?: number
          total_cost?: number
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_items_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      purchases: {
        Row: {
          amount_paid: number
          branch_id: string
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          organization_id: string
          payment_status: Database["public"]["Enums"]["purchase_payment_status"]
          purchase_date: string
          purchase_number: string
          reference_number: string | null
          subtotal: number
          supplier_id: string
          tax_amount: number
          tax_rate: number
          total_amount: number
          updated_at: string
        }
        Insert: {
          amount_paid?: number
          branch_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          payment_status?: Database["public"]["Enums"]["purchase_payment_status"]
          purchase_date?: string
          purchase_number: string
          reference_number?: string | null
          subtotal?: number
          supplier_id: string
          tax_amount?: number
          tax_rate?: number
          total_amount?: number
          updated_at?: string
        }
        Update: {
          amount_paid?: number
          branch_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          payment_status?: Database["public"]["Enums"]["purchase_payment_status"]
          purchase_date?: string
          purchase_number?: string
          reference_number?: string | null
          subtotal?: number
          supplier_id?: string
          tax_amount?: number
          tax_rate?: number
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchases_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      role_module_permissions: {
        Row: {
          access_level: Database["public"]["Enums"]["module_access_level"]
          created_at: string
          id: string
          module: Database["public"]["Enums"]["app_module"]
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          access_level?: Database["public"]["Enums"]["module_access_level"]
          created_at?: string
          id?: string
          module: Database["public"]["Enums"]["app_module"]
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          access_level?: Database["public"]["Enums"]["module_access_level"]
          created_at?: string
          id?: string
          module?: Database["public"]["Enums"]["app_module"]
          organization_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_module_permissions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_items: {
        Row: {
          cost_price: number
          created_at: string
          discount_amount: number
          id: string
          product_id: string
          quantity: number
          sale_id: string
          total_price: number
          unit_price: number
        }
        Insert: {
          cost_price?: number
          created_at?: string
          discount_amount?: number
          id?: string
          product_id: string
          quantity: number
          sale_id: string
          total_price: number
          unit_price: number
        }
        Update: {
          cost_price?: number
          created_at?: string
          discount_amount?: number
          id?: string
          product_id?: string
          quantity?: number
          sale_id?: string
          total_price?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          branch_id: string | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          customer_name: string | null
          customer_phone: string | null
          discount_amount: number
          discount_percent: number
          id: string
          notes: string | null
          organization_id: string
          payment_details: Json | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          sale_number: string
          status: Database["public"]["Enums"]["sale_status"]
          subtotal: number
          tax_amount: number
          total_amount: number
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          discount_amount?: number
          discount_percent?: number
          id?: string
          notes?: string | null
          organization_id: string
          payment_details?: Json | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          sale_number: string
          status?: Database["public"]["Enums"]["sale_status"]
          subtotal?: number
          tax_amount?: number
          total_amount?: number
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          discount_amount?: number
          discount_percent?: number
          id?: string
          notes?: string | null
          organization_id?: string
          payment_details?: Json | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          sale_number?: string
          status?: Database["public"]["Enums"]["sale_status"]
          subtotal?: number
          tax_amount?: number
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_history: {
        Row: {
          change_amount: number
          change_type: string
          changed_by: string | null
          created_at: string
          id: string
          new_stock: number
          notes: string | null
          previous_stock: number
          product_id: string
        }
        Insert: {
          change_amount: number
          change_type: string
          changed_by?: string | null
          created_at?: string
          id?: string
          new_stock: number
          notes?: string | null
          previous_stock: number
          product_id: string
        }
        Update: {
          change_amount?: number
          change_type?: string
          changed_by?: string | null
          created_at?: string
          id?: string
          new_stock?: number
          notes?: string | null
          previous_stock?: number
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          organization_id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          organization_id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          organization_id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      units: {
        Row: {
          abbreviation: string | null
          created_at: string
          created_by: string | null
          id: string
          name: string
          organization_id: string | null
          updated_at: string
        }
        Insert: {
          abbreviation?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          organization_id?: string | null
          updated_at?: string
        }
        Update: {
          abbreviation?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          organization_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "units_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_branch_assignments: {
        Row: {
          branch_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_branch_assignments_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      user_module_permissions: {
        Row: {
          access_level: Database["public"]["Enums"]["module_access_level"]
          created_at: string
          id: string
          module: Database["public"]["Enums"]["app_module"]
          updated_at: string
          user_id: string
        }
        Insert: {
          access_level: Database["public"]["Enums"]["module_access_level"]
          created_at?: string
          id?: string
          module: Database["public"]["Enums"]["app_module"]
          updated_at?: string
          user_id: string
        }
        Update: {
          access_level?: Database["public"]["Enums"]["module_access_level"]
          created_at?: string
          id?: string
          module?: Database["public"]["Enums"]["app_module"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          organization_id: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_purchase_number: { Args: { org_id: string }; Returns: string }
      generate_sale_number: { Args: { org_id: string }; Returns: string }
      get_module_access: {
        Args: {
          _module: Database["public"]["Enums"]["app_module"]
          _user_id: string
        }
        Returns: Database["public"]["Enums"]["module_access_level"]
      }
      get_user_organization: { Args: { _user_id: string }; Returns: string }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_branch_access: {
        Args: { _branch_id: string; _user_id: string }
        Returns: boolean
      }
      has_module_access: {
        Args: {
          _min_level: Database["public"]["Enums"]["module_access_level"]
          _module: Database["public"]["Enums"]["app_module"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_same_organization: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_module: "pos" | "sales" | "purchases" | "expenses"
      app_role: "admin" | "user" | "super_admin"
      item_type: "product" | "service"
      module_access_level: "none" | "view" | "create" | "full"
      payment_method:
        | "cash"
        | "card"
        | "mobile_money"
        | "bank_transfer"
        | "credit"
      product_category: "sellable" | "consumable"
      purchase_payment_status: "pending" | "partial" | "paid"
      sale_status: "pending" | "completed" | "cancelled" | "on_hold"
      stock_status: "normal" | "low" | "out_of_stock"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_module: ["pos", "sales", "purchases", "expenses"],
      app_role: ["admin", "user", "super_admin"],
      item_type: ["product", "service"],
      module_access_level: ["none", "view", "create", "full"],
      payment_method: [
        "cash",
        "card",
        "mobile_money",
        "bank_transfer",
        "credit",
      ],
      product_category: ["sellable", "consumable"],
      purchase_payment_status: ["pending", "partial", "paid"],
      sale_status: ["pending", "completed", "cancelled", "on_hold"],
      stock_status: ["normal", "low", "out_of_stock"],
    },
  },
} as const
