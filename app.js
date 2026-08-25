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

function buildCaseInfo() {
  return [
    `年龄或出生日期：${value('age', '未知')}`,
    `性别：${value('sex', '未知')}`,
    `主要诊断和当前病情：${value('condition', '未知')}`,
    `近期用药或治疗：${value('treatment')}`,
    `接种记录：${value('vaccination', '未知')}`,
    `严重过敏、接种后异常反应和其他说明：${value('other')}`,
  ].join('\n');
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
  AGE_LIMIT: '超过补种年龄',
  POPULATION: '人群不适用',
  RECORD_COMPLETE: '记录已完成',
  DOSE_COUNT_COMPLETE: '剂次已完成',
  AGE_NOT_DUE: '尚未到年龄',
  NEXT_DOSE_NOT_DUE: '下一剂未到期',
  OPTIONAL_PRODUCT_AND_HISTORY: '自费产品与记录',
  NO_HIGH_RISK_INDICATION: '无高风险指征',
};

function decisionCode(item) {
  if (item.decision_state) return item.decision_state;
  if (['建议按程序接种', '建议补种', '建议接种灭活疫苗'].includes(item.final_state)) return 'NOW_DUE';
  if (item.final_state === '暂缓接种') return 'TEMPORARILY_DEFERRED';
  if (item.final_state === '接种前需确认') return 'RECORDS_NEEDED';
  return 'COMPLETED';
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
  const vaccines = Array.isArray(data?.vaccines) ? data.vaccines : [];
  const summary = data?.priority_summary || {};
  const priorityIds = Array.isArray(summary.items) ? summary.items.map(item => item.vaccine_id) : [];
  const priorityItems = priorityIds.map(id => vaccines.find(item => item.vaccine_id === id)).filter(Boolean);
  const itemText = priorityItems.length
    ? `<ol class="priority-list">${priorityItems.map(item => `<li><strong>${renderVaccineName(item)}</strong><span>${escapeHtml(item.final_state)}</span><small>${escapeHtml(item.reason || '')}</small></li>`).join('')}</ol>`
    : '<p>目前没有需要立即处理的项目。</p>';
  const sourceHtml = (data.sources || []).map(source => `<li><a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.title)}</a></li>`).join('');
  const deferSentence = summary.defer_count === null || summary.defer_assessment === 'UNKNOWN_CURRENT_HEALTH_STATUS'
    ? '当前急性健康状态信息不足，暂时无法判断是否需要暂缓。'
    : `${Number(summary.defer_count || 0)} 项需要暂缓。`;

  resultContent.innerHTML = `
    <section class="priority-panel">
      <h3>本次最需要关注</h3>
      <p><strong>${Number(summary.action_count || 0)}</strong> 项现在可以安排；<strong>${Number(summary.confirmation_count ?? summary.confirm_count ?? 0)}</strong> 项需要补充记录或产品信息；<strong>${Number(summary.medical_review_count || 0)}</strong> 项需要专业评估。${escapeHtml(deferSentence)}</p>
      ${itemText}
    </section>
    <section>
      <h3>疫苗安排</h3>
      <div class="status-filters" role="group" aria-label="按状态筛选">
        <button type="button" data-filter="active" class="active">现在可以安排</button>
        <button type="button" data-filter="info">先补资料</button>
        <button type="button" data-filter="medical">暂缓或专业评估</button>
        <button type="button" data-filter="inactive">目前不用安排</button>
        <button type="button" data-filter="all">查看全部</button>
      </div>
      <div class="table-wrap"><table><thead><tr><th>疫苗名称</th><th>当前结论</th><th>原因</th><th>现在怎么做</th></tr></thead><tbody id="vaccine-table-body"></tbody></table></div>
    </section>
    ${(data.next_steps || []).length ? `<section><h3>下一步</h3><ol>${data.next_steps.map(step => `<li>${escapeHtml(step)}</li>`).join('')}</ol></section>` : ''}
    <section><h3>提示</h3><p>本材料用于科研原型和疫苗接种宣教，需由研究人员或预防接种专业人员审核，接种安排以现场评估为准。</p></section>
    ${sourceHtml ? `<section><h3>主要依据</h3><ul>${sourceHtml}</ul></section>` : ''}`;

  const body = resultContent.querySelector('#vaccine-table-body');
  const draw = filter => {
    const shown = vaccines.filter(item => {
      const code = decisionCode(item);
      return filter === 'all'
        || (filter === 'active' && ACTIVE_CODES.has(code))
        || (filter === 'info' && INFO_CODES.has(code))
        || (filter === 'medical' && MEDICAL_CODES.has(code))
        || (filter === 'inactive' && INACTIVE_CODES.has(code));
    });
    body.innerHTML = shown.map(item => {
      const code = decisionCode(item);
      const reasonLabel = REASON_LABELS[item.reason_code] || item.reason_code || '程序判断';
      const action = ACTIVE_CODES.has(code) ? '安排当前这一剂' : INFO_CODES.has(code) ? '按原因补齐信息' : code === 'TEMPORARILY_DEFERRED' ? '满足等待条件后复评' : code === 'MEDICAL_REVIEW' ? '仅评估受影响的疫苗' : '当前无需处理';
      return `<tr data-state="${escapeHtml(code)}"><td>${renderVaccineName(item)}${implementationText(item)}</td><td><span class="state-pill state-${escapeHtml(code.toLowerCase())}">${escapeHtml(item.final_state)}</span></td><td><span class="reason-tag">${escapeHtml(reasonLabel)}</span><div>${escapeHtml(item.reason || item.detail || '')}</div></td><td>${escapeHtml(action)}</td></tr>`;
    }).join('') || '<tr><td colspan="4">该分类下暂无项目。</td></tr>';
  };
  resultContent.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => {
    resultContent.querySelectorAll('[data-filter]').forEach(item => item.classList.toggle('active', item === button));
    draw(button.dataset.filter);
  }));
  draw('active');
}

async function getPassport() {
  const response = await fetch(`${DIFY_ORIGIN}/api/passport`, {
    headers: { 'X-App-Code': APP_CODE },
  });
  if (!response.ok) throw new Error('暂时无法连接推荐服务，请稍后重试。');
  return (await response.json()).access_token;
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
    body: JSON.stringify({ inputs: { case_info: caseInfo }, response_mode: 'streaming' }),
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

  submitButton.disabled = true;
  submitButton.textContent = '正在生成，请稍候…';
  resultCard.hidden = false;
  statusText.textContent = '正在生成推荐列表';
  resultContent.innerHTML = '<p>正在生成简要建议，通常需要约30秒。</p>';
  resultCard.scrollIntoView({ behavior: 'smooth', block: 'start' });

  try {
    const workflowResult = await runWorkflow(buildCaseInfo());
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
