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
      inventory: {
        Row: {
          id: string
          location: string | null
          product_id: string
          quantity: number
          updated_at: string
        }
        Insert: {
          id?: string
          location?: string | null
          product_id: string
          quantity?: number
          updated_at?: string
        }
        Update: {
          id?: string
          location?: string | null
          product_id?: string
          quantity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
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
          parent_id: string | null
          title: string
        }
        Insert: {
          color: string
          created_at?: string
          id?: string
          is_visible?: boolean
          media_urls?: Json | null
          parent_id?: string | null
          title: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          is_visible?: boolean
          media_urls?: Json | null
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
          created_at: string
          customer_contact: string | null
          customer_name: string | null
          due_date: string | null
          id: string
          notes: string | null
          order_date: string
          order_number: string | null
          status: string
          total_value: number | null
          updated_at: string
        }
        Insert: {
          channel?: string | null
          created_at?: string
          customer_contact?: string | null
          customer_name?: string | null
          due_date?: string | null
          id?: string
          notes?: string | null
          order_date?: string
          order_number?: string | null
          status?: string
          total_value?: number | null
          updated_at?: string
        }
        Update: {
          channel?: string | null
          created_at?: string
          customer_contact?: string | null
          customer_name?: string | null
          due_date?: string | null
          id?: string
          notes?: string | null
          order_date?: string
          order_number?: string | null
          status?: string
          total_value?: number | null
          updated_at?: string
        }
        Relationships: []
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
      products: {
        Row: {
          cost: number | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          min_stock: number | null
          name: string
          price: number | null
          sku: string
          unit: string | null
          updated_at: string
        }
        Insert: {
          cost?: number | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          min_stock?: number | null
          name: string
          price?: number | null
          sku: string
          unit?: string | null
          updated_at?: string
        }
        Update: {
          cost?: number | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
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
      tasks: {
        Row: {
          checklist: Json | null
          created_at: string
          dependency_id: string | null
          description: string | null
          due_date: string | null
          id: string
          media_urls: Json | null
          node_id: string
          order_index: number
          progress: number
          scheduled_date: string | null
          status: string
          title: string
          updated_at: string
          use_checklist_progress: boolean | null
        }
        Insert: {
          checklist?: Json | null
          created_at?: string
          dependency_id?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          media_urls?: Json | null
          node_id: string
          order_index?: number
          progress?: number
          scheduled_date?: string | null
          status?: string
          title: string
          updated_at?: string
          use_checklist_progress?: boolean | null
        }
        Update: {
          checklist?: Json | null
          created_at?: string
          dependency_id?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          media_urls?: Json | null
          node_id?: string
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
