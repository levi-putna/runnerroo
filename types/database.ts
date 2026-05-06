export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      workflows: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          user_id: string
          name: string
          description: string | null
          trigger_type: "manual" | "webhook" | "cron"
          trigger_config: Json
          nodes: Json
          edges: Json
          graph_version: number
          status: "active" | "inactive" | "draft"
          run_count: number
          last_run_at: string | null
        }
        Insert: Omit<
          Database["public"]["Tables"]["workflows"]["Row"],
          "id" | "created_at" | "updated_at" | "run_count" | "last_run_at"
        > & { id?: string; run_count?: number; last_run_at?: string | null; graph_version?: number }
        Update: Partial<Database["public"]["Tables"]["workflows"]["Insert"]>
      }
      workflow_runs: {
        Row: {
          id: string
          workflow_id: string
          status: "running" | "success" | "failed" | "cancelled" | "waiting_approval"
          started_at: string
          completed_at: string | null
          duration_ms: number | null
          trigger_type: "manual" | "webhook" | "cron"
          error: string | null
          node_results: Json
          wdk_run_id: string | null
          /** Manual or webhook payload snapshot at run start */
          trigger_inputs: Json | null
        }
        Insert: Omit<Database["public"]["Tables"]["workflow_runs"]["Row"], "id" | "started_at">
        Update: Partial<Database["public"]["Tables"]["workflow_runs"]["Insert"]>
      }
      workflow_approvals: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          workflow_run_id: string
          workflow_id: string
          user_id: string
          node_id: string
          status: "pending" | "approved" | "declined"
          title: string
          description: string | null
          /** Shown in Inbox to guide the reviewer (from the approval step). */
          reviewer_instructions: string | null
          step_input: Json
          step_output: Json | null
          responded_at: string | null
          responded_by: string | null
        }
        Insert: {
          workflow_run_id: string
          workflow_id: string
          user_id: string
          node_id: string
          title?: string
          description?: string | null
          reviewer_instructions?: string | null
          step_input?: Json
          status?: "pending" | "approved" | "declined"
          step_output?: Json | null
          responded_at?: string | null
          responded_by?: string | null
          id?: string
        }
        Update: Partial<Database["public"]["Tables"]["workflow_approvals"]["Insert"]>
      }
      user_files: {
        Row: {
          id: string
          created_at: string
          user_id: string
          bucket: string
          path: string
          name: string
          mime_type: string | null
          size_bytes: number | null
          metadata: Json
        }
        Insert: {
          user_id: string
          bucket: string
          path: string
          name: string
          mime_type?: string | null
          size_bytes?: number | null
          metadata?: Json
        }
        Update: Partial<Database["public"]["Tables"]["user_files"]["Insert"]>
      }
      workflow_document_templates: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          user_id: string
          workflow_id: string | null
          name: string
          bucket: string
          path: string
          mime_type: string | null
          size_bytes: number | null
          metadata: Json
        }
        Insert: {
          user_id: string
          workflow_id?: string | null
          name: string
          bucket?: string
          path: string
          mime_type?: string | null
          size_bytes?: number | null
          metadata?: Json
        }
        Update: Partial<Database["public"]["Tables"]["workflow_document_templates"]["Insert"]>
      }
    }
  }
}
