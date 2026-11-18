/**
 * ROUMUGATE (労務門) Core Labor Standards & Payroll Compliance Engine
 * 100% deterministic, zero-network audit for:
 *  - Japan Labor Standards Act Art. 15 & April 2024 Amendment (変更の範囲・更新上限・無期転換申込機会)
 *  - Supreme Court Fixed-Overtime (固定残業代) 3 Validity Requirements
 *  - Post-April 2023 SME >60h/mo 1.50x Statutory Overtime, Late-Night 0.25x, Holiday 1.35x & Min Wage Check
 *  - Labor Standards Act Art. 36 (36協定: >45h max 6mo, <=720h/yr, <100h single mo, 2-6mo rolling avg <=80h)
 */

const MANDATORY_NOTICE_RULES = [
  {
    id: 'LSA-ART15-TERM',
    article: '労基法第15条・施行規則第5条第1項第1号',
    title: '労働契約の期間・有期/無期の明示',
    weight: 14,
    severity: 'HIGH',
    test: (t) => /(契約期間|期間の定め)/.test(t),
    missingDetail: '契約期間の定め（無期または有期の始期・終期、更新基準）の記載が見当たりません。',
    remediation: '「期間の定めなし」または具体的な契約期間・更新基準を明記してください。',
  },
  {
    id: 'LSA-ART15-WORKPLACE-DUTIES',
    article: '労基法施行規則第5条第1項第1号の3',
    title: '就業の場所および従事すべき業務の内容',
    weight: 14,
    severity: 'HIGH',
    test: (t) => /(就業の場所|勤務地|勤務場所)/.test(t) && /(業務の内容|従事すべき業務)/.test(t),
    missingDetail: '雇入れ直後の就業場所または従事すべき業務の明記が不足しています。',
    remediation: '「雇入れ直後の就業場所・業務内容」を具体的に明記してください。',
  },
  {
    id: 'LSA-2024-CHANGE-SCOPE',
    article: '2024年4月改正 労基法施行規則第5条第1項第1号の3',
    title: '【2024年4月義務化】就業場所・業務の「変更の範囲」明示',
    weight: 16,
    severity: 'HIGH',
    test: (t) => /変更の範囲/.test(t),
    missingDetail: '2024年4月施行の省令改正により全労働者へ義務化された、将来の転勤・テレワークや職務変更を含む「変更の範囲」の記載が不足しています。',
    remediation: '就業場所と業務内容それぞれに「（変更の範囲）会社の定める全事業所（在宅勤務含む）」「（変更の範囲）当社業務全般」等と明記してください。',
  },
  {
    id: 'LSA-ART15-HOURS-HOLIDAY',
    article: '労基法施行規則第5条第1項第2号',
    title: '始業・終業時刻、所定外労働、休憩時間、休日',
    weight: 12,
    severity: 'MEDIUM',
    test: (t) => /(始業|就業時間)/.test(t) && /(終業|休憩)/.test(t) && /休日/.test(t),
    missingDetail: '始業・終業時刻、休憩時間、休日のいずれかの絶対的明示事項が不足しています。',
    remediation: '始業・終業時刻、休憩分数、所定休日の曜日/要件を明記してください。',
  },
  {
    id: 'LSA-ART15-WAGES',
    article: '労基法施行規則第5条第1項第3号',
    title: '賃金の決定・計算・支払方法・締切・支払時期',
    weight: 14,
    severity: 'HIGH',
    test: (t) => /(基本給|賃金|月給|時給)/.test(t) && /(締切|締め|支払日|振込)/.test(t),
    missingDetail: '基本給・諸手当の計算方法または賃金締切日・支払日の明示が不足しています。',
    remediation: '「基本給、締切日（末日）、支払日（翌月25日・口座振込）」等を明記してください。',
  },
  {
    id: 'LSA-ART15-RETIREMENT',
    article: '労基法施行規則第5条第1項第4号',
    title: '退職・解雇の事由及び手続',
    weight: 12,
    severity: 'HIGH',
    test: (t) => /退職/.test(t) && /解雇/.test(t),
    missingDetail: '自己都合退職の届出期限および解雇事由・手続に関する記載が不足しています。',
    remediation: '「退職希望日の30日前までに申出」および就業規則準拠の解雇事由を明記してください。',
  },
];

/**
 * Audit a Japanese Employment Notice (労働条件通知書) against Art. 15, Apr 2024 rules & Fixed-OT validity.
 * @param {string} noticeText
 * @param {{ isFixedTerm?: boolean }} [options]
 */
