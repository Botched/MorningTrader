import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { createChart, ColorType, IChartApi, ISeriesApi } from 'lightweight-charts';
import { api } from '../api/client.js';
import type { SessionDetailResponse, SessionNarrative, Bar, Signal } from '../api/types.js';
import { LoadingSpinner } from '../components/common/LoadingSpinner.js';
import { RValueBadge } from '../components/common/RValueBadge.js';
import { PriceDisplay } from '../components/common/PriceDisplay.js';

export default function SessionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const sessionId = id ? parseInt(id, 10) : 0;

  const [detail, setDetail] = useState<SessionDetailResponse | null>(null);
  const [narrative, setNarrative] = useState<SessionNarrative | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (sessionId) {
      loadData();
    }
  }, [sessionId]);

  async function loadData() {
    try {
      setLoading(true);
      setError(null);
      const [detailData, narrativeData] = await Promise.all([
        api.getSessionDetail(sessionId),
        api.getSessionNarrative(sessionId),
      ]);
      setDetail(detailData);
      setNarrative(narrativeData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load session detail');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Session Detail</h1>
          <p className="text-sm text-slate-400 mt-1">Detailed view with charts and narrative</p>
        </div>
        <LoadingSpinner />
      </div>
    );
  }

  if (error || !detail || !narrative) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Session Detail</h1>
          <p className="text-sm text-slate-400 mt-1">Detailed view with charts and narrative</p>
        </div>
        <div className="bg-red-900/20 border border-red-800 rounded-lg p-6">
          <p className="text-red-400">{error || 'Session not found'}</p>
        </div>
      </div>
    );
  }

  const trade = detail.trades[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-100">
          {detail.session.symbol} - {detail.session.date}
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          {detail.session.executionMode} {detail.session.isBacktest ? '(Backtest)' : '(Live)'}
        </p>
      </div>

      {/* Chart + Summary Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart (2/3 width) */}
        <div className="lg:col-span-2">
          <CandlestickChart
            bars={detail.bars}
            signals={detail.signals}
            zone={{
              resistance: detail.session.zoneResistance,
              support: detail.session.zoneSupport,
            }}
            trade={trade}
          />
        </div>

        {/* Cards (1/3 width) */}
        <div className="space-y-4">
          <TradeSetupCard
            resistance={detail.session.zoneResistance}
            support={detail.session.zoneSupport}
            status={detail.session.zoneStatus}
            actualTrade={trade}
          />
          {trade && <TradeCard trade={trade} />}
        </div>
      </div>

      {/* Narrative */}
      <NarrativeView narrative={narrative} />
    </div>
  );
}

interface CandlestickChartProps {
  bars: Bar[];
  signals: Signal[];
  zone: { resistance: number | null; support: number | null };
  trade: any;
}

