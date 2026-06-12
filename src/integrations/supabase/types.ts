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
      commands: {
        Row: {
          acknowledged_at: string | null
          command_type: Database["public"]["Enums"]["command_type"]
          created_at: string
          delivered_at: string | null
          device_id: string
          id: string
          issued_by: string | null
          payload: Json
          result: Json | null
          status: Database["public"]["Enums"]["command_status"]
        }
        Insert: {
          acknowledged_at?: string | null
          command_type: Database["public"]["Enums"]["command_type"]
          created_at?: string
          delivered_at?: string | null
          device_id: string
          id?: string
          issued_by?: string | null
          payload?: Json
          result?: Json | null
          status?: Database["public"]["Enums"]["command_status"]
        }
        Update: {
          acknowledged_at?: string | null
          command_type?: Database["public"]["Enums"]["command_type"]
          created_at?: string
          delivered_at?: string | null
          device_id?: string
          id?: string
          issued_by?: string | null
          payload?: Json
          result?: Json | null
          status?: Database["public"]["Enums"]["command_status"]
        }
        Relationships: [
          {
            foreignKeyName: "commands_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
        ]
      }
      content: {
        Row: {
          content_type: Database["public"]["Enums"]["content_type"]
          created_at: string
          created_by: string | null
          file_size: number | null
          file_url: string
          id: string
          metadata: Json
          thumbnail_url: string | null
          title: string
          updated_at: string
        }
        Insert: {
          content_type: Database["public"]["Enums"]["content_type"]
          created_at?: string
          created_by?: string | null
          file_size?: number | null
          file_url: string
          id?: string
          metadata?: Json
          thumbnail_url?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          content_type?: Database["public"]["Enums"]["content_type"]
          created_at?: string
          created_by?: string | null
          file_size?: number | null
          file_url?: string
          id?: string
          metadata?: Json
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      device_groups: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      devices: {
        Row: {
          created_at: string
          created_by: string | null
          device_name: string
          device_type: Database["public"]["Enums"]["device_type"]
          group_id: string | null
          id: string
          last_seen: string | null
          metadata: Json
          operating_system: string | null
          registration_token: string | null
          status: Database["public"]["Enums"]["device_status"]
          unique_identifier: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          device_name: string
          device_type?: Database["public"]["Enums"]["device_type"]
          group_id?: string | null
          id?: string
          last_seen?: string | null
          metadata?: Json
          operating_system?: string | null
          registration_token?: string | null
          status?: Database["public"]["Enums"]["device_status"]
          unique_identifier: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          device_name?: string
          device_type?: Database["public"]["Enums"]["device_type"]
          group_id?: string | null
          id?: string
          last_seen?: string | null
          metadata?: Json
          operating_system?: string | null
          registration_token?: string | null
          status?: Database["public"]["Enums"]["device_status"]
          unique_identifier?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "devices_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "device_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "operator"
      command_status: "pending" | "delivered" | "acknowledged" | "failed"
      command_type:
        | "open_url"
        | "show_image"
        | "play_video"
        | "show_pdf"
        | "reboot"
        | "screenshot"
      content_type: "url" | "image" | "video" | "pdf"
      device_status: "online" | "offline" | "unregistered"
      device_type:
        | "android_tv"
        | "android_phone"
        | "android_tablet"
        | "windows_pc"
        | "mini_pc"
        | "other"
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
      app_role: ["admin", "operator"],
      command_status: ["pending", "delivered", "acknowledged", "failed"],
      command_type: [
        "open_url",
        "show_image",
        "play_video",
        "show_pdf",
        "reboot",
        "screenshot",
      ],
      content_type: ["url", "image", "video", "pdf"],
      device_status: ["online", "offline", "unregistered"],
      device_type: [
        "android_tv",
        "android_phone",
        "android_tablet",
        "windows_pc",
        "mini_pc",
        "other",
      ],
    },
  },
} as const