export function auditEmploymentNotice(noticeText, options = {}) {
  const text = typeof noticeText === 'string' ? noticeText.trim() : '';
  const isFixedTerm = options.isFixedTerm !== undefined
    ? Boolean(options.isFixedTerm)
    : /(有期|契約社員|パートタイマー|契約期間[^\n]{0,12}[0-9０-９]+[年ヶ月月])/.test(text);

  const checks = [...MANDATORY_NOTICE_RULES];

  if (isFixedTerm) {
    checks.push(
      {
        id: 'LSA-2024-RENEWAL-CAP',
        article: '2024年4月改正 労基法施行規則第5条第1項第1号の2',
        title: '【2024年4月有期契約必須】更新上限（通算期間・回数）の有無と内容',
        weight: 14,
        severity: 'HIGH',
        test: (t) => /(更新上限|通算契約期間の上限|更新回数の上限)/.test(t),
        missingDetail: '有期労働契約の更新時に義務化された「更新上限の有無及び内容（例：上限なし／通算3年まで等）」が明記されていません。',
        remediation: '「更新上限の有無：有（通算契約期間3年・更新回数3回を上限）または 無」と明記してください。',
      },
      {
        id: 'LSA-2024-MUKI-CONVERSION',
        article: '2024年4月改正 労基法施行規則第5条第1項第5号・第6号',
        title: '【2024年4月有期契約必須】無期転換申込機会・転換後の労働条件',
        weight: 14,
        severity: 'HIGH',
        test: (t) => /無期転換/.test(t),
        missingDetail: '通算5年超で発生する無期転換ルールに関する「無期転換申込機会」および「転換後の労働条件（変更の有無）」の明示がありません。',
        remediation: '「通算契約期間が5年を超える場合、無期労働契約への転換申込みが可能です（転換後条件は別紙/現条件と同一等）」を追記してください。',
      }
    );
  }

  const usesFixedOt = /(固定残業|みなし残業|定額残業)/.test(text);
  if (usesFixedOt) {
    checks.push(
      {
        id: 'FIXED-OT-AMOUNT-SEP',
        article: '最高裁判例（明確区分性要件）',
        title: '【固定残業代】基本給と固定残業代金額の明確区分',
        weight: 14,
        severity: 'HIGH',
        test: (t) =>
          /(?:基本給|本給)[^\n]{0,20}[0-9,０-９，]+円/.test(t) &&
          /(?:固定残業|みなし残業|定額残業)[^\n]{0,24}[0-9,０-９，]+円/.test(t),
        missingDetail: '固定残業代を導入していますが、基本給と固定残業代（金額）が明確に区分記載されていません。',
        remediation: '「基本給 ○○円 ／ 固定残業代 △△円」と金額を分離して明記してください。',
      },
      {
        id: 'FIXED-OT-HOURS-SPEC',
        article: '最高裁判例・厚労省指針（時間数明示要件）',
        title: '【固定残業代】何時間分の時間外労働に相当するかの明示',
        weight: 14,
        severity: 'HIGH',
        test: (t) => /(?:[0-9０-９]+(?:\.[0-9]+)?)\s*時間(?:相当)?分/.test(t) || /時間外労働\s*[0-9０-９]+\s*時間/.test(t),
        missingDetail: '固定残業代が「何時間分の時間外労働」に対する対価であるか明記されていません（無効認定リスク）。',
        remediation: '「月○時間分の時間外労働に対する割増賃金として支給する」と時間数を明示してください。',
      },
      {
        id: 'FIXED-OT-EXCESS-PAY',
        article: '最高裁判例（超過額別途支給要件）',
        title: '【固定残業代】想定時間を超過した残業代の別途・追加支給合意',
        weight: 14,
        severity: 'HIGH',
        test: (t) => /(超過|超えた場合|上回った)[^\n]{0,36}(別途|追加|精算).{0,12}(支給|支払)/.test(t),
        missingDetail: '固定残業時間を超過した法定時間外・深夜・休日労働について、差額を別途追加支給する明文が欠落しています。',
        remediation: '「定額残業時間を超過した時間外・深夜・休日労働については法定割増賃金を別途支給する」を明記してください。',
      }
    );
  }

  let totalWeight = 0;
  let earnedWeight = 0;
  const findings = [];

  for (const rule of checks) {
    totalWeight += rule.weight;
    const passed = text.length > 0 && rule.test(text);
    if (passed) {
      earnedWeight += rule.weight;
    } else {
      findings.push({
        id: rule.id,
        article: rule.article,
        severity: rule.severity,
        title: rule.title,
        missingDetail: rule.missingDetail,
        remediation: rule.remediation,
      });
    }
  }

  const score = totalWeight > 0 ? Math.round((earnedWeight / totalWeight) * 100) : 0;
  let status = 'READY';
  if (findings.length >= 3 || score < 60) {
    status = 'HIGH_RISK';
  } else if (findings.length > 0) {
    status = 'NEEDS_REVIEW';
  }

  return {
    score,
    status,
    isFixedTerm,
    usesFixedOvertime: usesFixedOt,
    passedCount: checks.length - findings.length,
    totalChecks: checks.length,
    findings,
  };
}

