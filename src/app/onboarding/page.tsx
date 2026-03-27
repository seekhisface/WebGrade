'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DataScenario = 'A' | 'B' | 'C' | null;

interface DataAvailability {
  hasGA4: boolean;
  hasGSC: boolean;
  hasSnippet: boolean;
  scenario: DataScenario;
}

interface OnboardingFormData {
  siteUrl: string;
  siteName: string;
  conversionGoalUrl: string;
  conversionGoalName: string;
  businessDescription: string;
  targetAudience: string;
  primaryValueProp: string;
  competitorUrls: string[];
  ga4Connected: boolean;
  gscConnected: boolean;
  monthlyAdSpend: string;
  averageOrderValue: string;
  leadToWinRate: string;
  conversionRate: string;
}

const EMPTY_FORM: OnboardingFormData = {
  siteUrl: '',
  siteName: '',
  conversionGoalUrl: '',
  conversionGoalName: '',
  businessDescription: '',
  targetAudience: '',
  primaryValueProp: '',
  competitorUrls: ['', '', ''],
  ga4Connected: false,
  gscConnected: false,
  monthlyAdSpend: '',
  averageOrderValue: '',
  leadToWinRate: '',
  conversionRate: '',
};

const inputClass = 'w-full bg-[#f8fafc] border border-[#bae6fd] text-[#1e293b] placeholder-[#94a3b8] rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#0c4a6e] focus:ring-1 focus:ring-[#0c4a6e] transition-colors';
const textareaClass = `${inputClass} resize-none`;

// ---------------------------------------------------------------------------
// Scenario config
// ---------------------------------------------------------------------------

const SCENARIOS = {
  A: {
    label: 'Scenario A — Full Intelligence',
    color: 'emerald',
    borderColor: 'border-emerald-500/30',
    bgColor: 'bg-emerald-500/10',
    textColor: 'text-emerald-400',
    dotColor: 'bg-emerald-500',
    description: 'GA4, Search Console, and behavioral tracking are all available. You\'ll get the complete picture — historical baseline, live intent scoring, and market intelligence from day one.',
    firstValue: 'Within 24 hours',
    firstValueDetail: 'Your historical baseline is live and market intelligence is running',
    reportTimeline: 'Full report at day 45',
    whatYouGet: [
      'Today — 90-day GA4 baseline imported, keyword gaps identified',
      'Day 1 — Live intent scoring starts on every visitor',
      'Day 7 — First behavioral patterns and drop-off insights surface',
      'Day 45 — Complete Interim Report™ with prioritized action list',
    ],
  },
  B: {
    label: 'Scenario B — Historical + Market Intelligence',
    color: 'amber',
    borderColor: 'border-amber-500/30',
    bgColor: 'bg-amber-500/10',
    textColor: 'text-amber-400',
    dotColor: 'bg-amber-500',
    description: 'GA4 or Search Console is available but the behavioral snippet isn\'t installed yet. We\'ll start with your historical data and market intelligence while the snippet collects live behavioral data.',
    firstValue: 'Within 24 hours',
    firstValueDetail: 'Historical analysis and market intelligence are already running',
    reportTimeline: 'Full report once 30 days of behavioral data collected',
    whatYouGet: [
      'Today — historical traffic baseline and keyword gap analysis live',
      'Day 1 (snippet installed) — live intent scoring starts immediately',
      'Day 7 — first behavioral patterns start surfacing',
      'Day 30+ — full report with behavioral + historical combined',
    ],
  },
  C: {
    label: 'Scenario C — Clean Start',
    color: 'blue',
    borderColor: 'border-blue-500/30',
    bgColor: 'bg-blue-500/10',
    textColor: 'text-blue-400',
    dotColor: 'bg-blue-500',
    description: 'No historical data is connected yet. That\'s completely fine — we\'ll build your baseline from scratch. WebOpp™ market intelligence is available immediately, and behavioral data starts the moment your snippet goes live.',
    firstValue: 'Within 24 hours',
    firstValueDetail: 'Market intelligence is running and your snippet is collecting data',
    reportTimeline: 'Full report once 30 days of data collected',
    whatYouGet: [
      'Today — WebOpp™ market intelligence and search demand analysis live',
      'Day 1 — snippet starts capturing behavioral data on every visitor',
      'Day 7 — first intent patterns and drop-off signals emerge',
      'Day 30+ — full behavioral report with complete baseline built from scratch',
    ],
  },
};

