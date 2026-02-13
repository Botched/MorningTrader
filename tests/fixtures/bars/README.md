# Test Fixture Bar Data

All fixture CSVs use date **2024-06-17** (Monday, summer, ET = UTC-4).

Each file contains 18 bars: 6 zone bars (09:30-09:55 ET) and 12 execution bars (10:00-10:55 ET).

Prices are dollar floats in CSV. The csv-loader converts them to integer cents via `Math.round(dollars * 100)`.

Timestamps are epoch seconds (UTC). The csv-loader multiplies by 1000 to get UTC milliseconds.

## Zone Levels (all fixtures except #2)

- **Resistance**: $502.00 (50200 cents) — highest HIGH of zone bars
- **Support**: $498.00 (49800 cents) — lowest LOW of zone bars
- **Spread**: $4.00 (400 cents)

## Fixture 2 Zone Levels

Same resistance/support as above, but last zone bar closes at support ($498.00) to set up the short-side scenario without triggering the choppy guard.

---

## Fixture 1: `spy-long-breakout-2r.csv`

**Expected Result**: WIN_2R

| Bar (ET) | Timestamp    | Key Price Action                                                |
|----------|--------------|-----------------------------------------------------------------|
| 09:30-09:55 | zone bars | R=502.00, S=498.00. Last close=502.00 (at resistance, NOT choppy) |
| 10:00    | 1718632800   | Transition bar. Close=502.20                                    |
| 10:05    | 1718633100   | **LONG BREAK**: HIGH=503.50 > 502.00                           |
| 10:10    | 1718633400   | **RETEST+CONFIRM**: LOW=501.80 <= 502.00, CLOSE=502.80 > 502.00 |
| 10:15    | 1718633700   | **1R HIT**: CLOSE=503.60 >= 503.60. Stop moves to entry (502.80) |
| 10:20    | 1718634000   | **2R HIT**: CLOSE=504.40 >= 504.40. Trade resolves WIN_2R      |
| 10:25-10:55 | remaining | Post-resolution drift upward                                    |

- **Entry**: $502.80 (50280 cents) — confirmation bar CLOSE
- **Stop**: $502.00 (50200 cents) — zone resistance
- **R-value**: 80 cents (|50280 - 50200|)
- **target1R**: $503.60 (50360), **target2R**: $504.40 (50440), **target3R**: $505.20 (50520)
- **realizedR**: 2.0

---

## Fixture 2: `spy-short-breakout-3r.csv`

**Expected Result**: WIN_3R

| Bar (ET) | Timestamp    | Key Price Action                                                |
|----------|--------------|-----------------------------------------------------------------|
| 09:30-09:55 | zone bars | R=502.00, S=498.00. Last close=498.00 (at support, NOT choppy) |
| 10:00    | 1718632800   | Transition bar. Close=497.50                                    |
| 10:05    | 1718633100   | **SHORT BREAK**: LOW=497.00 < 498.00                           |
| 10:10    | 1718633400   | **RETEST+CONFIRM**: HIGH=498.20 >= 498.00, CLOSE=497.20 < 498.00 |
| 10:15    | 1718633700   | **1R HIT**: CLOSE=496.40 <= 496.40. Stop moves to entry (497.20) |
| 10:20    | 1718634000   | **2R HIT**: CLOSE=495.60 <= 495.60                              |
| 10:25    | 1718634300   | **3R HIT**: CLOSE=494.80 <= 494.80. Trade resolves WIN_3R      |
| 10:30-10:55 | remaining | Post-resolution drift downward                                  |

- **Entry**: $497.20 (49720 cents) — confirmation bar CLOSE
- **Stop**: $498.00 (49800 cents) — zone support
- **R-value**: 80 cents (|49720 - 49800|)
- **target1R**: $496.40 (49640), **target2R**: $495.60 (49560), **target3R**: $494.80 (49480)
- **realizedR**: 3.0

---

## Fixture 3: `spy-choppy.csv`

**Expected Result**: NO_TRADE_CHOPPY

| Bar (ET) | Timestamp    | Key Price Action                                                |
|----------|--------------|-----------------------------------------------------------------|
| 09:30-09:55 | zone bars | R=502.00, S=498.00. Last close=500.00 (inside zone, CHOPPY)    |
| 10:00-10:55 | exec bars | Prices oscillate between 499-501. No trade taken.               |

- **Zone source bars last close**: $500.00 (50000 cents)
- **Choppy guard**: 50000 > 49800 AND 50000 < 50200 => TRUE => NO_TRADE_CHOPPY
- No entry, no stop, no R-value.

---

## Fixture 4: `spy-stop-loss.csv`

**Expected Result**: LOSS

