import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sql = readFileSync(new URL('../supabase/20261104_managed_bank_account_registry.sql', import.meta.url), 'utf8');
const registry = readFileSync(new URL('../registry.js', import.meta.url), 'utf8');
const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const holdUi = readFileSync(new URL('../account-review-holds.js', import.meta.url), 'utf8');

assert.match(sql, /create table if not exists public\.audit_bank_accounts/i);
assert.match(sql, /create or replace function public\.bank_account_registry_rows/i);
assert.match(sql, /create or replace function public\.manage_bank_account_registry/i);
assert.match(sql, /create trigger capture_recon_bank_account_candidates/i);
assert.match(sql, /'FR8','SCB','4102050696','นาย อำนาจ สาธุชาติ','active','verified_user'/);
assert.match(sql, /values\(company_code,bank_code,account_digits,null,'pending'/);
assert.doesNotMatch(sql, /values\(company_code,bank_code,account_digits,null,'active'/);
assert.match(sql, /role_name not in \('lead','admin'\)/);

assert.match(registry, /"account": "4102050696"/);
assert.match(registry, /"accountRaw": "410-205069-6"/);
assert.match(registry, /"name": "นาย อำนาจ สาธุชาติ"/);
assert.match(app, /accounts:Sb\.bankAccountRegistryRows/);
assert.match(app, /manageAccount:Sb\.manageBankAccountRegistry/);
assert.match(holdUi, /บัญชีใหม่รออนุมัติ/);
assert.match(holdUi, /row\.status==='pending'/);
assert.match(holdUi, /data-candidate-action="approve"/);

console.log('managed bank-account registry checks passed');
