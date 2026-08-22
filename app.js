const DIFY_ORIGIN = 'https://udify.app';
const APP_CODE = '80wJhj8Qlnhdy1ia';

const form = document.querySelector('#case-form');
const submitButton = document.querySelector('#submit-button');
const errorBox = document.querySelector('#form-error');
const resultCard = document.querySelector('#result-card');
const resultContent = document.querySelector('#result-content');
const statusText = document.querySelector('#status-text');

function value(id, fallback = '无') {
  const text = document.querySelector(`#${id}`).value.trim();
  return text || fallback;
}

function getSafetyContext() {
  const treatment = value('treatment');
  const temperatureText = value('temperature', '未知');
  const illnessStatus = value('illness-status', '不清楚');
  const temperatureMatch = temperatureText.match(/\d+(?:\.\d+)?/);
  const temperature = temperatureMatch ? Number(temperatureMatch[0]) : null;
  const usesAntimicrobial = /阿奇霉素|阿莫西林|头孢|青霉素|克拉霉素|罗红霉素|抗菌药|抗生素/.test(treatment);
  const severeAcute = (temperature !== null && temperature >= 38.5)
    || /中度|重度|病情尚未恢复/.test(illnessStatus);
  const statusUnknown = illnessStatus === '不清楚';

  let ruleMode = 'stable';
  let acuteRule = '未命中急性病情暂缓条件。';
  if (severeAcute) {
    ruleMode = 'acute';
    acuteRule = '已命中急性病情暂缓条件：当前体温达到38.5℃及以上，或存在中重度急性不适、病情尚未恢复。暂缓理由必须写当前症状和病情严重程度。';
  } else if (statusUnknown) {
    ruleMode = usesAntimicrobial ? 'antimicrobial_unknown' : 'unknown';
    acuteRule = '当前病情严重程度不清楚，不能自行判断为急性感染期；需要确认体温、当前症状和精神状态。';
  }

  const antimicrobialRule = usesAntimicrobial
    ? '检测到抗菌药物。抗菌药物本身不代表急性感染期，也不构成疫苗暂缓依据；必须按当前体温、症状严重程度和病情是否恢复判断。'
    : '未检测到常见抗菌药物。';

  return {
    ruleMode,
    usesAntimicrobial,
    text: `系统固定判定（不得改写）：\n- ${antimicrobialRule}\n- ${acuteRule}`,
  };
}

function buildCaseInfo() {
  const safetyContext = getSafetyContext();
  return [
    safetyContext.text,
    `年龄：${value('age', '未知')}`,
    `性别：${value('sex', '未知')}`,
    `当前体温：${value('temperature', '未知')}`,
    `目前身体状态：${value('illness-status', '不清楚')}`,
    `主要疾病和目前情况：${value('condition', '未知')}`,
    `近期用药或治疗：${value('treatment')}`,
    `用药或治疗原因：${value('treatment-reason', '未知')}`,
    `接种记录：${value('vaccination', '未知')}`,
    `严重过敏或接种后严重反应：${value('reaction')}`,
    `其他：${value('other')}`,
  ].join('\n');
}

function escapeHtml(text) {
  return text.replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  })[character]);
}

