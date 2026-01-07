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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      app_users: {
        Row: {
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          name: string
          role: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          role?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          role?: string | null
        }
        Relationships: []
      }
      automation_logs: {
        Row: {
          action_result: Json | null
          id: string
          rule_id: string
          status: string
          task_id: string | null
          trigger_data: Json | null
          triggered_at: string
        }
        Insert: {
          action_result?: Json | null
          id?: string
          rule_id: string
          status?: string
          task_id?: string | null
          trigger_data?: Json | null
          triggered_at?: string
        }
        Update: {
          action_result?: Json | null
          id?: string
          rule_id?: string
          status?: string
          task_id?: string | null
          trigger_data?: Json | null
          triggered_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_logs_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "automation_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_logs_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_rules: {
        Row: {
          action_config: Json
          action_type: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          last_triggered_at: string | null
          name: string
          trigger_config: Json
          trigger_type: string
          updated_at: string
        }
        Insert: {
          action_config?: Json
          action_type: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          last_triggered_at?: string | null
          name: string
          trigger_config?: Json
          trigger_type: string
          updated_at?: string
        }
        Update: {
          action_config?: Json
          action_type?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          last_triggered_at?: string | null
          name?: string
          trigger_config?: Json
          trigger_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      contacts: {
        Row: {
          address: string | null
          city: string | null
          company_name: string | null
          created_at: string
          document: string | null
          email: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          phone: string | null
          state: string | null
          type: string
          updated_at: string
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          company_name?: string | null
          created_at?: string
          document?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          phone?: string | null
          state?: string | null
          type?: string
          updated_at?: string
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          company_name?: string | null
          created_at?: string
          document?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          phone?: string | null
          state?: string | null
          type?: string
          updated_at?: string
          zip_code?: string | null
        }
        Relationships: []
      }
      financial_accounts: {
        Row: {
          account_number: string | null
          agency: string | null
          bank_name: string | null
          created_at: string
          current_balance: number
          id: string
          initial_balance: number
          is_active: boolean
          name: string
          type: string
          updated_at: string
        }
        Insert: {
          account_number?: string | null
          agency?: string | null
          bank_name?: string | null
          created_at?: string
          current_balance?: number
          id?: string
          initial_balance?: number
          is_active?: boolean
          name: string
          type: string
          updated_at?: string
        }
        Update: {
          account_number?: string | null
          agency?: string | null
          bank_name?: string | null
          created_at?: string
          current_balance?: number
          id?: string
          initial_balance?: number
          is_active?: boolean
          name?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      financial_categories: {
        Row: {
          color: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          type: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          type: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          type?: string
        }
        Relationships: []
      }
      financial_entries: {
        Row: {
          account_id: string | null
          category_id: string | null
          conciliated_at: string | null
          contact_id: string | null
          created_at: string
          description: string
          document_number: string | null
          due_date: string
          id: string
          is_conciliated: boolean
          notes: string | null
          order_id: string | null
          payment_date: string | null
          type: string
          updated_at: string
          value: number
          value_paid: number
        }
        Insert: {
          account_id?: string | null
          category_id?: string | null
          conciliated_at?: string | null
          contact_id?: string | null
          created_at?: string
          description: string
          document_number?: string | null
          due_date: string
          id?: string
          is_conciliated?: boolean
          notes?: string | null
          order_id?: string | null
          payment_date?: string | null
          type: string
          updated_at?: string
          value: number
          value_paid?: number
        }
        Update: {
          account_id?: string | null
          category_id?: string | null
          conciliated_at?: string | null
          contact_id?: string | null
          created_at?: string
          description?: string
          document_number?: string | null
          due_date?: string
          id?: string
          is_conciliated?: boolean
          notes?: string | null
          order_id?: string | null
          payment_date?: string | null
          type?: string
          updated_at?: string
          value?: number
          value_paid?: number
        }
        Relationships: [
          {
            foreignKeyName: "financial_entries_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "financial_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_entries_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "financial_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_entries_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_entries_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_movements: {
        Row: {
          account_id: string | null
          created_at: string
          created_by: string | null
          entry_id: string
          id: string
          movement_date: string
          notes: string | null
          value: number
        }
        Insert: {
          account_id?: string | null
          created_at?: string
          created_by?: string | null
          entry_id: string
          id?: string
          movement_date?: string
          notes?: string | null
          value: number
        }
        Update: {
          account_id?: string | null
          created_at?: string
          created_by?: string | null
          entry_id?: string
          id?: string
          movement_date?: string
          notes?: string | null
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "financial_movements_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "financial_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_movements_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "financial_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory: {
        Row: {
          id: string
          location: string | null
          location_id: string | null
          product_id: string
          quantity: number
          updated_at: string
        }
        Insert: {
          id?: string
          location?: string | null
          location_id?: string | null
          product_id: string
          quantity?: number
          updated_at?: string
        }
        Update: {
          id?: string
          location?: string | null
          location_id?: string | null
          product_id?: string
          quantity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "storage_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_movements: {
        Row: {
          created_at: string
          created_by: string | null
          from_location: string | null
          id: string
          location: string | null
          movement_type: string
          new_balance: number
          notes: string | null
          previous_balance: number
          product_id: string
          quantity: number
          reference_id: string | null
          reference_type: string | null
          to_location: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          from_location?: string | null
          id?: string
          location?: string | null
          movement_type: string
          new_balance?: number
          notes?: string | null
          previous_balance?: number
          product_id: string
          quantity: number
          reference_id?: string | null
          reference_type?: string | null
          to_location?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          from_location?: string | null
          id?: string
          location?: string | null
          movement_type?: string
          new_balance?: number
          notes?: string | null
          previous_balance?: number
          product_id?: string
          quantity?: number
          reference_id?: string | null
          reference_type?: string | null
          to_location?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_items: {
        Row: {
          created_at: string
          description: string | null
          duration_minutes: number | null
          id: string
          item_type: string
          meeting_id: string
          notes: string | null
          order_index: number
          owner_id: string | null
          status: string
          task_id: string | null
          title: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          item_type?: string
          meeting_id: string
          notes?: string | null
          order_index?: number
          owner_id?: string | null
          status?: string
          task_id?: string | null
          title: string
        }
        Update: {
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          item_type?: string
          meeting_id?: string
          notes?: string | null
          order_index?: number
          owner_id?: string | null
          status?: string
          task_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_items_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_items_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_items_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_participants: {
        Row: {
          confirmed: boolean | null
          id: string
          meeting_id: string
          role: string | null
          user_id: string
        }
        Insert: {
          confirmed?: boolean | null
          id?: string
          meeting_id: string
          role?: string | null
          user_id: string
        }
        Update: {
          confirmed?: boolean | null
          id?: string
          meeting_id?: string
          role?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_participants_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      meetings: {
        Row: {
          created_at: string
          decisions: string | null
          duration_minutes: number
          id: string
          location: string | null
          meeting_date: string
          notes: string | null
          objective: string | null
          owner_id: string | null
          start_time: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          decisions?: string | null
          duration_minutes?: number
          id?: string
          location?: string | null
          meeting_date: string
          notes?: string | null
          objective?: string | null
          owner_id?: string | null
          start_time: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          decisions?: string | null
          duration_minutes?: number
          id?: string
          location?: string | null
          meeting_date?: string
          notes?: string | null
          objective?: string | null
          owner_id?: string | null
          start_time?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meetings_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      nodes: {
        Row: {
          color: string
          created_at: string
          id: string
          is_visible: boolean
          media_urls: Json | null
          order_index: number
          parent_id: string | null
          title: string
        }
        Insert: {
          color: string
          created_at?: string
          id?: string
          is_visible?: boolean
          media_urls?: Json | null
          order_index?: number
          parent_id?: string | null
          title: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          is_visible?: boolean
          media_urls?: Json | null
          order_index?: number
          parent_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "nodes_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      on_hold_log: {
        Row: {
          action: string
          created_at: string
          id: string
          previous_data: Json | null
          task_id: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          previous_data?: Json | null
          task_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          previous_data?: Json | null
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "on_hold_log_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          id: string
          notes: string | null
          order_id: string
          product_id: string
          quantity: number
          unit_price: number | null
        }
        Insert: {
          id?: string
          notes?: string | null
          order_id: string
          product_id: string
          quantity?: number
          unit_price?: number | null
        }
        Update: {
          id?: string
          notes?: string | null
          order_id?: string
          product_id?: string
          quantity?: number
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          channel: string | null
          contact_id: string | null
          created_at: string
          customer_contact: string | null
          customer_name: string | null
          deleted_at: string | null
          delivery_date: string | null
          due_date: string | null
          id: string
          notes: string | null
          order_date: string
          order_number: string | null
          production_date: string | null
          production_notes: string | null
          status: string
          total_value: number | null
          updated_at: string
        }
        Insert: {
          channel?: string | null
          contact_id?: string | null
          created_at?: string
          customer_contact?: string | null
          customer_name?: string | null
          deleted_at?: string | null
          delivery_date?: string | null
          due_date?: string | null
          id?: string
          notes?: string | null
          order_date?: string
          order_number?: string | null
          production_date?: string | null
          production_notes?: string | null
          status?: string
          total_value?: number | null
          updated_at?: string
        }
        Update: {
          channel?: string | null
          contact_id?: string | null
          created_at?: string
          customer_contact?: string | null
          customer_name?: string | null
          deleted_at?: string | null
          delivery_date?: string | null
          due_date?: string | null
          id?: string
          notes?: string | null
          order_date?: string
          order_number?: string | null
          production_date?: string | null
          production_notes?: string | null
          status?: string
          total_value?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          channel_data: Json | null
          channels: Json | null
          checklist: Json | null
          content: string | null
          created_at: string
          id: string
          media_urls: Json | null
          node_id: string | null
          scheduled_date: string | null
          scheduled_time: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          channel_data?: Json | null
          channels?: Json | null
          checklist?: Json | null
          content?: string | null
          created_at?: string
          id?: string
          media_urls?: Json | null
          node_id?: string | null
          scheduled_date?: string | null
          scheduled_time?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          channel_data?: Json | null
          channels?: Json | null
          checklist?: Json | null
          content?: string | null
          created_at?: string
          id?: string
          media_urls?: Json | null
          node_id?: string | null
          scheduled_date?: string | null
          scheduled_time?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "posts_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      processes: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          unit: string
          updated_at: string
          value_per_unit: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          unit?: string
          updated_at?: string
          value_per_unit?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          unit?: string
          updated_at?: string
          value_per_unit?: number
        }
        Relationships: []
      }
      product_components: {
        Row: {
          component_id: string
          created_at: string
          id: string
          notes: string | null
          product_id: string
          qty_per_unit: number
        }
        Insert: {
          component_id: string
          created_at?: string
          id?: string
          notes?: string | null
          product_id: string
          qty_per_unit?: number
        }
        Update: {
          component_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          product_id?: string
          qty_per_unit?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_components_component_id_fkey"
            columns: ["component_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_components_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_optional_costs: {
        Row: {
          cost_per_unit: number
          created_at: string
          id: string
          is_active: boolean
          name: string
          product_id: string
        }
        Insert: {
          cost_per_unit?: number
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          product_id: string
        }
        Update: {
          cost_per_unit?: number
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_optional_costs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_processes: {
        Row: {
          cost_per_unit: number
          created_at: string
          id: string
          process_id: string
          product_id: string
        }
        Insert: {
          cost_per_unit?: number
          created_at?: string
          id?: string
          process_id: string
          product_id: string
        }
        Update: {
          cost_per_unit?: number
          created_at?: string
          id?: string
          process_id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_processes_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "processes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_processes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      production_closing_items: {
        Row: {
          closing_id: string
          employee_name: string
          id: string
          process_id: string | null
          total_quantity: number
          total_value: number
        }
        Insert: {
          closing_id: string
          employee_name: string
          id?: string
          process_id?: string | null
          total_quantity?: number
          total_value?: number
        }
        Update: {
          closing_id?: string
          employee_name?: string
          id?: string
          process_id?: string | null
          total_quantity?: number
          total_value?: number
        }
        Relationships: [
          {
            foreignKeyName: "production_closing_items_closing_id_fkey"
            columns: ["closing_id"]
            isOneToOne: false
            referencedRelation: "production_closings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_closing_items_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "processes"
            referencedColumns: ["id"]
          },
        ]
      }
      production_closings: {
        Row: {
          closed_at: string | null
          created_at: string
          end_date: string
          id: string
          notes: string | null
          start_date: string
          status: string
          total_value: number
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          end_date: string
          id?: string
          notes?: string | null
          start_date: string
          status?: string
          total_value?: number
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          end_date?: string
          id?: string
          notes?: string | null
          start_date?: string
          status?: string
          total_value?: number
        }
        Relationships: []
      }
      production_entries: {
        Row: {
          created_at: string
          date: string
          employee_name: string
          id: string
          notes: string | null
          period: string
          process_id: string
          production_order_id: string
          quantity: number
          total_value: number | null
          updated_at: string
          value_per_unit: number
        }
        Insert: {
          created_at?: string
          date?: string
          employee_name: string
          id?: string
          notes?: string | null
          period?: string
          process_id: string
          production_order_id: string
          quantity?: number
          total_value?: number | null
          updated_at?: string
          value_per_unit?: number
        }
        Update: {
          created_at?: string
          date?: string
          employee_name?: string
          id?: string
          notes?: string | null
          period?: string
          process_id?: string
          production_order_id?: string
          quantity?: number
          total_value?: number | null
          updated_at?: string
          value_per_unit?: number
        }
        Relationships: [
          {
            foreignKeyName: "production_entries_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "processes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_entries_production_order_id_fkey"
            columns: ["production_order_id"]
            isOneToOne: false
            referencedRelation: "production_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      production_logs: {
        Row: {
          created_at: string
          date: string
          employee_name: string
          id: string
          notes: string | null
          order_id: string | null
          period: string
          process: string
          product_id: string | null
          quantity: number
          updated_at: string
          warnings: string | null
        }
        Insert: {
          created_at?: string
          date?: string
          employee_name: string
          id?: string
          notes?: string | null
          order_id?: string | null
          period?: string
          process: string
          product_id?: string | null
          quantity?: number
          updated_at?: string
          warnings?: string | null
        }
        Update: {
          created_at?: string
          date?: string
          employee_name?: string
          id?: string
          notes?: string | null
          order_id?: string | null
          period?: string
          process?: string
          product_id?: string | null
          quantity?: number
          updated_at?: string
          warnings?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "production_logs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_logs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      production_order_processes: {
        Row: {
          created_at: string
          id: string
          is_required: boolean
          process_id: string
          production_order_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_required?: boolean
          process_id: string
          production_order_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_required?: boolean
          process_id?: string
          production_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_order_processes_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "processes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_order_processes_production_order_id_fkey"
            columns: ["production_order_id"]
            isOneToOne: false
            referencedRelation: "production_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      production_orders: {
        Row: {
          batch_code: string | null
          completed_at: string | null
          consolidated_quantity: number
          created_at: string
          id: string
          notes: string | null
          order_number: string | null
          product_id: string | null
          source_order_id: string | null
          status: string
          target_quantity: number
          updated_at: string
        }
        Insert: {
          batch_code?: string | null
          completed_at?: string | null
          consolidated_quantity?: number
          created_at?: string
          id?: string
          notes?: string | null
          order_number?: string | null
          product_id?: string | null
          source_order_id?: string | null
          status?: string
          target_quantity?: number
          updated_at?: string
        }
        Update: {
          batch_code?: string | null
          completed_at?: string | null
          consolidated_quantity?: number
          created_at?: string
          id?: string
          notes?: string | null
          order_number?: string | null
          product_id?: string | null
          source_order_id?: string | null
          status?: string
          target_quantity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_orders_source_order_id_fkey"
            columns: ["source_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          attributes: Json | null
          category: string | null
          cost: number | null
          cover_image_url: string | null
          created_at: string
          deleted_at: string | null
          description: string | null
          expiry_days: number | null
          id: string
          is_active: boolean
          media_urls: Json | null
          min_stock: number | null
          name: string
          price: number | null
          sku: string
          unit: string | null
          updated_at: string
        }
        Insert: {
          attributes?: Json | null
          category?: string | null
          cost?: number | null
          cover_image_url?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          expiry_days?: number | null
          id?: string
          is_active?: boolean
          media_urls?: Json | null
          min_stock?: number | null
          name: string
          price?: number | null
          sku: string
          unit?: string | null
          updated_at?: string
        }
        Update: {
          attributes?: Json | null
          category?: string | null
          cost?: number | null
          cover_image_url?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          expiry_days?: number | null
          id?: string
          is_active?: boolean
          media_urls?: Json | null
          min_stock?: number | null
          name?: string
          price?: number | null
          sku?: string
          unit?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      routine_blocks: {
        Row: {
          actual_end: string | null
          actual_start: string | null
          block_type: string
          created_at: string
          date: string
          duration_minutes: number
          id: string
          node_id: string | null
          notes: string | null
          planned_end: string | null
          planned_start: string | null
          status: string
          task_id: string | null
          template_id: string | null
          title: string
        }
        Insert: {
          actual_end?: string | null
          actual_start?: string | null
          block_type?: string
          created_at?: string
          date?: string
          duration_minutes?: number
          id?: string
          node_id?: string | null
          notes?: string | null
          planned_end?: string | null
          planned_start?: string | null
          status?: string
          task_id?: string | null
          template_id?: string | null
          title: string
        }
        Update: {
          actual_end?: string | null
          actual_start?: string | null
          block_type?: string
          created_at?: string
          date?: string
          duration_minutes?: number
          id?: string
          node_id?: string | null
          notes?: string | null
          planned_end?: string | null
          planned_start?: string | null
          status?: string
          task_id?: string | null
          template_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "routine_blocks_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "routine_blocks_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "routine_blocks_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "routine_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      routine_templates: {
        Row: {
          block_type: string
          created_at: string
          duration_minutes: number
          id: string
          is_active: boolean
          node_id: string | null
          order_index: number
          start_time: string | null
          title: string
        }
        Insert: {
          block_type?: string
          created_at?: string
          duration_minutes?: number
          id?: string
          is_active?: boolean
          node_id?: string | null
          order_index?: number
          start_time?: string | null
          title: string
        }
        Update: {
          block_type?: string
          created_at?: string
          duration_minutes?: number
          id?: string
          is_active?: boolean
          node_id?: string | null
          order_index?: number
          start_time?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "routine_templates_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      sheet_cells: {
        Row: {
          cell_type: string
          col_index: number
          created_at: string
          format: Json | null
          formula: string | null
          id: string
          row_index: number
          sheet_id: string
          updated_at: string
          value: string | null
        }
        Insert: {
          cell_type?: string
          col_index: number
          created_at?: string
          format?: Json | null
          formula?: string | null
          id?: string
          row_index: number
          sheet_id: string
          updated_at?: string
          value?: string | null
        }
        Update: {
          cell_type?: string
          col_index?: number
          created_at?: string
          format?: Json | null
          formula?: string | null
          id?: string
          row_index?: number
          sheet_id?: string
          updated_at?: string
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sheet_cells_sheet_id_fkey"
            columns: ["sheet_id"]
            isOneToOne: false
            referencedRelation: "sheets"
            referencedColumns: ["id"]
          },
        ]
      }
      sheets: {
        Row: {
          col_widths: Json | null
          created_at: string
          deleted_at: string | null
          frozen_cols: number
          frozen_rows: number
          id: string
          node_id: string | null
          row_heights: Json | null
          task_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          col_widths?: Json | null
          created_at?: string
          deleted_at?: string | null
          frozen_cols?: number
          frozen_rows?: number
          id?: string
          node_id?: string | null
          row_heights?: Json | null
          task_id?: string | null
          title?: string
          updated_at?: string
        }
        Update: {
          col_widths?: Json | null
          created_at?: string
          deleted_at?: string | null
          frozen_cols?: number
          frozen_rows?: number
          id?: string
          node_id?: string | null
          row_heights?: Json | null
          task_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sheets_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sheets_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      storage_locations: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      task_merge_history: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          merged_data: Json
          merged_task_ids: string[]
          target_task_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          merged_data: Json
          merged_task_ids: string[]
          target_task_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          merged_data?: Json
          merged_task_ids?: string[]
          target_task_id?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          active_time_entry_id: string | null
          assigned_to: string | null
          checklist: Json | null
          created_at: string
          deleted_at: string | null
          dependency_id: string | null
          description: string | null
          due_date: string | null
          id: string
          media_urls: Json | null
          node_id: string
          on_hold: boolean
          on_hold_channel: string | null
          on_hold_created_at: string | null
          on_hold_deadline: string | null
          on_hold_note: string | null
          on_hold_who: string | null
          order_index: number
          progress: number
          scheduled_date: string | null
          status: string
          title: string
          updated_at: string
          use_checklist_progress: boolean | null
        }
        Insert: {
          active_time_entry_id?: string | null
          assigned_to?: string | null
          checklist?: Json | null
          created_at?: string
          deleted_at?: string | null
          dependency_id?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          media_urls?: Json | null
          node_id: string
          on_hold?: boolean
          on_hold_channel?: string | null
          on_hold_created_at?: string | null
          on_hold_deadline?: string | null
          on_hold_note?: string | null
          on_hold_who?: string | null
          order_index?: number
          progress?: number
          scheduled_date?: string | null
          status?: string
          title: string
          updated_at?: string
          use_checklist_progress?: boolean | null
        }
        Update: {
          active_time_entry_id?: string | null
          assigned_to?: string | null
          checklist?: Json | null
          created_at?: string
          deleted_at?: string | null
          dependency_id?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          media_urls?: Json | null
          node_id?: string
          on_hold?: boolean
          on_hold_channel?: string | null
          on_hold_created_at?: string | null
          on_hold_deadline?: string | null
          on_hold_note?: string | null
          on_hold_who?: string | null
          order_index?: number
          progress?: number
          scheduled_date?: string | null
          status?: string
          title?: string
          updated_at?: string
          use_checklist_progress?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_dependency_id_fkey"
            columns: ["dependency_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      time_entries: {
        Row: {
          created_at: string
          duration_seconds: number | null
          ended_at: string | null
          entry_type: string
          id: string
          node_id: string | null
          notes: string | null
          started_at: string
          task_id: string
        }
        Insert: {
          created_at?: string
          duration_seconds?: number | null
          ended_at?: string | null
          entry_type?: string
          id?: string
          node_id?: string | null
          notes?: string | null
          started_at: string
          task_id: string
        }
        Update: {
          created_at?: string
          duration_seconds?: number | null
          ended_at?: string | null
          entry_type?: string
          id?: string
          node_id?: string | null
          notes?: string | null
          started_at?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      timer_state: {
        Row: {
          id: string
          last_update: string
          remaining_seconds: number
          status: string
        }
        Insert: {
          id?: string
          last_update?: string
          remaining_seconds?: number
          status?: string
        }
        Update: {
          id?: string
          last_update?: string
          remaining_seconds?: number
          status?: string
        }
        Relationships: []
      }
      wizard_steps: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          label: string
          module_route: string | null
          order_index: number
          step_key: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          label: string
          module_route?: string | null
          order_index?: number
          step_key: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
          module_route?: string | null
          order_index?: number
          step_key?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
