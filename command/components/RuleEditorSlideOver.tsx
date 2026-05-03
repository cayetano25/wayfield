'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import {
  platformAutomations,
  type AutomationRule,
} from '@/lib/platform-api';

interface RuleEditorSlideOverProps {
  rule: AutomationRule | null;
  open: boolean;
  onClose: () => void;
  onSaved: (rule: AutomationRule) => void;
}

function isValidJson(s: string): boolean {
  if (!s.trim()) return true;
  try { JSON.parse(s); return true; } catch { return false; }
}

export default function RuleEditorSlideOver({
  rule,
  open,
  onClose,
  onSaved,
}: RuleEditorSlideOverProps) {
  const [name, setName] = useState('');
  const [triggerType, setTriggerType] = useState('');
  const [actionType, setActionType] = useState('');
  const [orgId, setOrgId] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [conditionsJson, setConditionsJson] = useState('');
  const [actionConfigJson, setActionConfigJson] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setName(rule?.name ?? '');
      setTriggerType(rule?.trigger_type ?? '');
      setActionType(rule?.action_type ?? '');
      setOrgId(rule?.organization_id?.toString() ?? '');
      setIsActive(rule?.is_active ?? true);
      setConditionsJson('');
      setActionConfigJson('');
      setErrors({});
    }
  }, [open, rule]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    if (open) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  function validate() {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Name is required.';
    if (!triggerType.trim()) errs.triggerType = 'Trigger type is required.';
    if (!actionType.trim()) errs.actionType = 'Action type is required.';
    if (conditionsJson && !isValidJson(conditionsJson)) errs.conditionsJson = 'Must be valid JSON.';
    if (actionConfigJson && !isValidJson(actionConfigJson)) errs.actionConfigJson = 'Must be valid JSON.';
    return errs;
  }

  async function handleSave() {
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        trigger_type: triggerType.trim(),
        action_type: actionType.trim(),
        organization_id: orgId ? parseInt(orgId, 10) : null,
        is_active: isActive,
        conditions_json: conditionsJson.trim() || null,
        action_config_json: actionConfigJson.trim() || null,
      };
      const res = rule
        ? await platformAutomations.update(rule.id, payload)
        : await platformAutomations.create(payload);
      onSaved(res.data);
    } catch {
      setErrors({ general: 'Save failed. Please try again.' });
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <>
      <div
        data-testid="rule-editor-backdrop"
        className="fixed inset-0 z-30 bg-black/30"
        onClick={onClose}
      />
      <div
        data-testid="rule-editor-slideover"
        className="fixed inset-y-0 right-0 z-40 w-[520px] bg-white shadow-2xl flex flex-col"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200">
          <h2 className="font-heading text-lg font-semibold text-gray-900">
            {rule ? 'Edit Rule' : 'New Automation Rule'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Close"
          >
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
          {errors.general && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {errors.general}
            </p>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Trial expiry notification"
              className="w-full min-h-[44px] px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0FA3B1] focus:border-transparent"
            />
            {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Trigger Type</label>
              <input
                type="text"
                value={triggerType}
                onChange={(e) => setTriggerType(e.target.value)}
                placeholder="e.g. trial_expired"
                className="w-full min-h-[44px] px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0FA3B1] focus:border-transparent"
              />
              {errors.triggerType && <p className="mt-1 text-xs text-red-600">{errors.triggerType}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Action Type</label>
              <input
                type="text"
                value={actionType}
                onChange={(e) => setActionType(e.target.value)}
                placeholder="e.g. send_email"
                className="w-full min-h-[44px] px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0FA3B1] focus:border-transparent"
              />
              {errors.actionType && <p className="mt-1 text-xs text-red-600">{errors.actionType}</p>}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Organization ID <span className="text-gray-400 font-normal">(optional — leave blank for platform-wide)</span>
            </label>
            <input
              type="number"
              value={orgId}
              onChange={(e) => setOrgId(e.target.value)}
              placeholder="e.g. 42"
              className="w-full min-h-[44px] px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0FA3B1] focus:border-transparent"
            />
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="rule-is-active"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="rounded border-gray-300 text-[#0FA3B1] focus:ring-[#0FA3B1]"
            />
            <label htmlFor="rule-is-active" className="text-sm font-medium text-gray-700">
              Active
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Conditions JSON <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={conditionsJson}
              onChange={(e) => setConditionsJson(e.target.value)}
              rows={4}
              placeholder='{"threshold": 3}'
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#0FA3B1] focus:border-transparent resize-y"
            />
            {errors.conditionsJson && <p className="mt-1 text-xs text-red-600">{errors.conditionsJson}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Action Config JSON <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={actionConfigJson}
              onChange={(e) => setActionConfigJson(e.target.value)}
              rows={4}
              placeholder='{"template": "trial_expiry_v1"}'
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#0FA3B1] focus:border-transparent resize-y"
            />
            {errors.actionConfigJson && <p className="mt-1 text-xs text-red-600">{errors.actionConfigJson}</p>}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={saving}
            className="min-h-[44px] px-4 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="min-h-[44px] px-5 text-sm font-medium text-white bg-[#0FA3B1] rounded-lg hover:bg-[#0d8f9c] disabled:opacity-50 transition-colors focus:outline-none focus:ring-2 focus:ring-[#0FA3B1] focus:ring-offset-2"
          >
            {saving ? 'Saving…' : rule ? 'Save Changes' : 'Create Rule'}
          </button>
        </div>
      </div>
    </>
  );
}