// ---------------------------------------------------------------------------
// Main page (wrapped in Suspense)
// ---------------------------------------------------------------------------

export default function OnboardingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <OnboardingFlow />
    </Suspense>
  );
}

function OnboardingFlow() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const siteId = searchParams.get('siteId') ?? '';

  // 0 = data assessment, 1-5 = onboarding steps
  const [phase, setPhase] = useState<'assessment' | 'expectation' | 'form'>('assessment');
  const [step, setStep] = useState(1);
  const [dataAvail, setDataAvail] = useState<DataAvailability>({
    hasGA4: false,
    hasGSC: false,
    hasSnippet: false,
    scenario: null,
  });
  const [form, setForm] = useState<OnboardingFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const totalSteps = 5;

  function update(field: keyof OnboardingFormData, value: unknown) {
    setForm(prev => ({ ...prev, [field]: value }));
    setErrors(prev => ({ ...prev, [field]: '' }));
  }

  function deriveScenario(avail: Omit<DataAvailability, 'scenario'>): DataScenario {
    if ((avail.hasGA4 || avail.hasGSC) && avail.hasSnippet) return 'A';
    if (avail.hasGA4 || avail.hasGSC) return 'B';
    return 'C';
  }

  function handleAssessmentNext() {
    const scenario = deriveScenario(dataAvail);
    setDataAvail(prev => ({ ...prev, scenario }));
    setPhase('expectation');
  }

  function validateStep(): boolean {
    const newErrors: Record<string, string> = {};
    if (step === 1) {
      if (!form.siteUrl) newErrors.siteUrl = 'Site URL is required';
      else if (!form.siteUrl.startsWith('http')) newErrors.siteUrl = 'Must start with https://';
      if (!form.siteName) newErrors.siteName = 'Site name is required';
      if (!form.conversionGoalUrl) newErrors.conversionGoalUrl = 'Conversion goal URL is required';
      if (!form.conversionGoalName) newErrors.conversionGoalName = 'Name this goal (e.g. "Free trial signup")';
    }
    if (step === 2) {
      if (!form.businessDescription || form.businessDescription.length < 20)
        newErrors.businessDescription = 'Please describe your business in at least 20 characters';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleNext() {
    if (!validateStep()) return;

    // After Step 1 — create the site early so we have a siteId for OAuth
    if (step === 1 && !siteId) {
      setSaving(true);
      try {
        const res = await fetch("/api/onboarding/create-site", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            siteUrl: form.siteUrl,
            siteName: form.siteName,
            conversionGoalUrl: form.conversionGoalUrl,
            conversionGoalName: form.conversionGoalName,
            dataScenario: dataAvail.scenario,
          }),
        });
        const data = await res.json();
        if (data.siteId) {
          router.replace(`/onboarding?siteId=${data.siteId}&step=2`);
          setStep(2);
          setSaving(false);
          return;
        }
      } catch { /* fall through */ }
      setSaving(false);
      setStep(2);
      return;
    }

    if (step < totalSteps) {
      if (siteId) router.replace(`/onboarding?siteId=${siteId}&step=${step + 1}`);
      setStep(s => s + 1);
      return;
    }

    // Final step — save remaining form data
    setSaving(true);
    try {
      await fetch("/api/onboarding/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, siteId, dataScenario: dataAvail.scenario }),
      });
      router.push(`/dashboard/${siteId}`);
    } catch {
      setSaving(false);
    }
  }

  // ── PHASE: ASSESSMENT ────────────────────────────────────────────────────
  if (phase === 'assessment') {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-xl">
          <Logo />
          <div className="bg-white border border-[#bae6fd] rounded-2xl p-8">
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-2">
                <p className="text-xs font-semibold text-brand-400 uppercase tracking-wider">Before we start</p>
                <span className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-xs text-emerald-400 font-medium">⏱ 2 min setup</span>
              </div>
              <h1 className="text-2xl font-bold text-[#1e293b] mb-2">What data do you have?</h1>
              <p className="text-sm text-[#64748b] leading-relaxed">
                WebGrade works with any starting point — zero data or full history. 
                Tell us what you have and we'll tell you exactly what you'll get and when.
              </p>
            </div>

            <div className="space-y-3 mb-8">
              <DataToggle
                label="Google Analytics 4 (GA4)"
                description="90-day historical baseline — sessions, conversions, traffic sources"
                icon="📊"
                checked={dataAvail.hasGA4}
                onChange={v => setDataAvail(prev => ({ ...prev, hasGA4: v }))}
              />
              <DataToggle
                label="Google Search Console"
                description="Keyword impressions, clicks, rankings, and search demand"
                icon="🔍"
                checked={dataAvail.hasGSC}
                onChange={v => setDataAvail(prev => ({ ...prev, hasGSC: v }))}
              />
              <DataToggle
                label="WebGrade snippet installed"
                description="Live behavioral tracking on your site"
                icon="⚡"
                checked={dataAvail.hasSnippet}
                onChange={v => setDataAvail(prev => ({ ...prev, hasSnippet: v }))}
              />
            </div>

            <div className="p-4 bg-white/3 border border-white/8 rounded-xl mb-6">
              <p className="text-xs text-[#94a3b8] leading-relaxed">
                <span className="text-[#475569] font-medium">Don't have any of these?</span> That's completely fine. 
                We'll set up Search Console in minutes and your snippet starts collecting data today. 
                WebGrade works from a cold start — we build your baseline from scratch.
              </p>
            </div>

            <button
              onClick={handleAssessmentNext}
              className="w-full bg-brand-600 hover:bg-brand-500 text-white font-medium py-3 px-4 rounded-xl transition-colors"
            >
              Show me what I'll get →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── PHASE: EXPECTATION SETTING ───────────────────────────────────────────
  if (phase === 'expectation') {
    const scenario = dataAvail.scenario!;
    const config = SCENARIOS[scenario];

    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-xl">
          <Logo />
          <div className="bg-white border border-[#bae6fd] rounded-2xl p-8">
            <div className="mb-6">
              <div className={`inline-flex items-center gap-2 px-3 py-1 ${config.bgColor} ${config.borderColor} border rounded-full mb-4`}>
                <div className={`w-2 h-2 rounded-full ${config.dotColor}`} />
                <span className={`text-xs font-semibold ${config.textColor}`}>{config.label}</span>
              </div>
              <h1 className="text-2xl font-bold text-[#1e293b] mb-3">Here's what you'll get</h1>
              <p className="text-sm text-[#64748b] leading-relaxed">{config.description}</p>
            </div>

            {/* What you get */}
            <div className={`p-5 ${config.bgColor} ${config.borderColor} border rounded-xl mb-4`}>
              <p className="text-xs font-semibold text-[#64748b] uppercase tracking-wider mb-3">Your intelligence package</p>
              <div className="space-y-2">
                {config.whatYouGet.map((item, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className={`${config.textColor} mt-0.5 flex-shrink-0`}>✓</span>
                    <span className="text-sm text-[#475569]">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* First value + timeline */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                <p className="text-xs text-emerald-400 font-semibold mb-1">⚡ First insights</p>
                <p className="text-sm font-semibold text-[#1e293b]">{config.firstValue}</p>
                <p className="text-xs text-[#94a3b8] mt-0.5 leading-relaxed">{config.firstValueDetail}</p>
              </div>
              <div className="p-4 bg-white/3 border border-white/8 rounded-xl">
                <p className="text-xs text-[#94a3b8] font-semibold mb-1">📋 Full report</p>
                <p className="text-sm font-semibold text-[#1e293b]">{config.reportTimeline}</p>
                <p className="text-xs text-[#94a3b8] mt-0.5 leading-relaxed">Complete analysis with action list</p>
              </div>
            </div>

            {/* Missing data nudges */}
            {scenario !== 'A' && (
              <div className="mb-6">
                <p className="text-xs font-semibold text-[#64748b] uppercase tracking-wider mb-2">Upgrade your scenario</p>
                <div className="space-y-2">
                  {!dataAvail.hasGA4 && (
                    <NudgeItem icon="📊" text="Connect GA4 to unlock historical baseline (takes 2 min)" />
                  )}
                  {!dataAvail.hasGSC && (
                    <NudgeItem icon="🔍" text="Connect Search Console to unlock keyword intelligence" />
                  )}
                  {!dataAvail.hasSnippet && (
                    <NudgeItem icon="⚡" text="Install snippet to start live behavioral tracking" />
                  )}
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setPhase('assessment')}
                className="px-4 py-3 bg-[#f8fafc] hover:bg-white/8 text-[#64748b] text-sm font-medium rounded-xl transition-colors"
              >
                ← Back
              </button>
              <button
                onClick={() => setPhase('form')}
                className="flex-1 bg-brand-600 hover:bg-brand-500 text-white font-medium py-3 px-4 rounded-xl transition-colors"
              >
                Let's get started →
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── PHASE: FORM ──────────────────────────────────────────────────────────
  const progress = ((step - 1) / (totalSteps - 1)) * 100;
  const STEP_TITLES = [
    { title: 'Your site', description: 'Tell us about the site you want to analyze' },
    { title: 'Your business', description: 'Help us give you smarter, more relevant insights' },
    { title: 'Competitors', description: 'We\'ll track what they rank for that you don\'t' },
    { title: 'Connect data', description: 'Import your historical baseline' },
    { title: 'Your goals', description: 'Set revenue context so insights include dollar impact' },
  ];
  const currentStepInfo = STEP_TITLES[step - 1];

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-xl">
        <Logo />

        {/* Progress */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-[#64748b]">Step {step} of {totalSteps}</span>
            <span className="text-xs text-[#64748b]">{Math.round(progress)}% complete</span>
          </div>
          <div className="h-1 bg-[#f8fafc] rounded-full overflow-hidden">
            <div
              className="h-full bg-brand-500 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="bg-white border border-[#bae6fd] rounded-2xl p-8">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-white mb-1">{currentStepInfo.title}</h2>
            <p className="text-sm text-[#94a3b8]">{currentStepInfo.description}</p>
          </div>

          <div className="space-y-4">
            {step === 1 && <Step1 form={form} update={update} errors={errors} />}
            {step === 2 && <Step2 form={form} update={update} errors={errors} />}
            {step === 3 && <Step3 form={form} update={update} errors={errors} />}
            {step === 4 && <Step4 form={form} update={update} dataAvail={dataAvail} />}
            {step === 5 && <Step5 form={form} update={update} errors={errors} />}
          </div>

          <div className="flex gap-3 mt-8">
            {step > 1 && (
              <button
                onClick={() => setStep(s => s - 1)}
                className="px-4 py-2.5 bg-[#f8fafc] hover:bg-white/8 text-[#64748b] text-sm font-medium rounded-xl transition-colors"
              >
                ← Back
              </button>
            )}
            <button
              onClick={handleNext}
              disabled={saving}
              className="flex-1 bg-brand-600 hover:bg-brand-500 disabled:bg-brand-600/40 text-white font-medium py-2.5 px-4 rounded-xl transition-colors text-sm"
            >
              {saving ? 'Saving...' : step === totalSteps ? 'Launch dashboard →' : 'Continue →'}
            </button>
          </div>

          {step === 4 && (
            <p className="text-center text-[#94a3b8] text-xs mt-3">
              You can connect data sources later from your dashboard settings
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Logo() {
  return (
    <div className="mb-8 flex items-center gap-2">
      <div className="w-7 h-7 bg-brand-600 rounded-md flex items-center justify-center">
        <span className="text-white font-bold text-xs">W</span>
      </div>
      <span className="text-white font-semibold text-sm">WebGrade</span>
    </div>
  );
}

function DataToggle({ label, description, icon, checked, onChange }: {
  label: string; description: string; icon: string;
  checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all text-left ${
        checked
          ? 'bg-brand-600/15 border-brand-500/40'
          : 'bg-white/3 border-white/8 hover:border-white/15'
      }`}
    >
      <span className="text-xl flex-shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white">{label}</p>
        <p className="text-xs text-[#94a3b8] mt-0.5">{description}</p>
      </div>
      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
        checked ? 'bg-brand-500 border-brand-500' : 'border-[#bae6fd]'
      }`}>
        {checked && (
          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
            <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </div>
    </button>
  );
}

function NudgeItem({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="flex items-center gap-2.5 p-3 bg-white/3 border border-white/8 rounded-lg">
      <span>{icon}</span>
      <span className="text-xs text-[#64748b]">{text}</span>
    </div>
  );
}

function Field({ label, hint, error, children }: {
  label: string; hint?: string; error?: string; children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-[#475569] mb-1.5">{label}</label>
      {hint && <p className="text-xs text-white/35 mb-2 leading-relaxed">{hint}</p>}
      {children}
      {error && <p className="text-xs text-red-400 mt-1.5">{error}</p>}
    </div>
  );
}

function Step1({ form, update, errors }: {
  form: OnboardingFormData;
  update: (f: keyof OnboardingFormData, v: unknown) => void;
  errors: Record<string, string>;
}) {
  return (
    <>
      <Field label="Site URL" error={errors.siteUrl}>
        <input type="url" placeholder="https://yoursite.com" value={form.siteUrl}
          onChange={e => update('siteUrl', e.target.value)} className={inputClass} />
      </Field>
      <Field label="Site name" error={errors.siteName}>
        <input type="text" placeholder="Acme Inc" value={form.siteName}
          onChange={e => update('siteName', e.target.value)} className={inputClass} />
      </Field>
      <Field
        label="Conversion goal URL"
        hint="The page a visitor lands on after completing your most important action (e.g. /thank-you, /welcome). Everything WebGrade measures points toward this."
        error={errors.conversionGoalUrl}
      >
        <input type="url" placeholder="https://yoursite.com/thank-you" value={form.conversionGoalUrl}
          onChange={e => update('conversionGoalUrl', e.target.value)} className={inputClass} />
      </Field>
      <Field label="What is this goal called?" error={errors.conversionGoalName}>
        <input type="text" placeholder="e.g. Free trial signup, Demo booked, Purchase complete"
          value={form.conversionGoalName} onChange={e => update('conversionGoalName', e.target.value)}
          className={inputClass} />
      </Field>
    </>
  );
}

function Step2({ form, update, errors }: {
  form: OnboardingFormData;
  update: (f: keyof OnboardingFormData, v: unknown) => void;
  errors: Record<string, string>;
}) {
  return (
    <>
      <Field
        label="Describe your business"
        hint="This is injected into every AI insight. The more specific you are, the smarter the analysis."
        error={errors.businessDescription}
      >
        <textarea rows={3}
          placeholder="e.g. We sell project management software to marketing teams at SaaS companies. Our main competitor is Asana. Our free trial converts at about 12%."
          value={form.businessDescription} onChange={e => update('businessDescription', e.target.value)}
          className={textareaClass} />
      </Field>
      <Field label="Who is your target visitor?" hint="Who are you trying to convert?">
        <input type="text" placeholder="e.g. Founders of SaaS companies with 10–50 employees"
          value={form.targetAudience} onChange={e => update('targetAudience', e.target.value)}
          className={inputClass} />
      </Field>
      <Field label="What is your primary value proposition?">
        <input type="text" placeholder="e.g. The only tool that shows you exactly why visitors don't convert"
          value={form.primaryValueProp} onChange={e => update('primaryValueProp', e.target.value)}
          className={inputClass} />
      </Field>
    </>
  );
}

function Step3({ form, update }: {
  form: OnboardingFormData;
  update: (f: keyof OnboardingFormData, v: unknown) => void;
  errors: Record<string, string>;
}) {
  function updateCompetitor(index: number, value: string) {
    const updated = [...form.competitorUrls];
    updated[index] = value;
    update('competitorUrls', updated);
  }
  return (
    <>
      <p className="text-sm text-[#94a3b8] -mt-2 mb-4">
        We'll crawl these to find keywords they rank for that you don't, and compare their messaging to yours.
      </p>
      {[0, 1, 2].map(i => (
        <Field key={i} label={`Competitor ${i + 1} URL`}>
          <input type="url" placeholder={`https://competitor${i + 1}.com`}
            value={form.competitorUrls[i] ?? ''}
            onChange={e => updateCompetitor(i, e.target.value)} className={inputClass} />
        </Field>
      ))}
    </>
  );
}

function Step4({ form, update, dataAvail }: {
  form: OnboardingFormData;
  update: (f: keyof OnboardingFormData, v: unknown) => void;
  dataAvail: DataAvailability;
}) {
  const searchParams = useSearchParams();
  const siteId = searchParams.get('siteId') ?? '';

  // Pick up OAuth success params from callback redirect
  const ga4Param = searchParams.get('ga4');
  const gscParam = searchParams.get('gsc');

  // Reflect OAuth success into form state
  useEffect(() => {
    if (ga4Param === 'connected') update('ga4Connected', true);
    if (gscParam === 'connected') update('gscConnected', true);
  }, [ga4Param, gscParam]); // eslint-disable-line react-hooks/exhaustive-deps

  const [ga4Importing, setGa4Importing] = useState(false);
  const [ga4ImportDone, setGa4ImportDone] = useState(false);
  const [ga4ImportError, setGa4ImportError] = useState('');

  // Poll import status when GA4 first connects
  useEffect(() => {
    if (!form.ga4Connected || !siteId) return;
    setGa4Importing(true);
    let attempts = 0;
    const interval = setInterval(async () => {
      attempts++;
      try {
        const res = await fetch(`/api/ga4/import?siteId=${siteId}`);
        const data = await res.json();
        if (data.ga4BaselineImportedAt) {
          setGa4Importing(false);
          setGa4ImportDone(true);
          clearInterval(interval);
        }
      } catch { /* keep polling */ }
      if (attempts > 30) { // 30 × 3s = 90s timeout
        clearInterval(interval);
        setGa4Importing(false);
        setGa4ImportError('Import is taking longer than expected. It will complete in the background.');
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [form.ga4Connected, siteId]); // eslint-disable-line react-hooks/exhaustive-deps

  function connectGA4() {
    if (!siteId) return;
    window.location.href = `/api/auth/google?siteId=${siteId}&scope=ga4`;
  }

  function connectGSC() {
    if (!siteId) return;
    window.location.href = `/api/auth/google?siteId=${siteId}&scope=gsc`;
  }

  return (
    <div className="space-y-4">
      {/* GA4 */}
      <div className={`p-5 border rounded-xl transition-all ${
        form.ga4Connected
          ? 'bg-emerald-500/8 border-emerald-500/25'
          : 'bg-white/3 border-white/8'
      }`}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-medium text-white text-sm">Google Analytics 4</h3>
              {form.ga4Connected && !ga4ImportDone && ga4Importing && (
                <span className="flex items-center gap-1 text-xs text-amber-400">
                  <span className="w-3 h-3 border border-amber-400 border-t-transparent rounded-full animate-spin inline-block" />
                  Importing…
                </span>
              )}
              {ga4ImportDone && (
                <span className="text-xs text-emerald-400">✓ Baseline imported</span>
              )}
            </div>
            <p className="text-xs text-[#94a3b8] leading-relaxed">
              Imports your last 90 days as a baseline. Every recommendation shows delta from this baseline.
            </p>
            {ga4ImportError && (
              <p className="text-xs text-amber-400 mt-1">{ga4ImportError}</p>
            )}
          </div>
          {form.ga4Connected ? (
            <ConnectedBadge />
          ) : (
            <button
              onClick={connectGA4}
              disabled={!siteId}
              className="flex-shrink-0 px-3 py-1.5 bg-white/8 hover:bg-white/12 disabled:opacity-40 border border-[#bae6fd] rounded-lg text-xs font-medium text-white transition-colors flex items-center gap-1.5"
            >
              <GoogleIcon /> Connect
            </button>
          )}
        </div>

        {/* Import progress detail */}
        {form.ga4Connected && ga4Importing && (
          <div className="mt-3 pt-3 border-t border-white/8">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-[#94a3b8]">Importing 90-day baseline…</span>
              <span className="text-xs text-white/30">This takes ~10 seconds</span>
            </div>
            <div className="h-1 bg-white/8 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full animate-pulse w-2/3" />
            </div>
          </div>
        )}

        {ga4ImportDone && (
          <div className="mt-3 pt-3 border-t border-emerald-500/20">
            <p className="text-xs text-emerald-400/70">
              ✓ Sessions, bounce rate, conversion rate, and top pages imported. Your behavioral insights will be benchmarked against this baseline.
            </p>
          </div>
        )}
      </div>

      {/* GSC */}
      <div className={`p-5 border rounded-xl transition-all ${
        form.gscConnected
          ? 'bg-emerald-500/8 border-emerald-500/25'
          : 'bg-white/3 border-white/8'
      }`}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-medium text-white text-sm mb-1">Google Search Console</h3>
            <p className="text-xs text-[#94a3b8] leading-relaxed">
              Keyword impressions, click-through rates, and ranking positions. Powers WebOpp™ intelligence.
            </p>
          </div>
          {form.gscConnected ? (
            <ConnectedBadge />
          ) : (
            <button
              onClick={connectGSC}
              disabled={!siteId}
              className="flex-shrink-0 px-3 py-1.5 bg-white/8 hover:bg-white/12 disabled:opacity-40 border border-[#bae6fd] rounded-lg text-xs font-medium text-white transition-colors flex items-center gap-1.5"
            >
              <GoogleIcon /> Connect
            </button>
          )}
        </div>
      </div>

      {/* No siteId warning */}
      {!siteId && (
        <p className="text-xs text-amber-400/80 text-center">
          Complete Step 1 first — we need your site URL before connecting Google.
        </p>
      )}

      {/* Scenario status */}
      {dataAvail.scenario && (
        <div className={`p-4 rounded-xl border ${SCENARIOS[dataAvail.scenario].bgColor} ${SCENARIOS[dataAvail.scenario].borderColor}`}>
          <div className="flex items-center gap-2 mb-1">
            <div className={`w-2 h-2 rounded-full ${SCENARIOS[dataAvail.scenario].dotColor}`} />
            <span className={`text-xs font-semibold ${SCENARIOS[dataAvail.scenario].textColor}`}>
              {SCENARIOS[dataAvail.scenario].label}
            </span>
          </div>
          <p className="text-xs text-[#94a3b8]">
            Report timeline: {SCENARIOS[dataAvail.scenario].reportTimeline}
          </p>
        </div>
      )}
    </div>
  );
}

function Step5({ form, update, errors }: {
  form: OnboardingFormData;
  update: (f: keyof OnboardingFormData, v: unknown) => void;
  errors: Record<string, string>;
}) {
  return (
    <>
      <p className="text-sm text-[#94a3b8] -mt-2 mb-4">
        These numbers let WebGrade convert behavioral findings into dollar impact — e.g. "fixing this drop-off could be worth $X/mo".
      </p>
      <Field label="Monthly ad spend (USD)" hint="Leave blank if you don't run paid ads" error={errors.monthlyAdSpend}>
        <div className="relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30 text-sm">$</span>
          <input type="number" placeholder="5000" value={form.monthlyAdSpend}
            onChange={e => update('monthlyAdSpend', e.target.value)} className={`${inputClass} pl-8`} />
        </div>
      </Field>
      <Field label="Average order / deal value (USD)" error={errors.averageOrderValue}>
        <div className="relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30 text-sm">$</span>
          <input type="number" placeholder="500" value={form.averageOrderValue}
            onChange={e => update('averageOrderValue', e.target.value)} className={`${inputClass} pl-8`} />
        </div>
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Lead-to-win rate" hint="% of leads that become customers">
          <div className="relative">
            <input type="number" placeholder="20" min="0" max="100" value={form.leadToWinRate}
              onChange={e => update('leadToWinRate', e.target.value)} className={`${inputClass} pr-8`} />
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30 text-sm">%</span>
          </div>
        </Field>
        <Field label="Site conversion rate" hint="% of visitors who convert">
          <div className="relative">
            <input type="number" placeholder="2.5" min="0" max="100" step="0.1" value={form.conversionRate}
              onChange={e => update('conversionRate', e.target.value)} className={`${inputClass} pr-8`} />
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30 text-sm">%</span>
          </div>
        </Field>
      </div>
    </>
  );
}

function ConnectedBadge() {
  return (
    <div className="flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
      <span className="text-xs font-medium text-emerald-400">Connected</span>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}
