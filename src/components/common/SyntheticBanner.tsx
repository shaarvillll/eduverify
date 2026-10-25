import React from 'react';
import { Info, ShieldAlert } from 'lucide-react';

interface SyntheticBannerProps {
  compact?: boolean;
}

export const SyntheticBanner: React.FC<SyntheticBannerProps> = ({ compact = false }) => {
  if (compact) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-blue-900 bg-blue-50 border border-blue-200 rounded">
        <Info className="w-3.5 h-3.5 text-blue-600 shrink-0" />
        <span className="font-medium">Synthetic Test Environment:</span>
        <span className="text-blue-700">Non-PII synthetic records for prototype evaluation.</span>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 p-3.5 bg-blue-50/80 border border-blue-200 rounded-lg text-slate-800">
      <div className="p-1.5 bg-blue-100 rounded text-blue-700 shrink-0 mt-0.5">
        <ShieldAlert className="w-4 h-4" />
      </div>
      <div className="text-xs space-y-0.5">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-blue-950">AICTE Regulatory Prototype Mode</span>
          <span className="px-1.5 py-0.2 bg-blue-200/60 text-blue-900 rounded font-mono text-[10px] uppercase tracking-wide">
            Synthetic Data Only
          </span>
        </div>
        <p className="text-slate-600 leading-relaxed">
          All student identifiers, test APAAR credentials (<code className="font-mono text-slate-700">••••-••••-XXXX</code>),
          and institution capacities are simulated for technical demonstration. No live Aadhaar or DigiLocker data is connected.
        </p>
      </div>
    </div>
  );
};
