/**
 * Field-quote wizard payload (rooms, Q&A, floor plan). Idempotent on boot.
 */
async function columnExists(pool, table, col) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, col]
  );
  return Number(rows[0]?.c) > 0;
}

export async function ensureQuoteWizardSchema(pool) {
  if (!pool) return;
  try {
    if (!(await columnExists(pool, 'quotes', 'wizard_payload'))) {
      await pool.query(
        `ALTER TABLE quotes
         ADD COLUMN wizard_payload LONGTEXT NULL DEFAULT NULL
         COMMENT 'On-site quote wizard JSON (project types, Q&A, rooms, floor plan)'`
      );
      console.log('[db] Coluna quotes.wizard_payload adicionada.');
    }
  } catch (e) {
    console.warn('[db] ensureQuoteWizardSchema:', e.code || e.message);
  }
}
