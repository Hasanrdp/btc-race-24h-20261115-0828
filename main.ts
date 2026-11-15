// Panic-dip reversal bot for btc-race-24h-20261115-0828.
//
// Idea: cbBTC mean-reverts after sharp intraday panics. On the frozen dev window
// (1,440 one-minute bars, BTC falling ~4% overall) the only reliably profitable
// pattern was buying a sharp short-term drop and riding the bounce back, while
// trend-following (EMA cross) and Bollinger mean reversion both lost money to
// whipsaw and round-trip costs (~26 bps a trade). So this bot trades rarely and
// only on a clear panic, then lets the bounce run.
//
//   - Entry, on a bar's close: the close is at least 2% below the close 45 bars
//     earlier (a 45-minute panic drop) AND at least 2% below the close 120 bars
//     earlier (the drop is deep, not just a fast wobble inside a flat range).
//     The second filter is what keeps the bot out of the early-dip trap: on the
//     dev window it skips the buy that would have lost ~$15 and keeps the buys
//     that catch the real bounces. It buys with all of its cash (one open
//     position at most, long only).
//   - Exit, the whole position, on a later bar's close:
//       * hard stop: the position is worth 1.2% less than its cost;
//       * take-profit: the position is worth 5% more than its cost (the dev
//         window's big bounce runs +5.4% peak to trough, so a 5% target banks
//         the meat of it instead of giving it back to the pullback);
//       * trailing stop: once the position is 0.6% in profit, the close falls
//         0.5% below the highest close since entry (arming the trail only above
//         +0.6% lets a small bounce breathe instead of being cut off by the
//         first 0.5% wiggle; below +0.6% only the hard stop can sell);
//       * time stop: 360 bars (6 hours) after the entry was first observed.
//     After any exit the bot sits out the next 30 bars: a stop-out means the
//     panic is still unfolding, and buying straight back into the same falling
//     move risks a second loss on the same dip, so it waits for the dust to
//     settle before the entry rule can fire again.
//   - Each order caps slippage at 200 bps past the close it was decided on, so a
//     fill into a sudden gap is refused and retried on the next bar instead.
//   - No network, no wall clock, no randomness: every order is a pure function of
//     the bars seen so far, so two runs on the same data produce the same orders.
//
// Verified with the kit's own grade-local on the published dev window:
// net PnL +$56.43 on $1,000, 4 trades (2 round trips), max drawdown 1.37%,
// deterministic (two runs reproduce byte for byte). The two round trips:
// buy bar 824 @ $63,372 -> sell bar 953 @ $64,165 (+$7.44), and buy bar 1036
// @ $62,102 -> sell bar 1113 @ $65,480 (+$49.41, take-profit at +5%).
// Neighbouring parameters stay in the top-10 range (trail 0.48-0.6%,
// take-profit 4.5-5.1%, trail-arm 0.6-0.9%, long-drop 120 bars 1.8-2.2%),
// but the 45-bar lookback is the sensitive one (44 bars: +$41, 46 bars: +$24),
// so the entry timing is tuned to this window's two dips and may not repeat
// on the unseen race window.

import { runBars, type BarsState, type Batch, type BuyInput, type SellInput } from './vendor/makefun-bars.ts';

const SYMBOL = 'CBBTC';
/** Entry: the close must be this far below the close LOOKBACK bars earlier. */
const LOOKBACK_BARS = 45;
const DROP_BPS = 200;
/** Entry depth filter: the close must also be this far below the close this many bars earlier. */
const LONG_LOOKBACK_BARS = 120;
const LONG_DROP_BPS = 200;
/** Hard stop: sell when the position is worth this far under its cost. */
const STOP_BPS = 120;
/** Take-profit: sell when the position is worth this far over its cost. */
const TAKE_PROFIT_BPS = 500;
/** Trailing stop: once in profit, sell on this pullback from the peak close since entry. */
const TRAIL_BPS = 50;
/** Trailing-stop arming: the trail only fires once the position is this far in profit. */
const TRAIL_ARM_BPS = 60;
/** Time stop: sell this many bars after the entry was first observed. */
const MAX_HOLD_BARS = 360;
/** Re-entry cooldown: bars to sit out after any exit before buying again. */
const COOLDOWN_BARS = 30;
/** Slippage cap on every order, in bps past the close the order was decided on. */
const MAX_SLIPPAGE_BPS = 200;

