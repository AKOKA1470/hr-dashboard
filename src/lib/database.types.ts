export type AppRole = "hr_admin" | "manager" | "employee";
export type LeaveStatus = "pending" | "approved" | "declined";
export type LeaveType = "earned" | "sick" | "casual";
export type InductionModuleStatus =
  | "draft"
  | "review"
  | "uploaded"
  | "processing"
  | "review_required"
  | "generation_failed"
  | "published";
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      departments: {
        Row: {
          id: string;
          name: string;
          code: string;
          description: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          code: string;
          description?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<{
          name: string;
          code: string;
          description: string | null;
          is_active: boolean;
          updated_at: string;
        }>;
        Relationships: [];
      };
      designations: {
        Row: {
          id: string;
          title: string;
          code: string;
          department_id: string | null;
          level: number | null;
          description: string | null;
          is_managerial: boolean;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          code: string;
          department_id?: string | null;
          level?: number | null;
          description?: string | null;
          is_managerial?: boolean;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<{
          title: string;
          code: string;
          department_id: string | null;
          level: number | null;
          description: string | null;
          is_managerial: boolean;
          is_active: boolean;
          updated_at: string;
        }>;
        Relationships: [];
      };
      teams: {
        Row: { id: string; department_id: string; name: string };
        Insert: { id?: string; department_id: string; name: string };
        Update: { id?: string; department_id?: string; name?: string };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          full_name: string;
          role: AppRole;
          department_id: string | null;
          team_id: string | null;
        };
        Insert: {
          id: string;
          full_name: string;
          role: AppRole;
          department_id?: string | null;
          team_id?: string | null;
        };
        Update: Partial<{
          id: string;
          full_name: string;
          role: AppRole;
          department_id: string | null;
          team_id: string | null;
        }>;
        Relationships: [];
      };
      employee_profiles: {
        Row: {
          id: string;
          user_id: string;
          employee_number: string;
          work_email: string;
          first_name: string;
          middle_name: string | null;
          last_name: string | null;
          display_name: string;
          department_id: string | null;
          designation_id: string | null;
          manager_id: string | null;
          employment_type: string;
          employment_status: string;
          date_of_joining: string;
          date_of_leaving: string | null;
          phone_number: string | null;
          profile_photo_url: string | null;
          location: string | null;
          time_zone: string;
          emergency_contact_name: string | null;
          emergency_contact_phone: string | null;
          account_status: string;
          induction_status: string;
          created_by: string | null;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          employee_number: string;
          work_email: string;
          first_name: string;
          middle_name?: string | null;
          last_name?: string | null;
          display_name: string;
          department_id?: string | null;
          designation_id?: string | null;
          manager_id?: string | null;
          employment_type?: string;
          employment_status?: string;
          date_of_joining: string;
          date_of_leaving?: string | null;
          phone_number?: string | null;
          profile_photo_url?: string | null;
          location?: string | null;
          time_zone?: string;
          emergency_contact_name?: string | null;
          emergency_contact_phone?: string | null;
          account_status?: string;
          induction_status?: string;
          created_by?: string | null;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: never;
        Relationships: [];
      };
      employee_roles: {
        Row: {
          id: string;
          name: string;
          code: string;
          description: string | null;
          is_system_role: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          code: string;
          description?: string | null;
          is_system_role?: boolean;
          created_at?: string;
        };
        Update: never;
        Relationships: [];
      };
      employee_role_assignments: {
        Row: {
          id: string;
          employee_id: string;
          role_id: string;
          assigned_by: string | null;
          assigned_at: string;
          expires_at: string | null;
        };
        Insert: {
          id?: string;
          employee_id: string;
          role_id: string;
          assigned_by?: string | null;
          assigned_at?: string;
          expires_at?: string | null;
        };
        Update: never;
        Relationships: [];
      };
      employee_manager_history: {
        Row: {
          id: string;
          employee_id: string;
          manager_id: string | null;
          effective_from: string;
          effective_to: string | null;
          change_reason: string | null;
          changed_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          employee_id: string;
          manager_id?: string | null;
          effective_from: string;
          effective_to?: string | null;
          change_reason?: string | null;
          changed_by?: string | null;
          created_at?: string;
        };
        Update: never;
        Relationships: [];
      };
      employee_import_staging: {
        Row: {
          id: string;
          batch_id: string;
          row_number: number;
          employee_number: string | null;
          work_email: string | null;
          first_name: string | null;
          middle_name: string | null;
          last_name: string | null;
          display_name: string | null;
          department_code: string | null;
          designation_code: string | null;
          manager_work_email: string | null;
          date_of_joining: string | null;
          employment_type: string | null;
          validation_status: string;
          validation_errors: Json;
          matched_user_id: string | null;
          matched_employee_id: string | null;
          matched_manager_id: string | null;
          imported_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          batch_id: string;
          row_number: number;
          employee_number?: string | null;
          work_email?: string | null;
          first_name?: string | null;
          middle_name?: string | null;
          last_name?: string | null;
          display_name?: string | null;
          department_code?: string | null;
          designation_code?: string | null;
          manager_work_email?: string | null;
          date_of_joining?: string | null;
          employment_type?: string | null;
          validation_status?: string;
          validation_errors?: Json;
          matched_user_id?: string | null;
          matched_employee_id?: string | null;
          matched_manager_id?: string | null;
          imported_at?: string | null;
          created_at?: string;
        };
        Update: never;
        Relationships: [];
      };
      manager_scopes: {
        Row: {
          id: string;
          manager_id: string;
          department_id: string;
          team_id: string | null;
        };
        Insert: {
          id?: string;
          manager_id: string;
          department_id: string;
          team_id?: string | null;
        };
        Update: Partial<{
          id: string;
          manager_id: string;
          department_id: string;
          team_id: string | null;
        }>;
        Relationships: [];
      };
      leave_requests: {
        Row: {
          id: string;
          employee_id: string;
          department_id: string;
          team_id: string | null;
          leave_type: LeaveType;
          start_date: string;
          end_date: string;
          days: number;
          reason: string | null;
          status: LeaveStatus;
          created_at: string;
          decided_by: string | null;
          decided_at: string | null;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      leave_decisions: {
        Row: {
          id: string;
          leave_request_id: string;
          actor_id: string;
          previous_status: LeaveStatus;
          new_status: LeaveStatus;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      induction_modules: {
        Row: {
          id: string;
          created_by: string;
          title: string;
          source_file_name: string;
          source_path: string;
          source_file_size: number;
          source_file_type: string;
          conversion_mode: "metadata_template" | "gemini_ai";
          content: Json;
          status: InductionModuleStatus;
          conversion_stage: "extracting" | "generating" | null;
          created_at: string;
          updated_at: string;
          published_at: string | null;
        };
        Insert: {
          id?: string;
          created_by: string;
          title: string;
          source_file_name: string;
          source_path: string;
          source_file_size: number;
          source_file_type: string;
          conversion_mode?: "metadata_template" | "gemini_ai";
          content?: Json;
          status?: InductionModuleStatus;
          conversion_stage?: "extracting" | "generating" | null;
          created_at?: string;
          updated_at?: string;
          published_at?: string | null;
        };
        Update: Partial<{
          title: string;
          content: Json;
          status: InductionModuleStatus;
          conversion_stage: "extracting" | "generating" | null;
          published_at: string | null;
          updated_at: string;
        }>;
        Relationships: [];
      };
      induction_assessment_keys: {
        Row: { module_id: string; correct_choice: number };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      induction_sections: {
        Row: {
          id: string;
          module_id: string;
          position: number;
          title: string;
          summary: string;
          lessons: Json;
          source_references: string[];
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      induction_activities: {
        Row: {
          id: string;
          module_id: string;
          section_id: string | null;
          position: number;
          activity_type: "scenario" | "quiz" | "knowledge_check" | "poll";
          title: string;
          prompt: string;
          choices: Json;
          correct_choice: number | null;
          explanation: string | null;
          source_references: string[];
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      induction_assignments: {
        Row: {
          id: string;
          module_id: string;
          employee_id: string;
          assigned_by: string;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      induction_progress: {
        Row: {
          assignment_id: string;
          completed_topic_ids: string[];
          activity_answers: Json;
          poll_answers: Json;
          assessment_choice: number | null;
          assessment_passed: boolean;
          completed_at: string | null;
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      induction_questions: {
        Row: {
          id: string;
          module_id: string | null;
          author_id: string;
          question: string;
          answer: string | null;
          answered_by: string | null;
          created_at: string;
          answered_at: string | null;
          question_type: "hrbp_question" | "quiz" | "knowledge_check";
          choices: Json;
          correct_choice: number | null;
          explanation: string | null;
          source_references: string[];
          activity_id: string | null;
        };
        Insert: {
          id?: string;
          module_id?: string | null;
          author_id: string;
          question: string;
          answer?: string | null;
          answered_by?: string | null;
          created_at?: string;
          answered_at?: string | null;
          question_type?: "hrbp_question" | "quiz" | "knowledge_check";
          choices?: Json;
          correct_choice?: number | null;
          explanation?: string | null;
          source_references?: string[];
          activity_id?: string | null;
        };
        Update: never;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      current_app_role: {
        Args: Record<PropertyKey, never>;
        Returns: AppRole | null;
      };
      has_manager_scope: {
        Args: { p_department_id: string; p_team_id: string | null };
        Returns: boolean;
      };
      submit_leave_request: {
        Args: {
          p_leave_type: LeaveType;
          p_start_date: string;
          p_end_date: string;
          p_reason?: string | null;
        };
        Returns: string;
      };
      decide_leave_request: {
        Args: {
          p_request_id: string;
          p_decision: "approved" | "declined";
        };
        Returns: undefined;
      };
      assign_induction_roster: {
        Args: { p_module_id: string; p_emails: string[] };
        Returns: { email: string; status: string }[];
      };
      save_induction_module: {
        Args: {
          p_module_id: string;
          p_title: string;
          p_content: Json;
          p_correct_choice: number;
          p_status: InductionModuleStatus;
        };
        Returns: undefined;
      };
      begin_induction_conversion: {
        Args: { p_module_id: string; p_file_path: string };
        Returns: undefined;
      };
      set_induction_conversion_stage: {
        Args: { p_module_id: string; p_stage: "extracting" | "generating" };
        Returns: undefined;
      };
      fail_induction_conversion: {
        Args: { p_module_id: string };
        Returns: undefined;
      };
      complete_induction_conversion: {
        Args: {
          p_module_id: string;
          p_file_path: string;
          p_title: string;
          p_content: Json;
          p_sections: Json;
          p_activities: Json;
          p_questions: Json;
          p_correct_choice: number;
        };
        Returns: string;
      };
      save_induction_progress: {
        Args: {
          p_assignment_id: string;
          p_completed_topic_ids: string[];
          p_activity_answers: Json;
          p_poll_answers: Json;
          p_assessment_choice?: number | null;
        };
        Returns: boolean;
      };
      answer_induction_question: {
        Args: { p_question_id: string; p_answer: string };
        Returns: undefined;
      };
    };
    Enums: {
      app_role: AppRole;
      leave_status: LeaveStatus;
      leave_type: LeaveType;
      induction_module_status: InductionModuleStatus;
    };
    CompositeTypes: Record<string, never>;
  };
};
