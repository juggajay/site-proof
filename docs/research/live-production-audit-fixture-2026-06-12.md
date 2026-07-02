# Live Production Audit Fixture - 2026-06-12

Purpose: stable throwaway data for role-by-role production QA before launch.

## Environment

- Frontend: `https://site-proof.vercel.app`
- Backend health checked: `https://site-proof-production.up.railway.app/health`
- Railway project identified as the production backend project.

## Audit Dataset

- Company: `Audit Civil 181139`
- Project: `Audit Highway 181139`
- Project number: `AUD-181139`
- Company ID: `cd3f3f6d-8259-4791-a7da-26bc085f0bc1`
- Project ID: `28739963-b80c-41ec-a314-6ad6a201d1dc`
- Subcontractor company ID: `1eea3f4f-ac28-4a5a-bb68-e50cde2ec140`

## Accounts

Nine throwaway role accounts were created and API-login verified:

- Owner
- Admin
- Project manager
- Quality manager
- Site manager
- Foreman
- Site engineer
- Viewer
- Subcontractor admin

Credential details are intentionally not recorded here. They are stored only in the local `.deepsec/data/audit-accounts-*.json` file for this audit run and must not be committed.

## Fixtures

- ITP template: `Audit QA Mixed ITP 181139`
- ITP template ID: `d912851c-1c00-48b5-94c6-a6ce76e2978f`
- Head-contractor lot: `AUD-181139-L001`
- Head-contractor lot ID: `f52c4f50-99ea-4a16-8cf5-6c27300661da`
- Subcontractor lot: `AUD-181139-L002`
- Subcontractor lot ID: `7aaf7053-aba4-483d-9e4c-d1b6a066f093`

The ITP template includes standard checks, photo evidence, a witness point, a hold point, and a subcontractor-responsible item.

Subcontractor portal access was enabled for:

- Lots
- ITPs
- Hold points
- Test results
- NCRs
- Documents

## Verification

- Foreman API access sees both audit lots.
- Subcontractor API access sees only `AUD-181139-L002`.
- Subcontractor API access is denied for the head-contractor-only lot.
- Subcontractor ITP instance for `AUD-181139-L002` loads as `not_started`.
- Subcontractor ITP response includes the 5 checklist items through the template and has no completions yet.

## Notes

- Head-contractor audit accounts are currently `emailVerified: false` because the production email-bypass setting did not include the throwaway test domain at account creation time. Login still works for the created accounts.
- Cleanup later should delete this audit project/company data and remove the local credential JSON.