function CandlestickChart({ bars, signals, zone, trade }: CandlestickChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const [showZones, setShowZones] = useState(true);

  useEffect(() => {
    if (!chartContainerRef.current || bars.length === 0) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#1e293b' },
        textColor: '#94a3b8',
      },
      grid: {
        vertLines: { color: '#334155' },
        horzLines: { color: '#334155' },
      },
      width: chartContainerRef.current.clientWidth,
      height: 500,
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
      },
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: '#10b981',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
    });

    // Convert bars to TradingView format
    // TradingView displays times in UTC, so we offset to ET (UTC-5 for EST, UTC-4 for EDT)
    // Using -5 hours (EST) as a constant offset for simplicity
    const ET_OFFSET_MS = 5 * 60 * 60 * 1000; // 5 hours in milliseconds
    const candleData = bars.map((bar) => ({
      time: ((bar.timestamp - ET_OFFSET_MS) / 1000) as any, // Convert UTC to ET, then to seconds
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
    }));

    candleSeries.setData(candleData);

    // Add zone lines (no shading)
    if (zone.resistance !== null) {
      candleSeries.createPriceLine({
        price: zone.resistance,
        color: '#ef4444',
        lineWidth: 2,
        lineStyle: 2, // Dashed
        axisLabelVisible: true,
        title: 'Resistance',
      });
    }

    if (zone.support !== null) {
      candleSeries.createPriceLine({
        price: zone.support,
        color: '#10b981',
        lineWidth: 2,
        lineStyle: 2, // Dashed
        axisLabelVisible: true,
        title: 'Support',
      });
    }

    // Show R-multiple zones as colored bands
    if (zone && zone.resistance !== null && zone.support !== null) {
      // Calculate LONG setup parameters
      const longEntry = trade?.direction === 'LONG' ? trade.entryPrice : zone.resistance;
      const longStop = zone.support;
      const longR = longEntry - longStop;
      const long1R = longEntry + longR;
      const long2R = longEntry + (longR * 2);
      const long3R = longEntry + (longR * 3);

      // Helper to create a line series (for zone boundaries)
      const createLineSeries = (color: string, style: number = 2) => {
        return chart.addLineSeries({
          color,
          lineStyle: style,
          priceLineVisible: false,
          lastValueVisible: false,
        });
      };

      // Conditionally render zone bands (can be toggled on/off)
      if (showZones) {
        // LONG: Stop Loss Zone (red/orange band below support)
        const stopZoneSeries = chart.addAreaSeries({
          topColor: 'rgba(249, 115, 22, 0.25)',
          bottomColor: 'rgba(249, 115, 22, 0.15)',
          lineColor: 'transparent',
          priceLineVisible: false,
          lastValueVisible: false,
        });
        stopZoneSeries.setData(candleData.map((bar) => ({
          time: bar.time,
          value: longStop, // Top of stop zone
        })));

        // Decision Zone (yellow band from support to resistance)
        const decisionZoneSeries = chart.addAreaSeries({
          topColor: 'rgba(234, 179, 8, 0.15)',
          bottomColor: 'rgba(234, 179, 8, 0.08)',
          lineColor: 'transparent',
          priceLineVisible: false,
          lastValueVisible: false,
        });
        decisionZoneSeries.setData(candleData.map((bar) => ({
          time: bar.time,
          value: zone.resistance, // Top of decision zone
        })));

        // 1R Zone (light green band from entry to 1R)
        const zone1RSeries = chart.addAreaSeries({
          topColor: 'rgba(34, 197, 94, 0.15)',
          bottomColor: 'rgba(34, 197, 94, 0.08)',
          lineColor: 'transparent',
          priceLineVisible: false,
          lastValueVisible: false,
        });
        zone1RSeries.setData(candleData.map((bar) => ({
          time: bar.time,
          value: long1R, // Top of 1R zone
        })));

        // 2R Zone (medium green band from 1R to 2R)
        const zone2RSeries = chart.addAreaSeries({
          topColor: 'rgba(22, 163, 74, 0.18)',
          bottomColor: 'rgba(22, 163, 74, 0.10)',
          lineColor: 'transparent',
          priceLineVisible: false,
          lastValueVisible: false,
        });
        zone2RSeries.setData(candleData.map((bar) => ({
          time: bar.time,
          value: long2R, // Top of 2R zone
        })));

        // 3R Zone (dark green band from 2R to 3R)
        const zone3RSeries = chart.addAreaSeries({
          topColor: 'rgba(21, 128, 61, 0.20)',
          bottomColor: 'rgba(21, 128, 61, 0.12)',
          lineColor: 'transparent',
          priceLineVisible: false,
          lastValueVisible: false,
        });
        zone3RSeries.setData(candleData.map((bar) => ({
          time: bar.time,
          value: long3R, // Top of 3R zone
        })));
      }

      // Add boundary lines with labels
      const supportLine = createLineSeries('#ef4444', 0);
      supportLine.setData(candleData.map((bar) => ({ time: bar.time, value: zone.support })));

      const resistanceLine = createLineSeries('#22c55e', 0);
      resistanceLine.setData(candleData.map((bar) => ({ time: bar.time, value: zone.resistance })));

      const line1R = createLineSeries('#22c55e', 2);
      line1R.setData(candleData.map((bar) => ({ time: bar.time, value: long1R })));

      const line2R = createLineSeries('#16a34a', 2);
      line2R.setData(candleData.map((bar) => ({ time: bar.time, value: long2R })));

      const line3R = createLineSeries('#15803d', 2);
      line3R.setData(candleData.map((bar) => ({ time: bar.time, value: long3R })));

      // Add price line labels with zone names
      candleSeries.createPriceLine({
        price: longStop,
        color: '#f97316',
        lineWidth: 2,
        lineStyle: 0,
        axisLabelVisible: true,
        title: 'STOP LOSS',
      });

      candleSeries.createPriceLine({
        price: zone.resistance,
        color: '#fbbf24',
        lineWidth: 2,
        lineStyle: 0,
        axisLabelVisible: true,
        title: 'ENTRY',
      });

      candleSeries.createPriceLine({
        price: long1R,
        color: '#22c55e',
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: '1R TARGET',
      });

      candleSeries.createPriceLine({
        price: long2R,
        color: '#16a34a',
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: '2R TARGET',
      });

      candleSeries.createPriceLine({
        price: long3R,
        color: '#15803d',
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: '3R TARGET',
      });
    }

    // Remove old trade-specific zone rendering
    if (false && trade) {
      // Stop Loss Zone (red shading)
      const stopLossSeries = chart.addAreaSeries({
        topColor: 'rgba(239, 68, 68, 0.15)',
        bottomColor: 'rgba(239, 68, 68, 0.05)',
        lineColor: 'rgba(239, 68, 68, 0.3)',
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      const stopLossData = candleData.map((bar) => ({
        time: bar.time,
        value: trade.stopLoss,
      }));
      stopLossSeries.setData(stopLossData);

      // 1R Zone (light green)
      const oneRSeries = chart.addAreaSeries({
        topColor: 'rgba(34, 197, 94, 0.1)',
        bottomColor: 'rgba(34, 197, 94, 0.05)',
        lineColor: 'rgba(34, 197, 94, 0.3)',
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      const oneRData = candleData.map((bar) => ({
        time: bar.time,
        value: trade.target1R,
      }));
      oneRSeries.setData(oneRData);

      // 2R Zone (medium green)
      const twoRSeries = chart.addAreaSeries({
        topColor: 'rgba(22, 163, 74, 0.12)',
        bottomColor: 'rgba(22, 163, 74, 0.06)',
        lineColor: 'rgba(22, 163, 74, 0.4)',
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      const twoRData = candleData.map((bar) => ({
        time: bar.time,
        value: trade.target2R,
      }));
      twoRSeries.setData(twoRData);

      // 3R Zone (dark green)
      const threeRSeries = chart.addAreaSeries({
        topColor: 'rgba(21, 128, 61, 0.15)',
        bottomColor: 'rgba(21, 128, 61, 0.08)',
        lineColor: 'rgba(21, 128, 61, 0.5)',
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      const threeRData = candleData.map((bar) => ({
        time: bar.time,
        value: trade.target3R,
      }));
      threeRSeries.setData(threeRData);

      // Price lines for reference
      candleSeries.createPriceLine({
        price: trade.entryPrice,
        color: '#3b82f6',
        lineWidth: 2,
        lineStyle: 0, // Solid
        axisLabelVisible: true,
        title: 'Entry',
      });

      candleSeries.createPriceLine({
        price: trade.stopLoss,
        color: '#ef4444',
        lineWidth: 2,
        lineStyle: 0,
        axisLabelVisible: true,
        title: 'Stop',
      });

      candleSeries.createPriceLine({
        price: trade.target1R,
        color: '#22c55e',
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: '1R',
      });

      candleSeries.createPriceLine({
        price: trade.target2R,
        color: '#16a34a',
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: '2R',
      });

      candleSeries.createPriceLine({
        price: trade.target3R,
        color: '#15803d',
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: '3R',
      });
    }

    // Add signal markers
    const markers = signals.map((signal) => ({
      time: ((signal.timestamp - ET_OFFSET_MS) / 1000) as any, // Convert UTC to ET
      position: signal.direction === 'LONG' ? ('belowBar' as const) : ('aboveBar' as const),
      color: signal.type === 'CONFIRMATION' ? '#3b82f6' : signal.type === 'BREAK' ? '#f59e0b' : '#94a3b8',
      shape: signal.type === 'CONFIRMATION' ? ('arrowUp' as const) : ('circle' as const),
      text: signal.type,
    }));

    candleSeries.setMarkers(markers);

    chart.timeScale().fitContent();

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [bars, signals, zone, trade, showZones]);

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-slate-100">Candlestick Chart</h2>
        <button
          onClick={() => setShowZones(!showZones)}
          className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
            showZones
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
          }`}
        >
          {showZones ? '🎨 Hide Zones' : '🎨 Show Zones'}
        </button>
      </div>
      <div ref={chartContainerRef} />
    </div>
  );
}

function TradeSetupCard({
  resistance,
  support,
  status,
  actualTrade,
}: {
  resistance: number | null;
  support: number | null;
  status: string | null;
  actualTrade: any;
}) {
  if (resistance === null || support === null) {
    return (
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
        <h3 className="text-sm font-semibold text-slate-100 mb-3">Trade Setup</h3>
        <p className="text-slate-400 text-sm">No zone defined</p>
      </div>
    );
  }

  // Calculate LONG setup (recommended trade)
  const longEntry = resistance;
  const longStop = support;
  const rValue = longEntry - longStop;
  const target1R = longEntry + rValue;
  const target2R = longEntry + (rValue * 2);
  const target3R = longEntry + (rValue * 3);

  // Position sizing: 2% risk on $5,000 bankroll = $100 max risk
  const bankroll = 5000;
  const riskPercent = 2;
  const maxRiskDollars = (bankroll * riskPercent) / 100; // $100

  // Note: Prices from API are already in dollars (e.g., 210.19), not cents
  const entryDollars = longEntry;
  const stopDollars = longStop;
  const target1RDollars = target1R;
  const target2RDollars = target2R;
  const target3RDollars = target3R;
  const riskPerShareDollars = rValue; // Already in dollars

  const sharesRaw = maxRiskDollars / riskPerShareDollars;

  // Round down to nearest multiple of 4 for clean 50/25/25 split
  const shares = Math.floor(sharesRaw / 4) * 4;
  const shares50 = Math.floor(shares * 0.5);
  const shares25a = Math.floor(shares * 0.25);
  const shares25b = shares - shares50 - shares25a; // Remaining shares

  const totalCost = (shares * entryDollars).toFixed(2);
  const totalRisk = (shares * riskPerShareDollars).toFixed(2);

  const wasTradeEntered = actualTrade !== undefined;

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
      <h3 className="text-sm font-semibold text-slate-100 mb-3">
        {wasTradeEntered ? 'Actual Trade' : 'Recommended LONG Setup'}
      </h3>

      <div className="space-y-3 text-sm">
        {/* Bankroll & Position Size */}
        <div className="bg-slate-900/50 rounded p-2 space-y-1">
          <div className="flex justify-between">
            <span className="text-slate-400">Bankroll</span>
            <span className="text-slate-100 font-mono">${bankroll.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Risk</span>
            <span className="text-slate-100 font-mono">{riskPercent}% (${maxRiskDollars})</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400 font-semibold">Position Size</span>
            <span className="text-blue-400 font-mono font-semibold">{shares} shares</span>
          </div>
        </div>

        {/* Entry Order */}
        <div className="pt-2 border-t border-slate-700">
          <div className="text-xs font-semibold text-slate-300 mb-2">📈 ENTRY ORDER</div>
          <div className="bg-blue-500/10 border border-blue-500/30 rounded p-2 space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-400">Buy</span>
              <span className="text-blue-400 font-mono font-semibold">{shares} shares @ ${entryDollars.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Total Cost</span>
              <span className="text-slate-400 font-mono">${totalCost}</span>
            </div>
          </div>
        </div>

        {/* Exit Orders */}
        <div className="pt-2 border-t border-slate-700">
          <div className="text-xs font-semibold text-slate-300 mb-2">💰 EXIT ORDERS (50/25/25)</div>
          <div className="space-y-1.5">
            <div className="bg-green-500/10 border border-green-500/30 rounded p-2 flex justify-between items-center">
              <span className="text-green-400 font-medium">1R</span>
              <span className="text-green-400 font-mono">Sell {shares50} @ ${target1RDollars.toFixed(2)}</span>
            </div>
            <div className="bg-green-600/10 border border-green-600/30 rounded p-2 flex justify-between items-center">
              <span className="text-green-500 font-medium">2R</span>
              <span className="text-green-500 font-mono">Sell {shares25a} @ ${target2RDollars.toFixed(2)}</span>
            </div>
            <div className="bg-green-700/10 border border-green-700/30 rounded p-2 flex justify-between items-center">
              <span className="text-green-600 font-medium">3R</span>
              <span className="text-green-600 font-mono">Sell {shares25b} @ ${target3RDollars.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Stop Loss */}
        <div className="pt-2 border-t border-slate-700">
          <div className="text-xs font-semibold text-slate-300 mb-2">🛑 STOP LOSS</div>
          <div className="bg-orange-500/10 border border-orange-500/30 rounded p-2 space-y-1">
            <div className="flex justify-between">
              <span className="text-orange-400 font-medium">Initial</span>
              <span className="text-orange-400 font-mono">{shares} shares @ ${stopDollars.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Max Loss</span>
              <span className="text-red-400 font-mono">-${totalRisk}</span>
            </div>
            <div className="mt-2 pt-2 border-t border-orange-500/20 text-xs">
              <div className="text-slate-400">After 1R hits:</div>
              <div className="text-yellow-400 font-mono mt-0.5">Move stop → ${entryDollars.toFixed(2)} (breakeven)</div>
            </div>
          </div>
        </div>

        {/* Zone Status */}
        {status && (
          <div className="pt-2 border-t border-slate-700">
            <div className="flex justify-between items-center">
              <span className="text-slate-400 text-xs">Zone Status</span>
              <span className={`text-xs font-semibold px-2 py-1 rounded ${
                status.includes('CHOPPY') ? 'bg-yellow-500/20 text-yellow-400' :
                status.includes('DEGENERATE') ? 'bg-red-500/20 text-red-400' :
                status === 'DEFINED' ? 'bg-green-500/20 text-green-400' :
                'bg-slate-500/20 text-slate-100'
              }`}>
                {status.replace(/_/g, ' ')}
              </span>
            </div>
          </div>
        )}

        {/* Trade Entered Badge */}
        {wasTradeEntered && (
          <div className="pt-2 border-t border-slate-700">
            <div className="flex items-center justify-center">
              <span className="text-xs px-3 py-1.5 bg-blue-500/20 text-blue-400 rounded font-semibold border border-blue-500/30">
                ✓ TRADE WAS ENTERED
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TradeCard({ trade }: { trade: any }) {
  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
      <h3 className="text-sm font-semibold text-slate-100 mb-3">Trade Details</h3>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-slate-400">Direction</span>
          <span className={trade.direction === 'LONG' ? 'text-green-400' : 'text-red-400'}>
            {trade.direction}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">Entry</span>
          <PriceDisplay price={trade.entryPrice} />
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">Stop</span>
          <PriceDisplay price={trade.currentStop} />
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">R-Value</span>
          <PriceDisplay price={trade.rValue} />
        </div>
        <div className="pt-2 border-t border-slate-700 space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-slate-500">1R Target</span>
            <PriceDisplay price={trade.target1R} />
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-slate-500">2R Target</span>
            <PriceDisplay price={trade.target2R} />
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-slate-500">3R Target</span>
            <PriceDisplay price={trade.target3R} />
          </div>
        </div>
      </div>
    </div>
  );
}

function NarrativeView({ narrative }: { narrative: SessionNarrative }) {
  const sections = [
    narrative.overview,
    narrative.zoneFormation,
    narrative.signalSequence,
    narrative.tradeEntry,
    narrative.tradeManagement,
    narrative.outcome,
    narrative.assessment,
  ].filter(Boolean) as typeof narrative.overview[];

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
      <h2 className="text-xl font-semibold text-slate-100 mb-6">Session Narrative</h2>
      <div className="space-y-8">
        {sections.map((section, idx) => (
          <div key={idx} className="space-y-3">
            <h3 className="text-lg font-semibold text-slate-200">{section.title}</h3>

            {section.keyValues.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 bg-slate-900/50 rounded p-4">
                {section.keyValues.map((kv, kvIdx) => (
                  <div key={kvIdx}>
                    <p className="text-xs text-slate-500">{kv.label}</p>
                    <p className="text-sm font-semibold text-slate-100 mt-0.5">
                      {kv.type === 'r-value' && typeof kv.value === 'string' && !isNaN(parseFloat(kv.value)) ? (
                        <RValueBadge r={parseFloat(kv.value)} />
                      ) : kv.type === 'price' && typeof kv.value === 'string' && !isNaN(parseFloat(kv.value)) ? (
                        <PriceDisplay price={parseFloat(kv.value)} />
                      ) : (
                        kv.value
                      )}
                    </p>
                  </div>
                ))}
              </div>
            )}

            <div className="prose prose-invert prose-sm max-w-none">
              {section.paragraphs.map((para, paraIdx) => (
                <p key={paraIdx} className="text-slate-300">
                  {para}
                </p>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
