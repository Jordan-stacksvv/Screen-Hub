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
      branches: {
        Row: {
          created_at: string
          id: string
          location: string | null
          name: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          location?: string | null
          name: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          location?: string | null
          name?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "branches_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      broadcasts: {
        Row: {
          command_type: Database["public"]["Enums"]["command_type"]
          created_at: string
          id: string
          issued_by: string | null
          name: string | null
          payload: Json
          target_id: string | null
          target_type: Database["public"]["Enums"]["schedule_target"]
          total_targets: number
        }
        Insert: {
          command_type: Database["public"]["Enums"]["command_type"]
          created_at?: string
          id?: string
          issued_by?: string | null
          name?: string | null
          payload?: Json
          target_id?: string | null
          target_type: Database["public"]["Enums"]["schedule_target"]
          total_targets?: number
        }
        Update: {
          command_type?: Database["public"]["Enums"]["command_type"]
          created_at?: string
          id?: string
          issued_by?: string | null
          name?: string | null
          payload?: Json
          target_id?: string | null
          target_type?: Database["public"]["Enums"]["schedule_target"]
          total_targets?: number
        }
        Relationships: []
      }
      command_metrics: {
        Row: {
          acknowledged: number
          command_type: Database["public"]["Enums"]["command_type"]
          day: string
          delivered: number
          failed: number
          id: string
          issued: number
        }
        Insert: {
          acknowledged?: number
          command_type: Database["public"]["Enums"]["command_type"]
          day: string
          delivered?: number
          failed?: number
          id?: string
          issued?: number
        }
        Update: {
          acknowledged?: number
          command_type?: Database["public"]["Enums"]["command_type"]
          day?: string
          delivered?: number
          failed?: number
          id?: string
          issued?: number
        }
        Relationships: []
      }
      commands: {
        Row: {
          acknowledged_at: string | null
          broadcast_id: string | null
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
          broadcast_id?: string | null
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
          broadcast_id?: string | null
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
            foreignKeyName: "commands_broadcast_id_fkey"
            columns: ["broadcast_id"]
            isOneToOne: false
            referencedRelation: "broadcasts"
            referencedColumns: ["id"]
          },
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
      device_analytics_daily: {
        Row: {
          content_displayed: number
          day: string
          device_id: string
          heartbeats: number
          id: string
          uptime_seconds: number
        }
        Insert: {
          content_displayed?: number
          day: string
          device_id: string
          heartbeats?: number
          id?: string
          uptime_seconds?: number
        }
        Update: {
          content_displayed?: number
          day?: string
          device_id?: string
          heartbeats?: number
          id?: string
          uptime_seconds?: number
        }
        Relationships: [
          {
            foreignKeyName: "device_analytics_daily_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
        ]
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
          current_content_id: string | null
          current_playlist_id: string | null
          device_name: string
          device_type: Database["public"]["Enums"]["device_type"]
          group_id: string | null
          id: string
          last_seen: string | null
          metadata: Json
          operating_system: string | null
          paired_at: string | null
          registration_token: string | null
          status: Database["public"]["Enums"]["device_status"]
          unique_identifier: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          current_content_id?: string | null
          current_playlist_id?: string | null
          device_name: string
          device_type?: Database["public"]["Enums"]["device_type"]
          group_id?: string | null
          id?: string
          last_seen?: string | null
          metadata?: Json
          operating_system?: string | null
          paired_at?: string | null
          registration_token?: string | null
          status?: Database["public"]["Enums"]["device_status"]
          unique_identifier: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          current_content_id?: string | null
          current_playlist_id?: string | null
          device_name?: string
          device_type?: Database["public"]["Enums"]["device_type"]
          group_id?: string | null
          id?: string
          last_seen?: string | null
          metadata?: Json
          operating_system?: string | null
          paired_at?: string | null
          registration_token?: string | null
          status?: Database["public"]["Enums"]["device_status"]
          unique_identifier?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "devices_current_content_id_fkey"
            columns: ["current_content_id"]
            isOneToOne: false
            referencedRelation: "content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devices_current_playlist_id_fkey"
            columns: ["current_playlist_id"]
            isOneToOne: false
            referencedRelation: "playlists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devices_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "device_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      pairing_codes: {
        Row: {
          claimed_at: string | null
          claimed_by: string | null
          code: string
          created_at: string
          device_id: string | null
          expires_at: string
          id: string
          metadata: Json
        }
        Insert: {
          claimed_at?: string | null
          claimed_by?: string | null
          code: string
          created_at?: string
          device_id?: string | null
          expires_at?: string
          id?: string
          metadata?: Json
        }
        Update: {
          claimed_at?: string | null
          claimed_by?: string | null
          code?: string
          created_at?: string
          device_id?: string | null
          expires_at?: string
          id?: string
          metadata?: Json
        }
        Relationships: [
          {
            foreignKeyName: "pairing_codes_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
        ]
      }
      playlist_items: {
        Row: {
          content_id: string
          created_at: string
          duration_seconds: number
          id: string
          playlist_id: string
          position: number
        }
        Insert: {
          content_id: string
          created_at?: string
          duration_seconds?: number
          id?: string
          playlist_id: string
          position?: number
        }
        Update: {
          content_id?: string
          created_at?: string
          duration_seconds?: number
          id?: string
          playlist_id?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "playlist_items_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playlist_items_playlist_id_fkey"
            columns: ["playlist_id"]
            isOneToOne: false
            referencedRelation: "playlists"
            referencedColumns: ["id"]
          },
        ]
      }
      playlists: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          loop_enabled: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          loop_enabled?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          loop_enabled?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
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
      schedules: {
        Row: {
          content_id: string | null
          created_at: string
          created_by: string | null
          enabled: boolean
          ends_at: string | null
          id: string
          name: string
          playlist_id: string | null
          priority: number
          recurrence: Json
          starts_at: string
          target_id: string | null
          target_type: Database["public"]["Enums"]["schedule_target"]
          updated_at: string
        }
        Insert: {
          content_id?: string | null
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          ends_at?: string | null
          id?: string
          name: string
          playlist_id?: string | null
          priority?: number
          recurrence?: Json
          starts_at?: string
          target_id?: string | null
          target_type: Database["public"]["Enums"]["schedule_target"]
          updated_at?: string
        }
        Update: {
          content_id?: string | null
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          ends_at?: string | null
          id?: string
          name?: string
          playlist_id?: string | null
          priority?: number
          recurrence?: Json
          starts_at?: string
          target_id?: string | null
          target_type?: Database["public"]["Enums"]["schedule_target"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedules_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedules_playlist_id_fkey"
            columns: ["playlist_id"]
            isOneToOne: false
            referencedRelation: "playlists"
            referencedColumns: ["id"]
          },
        ]
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
      workspaces: {
        Row: {
          created_at: string
          id: string
          name: string
          organization_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          organization_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          organization_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workspaces_organization_id_fkey"
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_workspace_member: { Args: { _user_id: string }; Returns: boolean }
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
      schedule_target: "device" | "group" | "all"
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
      schedule_target: ["device", "group", "all"],
    },
  },
} as const
