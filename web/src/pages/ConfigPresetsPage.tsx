import { useState, useEffect } from 'react';
import { api } from '../api/client.js';
import type { ConfigPreset } from '../api/types.js';
import { LoadingSpinner } from '../components/common/LoadingSpinner.js';
import { ConfigPresetForm } from '../components/config/ConfigPresetForm.js';

export default function ConfigPresetsPage() {
  const [presets, setPresets] = useState<ConfigPreset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingPreset, setEditingPreset] = useState<ConfigPreset | null>(null);

  useEffect(() => {
    loadPresets();
  }, []);

  async function loadPresets() {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getConfigPresets();
      setPresets(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load presets');
    } finally {
      setLoading(false);
    }
  }

  function handleCreate() {
    setEditingPreset(null);
    setFormOpen(true);
  }

  function handleEdit(preset: ConfigPreset) {
    setEditingPreset(preset);
    setFormOpen(true);
  }

  async function handleDelete(preset: ConfigPreset) {
    if (!confirm(`Delete preset "${preset.name}"?`)) return;

    try {
      await api.deleteConfigPreset(preset.id);
      await loadPresets();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete preset';
      alert(message);
    }
  }

  async function handleSetDefault(preset: ConfigPreset) {
    try {
      await api.setDefaultConfigPreset(preset.id);
      await loadPresets();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to set default';
      alert(message);
    }
  }

  function handleFormClose() {
    setFormOpen(false);
    setEditingPreset(null);
  }

  async function handleFormSave() {
    setFormOpen(false);
    setEditingPreset(null);
    await loadPresets();
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Configuration Presets</h1>
          <p className="text-sm text-slate-400 mt-1">Manage strategy configuration profiles</p>
        </div>
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Configuration Presets</h1>
          <p className="text-sm text-slate-400 mt-1">Manage strategy configuration profiles</p>
        </div>
        <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4">
          <p className="text-red-400">{error}</p>
          <button
            onClick={loadPresets}
            className="mt-3 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-100 rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Configuration Presets</h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage strategy parameters with named presets
          </p>
        </div>
        <button
          onClick={handleCreate}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors font-medium"
        >
          + Create Preset
        </button>
      </div>

      {/* Presets Table */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-900 border-b border-slate-700">
            <tr>
              <th className="text-left py-3 px-4 text-sm font-semibold text-slate-300">Name</th>
              <th className="text-left py-3 px-4 text-sm font-semibold text-slate-300">Default</th>
              <th className="text-left py-3 px-4 text-sm font-semibold text-slate-300">Max Breaks</th>
              <th className="text-left py-3 px-4 text-sm font-semibold text-slate-300">Zone Spread</th>
              <th className="text-left py-3 px-4 text-sm font-semibold text-slate-300">Targets</th>
              <th className="text-left py-3 px-4 text-sm font-semibold text-slate-300">Trailing Stop</th>
              <th className="text-right py-3 px-4 text-sm font-semibold text-slate-300">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700">
            {presets.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 px-4 text-center text-slate-400">
                  No presets found. Create your first preset to get started.
                </td>
              </tr>
            ) : (
              presets.map((preset) => (
                <tr key={preset.id} className="hover:bg-slate-750 transition-colors">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-100 font-medium">{preset.name}</span>
                      {preset.isDefault && (
                        <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded border border-blue-500/30">
                          DEFAULT
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    {preset.isDefault ? (
                      <span className="text-green-400">✓</span>
                    ) : (
                      <button
                        onClick={() => handleSetDefault(preset)}
                        className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                      >
                        Set as default
                      </button>
                    )}
                  </td>
                  <td className="py-3 px-4 text-slate-300">{preset.maxBreakAttempts}</td>
                  <td className="py-3 px-4 text-slate-300">
                    {preset.minZoneSpreadCents}¢ - {preset.maxZoneSpreadPercent}%
                  </td>
                  <td className="py-3 px-4 text-slate-300">
                    {preset.target1RMultiple}R / {preset.target2RMultiple}R / {preset.target3RMultiple}R
                  </td>
                  <td className="py-3 px-4">
                    {preset.trailingStopAt1R ? (
                      <span className="text-green-400">Enabled</span>
                    ) : (
                      <span className="text-slate-500">Disabled</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => handleEdit(preset)}
                        className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-100 rounded text-sm transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(preset)}
                        className="px-3 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={preset.isDefault}
                        title={preset.isDefault ? 'Cannot delete default preset' : 'Delete preset'}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Form Dialog */}
      {formOpen && (
        <ConfigPresetForm
          preset={editingPreset}
          onClose={handleFormClose}
          onSave={handleFormSave}
        />
      )}
    </div>
  );
}