| Bar (ET) | Timestamp    | Key Price Action                                                |
|----------|--------------|-----------------------------------------------------------------|
| 09:30-09:55 | zone bars | R=502.00, S=498.00. Last close=502.00 (NOT choppy)             |
| 10:00    | 1718632800   | Transition bar                                                  |
| 10:05    | 1718633100   | **LONG BREAK**: HIGH=503.50 > 502.00                           |
| 10:10    | 1718633400   | **RETEST+CONFIRM**: LOW=501.80 <= 502.00, CLOSE=502.80 > 502.00 |
| 10:15    | 1718633700   | **STOP HIT**: CLOSE=501.80 <= 502.00 (stop at resistance)      |
| 10:20-10:55 | remaining | Post-stop price decline                                         |

- **Entry**: $502.80 (50280 cents)
- **Stop**: $502.00 (50200 cents) — zone resistance (1R never reached, stop stays here)
- **R-value**: 80 cents
- **realizedR**: (50200 - 50280) / 80 = -1.0
- reached1R: false => result = LOSS

---

## Fixture 5: `spy-breakeven-stop.csv`

**Expected Result**: BREAKEVEN_STOP

| Bar (ET) | Timestamp    | Key Price Action                                                |
|----------|--------------|-----------------------------------------------------------------|
| 09:30-09:55 | zone bars | R=502.00, S=498.00. Last close=502.00 (NOT choppy)             |
| 10:00    | 1718632800   | Transition bar                                                  |
| 10:05    | 1718633100   | **LONG BREAK**: HIGH=503.50 > 502.00                           |
| 10:10    | 1718633400   | **RETEST+CONFIRM**: LOW=501.80 <= 502.00, CLOSE=502.80 > 502.00 |
| 10:15    | 1718633700   | **1R HIT**: CLOSE=503.60 >= 503.60. Stop moves to 502.80       |
| 10:20    | 1718634000   | **STOP HIT**: CLOSE=502.80 <= 502.80 (stop at entry = breakeven) |
| 10:25-10:55 | remaining | Post-stop drift down                                            |

- **Entry**: $502.80 (50280 cents)
- **Stop initial**: $502.00, **Stop after 1R**: $502.80 (entry price)
- **R-value**: 80 cents
- **realizedR**: (50280 - 50280) / 80 = 0.0
- reached1R: true => result = BREAKEVEN_STOP

---

## Fixture 6: `spy-session-timeout.csv`

**Expected Result**: SESSION_TIMEOUT

| Bar (ET) | Timestamp    | Key Price Action                                                |
|----------|--------------|-----------------------------------------------------------------|
| 09:30-09:55 | zone bars | R=502.00, S=498.00. Last close=502.00 (NOT choppy)             |
| 10:00    | 1718632800   | Transition bar                                                  |
| 10:05    | 1718633100   | **LONG BREAK**: HIGH=503.50 > 502.00                           |
| 10:10    | 1718633400   | **RETEST+CONFIRM**: LOW=501.80 <= 502.00, CLOSE=502.80 > 502.00 |
| 10:15-10:55 | 8 bars    | Price stays between 502.20 and 503.40 (above stop, below 1R)   |

- **Entry**: $502.80 (50280 cents)
- **Stop**: $502.00 (50200 cents) — never hit (all closes > 502.00)
- **R-value**: 80 cents
- **target1R**: $503.60 — never hit (all closes <= 503.20)
- Position open at session end. Last bar close = $503.00
- **realizedR**: (50300 - 50280) / 80 = 0.25
- result = SESSION_TIMEOUT

---

## Fixture 7: `spy-false-retest.csv`

**Expected Result**: No trade entered (break failure, then no further breaks)

| Bar (ET) | Timestamp    | Key Price Action                                                |
|----------|--------------|-----------------------------------------------------------------|
| 09:30-09:55 | zone bars | R=502.00, S=498.00. Last close=502.00 (NOT choppy)             |
| 10:00    | 1718632800   | Transition bar                                                  |
| 10:05    | 1718633100   | **LONG BREAK**: HIGH=503.00 > 502.00. Phase=breakDetected      |
| 10:10    | 1718633400   | Price stays above: LOW=502.50 > 502.00. No retest. Phase stays breakDetected |
| 10:15    | 1718633700   | **BREAK FAILURE**: CLOSE=501.50 <= 502.00. Phase returns to watching |
| 10:20-10:55 | remaining | All HIGHs <= 501.80. No further breaks. Session ends with no trade |

- No entry, no stop, no R-value.
- longBreakAttempts = 1 (one failed attempt)

---

## Fixture 8: `spy-single-bar-retest-confirm.csv`

**Expected Result**: Entry via single-bar retestAndConfirm path (WIN_3R)

