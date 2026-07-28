/**
 * Payroll extras: sector on employees + period reimbursement adjustments.
 * Idempotent — called on app boot.
 */
async function columnExists(pool, table, column) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
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

export async function ensurePayrollSectorReimbursementSchema(pool) {
  if (!pool) return;
  try {
    if (!(await tableExists(pool, 'construction_payroll_employees'))) return;

    if (!(await columnExists(pool, 'construction_payroll_employees', 'sector'))) {
      await pool.query(`
        ALTER TABLE construction_payroll_employees
        ADD COLUMN sector enum('installation','sand_finish') DEFAULT NULL
          COMMENT 'Installation vs Sand & Finish'
          AFTER payment_method
      `);
      console.log('[db] construction_payroll_employees.sector adicionada.');
    }

    if (!(await tableExists(pool, 'construction_payroll_period_adjustments'))) {
      await pool.query(`
        CREATE TABLE construction_payroll_period_adjustments (
          id int(11) NOT NULL AUTO_INCREMENT,
          period_id int(11) NOT NULL,
          employee_id int(11) NOT NULL,
          reimbursement decimal(12,2) NOT NULL DEFAULT 0.00,
          discount decimal(12,2) NOT NULL DEFAULT 0.00,
          notes varchar(500) DEFAULT NULL,
          created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          UNIQUE KEY uniq_period_employee_adj (period_id, employee_id),
          KEY idx_cppa_employee (employee_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      console.log('[db] Tabela construction_payroll_period_adjustments criada.');
    } else if (!(await columnExists(pool, 'construction_payroll_period_adjustments', 'discount'))) {
      await pool.query(`
        ALTER TABLE construction_payroll_period_adjustments
        ADD COLUMN discount decimal(12,2) NOT NULL DEFAULT 0.00
          COMMENT 'Desconto no fechamento'
          AFTER reimbursement
      `);
      console.log('[db] construction_payroll_period_adjustments.discount adicionada.');
    }
  } catch (e) {
    console.warn('[db] ensurePayrollSectorReimbursementSchema:', e.code || e.message);
  }
}
