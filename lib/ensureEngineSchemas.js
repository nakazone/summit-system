/**
 * Bootstrap estimate / schedule / financial-engine tables on boot (idempotent).
 * Creates core tables without FK constraints so a fresh DB can start even if
 * parent rows/tables arrive later via other migrates.
 */
async function tableExists(pool, table) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS c FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [table]
  );
  return Number(rows[0]?.c) > 0;
}

async function createIfMissing(pool, name, ddl) {
  if (await tableExists(pool, name)) return false;
  await pool.query(ddl);
  console.log(`[db] Tabela ${name} criada.`);
  return true;
}

export async function ensureEstimateEngineSchema(pool) {
  if (!pool) return;
  try {
    await createIfMissing(
      pool,
      'estimates',
      `CREATE TABLE estimates (
        id int(11) NOT NULL AUTO_INCREMENT,
        project_id int(11) NOT NULL,
        lead_id int(11) DEFAULT NULL,
        estimate_number varchar(50) DEFAULT NULL,
        version int(11) DEFAULT 1,
        material_cost_total decimal(10,2) DEFAULT 0.00,
        labor_cost_total decimal(10,2) DEFAULT 0.00,
        equipment_cost_total decimal(10,2) DEFAULT 0.00,
        direct_cost decimal(10,2) DEFAULT 0.00,
        overhead_percentage decimal(5,2) DEFAULT 0.00,
        overhead_amount decimal(10,2) DEFAULT 0.00,
        profit_margin_percentage decimal(5,2) DEFAULT 0.00,
        profit_amount decimal(10,2) DEFAULT 0.00,
        final_price decimal(10,2) DEFAULT 0.00,
        status varchar(50) DEFAULT 'draft',
        expiration_date date DEFAULT NULL,
        sent_at datetime DEFAULT NULL,
        viewed_at datetime DEFAULT NULL,
        accepted_at datetime DEFAULT NULL,
        declined_at datetime DEFAULT NULL,
        notes text DEFAULT NULL,
        client_notes text DEFAULT NULL,
        payment_schedule json DEFAULT NULL,
        created_by int(11) DEFAULT NULL,
        created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY estimate_number (estimate_number),
        KEY idx_project_id (project_id),
        KEY idx_lead_id (lead_id),
        KEY idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    );

    await createIfMissing(
      pool,
      'estimate_items',
      `CREATE TABLE estimate_items (
        id int(11) NOT NULL AUTO_INCREMENT,
        estimate_id int(11) NOT NULL,
        category varchar(50) NOT NULL,
        name varchar(255) NOT NULL,
        description text DEFAULT NULL,
        unit_type varchar(50) NOT NULL,
        quantity decimal(10,2) NOT NULL DEFAULT 0.00,
        unit_cost decimal(10,2) NOT NULL DEFAULT 0.00,
        total_cost decimal(10,2) NOT NULL DEFAULT 0.00,
        is_auto_added tinyint(1) DEFAULT 0,
        sort_order int(11) DEFAULT 0,
        created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_estimate_id (estimate_id),
        KEY idx_category (category)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    );

    await createIfMissing(
      pool,
      'estimate_rules',
      `CREATE TABLE estimate_rules (
        id int(11) NOT NULL AUTO_INCREMENT,
        rule_name varchar(100) NOT NULL,
        rule_type varchar(50) NOT NULL,
        condition_json json DEFAULT NULL,
        action_json json DEFAULT NULL,
        is_active tinyint(1) DEFAULT 1,
        priority int(11) DEFAULT 0,
        created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_rule_type (rule_type),
        KEY idx_is_active (is_active)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    );
  } catch (e) {
    console.warn('[db] ensureEstimateEngineSchema:', e.code || e.message);
  }
}

export async function ensureScheduleEngineSchema(pool) {
  if (!pool) return;
  try {
    await createIfMissing(
      pool,
      'crews',
      `CREATE TABLE crews (
        id int(11) NOT NULL AUTO_INCREMENT,
        name varchar(100) NOT NULL,
        crew_leader_id int(11) DEFAULT NULL,
        crew_members json DEFAULT NULL,
        specializations json DEFAULT NULL,
        base_productivity_sqft_per_day decimal(10,2) DEFAULT 500.00,
        max_daily_capacity_sqft decimal(10,2) DEFAULT 800.00,
        hourly_rate decimal(10,2) DEFAULT NULL,
        is_active tinyint(1) DEFAULT 1,
        notes text DEFAULT NULL,
        created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_crew_leader (crew_leader_id),
        KEY idx_is_active (is_active)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    );

    await createIfMissing(
      pool,
      'project_schedules',
      `CREATE TABLE project_schedules (
        id int(11) NOT NULL AUTO_INCREMENT,
        project_id int(11) NOT NULL,
        crew_id int(11) NOT NULL,
        estimate_id int(11) DEFAULT NULL,
        start_date date NOT NULL,
        end_date date NOT NULL,
        estimated_days int(11) NOT NULL,
        total_sqft decimal(10,2) NOT NULL,
        allocated_sqft decimal(10,2) DEFAULT 0.00,
        status varchar(50) DEFAULT 'scheduled',
        priority varchar(20) DEFAULT 'normal',
        locked tinyint(1) DEFAULT 0,
        projected_profit decimal(10,2) DEFAULT NULL,
        projected_margin decimal(5,2) DEFAULT NULL,
        delay_risk_level varchar(20) DEFAULT 'low',
        actual_start_date date DEFAULT NULL,
        actual_end_date date DEFAULT NULL,
        actual_days int(11) DEFAULT NULL,
        notes text DEFAULT NULL,
        google_calendar_event_id varchar(255) DEFAULT NULL,
        created_by int(11) DEFAULT NULL,
        created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_project_id (project_id),
        KEY idx_crew_id (crew_id),
        KEY idx_start_date (start_date),
        KEY idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    );

    await createIfMissing(
      pool,
      'crew_availability',
      `CREATE TABLE crew_availability (
        id int(11) NOT NULL AUTO_INCREMENT,
        crew_id int(11) NOT NULL,
        date date NOT NULL,
        status varchar(50) DEFAULT 'available',
        daily_capacity_sqft decimal(10,2) DEFAULT NULL,
        allocated_sqft decimal(10,2) DEFAULT 0.00,
        is_overbooked tinyint(1) DEFAULT 0,
        notes text DEFAULT NULL,
        created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uniq_crew_date (crew_id, date),
        KEY idx_date (date),
        KEY idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    );

    await createIfMissing(
      pool,
      'crew_performance_stats',
      `CREATE TABLE crew_performance_stats (
        id int(11) NOT NULL AUTO_INCREMENT,
        crew_id int(11) NOT NULL,
        period_start date NOT NULL,
        period_end date NOT NULL,
        avg_productivity_sqft_per_day decimal(10,2) DEFAULT NULL,
        avg_delay_percentage decimal(5,2) DEFAULT NULL,
        avg_profit_margin decimal(5,2) DEFAULT NULL,
        projects_completed int(11) DEFAULT 0,
        projects_on_time int(11) DEFAULT 0,
        total_revenue decimal(10,2) DEFAULT 0.00,
        total_profit decimal(10,2) DEFAULT 0.00,
        total_sqft_completed decimal(10,2) DEFAULT 0.00,
        updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY unique_crew_period (crew_id, period_start, period_end),
        KEY idx_crew_id (crew_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    );
  } catch (e) {
    console.warn('[db] ensureScheduleEngineSchema:', e.code || e.message);
  }
}

export async function ensureFinancialEngineSchema(pool) {
  if (!pool) return;
  try {
    await createIfMissing(
      pool,
      'project_financials',
      `CREATE TABLE project_financials (
        id int(11) NOT NULL AUTO_INCREMENT,
        project_id int(11) NOT NULL,
        estimate_id int(11) DEFAULT NULL,
        estimated_revenue decimal(10,2) DEFAULT 0.00,
        estimated_material_cost decimal(10,2) DEFAULT 0.00,
        estimated_labor_cost decimal(10,2) DEFAULT 0.00,
        estimated_overhead decimal(10,2) DEFAULT 0.00,
        estimated_profit decimal(10,2) DEFAULT 0.00,
        estimated_margin_percentage decimal(5,2) DEFAULT 0.00,
        actual_revenue decimal(10,2) DEFAULT 0.00,
        actual_material_cost decimal(10,2) DEFAULT 0.00,
        actual_labor_cost decimal(10,2) DEFAULT 0.00,
        actual_overhead decimal(10,2) DEFAULT 0.00,
        actual_total_cost decimal(10,2) DEFAULT 0.00,
        actual_profit decimal(10,2) DEFAULT 0.00,
        actual_margin_percentage decimal(5,2) DEFAULT 0.00,
        profit_variance decimal(10,2) DEFAULT 0.00,
        cost_variance decimal(10,2) DEFAULT 0.00,
        revenue_variance decimal(10,2) DEFAULT 0.00,
        is_locked tinyint(1) DEFAULT 0,
        locked_at datetime DEFAULT NULL,
        locked_by int(11) DEFAULT NULL,
        notes text DEFAULT NULL,
        created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY unique_project_financial (project_id),
        KEY idx_estimate_id (estimate_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    );

    await createIfMissing(
      pool,
      'expenses',
      `CREATE TABLE expenses (
        id int(11) NOT NULL AUTO_INCREMENT,
        category varchar(100) NOT NULL,
        project_id int(11) DEFAULT NULL,
        vendor varchar(255) DEFAULT NULL,
        description text NOT NULL,
        amount decimal(10,2) NOT NULL,
        tax_amount decimal(10,2) DEFAULT 0.00,
        total_amount decimal(10,2) NOT NULL,
        payment_method varchar(50) DEFAULT NULL,
        expense_date date NOT NULL,
        status varchar(50) DEFAULT 'pending',
        receipt_url varchar(500) DEFAULT NULL,
        receipt_file_path varchar(500) DEFAULT NULL,
        approved_by int(11) DEFAULT NULL,
        approved_at datetime DEFAULT NULL,
        created_by int(11) DEFAULT NULL,
        notes text DEFAULT NULL,
        created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_project_id (project_id),
        KEY idx_category (category),
        KEY idx_status (status),
        KEY idx_expense_date (expense_date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    );
  } catch (e) {
    console.warn('[db] ensureFinancialEngineSchema:', e.code || e.message);
  }
}
