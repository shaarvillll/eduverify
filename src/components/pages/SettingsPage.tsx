import React, { useState } from 'react';
import {
  Settings,
  ShieldCheck,
  RotateCcw,
  Sliders,
  CheckCircle,
  Database,
  Lock,
  Server,
  Info,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { SyntheticBanner } from '../common/SyntheticBanner';

export const SettingsPage: React.FC = () => {
  const { resetToDemoDefaults } = useApp();

  const [strictIntakeCap, setStrictIntakeCap] = useState<boolean>(true);
  const [checksumValidation, setChecksumValidation] = useState<boolean>(true);
  const [defaultMasking, setDefaultMasking] = useState<boolean>(true);
  const [toleranceMargin, setToleranceMargin] = useState<number>(0);
  const [savedNotice, setSavedNotice] = useState<boolean>(false);

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 3000);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Synthetic Banner */}
      <SyntheticBanner />

      {/* Header */}
      <div className="p-5 bg-white border border-slate-200 rounded-lg shadow-2xs">
        <h2 className="text-base font-semibold text-slate-900">
          EduVerify Administration & Validation Parameters
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Configure synthetic APAAR verification rules, intake tolerance margins, and demonstration environment parameters.
        </p>
      </div>

      {savedNotice && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Demonstration settings updated in local storage.</span>
        </div>
      )}

      {/* Settings Form */}
      <form onSubmit={handleSaveSettings} className="space-y-6">
        {/* Verification Engine Rules */}
        <div className="p-5 bg-white border border-slate-200 rounded-lg shadow-2xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Sliders className="w-4 h-4 text-blue-600" />
            <h3 className="text-sm font-semibold text-slate-900">
              Regulatory Verification Parameters
            </h3>
          </div>

          <div className="space-y-4 text-xs">
            <div className="flex items-start justify-between gap-4">
              <div>
                <label className="font-semibold text-slate-900 block">
                  Enforce Strict 12-Digit Synthetic APAAR Format
                </label>
                <p className="text-slate-500 mt-0.5">
                  Rejects or flags any synthetic student identifier that deviates from the <code className="font-mono text-slate-700">NNNN-NNNN-NNNN</code> schema.
                </p>
              </div>
              <input
                type="checkbox"
                checked={checksumValidation}
                onChange={(e) => setChecksumValidation(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 mt-1 cursor-pointer"
              />
            </div>

            <div className="flex items-start justify-between gap-4 pt-3 border-t border-slate-100">
              <div>
                <label className="font-semibold text-slate-900 block">
                  Strict AICTE Approved Intake Enforcement
                </label>
                <p className="text-slate-500 mt-0.5">
                  Automatically flags institution batches when reported headcounts exceed sanctioned seats.
                </p>
              </div>
              <input
                type="checkbox"
                checked={strictIntakeCap}
                onChange={(e) => setStrictIntakeCap(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 mt-1 cursor-pointer"
              />
            </div>

            <div className="pt-3 border-t border-slate-100">
              <label className="font-semibold text-slate-900 block mb-1">
                Supernumerary & EWS Quota Intake Tolerance Margin
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={0}
                  max={10}
                  step={1}
                  value={toleranceMargin}
                  onChange={(e) => setToleranceMargin(Number(e.target.value))}
                  className="w-48 accent-blue-600"
                />
                <span className="font-mono font-bold text-slate-900 text-xs">
                  +{toleranceMargin}% over-intake allowance
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Standard AICTE policy enforces 0% without explicit supernumerary approval letter.
              </p>
            </div>
          </div>
        </div>

        {/* Privacy & Display Defaults */}
        <div className="p-5 bg-white border border-slate-200 rounded-lg shadow-2xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Lock className="w-4 h-4 text-blue-600" />
            <h3 className="text-sm font-semibold text-slate-900">
              Privacy & Masking Controls
            </h3>
          </div>

          <div className="space-y-4 text-xs">
            <div className="flex items-start justify-between gap-4">
              <div>
                <label className="font-semibold text-slate-900 block">
                  Default Masking on Synthetic Identifiers
                </label>
                <p className="text-slate-500 mt-0.5">
                  Masks the first 8 digits (<code className="font-mono text-slate-700">••••-••••-XXXX</code>) in all table views to emulate administrative privacy standards.
                </p>
              </div>
              <input
                type="checkbox"
                checked={defaultMasking}
                onChange={(e) => setDefaultMasking(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 mt-1 cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Prototype Environment & Backend Readiness */}
        <div className="p-5 bg-white border border-slate-200 rounded-lg shadow-2xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Server className="w-4 h-4 text-blue-600" />
            <h3 className="text-sm font-semibold text-slate-900">
              Architecture & Future Backend Integration
            </h3>
          </div>

          <div className="text-xs text-slate-600 space-y-2 leading-relaxed">
            <p>
              This application is configured as a standalone frontend prototype. State management and data schemas in
              <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-slate-800"> src/types/index.ts </code>
              are modularized to map directly to an upcoming Node.js + Express + PostgreSQL backend schema.
            </p>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded text-slate-700 space-y-1">
              <div className="font-semibold text-slate-900">Target Backend Contract:</div>
              <div>• REST API endpoints: <code className="font-mono text-blue-700">/api/v1/students</code>, <code className="font-mono text-blue-700">/api/v1/institutions</code>, <code className="font-mono text-blue-700">/api/v1/validation/batch</code></div>
              <div>• Relational store: PostgreSQL 16 with indexed APAAR lookup and intake constraints</div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
            <div className="text-xs text-slate-500">
              Need to restore initial mock data?
            </div>
            <button
              type="button"
              onClick={resetToDemoDefaults}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:text-rose-900 bg-rose-50 hover:bg-rose-100 rounded border border-rose-200 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Demo State</span>
            </button>
          </div>
        </div>

        <div className="flex items-center justify-end">
          <button
            type="submit"
            className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors shadow-2xs"
          >
            Save Administrative Parameters
          </button>
        </div>
      </form>
    </div>
  );
};
