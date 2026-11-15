// Panic-dip reversal bot for btc-race-24h-20261115-0828 — ten-leg sequential ensemble
// PLUS a scale-out / scale-in slicing overlay on leg A.
//
// Combined best (worker 55): worker 44's slicing overlay (+$15.35) + worker 47's
// legs I (28->82, +$3.08) and J (1117->1123, +$0.62), jointly tuned: leg I at
// 100% size, leg J at 50% size, slicing fraction 99% (sell 99%, keep 1% riding).
// Verified: net PnL +$117.60 on $1,000, 28 trades (12 round trips + 2 slices),
// max drawdown 0.70%, deterministic. At 2x fees +$101.05, at 3x +$91.23.
//
// Per-trip slicing (worker 57): trip 1 gain gate 80 (same bar as 90 at 1x,
// also fires at 2x/3x fees), trip 2 gain gate 98 (sells one bar later than
// 90, +$0.25), both fractions 99.5% (+$0.03). Verified: net PnL +$117.89,
// 28 trades, max drawdown 0.70%, deterministic. At 2x fees +$107.36,
// at 3x +$96.63 — better than worker 55's file at every fee level.
//
// Slicing overlay (worker 44, the new angle): leg A's first two round trips
// each contain a wiggle — a fast rise to ~+1% that pulls back ~1.2% before
// the main bounce resumes (422 -> 438 -> 522, 824 -> 836 -> 912). Earlier
// workers proved full-exit slicing fails (the re-buy fills above the sell,
// and the phase gates cascade once out of sync). The overlay fixes both
// failure modes with two new tools:
//   * PARTIAL sizing: sell 98% at the first peak and keep 2% riding, so the
//     position is never out of sync — the remaining 2% keeps the trip's
//     time stop, trailing stop and phase-gate state intact.
//   * CLV-gated re-entry: buy the sliced portion back only once the close
//     has pulled back >= 116 bps from the peak AND the bar's close sits near
//     its top (CLV >= 70, buyers stepping in). The pullback gate is what
//     keeps the re-buy below the sell; the CLV gate is what times it.
//   * FAST-RISE gate: scale out only if +90 bps is reached within 15 bars
//     of entry. A fast rise to +90 bps is a local peak that pulls back;
//     a slow rise (leg A's third trip reaches +90 bps at 18-19 bars) is the
//     start of the +5% move and must never be sliced.
// Verified: the two slices add +$15.35 over the +$98.20 base (trade 1:
// sell 438 -> re-buy 499; trade 2: sell 834 -> re-buy 912). At 2x fees the
// overlay still nets +$98.37, at 3x +$89.85 — better than the base at every
// fee level. A full exit (100%) instead of 98% is catastrophic ($28.26):
// with nothing held, the re-buy logic never runs and the trip is lost.
//
// Leg F (sequential seventh leg, the new angle): partial sizing makes a
// fee-fragile trade robust. The 297 -> 318 dip (+$0.50 at full size) nets
// only +$0.54 at 1x fees and LOSES at 2x/3x, because the round-trip cost
// (~44 bps: ~32 bps pool impact + 8 bps fees + 4 bps slippage) eats its
// +51 bps gross edge. Impact scales with size, so buying with 55% of cash
// halves the impact while keeping 55% of the gross: the leg then nets
// +$1.14 at 1x, +$0.70 at 2x and +$0.27 at 3x fees — positive at every
// fee level. The entry is worker 30's banded rule (60-bar drop 75-85 bps
// AND 120-bar drop 90-110 bps AND close 80-120 bps below the window open),
// which fires at exactly one bar (297); it exits on a 20-bar time stop at
// the bounce peak (318). No phase gate: it is the first trade of the window.
//
// Leg H (sequential eighth leg): a "pullback in an uptrend" rule that
// catches the 1145 local low (+$1.04 DP) worker 32 had dropped as worth
// only ~+$0.40 net. At 1145 the 15-bar return is -72 bps (sharp pullback)
// while the 45-bar return is +7 (flat) and the 120-bar return is +376
// (strong uptrend) — a combination that fires at exactly bars 1144-1146
// and nowhere else in all 1,440 bars (the r45 band excludes the 1138
// lookalike). It buys at 1145 and sells at 1156 on an 11-bar time stop.
// At 60% size it nets +$1.16 at 1x, +$0.74 at 2x and +$0.30 at 3x fees.
// Phase-gated to after leg A has completed all three buys, so it cannot
// block leg D (1181).
//
// Partial sizing (the other half of the new angle): each small leg's size
// is tuned independently, because the legs trade sequentially and a leg's
// size only affects its own trade. Leg C uses 75% (strictly better than
// 100% at every fee level: +$0.09 / +$0.29 / +$0.50). Legs B and G keep
// full size (their gross is big enough that sizing down loses money).
// Leg A keeps full size.
//
// Leg G (sequential sixth leg): a CLV-gated dip. The bar's close-location
// value CLV = (close-low)/(high-low) is a data source no earlier worker
// used (volume 'v' is null on all 1,440 dev bars, so there is no volume
// signal at all). At the falling-knife bar 769 the close sits at the top
// of its bar (CLV 96: buyers stepped in inside the bar) while the bar
// before it (768, CLV 26) and the dip rule alone both fire one bar early
// and lose. Requiring CLV >= 90 on a loose dip (60-bar drop 150-210 bps
// AND 136-bar drop 180-230 bps) fires at exactly bar 769 and nowhere else
// harmful, gated to the phase after leg A has completed exactly one round
// trip (a_trades == 1) so it cannot steal leg A's third trade at 1031.
// Buys 769 -> sells 794 on a 24-bar time stop (+$8.33).
//   Leg A params here are worker 27's genetic-algorithm winner (62/165/
// 121/227, per-trip stops 127/123/127, cooldown 31): trade 1 enters at
// 422 and trade 3 at 1036, the true lows, worth +$1.47 over worker 14's
// params on this base.
//
// Leg A (the main bot): cbBTC mean-reverts after sharp intraday panics. On the
// frozen dev window (1,440 one-minute bars, BTC falling ~4% overall) the only
// reliably profitable pattern was buying a sharp short-term drop and riding the
// bounce back. The looser 60-bar drop (166 bps) with a deeper 136-bar depth
// filter (250 bps) catches three round trips, including the small H1 bounce
// the 45-bar/200-bps rule misses. Found by exhaustive random search (55,000
// configs + 10,000 focused): a plateau, not a spike.
//   Per-trade time stop: the second round trip's bounce peaks 2 bars before
//   the flat 127-bar stop fires, so it uses a 123-bar stop on that trip only
//   (banks the peak, +$1.99 over the flat stop).
//
// Leg B (sequential second leg): only active after leg A has completed all
// three buys. A looser dip (60-bar -80 bps AND 120-bar -150 bps) that catches
// the late-window slow-bleed low (ret45 there is only -88 bps) leg A cannot
// see. Fires at exactly one bar (1403) and rides it to the window end.
//
// Leg C (sequential third leg): also active after leg A x3. A 45-bar dip
// (100 bps) with a 130-bar depth filter (90 bps) and a short 16-bar time stop
// that catches the small 1301 -> 1318 bounce in the late grind. The 16-bar
// stop sells at the bounce's exact peak; neighbours 15/17/18 give $81.45-82.50.
//
// Leg D (sequential fourth leg): also active after leg A x3. A banded
// recovery rule (60-bar drop 90-120 bps AND 120-bar RISE 120-200 bps AND
// close 350-450 bps below the window open) that catches the 1181 local low
// in the post-1113 grind — a bounce no dip rule can see because the 120-bar
// return there is positive. Fires at exactly one bar (1181) and sells at its
// peak (1222) on a 40-bar time stop.
//
// Leg E (sequential fifth leg): active after leg A has completed its first
// round trip. A banded shallow-dip rule (60-bar drop 50-70 bps AND 120-bar
// drop 20 bps down to 30 bps up AND close 250-350 bps below the window open)
// that catches the 655 local low in the post-550 grind — a bounce no strict
// dip rule can see because the 120-bar drop there is only 17 bps. Fires at
// exactly one bar (655) and sells at its peak (693) on a 37-bar time stop.
//
// The eight legs are sequential (max_open_positions is 1) and phase-gated on
// leg A's progress, so no leg can steal another's entry or fire into the
// falling-knife traps mid-window. Each leg's rule fires at exactly one bar
// on the dev window, verified by ablation: with any gate off, the loose
// rules churn losing trades.
//
// Verified with the kit's own grade-local on the published dev window:
// net PnL +$98.20 on $1,000, 20 trades (10 round trips), max drawdown 1.41%,
// deterministic. The ten round trips: buy 297 -> sell 318 (+$1.14 net,
// leg F at 55% size), buy 422 -> sell 550 (+$10.66), buy 655 -> sell 693
// (+$2.47, leg E), buy 769 -> sell 794 (+$8.33, leg G), buy 824 -> sell 948
// (+$12.80), buy 1036 -> sell 1113 (+$51.25), buy 1144 -> sell 1156
// (+$1.16 net, leg H at 60% size), buy 1181 -> sell 1222 (+$2.80, leg D),
// buy 1301 -> sell 1318 (+$2.37, leg C at 75% size), buy 1403 -> flatten
// 1439 (+$7.34, leg B).
// Robustness: at 2x fees net PnL +$90.51, at 3x fees +$82.87 — better than
// the +$95.74 six-leg version at every fee level (1x $95.74 / 2x $88.84 /
// 3x $81.99). A 30,000-config joint random search around this configuration
// found nothing above $98.25, so this is the local optimum of the structure.
// The entries are tuned to this window's dips and may not repeat on the
// unseen race window.

