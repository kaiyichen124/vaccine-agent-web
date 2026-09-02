const DIFY_ORIGIN = 'https://udify.app';
const APP_CODE = 'sx0Oi9Sbw1s9exp4';

const form = document.querySelector('#case-form');
const submitButton = document.querySelector('#submit-button');
const errorBox = document.querySelector('#form-error');
const resultCard = document.querySelector('#result-card');
const resultContent = document.querySelector('#result-content');
const statusText = document.querySelector('#status-text');

const VACCINE_OPTIONS = [
  { id: 'hep_b', name: '乙肝疫苗', group: '国家免疫规划疫苗', keywords: '乙型肝炎' },
  { id: 'bcg', name: '卡介苗', group: '国家免疫规划疫苗', keywords: '结核' },
  { id: 'ipv', name: '脊灰灭活疫苗（IPV）', group: '国家免疫规划疫苗', keywords: '脊髓灰质炎 灭活 IPV' },
  { id: 'bopv', name: '脊灰减毒活疫苗（bOPV）', group: '国家免疫规划疫苗', keywords: '脊髓灰质炎 口服 糖丸 OPV bOPV' },
  { id: 'dtap', name: '百白破疫苗', group: '国家免疫规划疫苗', keywords: '白喉 百日咳 破伤风 DTaP' },
  { id: 'dt', name: '白破疫苗（DT）', group: '国家免疫规划疫苗', keywords: '白喉 破伤风 DT 7岁 11岁 补种' },
  { id: 'mmr', name: '麻腮风疫苗', group: '国家免疫规划疫苗', keywords: '麻疹 腮腺炎 风疹 MMR' },
  { id: 'je_live', name: '乙脑减毒活疫苗', group: '国家免疫规划疫苗', keywords: '乙型脑炎 JE-L 活疫苗' },
  { id: 'je_inactivated', name: '乙脑灭活疫苗', group: '国家免疫规划疫苗', keywords: '乙型脑炎 JE-I 灭活疫苗' },
  { id: 'mpsv_a', name: 'A群流脑多糖疫苗', group: '国家免疫规划疫苗', keywords: '脑膜炎球菌 MPSV-A' },
  { id: 'mpsv_ac', name: 'A群C群流脑多糖疫苗', group: '国家免疫规划疫苗', keywords: '脑膜炎球菌 AC流脑 MPSV-AC' },
  { id: 'hep_a_live', name: '甲肝减毒活疫苗', group: '国家免疫规划疫苗', keywords: '甲型肝炎 HepA-L 活疫苗' },
  { id: 'hep_a_inactivated', name: '甲肝灭活疫苗', group: '国家免疫规划疫苗', keywords: '甲型肝炎 HepA-I 灭活疫苗' },
  { id: 'hpv2_nip', name: '国家免疫规划双价HPV疫苗', group: '国家免疫规划疫苗', keywords: '2价 人乳头瘤病毒 宫颈癌 免费' },
  { id: 'flu', name: '流感疫苗', group: '非免疫规划疫苗', keywords: '流行性感冒' },
  { id: 'varicella', name: '水痘疫苗', group: '非免疫规划疫苗', keywords: '带状疱疹' },
  { id: 'pcv', name: '肺炎球菌结合疫苗', group: '非免疫规划疫苗', keywords: '肺炎疫苗 PCV 13价 15价 20价' },
  { id: 'hib', name: 'Hib疫苗', group: '非免疫规划疫苗', keywords: 'b型流感嗜血杆菌' },
  { id: 'rotavirus', name: '轮状病毒疫苗', group: '非免疫规划疫苗', keywords: '轮状 五价轮状' },
  { id: 'ev71', name: 'EV71灭活疫苗', group: '非免疫规划疫苗', keywords: '手足口 肠道病毒71型' },
  { id: 'ppsv23', name: '23价肺炎球菌多糖疫苗', group: '非免疫规划疫苗', keywords: 'PPSV23 23价肺炎' },
  { id: 'mpcv_ac', name: 'A群C群流脑结合疫苗', group: '非免疫规划疫苗', keywords: 'MPCV-AC AC流脑结合' },
  { id: 'mpsv_acyw', name: 'ACYW群流脑多糖疫苗', group: '非免疫规划疫苗', keywords: 'ACYW135 四价流脑多糖 MPSV-ACYW' },
  { id: 'mpcv_acyw', name: 'ACYW群流脑结合疫苗', group: '非免疫规划疫苗', keywords: 'ACYW135 四价流脑结合 MPCV-ACYW' },
  { id: 'hpv4', name: '四价HPV疫苗', group: '非免疫规划疫苗', keywords: '4价 人乳头瘤病毒 宫颈癌' },
  { id: 'hpv9', name: '九价HPV疫苗', group: '非免疫规划疫苗', keywords: '9价 人乳头瘤病毒 宫颈癌' },
  { id: 'four_in_one', name: '四联疫苗', group: '联合/替代接种方案', keywords: 'DTaP IPV Hib' },
  { id: 'five_in_one', name: '五联疫苗', group: '联合/替代接种方案', keywords: 'DTaP IPV Hib' },
  { id: 'six_in_one', name: '六联疫苗', group: '联合/替代接种方案', keywords: 'DTaP IPV Hib 乙肝' },
  { id: 'men_hib', name: 'A群C群流脑-Hib联合疫苗', group: '联合/替代接种方案', keywords: 'AC-Hib 流脑Hib' },
  { id: 'hep_ab', name: '甲乙肝联合疫苗', group: '联合/替代接种方案', keywords: '甲肝乙肝' },
];

const vaccineGroups = document.querySelector('#vaccine-option-groups');
const selectedVaccineRecords = document.querySelector('#selected-vaccine-records');
const vaccineSearch = document.querySelector('#vaccine-search');
const vaccinationModeInputs = [...document.querySelectorAll('[name="vaccination-mode"]')];
const vaccinationTextPanel = document.querySelector('#vaccination-text-panel');
const vaccineSelector = document.querySelector('#vaccine-selector');
const historyCompleteOption = document.querySelector('#history-complete-option');
const historyComplete = document.querySelector('#history-complete');
const vaccinationExtra = document.querySelector('#vaccination-extra');
const vaccinationHidden = document.querySelector('#vaccination');
const vaccineRecordState = new Map();