/**
 * Compute statutory overtime pay (<=60h @ 1.25x, >60h @ 1.50x), fixed-OT shortfall & hourly min wage check.
 * @param {object} options
 */
export function calculateOvertimeAndMinWage(options = {}) {
  const baseSalaryYen = Math.max(0, Math.floor(Number(options.baseSalaryYen || 0)));
  const fixedAllowanceYen = Math.max(0, Math.floor(Number(options.fixedAllowanceYen || 0)));
  const fixedOvertimePayYen = Math.max(0, Math.floor(Number(options.fixedOvertimePayYen || 0)));
  const fixedOvertimeHours = Math.max(0, Number(options.fixedOvertimeHours || 0));
  const monthlyScheduledHours = Math.max(1, Number(options.monthlyScheduledHours || 160));
  const minimumWageHourlyYen = Math.max(0, Number(options.minimumWageHourlyYen ?? 1163));
  const actualOvertimeHours = Math.max(0, Number(options.actualOvertimeHours || 0));
  const lateNightHours = Math.max(0, Number(options.lateNightHours || 0));
  const statutoryHolidayHours = Math.max(0, Number(options.statutoryHolidayHours || 0));

  const hourlyBaseYen = Math.floor((baseSalaryYen + fixedAllowanceYen) / monthlyScheduledHours);
  const minimumWageCompliant = hourlyBaseYen >= minimumWageHourlyYen;
  const requiredFixedPayAt125Yen = Math.round(hourlyBaseYen * 1.25 * fixedOvertimeHours);

  const regularHours = Math.min(60, actualOvertimeHours);
  const over60Hours = Math.max(0, actualOvertimeHours - 60);

  const regularOvertimePayYen = Math.round(hourlyBaseYen * 1.25 * regularHours);
  const over60OvertimePayYen = Math.round(hourlyBaseYen * 1.5 * over60Hours);
  const lateNightPremiumYen = Math.round(hourlyBaseYen * 0.25 * lateNightHours);
  const holidayPayYen = Math.round(hourlyBaseYen * 1.35 * statutoryHolidayHours);

  const totalStatutoryPremiumYen =
    regularOvertimePayYen + over60OvertimePayYen + lateNightPremiumYen + holidayPayYen;
  const unpaidShortfallYen = Math.max(0, totalStatutoryPremiumYen - fixedOvertimePayYen);

  const flags = [];
  if (!minimumWageCompliant) {
    flags.push('MIN-WAGE-BREACH');
  }
  if (fixedOvertimeHours > 0 && fixedOvertimePayYen < requiredFixedPayAt125Yen) {
    flags.push('FIXED-OT-UNDER-125X');
  }
  if (over60Hours > 0) {
    flags.push('OVER-60H-150X-TRIGGERED');
  }
  if (unpaidShortfallYen > 0) {
    flags.push('FIXED-OT-EXCEEDED-EXTRA-DUE');
  }

  return {
    hourlyBaseYen,
    minimumWageHourlyYen,
    minimumWageCompliant,
    requiredFixedPayAt125Yen,
    regularOvertimePayYen,
    over60OvertimePayYen,
    lateNightPremiumYen,
    holidayPayYen,
    totalStatutoryPremiumYen,
    fixedOvertimePayYen,
    unpaidShortfallYen,
    flags,
  };
}

/**
 * Audit 1..12 monthly overtime+holiday hours against Art. 36 statutory ceilings:
 *  - <= 45h in at least 6 months per year (max 6 months > 45h)
 *  - <= 720h annual overtime
 *  - < 100h single month (including holiday work)
 *  - <= 80.0h average across every rolling 2, 3, 4, 5, and 6-month window
 * @param {number[]} monthlyHoursList
 */
