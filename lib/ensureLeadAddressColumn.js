/**
 * Adiciona leads.address se faltar — idempotente, corre no arranque.
 */
export async function ensureLeadAddressColumn(pool) {
  if (!pool) return;
  try {
    const [rows] = await pool.query(
      `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'leads' AND COLUMN_NAME = 'address'`
    );
    if (rows[0].c > 0) return;
    await pool.query(`
      ALTER TABLE leads
      ADD COLUMN address TEXT NULL
        COMMENT 'Endereço completo em uma linha'
        AFTER zip
    `);
    console.log('[db] Adicionada coluna leads.address.');
  } catch (e) {
    // zip column may not exist — try without AFTER
    if (e.code === 'ER_BAD_FIELD_ERROR') {
      try {
        await pool.query(`ALTER TABLE leads ADD COLUMN address TEXT NULL`);
        console.log('[db] Adicionada coluna leads.address.');
        return;
      } catch (e2) {
        console.warn('[db] Não foi possível garantir leads.address:', e2.code || e2.message);
        return;
      }
    }
    console.warn('[db] Não foi possível garantir leads.address:', e.code || e.message);
  }
}