const TEXT_VACCINE_ALIASES = [
  ['mpsv_acyw', 'ACYW群流脑多糖疫苗', ['MPSV-ACYW', 'ACYW群流脑多糖', 'ACYW135群流脑多糖']],
  ['mpcv_acyw', 'ACYW群流脑结合疫苗', ['MPCV-ACYW', 'ACYW群流脑结合', 'ACYW135群流脑结合']],
  ['mpsv_ac', 'A群C群流脑多糖疫苗', ['MPSV-AC', 'A群C群流脑多糖', 'AC群流脑多糖']],
  ['mpcv_ac', 'A群C群流脑结合疫苗', ['MPCV-AC', 'A群C群流脑结合', 'AC群流脑结合']],
  ['mpsv_a', 'A群流脑多糖疫苗', ['MPSV-A', 'A群流脑多糖', 'A群流脑']],
  ['je_inactivated', '乙脑灭活疫苗', ['JE-I', '乙脑灭活']],
  ['je_live', '乙脑减毒活疫苗', ['JE-L', '乙脑减毒活', '乙脑活疫苗']],
  ['hep_a_inactivated', '甲肝灭活疫苗', ['HepA-I', '甲肝灭活']],
  ['hep_a_live', '甲肝减毒活疫苗', ['HepA-L', '甲肝减毒活', '甲肝活疫苗']],
  ['five_in_one', '五联疫苗', ['五联疫苗', '五联']],
  ['four_in_one', '四联疫苗', ['四联疫苗', '四联']],
  ['six_in_one', '六联疫苗', ['六联疫苗', '六联']],
  ['hep_b', '乙肝疫苗', ['HepB', '乙肝疫苗', '乙肝']],
  ['bcg', '卡介苗', ['BCG', '卡介苗']],
  ['bopv', '脊灰减毒活疫苗（bOPV）', ['bOPV', 'OPV', '脊灰减毒活']],
  ['ipv', '脊灰灭活疫苗（IPV）', ['IPV', '脊灰灭活']],
  ['polio', '脊灰疫苗', ['脊髓灰质炎疫苗', '脊灰疫苗', '脊灰']],
  ['dtap', '百白破疫苗', ['DTaP', '百白破疫苗', '百白破']],
  ['dt', '白破疫苗（DT）', ['白破疫苗', '白破', 'DT']],
  ['mmr', '麻腮风疫苗', ['MMR', '麻腮风疫苗', '麻腮风']],
  ['hep_a', '甲肝疫苗', ['甲肝疫苗', '甲肝']],
  ['je', '乙脑疫苗', ['乙脑疫苗', '乙脑']],
  ['meningococcal', '流脑疫苗', ['流脑疫苗', '流脑']],
  ['flu', '流感疫苗', ['流感疫苗', '流感']],
  ['varicella', '水痘疫苗', ['水痘疫苗', '水痘']],
  ['pcv', '肺炎球菌结合疫苗', ['肺炎球菌结合', '肺炎疫苗', 'PCV']],
  ['ppsv23', '23价肺炎球菌多糖疫苗', ['23价肺炎', 'PPSV23']],
  ['hib', 'Hib疫苗', ['Hib疫苗', 'Hib']],
  ['rotavirus', '轮状病毒疫苗', ['轮状病毒疫苗', '轮状疫苗', '轮状']],
  ['ev71', 'EV71灭活疫苗', ['EV71', '手足口疫苗']],
  ['hpv2_nip', '国家免疫规划双价HPV疫苗', ['双价HPV', '2价HPV']],
  ['hpv4', '四价HPV疫苗', ['四价HPV', '4价HPV']],
  ['hpv9', '九价HPV疫苗', ['九价HPV', '9价HPV']],
];

const COMPLETE_HISTORY_FAMILIES = [
  { id: 'hep_b', name: '乙肝疫苗', coveredBy: ['hep_b', 'six_in_one', 'hep_ab'] },
  { id: 'bcg', name: '卡介苗', coveredBy: ['bcg'] },
  { id: 'polio', name: '脊灰疫苗', coveredBy: ['polio', 'ipv', 'bopv', 'five_in_one', 'six_in_one'] },
  { id: 'dtap', name: '百白破疫苗', coveredBy: ['dtap', 'four_in_one', 'five_in_one', 'six_in_one'] },
  { id: 'dt', name: '白破疫苗', coveredBy: ['dt'] },
  { id: 'mmr', name: '麻腮风疫苗', coveredBy: ['mmr'] },
  { id: 'je', name: '乙脑疫苗', coveredBy: ['je', 'je_live', 'je_inactivated'] },
  { id: 'meningococcal', name: '流脑疫苗', coveredBy: ['meningococcal', 'mpsv_a', 'mpsv_ac', 'mpcv_ac', 'mpsv_acyw', 'mpcv_acyw', 'men_hib'] },
  { id: 'hep_a', name: '甲肝疫苗', coveredBy: ['hep_a', 'hep_a_live', 'hep_a_inactivated', 'hep_ab'] },
  { id: 'hpv_nip', name: 'HPV疫苗', coveredBy: ['hpv_nip', 'hpv2_nip', 'hpv4', 'hpv9'] },
  { id: 'flu', name: '流感疫苗', coveredBy: ['flu'] },
  { id: 'varicella', name: '水痘疫苗', coveredBy: ['varicella'] },
  { id: 'pcv', name: '肺炎球菌结合疫苗', coveredBy: ['pcv'] },
  { id: 'ppsv23', name: '23价肺炎球菌多糖疫苗', coveredBy: ['ppsv23'] },
  { id: 'hib', name: 'Hib疫苗', coveredBy: ['hib', 'four_in_one', 'five_in_one', 'six_in_one', 'men_hib'] },
  { id: 'rotavirus', name: '轮状病毒疫苗', coveredBy: ['rotavirus'] },
  { id: 'ev71', name: 'EV71灭活疫苗', coveredBy: ['ev71'] },
];

function addConfirmedMissingHistory(events) {
  // 完整录入通过 record_state 表达；未出现项由后端在年龄和人群过滤后推导。
  return events;
}