function formatInline(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(https?:\/\/[^\s|<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">查看原文</a>');
}

function tableCells(line) {
  return line.replace(/^\||\|$/g, '').split('|').map(cell => cell.trim());
}

const requiredSections = ['一句话结论', '孩子目前情况', '现在建议接种', '暂缓或接种前需评估', '目前不用接种', '下一步怎么做', '来源与版本'];
const decisionTables = [
  {
    section: '现在建议接种',
    header: '| 疫苗名称 | 疫苗类别 | 建议 | 简要说明 |',
    separator: '|---|---|---|---|',
    emptyRow: '| 目前没有能够直接确定的项目 | — | — | — |',
  },
  {
    section: '暂缓或接种前需评估',
    header: '| 疫苗名称 | 建议 | 需要确认或等待什么 |',
    separator: '|---|---|---|',
    emptyRow: '| 目前没有 | — | — |',
  },
  {
    section: '目前不用接种',
    header: '| 疫苗名称或系列 | 原因 |',
    separator: '|---|---|',
    emptyRow: '| 目前没有 | — |',
  },
];
const sourceHeader = '| 支撑内容 | 正式文献（发布机构，年份） | 章节/页码 | 原文链接或标识 | 核验日期 |';

function sectionPattern(name) {
  return new RegExp(`(#{1,4}\\s*${name}\\s*\\n)([\\s\\S]*?)(?=\\n#{1,4}\\s|$)`);
}

function normalizeEmptyDecisionTables(answer) {
  let normalized = answer;
  for (const table of decisionTables) {
    const pattern = sectionPattern(table.section);
    normalized = normalized.replace(pattern, (whole, heading, body) => {
      if (body.includes(table.header)) return whole;
      const plain = body.replace(/\|[-:|\s]+\|/g, '').replace(/\|/g, ' ').trim();
      if (!plain || /^(目前)?没有/.test(plain)) {
        return `${heading}\n${table.header}\n${table.separator}\n${table.emptyRow}\n`;
      }
      return whole;
    });
  }
  return normalized;
}

function getSection(answer, name) {
  return answer.match(sectionPattern(name))?.[2] || '';
}

function tableRows(section) {
  return section.split(/\r?\n/)
    .filter(line => /^\|.+\|$/.test(line.trim()) && !/^\|[-:|\s]+\|$/.test(line.trim()))
    .map(line => tableCells(line.trim()))
    .slice(1);
}

function firstColumnValues(section) {
  return tableRows(section).map(cells => cells[0]).filter(Boolean);
}

function validateAnswer(answer, safetyContext) {
  const issues = [];
  if (!answer || answer.trim().length < 500) issues.push('结果为空或不完整');
  for (const section of requiredSections) {
    if (!sectionPattern(section).test(answer)) issues.push(`缺少章节：${section}`);
  }
  for (const table of decisionTables) {
    if (!getSection(answer, table.section).includes(table.header)) issues.push(`缺少表头：${table.section}`);
  }
  if (!getSection(answer, '来源与版本').includes(sourceHeader)) issues.push('缺少来源表头');

  const suggested = firstColumnValues(getSection(answer, '现在建议接种'));
  const evaluated = firstColumnValues(getSection(answer, '暂缓或接种前需评估'));
  const notNeeded = firstColumnValues(getSection(answer, '目前不用接种'));
  const duplicates = [...suggested, ...evaluated, ...notNeeded].filter((name, index, all) => name !== '目前没有' && all.indexOf(name) !== index);
  if (duplicates.length) issues.push(`疫苗重复分组：${[...new Set(duplicates)].join('、')}`);

  const evaluationSection = getSection(answer, '暂缓或接种前需评估');
  const suggestedSection = getSection(answer, '现在建议接种');
  const notNeededSection = getSection(answer, '目前不用接种');
  const invalidSuggested = tableRows(suggestedSection).some(cells => /接种前需评估|暂缓接种|尚未到接种时间|当前年龄不适用|已完成/.test(cells[2] || ''));
  if (invalidSuggested) {
    issues.push('“现在建议接种”包含错误状态');
  }
  const invalidEvaluation = tableRows(evaluationSection).some(cells => !/^(暂缓接种|接种前需评估|—)$/.test(cells[1] || ''));
  if (invalidEvaluation) {
    issues.push('评估表包含不允许的状态');
  }
  const invalidNotNeeded = tableRows(notNeededSection).some(cells => /建议接种|建议补种|暂缓接种|接种前需评估/.test(cells.slice(1).join(' ')));
  if (invalidNotNeeded) {
    issues.push('“目前不用接种”包含错误状态');
  }
  if (safetyContext.ruleMode === 'acute' && !/暂缓接种/.test(evaluationSection)) issues.push('急性中重度病例未暂缓');
  if (safetyContext.ruleMode === 'stable' && safetyContext.usesAntimicrobial
    && /(?:阿奇霉素|抗菌药|抗生素)[^\n]{0,100}暂缓|暂缓[^\n]{0,100}(?:阿奇霉素|抗菌药|抗生素)/.test(evaluationSection)) {
    issues.push('错误地因抗菌药物暂缓');
  }
  if (safetyContext.ruleMode === 'antimicrobial_unknown' && /\|[^\n]*暂缓接种[^\n]*\|/.test(evaluationSection)) {
    issues.push('抗菌药原因不明时错误使用暂缓接种');
  }
  return issues;
}

function renderAnswer(markdown) {
  const lines = escapeHtml(markdown).split(/\r?\n/);
  let html = '';
  let inList = false;
  let inOrderedList = false;

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index];
    const line = rawLine.trim();
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
      html += '<div class="table-wrap"><table><thead><tr>';
      html += headers.map(cell => `<th>${formatInline(cell)}</th>`).join('');
      html += '</tr></thead><tbody>';
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
    if (heading) {
      html += `<h3>${formatInline(heading[1])}</h3>`;
      continue;
    }
    html += `<p class="plain-line">${formatInline(line)}</p>`;
  }
  if (inList) html += '</ul>';
  if (inOrderedList) html += '</ol>';
  resultContent.innerHTML = html;
}

async function getPassport() {
  const response = await fetch(`${DIFY_ORIGIN}/api/passport`, {
    headers: { 'X-App-Code': APP_CODE },
  });
  if (!response.ok) throw new Error('暂时无法连接推荐服务，请稍后重试。');
  const data = await response.json();
  return data.access_token;
}

async function runWorkflow(caseInfo) {
  const passport = await getPassport();
  const response = await fetch(`${DIFY_ORIGIN}/api/workflows/run`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-App-Code': APP_CODE,
      'X-App-Passport': passport,
    },
    body: JSON.stringify({
      inputs: { case_info: caseInfo },
      response_mode: 'streaming',
    }),
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

    for (const block of blocks) {
      for (const line of block.split('\n')) {
        if (!line.startsWith('data:')) continue;
        try {
          const event = JSON.parse(line.slice(5).trim());
          if (event.event === 'text_chunk' && event.data?.text) answer += event.data.text;
          if (event.event === 'workflow_finished') {
            answer = event.data?.outputs?.text || answer;
            if (event.data?.status === 'failed') throw new Error(event.data.error || '生成失败');
          }
          if (event.event === 'error') throw new Error(event.message || '生成失败');
        } catch (error) {
          if (error instanceof SyntaxError) continue;
          throw error;
        }
      }
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
  resultContent.innerHTML = '<p>正在检索资料并生成疫苗建议，通常需要约30秒。</p>';
  resultCard.scrollIntoView({ behavior: 'smooth', block: 'start' });

  try {
    const safetyContext = getSafetyContext();
    const caseInfo = buildCaseInfo();
    let validAnswer = '';
    let validationIssues = [];
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      statusText.textContent = attempt === 1 ? '正在生成推荐列表' : `正在重新生成并校验（${attempt}/3）`;
      try {
        const answer = normalizeEmptyDecisionTables(await runWorkflow(caseInfo));
        validationIssues = validateAnswer(answer, safetyContext);
        if (!validationIssues.length) {
          validAnswer = answer;
          break;
        }
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
