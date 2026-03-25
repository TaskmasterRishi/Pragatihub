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
      comment_downvotes: {
        Row: {
          comment_id: string
          created_at: string | null
          user_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string | null
          user_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comment_downvotes_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comment_downvotes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      comment_upvotes: {
        Row: {
          comment_id: string
          created_at: string | null
          user_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string | null
          user_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comment_upvotes_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comment_upvotes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          comment: string
          created_at: string
          id: string
          parent_id: string | null
          post_id: string
          user_id: string
        }
        Insert: {
          comment: string
          created_at: string
          id: string
          parent_id?: string | null
          post_id: string
          user_id: string
        }
        Update: {
          comment?: string
          created_at?: string
          id?: string
          parent_id?: string | null
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      community_chat_messages: {
        Row: {
          content: string
          created_at: string
          group_id: string
          id: string
          media_type: string | null
          media_url: string | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          group_id: string
          id?: string
          media_type?: string | null
          media_url?: string | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          group_id?: string
          id?: string
          media_type?: string | null
          media_url?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_chat_messages_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_chat_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      private_chat_messages: {
        Row: {
          chat_id: string
          content: string
          created_at: string
          id: string
          media_type: string | null
          media_url: string | null
          user_id: string
        }
        Insert: {
          chat_id: string
          content: string
          created_at?: string
          id?: string
          media_type?: string | null
          media_url?: string | null
          user_id: string
        }
        Update: {
          chat_id?: string
          content?: string
          created_at?: string
          id?: string
          media_type?: string | null
          media_url?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "private_chat_messages_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "private_chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "private_chat_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      private_chat_participants: {
        Row: {
          chat_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          chat_id: string
          created_at?: string
          user_id: string
        }
        Update: {
          chat_id?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "private_chat_participants_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "private_chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "private_chat_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      private_chats: {
        Row: {
          created_at: string
          id: string
          last_message_at: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          last_message_at?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          last_message_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      group_moderator_votes: {
        Row: {
          candidate_user_id: string
          created_at: string
          group_id: string
          voter_user_id: string
        }
        Insert: {
          candidate_user_id: string
          created_at?: string
          group_id: string
          voter_user_id: string
        }
        Update: {
          candidate_user_id?: string
          created_at?: string
          group_id?: string
          voter_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_moderator_votes_candidate_user_id_fkey"
            columns: ["candidate_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_moderator_votes_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_moderator_votes_voter_user_id_fkey"
            columns: ["voter_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      group_moderators: {
        Row: {
          created_at: string | null
          group_id: string
          is_active: boolean
          user_id: string
          weight_score: number | null
        }
        Insert: {
          created_at?: string | null
          group_id: string
          is_active?: boolean
          user_id: string
          weight_score?: number | null
        }
        Update: {
          created_at?: string | null
          group_id?: string
          is_active?: boolean
          user_id?: string
          weight_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "group_moderators_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_moderators_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          banner_image: string | null
          created_at: string | null
          description: string | null
          id: string
          image: string | null
          is_private: boolean | null
          member_count: number | null
          name: string
          owner_id: string | null
          rules: string | null
          tags: string[] | null
          updated_at: string | null
        }
        Insert: {
          banner_image?: string | null
          created_at?: string | null
          description?: string | null
          id: string
          image?: string | null
          is_private?: boolean | null
          member_count?: number | null
          name: string
          owner_id?: string | null
          rules?: string | null
          tags?: string[] | null
          updated_at?: string | null
        }
        Update: {
          banner_image?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          image?: string | null
          is_private?: boolean | null
          member_count?: number | null
          name?: string
          owner_id?: string | null
          rules?: string | null
          tags?: string[] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      post_downvotes: {
        Row: {
          created_at: string | null
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_downvotes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_downvotes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      post_media: {
        Row: {
          created_at: string
          id: string
          media_order: number
          media_type: Database["public"]["Enums"]["post_type"]
          media_url: string
          post_id: string
        }
        Insert: {
          created_at?: string
          id: string
          media_order?: number
          media_type: Database["public"]["Enums"]["post_type"]
          media_url: string
          post_id: string
        }
        Update: {
          created_at?: string
          id?: string
          media_order?: number
          media_type?: Database["public"]["Enums"]["post_type"]
          media_url?: string
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_media_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_moderation_votes: {
        Row: {
          created_at: string
          post_id: string
          user_id: string
          vote: Database["public"]["Enums"]["moderation_vote_type"]
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id: string
          vote: Database["public"]["Enums"]["moderation_vote_type"]
        }
        Update: {
          created_at?: string
          post_id?: string
          user_id?: string
          vote?: Database["public"]["Enums"]["moderation_vote_type"]
        }
        Relationships: [
          {
            foreignKeyName: "post_moderation_votes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_moderation_votes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      post_poll_options: {
        Row: {
          created_at: string
          id: string
          option_order: number
          option_text: string
          poll_id: string
        }
        Insert: {
          created_at?: string
          id: string
          option_order: number
          option_text: string
          poll_id: string
        }
        Update: {
          created_at?: string
          id?: string
          option_order?: number
          option_text?: string
          poll_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_poll_options_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "post_polls"
            referencedColumns: ["id"]
          },
        ]
      }
      post_poll_votes: {
        Row: {
          created_at: string
          option_id: string
          poll_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          option_id: string
          poll_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          option_id?: string
          poll_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_poll_votes_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "post_poll_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_poll_votes_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "post_polls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_poll_votes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      post_polls: {
        Row: {
          allows_multiple: boolean
          created_at: string
          ends_at: string
          id: string
          post_id: string
        }
        Insert: {
          allows_multiple?: boolean
          created_at?: string
          ends_at: string
          id: string
          post_id: string
        }
        Update: {
          allows_multiple?: boolean
          created_at?: string
          ends_at?: string
          id?: string
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_polls_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: true
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_reports: {
        Row: {
          created_at: string
          details: string | null
          group_id: string
          id: string
          post_id: string
          reason: string
          reporter_id: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
        }
        Insert: {
          created_at?: string
          details?: string | null
          group_id: string
          id?: string
          post_id: string
          reason: string
          reporter_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          details?: string | null
          group_id?: string
          id?: string
          post_id?: string
          reason?: string
          reporter_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_reports_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_reports_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_reports_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      post_upvotes: {
        Row: {
          created_at: string | null
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_upvotes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_upvotes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          created_at: string
          description: string | null
          group_id: string
          id: string
          image: string | null
          link_url: string | null
          nsfw: boolean
          post_type: Database["public"]["Enums"]["post_type"]
          spoiler: boolean
          title: string
          user_id: string
        }
        Insert: {
          created_at: string
          description?: string | null
          group_id: string
          id: string
          image?: string | null
          link_url?: string | null
          nsfw?: boolean
          post_type?: Database["public"]["Enums"]["post_type"]
          spoiler?: boolean
          title: string
          user_id?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          group_id?: string
          id?: string
          image?: string | null
          link_url?: string | null
          nsfw?: boolean
          post_type?: Database["public"]["Enums"]["post_type"]
          spoiler?: boolean
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "posts_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_groups: {
        Row: {
          group_id: string
          joined_at: string | null
          user_id: string
        }
        Insert: {
          group_id: string
          joined_at?: string | null
          user_id: string
        }
        Update: {
          group_id?: string
          joined_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_groups_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_groups_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string | null
          email: string
          id: string
          image: string | null
          name: string
        }
        Insert: {
          created_at?: string | null
          email: string
          id: string
          image?: string | null
          name: string
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          image?: string | null
          name?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_group_moderator_for_post: {
        Args: { p_post_id: string; p_user_id: string }
        Returns: boolean
      }
      requesting_user_id: { Args: never; Returns: string }
      requesting_user_id_uuid: { Args: never; Returns: string }
    }
    Enums: {
      moderation_vote_type: "keep" | "remove"
      post_type: "text" | "link" | "photo" | "video" | "poll"
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
      moderation_vote_type: ["keep", "remove"],
      post_type: ["text", "link", "photo", "video", "poll"],
    },
  },
} as const