function vaccinationMode() {
  return vaccinationModeInputs.find(input => input.checked)?.value || 'STRUCTURED';
}

function chineseNumber(value) {
  if (/^\d+$/.test(value)) return Number(value);
  const digits = { 零: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
  if (value === '十') return 10;
  if (value.includes('十')) {
    const [left, right] = value.split('十');
    return (left ? digits[left] : 1) * 10 + (right ? digits[right] : 0);
  }
  return digits[value] ?? null;
}

function normalizedDate(value) {
  const match = String(value || '').match(/(20\d{2})[.\/年-](\d{1,2})[.\/月-](\d{1,2})(?:日)?/);
  if (!match) return null;
  const [, year, month, day] = match;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

function textVaccine(segment) {
  const lower = segment.toLowerCase();
  for (const [id, displayName, aliases] of TEXT_VACCINE_ALIASES) {
    if (aliases.some(alias => lower.includes(alias.toLowerCase()))) return { id, displayName };
  }
  return null;
}

function parseVaccinationText(text) {
  const segments = text.replace(/；/g, ';').split(/[;\n]+/).map(value => value.trim()).filter(Boolean);
  const byProduct = new Map();
  const unparsed = [];
  for (const segment of segments) {
    const vaccine = textVaccine(segment);
    if (!vaccine) { unparsed.push(segment); continue; }
    const existing = byProduct.get(vaccine.id) || { id: vaccine.id, displayName: vaccine.displayName, doses: new Map(), complete: false, explicitMissing: false, source: [] };
    existing.source.push(segment);
    existing.explicitMissing ||= /(?:明确)?未接种|未打|从未接种/.test(segment) && !/第\s*[0-9一二三四五六七八九十两]+\s*(?:剂|针)/.test(segment);
    existing.complete ||= /全程(?:已)?完成|已完成全程/.test(segment);

    const range = segment.match(/第\s*([0-9一二三四五六七八九十两]+)\s*[-—~至到]\s*([0-9一二三四五六七八九十两]+)\s*(?:剂|针)[^；;。]*?(?:已)?完成/);
    if (range) {
      const start = chineseNumber(range[1]);
      const end = chineseNumber(range[2]);
      if (start && end && end >= start) for (let number = start; number <= end; number += 1) existing.doses.set(number, existing.doses.get(number) || null);
    }

    const markers = [...segment.matchAll(/第?\s*([0-9一二三四五六七八九十两]+)\s*(?:剂|针)/g)];
    markers.forEach((marker, index) => {
      const number = chineseNumber(marker[1]);
      if (!number) return;
      const context = segment.slice(marker.index + marker[0].length, markers[index + 1]?.index ?? segment.length);
      if (/未接种|漏种|未打|缺种/.test(context)) return;
      existing.doses.set(number, normalizedDate(context) || existing.doses.get(number) || null);
    });

    const counted = segment.match(/(?:^|[：:\s])([0-9一二三四五六七八九十两]+)\s*(?:剂|针)\s*(?:已)?完成/);
    if (counted && !segment.includes('第')) {
      const count = chineseNumber(counted[1]);
      if (count) for (let number = 1; number <= count; number += 1) existing.doses.set(number, existing.doses.get(number) || null);
      existing.complete = true;
    }
    if (!existing.doses.size && /已接种|已完成/.test(segment)) existing.doses.set(1, normalizedDate(segment));
    byProduct.set(vaccine.id, existing);
  }

  const events = [...byProduct.values()].map(record => {
    const doses = [...record.doses.entries()].sort((a, b) => a[0] - b[0]).map(([doseNumber, dateValue]) => ({ dose_number: doseNumber, date: dateValue }));
    const onlyMissing = record.explicitMissing && !doses.length;
    return {
      event_id: `text-${record.id}`,
      product_id: record.id,
      display_name: record.displayName,
      history_state: onlyMissing ? 'EXPLICIT_MISSING' : record.complete ? 'COMPLETE' : doses.length ? 'COUNTED' : 'ANY_DOSE',
      dose_count: onlyMissing ? 0 : doses.length || null,
      doses,
      source: 'STRUCTURED_UI',
      source_text: record.source.join('；'),
    };
  });
  return { events, unparsed };
}

function currentInfluenzaSeason() {
  const referenceValue = document.querySelector('#reference-date')?.value;
  const now = referenceValue ? new Date(`${referenceValue}T00:00:00`) : new Date();
  const startYear = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  return `${startYear}-${startYear + 1}`;
}

function createEmptyVaccineRecord(id) {
  return {
    status: 'VACCINATED',
    doses: '',
    doseDates: [],
    seasonStatus: id === 'flu' ? 'UNKNOWN' : null,
  };
}

function resizeDoseDates(record) {
  const count = Math.max(0, Math.min(10, Number(record.doses) || 0));
  record.doseDates = Array.from({ length: count }, (_, index) => record.doseDates?.[index] || '');
}

function vaccineRecordName(item) {
  return item.recordName || item.name;
}

function renderVaccineOptions() {
  const query = vaccineSearch.value.trim().toLowerCase();
  const items = VACCINE_OPTIONS
    .filter(item => !query || `${item.name} ${item.keywords}`.toLowerCase().includes(query));
  vaccineGroups.innerHTML = items.length
    ? `<div class="vaccine-suggestion-list" role="listbox">${items.map(item => {
      const added = vaccineRecordState.has(item.id);
      return `<button type="button" class="vaccine-suggestion" data-vaccine-id="${item.id}" ${added ? 'disabled' : ''}>
        <span>${item.name}</span><small>${added ? '已添加' : item.group}</small>
      </button>`;
    }).join('')}</div>`
    : '<p class="empty-selection">没有找到匹配疫苗，可尝试输入中文名、简称、英文缩写或价型。</p>';

  vaccineGroups.querySelectorAll('[data-vaccine-id]').forEach(button => button.addEventListener('click', () => {
    if (!vaccineRecordState.has(button.dataset.vaccineId)) {
      vaccineRecordState.set(button.dataset.vaccineId, createEmptyVaccineRecord(button.dataset.vaccineId));
    }
    vaccineSearch.value = '';
    renderVaccineOptions();
    renderSelectedVaccineRecords();
  }));
}

function renderSelectedVaccineRecords() {
  if (!vaccineRecordState.size) {
    selectedVaccineRecords.innerHTML = '<p class="empty-selection">选中疫苗后，可填写接种状态、剂次数和日期。</p>';
    return;
  }
  selectedVaccineRecords.innerHTML = [...vaccineRecordState.entries()].map(([id, record]) => {
    const item = VACCINE_OPTIONS.find(option => option.id === id);
    const doseDisabled = !['VACCINATED', 'COMPLETED'].includes(record.status) ? 'disabled' : '';
    const dateDisabled = ['NOT_VACCINATED', 'UNKNOWN'].includes(record.status) ? 'disabled' : '';
    resizeDoseDates(record);
    const doseDateInputs = record.doseDates.length
      ? `<div class="dose-date-grid"><span>逐剂日期</span>${record.doseDates.map((dateValue, index) => `<label><span>第${index + 1}剂</span><input type="date" value="${escapeHtml(dateValue)}" data-dose-date-index="${index}" ${dateDisabled}></label>`).join('')}</div>`
      : '<p class="dose-date-hint">填写已接种剂数后，可逐剂录入日期并验证最小间隔。</p>';
    const influenzaSeason = id === 'flu' ? `<label class="season-status"><span>${currentInfluenzaSeason()}流感季</span><select data-record-field="seasonStatus">
      <option value="UNKNOWN" ${record.seasonStatus === 'UNKNOWN' ? 'selected' : ''}>本流感季情况不清楚</option>
      <option value="VACCINATED" ${record.seasonStatus === 'VACCINATED' ? 'selected' : ''}>本流感季已接种</option>
      <option value="NOT_VACCINATED" ${record.seasonStatus === 'NOT_VACCINATED' ? 'selected' : ''}>本流感季未接种</option>
    </select></label>` : '';
    return `<div class="selected-vaccine-row" data-record-id="${id}">
      <div class="selected-vaccine-main">
      <div class="selected-vaccine-title"><strong class="selected-vaccine-name">${item.name}</strong><button type="button" data-remove-record="${id}">移除</button></div>
      <label><span>接种状态</span><select data-record-field="status">
        <option value="VACCINATED" ${record.status === 'VACCINATED' ? 'selected' : ''}>已接种</option>
        <option value="COMPLETED" ${record.status === 'COMPLETED' ? 'selected' : ''}>已完成全程</option>
        <option value="NOT_VACCINATED" ${record.status === 'NOT_VACCINATED' ? 'selected' : ''}>明确未接种</option>
        <option value="UNKNOWN" ${record.status === 'UNKNOWN' ? 'selected' : ''}>记录待核实</option>
      </select></label>
      <label><span>已接种剂数</span><input type="number" min="1" max="10" inputmode="numeric" placeholder="如 3" value="${escapeHtml(record.doses)}" data-record-field="doses" ${doseDisabled}></label>
      ${influenzaSeason}
      </div>
      ${doseDateInputs}
    </div>`;
  }).join('');

  selectedVaccineRecords.querySelectorAll('[data-record-field]').forEach(input => {
    const update = () => {
      const row = input.closest('[data-record-id]');
      const record = vaccineRecordState.get(row.dataset.recordId);
      record[input.dataset.recordField] = input.value.trim();
      if (input.dataset.recordField === 'doses') resizeDoseDates(record);
      if (['status', 'doses'].includes(input.dataset.recordField)) renderSelectedVaccineRecords();
    };
    input.addEventListener(input.tagName === 'SELECT' ? 'change' : 'input', update);
  });

  selectedVaccineRecords.querySelectorAll('[data-dose-date-index]').forEach(input => input.addEventListener('change', () => {
    const row = input.closest('[data-record-id]');
    const record = vaccineRecordState.get(row.dataset.recordId);
    record.doseDates[Number(input.dataset.doseDateIndex)] = input.value;
  }));
  selectedVaccineRecords.querySelectorAll('[data-remove-record]').forEach(button => button.addEventListener('click', () => {
    vaccineRecordState.delete(button.dataset.removeRecord);
    renderVaccineOptions();
    renderSelectedVaccineRecords();
  }));
}

function buildVaccinationPayload() {
  const mode = vaccinationMode();
  if (mode === 'UNKNOWN') {
    return { schema_version: 'vaccination_history_v2', record_state: 'UNKNOWN', events: [], free_text: '' };
  }
  if (mode === 'TEXT') {
    const rawText = vaccinationExtra.value.trim();
    const parsed = parseVaccinationText(rawText);
    return {
      schema_version: 'vaccination_history_v2',
      record_state: historyComplete.checked ? 'COMPLETE' : rawText ? 'PARTIAL' : 'EMPTY',
      coverage_scope: historyComplete.checked ? 'VACCINATION_CERTIFICATE' : 'PROVIDED_EVENTS_ONLY',
      events: addConfirmedMissingHistory(parsed.events),
      free_text: parsed.unparsed.join('；'),
      raw_text: rawText,
    };
  }
  const events = [...vaccineRecordState.entries()].map(([id, record]) => {
    const item = VACCINE_OPTIONS.find(option => option.id === id);
    const doseCount = ['VACCINATED', 'COMPLETED'].includes(record.status) && record.doses ? Number(record.doses) : null;
    const historyState = record.status === 'COMPLETED' ? 'COMPLETE'
      : record.status === 'NOT_VACCINATED' ? 'EXPLICIT_MISSING'
        : record.status === 'UNKNOWN' ? 'UNKNOWN'
          : doseCount ? 'COUNTED' : 'ANY_DOSE';
    return {
      event_id: `ui-${id}`,
      product_id: id,
      display_name: item.name,
      history_state: historyState,
      dose_count: historyState === 'EXPLICIT_MISSING' ? 0 : doseCount,
      doses: Array.from({ length: doseCount || 0 }, (_, index) => ({
        dose_number: index + 1,
        date: record.doseDates?.[index] || null,
      })),
      influenza_season: id === 'flu' ? currentInfluenzaSeason() : null,
      current_season_status: id === 'flu' ? record.seasonStatus : null,
      source: 'STRUCTURED_UI',
    };
  });
  return {
    schema_version: 'vaccination_history_v2',
    record_state: historyComplete.checked ? 'COMPLETE' : events.length ? 'PARTIAL' : 'EMPTY',
    coverage_scope: historyComplete.checked ? 'VACCINATION_CERTIFICATE' : 'PROVIDED_EVENTS_ONLY',
    events: addConfirmedMissingHistory(events),
    free_text: '',
  };
}

function buildVaccinationRecord() {
  const mode = vaccinationMode();
  if (mode === 'UNKNOWN') return '接种记录不清楚';
  if (mode === 'TEXT') return [vaccinationExtra.value.trim(), historyComplete.checked ? '以上为接种证全部记录，未列项目无接种记录' : ''].filter(Boolean).join('；');
  const records = [...vaccineRecordState.entries()].map(([id, record]) => {
    const item = VACCINE_OPTIONS.find(option => option.id === id);
    const name = vaccineRecordName(item);
    let text = '';
    if (record.status === 'COMPLETED') text = record.doses ? `${name}${record.doses}剂，标记为已完成全程` : `${name}已完成全程`;
    else if (record.status === 'NOT_VACCINATED') text = `${name}明确未接种`;
    else if (record.status === 'UNKNOWN') text = `${name}接种记录待核实`;
    else text = record.doses ? `${name}${record.doses}剂` : `${name}已接种，剂次未知`;
    const datedDoses = (record.doseDates || []).map((dateValue, index) => dateValue ? `第${index + 1}剂${dateValue}` : '').filter(Boolean);
    if (datedDoses.length && !['NOT_VACCINATED', 'UNKNOWN'].includes(record.status)) text += `，逐剂日期：${datedDoses.join('、')}`;
    if (id === 'flu') {
      const seasonText = record.seasonStatus === 'VACCINATED' ? '本流感季已接种' : record.seasonStatus === 'NOT_VACCINATED' ? '本流感季未接种' : '本流感季接种情况不清楚';
      text += `，${currentInfluenzaSeason()}流感季：${seasonText}`;
    }
    return text;
  });
  if (historyComplete.checked) records.push('以上为接种证全部记录，未列项目无接种记录');
  return records.join('；');
}

vaccineSearch.addEventListener('input', renderVaccineOptions);
function renderVaccinationMode() {
  const mode = vaccinationMode();
  vaccinationTextPanel.hidden = mode !== 'TEXT';
  vaccineSelector.hidden = mode !== 'STRUCTURED';
  historyCompleteOption.hidden = mode === 'UNKNOWN';
  if (mode === 'UNKNOWN') historyComplete.checked = false;
}
vaccinationModeInputs.forEach(input => input.addEventListener('change', renderVaccinationMode));

renderVaccineOptions();
renderSelectedVaccineRecords();
renderVaccinationMode();

function value(id, fallback = '无') {
  const text = document.querySelector(`#${id}`)?.value?.trim() || '';
  return text || fallback;
}

function buildCaseInfo() {
  return `${buildHealthCaseInfo()}\n接种记录：${buildVaccinationRecord() || '未知'}`;
}

function normalizeForDisplay(answer) {
  return answer.replaceAll('｜', '|').trim();
}

function validateCurrentAnswer(answer) {
  const issues = [];
  if (!answer || !answer.trim()) issues.push('没有收到完整结果');
  if (answer && answer.trim().length < 80) issues.push('返回结果过短');
  return issues;
}

function escapeHtml(text) {
  return text.replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  })[character]);
}

