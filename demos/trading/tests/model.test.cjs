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
