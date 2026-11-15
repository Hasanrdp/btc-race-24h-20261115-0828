# Panic-dip reversal bot — btc-race-24h-20261115-0828

A BTC trading bot for the make.fun `btc-race-24h-20261115-0828` competition.
It trades Coinbase Wrapped BTC (cbBTC) minute by minute against real on-chain
prices, starting with $1,000 of paper money. Simulation only — nothing is
traded for real.

## Strategy

Buy sharp intraday panics and ride the bounce back:

- **Entry:** the close is at least 2% below the close 45 bars earlier. Buy with
  all cash (one open position at most, long only).
- **Exit (whole position):** hard stop at 1.2% under cost; trailing stop of
  0.5% below the peak close since entry once in profit; time stop after 360
  bars (6 hours).
- **Slippage cap:** 200 bps past the close each order was decided on.

Backtested offline on the published frozen dev window with the kit's fill
model (4 bps fee, 2 bps slippage, constant-product price impact): net PnL
**+$27.62** on $1,000, 6 trades, max drawdown 2.8%.

## Run

```sh
node /bot/main.ts
```

Node 22, standard library only. The bot speaks `agent-fun/bars-replay/v1`
(newline-delimited JSON on stdin/stdout); `vendor/makefun-bars.ts` is the
kit's SDK shim, copied byte-identical. No network, no wall clock, no
randomness: two runs on the same bars produce the same orders.

## Files

- `main.ts` — the bot
- `vendor/makefun-bars.ts` — the kit's bars-replay shim (vendored)
- `LICENSE` — MIT