function formatInline(text) {
  return text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(https?:\/\/[^\s|<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">查看原文</a>');
}

function tableCells(line) {
  return line.replace(/^\||\|$/g, '').split('|').map(cell => cell.trim());
}

function renderAnswer(markdown) {
  const lines = escapeHtml(markdown).split(/\r?\n/);
  let html = '';
  let inList = false;
  let inOrderedList = false;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    const heading = line.match(/^#{1,4}\s+(.+)/);
    const listItem = line.match(/^[-*]\s+(.+)/);
    const orderedItem = line.match(/^\d+[.)]\s+(.+)/);
    if (line.startsWith('|') && /^\|?[\s:|-]+\|?$/.test((lines[index + 1] || '').trim())) {
      if (inList) { html += '</ul>'; inList = false; }
      if (inOrderedList) { html += '</ol>'; inOrderedList = false; }
      const headers = tableCells(line);
      index += 2;
      const rows = [];
      while (index < lines.length && lines[index].trim().startsWith('|')) {
        rows.push(tableCells(lines[index].trim()));
        index += 1;
      }
      index -= 1;
      html += `<div class="table-wrap"><table><thead><tr>${headers.map(cell => `<th>${formatInline(cell)}</th>`).join('')}</tr></thead><tbody>`;
      html += rows.map(row => `<tr>${row.map(cell => `<td>${formatInline(cell)}</td>`).join('')}</tr>`).join('');
      html += '</tbody></table></div>';
      continue;
    }
    if (listItem) {
      if (inOrderedList) { html += '</ol>'; inOrderedList = false; }
      if (!inList) { html += '<ul>'; inList = true; }
      html += `<li>${formatInline(listItem[1])}</li>`;
      continue;
    }
    if (orderedItem) {
      if (inList) { html += '</ul>'; inList = false; }
      if (!inOrderedList) { html += '<ol>'; inOrderedList = true; }
      html += `<li>${formatInline(orderedItem[1])}</li>`;
      continue;
    }
    if (inList) { html += '</ul>'; inList = false; }
    if (inOrderedList) { html += '</ol>'; inOrderedList = false; }
    if (!line) continue;
    html += heading ? `<h3>${formatInline(heading[1])}</h3>` : `<p class="plain-line">${formatInline(line)}</p>`;
  }
  if (inList) html += '</ul>';
  if (inOrderedList) html += '</ol>';
  resultContent.innerHTML = html;
}

const ACTIVE_CODES = new Set(['NOW_DUE', 'CATCHUP_DUE']);
const CONDITIONAL_CODES = new Set(['CONDITIONALLY_DUE']);
const INFO_CODES = new Set(['RECORDS_NEEDED', 'PRODUCT_NEEDED', 'HEALTH_STATUS_NEEDED']);
const MEDICAL_CODES = new Set(['MEDICAL_REVIEW', 'TEMPORARILY_DEFERRED']);
const INACTIVE_CODES = new Set(['COMPLETED', 'NOT_YET_DUE', 'CATCHUP_WINDOW_CLOSED', 'POPULATION_NOT_APPLICABLE', 'NO_INDICATION']);

const REASON_LABELS = {
  DOSE_HISTORY_INSUFFICIENT: '剂次不清',
  PRODUCT_PROGRAM_DEPENDENT: '产品影响程序',
  AGE_MISSING: '年龄资料不足',
  ROUTINE_DUE: '常规到期',
  EXPLICIT_GAP: '明确漏种',
  CURRENT_ACUTE_ILLNESS: '当前急性期',
  IMMUNOSUPPRESSION_LIVE_VACCINE: '免疫抑制相关',
  IVIG_INJECTABLE_LIVE_INTERVAL: 'IVIG间隔相关',
  PATIENT_HIGH_RISK_PATHWAY: '高风险特殊路径',
  AGE_LIMIT: '超过补种年龄',
  POPULATION: '人群不适用',
  RECORD_COMPLETE: '记录已完成',
  DOSE_COUNT_COMPLETE: '剂次已完成',
  AGE_NOT_DUE: '尚未到年龄',
  NEXT_DOSE_NOT_DUE: '下一剂未到期',
  OPTIONAL_PRODUCT_AND_HISTORY: '自费产品与记录',
  NO_HIGH_RISK_INDICATION: '无高风险指征',
  COMPONENT_OVERLAP_DATE_REQUIRED: '成分记录重叠',
  LAST_DOSE_DATE_REQUIRED: '需核对上一剂日期',
  POLIO_PRODUCT_PATH_AND_DATE: '脊灰产品路径与日期',
  MINIMUM_INTERVAL_NOT_MET: '最小间隔未满足',
  EPILEPSY_CONTROL_REQUIRED: '癫痫控制情况',
  CHD_STABILITY_REQUIRED: '先心病稳定性',
  CHD_UNSTABLE: '先心病当前不稳定',
  PRETERM_CURRENT_STABILITY_REQUIRED: '当前临床稳定性',
  HIGH_RISK_ACTIVE_PATH: '高风险治疗路径',
  HIGH_RISK_LIVE_VACCINE_DEFER: '高风险期暂缓活疫苗',
  HIGH_RISK_TREATMENT_INFORMATION_REQUIRED: '关键治疗信息待补充',
  UNMAPPED_DIAGNOSIS_RISK_REVIEW: '当前诊断的接种风险待判定',
  INFECTIOUS_CURRENT_STATUS_REQUIRED: '需确认急性感染是否恢复',
  OPTIONAL_PRODUCT_AGE_CLOSED: '已超过产品年龄窗口',
  PROGRAM_COMPLETION_DATES_INCOMPLETE: '逐剂日期尚未完整',
  INFLUENZA_CURRENT_SEASON_REQUIRED: '需确认本流感季接种状态',
  INFLUENZA_CURRENT_SEASON_DUE: '本流感季尚未接种',
  INFLUENZA_CURRENT_SEASON_COMPLETE: '本流感季已接种',
  HARD_RULE_MODEL_CONFLICT: '规则与病例复核存在关键冲突',
  SOFT_MODEL_REVIEW: '病例语义复核后需进一步核实',
};

function decisionCode(item) {
  if (item.decision_state) return item.decision_state;
  if (['建议按程序接种', '建议补种', '建议接种灭活疫苗'].includes(item.final_state)) return 'NOW_DUE';
  if (item.final_state === '暂缓接种') return 'TEMPORARILY_DEFERRED';
  if (item.final_state === '接种前需确认') return 'RECORDS_NEEDED';
  return 'COMPLETED';
}

function buildHealthCaseInfo() {
  return [
    `评估日期：${value('reference-date', new Intl.DateTimeFormat('sv-SE', {timeZone:'Asia/Shanghai'}).format(new Date()))}`,
    `年龄或出生日期：${value('age', '未知')}`,
    `性别：${value('sex', '未知')}`,
    `主要诊断及当前健康状况：${value('condition', '未知')}`,
    `近1年用药及治疗：${value('treatment', '未填写')}`,
    `免疫功能及相关检查结果：${value('immune-results', '未填写')}`,
    `严重过敏、接种后异常反应和其他说明：${value('other', '未填写')}`,
  ].join('\n');
}

function renderVaccineName(item) {
  const dose = item.dose ? `（第${Number(item.dose)}剂）` : '';
  return `${escapeHtml(item.display_name || item.vaccine)}${dose}`;
}

function implementationText(item) {
  const options = Array.isArray(item.implementation_options) ? item.implementation_options : [];
  if (!options.length) return '';
  const names = [...new Set(options.map(option => option.product).filter(Boolean))];
  return names.length ? `<div class="implementation-note">可选实现方案：${names.map(escapeHtml).join('、')}。同一抗原剂次不要与单苗重复。</div>` : '';
}

function renderStructuredResult(data) {
  const auditVaccines = Array.isArray(data?.vaccines) ? data.vaccines : [];
  const parentView = data?.parent_view || {};
  const visibleIds = Array.isArray(parentView.visible_vaccine_ids) ? new Set(parentView.visible_vaccine_ids) : null;
  const vaccines = visibleIds ? auditVaccines.filter(item => visibleIds.has(item.vaccine_id)) : auditVaccines;
  const summary = data?.priority_summary || {};
  const patientDecision = data?.patient_decision || {};
  const parentSummary = parentView.summary || {};
  const priorityIds = Array.isArray(summary.items) ? summary.items.map(item => item.vaccine_id) : [];
  const priorityItems = priorityIds.map(id => vaccines.find(item => item.vaccine_id === id)).filter(Boolean);
  const itemText = priorityItems.length
    ? `<ol class="priority-list">${priorityItems.map(item => `<li><strong>${renderVaccineName(item)}</strong><span>${escapeHtml(item.final_state)}</span><small>${escapeHtml(item.reason || '')}</small></li>`).join('')}</ol>`
    : parentSummary.grouped_record_task
      ? '<p><strong>先核对接种证或电子接种记录。</strong>这是一个记录核对任务，不代表孩子有多项漏种。</p>'
      : '<p>目前没有需要立即处理的项目。</p>';
  const sourceHtml = (data.sources || []).map(source => source.url
    ? `<li><a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.title)}</a></li>`
    : `<li>${escapeHtml(source.title)}</li>`).join('');
  const highRisk = ['HIGH_RISK_ACTIVE', 'HIGH_RISK_INFORMATION_PENDING', 'RISK_INFORMATION_PENDING', 'TARGETED_MODIFIER', 'ACUTE_DEFER'].includes(patientDecision.gate);
  const summaryParts = [`${Number(parentSummary.action_count ?? summary.action_count ?? 0)}项现在可以安排`];
  if (Number(parentSummary.conditional_count || 0)) summaryParts.push(`${Number(parentSummary.conditional_count)}项已到年龄、待满足条件`);
  if (Number(parentSummary.record_items_to_verify || 0)) summaryParts.push(`${Number(parentSummary.record_items_to_verify)}项接种记录待核实`);
  if (Number(parentSummary.product_items_to_verify || 0)) summaryParts.push(`${Number(parentSummary.product_items_to_verify)}项产品路径待核实`);
  if (Number(parentSummary.medical_review_count || 0)) summaryParts.push(`${Number(parentSummary.medical_review_count)}项需要专业评估`);
  if (Number(parentSummary.deferred_count || 0)) summaryParts.push(`${Number(parentSummary.deferred_count)}项暂缓接种`);
  if (Number(parentSummary.health_items_to_verify || 0)) summaryParts.push(`${Number(parentSummary.health_items_to_verify)}项疫苗需补充健康状态`);
  if (Number(parentSummary.critical_clinical_information_count || 0)) summaryParts.push(`${Number(parentSummary.critical_clinical_information_count)}项关键临床信息待核实`);
  const routineSummary = `${summaryParts.join('；')}。`;
  const filterCounts = {
    active: vaccines.filter(item => ACTIVE_CODES.has(decisionCode(item))).length,
    conditional: vaccines.filter(item => CONDITIONAL_CODES.has(decisionCode(item))).length,
    info: vaccines.filter(item => INFO_CODES.has(decisionCode(item))).length,
    medical: vaccines.filter(item => MEDICAL_CODES.has(decisionCode(item))).length,
    inactive: vaccines.filter(item => INACTIVE_CODES.has(decisionCode(item))).length,
  };
  const initialFilter = filterCounts.active ? 'active'
    : filterCounts.conditional ? 'conditional' : filterCounts.medical ? 'medical'
      : filterCounts.info ? 'info' : 'inactive';
  const recognizedHistory = Array.isArray(parentView.recognized_history) ? parentView.recognized_history : [];
  const healthSummaryHtml = parentView.health_summary
    ? `<section class="health-summary"><h3>孩子目前情况</h3><p>${escapeHtml(parentView.health_summary)}</p></section>`
    : '';
  const historyHtml = recognizedHistory.length
    ? `<section class="recognized-history"><h3>系统已读到的接种记录</h3><p>${recognizedHistory.map(escapeHtml).join('、')}。</p></section>`
    : '';
  resultContent.innerHTML = `
    ${healthSummaryHtml}
    ${patientDecision.headline && patientDecision.gate !== 'ROUTINE' ? `<section class="patient-gate ${highRisk ? 'patient-gate-high' : 'patient-gate-routine'}"><h3>${escapeHtml(patientDecision.headline)}</h3><p>${escapeHtml(patientDecision.alert || '')}</p>${(patientDecision.critical_missing || []).length ? `<p><strong>关键待核实：</strong>${patientDecision.critical_missing.map(escapeHtml).join('、')}</p>` : ''}</section>` : ''}
    ${historyHtml}
    <section class="priority-panel">
      <h3>本次最需要关注</h3>
      <p>${escapeHtml(routineSummary)}</p>
      ${parentSummary.zero_action_explanation ? `<p class="zero-action-explanation">${escapeHtml(parentSummary.zero_action_explanation)}</p>` : ''}
      ${itemText}
    </section>
    <section>
      <h3>疫苗安排</h3>
      <div class="status-filters" role="group" aria-label="按状态筛选">
        <button type="button" data-filter="active">现在可以安排（${filterCounts.active}）</button>
        <button type="button" data-filter="conditional" ${filterCounts.conditional ? '' : 'disabled'}>已到年龄，待满足条件（${filterCounts.conditional}）</button>
        <button type="button" data-filter="info" ${filterCounts.info ? '' : 'disabled'}>待核实信息（${filterCounts.info}）</button>
        <button type="button" data-filter="medical" ${filterCounts.medical ? '' : 'disabled'}>暂缓或专业评估（${filterCounts.medical}）</button>
        <button type="button" data-filter="inactive" ${filterCounts.inactive ? '' : 'disabled'}>近期无需安排（${filterCounts.inactive}）</button>
        <button type="button" data-filter="all">查看全部</button>
      </div>
      <div class="table-wrap"><table><thead><tr><th>疫苗名称</th><th>面向看护人的介绍与建议</th></tr></thead><tbody id="vaccine-table-body"></tbody></table></div>
    </section>
    ${(data.next_steps || []).length ? `<section><h3>下一步</h3><ol>${data.next_steps.map(step => `<li>${escapeHtml(step)}</li>`).join('')}</ol></section>` : ''}
    <section><h3>提示</h3><p>本材料用于科研原型和疫苗接种宣教，需由研究人员或预防接种专业人员审核，接种安排以现场评估为准。</p></section>
    ${sourceHtml ? `<section><h3>主要依据</h3><ul>${sourceHtml}</ul></section>` : ''}`;

  const body = resultContent.querySelector('#vaccine-table-body');
  if (!body) return;
  const draw = filter => {
    const shown = vaccines.filter(item => {
      const code = decisionCode(item);
      return filter === 'all'
        || (filter === 'active' && ACTIVE_CODES.has(code))
        || (filter === 'conditional' && CONDITIONAL_CODES.has(code))
        || (filter === 'info' && INFO_CODES.has(code))
        || (filter === 'medical' && MEDICAL_CODES.has(code))
        || (filter === 'inactive' && INACTIVE_CODES.has(code));
    });
    body.innerHTML = shown.map(item => {
      const code = decisionCode(item);
      const reasonLabel = item.parent_reason_label || REASON_LABELS[item.reason_code] || '接种程序判断';
      return `<tr data-state="${escapeHtml(code)}"><td>${renderVaccineName(item)}${implementationText(item)}</td><td><span class="state-pill state-${escapeHtml(code.toLowerCase())}">${escapeHtml(item.final_state)}</span><span class="reason-tag">${escapeHtml(reasonLabel)}</span><p>${escapeHtml(item.caregiver_advice || item.reason || item.detail || '')}</p></td></tr>`;
    }).join('') || `<tr><td colspan="2">${escapeHtml(filter === 'active' ? (parentSummary.zero_action_explanation || '当前没有已满足直接安排条件的项目，请查看待核实或评估事项。') : '该分类下暂无项目。')}</td></tr>`;
  };
  resultContent.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => {
    resultContent.querySelectorAll('[data-filter]').forEach(item => item.classList.toggle('active', item === button));
    draw(button.dataset.filter);
  }));
  const initialButton = resultContent.querySelector(`[data-filter="${initialFilter}"]`);
  if (initialButton) initialButton.classList.add('active');
  draw(initialFilter);
}

