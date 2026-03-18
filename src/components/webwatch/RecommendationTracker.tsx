'use client';

import { useState } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

export type ImplementationStatus =
  | 'OPEN' | 'IN_PROGRESS' | 'IMPLEMENTED' | 'VERIFIED'
  | 'STALLED' | 'ABANDONED' | 'CONTRADICTION';

export type VerificationStatus =
  | 'UNVERIFIED' | 'IMPROVED' | 'PARTIAL' | 'NO_CHANGE' | 'REGRESSED' | 'INSUFFICIENT_DATA';

export interface RecommendationCardData {
  id: string;
  title: string;
  finding: string;
  fixAction: string;
  fixType: string;
  priorityScore: number;
  estimatedMonthlyImpact: number | null;
  recoveredMonthlyValue: number | null;
  implementationStatus: ImplementationStatus;
  customerNote: string | null;
  customerUpdatedAt: string | null;
  verificationStatus: VerificationStatus;
  verificationNote: string | null;
  contradictionFlag: boolean;
  contradictionNote: string | null;
  baselineMetricLabel: string | null;
  lastVerifiedAt: string | null;
  lastVerifiedValue: number | null;
  metricHistory: Array<{ month: string; value: number; note: string }>;
  daysSinceFlagged: number;
  isRepeatFinding: boolean;
  createdAt: string;
}

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<ImplementationStatus, {
  label: string; color: string; bg: string; border: string; icon: string;
}> = {
  OPEN:          { label: 'Open',          color: 'text-amber-700',  bg: 'bg-amber-50',   border: 'border-amber-200', icon: '○' },
  IN_PROGRESS:   { label: 'In Progress',   color: 'text-blue-700',   bg: 'bg-blue-50',    border: 'border-blue-200',  icon: '◐' },
  IMPLEMENTED:   { label: 'Implemented',   color: 'text-teal-700',   bg: 'bg-teal-50',    border: 'border-teal-200',  icon: '●' },
  VERIFIED:      { label: 'Verified ✓',    color: 'text-teal-700',   bg: 'bg-teal-50',    border: 'border-teal-200',  icon: '✓' },
  STALLED:       { label: 'Stalled',       color: 'text-orange-700', bg: 'bg-orange-50',  border: 'border-orange-200', icon: '⏸' },
  ABANDONED:     { label: 'Abandoned',     color: 'text-slate-500',  bg: 'bg-slate-50',   border: 'border-slate-200', icon: '×' },
  CONTRADICTION: { label: 'Needs Review',  color: 'text-red-700',    bg: 'bg-red-50',     border: 'border-red-200',   icon: '!' },
};

const VERIFICATION_CONFIG: Record<VerificationStatus, {
  label: string; color: string; icon: string;
}> = {
  UNVERIFIED:        { label: 'Not yet verified',     color: 'text-slate-400', icon: '—' },
  IMPROVED:          { label: 'Improvement confirmed', color: 'text-teal-600',  icon: '↑' },
  PARTIAL:           { label: 'Partial improvement',  color: 'text-blue-600',  icon: '↗' },
  NO_CHANGE:         { label: 'No change detected',   color: 'text-amber-600', icon: '→' },
  REGRESSED:         { label: 'Getting worse',        color: 'text-red-600',   icon: '↓' },
  INSUFFICIENT_DATA: { label: 'Insufficient data',    color: 'text-slate-400', icon: '?' },
};

// ── Recommendation Card ───────────────────────────────────────────────────────