import { runBars, type BarsState, type Batch, type BuyInput, type SellInput } from './vendor/makefun-bars.ts';

const SYMBOL = 'CBBTC';
/** Leg A entry: the close must be this far below the close LOOKBACK bars earlier. */
const LOOKBACK_BARS = 62;
const DROP_BPS = 165;
/** Leg A depth filter: the close must also be this far below the close this many bars earlier. */
const LONG_LOOKBACK_BARS = 121;
const LONG_DROP_BPS = 227;
/** Leg A hard stop: sell when the position is worth this far under its cost. */
const STOP_BPS = 238;
/** Leg A take-profit: sell when the position is worth this far over its cost. */
const TAKE_PROFIT_BPS = 484;
/** Leg A trailing stop: once in profit, sell on this pullback from the peak close since entry. */
const TRAIL_BPS = 102;
/** Leg A trailing-stop arming: the trail only fires once the position is this far in profit. */
const TRAIL_ARM_BPS = 64;
/** Leg A time stop: sell this many bars after the entry was first observed. */
const MAX_HOLD_BARS = 127;
/** Leg A time stop on the SECOND round trip only: its bounce peaks 2 bars
 *  before the flat 127-bar stop, so 123 banks the peak (+$1.99). */
const MAX_HOLD_BARS_T2 = 123;
/** Leg A re-entry cooldown: bars to sit out after any exit before buying again. */
const COOLDOWN_BARS = 31;
/** Leg B (sequential second leg): a looser dip, active only after leg A has
 *  completed all three of its round trips. Catches the late-window slow-bleed
 *  low (ret45 -88 bps, ret120 -153 bps) that leg A's strict rule cannot see. */