async function getPassport() {
  if (!APP_CODE) throw new Error('新版独立服务尚未配置，未向旧版发送请求。');
  const response = await fetch(`${DIFY_ORIGIN}/api/passport`, {
    headers: { 'X-App-Code': APP_CODE },
  });
  if (!response.ok) throw new Error('暂时无法连接推荐服务，请稍后重试。');
  return (await response.json()).access_token;
}

async function runWorkflow(caseInfo, healthCaseInfo, vaccinationPayload) {
  const passport = await getPassport();
  const response = await fetch(`${DIFY_ORIGIN}/api/workflows/run`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-App-Code': APP_CODE,
      'X-App-Passport': passport,
    },
    body: JSON.stringify({ inputs: {
      case_info: caseInfo,
      health_case_info: healthCaseInfo,
      vaccination_history_json: JSON.stringify(vaccinationPayload),
    }, response_mode: 'streaming' }),
  });
  if (!response.ok || !response.body) throw new Error('生成失败，请稍后重试。');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let answer = '';
  let resultJson = null;
  while (true) {
    const { value: chunk, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(chunk, { stream: true });
    const blocks = buffer.split('\n\n');
    buffer = blocks.pop() || '';
    for (const block of blocks) {
      for (const line of block.split('\n')) {
        if (!line.startsWith('data:')) continue;
        try {
          const event = JSON.parse(line.slice(5).trim());
          if (event.event === 'text_chunk' && event.data?.text) answer += event.data.text;
          if (event.event === 'workflow_finished') {
            const outputs = event.data?.outputs || {};
            answer = outputs.vaccine_recommendation || outputs.text || answer;
            if (outputs.result_json) {
              try { resultJson = typeof outputs.result_json === 'string' ? JSON.parse(outputs.result_json) : outputs.result_json; } catch { resultJson = null; }
            }
            if (event.data?.status === 'failed') throw new Error(event.data.error || '生成失败');
          }
          if (event.event === 'error') throw new Error(event.message || '生成失败');
        } catch (error) {
          if (!(error instanceof SyntaxError)) throw error;
        }
      }
    }
  }
  if (!answer.trim()) throw new Error('没有收到完整结果，请重新生成。');
  return { answer, resultJson };
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  errorBox.hidden = true;
  if (!form.reportValidity()) return;
  if (form.dataset.reportBusy === 'true') {
    errorBox.textContent = '报告图片正在本机识别，请等待完成后核对文字。'; errorBox.hidden = false; return;
  }
  if (document.querySelector('#report-text')?.value.trim() && !document.querySelector('#report-preview').hidden) {
    errorBox.textContent = '报告识别文字尚未确认，请先核对并加入对应字段，或清除识别内容。';
    errorBox.hidden = false;
    return;
  }
  const vaccinationRecord = buildVaccinationRecord();
  if (!vaccinationRecord) {
    errorBox.textContent = vaccinationMode() === 'TEXT'
      ? '请粘贴或输入接种记录；如果完全不清楚，请选择“接种记录不清楚”。'
      : '请选择已经接种、明确未接种或需要核实的疫苗；如果完全不清楚，请选择“接种记录不清楚”。';
    errorBox.hidden = false;
    document.querySelector('.vaccine-record-field').scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  vaccinationHidden.value = vaccinationRecord;

  submitButton.disabled = true;
  submitButton.textContent = '正在生成，请稍候…';
  resultCard.hidden = false;
  statusText.textContent = '正在生成推荐列表';
  resultContent.innerHTML = '<p>正在生成简要建议，通常需要约30秒。</p>';
  resultCard.scrollIntoView({ behavior: 'smooth', block: 'start' });

  try {
    const workflowResult = await runWorkflow(buildCaseInfo(), buildHealthCaseInfo(), buildVaccinationPayload());
    if (workflowResult.resultJson?.deployment_contract?.release !== 'v16-deepseek-72') throw new Error('当前后台版本与表单不匹配，未展示旧版建议。请稍后重新打开此页面。');
    const answer = normalizeForDisplay(workflowResult.answer);
    const validationIssues = validateCurrentAnswer(answer);
    if (validationIssues.length) throw new Error(`${validationIssues.join('；')}。请重新提交。`);
    if (workflowResult.resultJson?.vaccines?.length) renderStructuredResult(workflowResult.resultJson);
    else renderAnswer(answer);
    statusText.textContent = '已完成';
  } catch (error) {
    statusText.textContent = '';
    resultCard.hidden = true;
    errorBox.textContent = error.message || '生成失败，请稍后重试。';
    errorBox.hidden = false;
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = '生成疫苗推荐列表';
  }
});
