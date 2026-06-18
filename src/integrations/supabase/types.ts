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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      bill_items: {
        Row: {
          bill_id: string
          id: string
          item_id: string | null
          qty: number
          rate: number
          raw_name: string | null
        }
        Insert: {
          bill_id: string
          id?: string
          item_id?: string | null
          qty?: number
          rate?: number
          raw_name?: string | null
        }
        Update: {
          bill_id?: string
          id?: string
          item_id?: string | null
          qty?: number
          rate?: number
          raw_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bill_items_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      bills: {
        Row: {
          bill_date: string | null
          bill_no: string | null
          created_at: string
          file_path: string | null
          id: string
          notes: string | null
          status: string
          type: string
          vendor: string | null
        }
        Insert: {
          bill_date?: string | null
          bill_no?: string | null
          created_at?: string
          file_path?: string | null
          id?: string
          notes?: string | null
          status?: string
          type: string
          vendor?: string | null
        }
        Update: {
          bill_date?: string | null
          bill_no?: string | null
          created_at?: string
          file_path?: string | null
          id?: string
          notes?: string | null
          status?: string
          type?: string
          vendor?: string | null
        }
        Relationships: []
      }
      factories: {
        Row: {
          basic_rate: number
          id: string
          name: string
          position: number
          updated_at: string
        }
        Insert: {
          basic_rate?: number
          id?: string
          name: string
          position?: number
          updated_at?: string
        }
        Update: {
          basic_rate?: number
          id?: string
          name?: string
          position?: number
          updated_at?: string
        }
        Relationships: []
      }
      factory_rate_history: {
        Row: {
          basic_rate: number
          changed_at: string
          factory_id: string
          id: string
        }
        Insert: {
          basic_rate: number
          changed_at?: string
          factory_id: string
          id?: string
        }
        Update: {
          basic_rate?: number
          changed_at?: string
          factory_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "factory_rate_history_factory_id_fkey"
            columns: ["factory_id"]
            isOneToOne: false
            referencedRelation: "factories"
            referencedColumns: ["id"]
          },
        ]
      }
      items: {
        Row: {
          available_qty: number
          gauge_diff: number
          id: string
          last_purchase_rate: number | null
          name: string
          position: number
          section_id: string
        }
        Insert: {
          available_qty?: number
          gauge_diff?: number
          id?: string
          last_purchase_rate?: number | null
          name: string
          position?: number
          section_id: string
        }
        Update: {
          available_qty?: number
          gauge_diff?: number
          id?: string
          last_purchase_rate?: number | null
          name?: string
          position?: number
          section_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "items_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
        ]
      }
      sauda_items: {
        Row: {
          id: string
          item_id: string | null
          qty: number
          rate: number
          raw_name: string | null
          sauda_id: string
        }
        Insert: {
          id?: string
          item_id?: string | null
          qty?: number
          rate?: number
          raw_name?: string | null
          sauda_id: string
        }
        Update: {
          id?: string
          item_id?: string | null
          qty?: number
          rate?: number
          raw_name?: string | null
          sauda_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sauda_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sauda_items_sauda_id_fkey"
            columns: ["sauda_id"]
            isOneToOne: false
            referencedRelation: "saudas"
            referencedColumns: ["id"]
          },
        ]
      }
      sauda_uplifts: {
        Row: {
          bill_id: string | null
          created_at: string
          id: string
          kind: string
          note: string | null
          qty: number
          sauda_id: string
        }
        Insert: {
          bill_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          note?: string | null
          qty: number
          sauda_id: string
        }
        Update: {
          bill_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          note?: string | null
          qty?: number
          sauda_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sauda_uplifts_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sauda_uplifts_sauda_id_fkey"
            columns: ["sauda_id"]
            isOneToOne: false
            referencedRelation: "saudas"
            referencedColumns: ["id"]
          },
        ]
      }
      saudas: {
        Row: {
          created_at: string
          factory_id: string | null
          id: string
          lifted_qty: number
          linked_bill_id: string | null
          notes: string | null
          party_name: string
          sauda_basic: number
          sauda_date: string
          status: string
        }
        Insert: {
          created_at?: string
          factory_id?: string | null
          id?: string
          lifted_qty?: number
          linked_bill_id?: string | null
          notes?: string | null
          party_name: string
          sauda_basic?: number
          sauda_date?: string
          status?: string
        }
        Update: {
          created_at?: string
          factory_id?: string | null
          id?: string
          lifted_qty?: number
          linked_bill_id?: string | null
          notes?: string | null
          party_name?: string
          sauda_basic?: number
          sauda_date?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "saudas_factory_id_fkey"
            columns: ["factory_id"]
            isOneToOne: false
            referencedRelation: "factories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saudas_linked_bill_id_fkey"
            columns: ["linked_bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
        ]
      }
      section_rate_history: {
        Row: {
          adder: number
          changed_at: string
          id: string
          party_basic: number
          sauda_basic: number
          section_id: string
        }
        Insert: {
          adder: number
          changed_at?: string
          id?: string
          party_basic: number
          sauda_basic: number
          section_id: string
        }
        Update: {
          adder?: number
          changed_at?: string
          id?: string
          party_basic?: number
          sauda_basic?: number
          section_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "section_rate_history_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
        ]
      }
      sections: {
        Row: {
          adder: number
          factory_id: string
          id: string
          name: string
          party_basic: number
          position: number
          sauda_basic: number
        }
        Insert: {
          adder?: number
          factory_id: string
          id?: string
          name: string
          party_basic?: number
          position?: number
          sauda_basic?: number
        }
        Update: {
          adder?: number
          factory_id?: string
          id?: string
          name?: string
          party_basic?: number
          position?: number
          sauda_basic?: number
        }
        Relationships: [
          {
            foreignKeyName: "sections_factory_id_fkey"
            columns: ["factory_id"]
            isOneToOne: false
            referencedRelation: "factories"
            referencedColumns: ["id"]
          },
        ]
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
