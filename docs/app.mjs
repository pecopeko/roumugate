import {
  audit36AgreementMonths,
  auditEmploymentNotice,
  calculateOvertimeAndMinWage,
  generateEmploymentNoticeMarkdown,
} from './core/roumu-engine.mjs';

const WEAK_SAMPLE = `株式会社目黒テックワークス 労働条件通知書
契約期間：1年間（有期雇用契約）
勤務場所：東京本社
業務内容：システム開発業務
給与：月給 300,000円（固定残業代含む）。締切：末日 支払日：翌月25日。
始業 9:30 / 終業 18:30（休憩60分）、休日：土日祝。退職は30日前申出、解雇事由は就業規則による。`;

const CLEAN_SAMPLE = generateEmploymentNoticeMarkdown({
  companyName: '株式会社目黒テックワークス',
  isFixedTerm: true,
});

const els = {
  notice: document.getElementById('input-notice'),
  fixedTerm: document.getElementById('chk-fixed-term'),
  base: document.getElementById('in-base'),
  sched: document.getElementById('in-sched'),
  fixedPay: document.getElementById('in-fixed-pay'),
  fixedHrs: document.getElementById('in-fixed-hrs'),
  actOt: document.getElementById('in-act-ot'),
  minWage: document.getElementById('in-min-wage'),
  otBox: document.getElementById('ot-result-box'),
  badge: document.getElementById('notice-badge'),
  mScore: document.getElementById('m-score'),
  mShortfall: document.getElementById('m-shortfall'),
  mRolling: document.getElementById('m-rolling'),
  findingsList: document.getElementById('findings-list'),
  months36: document.getElementById('in-36-months'),
  res36Box: document.getElementById('36-result-box'),
  tplOutput: document.getElementById('tpl-output'),
  btnRisk: document.getElementById('btn-sample-risk'),
  btnOk: document.getElementById('btn-sample-ok'),
  btnAuditNotice: document.getElementById('btn-audit-notice'),
  btnCalcOt: document.getElementById('btn-calc-ot'),
  btnAudit36: document.getElementById('btn-audit-36'),
  btnCopyTpl: document.getElementById('btn-copy-tpl'),
};

let latestTemplate = CLEAN_SAMPLE;

function renderNotice() {
  const res = auditEmploymentNotice(els.notice.value, {
    isFixedTerm: els.fixedTerm.checked,
  });
  els.mScore.textContent = `${res.score}点`;
  els.badge.className = 'score-pill';
  if (res.status === 'READY') {
    els.badge.textContent = '法令要件充足 (READY)';
    els.badge.classList.add('status-ready');
  } else if (res.status === 'NEEDS_REVIEW') {
    els.badge.textContent = '要補記 (NEEDS REVIEW)';
    els.badge.classList.add('status-review');
  } else {
    els.badge.textContent = '重大指摘あり (HIGH RISK)';
    els.badge.classList.add('status-high');
  }

  els.findingsList.innerHTML = '';
  if (res.findings.length === 0) {
    const ok = document.createElement('div');
    ok.setAttribute('data-ui', 'finding-card');
    ok.className = 'sev-ok';
    ok.textContent = '2024年4月改正（変更の範囲・更新上限・無期転換）及び固定残業3要件の記載が確認できました。';
    els.findingsList.appendChild(ok);
  } else {
    for (const f of res.findings) {
      const card = document.createElement('div');
      card.setAttribute('data-ui', 'finding-card');
      card.className = f.severity === 'HIGH' ? 'sev-high' : 'sev-medium';
      const title = document.createElement('div');
      title.style.fontWeight = '700';
      title.textContent = `[${f.id}] ${f.title}`;
      const detail = document.createElement('div');
      detail.textContent = `${f.missingDetail} ／ 補正案: ${f.remediation}`;
      card.append(title, detail);
      els.findingsList.appendChild(card);
    }
  }

  latestTemplate = generateEmploymentNoticeMarkdown({
    isFixedTerm: els.fixedTerm.checked,
    baseSalaryYen: Number(els.base.value || 280000),
    fixedOvertimePayYen: Number(els.fixedPay.value || 45000),
    fixedOvertimeHours: Number(els.fixedHrs.value || 20),
  });
  els.tplOutput.textContent = latestTemplate;
}

function renderOvertime() {
  const ot = calculateOvertimeAndMinWage({
    baseSalaryYen: Number(els.base.value || 0),
    monthlyScheduledHours: Number(els.sched.value || 160),
    fixedOvertimePayYen: Number(els.fixedPay.value || 0),
    fixedOvertimeHours: Number(els.fixedHrs.value || 0),
    actualOvertimeHours: Number(els.actOt.value || 0),
    minimumWageHourlyYen: Number(els.minWage.value || 0),
  });
  els.mShortfall.textContent = `${ot.unpaidShortfallYen.toLocaleString('ja-JP')}円`;
  els.otBox.textContent = [
    `時間単価: ${ot.hourlyBaseYen.toLocaleString('ja-JP')}円/h（最賃判定: ${ot.minimumWageCompliant ? '適正' : '違反'}）`,
    `60h迄(1.25倍): ${ot.regularOvertimePayYen.toLocaleString('ja-JP')}円`,
    `60h超(1.50倍): ${ot.over60OvertimePayYen.toLocaleString('ja-JP')}円`,
    `法定合計: ${ot.totalStatutoryPremiumYen.toLocaleString('ja-JP')}円 ／ 固定残業支給: ${ot.fixedOvertimePayYen.toLocaleString('ja-JP')}円 ／ 不足追加支払額: ${ot.unpaidShortfallYen.toLocaleString('ja-JP')}円`,
    `フラグ: ${ot.flags.length ? ot.flags.join(', ') : '問題なし'}`,
  ].join(' / ');
}

function render36() {
  const nums = String(els.months36.value || '')
    .split(/[,\s、]+/)
    .map((x) => Number(x.trim()))
    .filter((n) => !Number.isNaN(n));
  const r36 = audit36AgreementMonths(nums);
  els.mRolling.textContent = `${r36.maxRollingAverage}h`;
  els.res36Box.textContent = r36.compliant
    ? `適正（月45h超: ${r36.monthsOver45}回 / 年間計: ${r36.annualHours}h / 最大複数月平均: ${r36.maxRollingAverage}h <= 80h）`
    : `違反検出 [${r36.violations.join(', ')}]（月45h超: ${r36.monthsOver45}回 / 年計: ${r36.annualHours}h / 単月最大: ${r36.maxSingleMonth}h / 最悪移動平均: ${r36.maxRollingAverage}h）`;
}

els.btnRisk.addEventListener('click', () => {
  els.notice.value = WEAK_SAMPLE;
  els.fixedTerm.checked = true;
  renderNotice();
});
els.btnOk.addEventListener('click', () => {
  els.notice.value = CLEAN_SAMPLE;
  els.fixedTerm.checked = true;
  renderNotice();
});
els.btnAuditNotice.addEventListener('click', renderNotice);
els.btnCalcOt.addEventListener('click', renderOvertime);
els.btnAudit36.addEventListener('click', render36);
els.btnCopyTpl.addEventListener('click', async () => {
  await navigator.clipboard.writeText(latestTemplate);
  els.btnCopyTpl.textContent = 'コピー完了';
  setTimeout(() => {
    els.btnCopyTpl.textContent = 'テンプレをコピー';
  }, 1500);
});

els.notice.value = WEAK_SAMPLE;
els.fixedTerm.checked = true;
renderNotice();
renderOvertime();
render36();
