import type { Database } from "./database.types";
import { supabase } from "./supabase";

type EmployeeProfile = Pick<
  Database["public"]["Tables"]["employee_profiles"]["Row"],
  | "id"
  | "user_id"
  | "employee_number"
  | "work_email"
  | "first_name"
  | "middle_name"
  | "last_name"
  | "display_name"
  | "department_id"
  | "designation_id"
  | "manager_id"
  | "employment_type"
  | "employment_status"
  | "date_of_joining"
  | "date_of_leaving"
  | "location"
  | "time_zone"
  | "account_status"
  | "induction_status"
>;

type Department = Pick<
  Database["public"]["Tables"]["departments"]["Row"],
  "id" | "name" | "code" | "description"
>;

type Designation = Pick<
  Database["public"]["Tables"]["designations"]["Row"],
  "id" | "title" | "department_id" | "level" | "is_managerial"
>;

export type DirectoryEmployee = EmployeeProfile & {
  department_name: string | null;
  designation_title: string | null;
  manager_name: string | null;
};

export type EmployeeDirectoryData = {
  employees: DirectoryEmployee[];
  departments: Department[];
  designations: Designation[];
};

const employeeColumns =
  "id, user_id, employee_number, work_email, first_name, middle_name, last_name, display_name, department_id, designation_id, manager_id, employment_type, employment_status, date_of_joining, date_of_leaving, location, time_zone, account_status, induction_status";

export async function loadEmployeeDirectory(): Promise<EmployeeDirectoryData> {
  if (!supabase) {
    throw new Error("Supabase is not configured. Connect your organization data to continue.");
  }

  const employees: EmployeeProfile[] = [];
  const pageSize = 500;
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from("employee_profiles")
      .select(employeeColumns)
      .order("display_name")
      .order("id")
      .range(offset, offset + pageSize - 1);
    if (error) {
      throw new Error(`Unable to load authorized employee records: ${error.message}`);
    }
    const page = data ?? [];
    employees.push(...page);
    if (page.length < pageSize) break;
    offset += pageSize;
  }

  const [departmentResult, designationResult] = await Promise.all([
    supabase
      .from("departments")
      .select("id, name, code, description")
      .order("name"),
    supabase
      .from("designations")
      .select("id, title, department_id, level, is_managerial")
      .order("title"),
  ]);
  if (departmentResult.error) {
    throw new Error(`Unable to load the department catalog: ${departmentResult.error.message}`);
  }
  if (designationResult.error) {
    throw new Error(`Unable to load the designation catalog: ${designationResult.error.message}`);
  }

  const managerIds = [
    ...new Set(
      employees
        .map((employee) => employee.manager_id)
        .filter((managerId): managerId is string => Boolean(managerId)),
    ),
  ];
  const managerNames = new Map<string, string>();
  for (let index = 0; index < managerIds.length; index += 200) {
    const ids = managerIds.slice(index, index + 200);
    const { data, error } = await supabase
      .from("employee_profiles")
      .select("id, display_name")
      .in("id", ids);
    if (error) {
      throw new Error(`Unable to load visible reporting names: ${error.message}`);
    }
    for (const manager of data ?? []) managerNames.set(manager.id, manager.display_name);
  }

  const departments = departmentResult.data ?? [];
  const designations = designationResult.data ?? [];
  const departmentNames = new Map(departments.map((department) => [department.id, department.name]));
  const designationTitles = new Map(designations.map((designation) => [designation.id, designation.title]));

  return {
    employees: employees.map((employee) => ({
      ...employee,
      department_name: employee.department_id
        ? departmentNames.get(employee.department_id) ?? null
        : null,
      designation_title: employee.designation_id
        ? designationTitles.get(employee.designation_id) ?? null
        : null,
      manager_name: employee.manager_id
        ? managerNames.get(employee.manager_id) ?? null
        : null,
    })),
    departments,
    designations,
  };
}
