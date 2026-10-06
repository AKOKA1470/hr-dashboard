export type AppRole = "hr_admin" | "manager" | "employee";
export type LeaveStatus = "pending" | "approved" | "declined";
export type LeaveType = "earned" | "sick" | "casual";

export type Database = {
  public: {
    Tables: {
      departments: {
        Row: { id: string; name: string };
        Insert: { id?: string; name: string };
        Update: { id?: string; name?: string };
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
    };
    Enums: {
      app_role: AppRole;
      leave_status: LeaveStatus;
      leave_type: LeaveType;
    };
    CompositeTypes: Record<string, never>;
  };
};
