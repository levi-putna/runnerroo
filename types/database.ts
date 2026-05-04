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
          status: "running" | "success" | "failed" | "cancelled"
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
    }
  }
}
