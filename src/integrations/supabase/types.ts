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
      ai_actions: {
        Row: {
          action_type: string
          created_at: string
          executed_at: string | null
          id: string
          insight_id: string
          payload: Json | null
          result: string | null
          status: string
        }
        Insert: {
          action_type: string
          created_at?: string
          executed_at?: string | null
          id?: string
          insight_id: string
          payload?: Json | null
          result?: string | null
          status?: string
        }
        Update: {
          action_type?: string
          created_at?: string
          executed_at?: string | null
          id?: string
          insight_id?: string
          payload?: Json | null
          result?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_actions_insight_id_fkey"
            columns: ["insight_id"]
            isOneToOne: false
            referencedRelation: "ai_insights"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          role: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          role: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: string
        }
        Relationships: []
      }
      ai_insight_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          insight_id: string
          role: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          insight_id: string
          role: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          insight_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_insight_messages_insight_id_fkey"
            columns: ["insight_id"]
            isOneToOne: false
            referencedRelation: "ai_insights"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_insights: {
        Row: {
          area: string
          confidence: number
          created_at: string
          decision: Json | null
          description: string | null
          id: string
          impact: number
          risk: number
          severity: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          area: string
          confidence?: number
          created_at?: string
          decision?: Json | null
          description?: string | null
          id?: string
          impact?: number
          risk?: number
          severity?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          area?: string
          confidence?: number
          created_at?: string
          decision?: Json | null
          description?: string | null
          id?: string
          impact?: number
          risk?: number
          severity?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      ai_policies: {
        Row: {
          area: string
          autopilot: boolean
          created_at: string
          id: string
          max_risk: number
          updated_at: string
        }
        Insert: {
          area: string
          autopilot?: boolean
          created_at?: string
          id?: string
          max_risk?: number
          updated_at?: string
        }
        Update: {
          area?: string
          autopilot?: boolean
          created_at?: string
          id?: string
          max_risk?: number
          updated_at?: string
        }
        Relationships: []
      }
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
      contact_history: {
        Row: {
          contact_id: string
          created_at: string
          description: string
          event_type: string
          id: string
          new_value: string | null
          old_value: string | null
        }
        Insert: {
          contact_id: string
          created_at?: string
          description: string
          event_type?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
        }
        Update: {
          contact_id?: string
          created_at?: string
          description?: string
          event_type?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contact_history_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          address: string | null
          address_complement: string | null
          address_number: string | null
          avg_load_percentage: number | null
          billing_address: string | null
          billing_city: string | null
          billing_complement: string | null
          billing_neighborhood: string | null
          billing_number: string | null
          billing_state: string | null
          billing_zip_code: string | null
          birth_date: string | null
          birthplace: string | null
          category: string | null
          city: string | null
          code: string | null
          company_name: string | null
          contact_info: string | null
          contact_people: Json | null
          contact_type: string | null
          converted_at: string | null
          created_at: string
          credit_limit_type: string | null
          credit_limit_value: number | null
          customer_since: string | null
          default_operation_nature: string | null
          document: string | null
          email: string | null
          fantasy_name: string | null
          father_cpf: string | null
          father_name: string | null
          fax: string | null
          funnel_status: string
          gender: string | null
          id: string
          is_active: boolean
          issuing_agency: string | null
          landline: string | null
          marital_status: string | null
          mobile: string | null
          mobile_carrier: string | null
          mother_cpf: string | null
          mother_name: string | null
          name: string
          neighborhood: string | null
          next_visit: string | null
          nfe_email: string | null
          notes: string | null
          origem_lead: string | null
          payment_condition: string | null
          person_type: string | null
          phone: string | null
          photo_url: string | null
          profession: string | null
          rg: string | null
          sales_channels: Json | null
          salesperson: string | null
          skype: string | null
          state: string | null
          state_registration: string | null
          taxpayer_type: string | null
          temperatura_lead: string | null
          type: string
          ultimo_contato: string | null
          updated_at: string
          valor_estimado: number | null
          website: string | null
          whatsapp: string | null
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          address_complement?: string | null
          address_number?: string | null
          avg_load_percentage?: number | null
          billing_address?: string | null
          billing_city?: string | null
          billing_complement?: string | null
          billing_neighborhood?: string | null
          billing_number?: string | null
          billing_state?: string | null
          billing_zip_code?: string | null
          birth_date?: string | null
          birthplace?: string | null
          category?: string | null
          city?: string | null
          code?: string | null
          company_name?: string | null
          contact_info?: string | null
          contact_people?: Json | null
          contact_type?: string | null
          converted_at?: string | null
          created_at?: string
          credit_limit_type?: string | null
          credit_limit_value?: number | null
          customer_since?: string | null
          default_operation_nature?: string | null
          document?: string | null
          email?: string | null
          fantasy_name?: string | null
          father_cpf?: string | null
          father_name?: string | null
          fax?: string | null
          funnel_status?: string
          gender?: string | null
          id?: string
          is_active?: boolean
          issuing_agency?: string | null
          landline?: string | null
          marital_status?: string | null
          mobile?: string | null
          mobile_carrier?: string | null
          mother_cpf?: string | null
          mother_name?: string | null
          name: string
          neighborhood?: string | null
          next_visit?: string | null
          nfe_email?: string | null
          notes?: string | null
          origem_lead?: string | null
          payment_condition?: string | null
          person_type?: string | null
          phone?: string | null
          photo_url?: string | null
          profession?: string | null
          rg?: string | null
          sales_channels?: Json | null
          salesperson?: string | null
          skype?: string | null
          state?: string | null
          state_registration?: string | null
          taxpayer_type?: string | null
          temperatura_lead?: string | null
          type?: string
          ultimo_contato?: string | null
          updated_at?: string
          valor_estimado?: number | null
          website?: string | null
          whatsapp?: string | null
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          address_complement?: string | null
          address_number?: string | null
          avg_load_percentage?: number | null
          billing_address?: string | null
          billing_city?: string | null
          billing_complement?: string | null
          billing_neighborhood?: string | null
          billing_number?: string | null
          billing_state?: string | null
          billing_zip_code?: string | null
          birth_date?: string | null
          birthplace?: string | null
          category?: string | null
          city?: string | null
          code?: string | null
          company_name?: string | null
          contact_info?: string | null
          contact_people?: Json | null
          contact_type?: string | null
          converted_at?: string | null
          created_at?: string
          credit_limit_type?: string | null
          credit_limit_value?: number | null
          customer_since?: string | null
          default_operation_nature?: string | null
          document?: string | null
          email?: string | null
          fantasy_name?: string | null
          father_cpf?: string | null
          father_name?: string | null
          fax?: string | null
          funnel_status?: string
          gender?: string | null
          id?: string
          is_active?: boolean
          issuing_agency?: string | null
          landline?: string | null
          marital_status?: string | null
          mobile?: string | null
          mobile_carrier?: string | null
          mother_cpf?: string | null
          mother_name?: string | null
          name?: string
          neighborhood?: string | null
          next_visit?: string | null
          nfe_email?: string | null
          notes?: string | null
          origem_lead?: string | null
          payment_condition?: string | null
          person_type?: string | null
          phone?: string | null
          photo_url?: string | null
          profession?: string | null
          rg?: string | null
          sales_channels?: Json | null
          salesperson?: string | null
          skype?: string | null
          state?: string | null
          state_registration?: string | null
          taxpayer_type?: string | null
          temperatura_lead?: string | null
          type?: string
          ultimo_contato?: string | null
          updated_at?: string
          valor_estimado?: number | null
          website?: string | null
          whatsapp?: string | null
          zip_code?: string | null
        }
        Relationships: []
      }
      digital_ideas: {
        Row: {
          created_at: string
          custom_field_values: Json | null
          custom_fields: Json | null
          id: string
          idea_type: string
          key_message: string | null
          kpi: string | null
          media_urls: Json | null
          node_id: string | null
          objective: string | null
          order_index: number | null
          product_id: string | null
          status: string
          target_audience: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          custom_field_values?: Json | null
          custom_fields?: Json | null
          id?: string
          idea_type?: string
          key_message?: string | null
          kpi?: string | null
          media_urls?: Json | null
          node_id?: string | null
          objective?: string | null
          order_index?: number | null
          product_id?: string | null
          status?: string
          target_audience?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          custom_field_values?: Json | null
          custom_fields?: Json | null
          id?: string
          idea_type?: string
          key_message?: string | null
          kpi?: string | null
          media_urls?: Json | null
          node_id?: string | null
          objective?: string | null
          order_index?: number | null
          product_id?: string | null
          status?: string
          target_audience?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "digital_ideas_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "digital_ideas_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      digital_interactions: {
        Row: {
          actual_response: string | null
          ai_suggested_response: string | null
          contact_handle: string | null
          contact_name: string | null
          content: string
          created_at: string
          funnel_stage: string
          id: string
          interaction_type: string
          platform_id: string | null
          responded_at: string | null
          status: string
          updated_at: string
          variation_id: string | null
        }
        Insert: {
          actual_response?: string | null
          ai_suggested_response?: string | null
          contact_handle?: string | null
          contact_name?: string | null
          content: string
          created_at?: string
          funnel_stage?: string
          id?: string
          interaction_type?: string
          platform_id?: string | null
          responded_at?: string | null
          status?: string
          updated_at?: string
          variation_id?: string | null
        }
        Update: {
          actual_response?: string | null
          ai_suggested_response?: string | null
          contact_handle?: string | null
          contact_name?: string | null
          content?: string
          created_at?: string
          funnel_stage?: string
          id?: string
          interaction_type?: string
          platform_id?: string | null
          responded_at?: string | null
          status?: string
          updated_at?: string
          variation_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "digital_interactions_platform_id_fkey"
            columns: ["platform_id"]
            isOneToOne: false
            referencedRelation: "digital_platforms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "digital_interactions_variation_id_fkey"
            columns: ["variation_id"]
            isOneToOne: false
            referencedRelation: "digital_variations"
            referencedColumns: ["id"]
          },
        ]
      }
      digital_knowledge_base: {
        Row: {
          answer: string
          category: string
          created_at: string
          id: string
          is_active: boolean
          keywords: string[] | null
          platform_id: string | null
          question: string
          updated_at: string
          usage_count: number
        }
        Insert: {
          answer: string
          category?: string
          created_at?: string
          id?: string
          is_active?: boolean
          keywords?: string[] | null
          platform_id?: string | null
          question: string
          updated_at?: string
          usage_count?: number
        }
        Update: {
          answer?: string
          category?: string
          created_at?: string
          id?: string
          is_active?: boolean
          keywords?: string[] | null
          platform_id?: string | null
          question?: string
          updated_at?: string
          usage_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "digital_knowledge_base_platform_id_fkey"
            columns: ["platform_id"]
            isOneToOne: false
            referencedRelation: "digital_platforms"
            referencedColumns: ["id"]
          },
        ]
      }
      digital_media: {
        Row: {
          ai_enhanced: boolean | null
          created_at: string
          enhancement_type: string | null
          file_size: number | null
          file_type: string | null
          filename: string | null
          folder_id: string | null
          id: string
          idea_id: string | null
          original_url: string | null
          parent_media_id: string | null
          quality_status: string | null
          tags: string[] | null
          url: string
          variation_id: string | null
          version: number | null
        }
        Insert: {
          ai_enhanced?: boolean | null
          created_at?: string
          enhancement_type?: string | null
          file_size?: number | null
          file_type?: string | null
          filename?: string | null
          folder_id?: string | null
          id?: string
          idea_id?: string | null
          original_url?: string | null
          parent_media_id?: string | null
          quality_status?: string | null
          tags?: string[] | null
          url: string
          variation_id?: string | null
          version?: number | null
        }
        Update: {
          ai_enhanced?: boolean | null
          created_at?: string
          enhancement_type?: string | null
          file_size?: number | null
          file_type?: string | null
          filename?: string | null
          folder_id?: string | null
          id?: string
          idea_id?: string | null
          original_url?: string | null
          parent_media_id?: string | null
          quality_status?: string | null
          tags?: string[] | null
          url?: string
          variation_id?: string | null
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "digital_media_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "digital_media_folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "digital_media_idea_id_fkey"
            columns: ["idea_id"]
            isOneToOne: false
            referencedRelation: "digital_ideas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "digital_media_parent_media_id_fkey"
            columns: ["parent_media_id"]
            isOneToOne: false
            referencedRelation: "digital_media"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "digital_media_variation_id_fkey"
            columns: ["variation_id"]
            isOneToOne: false
            referencedRelation: "digital_variations"
            referencedColumns: ["id"]
          },
        ]
      }
      digital_media_folders: {
        Row: {
          color: string | null
          created_at: string
          id: string
          name: string
          order_index: number | null
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          name: string
          order_index?: number | null
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          name?: string
          order_index?: number | null
        }
        Relationships: []
      }
      digital_platform_groups: {
        Row: {
          created_at: string
          icon: string
          id: string
          is_active: boolean
          name: string
          order_index: number
        }
        Insert: {
          created_at?: string
          icon?: string
          id?: string
          is_active?: boolean
          name: string
          order_index?: number
        }
        Update: {
          created_at?: string
          icon?: string
          id?: string
          is_active?: boolean
          name?: string
          order_index?: number
        }
        Relationships: []
      }
      digital_platforms: {
        Row: {
          aspect_ratio: string | null
          checklist_template: Json | null
          created_at: string
          custom_fields: Json | null
          duration: string | null
          fields: string[] | null
          group_id: string | null
          group_type: string
          icon: string
          id: string
          is_active: boolean
          name: string
          order_index: number
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          aspect_ratio?: string | null
          checklist_template?: Json | null
          created_at?: string
          custom_fields?: Json | null
          duration?: string | null
          fields?: string[] | null
          group_id?: string | null
          group_type?: string
          icon?: string
          id?: string
          is_active?: boolean
          name: string
          order_index?: number
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          aspect_ratio?: string | null
          checklist_template?: Json | null
          created_at?: string
          custom_fields?: Json | null
          duration?: string | null
          fields?: string[] | null
          group_id?: string | null
          group_type?: string
          icon?: string
          id?: string
          is_active?: boolean
          name?: string
          order_index?: number
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "digital_platforms_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "digital_platform_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "digital_platforms_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "digital_platforms"
            referencedColumns: ["id"]
          },
        ]
      }
      digital_templates: {
        Row: {
          checklist_template: Json | null
          config: Json | null
          created_at: string
          id: string
          name: string
          platform: string
        }
        Insert: {
          checklist_template?: Json | null
          config?: Json | null
          created_at?: string
          id?: string
          name: string
          platform: string
        }
        Update: {
          checklist_template?: Json | null
          config?: Json | null
          created_at?: string
          id?: string
          name?: string
          platform?: string
        }
        Relationships: []
      }
      digital_trends: {
        Row: {
          created_at: string
          id: string
          insights: string | null
          niche: string | null
          query: string
          results: Json | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          insights?: string | null
          niche?: string | null
          query: string
          results?: Json | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          insights?: string | null
          niche?: string | null
          query?: string
          results?: Json | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      digital_variations: {
        Row: {
          additional_dates: Json | null
          aspect_ratio: string | null
          caption: string | null
          chapters: string | null
          checklist: Json | null
          cover_url: string | null
          created_at: string
          cta: string | null
          custom_field_values: Json | null
          description: string | null
          duration_seconds: number | null
          extra_media_ids: Json | null
          hashtags: string | null
          hidden_inherited_media: Json | null
          id: string
          idea_id: string
          is_posted: boolean
          is_template: boolean | null
          link: string | null
          media_mode: string | null
          media_transforms: Json | null
          media_urls: Json | null
          metric_clicks: number | null
          metric_ctr: number | null
          metric_engagement: number | null
          metric_reach: number | null
          metric_retention: number | null
          music: string | null
          order_index: number | null
          platform: string
          playlist: string | null
          resolution: string | null
          scheduled_date: string | null
          scheduled_time: string | null
          status: string
          tags: string | null
          template_name: string | null
          thumbnail_url: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          additional_dates?: Json | null
          aspect_ratio?: string | null
          caption?: string | null
          chapters?: string | null
          checklist?: Json | null
          cover_url?: string | null
          created_at?: string
          cta?: string | null
          custom_field_values?: Json | null
          description?: string | null
          duration_seconds?: number | null
          extra_media_ids?: Json | null
          hashtags?: string | null
          hidden_inherited_media?: Json | null
          id?: string
          idea_id: string
          is_posted?: boolean
          is_template?: boolean | null
          link?: string | null
          media_mode?: string | null
          media_transforms?: Json | null
          media_urls?: Json | null
          metric_clicks?: number | null
          metric_ctr?: number | null
          metric_engagement?: number | null
          metric_reach?: number | null
          metric_retention?: number | null
          music?: string | null
          order_index?: number | null
          platform: string
          playlist?: string | null
          resolution?: string | null
          scheduled_date?: string | null
          scheduled_time?: string | null
          status?: string
          tags?: string | null
          template_name?: string | null
          thumbnail_url?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          additional_dates?: Json | null
          aspect_ratio?: string | null
          caption?: string | null
          chapters?: string | null
          checklist?: Json | null
          cover_url?: string | null
          created_at?: string
          cta?: string | null
          custom_field_values?: Json | null
          description?: string | null
          duration_seconds?: number | null
          extra_media_ids?: Json | null
          hashtags?: string | null
          hidden_inherited_media?: Json | null
          id?: string
          idea_id?: string
          is_posted?: boolean
          is_template?: boolean | null
          link?: string | null
          media_mode?: string | null
          media_transforms?: Json | null
          media_urls?: Json | null
          metric_clicks?: number | null
          metric_ctr?: number | null
          metric_engagement?: number | null
          metric_reach?: number | null
          metric_retention?: number | null
          music?: string | null
          order_index?: number | null
          platform?: string
          playlist?: string | null
          resolution?: string | null
          scheduled_date?: string | null
          scheduled_time?: string | null
          status?: string
          tags?: string | null
          template_name?: string | null
          thumbnail_url?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "digital_variations_idea_id_fkey"
            columns: ["idea_id"]
            isOneToOne: false
            referencedRelation: "digital_ideas"
            referencedColumns: ["id"]
          },
        ]
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
          competence_date: string | null
          conciliated_at: string | null
          contact_id: string | null
          created_at: string
          description: string
          document_number: string | null
          due_date: string
          id: string
          is_conciliated: boolean
          issue_date: string | null
          notes: string | null
          order_id: string | null
          original_due_date: string | null
          parent_entry_id: string | null
          payment_date: string | null
          recurrence_day: number | null
          recurrence_end_date: string | null
          recurrence_type: string | null
          recurrence_use_business_days: boolean | null
          type: string
          updated_at: string
          value: number
          value_paid: number
        }
        Insert: {
          account_id?: string | null
          category_id?: string | null
          competence_date?: string | null
          conciliated_at?: string | null
          contact_id?: string | null
          created_at?: string
          description: string
          document_number?: string | null
          due_date: string
          id?: string
          is_conciliated?: boolean
          issue_date?: string | null
          notes?: string | null
          order_id?: string | null
          original_due_date?: string | null
          parent_entry_id?: string | null
          payment_date?: string | null
          recurrence_day?: number | null
          recurrence_end_date?: string | null
          recurrence_type?: string | null
          recurrence_use_business_days?: boolean | null
          type: string
          updated_at?: string
          value: number
          value_paid?: number
        }
        Update: {
          account_id?: string | null
          category_id?: string | null
          competence_date?: string | null
          conciliated_at?: string | null
          contact_id?: string | null
          created_at?: string
          description?: string
          document_number?: string | null
          due_date?: string
          id?: string
          is_conciliated?: boolean
          issue_date?: string | null
          notes?: string | null
          order_id?: string | null
          original_due_date?: string | null
          parent_entry_id?: string | null
          payment_date?: string | null
          recurrence_day?: number | null
          recurrence_end_date?: string | null
          recurrence_type?: string | null
          recurrence_use_business_days?: boolean | null
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
          {
            foreignKeyName: "financial_entries_parent_entry_id_fkey"
            columns: ["parent_entry_id"]
            isOneToOne: false
            referencedRelation: "financial_entries"
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
          order_type: string
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
          order_type?: string
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
          order_type?: string
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
      price_channels: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      price_fee_fields: {
        Row: {
          created_at: string
          field_type: string
          id: string
          is_active: boolean
          name: string
          order_index: number
        }
        Insert: {
          created_at?: string
          field_type?: string
          id?: string
          is_active?: boolean
          name: string
          order_index?: number
        }
        Update: {
          created_at?: string
          field_type?: string
          id?: string
          is_active?: boolean
          name?: string
          order_index?: number
        }
        Relationships: []
      }
      price_param_fees: {
        Row: {
          created_at: string
          fee_field_id: string
          id: string
          param_id: string
          value: number
        }
        Insert: {
          created_at?: string
          fee_field_id: string
          id?: string
          param_id: string
          value?: number
        }
        Update: {
          created_at?: string
          fee_field_id?: string
          id?: string
          param_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "price_param_fees_fee_field_id_fkey"
            columns: ["fee_field_id"]
            isOneToOne: false
            referencedRelation: "price_fee_fields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_param_fees_param_id_fkey"
            columns: ["param_id"]
            isOneToOne: false
            referencedRelation: "price_params"
            referencedColumns: ["id"]
          },
        ]
      }
      price_param_history: {
        Row: {
          changed_at: string
          id: string
          notes: string | null
          param_id: string
          snapshot: Json
        }
        Insert: {
          changed_at?: string
          id?: string
          notes?: string | null
          param_id: string
          snapshot: Json
        }
        Update: {
          changed_at?: string
          id?: string
          notes?: string | null
          param_id?: string
          snapshot?: Json
        }
        Relationships: [
          {
            foreignKeyName: "price_param_history_param_id_fkey"
            columns: ["param_id"]
            isOneToOne: false
            referencedRelation: "price_params"
            referencedColumns: ["id"]
          },
        ]
      }
      price_params: {
        Row: {
          channel_id: string
          created_at: string
          extra_fee_pct: number
          id: string
          is_active: boolean
          name: string
          packaging_cost: number
          payment_fee_pct: number
          platform_fee_pct: number
          shipping_cost: number
          store_id: string | null
          target_margin_pct: number
          updated_at: string
        }
        Insert: {
          channel_id: string
          created_at?: string
          extra_fee_pct?: number
          id?: string
          is_active?: boolean
          name: string
          packaging_cost?: number
          payment_fee_pct?: number
          platform_fee_pct?: number
          shipping_cost?: number
          store_id?: string | null
          target_margin_pct?: number
          updated_at?: string
        }
        Update: {
          channel_id?: string
          created_at?: string
          extra_fee_pct?: number
          id?: string
          is_active?: boolean
          name?: string
          packaging_cost?: number
          payment_fee_pct?: number
          platform_fee_pct?: number
          shipping_cost?: number
          store_id?: string | null
          target_margin_pct?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_params_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "price_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_params_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "price_stores"
            referencedColumns: ["id"]
          },
        ]
      }
      price_simulation_items: {
        Row: {
          created_at: string
          id: string
          order_index: number
          pack_cost: number
          pack_qty: number
          product_name: string
          simulation_id: string
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          order_index?: number
          pack_cost?: number
          pack_qty?: number
          product_name: string
          simulation_id: string
          unit_price?: number
        }
        Update: {
          created_at?: string
          id?: string
          order_index?: number
          pack_cost?: number
          pack_qty?: number
          product_name?: string
          simulation_id?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "price_simulation_items_simulation_id_fkey"
            columns: ["simulation_id"]
            isOneToOne: false
            referencedRelation: "price_simulations"
            referencedColumns: ["id"]
          },
        ]
      }
      price_simulations: {
        Row: {
          created_at: string
          id: string
          name: string
          param_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name?: string
          param_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          param_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_simulations_param_id_fkey"
            columns: ["param_id"]
            isOneToOne: false
            referencedRelation: "price_params"
            referencedColumns: ["id"]
          },
        ]
      }
      price_stores: {
        Row: {
          channel_id: string
          created_at: string
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          channel_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          channel_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_stores_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "price_channels"
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
          focus: string | null
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
          focus?: string | null
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
          focus?: string | null
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
      routine_prefs: {
        Row: {
          breaks: Json | null
          capacity_targets: Json | null
          created_at: string
          default_template_id: string | null
          id: string
          updated_at: string
          work_hours_end: string
          work_hours_start: string
        }
        Insert: {
          breaks?: Json | null
          capacity_targets?: Json | null
          created_at?: string
          default_template_id?: string | null
          id?: string
          updated_at?: string
          work_hours_end?: string
          work_hours_start?: string
        }
        Update: {
          breaks?: Json | null
          capacity_targets?: Json | null
          created_at?: string
          default_template_id?: string | null
          id?: string
          updated_at?: string
          work_hours_end?: string
          work_hours_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "routine_prefs_default_template_id_fkey"
            columns: ["default_template_id"]
            isOneToOne: false
            referencedRelation: "routine_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      routine_stats: {
        Row: {
          atendimento_min: number
          context_switches: number
          created_at: string
          date: string
          deep_work_min: number
          done_min: number
          id: string
          planned_min: number
        }
        Insert: {
          atendimento_min?: number
          context_switches?: number
          created_at?: string
          date: string
          deep_work_min?: number
          done_min?: number
          id?: string
          planned_min?: number
        }
        Update: {
          atendimento_min?: number
          context_switches?: number
          created_at?: string
          date?: string
          deep_work_min?: number
          done_min?: number
          id?: string
          planned_min?: number
        }
        Relationships: []
      }
      routine_templates: {
        Row: {
          block_type: string
          created_at: string
          duration_minutes: number
          focus: string | null
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
          focus?: string | null
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
          focus?: string | null
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
      seasonal_days: {
        Row: {
          auto_task_templates: Json | null
          auto_tasks: boolean
          color: string
          created_at: string
          day: number | null
          end_day: number | null
          end_month: number | null
          id: string
          importance: number
          is_active: boolean
          month: number | null
          name: string
          notes: string | null
          nth_occurrence: number | null
          prep_days: number
          recurrence_type: string
          reminders: Json | null
          updated_at: string
          weekday: number | null
        }
        Insert: {
          auto_task_templates?: Json | null
          auto_tasks?: boolean
          color?: string
          created_at?: string
          day?: number | null
          end_day?: number | null
          end_month?: number | null
          id?: string
          importance?: number
          is_active?: boolean
          month?: number | null
          name: string
          notes?: string | null
          nth_occurrence?: number | null
          prep_days?: number
          recurrence_type?: string
          reminders?: Json | null
          updated_at?: string
          weekday?: number | null
        }
        Update: {
          auto_task_templates?: Json | null
          auto_tasks?: boolean
          color?: string
          created_at?: string
          day?: number | null
          end_day?: number | null
          end_month?: number | null
          id?: string
          importance?: number
          is_active?: boolean
          month?: number | null
          name?: string
          notes?: string | null
          nth_occurrence?: number | null
          prep_days?: number
          recurrence_type?: string
          reminders?: Json | null
          updated_at?: string
          weekday?: number | null
        }
        Relationships: []
      }
      service_ai_logs: {
        Row: {
          ai_suggested_response: string | null
          approved_response: string | null
          conversation_id: string | null
          conversation_result: string | null
          created_at: string
          id: string
          intent_detected: string | null
          interaction_type: string | null
          message_id: string | null
          platform_id: string | null
        }
        Insert: {
          ai_suggested_response?: string | null
          approved_response?: string | null
          conversation_id?: string | null
          conversation_result?: string | null
          created_at?: string
          id?: string
          intent_detected?: string | null
          interaction_type?: string | null
          message_id?: string | null
          platform_id?: string | null
        }
        Update: {
          ai_suggested_response?: string | null
          approved_response?: string | null
          conversation_id?: string | null
          conversation_result?: string | null
          created_at?: string
          id?: string
          intent_detected?: string | null
          interaction_type?: string | null
          message_id?: string | null
          platform_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_ai_logs_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "service_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_ai_logs_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "service_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_ai_logs_platform_id_fkey"
            columns: ["platform_id"]
            isOneToOne: false
            referencedRelation: "digital_platforms"
            referencedColumns: ["id"]
          },
        ]
      }
      service_conversations: {
        Row: {
          auto_reply_enabled: boolean
          contact_avatar_url: string | null
          contact_handle: string | null
          contact_name: string | null
          created_at: string
          funnel_stage: string
          id: string
          last_message_at: string
          last_message_preview: string | null
          platform_id: string | null
          sales_channels: Json | null
          status: string
          unread_count: number
          updated_at: string
        }
        Insert: {
          auto_reply_enabled?: boolean
          contact_avatar_url?: string | null
          contact_handle?: string | null
          contact_name?: string | null
          created_at?: string
          funnel_stage?: string
          id?: string
          last_message_at?: string
          last_message_preview?: string | null
          platform_id?: string | null
          sales_channels?: Json | null
          status?: string
          unread_count?: number
          updated_at?: string
        }
        Update: {
          auto_reply_enabled?: boolean
          contact_avatar_url?: string | null
          contact_handle?: string | null
          contact_name?: string | null
          created_at?: string
          funnel_stage?: string
          id?: string
          last_message_at?: string
          last_message_preview?: string | null
          platform_id?: string | null
          sales_channels?: Json | null
          status?: string
          unread_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_conversations_platform_id_fkey"
            columns: ["platform_id"]
            isOneToOne: false
            referencedRelation: "digital_platforms"
            referencedColumns: ["id"]
          },
        ]
      }
      service_messages: {
        Row: {
          ai_approved: boolean | null
          content: string
          conversation_id: string
          created_at: string
          id: string
          intent_detected: string | null
          is_ai_suggested: boolean
          sender: string
        }
        Insert: {
          ai_approved?: boolean | null
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          intent_detected?: string | null
          is_ai_suggested?: boolean
          sender?: string
        }
        Update: {
          ai_approved?: boolean | null
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          intent_detected?: string | null
          is_ai_suggested?: boolean
          sender?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "service_conversations"
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
