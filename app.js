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

const ACTIVE_STATES = new Set(['建议按程序接种', '建议补种', '建议接种灭活疫苗']);
const REVIEW_STATES = new Set(['接种前需确认', '暂缓接种']);

function renderStructuredResult(data) {
  const vaccines = Array.isArray(data?.vaccines) ? data.vaccines : [];
  const summary = data?.priority_summary || {};
  const priorityItems = vaccines.filter(item => ACTIVE_STATES.has(item.final_state) || REVIEW_STATES.has(item.final_state)).slice(0, 5);
  const itemText = priorityItems.length
    ? `<ol>${priorityItems.map(item => `<li><strong>${escapeHtml(item.display_name || item.vaccine)}</strong>${item.dose ? `（当前第${item.dose}针）` : ''}：${escapeHtml(item.final_state)}</li>`).join('')}</ol>`
    : '<p>目前没有需要立即安排、确认或暂缓的项目。</p>';
  const sourceHtml = (data.sources || []).map(source => `<li><a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.title)}</a></li>`).join('');

  resultContent.innerHTML = `
    <section class="priority-panel">
      <h3>本次最需要关注</h3>
      <p>目前有 <strong>${Number(summary.action_count || 0)}</strong> 项需要安排，<strong>${Number(summary.confirm_count || 0)}</strong> 项需要确认，<strong>${Number(summary.defer_count || 0)}</strong> 项需要暂缓。</p>
      ${itemText}
    </section>
    <section>
      <h3>疫苗安排一览</h3>
      <div class="status-filters" role="group" aria-label="按状态筛选">
        <button type="button" data-filter="active" class="active">现在需要处理</button>
        <button type="button" data-filter="review">需要确认或暂缓</button>
        <button type="button" data-filter="inactive">目前不用处理</button>
        <button type="button" data-filter="all">全部疫苗</button>
      </div>
      <div class="table-wrap"><table><thead><tr><th>疫苗名称</th><th>当前建议</th><th>说明</th></tr></thead><tbody id="vaccine-table-body"></tbody></table></div>
    </section>
    ${(data.next_steps || []).length ? `<section><h3>下一步</h3><ol>${data.next_steps.map(step => `<li>${escapeHtml(step)}</li>`).join('')}</ol></section>` : ''}
    <section><h3>提示</h3><p>本材料用于科研原型和疫苗接种宣教，需由研究人员或预防接种专业人员审核，接种安排以现场评估为准。</p></section>
    ${sourceHtml ? `<section><h3>主要依据</h3><ul>${sourceHtml}</ul></section>` : ''}`;

  const body = resultContent.querySelector('#vaccine-table-body');
  const draw = filter => {
    const shown = vaccines.filter(item => filter === 'all'
      || (filter === 'active' && ACTIVE_STATES.has(item.final_state))
      || (filter === 'review' && REVIEW_STATES.has(item.final_state))
      || (filter === 'inactive' && !ACTIVE_STATES.has(item.final_state) && !REVIEW_STATES.has(item.final_state)));
    body.innerHTML = shown.map(item => `<tr data-state="${escapeHtml(item.final_state)}"><td>${escapeHtml(item.display_name || item.vaccine)}${item.dose ? `（第${item.dose}针）` : ''}</td><td><span class="state-pill">${escapeHtml(item.final_state)}</span></td><td>${escapeHtml(item.reason || item.detail || '')}</td></tr>`).join('') || '<tr><td colspan="3">该分类下暂无项目。</td></tr>';
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
