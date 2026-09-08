// Local image OCR. Only explicitly confirmed text joins a submitted case.
(() => {
  const $ = id => document.getElementById(id);
  $('reference-date').value = new Intl.DateTimeFormat('sv-SE', {timeZone:'Asia/Shanghai'}).format(new Date());
  let busy = false;
  let library;
  const status = text => { $('report-status').textContent = text; };
  function loadLibrary() {
    if (!library) library = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'vendor/ocr/tesseract.min.js';
      script.onload = resolve;
      script.onerror = () => { library = null; script.remove(); reject(new Error('识别组件加载失败，请稍后重试或直接填写文字。')); };
      document.head.appendChild(script);
    });
    return library;
  }
  async function recognize(event) {
    const file = event.target.files?.[0];
    if (!file || busy) return;
    if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 10*1024*1024) {
      status('请选择10MB以内的JPG、PNG或WebP图片。'); event.target.value = ''; return;
    }
    if (!$('report-preview').hidden && $('report-text').value.trim()) {
      status('请先确认或清除上一张图片的识别内容。'); event.target.value = ''; return;
    }
    busy = true;
    $('case-form').dataset.reportBusy = 'true';
    $('report-file').disabled = $('report-camera').disabled = true;
    let worker, timer;
    try {
      status('正在本机加载识别组件，首次使用需要下载语言数据…');
      await loadLibrary();
      const base = new URL('vendor/ocr/', document.baseURI).href;
      const task = (async () => {
        worker = await Tesseract.createWorker('chi_sim', 1, {
          workerPath: base+'worker.min.js', corePath: base,
          langPath: base, cacheMethod:'none', workerBlobURL:false,
          logger: message => { if (busy && message.status==='recognizing text') status(`正在本机识别：${Math.round(message.progress*100)}%`); },
        });
        if (!busy) { await worker.terminate(); return null; }
        return worker.recognize(file);
      })();
      const result = await Promise.race([task, new Promise((_,reject) => {timer=setTimeout(()=>reject(new Error('识别超时，请重拍清晰图片或直接填写关键结果。')),120000);})]);
      const text = result?.data?.text?.trim();
      if (!text) throw new Error('没有识别到文字，请重拍清晰图片或手动填写。');
      $('report-text').value = text;
      $('report-preview').hidden = false;
      status('识别完成，尚未加入病例。请核对日期、数值和单位，并删除身份信息。出院小结可分段复制到对应字段。');
    } catch (error) {
      status(error.message?.includes('识别') ? error.message : '图片识别失败，请重拍或直接填写文字；不会将失败当成没有检查。');
    } finally {
      busy = false;
      clearTimeout(timer);
      if (worker) await worker.terminate().catch(()=>{});
      $('case-form').dataset.reportBusy = 'false';
      $('report-file').disabled = $('report-camera').disabled = false;
      event.target.value = '';
    }
  }
  $('report-file').addEventListener('change', recognize);
  $('report-camera').addEventListener('change', recognize);
  $('report-apply').addEventListener('click', () => {
    const text = $('report-text').value.trim();
    const field = $($('report-target').value);
    const combined = [field.value.trim(), text].filter(Boolean).join('\n');
    if (!text) { status('没有可加入的文字。'); return; }
    if (combined.length > field.maxLength) { status('内容超过该字段长度，请仅保留相关检查或治疗信息，其他内容分段填入对应字段。'); return; }
    field.value = combined;
    field.dispatchEvent(new Event('input', {bubbles:true}));
    $('report-text').value = '';
    $('report-preview').hidden = true;
    status('已加入所选字段，可继续添加下一张图片。只有生成建议时才提交表单文字。');
  });
  $('report-discard').addEventListener('click', () => {
    $('report-text').value = ''; $('report-preview').hidden = true; status('识别内容已清除。');
  });
})();
