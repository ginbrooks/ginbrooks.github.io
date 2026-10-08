(function () {
  'use strict';
  const model = window.JournalDemoModel;
  const examples = model.examples;
  const $ = id => document.getElementById(id);
  const STORAGE_KEY = 'trading-journal-public-demo-v1';
  const reviews = Object.fromEntries(examples.map(item => [item.id, model.blankReview()]));
  const fillNotes = Object.fromEntries(examples.map(item => [item.id, model.sanitizeFillNotes(null, item.fills.length)]));
  let selection = examples[0], activeFill = 0, interval = '5m', storageError = '', savedIds = new Set();
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (saved && saved.version === 1 && saved.reviews && typeof saved.reviews === 'object') {
      for (const item of examples) if (saved.reviews[item.id]) {
        reviews[item.id] = model.sanitizeReview(saved.reviews[item.id]);
        savedIds.add(item.id);
      }
      for (const item of examples) fillNotes[item.id] = model.sanitizeFillNotes(saved.fillNotes?.[item.id], item.fills.length);
    }
  } catch (_) { storageError = '未能读取本机存储；新笔记仍可导出。'; }

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function money(minor, signed = false) {
    const prefix = minor < 0 ? '−' : signed && minor > 0 ? '+' : '';
    return prefix + (Math.abs(minor) / 100).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
  }
  function time(value, withDate = false) {
    const parts = new Intl.DateTimeFormat('en-GB', {timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit',
      ...(withDate ? {month: '2-digit', day: '2-digit'} : {})}).formatToParts(new Date(value));
    const part = type => parts.find(item => item.type === type)?.value || '';
    return (withDate ? part('month') + '.' + part('day') + ' ' : '') + part('hour') + ':' + part('minute');
  }
  function statusText(review) {
    return review.complete ? '复盘已完成' : review.reflection || review.exitReason || review.issues.length || review.nextAction ? '复盘进行中' : '尚未复盘';
  }
  function renderCycles() {
    const holder = $('cycles');
    const scroll = holder.scrollLeft;
    holder.replaceChildren();
    for (const item of examples) {
      const totals = model.ledger(item);
      const card = element('button', 'cycle-card' + (item.id === selection.id ? ' selected' : ''));
      card.setAttribute('aria-pressed', String(item.id === selection.id));
      card.setAttribute('aria-label', `${item.instrument} ${item.title}`);
      const heading = element('div', 'row');
      heading.append(element('strong', '', item.instrument), element('span', 'chip' + (item.direction === 'short' ? ' short' : ''), item.direction === 'long' ? '多' : '空'));
      card.append(heading, element('h3', '', item.title));
      const meta = element('div', 'meta');
      const noteCount = fillNotes[item.id].filter(note => note.trim()).length;
      meta.append(element('span', '', '04.14 · ' + (totals.closed ? '已平仓' : '持仓中')),
        element('span', 'review-dot', noteCount ? `${noteCount} 笔有笔记` : '逐笔笔记待写'));
      card.append(meta);
      card.addEventListener('click', () => {selection = item; activeFill = 0; render();});
      holder.append(card);
    }
    holder.scrollLeft = scroll;
  }
  function renderSummary() {
    const totals = model.ledger(selection);
    $('instrument').textContent = selection.instrument;
    $('direction').textContent = selection.direction === 'long' ? '做多 LONG' : '做空 SHORT';
    $('direction').className = 'direction' + (selection.direction === 'short' ? ' short' : '');
    $('position-state').textContent = totals.closed ? '已平仓' : '持仓中';
    $('position-state').className = 'state-label' + (totals.closed ? '' : ' open');
    $('date-range').textContent = time(totals.entries[0].time, true) + ' — ' +
      (totals.closed ? time(totals.entries[totals.entries.length - 1].time, true) : '尚未完全退出') + ' · 上海时区';
    $('metric-net').textContent = money(totals.net, true);
    $('metric-net').className = totals.net >= 0 ? 'positive' : 'negative';
    $('metric-fee').textContent = money(totals.fees);
    $('metric-count').textContent = totals.entries.length + ' 条';
    $('metric-count-caption').textContent = totals.closed ? '归属于一个完整持仓周期' : '当前阶段的已发生记录';
    $('metric-position').textContent = totals.quantity + ' 单位';
    $('metric-position-caption').textContent = totals.closed ? '本周期已全部退出' : '不包含剩余仓位浮动盈亏';
  }

  const NS = 'http://www.w3.org/2000/svg';
  function svgElement(tag, attrs = {}, text) {
    const node = document.createElementNS(NS, tag);
    for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, String(value));
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function renderOverview() {
    const result = model.netCurve(examples);
    $('overall-net').textContent = money(result.net, true);
    $('overall-net').className = result.net >= 0 ? 'positive' : 'negative';
    $('overall-gross').textContent = money(result.gross, true);
    $('overall-fee').textContent = money(result.fees);
    $('overall-count').textContent = `${result.count} 条成交 · 2 个已平 / 1 个未平`;
    const wrapper = $('overall-chart'), width = Math.max(260, wrapper.clientWidth), height = wrapper.clientHeight;
    const first = result.points[0].time, last = result.points[result.points.length - 1].time;
    const left = 15, right = width - 50, top = 16, bottom = height - 30;
    const min = Math.min(0, ...result.points.map(point => point.net)), max = Math.max(0, ...result.points.map(point => point.net));
    const pad = Math.max(25, (max - min) * .15);
    const x = value => left + (value - first) / Math.max(1, last - first) * (right - left);
    const y = value => bottom - (value - min + pad) / (max - min + pad * 2) * (bottom - top);
    const svg = svgElement('svg', {viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': `10 条合成成交的累计已实现净额，最终 ${money(result.net)} USD；不是账户权益`});
    for (let index = 0; index < 4; index++) {
      const value = min + (max - min) * index / 3;
      svg.append(svgElement('line', {x1: left, x2: right, y1: y(value), y2: y(value), stroke: '#e8ece2', 'stroke-dasharray': '3 4'}));
      svg.append(svgElement('text', {x: right + 8, y: y(value) + 3, fill: '#85917e', 'font-size': 9}, money(value)));
    }
    svg.append(svgElement('line', {x1: left, x2: right, y1: y(0), y2: y(0), stroke: '#bcc8b8'}));
    let path = `M ${left} ${y(0)}`;
    for (const point of result.points) path += ` H ${x(point.time)} V ${y(point.net)}`;
    svg.append(svgElement('path', {d: path, fill: 'none', stroke: '#47745f', 'stroke-width': 2, 'stroke-linejoin': 'round'}));
    for (const point of result.points) {
      const dot = svgElement('circle', {cx: x(point.time), cy: y(point.net), r: 3, fill: '#fcfbf7', stroke: '#47745f', 'stroke-width': 1.4});
      dot.append(svgElement('title', {}, `${time(point.time, true)} · 累计 ${money(point.net, true)} USD · 已计 ${point.count} 条成交`));
      svg.append(dot);
    }
    for (const [value, anchor] of [[first, 'start'], [(first + last) / 2, 'middle'], [last, 'end']]) {
      svg.append(svgElement('text', {x: x(value), y: height - 8, fill: '#85917e', 'font-size': 9, 'text-anchor': anchor}, time(value)));
    }
    wrapper.replaceChildren(svg);
  }
  function renderChart() {
    const wrapper = $('chart');
    const narrow = window.innerWidth < 560;
    const width = Math.max(280, wrapper.clientWidth - (narrow ? 4 : 24));
    const height = Math.max(235, wrapper.clientHeight - 12);
    const raw = model.aggregate(model.candles(selection), interval);
    const ema = model.movingAverage(raw);
    const totals = model.ledger(selection);
    const step = interval === '5m' ? 300000 : 3600000;
    const firstTime = Math.floor(totals.entries[0].time / step) * step;
    const lastTime = Math.floor(totals.entries[totals.entries.length - 1].time / step) * step;
    const margin = interval === '5m' ? 12 : 5;
    const visible = raw.map((bar, index) => ({...bar, ema: ema[index]}))
      .filter(bar => bar.time >= firstTime - margin * step && bar.time <= lastTime + margin * step);
    const top = 28, bottom = height - 30, left = 13, right = width - 51;
    const min = Math.min(...visible.map(bar => Math.min(bar.low, bar.ema ?? bar.low)));
    const max = Math.max(...visible.map(bar => Math.max(bar.high, bar.ema ?? bar.high)));
    const pad = (max - min) * .12;
    const y = value => bottom - (value - min + pad) / (max - min + 2 * pad) * (bottom - top);
    const spacing = (right - left) / visible.length;
    const x = index => left + (index + .5) * spacing;
    const svg = svgElement('svg', {viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': `${selection.instrument} 合成${interval === '5m' ? '5分钟' : '1小时'}K线与EMA20，含${totals.entries.length}个成交位置`});
    svg.append(svgElement('title', {}, '完全合成行情；点击编号可选择成交，表格提供相同操作。'));
    for (let i = 0; i < 5; i++) {
      const value = min - pad + (max - min + 2 * pad) * i / 4;
      svg.append(svgElement('line', {x1: left, x2: right, y1: y(value), y2: y(value), stroke: '#e8ece2', 'stroke-dasharray': '3 5'}));
      svg.append(svgElement('text', {x: right + 9, y: y(value) + 3, fill: '#85917e', 'font-size': 9}, money(value)));
    }
    for (let i = 0; i < visible.length; i++) {
      const bar = visible[i], color = bar.close >= bar.open ? '#78947a' : '#bb8b77';
      const candleWidth = Math.max(1, Math.min(9, spacing * .64));
      svg.append(svgElement('line', {x1: x(i), x2: x(i), y1: y(bar.high), y2: y(bar.low), stroke: color, 'stroke-width': 1}));
      svg.append(svgElement('rect', {x: x(i) - candleWidth / 2, y: Math.min(y(bar.open), y(bar.close)), width: candleWidth,
        height: Math.max(1, Math.abs(y(bar.close) - y(bar.open))), fill: color, rx: .4}));
    }
    const line = visible.map((bar, i) => bar.ema === null ? '' : `${x(i)},${y(bar.ema)}`).filter(Boolean).join(' ');
    svg.append(svgElement('polyline', {points: line, fill: 'none', stroke: '#b49a5e', 'stroke-width': 1.5, 'stroke-linejoin': 'round'}));
    for (const index of [0, Math.floor(visible.length / 3), Math.floor(visible.length * 2 / 3), visible.length - 1]) {
      svg.append(svgElement('text', {x: x(index), y: height - 9, fill: '#85917e', 'font-size': 9, 'text-anchor': index === 0 ? 'start' : index === visible.length - 1 ? 'end' : 'middle'}, time(visible[index].time)));
    }
    const chosen = totals.entries[activeFill];
    const chosenIndex = visible.findIndex(bar => Math.floor(chosen.time / step) * step === bar.time);
    if (chosenIndex >= 0) {
      svg.append(svgElement('line', {x1: left, x2: right, y1: y(chosen.price), y2: y(chosen.price), stroke: '#779174', 'stroke-dasharray': '4 4', opacity: .5}));
      svg.append(svgElement('line', {x1: x(chosenIndex), x2: x(chosenIndex), y1: top, y2: bottom, stroke: '#cad4c2', 'stroke-dasharray': '3 4'}));
    }
    totals.entries.forEach((fill, index) => {
      const at = visible.findIndex(bar => Math.floor(fill.time / step) * step === bar.time);
      if (at < 0) return;
      const px = x(at), py = y(fill.price), markerY = fill.buying ? Math.min(bottom - 10, py + 30) : Math.max(top + 10, py - 30);
      const active = index === activeFill;
      const group = svgElement('g', {class: 'fill-point', tabindex: 0, role: 'button', 'aria-label': `成交${index + 1}：${fill.action}，${money(fill.price)}美元`, 'aria-pressed': active});
      group.append(svgElement('line', {x1: px, x2: px, y1: py, y2: markerY, stroke: '#728468', 'stroke-width': 1}));
      group.append(svgElement('circle', {cx: px, cy: py, r: 2, fill: '#4f6b43'}));
      group.append(svgElement('circle', {cx: px, cy: markerY, r: 10, fill: active ? '#416342' : '#fcfbf7', stroke: '#6c8560', 'stroke-width': 1.3}));
      group.append(svgElement('text', {x: px, y: markerY + 3.5, 'text-anchor': 'middle', fill: active ? '#ffffff' : '#527047', 'font-size': 10}, index + 1));
      const select = () => {activeFill = index; renderChart(); renderFills();};
      group.addEventListener('click', select);
      group.addEventListener('keydown', event => {if (event.key === 'Enter' || event.key === ' ') {event.preventDefault(); select();}});
      svg.append(group);
    });
    wrapper.replaceChildren(svg);
    $('chart-caption').textContent = `${activeFill + 1} · ${chosen.action} · ${chosen.buying ? '买入' : '卖出'} ${Math.abs(chosen.change)} 单位 @ ${money(chosen.price)} USD`;
    document.querySelectorAll('[data-interval]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.interval === interval)));
  }
  function renderFills() {
    const totals = model.ledger(selection);
    const holder = $('fill-timeline');
    holder.replaceChildren();
    for (const fill of totals.entries) {
      const button = element('button', 'fill-button' + (activeFill === fill.index ? ' selected' : ''));
      button.setAttribute('aria-pressed', String(activeFill === fill.index));
      button.setAttribute('aria-label', `第${fill.index + 1}条：${fill.action}，${Math.abs(fill.change)}单位，${money(fill.price)}美元`);
      const head = element('div', 'top');
      head.append(element('span', 'number', fill.index + 1), element('strong', '', fill.action), element('span', 'subtle', (fill.change > 0 ? '+' : '−') + Math.abs(fill.change) + ' 单位'));
      button.append(head, element('span', 'price', money(fill.price)), element('span', 'time', time(fill.time, true)));
      button.addEventListener('click', () => {activeFill = fill.index; renderChart(); renderFills();});
      holder.append(button);
    }
    const fill = totals.entries[activeFill];
    const detail = $('fill-detail');
    detail.replaceChildren();
    const memo = element('div');
    memo.append(element('strong', '', fill.memo), element('p', '', '成交方向：' + (fill.buying ? '买入 BUY' : '卖出 SELL')));
    detail.append(memo);
    for (const [label, value] of [['该条已实现盈亏', money(fill.realized, true) + ' USD'], ['该条手续费', money(fill.fee) + ' USD'], ['成交后持仓', fill.quantity + ' 单位']]) {
      const cell = element('div');cell.append(element('span', '', label), element('strong', '', value));detail.append(cell);
    }
    $('declared-reason').textContent = selection.declaredReason;
    $('fill-note-label').textContent = `第 ${activeFill + 1} 笔 · ${fill.action}的判断`;
    $('fill-note').value = fillNotes[selection.id][activeFill];
    updateSaveState();
  }
  function updateSaveState() {
    $('save-state').textContent = storageError || (savedIds.has(selection.id) ? '已保存到此浏览器' : '暂无本机记录');
    $('save-state').className = 'save-state' + (storageError ? ' error' : '');
    $('fill-save-state').textContent = $('save-state').textContent;
    $('fill-save-state').className = $('save-state').className;
  }
  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({version: 1, updatedAt: new Date().toISOString(), reviews, fillNotes}));
      storageError = '';
      savedIds.add(selection.id);
    } catch (_) { storageError = '未保存：本机存储不可用，请导出笔记。'; }
    updateSaveState();
    renderCycles();
  }
  function renderTags() {
    const holder = $('issue-tags');holder.replaceChildren();
    for (const tag of model.issueTags) {
      const active = reviews[selection.id].issues.includes(tag);
      const button = element('button', '', tag);button.setAttribute('aria-pressed', String(active));
      button.addEventListener('click', () => {
        const review = reviews[selection.id];
        review.issues = active ? review.issues.filter(item => item !== tag) : [...review.issues, tag];
        persist();renderTags();
      });
      holder.append(button);
    }
  }
  function renderReview() {
    const review = reviews[selection.id];
    $('reflection').value = review.reflection;
    $('exit-reason').value = review.exitReason;
    $('next-action').value = review.nextAction;
    $('review-complete').checked = review.complete;
    $('complete-label').textContent = model.ledger(selection).closed ? '这轮复盘已完成' : '本阶段复盘已完成（仓位仍开放）';
    $('review-question').textContent = selection.question;
    renderTags();updateSaveState();
  }
  function render() {renderCycles();renderOverview();renderSummary();renderChart();renderFills();renderReview();}
  for (const reason of model.exitReasons) {
    const option = element('option', '', reason);option.value = reason;$('exit-reason').append(option);
  }
  for (const [id, property] of [['reflection', 'reflection'], ['exit-reason', 'exitReason'], ['next-action', 'nextAction']]) {
    $(id).addEventListener(id === 'exit-reason' ? 'change' : 'input', event => {reviews[selection.id][property] = event.target.value;persist();});
  }
  $('review-complete').addEventListener('change', event => {reviews[selection.id].complete = event.target.checked;persist();});
  $('fill-note').addEventListener('input', event => {fillNotes[selection.id][activeFill] = event.target.value;persist();});
  document.querySelectorAll('[data-interval]').forEach(button => button.addEventListener('click', () => {interval = button.dataset.interval;renderChart();}));
  $('export-notes').addEventListener('click', () => {
    const report = {version: 1, context: '合成交易演示中的本机笔记，不含真实交易或收益记录', exportedAt: new Date().toISOString(),
      entries: examples.map(item => ({exampleId: item.id, instrument: item.instrument, review: {...reviews[item.id]},
        fillNotes: fillNotes[item.id].map((note, index) => ({fillIndex: index, note}))}))};
    const file = new Blob([JSON.stringify(report, null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(file), anchor = element('a');
    anchor.href = url;anchor.download = 'trading-assistant-demo-notes.json';document.body.append(anchor);anchor.click();anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    $('export-status').textContent = '演示笔记已导出；文件只包含你在此页面记录的文字与状态。';
  });
  render();
  let frame;
  new ResizeObserver(() => {cancelAnimationFrame(frame);frame = requestAnimationFrame(() => {renderChart();renderOverview();});}).observe($('chart'));
})();