| Bar (ET) | Timestamp    | Key Price Action                                                |
|----------|--------------|-----------------------------------------------------------------|
| 09:30-09:55 | zone bars | R=502.00, S=498.00. Last close=502.00 (NOT choppy)             |
| 10:00    | 1718632800   | Transition bar                                                  |
| 10:05    | 1718633100   | **LONG BREAK**: HIGH=503.00 > 502.00. Phase=breakDetected      |
| 10:10    | 1718633400   | **RETEST+CONFIRM (single bar)**: LOW=501.90 <= 502.00 AND CLOSE=502.60 > 502.00 |
| 10:15    | 1718633700   | **1R HIT**: CLOSE=503.20 >= 503.20. Stop moves to 502.60       |
| 10:20    | 1718634000   | CLOSE=503.50 (not 2R yet)                                       |
| 10:25    | 1718634300   | **2R HIT**: CLOSE=503.80 >= 503.80                              |
| 10:30    | 1718634600   | CLOSE=504.00 (not 3R yet)                                       |
| 10:35    | 1718634900   | CLOSE=504.20 (not 3R yet)                                       |
| 10:40    | 1718635200   | **3R HIT**: CLOSE=504.40 >= 504.40. Trade resolves WIN_3R      |
| 10:45-10:55 | remaining | Post-resolution drift                                           |

- **Entry**: $502.60 (50260 cents) — confirmation bar CLOSE
- **Stop**: $502.00 (50200 cents) — zone resistance
- **R-value**: 60 cents (|50260 - 50200|)
- **target1R**: $503.20 (50320), **target2R**: $503.80 (50380), **target3R**: $504.40 (50440)
- **realizedR**: 3.0
- Tests the `isLongRetestAndConfirm` shortcut guard specifically

---

## Fixture 9: `spy-multi-break-attempts.csv`

**Expected Result**: Entry on 4th break attempt (SESSION_TIMEOUT)

| Bar (ET) | Timestamp    | Key Price Action                                                |
|----------|--------------|-----------------------------------------------------------------|
| 09:30-09:55 | zone bars | R=502.00, S=498.00. Last close=502.00 (NOT choppy)             |
| 10:00    | 1718632800   | Transition bar                                                  |
| 10:05    | 1718633100   | **BREAK #1**: HIGH=502.80 > 502.00. attempts=1                 |
| 10:10    | 1718633400   | **FAILURE #1**: CLOSE=501.50 <= 502.00. Back to watching        |
| 10:15    | 1718633700   | **BREAK #2**: HIGH=502.80 > 502.00. attempts=2                 |
| 10:20    | 1718634000   | **FAILURE #2**: CLOSE=501.00 <= 502.00. Back to watching        |
| 10:25    | 1718634300   | **BREAK #3**: HIGH=502.80 > 502.00. attempts=3                 |
| 10:30    | 1718634600   | **FAILURE #3**: CLOSE=500.80 <= 502.00. Back to watching        |
| 10:35    | 1718634900   | **BREAK #4**: HIGH=502.80 > 502.00. attempts=4                 |
| 10:40    | 1718635200   | **RETEST+CONFIRM**: LOW=501.80 <= 502.00, CLOSE=502.60 > 502.00. ENTRY |
| 10:45    | 1718635500   | CLOSE=503.00 (below 1R=503.20)                                  |
| 10:50    | 1718635800   | **1R HIT**: CLOSE=503.30 >= 503.20. Stop moves to 502.60       |
| 10:55    | 1718636100   | CLOSE=503.50 (below 2R=503.80). Session ends.                   |

- **Entry**: $502.60 (50260 cents) — 4th attempt confirmation bar CLOSE
- **Stop**: $502.00 (50200 cents) — zone resistance
- **R-value**: 60 cents (|50260 - 50200|)
- **target1R**: $503.20 (50320), **target2R**: $503.80 (50380), **target3R**: $504.40 (50440)
- reached1R: true (at 10:50), reached2R: false
- Last bar close = $503.50 (50350)
- **realizedR**: (50350 - 50260) / 60 = 1.5
- result = SESSION_TIMEOUT (position still open at 11:00)
- longBreakAttempts = 4

---

## Guard Priority Notes

When multiple guards can fire on the same bar (e.g., both `isLongRetest` and `isLongBreakFailure` when close <= resistance), the intended evaluation order is:

1. `isLongRetestAndConfirm` / `isShortRetestAndConfirm` (most specific, single-bar shortcut)
2. `isLongBreakFailure` / `isShortBreakFailure` (close fails to hold above/below level)
3. `isLongRetest` / `isShortRetest` (least specific)

For R-target evaluation on the same bar:

1. `isLong3R` / `isShort3R` (checked first, resolves trade)
2. `isLong2R` / `isShort2R`
3. `isLong1R` / `isShort1R`
4. `isLongStopHit` / `isShortStopHit` (checked last)