/** Closes of CBBTC seen so far, as numbers (raw price units, price_scale 5). */
const closes: number[] = [];
/** Bar index (in closes[]) where the current position was first observed, or -1. */
let entryIndex = -1;
/** Highest close since the current position was first observed. */
let peakClose = 0;
/** Bar index (in closes[]) before which no new entry is allowed, or -1. */
let cooldownUntil = -1;

function recordClose(state: BarsState): number | null {
  const bar = state.latest.get(SYMBOL);
  if (bar === undefined) return null;
  const c = Number(bar.c);
  closes.push(c);
  return c;
}

await runBars({
  onBatch(state: BarsState, batch: Batch) {
    const close = recordClose(state);
    // While warming up every order would be rejected (warmup): build history only.
    if (close === null || state.warmingUp) return [];

    const held = state.positions.get(SYMBOL);
    if (held !== undefined) {
      // A position is present: anchor the entry on first sight, then manage it.
      const idx = closes.length - 1;
      if (entryIndex < 0) {
        entryIndex = idx;
        peakClose = close;
      } else if (close > peakClose) {
        peakClose = close;
      }
      const value = state.value(SYMBOL, held.qty);
      const cost = held.cost;
      // Hard stop: worth 1.2% under its cost.
      if (value * 10000n <= cost * BigInt(10000 - STOP_BPS)) {
        entryIndex = -1;
        cooldownUntil = idx + COOLDOWN_BARS;
        return [{ side: 'sell', symbol: SYMBOL, qty: held.qty, max_slippage_bps: MAX_SLIPPAGE_BPS } satisfies SellInput];
      }
      // Time stop: held 360 bars.
      if (idx - entryIndex >= MAX_HOLD_BARS) {
        entryIndex = -1;
        cooldownUntil = idx + COOLDOWN_BARS;
        return [{ side: 'sell', symbol: SYMBOL, qty: held.qty, max_slippage_bps: MAX_SLIPPAGE_BPS } satisfies SellInput];
      }
      // Take-profit: worth 5% over its cost.
      if (value * 10000n >= cost * BigInt(10000 + TAKE_PROFIT_BPS)) {
        entryIndex = -1;
        cooldownUntil = idx + COOLDOWN_BARS;
        return [{ side: 'sell', symbol: SYMBOL, qty: held.qty, max_slippage_bps: MAX_SLIPPAGE_BPS } satisfies SellInput];
      }
      // Trailing stop: armed only once 0.6% in profit, then 0.5% below the peak close since entry.
      if (value * 10000n > cost * BigInt(10000 + TRAIL_ARM_BPS) && close * 10000 <= peakClose * (10000 - TRAIL_BPS)) {
        entryIndex = -1;
        cooldownUntil = idx + COOLDOWN_BARS;
        return [{ side: 'sell', symbol: SYMBOL, qty: held.qty, max_slippage_bps: MAX_SLIPPAGE_BPS } satisfies SellInput];
      }
      return [];
    }

    // Flat: no position to manage; a rejected buy leaves nothing behind.
    entryIndex = -1;
    // Cooling down after an exit: do not buy back into the same falling move.
    if (closes.length - 1 < cooldownUntil) return [];
    if (closes.length <= LONG_LOOKBACK_BARS) return [];
    const now = closes[closes.length - 1];
    const then = closes[closes.length - 1 - LOOKBACK_BARS];
    if (now * 10000 > then * (10000 - DROP_BPS)) return [];
    // Depth filter: the drop must also be deep over 120 bars, not a fast wobble.
    const longThen = closes[closes.length - 1 - LONG_LOOKBACK_BARS];
    if (now * 10000 > longThen * (10000 - LONG_DROP_BPS)) return [];
    // Panic dip: buy with all the cash on hand.
    const cash = state.cash;
    if (cash < BigInt(state.hello.fees.min_notional_quote_units)) return [];
    const byWeight = (BigInt(state.hello.caps.max_weight_bps) * state.equity) / 10000n;
    const notional = cash < byWeight ? cash : byWeight;
    if (notional < BigInt(state.hello.fees.min_notional_quote_units)) return [];
    return [{ side: 'buy', symbol: SYMBOL, notional_quote_units: notional, max_slippage_bps: MAX_SLIPPAGE_BPS } satisfies BuyInput];
  },
});
