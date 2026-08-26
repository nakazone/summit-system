# Summit Meta Leads → CRM

Liga a planilha **Summit Meta Leads** (`contact@summit-floors.com`) ao CRM no Railway.

## Já feito no Railway

- `SHEETS_SYNC_SECRET` definido no serviço `summit-system`
- Endpoint: `POST /api/receive-lead-batch`
- URL: `https://summit-system-production-98eb.up.railway.app`

## Na planilha Google

1. Abra **Summit Meta Leads** com `contact@summit-floors.com`.
2. **Extensões → Apps Script** → **apague tudo** que estiver no editor → cole **o arquivo inteiro** `Code.gs` (começa com `var CONFIG = {`).
   - **Não** cole só a palavra `CRM_Synced` — isso gera `ReferenceError: CRM_Synced is not defined`.
3. **⚙ Definições do projeto → Propriedades do script** → adicione:
   - Nome: `API_SYNC_SECRET`
   - Valor: o mesmo de `SHEETS_SYNC_SECRET` no Railway (Dashboard → Variables).
5. Salve → execute `setupSummitMetaSheet` (cria a coluna `CRM_Synced` se faltar) ou vá direto para `syncMetaLeadsToCrm`.
6. Autorize a conta Google na primeira execução.
7. **Acionadores** → função `syncMetaLeadsToCrm` → tempo → a cada 10–30 minutos.

## Colunas esperadas (Meta)

- Nome (`full_name` / `full name` / etc.)
- `email`
- `phone_number` (ou `phone`)
- `zip_code` (opcional)
- pergunta de serviço (opcional → notas no CRM)
