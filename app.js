const DIFY_ORIGIN = 'https://udify.app';
const APP_CODE = '80wJhj8Qlnhdy1ia';

const form = document.querySelector('#case-form');
const submitButton = document.querySelector('#submit-button');
const errorBox = document.querySelector('#form-error');
const resultCard = document.querySelector('#result-card');
const resultContent = document.querySelector('#result-content');
const statusText = document.querySelector('#status-text');

function value(id, fallback = '无') {
  const text = document.querySelector(`#${id}`)?.value?.trim() || '';
  return text || fallback;
}

function getSafetyContext() {
  const ageText = value('age', '未知');
  const ageMatch = ageText.match(/\d+(?:\.\d+)?/);
  const ageYears = ageMatch ? Number(ageMatch[0]) : null;
  const treatment = value('treatment');
  const combined = `${value('condition', '未知')} ${treatment} ${value('other')}`;
  const temperatureMatch = combined.match(/(?:体温)?\s*(\d{2}(?:\.\d+)?)\s*(?:℃|度)/);
  const temperature = temperatureMatch ? Number(temperatureMatch[1]) : null;
  const usesAntimicrobial = /阿奇霉素|阿莫西林|头孢|青霉素|克拉霉素|罗红霉素|抗菌药|抗生素/.test(treatment);
  const severeAcute = (temperature !== null && temperature >= 38.5)
    || /高热|精神状态欠佳|精神差|中重度|中度急性|重度急性|病情尚未恢复|病情未恢复/.test(combined);
  const stable = /稳定|恢复期|无发热|没有发热|精神状态正常|精神正常/.test(combined);
  let ruleMode = 'unknown';
  let acuteRule = '当前病情严重程度未完全说明；只在会影响接种决定时要求补充。';
  if (severeAcute) {
    ruleMode = 'acute';
    acuteRule = '命中急性病情暂缓条件：当前高热、精神状态欠佳或中重度病情尚未恢复；只暂缓当前已到时间的疫苗。';
  } else if (stable) {
    ruleMode = 'stable';
    acuteRule = '当前资料提示病情稳定或恢复期，未命中急性病情暂缓条件。';
  } else if (usesAntimicrobial) {
    ruleMode = 'antimicrobial_unknown';
  }
  const antimicrobialRule = usesAntimicrobial
    ? '抗菌药物本身不构成暂缓依据；必须结合体温、症状和病情是否恢复判断。'
    : '未检测到常见抗菌药物。';
  return { ruleMode, usesAntimicrobial, ageYears, text: `系统固定判定（不得改写）：\n- ${antimicrobialRule}\n- ${acuteRule}` };
}

function buildCaseInfo() {
  return [
    getSafetyContext().text,
    `年龄：${value('age', '未知')}`,
    `当前健康情况：${value('condition', '未知')}`,
    `近期用药或治疗：${value('treatment')}`,
    `接种记录：${value('vaccination', '未知')}`,
    `其他：${value('other')}`,
  ].join('\n');
}

function escapeHtml(text) {
  return text.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[character]);
}

