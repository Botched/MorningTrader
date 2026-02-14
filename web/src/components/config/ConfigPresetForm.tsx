import { useState } from 'react';
import { api } from '../../api/client.js';
import type { ConfigPreset, CreateConfigPresetRequest } from '../../api/types.js';

interface ConfigPresetFormProps {
  preset: ConfigPreset | null; // null = create mode, non-null = edit mode
  onClose: () => void;
  onSave: () => void;
}

export function ConfigPresetForm({ preset, onClose, onSave }: ConfigPresetFormProps) {
  const isEditMode = preset !== null;

  // Form state
  const [name, setName] = useState(preset?.name || '');
  const [maxBreakAttempts, setMaxBreakAttempts] = useState(preset?.maxBreakAttempts || 5);
  const [minZoneSpreadCents, setMinZoneSpreadCents] = useState(preset?.minZoneSpreadCents || 10);
  const [maxZoneSpreadPercent, setMaxZoneSpreadPercent] = useState(preset?.maxZoneSpreadPercent || 3.0);
  const [minZoneBars, setMinZoneBars] = useState(preset?.minZoneBars || 3);
  const [premarketTime, setPremarketTime] = useState(preset?.premarketTime || '04:30');
  const [zoneStartTime, setZoneStartTime] = useState(preset?.zoneStartTime || '09:30');
  const [zoneEndTime, setZoneEndTime] = useState(preset?.zoneEndTime || '10:00');
  const [executionEndTime, setExecutionEndTime] = useState(preset?.executionEndTime || '12:00');
  const [target1RMultiple, setTarget1RMultiple] = useState(preset?.target1RMultiple || 1.0);
  const [target2RMultiple, setTarget2RMultiple] = useState(preset?.target2RMultiple || 2.0);
  const [target3RMultiple, setTarget3RMultiple] = useState(preset?.target3RMultiple || 3.0);
  const [trailingStopAt1R, setTrailingStopAt1R] = useState(preset?.trailingStopAt1R ?? true);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function resetToDefaults() {
    if (!confirm('Reset all fields to factory defaults?')) return;

    setMaxBreakAttempts(5);
    setMinZoneSpreadCents(10);
    setMaxZoneSpreadPercent(3.0);
    setMinZoneBars(3);
    setPremarketTime('04:30');
    setZoneStartTime('09:30');
    setZoneEndTime('10:00');
    setExecutionEndTime('12:00');
    setTarget1RMultiple(1.0);
    setTarget2RMultiple(2.0);
    setTarget3RMultiple(3.0);
    setTrailingStopAt1R(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (name.trim() === '') {
      setError('Preset name is required');
      return;
    }

    try {
      setSaving(true);

      const data: CreateConfigPresetRequest = {
        name: name.trim(),
        maxBreakAttempts,
        minZoneSpreadCents,
        maxZoneSpreadPercent,
        minZoneBars,
        premarketTime,
        zoneStartTime,
        zoneEndTime,
        executionEndTime,
        target1RMultiple,
        target2RMultiple,
        target3RMultiple,
        trailingStopAt1R,
      };

      if (isEditMode) {
        await api.updateConfigPreset(preset.id, data);
      } else {
        await api.createConfigPreset(data);
      }

      onSave();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save preset');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-slate-800 rounded-lg border border-slate-700 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-slate-800 border-b border-slate-700 px-6 py-4">
          <h2 className="text-xl font-bold text-slate-100">
            {isEditMode ? 'Edit Preset' : 'Create New Preset'}
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Configure strategy parameters for this preset
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Error Banner */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-3">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Preset Name */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Preset Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Aggressive, Conservative, Default"
              required
            />
          </div>

          {/* Break Attempts */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Max Break Attempts
              </label>
              <input
                type="number"
                value={maxBreakAttempts}
                onChange={(e) => setMaxBreakAttempts(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="1"
                max="20"
              />
              <p className="text-xs text-slate-500 mt-1">Number of break attempts per direction</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Min Zone Bars
              </label>
              <input
                type="number"
                value={minZoneBars}
                onChange={(e) => setMinZoneBars(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="1"
                max="10"
              />
              <p className="text-xs text-slate-500 mt-1">Minimum bars to define zone</p>
            </div>
          </div>

          {/* Zone Spread Constraints */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Min Zone Spread (cents)
              </label>
              <input
                type="number"
                value={minZoneSpreadCents}
                onChange={(e) => setMinZoneSpreadCents(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="1"
              />
              <p className="text-xs text-slate-500 mt-1">Minimum zone size in cents</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Max Zone Spread (%)
              </label>
              <input
                type="number"
                step="0.1"
                value={maxZoneSpreadPercent}
                onChange={(e) => setMaxZoneSpreadPercent(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="0.1"
              />
              <p className="text-xs text-slate-500 mt-1">Maximum zone size as % of price</p>
            </div>
          </div>

          {/* Time Windows */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-200">Session Time Windows (ET)</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Premarket Time
                </label>
                <input
                  type="time"
                  value={premarketTime}
                  onChange={(e) => setPremarketTime(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Zone Start Time
                </label>
                <input
                  type="time"
                  value={zoneStartTime}
                  onChange={(e) => setZoneStartTime(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Zone End Time
                </label>
                <input
                  type="time"
                  value={zoneEndTime}
                  onChange={(e) => setZoneEndTime(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Execution End Time
                </label>
                <input
                  type="time"
                  value={executionEndTime}
                  onChange={(e) => setExecutionEndTime(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Target Multiples */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-200">Target R-Multiples</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Target 1R
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={target1RMultiple}
                  onChange={(e) => setTarget1RMultiple(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="0.1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Target 2R
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={target2RMultiple}
                  onChange={(e) => setTarget2RMultiple(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="0.1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Target 3R
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={target3RMultiple}
                  onChange={(e) => setTarget3RMultiple(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="0.1"
                />
              </div>
            </div>
          </div>

          {/* Trailing Stop */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="trailingStop"
              checked={trailingStopAt1R}
              onChange={(e) => setTrailingStopAt1R(e.target.checked)}
              className="w-4 h-4 bg-slate-900 border-slate-700 rounded text-blue-600 focus:ring-2 focus:ring-blue-500"
            />
            <label htmlFor="trailingStop" className="text-sm text-slate-300">
              Move stop to breakeven after 1R target hit
            </label>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-700">
            <button
              type="button"
              onClick={resetToDefaults}
              className="px-4 py-2 text-sm text-slate-400 hover:text-slate-300 transition-colors"
            >
              Reset to Defaults
            </button>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-100 rounded-lg transition-colors"
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={saving}
              >
                {saving ? 'Saving...' : isEditMode ? 'Update Preset' : 'Create Preset'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
