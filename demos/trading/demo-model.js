/* Original, synthetic-only model for this public interaction demo. */
(function (global) {
  'use strict';
  const START = Date.parse('2026-04-13T00:00:00+08:00');
  const examples = [
    {
      id: 'paper-long-01', instrument: 'ALPHA / USD', direction: 'long', accent: '#507965',
      title: '分批进场，分两次退出', question: '加仓以后，退出条件有没有随之写清楚？',
      declaredReason: '按计划分批退出', anchor: 10000,
      fills: [
        {bar: 350, change: 2, price: 10000, fee: 10, memo: '样例：首次建立多头仓位'},
        {bar: 362, change: 2, price: 10200, fee: 10, memo: '样例：第二次进场，仓位增加'},
        {bar: 378, change: -2, price: 10600, fee: 10, memo: '样例：先退出一半仓位'},
        {bar: 394, change: -2, price: 10800, fee: 10, memo: '样例：剩余仓位全部退出'},
      ],
    },
    {
      id: 'paper-short-02', instrument: 'BETA / USD', direction: 'short', accent: '#aa6655',
      title: '逆向加仓后，执行止损', question: '加仓的依据和最初的判断是一回事吗？',
      declaredReason: '止损退出（由样例明确指定）', anchor: 8000,
      fills: [
        {bar: 330, change: 3, price: 8000, fee: 8, memo: '样例：建立空头仓位'},
        {bar: 354, change: 1, price: 8400, fee: 8, memo: '样例：价格上行时再次增加空头'},
        {bar: 378, change: -2, price: 8300, fee: 8, memo: '样例：先缩减部分风险敞口'},
        {bar: 402, change: -2, price: 8500, fee: 8, memo: '样例明确记录：执行止损，全部退出'},
      ],
    },
    {
      id: 'paper-open-03', instrument: 'GAMMA / USD', direction: 'long', accent: '#547385',
      title: '部分减仓，仓位仍然开放', question: '已经落袋的部分，是否掩盖了剩余仓位的风险？',
      declaredReason: '尚未完全退出；已发生一次减仓', anchor: 11000,
      fills: [
        {bar: 360, change: 4, price: 11000, fee: 12, memo: '样例：建立多头仓位'},
        {bar: 384, change: -1, price: 11200, fee: 4, memo: '样例：只减少一单位，仍持有三单位'},
      ],
    },
  ];

  function ledger(example) {
    let quantity = 0, cost = 0, gross = 0, fees = 0, peak = 0;
    const entries = example.fills.map((fill, index) => {
      if (![fill.change, fill.price, fill.fee].every(Number.isSafeInteger) || fill.price <= 0 || fill.fee < 0 || fill.change === 0) throw Error('Invalid synthetic fill');
      const before = quantity;
      let realized = 0;
      if (fill.change > 0) {
        cost += fill.price * fill.change;
        quantity += fill.change;
      } else {
        const released = -fill.change;
        if (!before || released > before) throw Error('Cannot reduce more than the held quantity');
        const average = cost / before;
        realized = (fill.price - average) * released * (example.direction === 'long' ? 1 : -1);
        // The hand-authored fixtures use integral cents, avoiding fake precision.
        if (!Number.isSafeInteger(realized)) throw Error('This small demo requires integral-cent outcomes');
        cost -= average * released;
        quantity -= released;
      }
      fees += fill.fee;
      gross += realized;
      peak = Math.max(peak, quantity);
      const action = fill.change > 0 ? (before ? '加仓' : '开仓') : (quantity ? '减仓' : '平仓');
      const buying = example.direction === 'long' ? fill.change > 0 : fill.change < 0;
      return {...fill, index, action, buying, quantity, average: quantity ? cost / quantity : null,
        realized, net: realized - fill.fee, time: START + fill.bar * 300000};
    });
    return {entries, quantity, gross, fees, net: gross - fees, peak, closed: quantity === 0};
  }

  function netCurve(samples) {
    const events = samples.flatMap(sample => ledger(sample).entries.map(fill => ({
      time: fill.time, realized: fill.realized, fee: fill.fee,
    })));
    events.sort((a, b) => a.time - b.time);
    const points = [];
    let gross = 0, fees = 0, count = 0;
    for (const event of events) {
      if (!Number.isSafeInteger(event.time)) throw Error('Invalid synthetic event time');
      gross += event.realized;
      fees += event.fee;
      count++;
      if (![gross, fees, gross - fees].every(Number.isSafeInteger)) throw Error('Curve exceeds safe integer cents');
      const point = {time: event.time, gross, fees, net: gross - fees, count};
      // Simultaneous fills have one end-of-timestamp value, without arbitrary ordering.
      if (points.length && points[points.length - 1].time === event.time) points[points.length - 1] = point;
      else points.push(point);
    }
    return {points, gross, fees, net: gross - fees, count};
  }

  function candles(example) {
    const points = [[0, example.anchor * .94], [160, example.anchor * .965],
      [300, example.anchor * .985], ...example.fills.map(fill => [fill.bar, fill.price]),
      [719, example.fills[example.fills.length - 1].price * 1.012]];
    let segment = 0;
    let previous = Math.round(points[0][1]);
    const result = [];
    for (let i = 0; i < 720; i++) {
      while (segment < points.length - 2 && i > points[segment + 1][0]) segment++;
      const [left, right] = [points[segment], points[segment + 1]];
      const ratio = (i - left[0]) / (right[0] - left[0]);
      const center = left[1] + (right[1] - left[1]) * ratio;
      const close = Math.round(center + Math.sin(i * .73) * 27 + Math.sin(i * .16) * 18);
      const fill = example.fills.find(item => item.bar === i);
      const high = Math.max(previous, close, fill ? fill.price : close) + 16 + i % 11;
      const low = Math.min(previous, close, fill ? fill.price : close) - 16 - i % 7;
      result.push({time: START + i * 300000, open: previous, high, low, close});
      previous = close;
    }
    return result;
  }

  function aggregate(bars, interval) {
    if (interval === '5m') return bars.map(bar => ({...bar}));
    if (interval !== '1h') throw Error('Unsupported interval');
    const groups = [];
    for (const bar of bars) {
      const time = Math.floor(bar.time / 3600000) * 3600000;
      const last = groups[groups.length - 1];
      if (last && last.time === time) {
        last.high = Math.max(last.high, bar.high);
        last.low = Math.min(last.low, bar.low);
        last.close = bar.close;
      } else groups.push({...bar, time});
    }
    return groups;
  }

  function movingAverage(bars, length = 20) {
    let previous = null;
    return bars.map((bar, index) => {
      if (index < length - 1) return null;
      previous = previous === null ? bars.slice(0, length).reduce((sum, item) => sum + item.close, 0) / length
        : bar.close * (2 / (length + 1)) + previous * (1 - 2 / (length + 1));
      return previous;
    });
  }

  const issueTags = ['执行符合计划', '加仓过快', '止损执行', '提前离场', '入场依据不足', '待补上下文'];
  const exitReasons = ['按计划退出', '止损退出', '分批退出', '判断改变', '尚未完全退出', '其他'];
  function blankReview() { return {reflection: '', exitReason: '', issues: [], nextAction: '', complete: false}; }
  function sanitizeReview(value) {
    const item = value && typeof value === 'object' ? value : {};
    return {reflection: typeof item.reflection === 'string' ? item.reflection.slice(0, 2000) : '',
      exitReason: exitReasons.includes(item.exitReason) ? item.exitReason : '',
      issues: Array.isArray(item.issues) ? issueTags.filter(tag => item.issues.includes(tag)) : [],
      nextAction: typeof item.nextAction === 'string' ? item.nextAction.slice(0, 2000) : '',
      complete: item.complete === true};
  }
  function sanitizeFillNotes(value, count) {
    return Array.from({length: count}, (_, index) => typeof value?.[index] === 'string' ? value[index].slice(0, 2000) : '');
  }
  const api = {examples, ledger, netCurve, candles, aggregate, movingAverage, issueTags, exitReasons, blankReview, sanitizeReview, sanitizeFillNotes};
  if (typeof module === 'object' && module.exports) module.exports = api;
  else global.JournalDemoModel = api;
})(typeof window === 'undefined' ? globalThis : window);
