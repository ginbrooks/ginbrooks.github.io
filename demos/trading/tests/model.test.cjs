const test = require('node:test');
const assert = require('node:assert/strict');
const model = require('../demo-model.js');

test('four fills are one long cycle with exact cent totals', () => {
  const book = model.ledger(model.examples[0]);
  assert.deepEqual(book.entries.map(item => item.action), ['开仓', '加仓', '减仓', '平仓']);
  assert.deepEqual(book.entries.map(item => item.quantity), [2, 4, 2, 0]);
  assert.deepEqual(book.entries.map(item => item.realized), [0, 0, 1000, 1400]);
  assert.deepEqual([book.gross, book.fees, book.net, book.quantity, book.closed], [2400, 40, 2360, 0, true]);
});
test('short selling reverses order sides and accounts for losing exits', () => {
  const book = model.ledger(model.examples[1]);
  assert.deepEqual(book.entries.map(item => item.buying), [false, false, true, true]);
  assert.deepEqual([book.gross, book.fees, book.net, book.quantity, book.closed], [-1200, 32, -1232, 0, true]);
});
test('partial exit remains open and never invents unrealized profit', () => {
  const book = model.ledger(model.examples[2]);
  assert.deepEqual(book.entries.map(item => item.action), ['开仓', '减仓']);
  assert.deepEqual([book.gross, book.fees, book.net, book.quantity, book.closed], [200, 16, 184, 3, false]);
  assert.equal(book.entries.reduce((sum, item) => sum + item.net, 0), book.net);
});
test('over-reduction fails instead of producing a phantom position', () => {
  assert.throws(() => model.ledger({direction: 'long', fills: [{bar: 1, change: 1, price: 1000, fee: 1}, {bar: 2, change: -2, price: 1000, fee: 1}]}));
});
test('synthetic candles are deterministic, ordered, valid, and contain fills', () => {
  for (const sample of model.examples) {
    const bars = model.candles(sample);
    assert.deepEqual(bars, model.candles(sample));
    assert.equal(bars.length, 720);
    bars.forEach((bar, index) => {
      assert.ok(bar.low <= Math.min(bar.open, bar.close));
      assert.ok(bar.high >= Math.max(bar.open, bar.close));
      if (index) assert.equal(bar.time - bars[index - 1].time, 300000);
    });
    sample.fills.forEach(fill => assert.ok(bars[fill.bar].low <= fill.price && bars[fill.bar].high >= fill.price));
  }
});
test('one-hour candles aggregate actual five-minute OHLC, not a second invented path', () => {
  const bars = model.candles(model.examples[0]);
  const hourly = model.aggregate(bars, '1h');
  assert.equal(hourly.length, 60);
  hourly.forEach((bar, index) => {
    const group = bars.slice(index * 12, index * 12 + 12);
    assert.deepEqual(bar, {time: group[0].time, open: group[0].open, high: Math.max(...group.map(x => x.high)), low: Math.min(...group.map(x => x.low)), close: group[group.length - 1].close});
  });
});
test('EMA has an explicit warmup and correct next value', () => {
  const bars = Array.from({length: 21}, (_, index) => ({close: (index + 1) * 100}));
  const result = model.movingAverage(bars);
  assert.deepEqual(result.slice(0, 19), Array(19).fill(null));
  assert.equal(result[19], 1050);
  assert.equal(result[20], 1150);
});
test('notes accept only this demo schema and explicit completion', () => {
  const review = model.sanitizeReview({reflection: '<script>text only</script>', exitReason: 'made up', issues: ['止损执行', 'bad', '止损执行'], nextAction: 5, complete: 'yes'});
  assert.deepEqual(review, {reflection: '<script>text only</script>', exitReason: '', issues: ['止损执行'], nextAction: '', complete: false});
  assert.equal(model.sanitizeReview({complete: true}).complete, true);
  assert.equal(model.sanitizeReview({reflection: 'a'.repeat(3000)}).reflection.length, 2000);
});

test('total curve uses chronological fills, includes opening fees, and matches every ledger', () => {
  const curve = model.netCurve(model.examples);
  assert.deepEqual([curve.gross, curve.fees, curve.net, curve.count], [1400, 88, 1312, 10]);
  assert.equal(curve.points[0].net, -8);
  assert.equal(curve.points[0].count, 1);
  curve.points.forEach((point, index) => {
    assert.equal(point.net, point.gross - point.fees);
    if (index) assert.ok(point.time > curve.points[index - 1].time);
  });
  assert.deepEqual(model.netCurve([...model.examples].reverse()), curve);
  assert.equal(curve.net, model.examples.reduce((sum, item) => sum + model.ledger(item).net, 0));
});
test('simultaneous fills are merged into one cumulative point', () => {
  const samples = [5, 7].map(fee => ({direction: 'long', fills: [{bar: 0, change: 1, price: 100, fee}]}));
  const curve = model.netCurve(samples);
  assert.equal(curve.points.length, 1);
  assert.deepEqual([curve.points[0].net, curve.points[0].count], [-12, 2]);
  assert.deepEqual(model.netCurve(samples.reverse()), curve);
});
test('empty curve stays empty and non-realized holdings only contribute actual fees', () => {
  assert.deepEqual(model.netCurve([]), {points: [], gross: 0, fees: 0, net: 0, count: 0});
  assert.equal(model.netCurve([{direction: 'long', fills: [{bar: 0, change: 1, price: 100, fee: 5}]}]).net, -5);
});
test('curve rejects invalid timestamps and unsafe accumulated cents', () => {
  assert.throws(() => model.netCurve([{direction: 'long', fills: [{change: 1, price: 100, fee: 1}]}]), /time/);
  const sample = {direction: 'long', fills: [{bar: 0, change: 1, price: 100, fee: Number.MAX_SAFE_INTEGER}]};
  assert.throws(() => model.netCurve([sample, sample]), /safe integer/);
});
test('fill notes are isolated by index and legacy empty values remain usable', () => {
  assert.deepEqual(model.sanitizeFillNotes(null, 2), ['', '']);
  assert.deepEqual(model.sanitizeFillNotes(['first', 99, 'third', 'extra'], 3), ['first', '', 'third']);
  assert.equal(model.sanitizeFillNotes(['x'.repeat(3000)], 1)[0].length, 2000);
});
