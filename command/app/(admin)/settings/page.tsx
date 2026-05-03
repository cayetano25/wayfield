'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  Check,
  Copy,
  Loader2,
  Pencil,
  Plus,
  Settings,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShieldOff,
  X,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import {
  platformConfig,
  platformAdmins,
  platformTwoFactor,
  type PlatformConfig,
  type PlatformAdminEntry,
  type AdminRole,
} from '@/lib/platform-api';
import { useAdminUser, can } from '@/contexts/AdminUserContext';
import { PageHeader } from '@/components/ui/PageHeader';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { useToast } from '@/components/ui/Toast';
import { TotpInput } from '@/components/ui/TotpInput';

// ─── Role badge ───────────────────────────────────────────────────────────────

const ROLE_COLORS: Record<AdminRole, string> = {
  super_admin: 'bg-purple-50 text-purple-700 ring-purple-200',
  admin:       'bg-blue-50 text-blue-700 ring-blue-200',
  support:     'bg-teal-50 text-teal-700 ring-teal-200',
  billing:     'bg-amber-50 text-amber-700 ring-amber-200',
  readonly:    'bg-gray-100 text-gray-600 ring-gray-200',
};

function RoleBadge({ role }: { role: AdminRole }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${ROLE_COLORS[role] ?? ROLE_COLORS.readonly}`}>
      {role.replace('_', ' ')}
    </span>
  );
}

// ─── Inline config editor row ─────────────────────────────────────────────────

function ConfigRow({ item, onSaved }: { item: PlatformConfig; onSaved: (updated: PlatformConfig) => void }) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  function startEdit() {
    setDraft(item.config_value);
    setEditing(true);
  }

  function cancel() {
    setEditing(false);
    setDraft('');
  }

  async function save() {
    setSaving(true);
    try {
      const { data } = await platformConfig.update(item.config_key, draft);
      onSaved(data);
      setEditing(false);
      toast(`Config "${item.config_key}" updated.`, 'success');
    } catch {
      toast('Failed to update config.', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-start justify-between gap-4 py-4 border-b border-gray-100 last:border-0">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-0.5">
          <code className="text-sm font-mono text-gray-800">{item.config_key}</code>
        </div>
        {item.description && (
          <p className="text-xs text-gray-400">{item.description}</p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {editing ? (
          <>
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="min-h-[40px] w-64 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0FA3B1]"
              aria-label={`Edit ${item.config_key}`}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') save();
                if (e.key === 'Escape') cancel();
              }}
            />
            <button
              onClick={save}
              disabled={saving}
              className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg bg-teal-50 text-teal-700 hover:bg-teal-100 disabled:opacity-50 transition-colors"
              aria-label="Save"
            >
              <Check size={14} />
            </button>
            <button
              onClick={cancel}
              disabled={saving}
              className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 disabled:opacity-50 transition-colors"
              aria-label="Cancel edit"
            >
              <X size={14} />
            </button>
          </>
        ) : (
          <>
            <span className="text-sm text-gray-700 font-mono max-w-[240px] truncate">
              {item.config_value || <span className="text-gray-300 italic">empty</span>}
            </span>
            <button
              onClick={startEdit}
              className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
              aria-label={`Edit ${item.config_key}`}
            >
              <Pencil size={14} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Recovery codes display ───────────────────────────────────────────────────

function RecoveryCodesGrid({
  codes,
  onCopyAll,
  copied,
}: {
  codes: string[];
  onCopyAll: () => void;
  copied: boolean;
}) {
  return (
    <div>
      <div className="grid grid-cols-2 gap-2 mb-4">
        {codes.map((code, i) => (
          <div
            key={i}
            className="font-mono text-sm bg-gray-100 px-3 py-2 rounded-lg text-center text-gray-800 tracking-widest"
          >
            {code}
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={onCopyAll}
        className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg px-3 py-2 min-h-[44px] transition-colors"
      >
        {copied ? <Check size={14} className="text-teal-600" /> : <Copy size={14} />}
        {copied ? 'Copied!' : 'Copy all codes'}
      </button>
    </div>
  );
}

// ─── 2FA Setup modal (3-step) ─────────────────────────────────────────────────

interface SetupModalProps {
  onClose: () => void;
  onSetupComplete: () => void;
}

function SetupModal({ onClose, onSetupComplete }: SetupModalProps) {
  const { toast } = useToast();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(true);
  const [secret, setSecret] = useState('');
  const [qrSvg, setQrSvg] = useState('');
  const [secretCopied, setSecretCopied] = useState(false);
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [codesCopied, setCodesCopied] = useState(false);
  const [savedChecked, setSavedChecked] = useState(false);

  useEffect(() => {
    platformTwoFactor.setup()
      .then(({ data }) => {
        if (data.already_configured) {
          toast('2FA is already configured.', 'info');
          onClose();
          return;
        }
        setSecret(data.secret);
        setQrSvg(data.qr_code_svg);
      })
      .catch(() => toast('Failed to load 2FA setup.', 'error'))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleConfirm() {
    if (code.length !== 6) return;
    setConfirming(true);
    setCodeError(null);
    try {
      const { data } = await platformTwoFactor.confirm(code);
      setRecoveryCodes(data.recovery_codes);
      setStep(3);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Invalid code. Please check your app and try again.';
      setCodeError(msg);
      setCode('');
    } finally {
      setConfirming(false);
    }
  }

  function copySecret() {
    navigator.clipboard.writeText(secret).then(() => {
      setSecretCopied(true);
      setTimeout(() => setSecretCopied(false), 2000);
    });
  }

  function copyAllCodes() {
    navigator.clipboard.writeText(recoveryCodes.join('\n')).then(() => {
      setCodesCopied(true);
      setTimeout(() => setCodesCopied(false), 2000);
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" role="dialog" aria-modal="true">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-5">
          <span className="text-xs text-gray-400 font-mono">
            Step {step} of 3
          </span>
          <div className="flex gap-1 ml-auto">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`h-1.5 w-6 rounded-full transition-colors ${s <= step ? 'bg-[#0FA3B1]' : 'bg-gray-200'}`}
              />
            ))}
          </div>
        </div>

        {/* ── Step 1: Scan ── */}
        {step === 1 && (
          <>
            <h2
              className="text-lg font-semibold text-gray-900 mb-2"
              style={{ fontFamily: 'var(--font-sora, sans-serif)' }}
            >
              Set up two-factor authentication
            </h2>
            <p className="text-sm text-gray-500 mb-5">
              Scan this QR code with your authenticator app (Google Authenticator, Authy, 1Password, etc.)
            </p>

            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 size={32} className="animate-spin text-gray-300" />
              </div>
            ) : (
              <>
                {/* QR code */}
                <div
                  className="flex justify-center mb-4 p-4 bg-white border border-gray-100 rounded-xl"
                  dangerouslySetInnerHTML={{ __html: qrSvg }}
                />

                {/* Manual secret */}
                <p className="text-xs text-gray-500 mb-2">
                  Can&apos;t scan? Enter this code manually:
                </p>
                <div className="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-2">
                  <code className="text-sm font-mono text-gray-700 flex-1 break-all">{secret}</code>
                  <button
                    type="button"
                    onClick={copySecret}
                    className="shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-400 hover:text-gray-700 transition-colors"
                    aria-label="Copy secret"
                  >
                    {secretCopied ? <Check size={14} className="text-teal-600" /> : <Copy size={14} />}
                  </button>
                </div>
              </>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={onClose}
                className="min-h-[44px] px-4 text-sm text-gray-600 hover:text-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => setStep(2)}
                disabled={loading}
                className="min-h-[44px] px-5 text-sm font-medium text-white bg-[#0FA3B1] rounded-lg hover:bg-[#0d8f9c] disabled:opacity-50 transition-colors"
              >
                I&apos;ve scanned the code →
              </button>
            </div>
          </>
        )}

        {/* ── Step 2: Verify ── */}
        {step === 2 && (
          <>
            <h2
              className="text-lg font-semibold text-gray-900 mb-2"
              style={{ fontFamily: 'var(--font-sora, sans-serif)' }}
            >
              Enter the code from your app
            </h2>
            <p className="text-sm text-gray-500 mb-6">
              Open your authenticator app and enter the 6-digit code for Wayfield.
            </p>

            <TotpInput value={code} onChange={setCode} disabled={confirming} />

            <div className="mt-3 min-h-[20px]">
              {codeError && (
                <div className="flex items-center gap-2">
                  <AlertTriangle size={14} className="text-red-500 shrink-0" />
                  <span className="text-sm text-red-600">{codeError}</span>
                </div>
              )}
            </div>

            <div className="mt-4 flex justify-end gap-3">
              <button
                onClick={() => { setStep(1); setCode(''); setCodeError(null); }}
                disabled={confirming}
                className="min-h-[44px] px-4 text-sm text-gray-600 hover:text-gray-800 disabled:opacity-50 transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleConfirm}
                disabled={code.length !== 6 || confirming}
                className="min-h-[44px] px-5 text-sm font-medium text-white bg-[#0FA3B1] rounded-lg hover:bg-[#0d8f9c] disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                {confirming && <Loader2 size={14} className="animate-spin" />}
                Confirm
              </button>
            </div>
          </>
        )}

        {/* ── Step 3: Recovery codes ── */}
        {step === 3 && (
          <>
            <h2
              className="text-lg font-semibold text-gray-900 mb-4"
              style={{ fontFamily: 'var(--font-sora, sans-serif)' }}
            >
              Save your recovery codes
            </h2>

            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-4 flex items-start gap-3">
              <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800">
                These codes are shown once and cannot be retrieved again. Save them somewhere
                safe — like a password manager.
              </p>
            </div>

            <RecoveryCodesGrid
              codes={recoveryCodes}
              onCopyAll={copyAllCodes}
              copied={codesCopied}
            />

            <label className="flex items-center gap-3 mt-5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={savedChecked}
                onChange={(e) => setSavedChecked(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-[#0FA3B1] focus:ring-[#0FA3B1]"
              />
              <span className="text-sm text-gray-700">I have saved my recovery codes</span>
            </label>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => { onSetupComplete(); onClose(); }}
                disabled={!savedChecked}
                className="min-h-[44px] px-5 text-sm font-medium text-white bg-[#0FA3B1] rounded-lg hover:bg-[#0d8f9c] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Done — finish setup
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── 2FA Regenerate recovery codes modal ─────────────────────────────────────

interface RegenerateModalProps {
  onClose: () => void;
}

function RegenerateModal({ onClose }: RegenerateModalProps) {
  const { toast } = useToast();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [newCodes, setNewCodes] = useState<string[] | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleRegenerate() {
    if (code.length !== 6) return;
    setLoading(true);
    setError(null);
    try {
      const { data } = await platformTwoFactor.regenerateRecoveryCodes(code);
      setNewCodes(data.recovery_codes);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Failed to regenerate codes.';
      setError(msg);
      setCode('');
    } finally {
      setLoading(false);
    }
  }

  function copyAllCodes() {
    if (!newCodes) return;
    navigator.clipboard.writeText(newCodes.join('\n')).then(() => {
      setCopied(true);
      toast('Recovery codes copied.', 'success');
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" role="dialog" aria-modal="true">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
        <h2
          className="text-lg font-semibold text-gray-900 mb-2"
          style={{ fontFamily: 'var(--font-sora, sans-serif)' }}
        >
          Regenerate recovery codes
        </h2>

        {!newCodes ? (
          <>
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-5 flex items-start gap-3">
              <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800">
                Your current recovery codes will be permanently replaced.
              </p>
            </div>

            <p className="text-sm text-gray-600 mb-3">
              Enter your current TOTP code to confirm.
            </p>

            <TotpInput value={code} onChange={setCode} disabled={loading} />

            <div className="mt-3 min-h-[20px]">
              {error && (
                <div className="flex items-center gap-2">
                  <AlertTriangle size={14} className="text-red-500 shrink-0" />
                  <span className="text-sm text-red-600">{error}</span>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={onClose}
                disabled={loading}
                className="min-h-[44px] px-4 text-sm text-gray-600 hover:text-gray-800 disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRegenerate}
                disabled={code.length !== 6 || loading}
                className="min-h-[44px] px-5 text-sm font-medium text-white bg-[#0FA3B1] rounded-lg hover:bg-[#0d8f9c] disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                {loading && <Loader2 size={14} className="animate-spin" />}
                Regenerate
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-4 flex items-start gap-3">
              <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800">
                Save these codes now — they cannot be retrieved again.
              </p>
            </div>

            <RecoveryCodesGrid codes={newCodes} onCopyAll={copyAllCodes} copied={copied} />

            <div className="mt-6 flex justify-end">
              <button
                onClick={onClose}
                className="min-h-[44px] px-5 text-sm font-medium text-white bg-[#0FA3B1] rounded-lg hover:bg-[#0d8f9c] transition-colors"
              >
                Done
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── 2FA Disable modal ────────────────────────────────────────────────────────

interface DisableModalProps {
  onClose: () => void;
  onDisabled: () => void;
}

function DisableModal({ onClose, onDisabled }: DisableModalProps) {
  const { toast } = useToast();
  const [password, setPassword] = useState('');
  const [useRecovery, setUseRecovery] = useState(false);
  const [code, setCode] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleDisable() {
    if (!password) return;
    const codeProvided = useRecovery ? recoveryCode.trim() : code;
    if (!codeProvided) return;

    setLoading(true);
    setError(null);
    try {
      await platformTwoFactor.disable(
        useRecovery
          ? { password, recovery_code: codeProvided }
          : { password, code: codeProvided },
      );
      toast('Two-factor authentication disabled.', 'success');
      onDisabled();
      onClose();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Failed to disable 2FA.';
      setError(msg);
      setCode('');
    } finally {
      setLoading(false);
    }
  }

  const canSubmit = password.length > 0 && (useRecovery ? recoveryCode.trim().length > 0 : code.length === 6);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" role="dialog" aria-modal="true">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
        <h2
          className="text-lg font-semibold text-gray-900 mb-2"
          style={{ fontFamily: 'var(--font-sora, sans-serif)' }}
        >
          Disable two-factor authentication
        </h2>

        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-5 flex items-start gap-3">
          <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800">
            Disabling 2FA makes your account less secure.
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Current password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full min-h-[44px] px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0FA3B1]"
              autoComplete="current-password"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">
                {useRecovery ? 'Recovery code' : 'Current TOTP code'}
              </label>
              <button
                type="button"
                onClick={() => { setUseRecovery(!useRecovery); setCode(''); setRecoveryCode(''); }}
                className="text-xs text-[#0FA3B1] hover:underline"
              >
                {useRecovery ? 'Use authenticator code instead' : 'Use a recovery code instead'}
              </button>
            </div>

            {useRecovery ? (
              <input
                type="text"
                value={recoveryCode}
                onChange={(e) => setRecoveryCode(e.target.value.toUpperCase())}
                placeholder="XXXXX-XXXXX"
                className="w-full min-h-[44px] px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono tracking-widest uppercase focus:outline-none focus:ring-2 focus:ring-[#0FA3B1]"
                autoComplete="off"
              />
            ) : (
              <TotpInput value={code} onChange={setCode} disabled={loading} />
            )}
          </div>
        </div>

        <div className="mt-3 min-h-[20px]">
          {error && (
            <div className="flex items-center gap-2">
              <AlertTriangle size={14} className="text-red-500 shrink-0" />
              <span className="text-sm text-red-600">{error}</span>
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="min-h-[44px] px-4 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleDisable}
            disabled={!canSubmit || loading}
            className="min-h-[44px] px-5 text-sm font-medium text-white bg-[#E94F37] rounded-lg hover:bg-[#d0412d] disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            Disable 2FA
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── 2FA Status section ───────────────────────────────────────────────────────

interface TwoFactorSectionProps {
  enabled: boolean;
  onSetupComplete: () => void;
  onDisabled: () => void;
  sectionRef: React.RefObject<HTMLDivElement | null>;
  initialOpen?: boolean;
}

function TwoFactorSection({ enabled, onSetupComplete, onDisabled, sectionRef, initialOpen }: TwoFactorSectionProps) {
  const [setupOpen, setSetupOpen] = useState(initialOpen ?? false);
  const [disableOpen, setDisableOpen] = useState(false);
  const [regenerateOpen, setRegenerateOpen] = useState(false);

  return (
    <section ref={sectionRef} className="mb-10">
      <h2
        className="font-heading text-base font-semibold text-gray-900 mb-4 flex items-center gap-2"
        style={{ fontFamily: 'var(--font-sora, sans-serif)' }}
      >
        <Shield size={16} className="text-gray-400" />
        Two-Factor Authentication
      </h2>

      {!enabled ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
          <div className="flex items-start gap-4">
            <ShieldAlert size={24} className="text-amber-500 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-amber-900 mb-1">
                Two-factor authentication is not enabled
              </p>
              <p className="text-sm text-amber-700">
                Enable 2FA to protect this account from unauthorised access.
              </p>
            </div>
            <button
              onClick={() => setSetupOpen(true)}
              className="shrink-0 min-h-[44px] px-4 text-sm font-medium text-white bg-[#E67E22] rounded-lg hover:bg-[#d06a1b] transition-colors"
            >
              Set Up Two-Factor Auth
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-start gap-4">
            <ShieldCheck size={24} className="text-[#0FA3B1] shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 mb-0.5">
                Two-factor authentication is enabled
              </p>
              <p className="text-sm text-gray-500">
                Your account is protected by TOTP authentication.
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => setRegenerateOpen(true)}
                className="min-h-[44px] px-3 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Regenerate recovery codes
              </button>
              <button
                onClick={() => setDisableOpen(true)}
                className="min-h-[44px] px-3 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
              >
                Disable two-factor auth
              </button>
            </div>
          </div>
        </div>
      )}

      {setupOpen && (
        <SetupModal
          onClose={() => setSetupOpen(false)}
          onSetupComplete={onSetupComplete}
        />
      )}
      {disableOpen && (
        <DisableModal
          onClose={() => setDisableOpen(false)}
          onDisabled={onDisabled}
        />
      )}
      {regenerateOpen && (
        <RegenerateModal onClose={() => setRegenerateOpen(false)} />
      )}
    </section>
  );
}

// ─── Reset 2FA for another admin modal ───────────────────────────────────────

interface Reset2FAModalProps {
  target: PlatformAdminEntry;
  onClose: () => void;
  onReset: (adminId: number) => void;
}

function Reset2FAModal({ target, onClose, onReset }: Reset2FAModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  async function handleReset() {
    setLoading(true);
    try {
      await platformTwoFactor.disableForAdmin(target.id);
      toast(`2FA reset for ${target.first_name} ${target.last_name}.`, 'success');
      onReset(target.id);
      onClose();
    } catch {
      toast('Failed to reset 2FA.', 'error');
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" role="dialog" aria-modal="true">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
        <h2
          className="text-lg font-semibold text-gray-900 mb-2"
          style={{ fontFamily: 'var(--font-sora, sans-serif)' }}
        >
          Reset 2FA for {target.first_name} {target.last_name}
        </h2>
        <p className="text-sm text-gray-600 mb-5">
          This will disable two-factor authentication for their account. They will need to
          set it up again on next login. This action is logged to the platform audit trail.
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="min-h-[44px] px-4 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleReset}
            disabled={loading}
            className="min-h-[44px] px-5 text-sm font-medium text-white bg-[#E67E22] rounded-lg hover:bg-[#d06a1b] disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            Reset 2FA
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Invite admin modal ───────────────────────────────────────────────────────

const INVITABLE_ROLES: Array<{ value: Exclude<AdminRole, 'super_admin'>; label: string }> = [
  { value: 'admin', label: 'Admin' },
  { value: 'support', label: 'Support' },
  { value: 'billing', label: 'Billing' },
  { value: 'readonly', label: 'Read-only' },
];

interface InviteAdminModalProps {
  onClose: () => void;
  onCreated: (admin: PlatformAdminEntry) => void;
}

function InviteAdminModal({ onClose, onCreated }: InviteAdminModalProps) {
  const { toast } = useToast();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Exclude<AdminRole, 'super_admin'>>('support');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function handleSubmit() {
    const errs: Record<string, string> = {};
    if (!firstName.trim()) errs.firstName = 'Required.';
    if (!lastName.trim()) errs.lastName = 'Required.';
    if (!email.trim()) errs.email = 'Required.';
    if (password.length < 12) errs.password = 'Must be at least 12 characters.';
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setSaving(true);
    try {
      const { data } = await platformAdmins.create({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim(),
        password,
        password_confirmation: password,
        role,
      });
      onCreated(data);
      toast(`${data.first_name} ${data.last_name} added.`, 'success');
    } catch {
      setErrors({ general: 'Failed to create admin. The email may already be in use.' });
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" role="dialog" aria-modal="true">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
        <h2 className="font-heading text-lg font-semibold text-gray-900 mb-5">Add Platform Admin</h2>

        {errors.general && (
          <p className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {errors.general}
          </p>
        )}

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">First name</label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0FA3B1]"
              />
              {errors.firstName && <p className="mt-1 text-xs text-red-600">{errors.firstName}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Last name</label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0FA3B1]"
              />
              {errors.lastName && <p className="mt-1 text-xs text-red-600">{errors.lastName}</p>}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full min-h-[44px] px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0FA3B1]"
            />
            {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min 12 characters"
              className="w-full min-h-[44px] px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0FA3B1]"
            />
            {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as Exclude<AdminRole, 'super_admin'>)}
              className="w-full min-h-[44px] px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0FA3B1]"
            >
              {INVITABLE_ROLES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={saving}
            className="min-h-[44px] px-4 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="min-h-[44px] px-5 text-sm font-medium text-white bg-[#0FA3B1] rounded-lg hover:bg-[#0d8f9c] disabled:opacity-50 transition-colors"
          >
            {saving ? 'Adding…' : 'Add Admin'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Edit role modal ──────────────────────────────────────────────────────────

const ALL_ROLES: Array<{ value: AdminRole; label: string }> = [
  { value: 'super_admin', label: 'Super Admin' },
  { value: 'admin', label: 'Admin' },
  { value: 'support', label: 'Support' },
  { value: 'billing', label: 'Billing' },
  { value: 'readonly', label: 'Read-only' },
];

interface EditRoleModalProps {
  target: PlatformAdminEntry;
  isLastSuperAdmin: boolean;
  currentUserId: number;
  onClose: () => void;
  onSaved: (admin: PlatformAdminEntry) => void;
}

function EditRoleModal({ target, isLastSuperAdmin, currentUserId, onClose, onSaved }: EditRoleModalProps) {
  const { toast } = useToast();
  const [role, setRole] = useState<AdminRole>(target.role);
  const [saving, setSaving] = useState(false);

  const isSelf = target.id === currentUserId;

  async function handleSave() {
    setSaving(true);
    try {
      const { data } = await platformAdmins.updateRole(target.id, role);
      onSaved(data);
      toast(`${target.first_name}'s role updated.`, 'success');
    } catch {
      toast('Failed to update role.', 'error');
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" role="dialog" aria-modal="true">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
        <h2 className="font-heading text-lg font-semibold text-gray-900 mb-2">Edit Role</h2>
        <p className="text-sm text-gray-500 mb-5">
          {target.first_name} {target.last_name} — {target.email}
        </p>
        {isSelf && (
          <p className="mb-4 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            You cannot modify your own role.
          </p>
        )}
        <div className="space-y-2">
          {ALL_ROLES.map((r) => {
            const disabledDemote = isLastSuperAdmin && target.role === 'super_admin' && r.value !== 'super_admin';
            const disabled = isSelf || disabledDemote;
            return (
              <label
                key={r.value}
                className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors ${
                  role === r.value ? 'border-[#0FA3B1] bg-teal-50' : 'border-gray-200 hover:border-gray-300'
                } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <input
                  type="radio"
                  value={r.value}
                  checked={role === r.value}
                  onChange={() => { if (!disabled) setRole(r.value); }}
                  disabled={disabled}
                  className="text-[#0FA3B1] focus:ring-[#0FA3B1]"
                />
                <span className="text-sm font-medium text-gray-700">{r.label}</span>
                {r.value === 'super_admin' && disabledDemote && (
                  <span className="ml-auto text-xs text-gray-400">last super admin</span>
                )}
              </label>
            );
          })}
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={saving}
            className="min-h-[44px] px-4 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || isSelf || role === target.role}
            className="min-h-[44px] px-5 text-sm font-medium text-white bg-[#0FA3B1] rounded-lg hover:bg-[#0d8f9c] disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { adminUser, setAdminUser } = useAdminUser();
  const router = useRouter();
  const { toast } = useToast();

  const [configs, setConfigs] = useState<PlatformConfig[]>([]);
  const [configLoading, setConfigLoading] = useState(true);
  const [configError, setConfigError] = useState<string | null>(null);

  const [admins, setAdmins] = useState<PlatformAdminEntry[]>([]);
  const [adminsLoading, setAdminsLoading] = useState(true);
  const [adminsError, setAdminsError] = useState<string | null>(null);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [editRoleTarget, setEditRoleTarget] = useState<PlatformAdminEntry | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<PlatformAdminEntry | null>(null);
  const [deactivating, setDeactivating] = useState(false);
  const [resetTfaTarget, setResetTfaTarget] = useState<PlatformAdminEntry | null>(null);

  // Local 2FA enabled state for the logged-in admin (refreshed after setup/disable)
  const [twoFactorEnabled, setTwoFactorEnabled] = useState<boolean>(
    adminUser?.two_factor_enabled ?? false,
  );
  const [setupAutoOpen, setSetupAutoOpen] = useState(false);
  const twoFactorSectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!adminUser) return;
    if (!can.manageSettings(adminUser.role)) router.replace('/');
    setTwoFactorEnabled(adminUser.two_factor_enabled ?? false);
  }, [adminUser, router]);

  useEffect(() => {
    platformConfig
      .list()
      .then(({ data }) => setConfigs(data))
      .catch(() => setConfigError('Failed to load config.'))
      .finally(() => setConfigLoading(false));

    platformAdmins
      .list()
      .then(({ data }) => setAdmins(data.data))
      .catch(() => setAdminsError('Failed to load admin users.'))
      .finally(() => setAdminsLoading(false));
  }, []);

  const activeSuperAdminCount = admins.filter(
    (a) => a.role === 'super_admin' && a.is_active
  ).length;

  function isLastSuperAdmin(target: PlatformAdminEntry): boolean {
    return target.role === 'super_admin' && activeSuperAdminCount <= 1;
  }

  async function handleDeactivate() {
    if (!deactivateTarget) return;
    setDeactivating(true);
    try {
      const { data } = await platformAdmins.updateStatus(deactivateTarget.id, false);
      setAdmins((prev) => prev.map((a) => (a.id === data.id ? data : a)));
      toast(`${deactivateTarget.first_name} deactivated.`, 'success');
      setDeactivateTarget(null);
    } catch {
      toast('Failed to update status.', 'error');
      setDeactivating(false);
    }
  }

  function scrollToTwoFactor() {
    twoFactorSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function handleSetupComplete() {
    setTwoFactorEnabled(true);
    if (adminUser) {
      setAdminUser({ ...adminUser, two_factor_enabled: true });
    }
    setAdmins((prev) =>
      prev.map((a) => (a.id === adminUser?.id ? { ...a, two_factor_enabled: true } : a)),
    );
  }

  function handleDisabled() {
    setTwoFactorEnabled(false);
    if (adminUser) {
      setAdminUser({ ...adminUser, two_factor_enabled: false });
    }
    setAdmins((prev) =>
      prev.map((a) => (a.id === adminUser?.id ? { ...a, two_factor_enabled: false } : a)),
    );
  }

  if (!adminUser || !can.manageSettings(adminUser.role)) return null;

  return (
    <div>
      <PageHeader title="Settings" />

      {/* ── 2FA setup prompt banner (top of page) ──────────────────────────── */}
      {!twoFactorEnabled && (
        <div className="mb-8 bg-amber-50 border border-amber-300 rounded-xl px-5 py-4 flex items-center gap-4">
          <ShieldAlert size={20} className="text-amber-500 shrink-0" />
          <p className="text-sm text-amber-800 flex-1">
            Your account does not have two-factor authentication enabled.
          </p>
          <button
            onClick={() => {
              scrollToTwoFactor();
              setSetupAutoOpen(true);
            }}
            className="shrink-0 min-h-[44px] px-4 text-sm font-medium text-white bg-[#E67E22] rounded-lg hover:bg-[#d06a1b] transition-colors"
          >
            Set Up Now →
          </button>
        </div>
      )}

      {/* ── Platform Config ──────────────────────────────────────────────────── */}
      <section className="mb-10">
        <h2 className="font-heading text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Settings size={16} className="text-gray-400" />
          Platform Config
        </h2>

        {configError && <div className="mb-4"><ErrorBanner message={configError} /></div>}

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 px-6">
          {configLoading ? (
            <div className="py-8 space-y-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="animate-pulse bg-gray-100 h-10 rounded" />
              ))}
            </div>
          ) : configs.length === 0 ? (
            <p className="py-8 text-sm text-gray-400 text-center">No config keys found.</p>
          ) : (
            configs.map((item) => (
              <ConfigRow
                key={item.config_key}
                item={item}
                onSaved={(updated) =>
                  setConfigs((prev) => prev.map((c) => (c.config_key === updated.config_key ? updated : c)))
                }
              />
            ))
          )}
        </div>
      </section>

      {/* ── Two-Factor Authentication ─────────────────────────────────────────── */}
      <TwoFactorSection
        enabled={twoFactorEnabled}
        onSetupComplete={handleSetupComplete}
        onDisabled={handleDisabled}
        sectionRef={twoFactorSectionRef}
        initialOpen={setupAutoOpen}
      />

      {/* ── Admin Users ───────────────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-heading text-base font-semibold text-gray-900">Platform Admins</h2>
          <button
            onClick={() => setInviteOpen(true)}
            className="flex items-center gap-2 min-h-[44px] px-4 bg-[#0FA3B1] text-white text-sm font-medium rounded-lg hover:bg-[#0d8f9c] transition-colors"
          >
            <Plus size={16} />
            Add Admin
          </button>
        </div>

        {adminsError && <div className="mb-4"><ErrorBanner message={adminsError} /></div>}

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          {adminsLoading ? (
            <div className="p-6 space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="animate-pulse bg-gray-100 h-14 rounded-xl" />
              ))}
            </div>
          ) : admins.length === 0 ? (
            <p className="py-8 text-sm text-gray-400 text-center">No admins found.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {admins.map((admin) => (
                <div key={admin.id} className="flex items-center gap-4 px-6 py-4">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-gray-900">
                      {admin.first_name} {admin.last_name}
                      {admin.id === adminUser.id && (
                        <span className="ml-2 text-xs text-gray-400">(you)</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-400">{admin.email}</div>
                  </div>
                  <RoleBadge role={admin.role} />

                  {/* 2FA status icon */}
                  {admin.two_factor_enabled ? (
                    <ShieldCheck
                      size={16}
                      className="text-[#0FA3B1] shrink-0"
                      aria-label="2FA enabled"
                    />
                  ) : (
                    <ShieldOff
                      size={16}
                      className="text-gray-300 shrink-0"
                      aria-label="2FA not configured"
                    />
                  )}

                  <span className={`text-xs ${admin.is_active ? 'text-teal-600' : 'text-gray-400'}`}>
                    {admin.is_active ? 'Active' : 'Inactive'}
                  </span>
                  {admin.last_login_at && (
                    <span className="text-xs text-gray-400 hidden xl:block">
                      {formatDistanceToNow(new Date(admin.last_login_at), { addSuffix: true })}
                    </span>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditRoleTarget(admin)}
                      disabled={admin.id === adminUser.id}
                      className="text-xs text-[#0FA3B1] hover:text-[#0d8f9c] px-2 py-1 rounded hover:bg-teal-50 transition-colors min-h-[44px] disabled:opacity-40 disabled:cursor-not-allowed"
                      aria-label={`Edit role of ${admin.first_name}`}
                    >
                      Edit role
                    </button>
                    {/* Reset 2FA — super_admin only, other accounts only, 2FA must be on */}
                    {can.manageSettings(adminUser.role) && admin.id !== adminUser.id && admin.two_factor_enabled && (
                      <button
                        onClick={() => setResetTfaTarget(admin)}
                        className="text-xs text-amber-600 hover:text-amber-700 px-2 py-1 rounded hover:bg-amber-50 transition-colors min-h-[44px]"
                        aria-label={`Reset 2FA for ${admin.first_name}`}
                      >
                        Reset 2FA
                      </button>
                    )}
                    {admin.is_active && admin.id !== adminUser.id && (
                      <button
                        onClick={() => setDeactivateTarget(admin)}
                        disabled={isLastSuperAdmin(admin)}
                        className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50 transition-colors min-h-[44px] disabled:opacity-40 disabled:cursor-not-allowed"
                        aria-label={`Deactivate ${admin.first_name}`}
                        title={isLastSuperAdmin(admin) ? 'Cannot deactivate last active super admin' : undefined}
                      >
                        Deactivate
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── Modals ─────────────────────────────────────────────────────────────── */}
      {inviteOpen && (
        <InviteAdminModal
          onClose={() => setInviteOpen(false)}
          onCreated={(admin) => {
            setAdmins((prev) => [...prev, admin]);
            setInviteOpen(false);
          }}
        />
      )}

      {editRoleTarget && (
        <EditRoleModal
          target={editRoleTarget}
          isLastSuperAdmin={isLastSuperAdmin(editRoleTarget)}
          currentUserId={adminUser.id}
          onClose={() => setEditRoleTarget(null)}
          onSaved={(updated) => {
            setAdmins((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
            setEditRoleTarget(null);
          }}
        />
      )}

      {deactivateTarget && (
        <ConfirmModal
          title="Deactivate Admin"
          body={
            <>
              Deactivate <strong>{deactivateTarget.first_name} {deactivateTarget.last_name}</strong>? They will no longer be able to log in.
            </>
          }
          confirmLabel="Deactivate"
          destructive
          loading={deactivating}
          onConfirm={handleDeactivate}
          onCancel={() => setDeactivateTarget(null)}
        />
      )}

      {resetTfaTarget && (
        <Reset2FAModal
          target={resetTfaTarget}
          onClose={() => setResetTfaTarget(null)}
          onReset={(adminId) => {
            setAdmins((prev) =>
              prev.map((a) => (a.id === adminId ? { ...a, two_factor_enabled: false } : a)),
            );
          }}
        />
      )}
    </div>
  );
}
