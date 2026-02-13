import type { FastifyInstance } from 'fastify';
import type { createDashboardQueries } from '../../adapters/storage/queries/dashboard.js';
import {
  centsToDollars,
  serializeBar,
  serializeSignal,
  serializeTrade,
  serializeOutcome,
} from '../serializers.js';
import { generateNarrative } from '../../services/narrative-generator.js';
import type { FullSessionData } from '../../services/narrative-types.js';
import type {
  DecisionZoneStatus,
  SignalDirection,
  SignalType,
  TradeDirection,
  TradeStatus,
  TradeResult,
  SessionStatus,
  ExecutionMode,
} from '../../core/models/index.js';

type DashboardQueries = ReturnType<typeof createDashboardQueries>;

export function registerSessionRoutes(
  app: FastifyInstance,
  queries: DashboardQueries,
) {
  // ── Session list ──────────────────────────────────────────────

  app.get('/api/sessions', async (request) => {
    const {
      from = '2000-01-01',
      to = '2099-12-31',
      symbol,
      page = '1',
      limit = '50',
    } = request.query as {
      from?: string;
      to?: string;
      symbol?: string;
      page?: string;
      limit?: string;
    };

    const rows = queries.getSessionList(from, to, symbol);

    // Deduplicate sessions (LEFT JOIN can produce multiple rows per session)
    const sessionMap = new Map<number, {
      id: number;
      date: string;
      symbol: string;
      status: string;
      zoneResistance: number | null;
      zoneSupport: number | null;
      zoneStatus: string | null;
      executionMode: string;
      isBacktest: boolean;
      direction: string | null;
      result: string | null;
      realizedR: number | null;
    }>();

    for (const row of rows) {
      if (!sessionMap.has(row.id)) {
        sessionMap.set(row.id, {
          id: row.id,
          date: row.date,
          symbol: row.symbol,
          status: row.status,
          zoneResistance: centsToDollars(row.zone_resistance),
          zoneSupport: centsToDollars(row.zone_support),
          zoneStatus: row.zone_status,
          executionMode: row.execution_mode,
          isBacktest: row.is_backtest === 1,
          direction: row.direction,
          result: row.result,
          realizedR: row.realized_r !== null
            ? Math.round(row.realized_r * 100) / 100
            : null,
        });
      }
    }

    const allSessions = Array.from(sessionMap.values());
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const start = (pageNum - 1) * limitNum;
    const paginated = allSessions.slice(start, start + limitNum);

    return {
      sessions: paginated,
      total: allSessions.length,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(allSessions.length / limitNum),
    };
  });

  // ── Session detail ────────────────────────────────────────────

  app.get('/api/sessions/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const sessionId = parseInt(id, 10);

    const session = queries.getSessionById(sessionId);
    if (!session) {
      return reply.code(404).send({ error: 'Session not found' });
    }

    const trades = queries.getTradesBySessionId(sessionId) as Array<Record<string, unknown>>;
    const signals = queries.getSignalsBySessionId(sessionId) as Array<Record<string, unknown>>;
    const bars = queries.getBarsBySessionId(sessionId) as Array<Record<string, unknown>>;
    const outcomes = queries.getOutcomesBySessionId(sessionId) as Array<Record<string, unknown>>;

    return {
      session: {
        id: session.id,
        date: session.date,
        symbol: session.symbol,
        status: session.status,
        zoneResistance: centsToDollars(session.zone_resistance),
        zoneSupport: centsToDollars(session.zone_support),
        zoneStatus: session.zone_status,
        executionMode: session.execution_mode,
        isBacktest: session.is_backtest === 1,
        error: session.error,
      },
      trades: trades.map((t) => serializeTrade(t as Parameters<typeof serializeTrade>[0])),
      signals: signals.map((s) => serializeSignal(s as Parameters<typeof serializeSignal>[0])),
      bars: bars.map((b) => serializeBar(b as Parameters<typeof serializeBar>[0])),
      outcomes: outcomes.map((o) => serializeOutcome(o as Parameters<typeof serializeOutcome>[0])),
    };
  });

  // ── Session narrative ─────────────────────────────────────────

  app.get('/api/sessions/:id/narrative', async (request, reply) => {
    const { id } = request.params as { id: string };
    const sessionId = parseInt(id, 10);

    const session = queries.getSessionById(sessionId);
    if (!session) {
      return reply.code(404).send({ error: 'Session not found' });
    }

    const trades = queries.getTradesBySessionId(sessionId) as Array<Record<string, unknown>>;
    const signals = queries.getSignalsBySessionId(sessionId) as Array<Record<string, unknown>>;
    const bars = queries.getBarsBySessionId(sessionId) as Array<Record<string, unknown>>;
    const outcomes = queries.getOutcomesBySessionId(sessionId) as Array<Record<string, unknown>>;

    // Build FullSessionData for the narrative generator
    const fullData: FullSessionData = {
      id: session.id,
      date: session.date,
      symbol: session.symbol,
      status: session.status as SessionStatus,
      executionMode: (session.execution_mode ?? 'MOCK') as ExecutionMode,
      isBacktest: session.is_backtest === 1,
      startedAt: session.started_at ?? 0,
      completedAt: session.completed_at ?? 0,
      error: session.error,
      zone: session.zone_resistance !== null && session.zone_support !== null
        ? {
            resistance: session.zone_resistance,
            support: session.zone_support,
            status: (session.zone_status ?? 'DEFINED') as DecisionZoneStatus,
            spread: session.zone_resistance - (session.zone_support ?? 0),
            definedAt: 0,
            sourceBars: [],
            premarketPrice: 0,
          }
        : null,
      signals: signals.map((s) => ({
        direction: (s.direction as string) as SignalDirection,
        type: (s.signal_type as string) as SignalType,
        timestamp: s.timestamp as number,
        price: s.price as number,
        triggerCandle: {
          timestamp: 0, open: 0, high: 0, low: 0, close: 0,
          volume: 0, completed: false, barSizeMinutes: 5 as const,
        },
        attemptNumber: s.attempt_number as number,
      })),
      trades: trades.map((t) => ({
        id: t.id as string,
        symbol: t.symbol as string,
        direction: (t.direction as string) as TradeDirection,
        entryPrice: t.entry_price as number,
        stopLevel: t.initial_stop as number,
        currentStop: t.current_stop as number,
        rValue: t.r_value as number,
        target1R: t.target_1r as number,
        target2R: t.target_2r as number,
        target3R: t.target_3r as number,
        entryTimestamp: t.entry_timestamp as number,
        status: (t.status as string) as TradeStatus,
        entrySignal: {
          direction: (t.direction as string) as SignalDirection,
          type: 'CONFIRMATION' as SignalType,
          timestamp: t.entry_timestamp as number,
          price: t.entry_price as number,
          triggerCandle: {
            timestamp: 0, open: 0, high: 0, low: 0, close: 0,
            volume: 0, completed: false, barSizeMinutes: 5 as const,
          },
          attemptNumber: 1,
        },
      })),
      outcomes: outcomes.map((o) => ({
        tradeId: o.trade_id as string,
        result: (o.result as string) as TradeResult,
        exitPrice: o.exit_price as number,
        exitTimestamp: o.exit_timestamp as number,
        realizedR: o.realized_r as number,
        maxFavorableR: o.max_favorable_r as number,
        maxAdverseR: o.max_adverse_r as number,
        barsHeld: o.bars_held as number,
        firstThresholdReached: (o.first_threshold_reached as number) as 0 | 1 | 2 | 3,
        timestamp1R: o.timestamp_1r as number,
        timestamp2R: o.timestamp_2r as number,
        timestamp3R: o.timestamp_3r as number,
        timestampStop: o.timestamp_stop as number,
      })),
      bars: bars.map((b) => ({
        timestamp: b.timestamp as number,
        open: b.open as number,
        high: b.high as number,
        low: b.low as number,
        close: b.close as number,
        volume: b.volume as number,
        completed: true,
        barSizeMinutes: 5 as const,
      })),
    };

    const narrative = generateNarrative(fullData);
    return narrative;
  });
}