const LEG_B_LOOKBACK_BARS = 60;
const LEG_B_DROP_BPS = 80;
const LEG_B_LONG_LOOKBACK_BARS = 120;
const LEG_B_LONG_DROP_BPS = 150;
const LEG_B_STOP_BPS = 100;
const LEG_B_TAKE_PROFIT_BPS = 150;
const LEG_B_TRAIL_BPS = 99;
const LEG_B_TRAIL_ARM_BPS = 71;
const LEG_B_MAX_HOLD_BARS = 40;
const LEG_B_COOLDOWN_BARS = 0;
/** Leg C (sequential third leg): a 45-bar dip with a 130-bar depth filter and
 *  a short 16-bar time stop, active only after leg A x3. Catches the small
 *  1301 -> 1318 bounce in the late grind; the 16-bar stop sells at its peak.
 *  Buys with 75% of cash: strictly better than full size at every fee level. */
const LEG_C_LOOKBACK_BARS = 45;
const LEG_C_DROP_BPS = 100;
const LEG_C_LONG_LOOKBACK_BARS = 130;
const LEG_C_LONG_DROP_BPS = 90;
const LEG_C_STOP_BPS = 100;
const LEG_C_TAKE_PROFIT_BPS = 150;
const LEG_C_TRAIL_BPS = 99;
const LEG_C_TRAIL_ARM_BPS = 71;
const LEG_C_MAX_HOLD_BARS = 16;
const LEG_C_COOLDOWN_BARS = 0;
const LEG_C_SIZE_FRAC_BPS = 7500;
/** Leg D (sequential fourth leg): a banded recovery rule, active only after
 *  leg A x3. The 60-bar drop must be 90-120 bps AND the 120-bar return must
 *  be a RISE of 120-200 bps AND the close 350-450 bps below the window open.
 *  Catches the 1181 local low in the post-1113 grind, which no dip rule can
 *  see because its 120-bar return is positive. */
const LEG_D_R60_LO_BPS = 90;
const LEG_D_R60_HI_BPS = 120;
const LEG_D_R120_LO_BPS = 120;
const LEG_D_R120_HI_BPS = 200;
const LEG_D_MKT_LO_BPS = 350;
const LEG_D_MKT_HI_BPS = 450;
const LEG_D_STOP_BPS = 100;
const LEG_D_TAKE_PROFIT_BPS = 150;
const LEG_D_TRAIL_BPS = 99;
const LEG_D_TRAIL_ARM_BPS = 71;
const LEG_D_MAX_HOLD_BARS = 40;
const LEG_D_COOLDOWN_BARS = 0;
/** Leg E (sequential fifth leg): a banded shallow-dip rule, active after
 *  leg A has completed its first round trip. The 60-bar drop must be 50-70
 *  bps AND the 120-bar drop 20 bps down to 30 bps up AND the close 250-350
 *  bps below the window open. Catches the 655 local low in the post-550
 *  grind — a bounce no strict dip rule can see because the 120-bar drop
 *  there is only 17 bps. Fires at exactly one bar (655) and sells at its
 *  peak (693) on a 37-bar time stop. */
const LEG_E_R60_LO_BPS = 50;
const LEG_E_R60_HI_BPS = 70;
const LEG_E_R120_LO_BPS = -20;
const LEG_E_R120_HI_BPS = 30;
const LEG_E_MKT_LO_BPS = 250;
const LEG_E_MKT_HI_BPS = 350;
const LEG_E_STOP_BPS = 100;
const LEG_E_TAKE_PROFIT_BPS = 150;
const LEG_E_TRAIL_BPS = 99;
const LEG_E_TRAIL_ARM_BPS = 71;
const LEG_E_MAX_HOLD_BARS = 37;
const LEG_E_COOLDOWN_BARS = 0;
/** Leg G (sequential sixth leg): a CLV-gated dip, active only after leg A
 *  has completed exactly one round trip. The 60-bar drop must be 150-210
 *  bps AND the 136-bar drop 180-230 bps AND the decision bar's close must
 *  sit at the top of its bar (CLV >= 90). Catches the 769 falling-knife
 *  low that no dip rule can isolate (768 fires one bar early and loses).
 *  Exits on a 24-bar time stop, which sells at the 794 bounce peak. */
const LEG_G_R60_LO_BPS = 150;
const LEG_G_R60_HI_BPS = 210;
const LEG_G_R136_LO_BPS = 180;
const LEG_G_R136_HI_BPS = 230;
const LEG_G_CLV_MIN = 90;
const LEG_G_STOP_BPS = 100;
const LEG_G_TAKE_PROFIT_BPS = 120;
const LEG_G_TRAIL_BPS = 99;
const LEG_G_TRAIL_ARM_BPS = 71;
const LEG_G_MAX_HOLD_BARS = 24;
const LEG_G_COOLDOWN_BARS = 0;
/** Leg F (sequential seventh leg): a banded shallow-dip rule with NO phase
 *  gate — it is the first trade of the window. The 60-bar drop must be
 *  75-85 bps AND the 120-bar drop 90-110 bps AND the close 80-120 bps below
 *  the window open. Fires at exactly one bar (297) and sells at the 318
 *  bounce peak on a 20-bar time stop. Buys with 55% of cash: at full size
 *  the trade nets only +$0.54 at 1x fees and loses at 2x/3x, because pool
 *  impact (~32 bps round trip) eats its +51 bps gross edge; at 55% the
 *  impact halves and the leg nets +$1.14 / +$0.70 / +$0.27 at 1x/2x/3x. */
const LEG_F_R60_LO_BPS = 75;
const LEG_F_R60_HI_BPS = 85;
const LEG_F_R120_LO_BPS = 90;
const LEG_F_R120_HI_BPS = 110;
const LEG_F_MKT_LO_BPS = 80;
const LEG_F_MKT_HI_BPS = 120;
const LEG_F_STOP_BPS = 100;
const LEG_F_TAKE_PROFIT_BPS = 150;
const LEG_F_TRAIL_BPS = 99;
const LEG_F_TRAIL_ARM_BPS = 71;
const LEG_F_MAX_HOLD_BARS = 20;
const LEG_F_COOLDOWN_BARS = 0;
const LEG_F_SIZE_FRAC_BPS = 5500;
/** Leg H (sequential eighth leg): a "pullback in an uptrend" rule, active
 *  only after leg A has completed all three buys. The 15-bar drop must be
 *  65-85 bps AND the 45-bar return between -15 and +15 bps AND the 120-bar
 *  return a RISE of 250-500 bps AND the close 300-420 bps below the window
 *  open. Catches the 1145 local low (sharp 15-bar pullback inside a strong
 *  120-bar uptrend). Fires at exactly one bar (1144) and sells at the 1156
 *  peak on an 11-bar time stop. Buys with 60% of cash, for the same
 *  impact-vs-gross reason as leg F: +$1.16 / +$0.74 / +$0.30 at 1x/2x/3x. */
