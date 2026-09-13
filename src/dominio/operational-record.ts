export const MASTER_EMPLOYEE_ID = "30000000-0000-4000-8000-000000000000";

export function isOperationalRecord(record: { employee_id?: string; is_test?: boolean }) {
  return !record.is_test && record.employee_id !== MASTER_EMPLOYEE_ID;
}
