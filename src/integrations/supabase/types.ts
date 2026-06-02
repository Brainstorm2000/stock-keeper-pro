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
      action_task_staff: {
        Row: {
          created_at: string
          id: string
          staff_id: string
          task_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          staff_id: string
          task_id: string
        }
        Update: {
          created_at?: string
          id?: string
          staff_id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "action_task_staff_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_task_staff_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "action_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      action_tasks: {
        Row: {
          branch_id: string | null
          completion_date: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          organization_id: string
          priority: Database["public"]["Enums"]["task_priority"]
          staff_id: string
          start_date: string | null
          status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          completion_date?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          organization_id: string
          priority?: Database["public"]["Enums"]["task_priority"]
          staff_id: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          completion_date?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          organization_id?: string
          priority?: Database["public"]["Enums"]["task_priority"]
          staff_id?: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "action_tasks_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_tasks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_tasks_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance: {
        Row: {
          attendance_date: string
          branch_id: string | null
          clock_in_time: string | null
          clock_out_time: string | null
          created_at: string
          created_by: string | null
          department_id: string | null
          hours_worked: number | null
          id: string
          notes: string | null
          organization_id: string
          overtime_hours: number | null
          regular_hours: number | null
          shift_id: string
          staff_id: string
          status: string
          updated_at: string
        }
        Insert: {
          attendance_date: string
          branch_id?: string | null
          clock_in_time?: string | null
          clock_out_time?: string | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          hours_worked?: number | null
          id?: string
          notes?: string | null
          organization_id: string
          overtime_hours?: number | null
          regular_hours?: number | null
          shift_id: string
          staff_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          attendance_date?: string
          branch_id?: string | null
          clock_in_time?: string | null
          clock_out_time?: string | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          hours_worked?: number | null
          id?: string
          notes?: string | null
          organization_id?: string
          overtime_hours?: number | null
          regular_hours?: number | null
          shift_id?: string
          staff_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      bill_of_materials: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          labor_cost_per_unit: number
          name: string
          organization_id: string
          overhead_cost_per_unit: number
          product_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          labor_cost_per_unit?: number
          name: string
          organization_id: string
          overhead_cost_per_unit?: number
          product_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          labor_cost_per_unit?: number
          name?: string
          organization_id?: string
          overhead_cost_per_unit?: number
          product_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bill_of_materials_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_of_materials_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      bom_items: {
        Row: {
          bom_id: string
          created_at: string
          id: string
          quantity_required: number
          raw_material_id: string
        }
        Insert: {
          bom_id: string
          created_at?: string
          id?: string
          quantity_required: number
          raw_material_id: string
        }
        Update: {
          bom_id?: string
          created_at?: string
          id?: string
          quantity_required?: number
          raw_material_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bom_items_bom_id_fkey"
            columns: ["bom_id"]
            isOneToOne: false
            referencedRelation: "bill_of_materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bom_items_raw_material_id_fkey"
            columns: ["raw_material_id"]
            isOneToOne: false
            referencedRelation: "raw_materials"
            referencedColumns: ["id"]
          },
        ]
      }
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
          debt_limit: number
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
          debt_limit?: number
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
          debt_limit?: number
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
      debt_payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          notes: string | null
          organization_id: string
          paid_by: string | null
          payment_method: string
          sale_id: string
          sale_return_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          notes?: string | null
          organization_id: string
          paid_by?: string | null
          payment_method?: string
          sale_id: string
          sale_return_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          notes?: string | null
          organization_id?: string
          paid_by?: string | null
          payment_method?: string
          sale_id?: string
          sale_return_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "debt_payments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debt_payments_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
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
            foreignKeyName: "departments_organization_id_fkey"
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
      organization_modules: {
        Row: {
          created_at: string
          id: string
          is_enabled: boolean
          module: Database["public"]["Enums"]["app_module"]
          organization_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_enabled?: boolean
          module: Database["public"]["Enums"]["app_module"]
          organization_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_enabled?: boolean
          module?: Database["public"]["Enums"]["app_module"]
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_modules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_subscriptions: {
        Row: {
          billing_cycle: string
          created_at: string
          id: string
          monthly_price: number
          number_of_branches: number
          number_of_users: number
          organization_id: string
          plan_id: string | null
          status: string
          subscription_end_date: string | null
          subscription_start_date: string | null
          trial_end_date: string | null
          trial_start_date: string | null
          updated_at: string
        }
        Insert: {
          billing_cycle?: string
          created_at?: string
          id?: string
          monthly_price?: number
          number_of_branches?: number
          number_of_users?: number
          organization_id: string
          plan_id?: string | null
          status?: string
          subscription_end_date?: string | null
          subscription_start_date?: string | null
          trial_end_date?: string | null
          trial_start_date?: string | null
          updated_at?: string
        }
        Update: {
          billing_cycle?: string
          created_at?: string
          id?: string
          monthly_price?: number
          number_of_branches?: number
          number_of_users?: number
          organization_id?: string
          plan_id?: string | null
          status?: string
          subscription_end_date?: string | null
          subscription_start_date?: string | null
          trial_end_date?: string | null
          trial_start_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_subscriptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "pricing_plans"
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
          is_active: boolean
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
          is_active?: boolean
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
          is_active?: boolean
          logo_url?: string | null
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      pricing_config: {
        Row: {
          base_branches_included: number
          base_plan_price: number
          base_users_included: number
          created_at: string
          id: string
          price_per_extra_branch: number
          price_per_extra_user: number
          updated_at: string
          yearly_discount_percent: number
        }
        Insert: {
          base_branches_included?: number
          base_plan_price?: number
          base_users_included?: number
          created_at?: string
          id?: string
          price_per_extra_branch?: number
          price_per_extra_user?: number
          updated_at?: string
          yearly_discount_percent?: number
        }
        Update: {
          base_branches_included?: number
          base_plan_price?: number
          base_users_included?: number
          created_at?: string
          id?: string
          price_per_extra_branch?: number
          price_per_extra_user?: number
          updated_at?: string
          yearly_discount_percent?: number
        }
        Relationships: []
      }
      pricing_modules: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_enabled: boolean
          monthly_price: number
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_enabled?: boolean
          monthly_price?: number
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_enabled?: boolean
          monthly_price?: number
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      pricing_plans: {
        Row: {
          base_price: number
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          max_branches: number
          max_users: number
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          base_price?: number
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          max_branches?: number
          max_users?: number
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          base_price?: number
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          max_branches?: number
          max_users?: number
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      product_price_history: {
        Row: {
          change_type: string
          changed_by: string | null
          created_at: string
          id: string
          new_cost_price: number
          new_selling_price: number
          notes: string | null
          organization_id: string
          previous_cost_price: number
          previous_selling_price: number
          product_id: string
        }
        Insert: {
          change_type?: string
          changed_by?: string | null
          created_at?: string
          id?: string
          new_cost_price?: number
          new_selling_price?: number
          notes?: string | null
          organization_id: string
          previous_cost_price?: number
          previous_selling_price?: number
          product_id: string
        }
        Update: {
          change_type?: string
          changed_by?: string | null
          created_at?: string
          id?: string
          new_cost_price?: number
          new_selling_price?: number
          notes?: string | null
          organization_id?: string
          previous_cost_price?: number
          previous_selling_price?: number
          product_id?: string
        }
        Relationships: []
      }
      production_fields: {
        Row: {
          created_at: string
          id: string
          name: string
          options: Json | null
          required: boolean
          sort_order: number
          table_id: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          options?: Json | null
          required?: boolean
          sort_order?: number
          table_id: string
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          options?: Json | null
          required?: boolean
          sort_order?: number
          table_id?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_fields_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "production_tables"
            referencedColumns: ["id"]
          },
        ]
      }
      production_record_values: {
        Row: {
          created_at: string
          field_id: string
          id: string
          record_id: string
          value: string | null
        }
        Insert: {
          created_at?: string
          field_id: string
          id?: string
          record_id: string
          value?: string | null
        }
        Update: {
          created_at?: string
          field_id?: string
          id?: string
          record_id?: string
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "production_record_values_field_id_fkey"
            columns: ["field_id"]
            isOneToOne: false
            referencedRelation: "production_fields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_record_values_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "production_records"
            referencedColumns: ["id"]
          },
        ]
      }
      production_records: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          table_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          table_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          table_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_records_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "production_tables"
            referencedColumns: ["id"]
          },
        ]
      }
      production_tables: {
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
            foreignKeyName: "production_tables_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
          is_active: boolean
          organization_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean
          organization_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean
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
          selling_price: number
          total_cost: number
          unit_cost: number
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          purchase_id: string
          quantity: number
          selling_price?: number
          total_cost: number
          unit_cost: number
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          purchase_id?: string
          quantity?: number
          selling_price?: number
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
      purchase_return_items: {
        Row: {
          created_at: string
          id: string
          product_id: string
          quantity: number
          return_id: string
          total_cost: number
          unit_cost: number
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          quantity: number
          return_id: string
          total_cost?: number
          unit_cost?: number
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          quantity?: number
          return_id?: string
          total_cost?: number
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_return_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_return_items_return_id_fkey"
            columns: ["return_id"]
            isOneToOne: false
            referencedRelation: "purchase_returns"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_returns: {
        Row: {
          branch_id: string
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          organization_id: string
          purchase_id: string
          reason: string | null
          return_date: string
          return_number: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          purchase_id: string
          reason?: string | null
          return_date?: string
          return_number: string
          total_amount?: number
          updated_at?: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          purchase_id?: string
          reason?: string | null
          return_date?: string
          return_number?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_returns_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_returns_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_returns_purchase_id_fkey"
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
          receipt_url: string | null
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
          receipt_url?: string | null
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
          receipt_url?: string | null
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
      raw_material_stock_history: {
        Row: {
          change_amount: number
          change_type: string
          changed_by: string | null
          created_at: string
          id: string
          new_stock: number
          notes: string | null
          previous_stock: number
          raw_material_id: string
          reference_id: string | null
          reference_type: string | null
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
          raw_material_id: string
          reference_id?: string | null
          reference_type?: string | null
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
          raw_material_id?: string
          reference_id?: string | null
          reference_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "raw_material_stock_history_raw_material_id_fkey"
            columns: ["raw_material_id"]
            isOneToOne: false
            referencedRelation: "raw_materials"
            referencedColumns: ["id"]
          },
        ]
      }
      raw_materials: {
        Row: {
          cost_per_unit: number
          created_at: string
          created_by: string | null
          current_stock: number
          description: string | null
          id: string
          low_stock_threshold: number
          name: string
          organization_id: string
          sku: string | null
          unit_id: string
          updated_at: string
        }
        Insert: {
          cost_per_unit?: number
          created_at?: string
          created_by?: string | null
          current_stock?: number
          description?: string | null
          id?: string
          low_stock_threshold?: number
          name: string
          organization_id: string
          sku?: string | null
          unit_id: string
          updated_at?: string
        }
        Update: {
          cost_per_unit?: number
          created_at?: string
          created_by?: string | null
          current_stock?: number
          description?: string | null
          id?: string
          low_stock_threshold?: number
          name?: string
          organization_id?: string
          sku?: string | null
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "raw_materials_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "raw_materials_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      role_module_permissions: {
        Row: {
          can_create: boolean
          can_delete: boolean
          can_edit: boolean
          can_view: boolean
          created_at: string
          id: string
          module: Database["public"]["Enums"]["app_module"]
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          can_create?: boolean
          can_delete?: boolean
          can_edit?: boolean
          can_view?: boolean
          created_at?: string
          id?: string
          module: Database["public"]["Enums"]["app_module"]
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          can_create?: boolean
          can_delete?: boolean
          can_edit?: boolean
          can_view?: boolean
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
      sale_return_items: {
        Row: {
          created_at: string
          id: string
          product_id: string
          quantity: number
          return_id: string
          total_price: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          quantity: number
          return_id: string
          total_price?: number
          unit_price?: number
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          quantity?: number
          return_id?: string
          total_price?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_return_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_return_items_return_id_fkey"
            columns: ["return_id"]
            isOneToOne: false
            referencedRelation: "sale_returns"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_returns: {
        Row: {
          branch_id: string | null
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          organization_id: string
          reason: string | null
          refund_method: string
          return_date: string
          return_number: string
          sale_id: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          reason?: string | null
          refund_method?: string
          return_date?: string
          return_number: string
          sale_id: string
          total_amount?: number
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          reason?: string | null
          refund_method?: string
          return_date?: string
          return_number?: string
          sale_id?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sale_returns_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_returns_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_returns_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          amount_paid: number
          balance_due: number
          branch_id: string | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          customer_name: string | null
          customer_phone: string | null
          discount_amount: number
          discount_percent: number
          due_date: string | null
          id: string
          notes: string | null
          organization_id: string
          payment_details: Json | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          payment_status: string
          sale_number: string
          status: Database["public"]["Enums"]["sale_status"]
          subtotal: number
          tax_amount: number
          total_amount: number
          updated_at: string
        }
        Insert: {
          amount_paid?: number
          balance_due?: number
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          discount_amount?: number
          discount_percent?: number
          due_date?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          payment_details?: Json | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          payment_status?: string
          sale_number: string
          status?: Database["public"]["Enums"]["sale_status"]
          subtotal?: number
          tax_amount?: number
          total_amount?: number
          updated_at?: string
        }
        Update: {
          amount_paid?: number
          balance_due?: number
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          discount_amount?: number
          discount_percent?: number
          due_date?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          payment_details?: Json | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          payment_status?: string
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
      shifts: {
        Row: {
          branch_id: string | null
          clockin_start_time: string
          created_at: string
          created_by: string | null
          department_id: string | null
          end_time: string
          grace_period_minutes: number
          id: string
          is_active: boolean
          organization_id: string
          overtime_start_time: string | null
          shift_name: string
          start_time: string
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          clockin_start_time: string
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          end_time: string
          grace_period_minutes?: number
          id?: string
          is_active?: boolean
          organization_id: string
          overtime_start_time?: string | null
          shift_name: string
          start_time: string
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          clockin_start_time?: string
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          end_time?: string
          grace_period_minutes?: number
          id?: string
          is_active?: boolean
          organization_id?: string
          overtime_start_time?: string | null
          shift_name?: string
          start_time?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shifts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      staff: {
        Row: {
          branch_id: string | null
          created_at: string
          created_by: string | null
          department: string | null
          department_id: string | null
          email: string | null
          employment_date: string | null
          full_name: string
          id: string
          is_active: boolean
          notes: string | null
          organization_id: string
          phone: string | null
          photo_url: string | null
          role: string | null
          role_id: string | null
          staff_id: string | null
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          department?: string | null
          department_id?: string | null
          email?: string | null
          employment_date?: string | null
          full_name: string
          id?: string
          is_active?: boolean
          notes?: string | null
          organization_id: string
          phone?: string | null
          photo_url?: string | null
          role?: string | null
          role_id?: string | null
          staff_id?: string | null
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          department?: string | null
          department_id?: string | null
          email?: string | null
          employment_date?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          organization_id?: string
          phone?: string | null
          photo_url?: string | null
          role?: string | null
          role_id?: string | null
          staff_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "staff_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_positions: {
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
            foreignKeyName: "staff_positions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_roles: {
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
            foreignKeyName: "staff_roles_organization_id_fkey"
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
      subscription_modules: {
        Row: {
          created_at: string
          id: string
          pricing_module_id: string
          subscription_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          pricing_module_id: string
          subscription_id: string
        }
        Update: {
          created_at?: string
          id?: string
          pricing_module_id?: string
          subscription_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_modules_pricing_module_id_fkey"
            columns: ["pricing_module_id"]
            isOneToOne: false
            referencedRelation: "pricing_modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_modules_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "organization_subscriptions"
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
      task_comments: {
        Row: {
          comment: string
          created_at: string
          id: string
          organization_id: string
          task_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          comment: string
          created_at?: string
          id?: string
          organization_id: string
          task_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          comment?: string
          created_at?: string
          id?: string
          organization_id?: string
          task_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_comments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "action_tasks"
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
          can_create: boolean
          can_delete: boolean
          can_edit: boolean
          can_view: boolean
          created_at: string
          id: string
          module: Database["public"]["Enums"]["app_module"]
          updated_at: string
          user_id: string
        }
        Insert: {
          can_create?: boolean
          can_delete?: boolean
          can_edit?: boolean
          can_view?: boolean
          created_at?: string
          id?: string
          module: Database["public"]["Enums"]["app_module"]
          updated_at?: string
          user_id: string
        }
        Update: {
          can_create?: boolean
          can_delete?: boolean
          can_edit?: boolean
          can_view?: boolean
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
      work_order_materials: {
        Row: {
          created_at: string
          id: string
          quantity_required: number
          quantity_used: number
          raw_material_id: string
          total_cost: number
          unit_cost: number
          work_order_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          quantity_required: number
          quantity_used?: number
          raw_material_id: string
          total_cost?: number
          unit_cost?: number
          work_order_id: string
        }
        Update: {
          created_at?: string
          id?: string
          quantity_required?: number
          quantity_used?: number
          raw_material_id?: string
          total_cost?: number
          unit_cost?: number
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_order_materials_raw_material_id_fkey"
            columns: ["raw_material_id"]
            isOneToOne: false
            referencedRelation: "raw_materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_materials_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      work_orders: {
        Row: {
          approved_at: string | null
          bom_id: string
          branch_id: string | null
          completed_at: string | null
          cost_per_unit: number
          created_at: string
          created_by: string | null
          id: string
          labor_cost: number
          material_cost: number
          notes: string | null
          organization_id: string
          overhead_cost: number
          product_id: string
          quantity: number
          status: string
          total_cost: number
          updated_at: string
          work_order_number: string
        }
        Insert: {
          approved_at?: string | null
          bom_id: string
          branch_id?: string | null
          completed_at?: string | null
          cost_per_unit?: number
          created_at?: string
          created_by?: string | null
          id?: string
          labor_cost?: number
          material_cost?: number
          notes?: string | null
          organization_id: string
          overhead_cost?: number
          product_id: string
          quantity: number
          status?: string
          total_cost?: number
          updated_at?: string
          work_order_number: string
        }
        Update: {
          approved_at?: string | null
          bom_id?: string
          branch_id?: string | null
          completed_at?: string | null
          cost_per_unit?: number
          created_at?: string
          created_by?: string | null
          id?: string
          labor_cost?: number
          material_cost?: number
          notes?: string | null
          organization_id?: string
          overhead_cost?: number
          product_id?: string
          quantity?: number
          status?: string
          total_cost?: number
          updated_at?: string
          work_order_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_orders_bom_id_fkey"
            columns: ["bom_id"]
            isOneToOne: false
            referencedRelation: "bill_of_materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
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
      generate_purchase_return_number: {
        Args: { org_id: string }
        Returns: string
      }
      generate_sale_number: { Args: { org_id: string }; Returns: string }
      generate_sale_return_number: { Args: { org_id: string }; Returns: string }
      generate_work_order_number: { Args: { org_id: string }; Returns: string }
      get_org_user_names: {
        Args: { _user_ids: string[] }
        Returns: {
          full_name: string
          user_id: string
        }[]
      }
      get_user_organization: { Args: { _user_id: string }; Returns: string }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_active_subscription: { Args: { _user_id: string }; Returns: boolean }
      has_branch_access: {
        Args: { _branch_id: string; _user_id: string }
        Returns: boolean
      }
      has_module_permission: {
        Args: {
          _module: Database["public"]["Enums"]["app_module"]
          _permission: string
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
      is_module_enabled_for_org: {
        Args: {
          _module: Database["public"]["Enums"]["app_module"]
          _org_id: string
        }
        Returns: boolean
      }
      is_same_organization: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      is_super_super_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_module:
        | "pos"
        | "sales"
        | "purchases"
        | "expenses"
        | "production"
        | "reports"
        | "staff"
        | "tasks"
        | "debts"
        | "returns"
        | "products"
      app_role: "admin" | "user" | "super_admin" | "super_super_admin"
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
      task_priority: "low" | "medium" | "high"
      task_status: "pending" | "in_progress" | "completed"
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
      app_module: [
        "pos",
        "sales",
        "purchases",
        "expenses",
        "production",
        "reports",
        "staff",
        "tasks",
        "debts",
        "returns",
        "products",
      ],
      app_role: ["admin", "user", "super_admin", "super_super_admin"],
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
      task_priority: ["low", "medium", "high"],
      task_status: ["pending", "in_progress", "completed"],
    },
  },
} as const