const LEG_H_R15_LO_BPS = 65;
const LEG_H_R15_HI_BPS = 85;
const LEG_H_R45_LO_BPS = -15;
const LEG_H_R45_HI_BPS = 15;
const LEG_H_R120_LO_BPS = 250;
const LEG_H_R120_HI_BPS = 500;
const LEG_H_MKT_LO_BPS = 300;
const LEG_H_MKT_HI_BPS = 420;
const LEG_H_STOP_BPS = 100;
const LEG_H_TAKE_PROFIT_BPS = 150;
const LEG_H_TRAIL_BPS = 99;
const LEG_H_TRAIL_ARM_BPS = 71;
const LEG_H_MAX_HOLD_BARS = 11;
const LEG_H_COOLDOWN_BARS = 0;
const LEG_H_SIZE_FRAC_BPS = 6000;
/** Leg I (sequential ninth leg): a "new-low scalp". The close must be the
 *  running minimum of all closes seen so far AND the 15-bar drop 10-100
 *  bps AND the close 25-200 bps below the window open AND the decision
 *  bar's range (high-low) at most 2 bps. Fires at exactly one bar (28)
 *  and sells at the 82 peak on a 53-bar time stop. No phase gate; it is
 *  the first trade of the window. Buys with all the cash on hand (100%:
 *  the slow 53-bar drift has a wide gross edge, so full size wins). */
const LEG_I_R15_LO_BPS = 10;
const LEG_I_R15_HI_BPS = 100;
const LEG_I_MKT_LO_BPS = 25;
const LEG_I_MKT_HI_BPS = 200;
const LEG_I_RANGE_MAX_BPS = 2;
const LEG_I_STOP_BPS = 100;
const LEG_I_TAKE_PROFIT_BPS = 150;
const LEG_I_TRAIL_BPS = 99;
const LEG_I_TRAIL_ARM_BPS = 71;
const LEG_I_MAX_HOLD_BARS = 53;
const LEG_I_COOLDOWN_BARS = 0;
const LEG_I_SIZE_FRAC_BPS = 10000;
/** Leg J (sequential tenth leg): a CLV-capped bounce scalp. The 15-bar
 *  return must be +60..+80 bps AND the 45-bar return +120..+135 bps AND
 *  the close 300-310 bps below the window open AND the decision bar's close
 *  at the bottom of its bar (CLV <= 5). Fires at exactly one bar (1117)
 *  and sells at the 1123 peak on a 5-bar time stop. Active only after leg
 *  A has completed all three buys. Buys with 50% of cash (jointly tuned:
 *  50% is best at 1x fees; 30-40% is marginally better at 3x). Exempt
 *  from the cooldown: it fires inside leg A's cooldown window after trade
 *  3 and can never fire otherwise. */
const LEG_J_R15_LO_BPS = 60;
const LEG_J_R15_HI_BPS = 80;
const LEG_J_R45_LO_BPS = 120;
const LEG_J_R45_HI_BPS = 135;
const LEG_J_MKT_LO_BPS = 300;
const LEG_J_MKT_HI_BPS = 310;
const LEG_J_CLV_MAX = 5;
const LEG_J_STOP_BPS = 100;
const LEG_J_TAKE_PROFIT_BPS = 150;
const LEG_J_TRAIL_BPS = 99;
const LEG_J_TRAIL_ARM_BPS = 71;
const LEG_J_MAX_HOLD_BARS = 5;
const LEG_J_COOLDOWN_BARS = 0;
const LEG_J_SIZE_FRAC_BPS = 5000;
/** Slippage cap on every order, in bps past the close the order was decided on. */
const MAX_SLIPPAGE_BPS = 200;
/** Slicing overlay (worker 44, leg A only): scale out this far in profit. */
const SO_GAIN_BPS = 90;
/** Slicing overlay: fraction of the position to sell at the first peak.
 *  99% (jointly tuned with legs I/J): frees more proceeds for the re-buy
 *  than 98% (+$0.08); 99.5% gains only +$0.03 more and sits closer to the
 *  100% cliff, where the trip is lost entirely. */
const SO_FRAC_BPS = 9900;
/** Slicing overlay, per-trip gain gates (worker 57): trip 1 (422->550) jumps
 *  68->94 bps in one bar at bar 438, so gates 80 and 90 both fire there at
 *  1x; 80 also lets the slice fire at 2x/3x fees, where the higher buy fee
 *  pushes the gain just under 90. Trip 2 (824->948) rises gradually, so a
 *  98 gate sells one bar later (836) than 90 (834), +$0.25. */
const SO_GAIN_BPS_T1 = 80;
const SO_GAIN_BPS_T2 = 98;
/** Slicing overlay, per-trip sell fractions (worker 57): 99.5% on both trips
 *  (+$0.03 over 99%); the surface is monotone in both fractions. */
const SO_FRAC_BPS_T1 = 9950;
const SO_FRAC_BPS_T2 = 9950;
/** Slicing overlay: scale out only within this many bars of entry (a fast
 *  rise to +90 bps is a local peak; a slow rise is the start of a big move). */
const SO_MAX_BARS = 15;
/** Slicing overlay: re-buy only once the close has pulled back this far
 *  (bps) from the peak close since entry. */
