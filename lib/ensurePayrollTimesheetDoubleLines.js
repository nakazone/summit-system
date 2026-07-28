/**
 * Allow multiple timesheet rows per employee/project/day (double diárias).
 * Drops UNIQUE uniq_period_emp_proj_day and adds a non-unique composite index.
 * Idempotent — called on app boot.
 */
async function indexExists(pool, table, indexName) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS c FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
    [table, indexName]
  );
  return Number(rows[0]?.c) > 0;
}

async function tableExists(pool, table) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS c FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [table]
  );
  return Number(rows[0]?.c) > 0;
}

export async function ensurePayrollTimesheetDoubleLines(pool) {
  if (!pool) return;
  const table = 'construction_payroll_timesheets';
  const uniq = 'uniq_period_emp_proj_day';
  const idx = 'idx_cpt_period_emp_date_proj';
  try {
    if (!(await tableExists(pool, table))) return;

    if (await indexExists(pool, table, uniq)) {
      await pool.query(`ALTER TABLE \`${table}\` DROP INDEX \`${uniq}\``);
      console.log(`[db] Removido UNIQUE ${uniq} em ${table}.`);
    }

    if (!(await indexExists(pool, table, idx))) {
      await pool.query(
        `ALTER TABLE \`${table}\` ADD INDEX \`${idx}\` (period_id, employee_id, work_date, project_id_norm)`
      );
      console.log(`[db] Índice ${idx} criado em ${table}.`);
    }
  } catch (e) {
    console.warn('[db] ensurePayrollTimesheetDoubleLines:', e.code || e.message);
  }
}
