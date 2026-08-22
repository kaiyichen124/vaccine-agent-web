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

function buildCaseInfo() {
  return [
    `年龄：${value('age', '未知')}`,
    `性别：${value('sex', '未知')}`,
    `主要疾病和目前情况：${value('condition', '未知')}`,
    `近期用药或治疗：${value('treatment')}`,
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
    const answer = await runWorkflow(buildCaseInfo());
    renderAnswer(answer);
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