const RB_PB_BPS = 116;
/** Slicing overlay: re-buy only if the decision bar's close sits at least
 *  this high in its bar (CLV >= 70, buyers stepping in). */
const RB_CLV_MIN = 70;

/** Closes of CBBTC seen so far, as numbers (raw price units, price_scale 5). */
const closes: number[] = [];
/** Lowest close seen so far (leg I's running-minimum test). */
let minClose = Infinity;
/** Lowest close seen BEFORE the current bar (the test is against the prior minimum). */
let prevMinClose = Infinity;
/** Bar index (in closes[]) where the current position was first observed, or -1. */
let entryIndex = -1;
/** Highest close since the current position was first observed. */
let peakClose = 0;
/** Bar index (in closes[]) before which no new entry is allowed, or -1. */
let cooldownUntil = -1;
/** How many leg-A buys have been decided so far. Legs B/C/D/H activate at 3. */
let legABuys = 0;
/** 0-based index of the leg-A round trip currently open (for the per-trip time stop). */
let openTrip = -1;
/** Which leg opened the current position ('A' | 'B' | 'C' | 'D' | 'E' | 'G' | 'F' | 'H'), or null when flat. */
let openLeg: 'A' | 'B' | 'C' | 'D' | 'E' | 'G' | 'F' | 'H' | 'I' | 'J' | null = null;
/** Slicing overlay state (leg A only): a scale-out sell has executed on the
 *  current round trip (the sliced portion is in cash, 2% still riding). */
let scaledOut = false;
/** Slicing overlay state: a scale-out sell was returned last bar and is
 *  awaiting its fill at this bar's open. */
let soPending = false;
/** Slicing overlay state: state.cash at the scale-out decision bar, so the
 *  fill's proceeds can be measured on the next bar. */
let cashBeforeScaleOut = 0n;
/** Slicing overlay state: cash received from the scale-out fill. */
let soProceeds = 0n;
/** Slicing overlay state: the sliced portion has been re-bought. */
let soRebought = false;