export function audit36AgreementMonths(monthlyHoursList) {
  const hours = (Array.isArray(monthlyHoursList) ? monthlyHoursList : [])
    .slice(0, 12)
    .map((v) => Math.max(0, Number(v) || 0));

  const monthsOver45 = hours.filter((h) => h > 45).length;
  const annualHours = Math.round(hours.reduce((a, b) => a + b, 0) * 100) / 100;
  const maxSingleMonth = hours.length > 0 ? Math.max(...hours) : 0;

  let maxRollingAverage = 0;
  let worstRollingWindow = null;
  const rollingViolations = [];

  for (const w of [2, 3, 4, 5, 6]) {
    if (hours.length < w) continue;
    for (let start = 0; start <= hours.length - w; start += 1) {
      let sum = 0;
      for (let k = 0; k < w; k += 1) sum += hours[start + k];
      const avg = Math.round((sum / w) * 100) / 100;
      if (avg > maxRollingAverage) {
        maxRollingAverage = avg;
        worstRollingWindow = { monthsWindow: w, startMonthIndex: start + 1, avgHours: avg };
      }
      if (avg > 80.0) {
        rollingViolations.push({ monthsWindow: w, startMonthIndex: start + 1, avgHours: avg });
      }
    }
  }

  const violations = [];
  if (monthsOver45 > 6) violations.push('LSA36-EXCEED-6-MONTHS');
  if (annualHours > 720) violations.push('LSA36-EXCEED-720H');
  if (maxSingleMonth >= 100) violations.push('LSA36-SINGLE-100H-BREACH');
  if (rollingViolations.length > 0) violations.push('LSA36-ROLLING-80H-BREACH');

  return {
    monthsAudited: hours.length,
    monthsOver45,
    annualHours,
    maxSingleMonth,
    maxRollingAverage,
    worstRollingWindow,
    rollingViolations,
    violations,
    compliant: violations.length === 0,
  };
}

/**
 * Generate April-2024-compliant Japanese Employment Notice Markdown template.
 * @param {object} [meta]
 */
export function generateEmploymentNoticeMarkdown(meta = {}) {
  const company = (meta.companyName || '株式会社目黒テックワークス').trim();
  const baseSalary = Number(meta.baseSalaryYen || 280000).toLocaleString('ja-JP');
  const fixedOtPay = Number(meta.fixedOvertimePayYen || 45000).toLocaleString('ja-JP');
  const fixedOtHours = Number(meta.fixedOvertimeHours || 20);
  const fixedTermLine = meta.isFixedTerm
    ? '- 更新の有無・更新上限: 更新する場合があり得る（更新上限：通算契約期間3年・更新回数3回まで）。通算契約期間が5年を超える場合は無期労働契約への転換申込みが可能です（無期転換後の労働条件は別紙規定による）。'
    : '- 契約期間: 期間の定めなし（試用期間3か月）';

  return [
    `# 労働条件通知書（2024年4月改正 労基法施行規則第5条準拠）`,
    '',
    `- 事業場名称: ${company}`,
    fixedTermLine,
    '- 就業の場所: （雇入れ直後）本社オフィス及び自宅（在宅勤務） ／ （変更の範囲）会社の定める全事業所及び自宅',
    '- 従事すべき業務の内容: （雇入れ直後）Webシステム開発・運用業務 ／ （変更の範囲）当社が指示する開発・企画・管理業務全般',
    '- 始業・終業時刻及び休憩時間: 9:30〜18:30（休憩60分、所定労働時間8時間）、所定外労働の有無：有（36協定の範囲内）',
    '- 休日: 毎週土曜日・日曜日、国民の祝日、年末年始（年間休日120日以上）',
    `- 賃金: 基本給 月額 ${baseSalary}円 ／ 固定残業代 月額 ${fixedOtPay}円（月${fixedOtHours}時間分の法定時間外労働に対する割増賃金として支給）。なお、月${fixedOtHours}時間を超過した時間外労働・深夜・休日労働については、法定割増賃金を別途追加支給する。賃金締切日：毎月末日、支払日：翌月25日（銀行振込）。`,
    '- 退職及び解雇に関する事項: 自己都合退職は原則30日前までに申出。定年65歳。解雇事由は就業規則第○条の定めによる。',
  ].join('\n');
}