function formatInline(text) {
  return text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(https?:\/\/[^\s|<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">查看原文</a>');
}

function tableCells(line) {
  return line.replace(/^\||\|$/g, '').split('|').map(cell => cell.trim());
}

const requiredSections = ['结论', '建议接种', '暂缓或需要确认', '下一步', '来源与版本'];
const decisionTables = [
  { section: '建议接种', header: '| 疫苗 | 建议 | 主要原因 |', separator: '|---|---|---|', emptyRow: '| 暂无 | — | — |' },
  { section: '暂缓或需要确认', header: '| 疫苗 | 当前处理 | 需要确认什么 |', separator: '|---|---|---|', emptyRow: '| 暂无 | — | — |' },
];
const sourceHeader = '| 支撑内容 | 正式文献（发布机构，年份） | 章节/页码 | 原文链接或标识 | 核验日期 |';

function sectionPattern(name) {
  return new RegExp(`(#{1,4}\\s*${name}\\s*\\n)([\\s\\S]*?)(?=\\n#{1,4}\\s|$)`);
}

function getSection(answer, name) {
  return answer.match(sectionPattern(name))?.[2] || '';
}

function tableRows(section) {
  return section.split(/\r?\n/)
    .filter(line => /^\|.+\|$/.test(line.trim()) && !/^\|[-:|\s]+\|$/.test(line.trim()))
    .map(line => tableCells(line.trim())).slice(1);
}

function normalizeSections(answer) {
  let normalized = answer
    .replace(/^(#{1,4})\s*(?:一句话结论|结论摘要)\s*$/m, '$1 结论')
    .replace(/^(#{1,4})\s*(?:现在建议接种|疫苗推荐列表)\s*$/m, '$1 建议接种')
    .replace(/^(#{1,4})\s*(?:暂缓或接种前需评估|需要确认)\s*$/m, '$1 暂缓或需要确认')
    .replace(/^(#{1,4})\s*下一步怎么做\s*$/m, '$1 下一步');
  if (!sectionPattern('结论').test(normalized)) normalized = `### 结论\n请查看下方需要处理的疫苗。\n\n${normalized}`;
  for (const table of decisionTables) {
    normalized = normalized.replace(sectionPattern(table.section), (whole, heading, body) => {
      if (body.includes(table.header)) return whole;
      if (!body.trim() || /^(暂无|没有|目前没有)/.test(body.trim())) {
        return `${heading}\n${table.header}\n${table.separator}\n${table.emptyRow}\n`;
      }
      return whole;
    });
  }
  return normalized;
}

const vaccineAliases = [
  ['乙肝疫苗', /乙肝/], ['卡介苗', /卡介苗/], ['脊灰疫苗', /脊灰|脊髓灰质炎/], ['百白破疫苗', /百白破/],
  ['麻腮风疫苗', /麻腮风/], ['乙脑疫苗', /乙脑/], ['流脑疫苗', /流脑/], ['甲肝疫苗', /甲肝/],
  ['水痘疫苗', /水痘/], ['流感疫苗', /流感/], ['肺炎球菌疫苗', /肺炎球菌|肺炎疫苗/],
  ['乙型流感嗜血杆菌疫苗', /乙型流感嗜血杆菌|Hib/i], ['轮状病毒疫苗', /轮状病毒/],
  ['肠道病毒71型疫苗', /肠道病毒71|EV71/i], ['人乳头瘤病毒疫苗', /人乳头瘤|HPV/i],
];

function explicitVaccinated() {
  const record = value('vaccination', '');
  return vaccineAliases.filter(([, alias]) => alias.test(record) && /已接种|接种过|已完成|全程|\d+剂/.test(record))
    .map(([name, alias]) => {
      const segment = record.split(/[；;。\n]/).find(part => alias.test(part)) || '';
      const complete = /已完成|全程/.test(segment) || (/乙肝/.test(segment) && /3剂/.test(segment));
      return { name, alias, complete };
    });
}

function normalizeVaccinatedGrouping(answer) {
  const vaccinated = explicitVaccinated();
  if (!vaccinated.length) return answer;
  const lines = answer.split(/\r?\n/);
  let section = '';
  const addToConfirm = [];
  const filtered = [];
  for (const line of lines) {
    const heading = line.trim().match(/^#{1,4}\s+(.+)/);
    if (heading) section = heading[1].trim();
    const isDataRow = section === '建议接种' && /^\|.+\|$/.test(line.trim())
      && !/^\|[-:|\s]+\|$/.test(line.trim()) && !/\|\s*疫苗\s*\|/.test(line);
    if (isDataRow) {
      const vaccineName = tableCells(line)[0] || '';
      const match = vaccinated.find(item => item.alias.test(vaccineName));
      if (match) {
        if (!match.complete) addToConfirm.push(`| ${match.name} | 核对接种记录 | 确认已接种剂次；完成程序则无需再接种 |`);
        continue;
      }
    }
    filtered.push(line);
  }
  if (!addToConfirm.length) return filtered.join('\n');
  const headingIndex = filtered.findIndex(line => /^#{1,4}\s+暂缓或需要确认\s*$/.test(line.trim()));
  if (headingIndex < 0) return filtered.join('\n');
  const existing = getSection(filtered.join('\n'), '暂缓或需要确认');
  const rows = addToConfirm.filter(row => !existing.includes(tableCells(row)[0]));
  const headerIndex = filtered.findIndex((line, index) => index > headingIndex && line.trim() === '| 疫苗 | 当前处理 | 需要确认什么 |');
  if (headerIndex < 0) return filtered.join('\n');
  let tableEnd = headerIndex + 2;
  while (tableEnd < filtered.length && /^\|.+\|$/.test(filtered[tableEnd].trim())) tableEnd += 1;
  if (filtered[headerIndex + 2]?.trim() === '| 暂无 | — | — |') filtered.splice(headerIndex + 2, 1);
  tableEnd = headerIndex + 2;
  while (tableEnd < filtered.length && /^\|.+\|$/.test(filtered[tableEnd].trim())) tableEnd += 1;
  filtered.splice(tableEnd, 0, ...rows);
  return filtered.join('\n');
}

function validateAnswer(answer, safetyContext) {
  const issues = [];
  if (!answer || answer.trim().length < 220) issues.push('结果为空或不完整');
  for (const section of requiredSections) if (!sectionPattern(section).test(answer)) issues.push(`缺少章节：${section}`);
  for (const table of decisionTables) if (!getSection(answer, table.section).includes(table.header)) issues.push(`缺少表头：${table.section}`);
  if (!getSection(answer, '来源与版本').includes(sourceHeader)) issues.push('缺少来源表头');
  const suggestedRows = tableRows(getSection(answer, '建议接种'));
  const evaluatedRows = tableRows(getSection(answer, '暂缓或需要确认'));
  const suggested = suggestedRows.map(cells => cells[0]).filter(name => name && name !== '暂无');
  const evaluated = evaluatedRows.map(cells => cells[0]).filter(name => name && name !== '暂无');
  const duplicates = [...suggested, ...evaluated].filter((name, index, all) => all.indexOf(name) !== index);
  if (duplicates.length) issues.push(`疫苗重复分组：${[...new Set(duplicates)].join('、')}`);
  if (suggestedRows.some(cells => /已接种|已完成|核对|确认|暂缓/.test(cells.join(' ')))) issues.push('建议接种表包含已接种或待确认项目');
  if (explicitVaccinated().some(item => suggested.some(name => item.alias.test(name)))) issues.push('已接种疫苗仍被列为建议接种');
  const evaluationSection = getSection(answer, '暂缓或需要确认');
  if (safetyContext.ruleMode === 'acute' && !/暂缓/.test(evaluationSection)) issues.push('急性中重度病例未提示暂缓');
  if (safetyContext.ruleMode === 'stable' && safetyContext.usesAntimicrobial
    && /(?:阿奇霉素|抗菌药|抗生素)[^\n]{0,80}暂缓|暂缓[^\n]{0,80}(?:阿奇霉素|抗菌药|抗生素)/.test(evaluationSection)) issues.push('错误地因抗菌药物暂缓');
  if (answer.length > 2200) issues.push('结果过长');
  return issues;
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
      while (index < lines.length && lines[index].trim().startsWith('|')) { rows.push(tableCells(lines[index].trim())); index += 1; }
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

async function getPassport() {
  const response = await fetch(`${DIFY_ORIGIN}/api/passport`, { headers: { 'X-App-Code': APP_CODE } });
  if (!response.ok) throw new Error('暂时无法连接推荐服务，请稍后重试。');
  return (await response.json()).access_token;
}

async function runWorkflow(caseInfo) {
  const passport = await getPassport();
  const response = await fetch(`${DIFY_ORIGIN}/api/workflows/run`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-App-Code': APP_CODE, 'X-App-Passport': passport },
    body: JSON.stringify({ inputs: { case_info: caseInfo }, response_mode: 'streaming' }),
  });
  if (!response.ok || !response.body) throw new Error('生成失败，请稍后重试。');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let answer = '';
  while (true) {
    const { value: chunk, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(chunk, { stream: true });
    const blocks = buffer.split('\n\n');
    buffer = blocks.pop() || '';
    for (const block of blocks) for (const line of block.split('\n')) {
      if (!line.startsWith('data:')) continue;
      try {
        const event = JSON.parse(line.slice(5).trim());
        if (event.event === 'text_chunk' && event.data?.text) answer += event.data.text;
        if (event.event === 'workflow_finished') {
          answer = event.data?.outputs?.text || answer;
          if (event.data?.status === 'failed') throw new Error(event.data.error || '生成失败');
        }
        if (event.event === 'error') throw new Error(event.message || '生成失败');
      } catch (error) { if (!(error instanceof SyntaxError)) throw error; }
    }
  }
  if (!answer.trim()) throw new Error('没有收到完整结果，请重新生成。');
  return answer;
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  errorBox.hidden = true;
  if (!form.reportValidity()) return;
  submitButton.disabled = true;
  submitButton.textContent = '正在生成，请稍候…';
  resultCard.hidden = false;
  statusText.textContent = '分析中';
  resultContent.innerHTML = '<p>正在生成简要建议，通常需要约30秒。</p>';
  resultCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
  try {
    const safetyContext = getSafetyContext();
    let validAnswer = '';
    let validationIssues = [];
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      statusText.textContent = attempt === 1 ? '正在生成推荐列表' : `正在重新生成并校验（${attempt}/3）`;
      try {
        const answer = normalizeVaccinatedGrouping(normalizeSections(await runWorkflow(buildCaseInfo())));
        validationIssues = validateAnswer(answer, safetyContext);
        if (!validationIssues.length) { validAnswer = answer; break; }
      } catch (attemptError) {
        validationIssues = [attemptError.message || '本次生成失败'];
        if (attempt === 3) throw attemptError;
      }
    }
    if (!validAnswer) throw new Error(`结果未通过完整性校验：${validationIssues.join('；')}。请重新生成。`);
    renderAnswer(validAnswer);
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