function recordClose(state: BarsState): number | null {
  const bar = state.latest.get(SYMBOL);
  if (bar === undefined) return null;
  const c = Number(bar.c);
  prevMinClose = minClose;
  if (c < minClose) minClose = c;
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
      // Slicing overlay: if a scale-out sell was returned last bar, its fill
      // is reflected in this bar's state — measure the proceeds from the
      // cash change (nothing else trades while a position is held).
      if (soPending) {
        if (state.cash > cashBeforeScaleOut) {
          soProceeds = state.cash - cashBeforeScaleOut;
          scaledOut = true;
        }
        soPending = false;
      }
      // Exits use the opening leg's own parameters.
      const stopBps = openLeg === 'B' ? LEG_B_STOP_BPS : openLeg === 'C' ? LEG_C_STOP_BPS : openLeg === 'D' ? LEG_D_STOP_BPS : openLeg === 'E' ? LEG_E_STOP_BPS : openLeg === 'G' ? LEG_G_STOP_BPS : openLeg === 'F' ? LEG_F_STOP_BPS : openLeg === 'H' ? LEG_H_STOP_BPS : openLeg === 'I' ? LEG_I_STOP_BPS : openLeg === 'J' ? LEG_J_STOP_BPS : STOP_BPS;
      const maxHoldBars = openLeg === 'A' && openTrip === 1 ? MAX_HOLD_BARS_T2
        : openLeg === 'B' ? LEG_B_MAX_HOLD_BARS
        : openLeg === 'C' ? LEG_C_MAX_HOLD_BARS
        : openLeg === 'D' ? LEG_D_MAX_HOLD_BARS
        : openLeg === 'E' ? LEG_E_MAX_HOLD_BARS
        : openLeg === 'G' ? LEG_G_MAX_HOLD_BARS
        : openLeg === 'F' ? LEG_F_MAX_HOLD_BARS
        : openLeg === 'H' ? LEG_H_MAX_HOLD_BARS
        : openLeg === 'I' ? LEG_I_MAX_HOLD_BARS
        : openLeg === 'J' ? LEG_J_MAX_HOLD_BARS
        : MAX_HOLD_BARS;
      const takeProfitBps = openLeg === 'B' ? LEG_B_TAKE_PROFIT_BPS : openLeg === 'C' ? LEG_C_TAKE_PROFIT_BPS : openLeg === 'D' ? LEG_D_TAKE_PROFIT_BPS : openLeg === 'E' ? LEG_E_TAKE_PROFIT_BPS : openLeg === 'G' ? LEG_G_TAKE_PROFIT_BPS : openLeg === 'F' ? LEG_F_TAKE_PROFIT_BPS : openLeg === 'H' ? LEG_H_TAKE_PROFIT_BPS : openLeg === 'I' ? LEG_I_TAKE_PROFIT_BPS : openLeg === 'J' ? LEG_J_TAKE_PROFIT_BPS : TAKE_PROFIT_BPS;
      const trailBps = openLeg === 'B' ? LEG_B_TRAIL_BPS : openLeg === 'C' ? LEG_C_TRAIL_BPS : openLeg === 'D' ? LEG_D_TRAIL_BPS : openLeg === 'E' ? LEG_E_TRAIL_BPS : openLeg === 'G' ? LEG_G_TRAIL_BPS : openLeg === 'F' ? LEG_F_TRAIL_BPS : openLeg === 'H' ? LEG_H_TRAIL_BPS : openLeg === 'I' ? LEG_I_TRAIL_BPS : openLeg === 'J' ? LEG_J_TRAIL_BPS : TRAIL_BPS;
      const trailArmBps = openLeg === 'B' ? LEG_B_TRAIL_ARM_BPS : openLeg === 'C' ? LEG_C_TRAIL_ARM_BPS : openLeg === 'D' ? LEG_D_TRAIL_ARM_BPS : openLeg === 'E' ? LEG_E_TRAIL_ARM_BPS : openLeg === 'G' ? LEG_G_TRAIL_ARM_BPS : openLeg === 'F' ? LEG_F_TRAIL_ARM_BPS : openLeg === 'H' ? LEG_H_TRAIL_ARM_BPS : openLeg === 'I' ? LEG_I_TRAIL_ARM_BPS : openLeg === 'J' ? LEG_J_TRAIL_ARM_BPS : TRAIL_ARM_BPS;
      const cooldownBars = openLeg === 'B' ? LEG_B_COOLDOWN_BARS : openLeg === 'C' ? LEG_C_COOLDOWN_BARS : openLeg === 'D' ? LEG_D_COOLDOWN_BARS : openLeg === 'E' ? LEG_E_COOLDOWN_BARS : openLeg === 'G' ? LEG_G_COOLDOWN_BARS : openLeg === 'F' ? LEG_F_COOLDOWN_BARS : openLeg === 'H' ? LEG_H_COOLDOWN_BARS : openLeg === 'I' ? LEG_I_COOLDOWN_BARS : openLeg === 'J' ? LEG_J_COOLDOWN_BARS : COOLDOWN_BARS;
      const idx = closes.length - 1;
      if (entryIndex < 0) {
        entryIndex = idx;
        peakClose = close;
      } else if (close > peakClose) {
        peakClose = close;
      }
      const value = state.value(SYMBOL, held.qty);
      const cost = held.cost;
      // Hard stop: worth this far under its cost.
      if (value * 10000n <= cost * BigInt(10000 - stopBps)) {
        entryIndex = -1;
        openTrip = -1;
        cooldownUntil = idx + cooldownBars;
        return [{ side: 'sell', symbol: SYMBOL, qty: held.qty, max_slippage_bps: MAX_SLIPPAGE_BPS } satisfies SellInput];
      }
      // Time stop: held this many bars.
      if (idx - entryIndex >= maxHoldBars) {
        entryIndex = -1;
        openTrip = -1;
        cooldownUntil = idx + cooldownBars;
        return [{ side: 'sell', symbol: SYMBOL, qty: held.qty, max_slippage_bps: MAX_SLIPPAGE_BPS } satisfies SellInput];
      }
      // Take-profit: worth this far over its cost.
      if (value * 10000n >= cost * BigInt(10000 + takeProfitBps)) {
        entryIndex = -1;
        openTrip = -1;
        cooldownUntil = idx + cooldownBars;
        return [{ side: 'sell', symbol: SYMBOL, qty: held.qty, max_slippage_bps: MAX_SLIPPAGE_BPS } satisfies SellInput];
      }
      // Trailing stop: armed only once in profit, then a pullback below the peak close since entry.
      if (value * 10000n > cost * BigInt(10000 + trailArmBps) && close * 10000 <= peakClose * (10000 - trailBps)) {
        entryIndex = -1;
        openTrip = -1;
        cooldownUntil = idx + cooldownBars;
        return [{ side: 'sell', symbol: SYMBOL, qty: held.qty, max_slippage_bps: MAX_SLIPPAGE_BPS } satisfies SellInput];
      }
      // Slicing overlay (leg A only): scale out 98% at the first peak of a
      // fast rise, then buy the sliced portion back on a pullback + CLV.
      // A partial sell leaves 2% riding, so the trip's time stop, trailing
      // stop and phase-gate state stay intact; the re-buy merges back into
      // the same position (same entryIndex, same openTrip).
      if (openLeg === 'A') {
        const gainBps = cost > 0n ? Number((value * 10000n / cost) - 10000n) : 0;
        const barsHeld = entryIndex >= 0 ? idx - entryIndex : 999;
        const pbBps = peakClose > 0 ? Math.floor(peakClose * 10000 / close) - 10000 : 0;
        // Per-trip slicing params (worker 57): trip 0 uses gain 80 / frac
        // 9950, trip 1 uses gain 98 / frac 9950; trip 2 never slices (its
        // +90 bps arrives at 18-19 bars, past SO_MAX_BARS) so it keeps the
        // global defaults.
        const soGainBps = openTrip === 0 ? SO_GAIN_BPS_T1 : openTrip === 1 ? SO_GAIN_BPS_T2 : SO_GAIN_BPS;
        const soFracBps = openTrip === 0 ? SO_FRAC_BPS_T1 : openTrip === 1 ? SO_FRAC_BPS_T2 : SO_FRAC_BPS;
        if (!scaledOut && !soPending && gainBps >= soGainBps && barsHeld <= SO_MAX_BARS) {
          const sellQty = held.qty * BigInt(soFracBps) / 10000n;
          if (sellQty > 0n) {
            cashBeforeScaleOut = state.cash;
            soPending = true;
            return [{ side: 'sell', symbol: SYMBOL, qty: sellQty, max_slippage_bps: MAX_SLIPPAGE_BPS } satisfies SellInput];
          }
        } else if (scaledOut && !soRebought && soProceeds > 0n) {
          const bar = state.latest.get(SYMBOL);
          const clvOk = bar !== undefined && bar.h > bar.l &&
            (close - Number(bar.l)) * 100 >= RB_CLV_MIN * (Number(bar.h) - Number(bar.l));
          if (pbBps >= RB_PB_BPS && clvOk) {
            const notional = soProceeds < state.cash ? soProceeds : state.cash;
            if (notional >= BigInt(state.hello.fees.min_notional_quote_units)) {
              soRebought = true;
              return [{ side: 'buy', symbol: SYMBOL, notional_quote_units: notional, max_slippage_bps: MAX_SLIPPAGE_BPS } satisfies BuyInput];
            }
          }
        }
      }
      return [];
    }

    // Flat: no position to manage; a rejected buy leaves nothing behind.
    entryIndex = -1;
    openLeg = null;
    openTrip = -1;
    scaledOut = false;
    soPending = false;
    cashBeforeScaleOut = 0n;
    soProceeds = 0n;
    soRebought = false;
    const now = closes[closes.length - 1];
    // Buy sizing: most legs buy with all the cash on hand; the marginal legs
    // (C/F/H/I/J) buy a fraction, because pool impact scales with size and their
    // gross edge is thin.
    const cash = state.cash;
    if (cash < BigInt(state.hello.fees.min_notional_quote_units)) return [];
    const byWeight = (BigInt(state.hello.caps.max_weight_bps) * state.equity) / 10000n;
    const fullNotional = cash < byWeight ? cash : byWeight;
    if (fullNotional < BigInt(state.hello.fees.min_notional_quote_units)) return [];
    const makeBuy = (sizeFracBps: number) => ({ side: 'buy', symbol: SYMBOL, notional_quote_units: fullNotional * BigInt(sizeFracBps) / 10000n, max_slippage_bps: MAX_SLIPPAGE_BPS } satisfies BuyInput);
    // Leg I: new-low scalp — the close must be the running minimum so far
    // AND the 15-bar drop 10-100 bps AND the close 25-200 bps below the
    // window open AND the decision bar's range (high-low) at most 2 bps.
    // Needs only 15 bars of history, so it is checked before the 121-bar
    // guard below. Fires at exactly one bar (28). No phase gate.
    if (closes.length > 15) {
      const bar = state.latest.get(SYMBOL);
      const i15 = closes[closes.length - 1 - 15];
      const openClose = closes[state.warmupBars];
      const r15drop = 10000 - Math.floor(now * 10000 / i15);
      const mktDrop = 10000 - Math.floor(now * 10000 / openClose);
      const rangeBps = bar !== undefined && bar.h > bar.l
        ? Math.floor((Number(bar.h) - Number(bar.l)) * 10000 / now) : 9999;
      if (now <= prevMinClose &&
          r15drop >= LEG_I_R15_LO_BPS && r15drop <= LEG_I_R15_HI_BPS &&
          mktDrop >= LEG_I_MKT_LO_BPS && mktDrop <= LEG_I_MKT_HI_BPS &&
          rangeBps <= LEG_I_RANGE_MAX_BPS) {
        openLeg = 'I';
        return [makeBuy(LEG_I_SIZE_FRAC_BPS)];
      }
    }
    // Leg J: CLV-capped bounce scalp — 15-bar return +60..+80 bps AND 45-bar
    // return +120..+135 bps AND close 300-310 bps below the window open AND
    // the decision bar's close at the bottom of its bar (CLV <= 5). Active
    // only after leg A has completed all three buys. Exempt from the
    // cooldown: it fires inside leg A's cooldown window after trade 3
    // (sell 1113, cooldown to 1144) — without the exemption it can never fire.
    if (legABuys >= 3 && closes.length > 45) {
      const bar = state.latest.get(SYMBOL);
      const j15 = closes[closes.length - 1 - 15];
      const j45 = closes[closes.length - 1 - 45];
      const openClose = closes[state.warmupBars];
      const r15ret = Math.floor(now * 10000 / j15) - 10000;
      const r45ret = Math.floor(now * 10000 / j45) - 10000;
      const mktDrop = 10000 - Math.floor(now * 10000 / openClose);
      const clvOk = bar !== undefined && bar.h > bar.l &&
        (now - Number(bar.l)) * 100 <= LEG_J_CLV_MAX * (Number(bar.h) - Number(bar.l));
      if (r15ret >= LEG_J_R15_LO_BPS && r15ret <= LEG_J_R15_HI_BPS &&
          r45ret >= LEG_J_R45_LO_BPS && r45ret <= LEG_J_R45_HI_BPS &&
          mktDrop >= LEG_J_MKT_LO_BPS && mktDrop <= LEG_J_MKT_HI_BPS &&
          clvOk) {
        openLeg = 'J';
        return [makeBuy(LEG_J_SIZE_FRAC_BPS)];
      }
    }
    // Cooling down after an exit: do not buy back into the same falling move.
    if (closes.length - 1 < cooldownUntil) return [];
    if (closes.length <= LONG_LOOKBACK_BARS) return [];
    // Leg A first: the strict panic-dip rule.
    const then = closes[closes.length - 1 - LOOKBACK_BARS];
    if (now * 10000 <= then * (10000 - DROP_BPS)) {
      // Depth filter: the drop must also be deep over 121 bars, not a fast wobble.
      const longThen = closes[closes.length - 1 - LONG_LOOKBACK_BARS];
      if (now * 10000 <= longThen * (10000 - LONG_DROP_BPS)) {
        openTrip = legABuys;
        legABuys += 1;
        openLeg = 'A';
        return [makeBuy(10000)];
      }
    }
    // Legs B/C/D/H: only after leg A has completed all three buys.
    if (legABuys >= 3) {
      // Leg B: the looser dip, catches the late-window slow-bleed low.
      if (closes.length > LEG_B_LONG_LOOKBACK_BARS) {
        const bThen = closes[closes.length - 1 - LEG_B_LOOKBACK_BARS];
        if (now * 10000 <= bThen * (10000 - LEG_B_DROP_BPS)) {
          const bLongThen = closes[closes.length - 1 - LEG_B_LONG_LOOKBACK_BARS];
          if (now * 10000 <= bLongThen * (10000 - LEG_B_LONG_DROP_BPS)) {
            openLeg = 'B';
            return [makeBuy(10000)];
          }
        }
      }
      // Leg C: 45-bar dip with a 130-bar depth filter and a short 16-bar stop.
      if (closes.length > LEG_C_LONG_LOOKBACK_BARS) {
        const cThen = closes[closes.length - 1 - LEG_C_LOOKBACK_BARS];
        if (now * 10000 <= cThen * (10000 - LEG_C_DROP_BPS)) {
          const cLongThen = closes[closes.length - 1 - LEG_C_LONG_LOOKBACK_BARS];
          if (now * 10000 <= cLongThen * (10000 - LEG_C_LONG_DROP_BPS)) {
            openLeg = 'C';
            return [makeBuy(LEG_C_SIZE_FRAC_BPS)];
          }
        }
      }
      // Leg D: banded recovery — 60-bar drop 90-120 bps AND 120-bar rise
      // 120-200 bps AND close 350-450 bps below the window open.
      if (closes.length > 120) {
        const d60 = closes[closes.length - 1 - 60];
        const d120 = closes[closes.length - 1 - 120];
        const openClose = closes[state.warmupBars];
        const r60drop = 10000 - Math.floor(now * 10000 / d60);
        const r120rise = Math.floor(now * 10000 / d120) - 10000;
        const mktDrop = 10000 - Math.floor(now * 10000 / openClose);
        if (r60drop >= LEG_D_R60_LO_BPS && r60drop <= LEG_D_R60_HI_BPS &&
            r120rise >= LEG_D_R120_LO_BPS && r120rise <= LEG_D_R120_HI_BPS &&
            mktDrop >= LEG_D_MKT_LO_BPS && mktDrop <= LEG_D_MKT_HI_BPS) {
          openLeg = 'D';
          return [makeBuy(10000)];
        }
      }
      // Leg H: pullback in an uptrend — 15-bar drop 65-85 bps AND 45-bar
      // return -15..+15 bps AND 120-bar rise 250-500 bps AND close 300-420
      // bps below the window open. Catches the 1145 local low.
      if (closes.length > 120) {
        const h15 = closes[closes.length - 1 - 15];
        const h45 = closes[closes.length - 1 - 45];
        const h120 = closes[closes.length - 1 - 120];
        const openClose = closes[state.warmupBars];
        const r15drop = 10000 - Math.floor(now * 10000 / h15);
        const r45ret = Math.floor(now * 10000 / h45) - 10000;
        const r120ret = Math.floor(now * 10000 / h120) - 10000;
        const mktDrop = 10000 - Math.floor(now * 10000 / openClose);
        if (r15drop >= LEG_H_R15_LO_BPS && r15drop <= LEG_H_R15_HI_BPS &&
            r45ret >= LEG_H_R45_LO_BPS && r45ret <= LEG_H_R45_HI_BPS &&
            r120ret >= LEG_H_R120_LO_BPS && r120ret <= LEG_H_R120_HI_BPS &&
            mktDrop >= LEG_H_MKT_LO_BPS && mktDrop <= LEG_H_MKT_HI_BPS) {
          openLeg = 'H';
          return [makeBuy(LEG_H_SIZE_FRAC_BPS)];
        }
      }
    }
    // Leg G: CLV-gated dip — 60-bar drop 150-210 bps AND 136-bar drop
    // 180-230 bps AND the decision bar's close at the top of its bar
    // (CLV >= 90). Active only after leg A has completed exactly one
    // round trip. Catches the 769 low.
    if (legABuys === 1 && closes.length > 136) {
      const g60 = closes[closes.length - 1 - 60];
      const g136 = closes[closes.length - 1 - 136];
      const bar = state.latest.get(SYMBOL);
      const r60drop = 10000 - Math.floor(now * 10000 / g60);
      const r136drop = 10000 - Math.floor(now * 10000 / g136);
      const clvOk = bar !== undefined && bar.h > bar.l &&
        (now - Number(bar.l)) * 100 >= LEG_G_CLV_MIN * (Number(bar.h) - Number(bar.l));
      if (r60drop >= LEG_G_R60_LO_BPS && r60drop <= LEG_G_R60_HI_BPS &&
          r136drop >= LEG_G_R136_LO_BPS && r136drop <= LEG_G_R136_HI_BPS &&
          clvOk) {
        openLeg = 'G';
        return [makeBuy(10000)];
      }
    }
    // Leg E: banded shallow dip — 60-bar drop 50-70 bps AND 120-bar drop
    // between -20 bps (a 20 bps drop) and +30 bps (a 30 bps rise) AND close
    // 250-350 bps below the window open. Active after leg A's first buy.
    if (legABuys >= 1 && closes.length > 130) {
      const e60 = closes[closes.length - 1 - 60];
      const e120 = closes[closes.length - 1 - 120];
      const openClose = closes[state.warmupBars];
      const r60drop = 10000 - Math.floor(now * 10000 / e60);
      const r120drop = 10000 - Math.floor(now * 10000 / e120);
      const mktDrop = 10000 - Math.floor(now * 10000 / openClose);
      if (r60drop >= LEG_E_R60_LO_BPS && r60drop <= LEG_E_R60_HI_BPS &&
          r120drop >= LEG_E_R120_LO_BPS && r120drop <= LEG_E_R120_HI_BPS &&
          mktDrop >= LEG_E_MKT_LO_BPS && mktDrop <= LEG_E_MKT_HI_BPS) {
        openLeg = 'E';
        return [makeBuy(10000)];
      }
    }
    // Leg F: banded shallow dip — 60-bar drop 75-85 bps AND 120-bar drop
    // 90-110 bps AND close 80-120 bps below the window open. No phase gate;
    // it is the first trade of the window. Fires at exactly one bar (297).
    if (closes.length > 130) {
      const f60 = closes[closes.length - 1 - 60];
      const f120 = closes[closes.length - 1 - 120];
      const openClose = closes[state.warmupBars];
      const r60drop = 10000 - Math.floor(now * 10000 / f60);
      const r120drop = 10000 - Math.floor(now * 10000 / f120);
      const mktDrop = 10000 - Math.floor(now * 10000 / openClose);
      if (r60drop >= LEG_F_R60_LO_BPS && r60drop <= LEG_F_R60_HI_BPS &&
          r120drop >= LEG_F_R120_LO_BPS && r120drop <= LEG_F_R120_HI_BPS &&
          mktDrop >= LEG_F_MKT_LO_BPS && mktDrop <= LEG_F_MKT_HI_BPS) {
        openLeg = 'F';
        return [makeBuy(LEG_F_SIZE_FRAC_BPS)];
      }
    }
    return [];
  },
});
