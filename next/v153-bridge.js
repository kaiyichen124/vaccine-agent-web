(() => {
  const cfg = window.VACCINE_AGENT_CONFIG || {};
  const origin = String(cfg.DIFY_ORIGIN || 'https://udify.app').replace(/\/$/, '');
  const appCode = String(cfg.APP_CODE || '');
  const expectedRelease = String(cfg.BACKEND_RELEASE || 'v16-deepseek-72');
  const timeoutMs = Number(cfg.REQUEST_TIMEOUT_MS) || 120000;

  async function fetchWithTimeout(url, options = {}, ms = timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } catch (error) {
      if (error && error.name === 'AbortError') throw new Error('连接推荐服务超时，请稍后重试。');
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  async function getV153Passport() {
    if (!appCode) throw new Error('新版 Dify 工作流尚未配置。');
    const response = await fetchWithTimeout(`${origin}/api/passport`, {
      headers: { 'X-App-Code': appCode },
    }, 20000);
    if (!response.ok) throw new Error('无法连接新版 Dify 工作流，请确认工作流已经发布。');
    const payload = await response.json();
    if (!payload || !payload.access_token) throw new Error('Dify 未返回有效连接凭证。');
    return payload.access_token;
  }

  runWorkflow = async function runWorkflowV153(caseInfo, healthCaseInfo, vaccinationPayload) {
    const passport = await getV153Passport();
    const response = await fetchWithTimeout(`${origin}/api/workflows/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-App-Code': appCode,
        'X-App-Passport': passport,
      },
      body: JSON.stringify({
        inputs: {
          case_info: caseInfo,
          health_case_info: healthCaseInfo,
          vaccination_history_json: JSON.stringify(vaccinationPayload),
        },
        response_mode: 'streaming',
      }),
    });

    if (!response.ok || !response.body) {
      let detail = '';
      try { detail = (await response.json()).message || ''; } catch (_) {}
      throw new Error(detail || '生成失败，请稍后重试。');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let answer = '';
    let resultJson = null;

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const blocks = buffer.split('\n\n');
      buffer = blocks.pop() || '';

      for (const block of blocks) {
        for (const line of block.split('\n')) {
          if (!line.startsWith('data:')) continue;
          let event;
          try { event = JSON.parse(line.slice(5).trim()); } catch (_) { continue; }

          if (event.event === 'text_chunk' && event.data && event.data.text) answer += event.data.text;
          if (event.event === 'workflow_finished') {
            const outputs = (event.data && event.data.outputs) || {};
            answer = outputs.vaccine_recommendation || outputs.text || answer;
            if (outputs.result_json) {
              try {
                resultJson = typeof outputs.result_json === 'string' ? JSON.parse(outputs.result_json) : outputs.result_json;
              } catch (_) {
                resultJson = null;
              }
            }
            if (event.data && event.data.status === 'failed') throw new Error(event.data.error || '生成失败');
          }
          if (event.event === 'error') throw new Error(event.message || '生成失败');
        }
      }
    }

    if (!answer.trim()) throw new Error('没有收到完整结果，请重新生成。');
    const actualRelease = resultJson && resultJson.deployment_contract && resultJson.deployment_contract.release;
    if (!actualRelease || actualRelease !== expectedRelease) {
      throw new Error(`后台版本不匹配：${actualRelease || '未知版本'}。`);
    }

    return { answer, resultJson };
  };
})();