export function RecommendationCard({
  rec,
  onStatusUpdate,
}: {
  rec: RecommendationCardData;
  onStatusUpdate: (id: string, status: ImplementationStatus, note: string) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [noteInput, setNoteInput] = useState(rec.customerNote ?? '');
  const [showNoteInput, setShowNoteInput] = useState(false);

  const sc = STATUS_CONFIG[rec.implementationStatus];
  const vc = VERIFICATION_CONFIG[rec.verificationStatus];

  async function handleStatusChange(newStatus: ImplementationStatus) {
    if (newStatus === 'IN_PROGRESS' || newStatus === 'IMPLEMENTED') {
      setShowNoteInput(true);
      return;
    }
    setUpdating(true);
    await onStatusUpdate(rec.id, newStatus, rec.customerNote ?? '');
    setUpdating(false);
  }

  async function submitWithNote(newStatus: ImplementationStatus) {
    setUpdating(true);
    setShowNoteInput(false);
    await onStatusUpdate(rec.id, newStatus, noteInput);
    setUpdating(false);
  }

  const cumulativeCost = rec.estimatedMonthlyImpact && rec.daysSinceFlagged > 0
    ? Math.round(rec.estimatedMonthlyImpact * (rec.daysSinceFlagged / 30))
    : null;

  return (
    <div className={`rounded-2xl border ${sc.border} overflow-hidden transition-all`}>
      {/* Contradiction banner */}
      {rec.contradictionFlag && (
        <div className="bg-red-50 border-b border-red-200 px-5 py-3 flex items-start gap-3">
          <span className="text-red-500 text-lg flex-shrink-0 mt-0.5">⚠</span>
          <div>
            <p className="text-xs font-bold text-red-700 mb-0.5">Data doesn&apos;t match your update</p>
            <p className="text-xs text-red-600 leading-relaxed">{rec.contradictionNote}</p>
          </div>
        </div>
      )}

      {/* Main card */}
      <div className={`${sc.bg} px-5 py-4`}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            {/* Header row */}
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${sc.bg} ${sc.color} border ${sc.border}`}>
                <span>{sc.icon}</span>
                <span>{sc.label}</span>
              </span>
              {rec.isRepeatFinding && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-700 border border-orange-200">
                  Repeat finding
                </span>
              )}
              <span className="text-[10px] text-slate-400 uppercase tracking-wider">{rec.fixType}</span>
            </div>

            <h4 className="text-sm font-bold text-slate-800 mb-1 leading-snug">{rec.title}</h4>

            {/* Baseline metric */}
            {rec.baselineMetricLabel && (
              <p className="text-xs text-slate-500 mb-2">
                Baseline: <span className="font-medium text-slate-700">{rec.baselineMetricLabel}</span>
                {rec.lastVerifiedValue !== null && (
                  <span> → Now: <span className={`font-medium ${vc.color}`}>{rec.lastVerifiedValue.toFixed(1)}</span></span>
                )}
              </p>
            )}

            {/* AI verification status */}
            {rec.verificationStatus !== 'UNVERIFIED' && (
              <div className={`flex items-center gap-1.5 text-xs ${vc.color} mb-2`}>
                <span className="font-bold">{vc.icon}</span>
                <span>{vc.label}</span>
                {rec.verificationNote && (
                  <span className="text-slate-400">· {rec.verificationNote}</span>
                )}
              </div>
            )}
          </div>

          {/* Right side: impact + revenue */}
          <div className="flex-shrink-0 text-right">
            {rec.estimatedMonthlyImpact && (
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider">Est. impact</p>
                <p className="text-lg font-black text-slate-800">${rec.estimatedMonthlyImpact.toLocaleString()}<span className="text-xs font-normal text-slate-400">/mo</span></p>
              </div>
            )}
            {rec.recoveredMonthlyValue && rec.recoveredMonthlyValue > 0 && (
              <div className="mt-1">
                <p className="text-[10px] text-teal-600 uppercase tracking-wider">Recovered</p>
                <p className="text-sm font-bold text-teal-600">+${rec.recoveredMonthlyValue.toLocaleString()}/mo</p>
              </div>
            )}
          </div>
        </div>

        {/* Cumulative cost of inaction */}
        {rec.implementationStatus === 'OPEN' && cumulativeCost && cumulativeCost > 500 && (
          <div className="mt-2 px-3 py-2 bg-amber-100 border border-amber-200 rounded-lg">
            <p className="text-xs text-amber-700">
              <span className="font-bold">Flagged {rec.daysSinceFlagged} days ago.</span>{' '}
              Estimated cumulative cost of inaction: <span className="font-bold">${cumulativeCost.toLocaleString()}</span>
            </p>
          </div>
        )}

        {/* Customer note */}
        {rec.customerNote && (
          <div className="mt-3 px-3 py-2 bg-white/60 rounded-lg border border-white">
            <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">Your note</p>
            <p className="text-xs text-slate-600 italic">&ldquo;{rec.customerNote}&rdquo;</p>
            {rec.customerUpdatedAt && (
              <p className="text-[10px] text-slate-400 mt-0.5">
                Updated {new Date(rec.customerUpdatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </p>
            )}
          </div>
        )}

        {/* Note input (when user chooses In Progress or Implemented) */}
        {showNoteInput && (
          <div className="mt-3 space-y-2">
            <textarea
              value={noteInput}
              onChange={e => setNoteInput(e.target.value)}
              placeholder="What did you do? (e.g. 'Rewrote the /pricing headline and moved CTA above fold')"
              className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-700 placeholder-slate-400 resize-none focus:outline-none focus:border-nav-bg"
              rows={3}
            />
            <div className="flex gap-2">
              <button
                onClick={() => submitWithNote('IN_PROGRESS')}
                disabled={updating}
                className="px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                Mark In Progress
              </button>
              <button
                onClick={() => submitWithNote('IMPLEMENTED')}
                disabled={updating}
                className="px-3 py-1.5 bg-teal-600 text-white text-xs font-semibold rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50"
              >
                Mark as Done
              </button>
              <button
                onClick={() => setShowNoteInput(false)}
                className="px-3 py-1.5 bg-slate-100 text-slate-600 text-xs font-semibold rounded-lg hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Action buttons */}
        {!showNoteInput && (
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            {rec.implementationStatus === 'OPEN' && (
              <>
                <button
                  onClick={() => handleStatusChange('IN_PROGRESS')}
                  disabled={updating}
                  className="px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  Working on this
                </button>
                <button
                  onClick={() => handleStatusChange('IMPLEMENTED')}
                  disabled={updating}
                  className="px-3 py-1.5 bg-teal-600 text-white text-xs font-semibold rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50"
                >
                  Mark done
                </button>
                <button
                  onClick={() => handleStatusChange('ABANDONED')}
                  disabled={updating}
                  className="px-3 py-1.5 bg-slate-100 text-slate-500 text-xs font-semibold rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50"
                >
                  Won&apos;t fix
                </button>
              </>
            )}
            {rec.implementationStatus === 'IN_PROGRESS' && (
              <>
                <button
                  onClick={() => handleStatusChange('IMPLEMENTED')}
                  disabled={updating}
                  className="px-3 py-1.5 bg-teal-600 text-white text-xs font-semibold rounded-lg hover:bg-teal-700 transition-colors"
                >
                  Mark done
                </button>
                <button
                  onClick={() => setShowNoteInput(true)}
                  className="px-3 py-1.5 bg-slate-100 text-slate-600 text-xs font-semibold rounded-lg hover:bg-slate-200 transition-colors"
                >
                  Update note
                </button>
              </>
            )}
            {(rec.implementationStatus === 'IMPLEMENTED' || rec.implementationStatus === 'CONTRADICTION') && (
              <button
                onClick={() => handleStatusChange('IN_PROGRESS')}
                disabled={updating}
                className="px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 text-xs font-semibold rounded-lg hover:bg-blue-100 transition-colors"
              >
                Reopen — still working
              </button>
            )}
            <button
              onClick={() => setExpanded(v => !v)}
              className="px-3 py-1.5 bg-white/60 border border-slate-200 text-slate-500 text-xs font-semibold rounded-lg hover:bg-white transition-colors ml-auto"
            >
              {expanded ? 'Less ↑' : 'Details ↓'}
            </button>
          </div>
        )}
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="bg-white px-5 py-4 border-t border-slate-100 space-y-4">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Finding</p>
            <p className="text-sm text-slate-700 leading-relaxed">{rec.finding}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Recommended fix</p>
            <p className="text-sm text-slate-700 leading-relaxed">{rec.fixAction}</p>
          </div>

          {/* Metric history sparkline */}
          {rec.metricHistory && rec.metricHistory.length > 1 && (
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Monthly trend</p>
              <div className="flex items-end gap-1.5 h-8">
                {rec.metricHistory.map((h, i) => {
                  const max = Math.max(...rec.metricHistory.map(x => x.value));
                  const pct = max > 0 ? (h.value / max) * 100 : 50;
                  return (
                    <div key={i} className="flex flex-col items-center gap-0.5 flex-1" title={`${h.month}: ${h.value.toFixed(1)}`}>
                      <div
                        className="w-full rounded-sm bg-nav-bg opacity-70 hover:opacity-100 transition-opacity"
                        style={{ height: `${pct}%`, minHeight: 4 }}
                      />
                      <span className="text-[8px] text-slate-400">{h.month.split(' ')[0]?.slice(0, 3)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {rec.lastVerifiedAt && (
            <p className="text-[10px] text-slate-400">
              Last verified by AI: {new Date(rec.lastVerifiedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Monthly Summary Banner ────────────────────────────────────────────────────

export function MonthlySummaryBanner({
  grade,
  verifiedFixed,
  inProgress,
  stalled,
  contradictions,
  revenueRecovered,
  baselineLabel,
  comparisonMode,
}: {
  grade: string;
  verifiedFixed: number;
  inProgress: number;
  stalled: number;
  contradictions: number;
  revenueRecovered: number;
  baselineLabel: string;
  comparisonMode: string;
}) {
  const gradeColor = grade.startsWith('A') ? 'text-teal-600' :
    grade.startsWith('B') ? 'text-blue-600' :
    grade.startsWith('C') ? 'text-amber-600' : 'text-red-600';

  const gradeBg = grade.startsWith('A') ? 'bg-teal-50 border-teal-200' :
    grade.startsWith('B') ? 'bg-blue-50 border-blue-200' :
    grade.startsWith('C') ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200';

  return (
    <div className={`rounded-2xl border ${gradeBg} p-5`}>
      <div className="flex items-center justify-between gap-4 mb-4">
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
            Monthly Performance · vs. {baselineLabel}
          </p>
          <div className="flex items-center gap-3">
            <span className={`text-4xl font-black ${gradeColor}`}>{grade}</span>
            <div>
              {revenueRecovered > 0 && (
                <p className="text-sm font-bold text-teal-600">+${revenueRecovered.toLocaleString()}/mo recovered</p>
              )}
              <p className="text-xs text-slate-500">
                {comparisonMode === 'VS_PRIOR_YEAR' ? 'Year-over-year comparison' : `vs. ${baselineLabel}`}
              </p>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Verified fixed', value: verifiedFixed, color: 'text-teal-700 bg-teal-50 border-teal-200' },
            { label: 'In progress', value: inProgress, color: 'text-blue-700 bg-blue-50 border-blue-200' },
            { label: 'Stalled', value: stalled, color: 'text-orange-700 bg-orange-50 border-orange-200' },
            { label: 'Needs review', value: contradictions, color: 'text-red-700 bg-red-50 border-red-200' },
          ].map(s => (
            <div key={s.label} className={`px-3 py-2 rounded-xl border text-center ${s.color}`}>
              <p className="text-xl font-black">{s.value}</p>
              <p className="text-[10px] font-semibold">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── API helper (called from page components) ──────────────────────────────────

export async function updateRecommendationStatus(
  recId: string,
  status: ImplementationStatus,
  note: string,
): Promise<void> {
  await fetch('/api/recommendations/status', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recId, status, note }),
  });
}
