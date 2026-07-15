export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      announcement_reads: {
        Row: {
          announcement_id: string;
          id: string;
          partner_id: string;
          read_at: string;
        };
        Insert: {
          announcement_id: string;
          id?: string;
          partner_id: string;
          read_at?: string;
        };
        Update: {
          announcement_id?: string;
          id?: string;
          partner_id?: string;
          read_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "announcement_reads_announcement_id_fkey";
            columns: ["announcement_id"];
            isOneToOne: false;
            referencedRelation: "announcements";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "announcement_reads_partner_id_fkey";
            columns: ["partner_id"];
            isOneToOne: false;
            referencedRelation: "partner_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      announcements: {
        Row: {
          archived_at: string | null;
          body: string;
          id: string;
          priority: Database["public"]["Enums"]["announcement_priority"];
          published_at: string;
          published_by: string | null;
          send_email: boolean;
          target_rules: Json;
          target_type: string;
          title: string;
        };
        Insert: {
          archived_at?: string | null;
          body: string;
          id?: string;
          priority?: Database["public"]["Enums"]["announcement_priority"];
          published_at?: string;
          published_by?: string | null;
          send_email?: boolean;
          target_rules?: Json;
          target_type?: string;
          title: string;
        };
        Update: {
          archived_at?: string | null;
          body?: string;
          id?: string;
          priority?: Database["public"]["Enums"]["announcement_priority"];
          published_at?: string;
          published_by?: string | null;
          send_email?: boolean;
          target_rules?: Json;
          target_type?: string;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "announcements_published_by_fkey";
            columns: ["published_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      audit_log: {
        Row: {
          action: string;
          actor_id: string | null;
          actor_name: string;
          created_at: string;
          id: string;
          ip_address: unknown;
          module: string;
          new_value: Json | null;
          old_value: Json | null;
          record_id: string | null;
          record_name: string | null;
          user_agent: string | null;
        };
        Insert: {
          action: string;
          actor_id?: string | null;
          actor_name?: string;
          created_at?: string;
          id?: string;
          ip_address?: unknown;
          module: string;
          new_value?: Json | null;
          old_value?: Json | null;
          record_id?: string | null;
          record_name?: string | null;
          user_agent?: string | null;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          actor_name?: string;
          created_at?: string;
          id?: string;
          ip_address?: unknown;
          module?: string;
          new_value?: Json | null;
          old_value?: Json | null;
          record_id?: string | null;
          record_name?: string | null;
          user_agent?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      client_payments: {
        Row: {
          amount_received: number;
          created_at: string;
          created_by: string | null;
          id: string;
          lead_id: string;
          notes: string | null;
          payment_method: string;
          payment_reference: string;
          received_date: string;
          trigger_commission_eligibility: boolean;
        };
        Insert: {
          amount_received: number;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          lead_id: string;
          notes?: string | null;
          payment_method: string;
          payment_reference: string;
          received_date: string;
          trigger_commission_eligibility?: boolean;
        };
        Update: {
          amount_received?: number;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          lead_id?: string;
          notes?: string | null;
          payment_method?: string;
          payment_reference?: string;
          received_date?: string;
          trigger_commission_eligibility?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "client_payments_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "client_payments_lead_id_fkey";
            columns: ["lead_id"];
            isOneToOne: false;
            referencedRelation: "leads";
            referencedColumns: ["id"];
          },
        ];
      };
      commission_bonuses: {
        Row: {
          amount: number;
          commission_id: string | null;
          created_at: string;
          created_by: string | null;
          id: string;
          label: string;
          lead_id: string;
          partner_id: string;
          reason: string;
        };
        Insert: {
          amount: number;
          commission_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          label: string;
          lead_id: string;
          partner_id: string;
          reason: string;
        };
        Update: {
          amount?: number;
          commission_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          label?: string;
          lead_id?: string;
          partner_id?: string;
          reason?: string;
        };
        Relationships: [
          {
            foreignKeyName: "commission_bonuses_commission_id_fkey";
            columns: ["commission_id"];
            isOneToOne: false;
            referencedRelation: "commissions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "commission_bonuses_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "commission_bonuses_lead_id_fkey";
            columns: ["lead_id"];
            isOneToOne: false;
            referencedRelation: "leads";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "commission_bonuses_partner_id_fkey";
            columns: ["partner_id"];
            isOneToOne: false;
            referencedRelation: "partner_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      commissions: {
        Row: {
          amount: number;
          base_amount: number | null;
          closed_date: string | null;
          created_at: string;
          created_by: string | null;
          id: string;
          kind: Database["public"]["Enums"]["commission_kind"];
          label: string | null;
          lead_id: string;
          override_reason: string | null;
          partner_id: string;
          rate: number;
          state: Database["public"]["Enums"]["commission_state"];
          updated_at: string;
          waived_reason: string | null;
        };
        Insert: {
          amount: number;
          base_amount?: number | null;
          closed_date?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          kind?: Database["public"]["Enums"]["commission_kind"];
          label?: string | null;
          lead_id: string;
          override_reason?: string | null;
          partner_id: string;
          rate?: number;
          state?: Database["public"]["Enums"]["commission_state"];
          updated_at?: string;
          waived_reason?: string | null;
        };
        Update: {
          amount?: number;
          base_amount?: number | null;
          closed_date?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          kind?: Database["public"]["Enums"]["commission_kind"];
          label?: string | null;
          lead_id?: string;
          override_reason?: string | null;
          partner_id?: string;
          rate?: number;
          state?: Database["public"]["Enums"]["commission_state"];
          updated_at?: string;
          waived_reason?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "commissions_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "commissions_lead_id_fkey";
            columns: ["lead_id"];
            isOneToOne: false;
            referencedRelation: "leads";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "commissions_partner_id_fkey";
            columns: ["partner_id"];
            isOneToOne: false;
            referencedRelation: "partner_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      discovery_call_attachments: {
        Row: {
          discovery_call_id: string;
          id: string;
          name: string;
          storage_bucket: string;
          storage_path: string;
          uploaded_at: string;
          uploaded_by: string | null;
        };
        Insert: {
          discovery_call_id: string;
          id?: string;
          name: string;
          storage_bucket?: string;
          storage_path: string;
          uploaded_at?: string;
          uploaded_by?: string | null;
        };
        Update: {
          discovery_call_id?: string;
          id?: string;
          name?: string;
          storage_bucket?: string;
          storage_path?: string;
          uploaded_at?: string;
          uploaded_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "discovery_call_attachments_discovery_call_id_fkey";
            columns: ["discovery_call_id"];
            isOneToOne: false;
            referencedRelation: "discovery_calls";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "discovery_call_attachments_uploaded_by_fkey";
            columns: ["uploaded_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      discovery_calls: {
        Row: {
          call_at: string;
          client_attendees: string;
          created_at: string;
          created_by: string | null;
          duration_minutes: number;
          follow_up_date: string | null;
          goaccelovate_attendees: string;
          id: string;
          is_private: boolean;
          lead_id: string;
          next_steps: string;
          outcomes: string;
          partner_joined: boolean;
          recording_url: string | null;
          summary: string;
        };
        Insert: {
          call_at: string;
          client_attendees: string;
          created_at?: string;
          created_by?: string | null;
          duration_minutes: number;
          follow_up_date?: string | null;
          goaccelovate_attendees: string;
          id?: string;
          is_private?: boolean;
          lead_id: string;
          next_steps: string;
          outcomes: string;
          partner_joined?: boolean;
          recording_url?: string | null;
          summary: string;
        };
        Update: {
          call_at?: string;
          client_attendees?: string;
          created_at?: string;
          created_by?: string | null;
          duration_minutes?: number;
          follow_up_date?: string | null;
          goaccelovate_attendees?: string;
          id?: string;
          is_private?: boolean;
          lead_id?: string;
          next_steps?: string;
          outcomes?: string;
          partner_joined?: boolean;
          recording_url?: string | null;
          summary?: string;
        };
        Relationships: [
          {
            foreignKeyName: "discovery_calls_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "discovery_calls_lead_id_fkey";
            columns: ["lead_id"];
            isOneToOne: false;
            referencedRelation: "leads";
            referencedColumns: ["id"];
          },
        ];
      };
      dispute_messages: {
        Row: {
          actor_id: string | null;
          actor_name: string;
          created_at: string;
          dispute_id: string;
          id: string;
          text: string;
        };
        Insert: {
          actor_id?: string | null;
          actor_name: string;
          created_at?: string;
          dispute_id: string;
          id?: string;
          text: string;
        };
        Update: {
          actor_id?: string | null;
          actor_name?: string;
          created_at?: string;
          dispute_id?: string;
          id?: string;
          text?: string;
        };
        Relationships: [
          {
            foreignKeyName: "dispute_messages_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "dispute_messages_dispute_id_fkey";
            columns: ["dispute_id"];
            isOneToOne: false;
            referencedRelation: "disputes";
            referencedColumns: ["id"];
          },
        ];
      };
      disputes: {
        Row: {
          commission_id: string;
          created_at: string;
          id: string;
          opened_by: string | null;
          partner_id: string;
          reason: string;
          resolution: string | null;
          resolved_at: string | null;
          resolved_by: string | null;
          status: Database["public"]["Enums"]["dispute_status"];
          updated_at: string;
        };
        Insert: {
          commission_id: string;
          created_at?: string;
          id?: string;
          opened_by?: string | null;
          partner_id: string;
          reason: string;
          resolution?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          status?: Database["public"]["Enums"]["dispute_status"];
          updated_at?: string;
        };
        Update: {
          commission_id?: string;
          created_at?: string;
          id?: string;
          opened_by?: string | null;
          partner_id?: string;
          reason?: string;
          resolution?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          status?: Database["public"]["Enums"]["dispute_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "disputes_commission_id_fkey";
            columns: ["commission_id"];
            isOneToOne: false;
            referencedRelation: "commissions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "disputes_opened_by_fkey";
            columns: ["opened_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "disputes_partner_id_fkey";
            columns: ["partner_id"];
            isOneToOne: false;
            referencedRelation: "partner_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "disputes_resolved_by_fkey";
            columns: ["resolved_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      invitations: {
        Row: {
          accepted_at: string | null;
          created_at: string;
          email: string;
          expires_at: string;
          id: string;
          invited_by: string | null;
          partner_id: string | null;
          revoked_at: string | null;
          role: Database["public"]["Enums"]["app_role"];
          tier: Database["public"]["Enums"]["partner_tier"] | null;
          token_hash: string;
        };
        Insert: {
          accepted_at?: string | null;
          created_at?: string;
          email: string;
          expires_at: string;
          id?: string;
          invited_by?: string | null;
          partner_id?: string | null;
          revoked_at?: string | null;
          role: Database["public"]["Enums"]["app_role"];
          tier?: Database["public"]["Enums"]["partner_tier"] | null;
          token_hash: string;
        };
        Update: {
          accepted_at?: string | null;
          created_at?: string;
          email?: string;
          expires_at?: string;
          id?: string;
          invited_by?: string | null;
          partner_id?: string | null;
          revoked_at?: string | null;
          role?: Database["public"]["Enums"]["app_role"];
          tier?: Database["public"]["Enums"]["partner_tier"] | null;
          token_hash?: string;
        };
        Relationships: [
          {
            foreignKeyName: "invitations_invited_by_fkey";
            columns: ["invited_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invitations_partner_id_fkey";
            columns: ["partner_id"];
            isOneToOne: false;
            referencedRelation: "partner_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      lead_activity_log: {
        Row: {
          actor_id: string | null;
          actor_name: string;
          created_at: string;
          id: string;
          is_private: boolean;
          lead_id: string | null;
          text: string;
          type: Database["public"]["Enums"]["activity_type"];
        };
        Insert: {
          actor_id?: string | null;
          actor_name?: string;
          created_at?: string;
          id?: string;
          is_private?: boolean;
          lead_id?: string | null;
          text: string;
          type: Database["public"]["Enums"]["activity_type"];
        };
        Update: {
          actor_id?: string | null;
          actor_name?: string;
          created_at?: string;
          id?: string;
          is_private?: boolean;
          lead_id?: string | null;
          text?: string;
          type?: Database["public"]["Enums"]["activity_type"];
        };
        Relationships: [
          {
            foreignKeyName: "lead_activity_log_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lead_activity_log_lead_id_fkey";
            columns: ["lead_id"];
            isOneToOne: false;
            referencedRelation: "leads";
            referencedColumns: ["id"];
          },
        ];
      };
      lead_attachments: {
        Row: {
          id: string;
          is_private: boolean;
          lead_id: string;
          name: string;
          storage_bucket: string;
          storage_path: string;
          uploaded_at: string;
          uploaded_by: string | null;
        };
        Insert: {
          id?: string;
          is_private?: boolean;
          lead_id: string;
          name: string;
          storage_bucket?: string;
          storage_path: string;
          uploaded_at?: string;
          uploaded_by?: string | null;
        };
        Update: {
          id?: string;
          is_private?: boolean;
          lead_id?: string;
          name?: string;
          storage_bucket?: string;
          storage_path?: string;
          uploaded_at?: string;
          uploaded_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "lead_attachments_lead_id_fkey";
            columns: ["lead_id"];
            isOneToOne: false;
            referencedRelation: "leads";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lead_attachments_uploaded_by_fkey";
            columns: ["uploaded_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      leads: {
        Row: {
          closed_reason: string | null;
          company_name: string;
          confirmed_value: number | null;
          contact_email: string;
          contact_name: string;
          contact_phone: string | null;
          contact_title: string;
          country: string;
          created_at: string;
          created_by: string | null;
          currency: string;
          description: string;
          duplicate_reason: string | null;
          duplicate_reviewed_at: string | null;
          duplicate_reviewed_by: string | null;
          estimated_value: number;
          id: string;
          industry: string;
          last_activity_at: string;
          partner_id: string;
          public_id: string | null;
          stage: Database["public"]["Enums"]["lead_stage"];
          status: Database["public"]["Enums"]["lead_status"];
          updated_at: string;
        };
        Insert: {
          closed_reason?: string | null;
          company_name: string;
          confirmed_value?: number | null;
          contact_email: string;
          contact_name: string;
          contact_phone?: string | null;
          contact_title: string;
          country: string;
          created_at?: string;
          created_by?: string | null;
          currency: string;
          description: string;
          duplicate_reason?: string | null;
          duplicate_reviewed_at?: string | null;
          duplicate_reviewed_by?: string | null;
          estimated_value: number;
          id?: string;
          industry: string;
          last_activity_at?: string;
          partner_id: string;
          public_id?: string | null;
          stage?: Database["public"]["Enums"]["lead_stage"];
          status?: Database["public"]["Enums"]["lead_status"];
          updated_at?: string;
        };
        Update: {
          closed_reason?: string | null;
          company_name?: string;
          confirmed_value?: number | null;
          contact_email?: string;
          contact_name?: string;
          contact_phone?: string | null;
          contact_title?: string;
          country?: string;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          description?: string;
          duplicate_reason?: string | null;
          duplicate_reviewed_at?: string | null;
          duplicate_reviewed_by?: string | null;
          estimated_value?: number;
          id?: string;
          industry?: string;
          last_activity_at?: string;
          partner_id?: string;
          public_id?: string | null;
          stage?: Database["public"]["Enums"]["lead_stage"];
          status?: Database["public"]["Enums"]["lead_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "leads_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "leads_duplicate_reviewed_by_fkey";
            columns: ["duplicate_reviewed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "leads_partner_id_fkey";
            columns: ["partner_id"];
            isOneToOne: false;
            referencedRelation: "partner_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      notifications: {
        Row: {
          body: string;
          created_at: string;
          id: string;
          mandatory: boolean;
          partner_id: string | null;
          read_at: string | null;
          recipient_id: string | null;
          title: string;
          type: string;
        };
        Insert: {
          body: string;
          created_at?: string;
          id?: string;
          mandatory?: boolean;
          partner_id?: string | null;
          read_at?: string | null;
          recipient_id?: string | null;
          title: string;
          type?: string;
        };
        Update: {
          body?: string;
          created_at?: string;
          id?: string;
          mandatory?: boolean;
          partner_id?: string | null;
          read_at?: string | null;
          recipient_id?: string | null;
          title?: string;
          type?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_partner_id_fkey";
            columns: ["partner_id"];
            isOneToOne: false;
            referencedRelation: "partner_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_recipient_id_fkey";
            columns: ["recipient_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      onboarding_steps: {
        Row: {
          active: boolean;
          created_at: string;
          id: string;
          key: string;
          label: string;
          sort_order: number;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          id?: string;
          key: string;
          label: string;
          sort_order?: number;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          id?: string;
          key?: string;
          label?: string;
          sort_order?: number;
        };
        Relationships: [];
      };
      partner_documents: {
        Row: {
          document_type: string;
          id: string;
          is_private: boolean;
          name: string;
          partner_id: string;
          storage_bucket: string;
          storage_path: string;
          uploaded_at: string;
          uploaded_by: string | null;
        };
        Insert: {
          document_type?: string;
          id?: string;
          is_private?: boolean;
          name: string;
          partner_id: string;
          storage_bucket?: string;
          storage_path: string;
          uploaded_at?: string;
          uploaded_by?: string | null;
        };
        Update: {
          document_type?: string;
          id?: string;
          is_private?: boolean;
          name?: string;
          partner_id?: string;
          storage_bucket?: string;
          storage_path?: string;
          uploaded_at?: string;
          uploaded_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "partner_documents_partner_id_fkey";
            columns: ["partner_id"];
            isOneToOne: false;
            referencedRelation: "partner_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "partner_documents_uploaded_by_fkey";
            columns: ["uploaded_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      partner_onboarding_steps: {
        Row: {
          completed: boolean;
          completed_at: string | null;
          completed_by: string | null;
          id: string;
          partner_id: string;
          step_id: string;
        };
        Insert: {
          completed?: boolean;
          completed_at?: string | null;
          completed_by?: string | null;
          id?: string;
          partner_id: string;
          step_id: string;
        };
        Update: {
          completed?: boolean;
          completed_at?: string | null;
          completed_by?: string | null;
          id?: string;
          partner_id?: string;
          step_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "partner_onboarding_steps_completed_by_fkey";
            columns: ["completed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "partner_onboarding_steps_partner_id_fkey";
            columns: ["partner_id"];
            isOneToOne: false;
            referencedRelation: "partner_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "partner_onboarding_steps_step_id_fkey";
            columns: ["step_id"];
            isOneToOne: false;
            referencedRelation: "onboarding_steps";
            referencedColumns: ["id"];
          },
        ];
      };
      partner_profiles: {
        Row: {
          assigned_contact: string;
          bio: string;
          city: string;
          commission_rate: number;
          country: string;
          created_at: string;
          deleted_at: string | null;
          email: string;
          id: string;
          joined_date: string;
          linkedin: string;
          name: string;
          phone: string;
          status: Database["public"]["Enums"]["account_status"];
          tier: Database["public"]["Enums"]["partner_tier"];
          updated_at: string;
          user_id: string | null;
        };
        Insert: {
          assigned_contact?: string;
          bio?: string;
          city?: string;
          commission_rate?: number;
          country?: string;
          created_at?: string;
          deleted_at?: string | null;
          email: string;
          id?: string;
          joined_date?: string;
          linkedin?: string;
          name: string;
          phone?: string;
          status?: Database["public"]["Enums"]["account_status"];
          tier?: Database["public"]["Enums"]["partner_tier"];
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          assigned_contact?: string;
          bio?: string;
          city?: string;
          commission_rate?: number;
          country?: string;
          created_at?: string;
          deleted_at?: string | null;
          email?: string;
          id?: string;
          joined_date?: string;
          linkedin?: string;
          name?: string;
          phone?: string;
          status?: Database["public"]["Enums"]["account_status"];
          tier?: Database["public"]["Enums"]["partner_tier"];
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "partner_profiles_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      payout_request_items: {
        Row: {
          amount: number;
          commission_id: string;
          id: string;
          payout_request_id: string;
        };
        Insert: {
          amount: number;
          commission_id: string;
          id?: string;
          payout_request_id: string;
        };
        Update: {
          amount?: number;
          commission_id?: string;
          id?: string;
          payout_request_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payout_request_items_commission_id_fkey";
            columns: ["commission_id"];
            isOneToOne: false;
            referencedRelation: "commissions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payout_request_items_payout_request_id_fkey";
            columns: ["payout_request_id"];
            isOneToOne: false;
            referencedRelation: "payout_requests";
            referencedColumns: ["id"];
          },
        ];
      };
      payout_requests: {
        Row: {
          amount: number;
          approved_at: string | null;
          approved_by: string | null;
          created_at: string;
          id: string;
          message: string | null;
          paid_amount: number | null;
          paid_date: string | null;
          partner_id: string;
          payment_method: string | null;
          reject_reason: string | null;
          requested_by: string | null;
          status: Database["public"]["Enums"]["payout_status"];
          transaction_reference: string | null;
          updated_at: string;
        };
        Insert: {
          amount?: number;
          approved_at?: string | null;
          approved_by?: string | null;
          created_at?: string;
          id?: string;
          message?: string | null;
          paid_amount?: number | null;
          paid_date?: string | null;
          partner_id: string;
          payment_method?: string | null;
          reject_reason?: string | null;
          requested_by?: string | null;
          status?: Database["public"]["Enums"]["payout_status"];
          transaction_reference?: string | null;
          updated_at?: string;
        };
        Update: {
          amount?: number;
          approved_at?: string | null;
          approved_by?: string | null;
          created_at?: string;
          id?: string;
          message?: string | null;
          paid_amount?: number | null;
          paid_date?: string | null;
          partner_id?: string;
          payment_method?: string | null;
          reject_reason?: string | null;
          requested_by?: string | null;
          status?: Database["public"]["Enums"]["payout_status"];
          transaction_reference?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payout_requests_approved_by_fkey";
            columns: ["approved_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payout_requests_partner_id_fkey";
            columns: ["partner_id"];
            isOneToOne: false;
            referencedRelation: "partner_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payout_requests_requested_by_fkey";
            columns: ["requested_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          account_status: Database["public"]["Enums"]["account_status"];
          avatar_url: string | null;
          created_at: string;
          email: string;
          email_notifications_enabled: boolean;
          full_name: string;
          id: string;
          partner_id: string | null;
          role: Database["public"]["Enums"]["app_role"];
          updated_at: string;
        };
        Insert: {
          account_status?: Database["public"]["Enums"]["account_status"];
          avatar_url?: string | null;
          created_at?: string;
          email: string;
          email_notifications_enabled?: boolean;
          full_name?: string;
          id: string;
          partner_id?: string | null;
          role?: Database["public"]["Enums"]["app_role"];
          updated_at?: string;
        };
        Update: {
          account_status?: Database["public"]["Enums"]["account_status"];
          avatar_url?: string | null;
          created_at?: string;
          email?: string;
          email_notifications_enabled?: boolean;
          full_name?: string;
          id?: string;
          partner_id?: string | null;
          role?: Database["public"]["Enums"]["app_role"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_partner_id_fkey";
            columns: ["partner_id"];
            isOneToOne: false;
            referencedRelation: "partner_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      settings: {
        Row: {
          description: string | null;
          key: string;
          updated_at: string;
          updated_by: string | null;
          value: Json;
        };
        Insert: {
          description?: string | null;
          key: string;
          updated_at?: string;
          updated_by?: string | null;
          value: Json;
        };
        Update: {
          description?: string | null;
          key?: string;
          updated_at?: string;
          updated_by?: string | null;
          value?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "settings_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      activate_current_profile: {
        Args: { new_full_name: string };
        Returns: {
          account_status: Database["public"]["Enums"]["account_status"];
          avatar_url: string | null;
          created_at: string;
          email: string;
          email_notifications_enabled: boolean;
          full_name: string;
          id: string;
          partner_id: string | null;
          role: Database["public"]["Enums"]["app_role"];
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "profiles";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      current_partner_id: { Args: never; Returns: string };
      current_user_role: {
        Args: never;
        Returns: Database["public"]["Enums"]["app_role"];
      };
      is_admin: { Args: never; Returns: boolean };
      is_current_partner: { Args: { partner: string }; Returns: boolean };
      is_partner_lead: { Args: { lead: string }; Returns: boolean };
      is_super_admin: { Args: never; Returns: boolean };
      partner_can_read_announcement: {
        Args: { announcement_id: string };
        Returns: boolean;
      };
      record_audit: {
        Args: {
          action: string;
          module: string;
          new_value?: Json;
          old_value?: Json;
          record_id?: string;
          record_name?: string;
        };
        Returns: string;
      };
      open_commission_dispute: {
        Args: { commission_id: string; reason: string };
        Returns: Database["public"]["Tables"]["disputes"]["Row"];
      };
      request_commission_payout: {
        Args: { commission_ids: string[]; message?: string };
        Returns: Database["public"]["Tables"]["payout_requests"]["Row"];
      };
      submit_partner_lead: {
        Args: {
          company_name: string;
          contact_email: string;
          contact_name: string;
          contact_phone: string;
          contact_title: string;
          country: string;
          currency: string;
          description: string;
          estimated_value: number;
          industry: string;
          lead_id: string;
        };
        Returns: Database["public"]["Tables"]["leads"]["Row"];
      };
    };
    Enums: {
      account_status: "active" | "suspended" | "pending" | "deactivated";
      activity_type:
        | "stage_change"
        | "status_change"
        | "comment"
        | "partner_update"
        | "discovery_call"
        | "file"
        | "admin_note"
        | "system";
      announcement_priority: "General" | "Important" | "Urgent";
      app_role: "super_admin" | "admin" | "partner";
      commission_kind: "Deal" | "Monthly Retainer" | "One-off Bonus";
      commission_state:
        | "Unpaid"
        | "Payout Requested"
        | "Approved"
        | "Paid"
        | "Disputed"
        | "On Hold"
        | "Waived";
      dispute_status: "Open" | "Under Review" | "Resolved" | "Rejected";
      lead_stage:
        | "New Lead"
        | "In Conversation"
        | "Discovery Call"
        | "Proposal Sent"
        | "Negotiation"
        | "Closed Won"
        | "Closed Lost";
      lead_status:
        | "Active"
        | "On Hold"
        | "Closed Won"
        | "Closed Lost"
        | "Duplicate Under Review"
        | "Duplicate Rejected"
        | "Disqualified"
        | "Reopened";
      partner_tier: "Associate" | "Specialist" | "Partner";
      payout_status: "Pending" | "Approved" | "Rejected" | "Paid";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      account_status: ["active", "suspended", "pending", "deactivated"],
      activity_type: [
        "stage_change",
        "status_change",
        "comment",
        "partner_update",
        "discovery_call",
        "file",
        "admin_note",
        "system",
      ],
      announcement_priority: ["General", "Important", "Urgent"],
      app_role: ["super_admin", "admin", "partner"],
      commission_kind: ["Deal", "Monthly Retainer", "One-off Bonus"],
      commission_state: [
        "Unpaid",
        "Payout Requested",
        "Approved",
        "Paid",
        "Disputed",
        "On Hold",
        "Waived",
      ],
      dispute_status: ["Open", "Under Review", "Resolved", "Rejected"],
      lead_stage: [
        "New Lead",
        "In Conversation",
        "Discovery Call",
        "Proposal Sent",
        "Negotiation",
        "Closed Won",
        "Closed Lost",
      ],
      lead_status: [
        "Active",
        "On Hold",
        "Closed Won",
        "Closed Lost",
        "Duplicate Under Review",
        "Duplicate Rejected",
        "Disqualified",
        "Reopened",
      ],
      partner_tier: ["Associate", "Specialist", "Partner"],
      payout_status: ["Pending", "Approved", "Rejected", "Paid"],
    },
  },
} as const;
