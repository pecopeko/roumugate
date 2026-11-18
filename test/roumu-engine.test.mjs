import test from 'node:test';
import assert from 'node:assert/strict';

import {
  audit36AgreementMonths,
  auditEmploymentNotice,
  calculateOvertimeAndMinWage,
  generateEmploymentNoticeMarkdown,
} from '../docs/core/roumu-engine.mjs';

test('auditEmploymentNotice detects missing Apr 2024 scope/renewal/muki terms and fixed-OT flaws', () => {
  const weak = `
    契約期間：1年
    勤務場所：東京本社 / 業務内容：システム開発
    始業9:00 終業18:00 休憩60分 休日土日祝
    月給300,000円（固定残業代含む） 末日締め翌月25日支払
    退職は30日前申出、解雇は就業規則による
  `;
  const res = auditEmploymentNotice(weak, { isFixedTerm: true });
  const ids = new Set(res.findings.map((f) => f.id));
  assert.ok(ids.has('LSA-2024-CHANGE-SCOPE'));
  assert.ok(ids.has('LSA-2024-RENEWAL-CAP'));
  assert.ok(ids.has('LSA-2024-MUKI-CONVERSION'));
  assert.ok(ids.has('FIXED-OT-AMOUNT-SEP'));
  assert.ok(ids.has('FIXED-OT-HOURS-SPEC'));
  assert.ok(ids.has('FIXED-OT-EXCESS-PAY'));
  assert.equal(res.status, 'HIGH_RISK');
});

test('generateEmploymentNoticeMarkdown passes 100/100 under auditEmploymentNotice', () => {
  const md = generateEmploymentNoticeMarkdown({
    companyName: '株式会社目黒テックワークス',
    isFixedTerm: true,
    baseSalaryYen: 280000,
    fixedOvertimePayYen: 45000,
    fixedOvertimeHours: 20,
  });
  const res = auditEmploymentNotice(md, { isFixedTerm: true });
  assert.equal(res.score, 100);
  assert.equal(res.findings.length, 0);
  assert.equal(res.status, 'READY');
});

test('calculateOvertimeAndMinWage enforces >60h 1.50x rate, min wage breach, and shortfall', () => {
  // base 240,000 / 160h = 1,500 yen/hr
  // 60h @ 1.25 = 112,500 + 10h @ 1.50 = 22,500 => total statutory = 135,000
  const ot = calculateOvertimeAndMinWage({
    baseSalaryYen: 240000,
    monthlyScheduledHours: 160,
    fixedOvertimePayYen: 45000,
    fixedOvertimeHours: 20,
    actualOvertimeHours: 70,
    minimumWageHourlyYen: 1163,
  });
  assert.equal(ot.hourlyBaseYen, 1500);
  assert.equal(ot.minimumWageCompliant, true);
  assert.equal(ot.regularOvertimePayYen, 112500);
  assert.equal(ot.over60OvertimePayYen, 22500);
  assert.equal(ot.totalStatutoryPremiumYen, 135000);
  assert.equal(ot.unpaidShortfallYen, 90000);
  assert.ok(ot.flags.includes('OVER-60H-150X-TRIGGERED'));
  assert.ok(ot.flags.includes('FIXED-OT-EXCEEDED-EXTRA-DUE'));

  const minWageFail = calculateOvertimeAndMinWage({
    baseSalaryYen: 160000,
    monthlyScheduledHours: 160,
    fixedOvertimePayYen: 20000,
    fixedOvertimeHours: 20,
    minimumWageHourlyYen: 1163,
  });
  assert.equal(minWageFail.minimumWageCompliant, false);
  assert.ok(minWageFail.flags.includes('MIN-WAGE-BREACH'));
  assert.ok(minWageFail.flags.includes('FIXED-OT-UNDER-125X'));
});

test('audit36AgreementMonths catches 6-mo cap, 720h cap, 100h single month, and 2-6mo 80h avg breaches', () => {
  const compliant = audit36AgreementMonths([40, 45, 70, 75, 42, 30, 55, 60, 40, 35, 60, 40]);
  assert.equal(compliant.compliant, true);
  assert.ok(compliant.maxRollingAverage <= 80);

  const breached = audit36AgreementMonths([50, 50, 82, 85, 80, 50, 100, 50, 50, 50, 45, 40]);
  assert.equal(breached.compliant, false);
  assert.ok(breached.violations.includes('LSA36-EXCEED-6-MONTHS'));
  assert.ok(breached.violations.includes('LSA36-EXCEED-720H'));
  assert.ok(breached.violations.includes('LSA36-SINGLE-100H-BREACH'));
  assert.ok(breached.violations.includes('LSA36-ROLLING-80H-BREACH'));
});
