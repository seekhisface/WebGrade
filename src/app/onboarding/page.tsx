'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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
  gadsConnected: boolean;
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
  gadsConnected: false,
  monthlyAdSpend: '',
  averageOrderValue: '',
  leadToWinRate: '',
  conversionRate: '',
};

const inputClass = 'w-full bg-white border border-[#bae6fd] text-[#1e293b] placeholder-[#94a3b8] rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#0c4a6e] focus:ring-1 focus:ring-[#0c4a6e] transition-colors';
const textareaClass = `${inputClass} resize-none`;

// ---------------------------------------------------------------------------
// DetectedCta interface
// ---------------------------------------------------------------------------

interface DetectedCta {
  pageUrl: string;
  pageTitle: string;
  type: 'form' | 'button' | 'link';
  text: string;
  destination: string;
  confidence: 'high' | 'medium' | 'low';
  suggestedGoalName: string;
}

// ---------------------------------------------------------------------------
// Main page (wrapped in Suspense)
// ---------------------------------------------------------------------------

export default function OnboardingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#f0f9ff] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#0c4a6e] border-t-transparent rounded-full animate-spin" />
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

  const [step, setStep] = useState(1);
  const [form, setForm] = useState<OnboardingFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const totalSteps = 3;

  // Restore step from URL param
  useEffect(() => {
    const urlStep = searchParams.get('step');
    if (urlStep) {
      const parsed = parseInt(urlStep, 10);
      if (parsed >= 1 && parsed <= totalSteps) setStep(parsed);
    }
  }, [searchParams]);

  function update(field: keyof OnboardingFormData, value: unknown) {
    setForm(prev => ({ ...prev, [field]: value }));
    setErrors(prev => ({ ...prev, [field]: '' }));
  }

  function validateStep(): boolean {
    const newErrors: Record<string, string> = {};
    if (step === 1) {
      if (!form.siteUrl) newErrors.siteUrl = 'Site URL is required';
      else if (!form.siteUrl.startsWith('http')) newErrors.siteUrl = 'Must start with https://';
      if (!form.siteName) newErrors.siteName = 'Site name is required';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleNext() {
    if (!validateStep()) return;

    // After Step 1 -- create the site so we have a siteId for steps 2 and 3
    if (step === 1 && !siteId) {
      setSaving(true);
      try {
        const res = await fetch('/api/onboarding/create-site', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            siteUrl: form.siteUrl,
            siteName: form.siteName,
            conversionGoalUrl: form.conversionGoalUrl,
            conversionGoalName: form.conversionGoalName,
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

    // Step 2 -> Step 3: just advance
    if (step < totalSteps) {
      if (siteId) router.replace(`/onboarding?siteId=${siteId}&step=${step + 1}`);
      setStep(s => s + 1);
      return;
    }

    // Final step -- save everything and launch dashboard
    setSaving(true);
    try {
      await fetch('/api/onboarding/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, siteId }),
      });
      router.push(`/dashboard/${siteId}`);
    } catch {
      setSaving(false);
    }
  }

  function handleBack() {
    const prev = step - 1;
    if (prev >= 1) {
      if (siteId) router.replace(`/onboarding?siteId=${siteId}&step=${prev}`);
      setStep(prev);
    }
  }

  // ── Progress bar ─────────────────────────────────────────────────────────
  const progress = ((step - 1) / (totalSteps - 1)) * 100;

  const STEP_TITLES = [
    { title: 'Add Your Site', description: 'Tell us what site to analyze' },
    { title: 'Tell Us About Your Business', description: 'This powers every AI insight WebGrade generates' },
    { title: 'Connect Your Data', description: 'Optional integrations that unlock deeper intelligence' },
  ];
  const currentStepInfo = STEP_TITLES[step - 1];

  return (
    <div className="min-h-screen bg-[#f0f9ff] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-xl">
        <Logo />

        {/* Progress */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-[#475569] font-medium">Step {step} of {totalSteps}</span>
            <span className="text-xs text-[#475569]">{Math.round(progress)}% complete</span>
          </div>
          <div className="h-1.5 bg-[#e0f2fe] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#0c4a6e] rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="bg-white border border-[#bae6fd] rounded-2xl p-8 shadow-sm">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-[#0c4a6e] mb-1">{currentStepInfo.title}</h2>
            <p className="text-sm text-[#475569]">{currentStepInfo.description}</p>
          </div>

          <div className="space-y-4">
            {step === 1 && <Step1 form={form} update={update} errors={errors} />}
            {step === 2 && <Step2 form={form} update={update} errors={errors} />}
            {step === 3 && <Step3 form={form} update={update} siteId={siteId} />}
          </div>

          <div className="flex gap-3 mt-8">
            {step > 1 && (
              <button
                onClick={handleBack}
                className="px-4 py-2.5 bg-[#f0f9ff] hover:bg-[#e0f2fe] text-[#475569] text-sm font-medium rounded-xl border border-[#bae6fd] transition-colors"
              >
                &larr; Back
              </button>
            )}
            <button
              onClick={handleNext}
              disabled={saving}
              className="flex-1 bg-[#0c4a6e] hover:bg-[#0e5f8a] disabled:bg-[#0c4a6e]/40 text-white font-medium py-2.5 px-4 rounded-xl transition-colors text-sm"
            >
              {saving ? 'Saving...' : step === totalSteps ? 'Launch my dashboard \u2192' : 'Continue \u2192'}
            </button>
          </div>
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
    <div className="mb-8">
      <img src="/logos/webgrade_logo.svg" alt="WebGrade" className="h-10 w-auto" />
    </div>
  );
}

function Field({ label, hint, error, tooltip, children }: {
  label: string; hint?: string; error?: string; tooltip?: string; children: React.ReactNode;
}) {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5">
        <label className="block text-sm font-medium text-[#475569]">{label}</label>
        {tooltip && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowTooltip(!showTooltip)}
              onMouseEnter={() => setShowTooltip(true)}
              onMouseLeave={() => setShowTooltip(false)}
              className="w-4 h-4 rounded-full bg-[#e0f2fe] text-[#0c4a6e] text-[10px] font-bold flex items-center justify-center hover:bg-[#bae6fd] transition-colors"
            >
              ?
            </button>
            {showTooltip && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-[#0c4a6e] text-white text-xs rounded-lg shadow-lg z-10 leading-relaxed">
                {tooltip}
                <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-[#0c4a6e]" />
              </div>
            )}
          </div>
        )}
      </div>
      {hint && <p className="text-xs text-[#64748b] mb-2 leading-relaxed">{hint}</p>}
      {children}
      {error && <p className="text-xs text-red-500 mt-1.5">{error}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 1: Add Your Site
// ---------------------------------------------------------------------------

function Step1({ form, update, errors }: {
  form: OnboardingFormData;
  update: (f: keyof OnboardingFormData, v: unknown) => void;
  errors: Record<string, string>;
}) {
  const [scanning, setScanning] = useState(false);
  const [ctas, setCtas] = useState<DetectedCta[]>([]);
  const [scanError, setScanError] = useState('');
  const [selectedCtaIndex, setSelectedCtaIndex] = useState<number | null>(null);

  async function scanForCtas() {
    if (!form.siteUrl) return;
    setScanning(true);
    setScanError('');
    setCtas([]);
    setSelectedCtaIndex(null);
    try {
      const res = await fetch('/api/detect-ctas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: form.siteUrl }),
      });
      if (!res.ok) throw new Error('Scan failed');
      const data = await res.json();
      setCtas(data.ctas || []);
      if (!data.ctas?.length) setScanError('No CTAs detected \u2014 enter your goal manually below.');
    } catch {
      setScanError("Couldn't scan your site \u2014 enter your goal manually below.");
    } finally {
      setScanning(false);
    }
  }

  function selectCta(cta: DetectedCta, index: number) {
    setSelectedCtaIndex(index);
    update('conversionGoalUrl', cta.destination.startsWith('http') ? cta.destination : `${form.siteUrl.replace(/\/$/, '')}${cta.destination}`);
    update('conversionGoalName', cta.suggestedGoalName);
  }

  const showScanButton = form.siteUrl.length > 8 && form.siteUrl.startsWith('http');

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

      {showScanButton && (
        <div className="mt-1">
          <button
            type="button"
            onClick={scanForCtas}
            disabled={scanning}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-[#0c4a6e] bg-[#e0f2fe] border border-[#bae6fd] rounded-lg hover:bg-[#bae6fd] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {scanning ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
                Scanning your site for conversion actions...
              </>
            ) : (
              <>Scan your site</>
            )}
          </button>
        </div>
      )}

      {scanError && (
        <p className="text-xs text-amber-600 mt-2">{scanError}</p>
      )}

      {ctas.length > 0 && (
        <div className="mt-3 space-y-2">
          <p className="text-xs text-[#475569] font-medium">Detected conversion actions \u2014 click to select:</p>
          <div className="grid gap-2">
            {ctas.map((cta, i) => (
              <button
                key={i}
                type="button"
                onClick={() => selectCta(cta, i)}
                className={`text-left p-3 rounded-lg border transition-colors ${
                  selectedCtaIndex === i
                    ? 'border-[#0c4a6e] bg-[#e0f2fe] ring-1 ring-[#0c4a6e]'
                    : cta.confidence === 'high'
                    ? 'border-[#bae6fd] bg-[#f0f9ff] hover:border-[#0c4a6e]'
                    : 'border-[#e2e8f0] bg-white hover:border-[#bae6fd]'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-[#1e293b]">{cta.text}</span>
                  <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${
                    cta.confidence === 'high'
                      ? 'bg-emerald-100 text-emerald-700'
                      : cta.confidence === 'medium'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {cta.confidence}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-[#64748b]">
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-[#f1f5f9] rounded text-[10px] font-medium uppercase text-[#475569]">
                    {cta.type}
                  </span>
                  <span className="truncate">on {cta.pageTitle || cta.pageUrl}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Conversion goal fields */}
      <div className="pt-2 border-t border-[#e0f2fe] mt-4">
        <Field
          label="Conversion Goal"
          tooltip="A conversion goal tells WebGrade what success looks like on your site. Without it, we can track behavior but can't calculate revenue impact."
        >
          <div className="space-y-4">
            <div>
              <p className="text-xs text-[#64748b] mb-1.5 leading-relaxed">
                The URL someone lands on after converting \u2014 like a thank-you page, confirmation page, or signup success page. Example: /thank-you or /welcome
              </p>
              <input type="url" placeholder="https://yoursite.com/thank-you" value={form.conversionGoalUrl}
                onChange={e => update('conversionGoalUrl', e.target.value)} className={inputClass} />
            </div>
            <div>
              <p className="text-xs text-[#64748b] mb-1.5 leading-relaxed">
                A short name for this conversion \u2014 this is how it appears in your reports
              </p>
              <input type="text" placeholder="e.g. Free trial signup, Demo booked, Purchase complete"
                value={form.conversionGoalName} onChange={e => update('conversionGoalName', e.target.value)}
                className={inputClass} />
            </div>
          </div>
        </Field>
        <p className="text-xs text-[#94a3b8] mt-2 italic">You can set this up later in Settings</p>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Step 2: Tell Us About Your Business
// ---------------------------------------------------------------------------

function Step2({ form, update, errors }: {
  form: OnboardingFormData;
  update: (f: keyof OnboardingFormData, v: unknown) => void;
  errors: Record<string, string>;
}) {
  const [showDeliverables, setShowDeliverables] = useState(false);

  function updateCompetitor(index: number, value: string) {
    const updated = [...form.competitorUrls];
    updated[index] = value;
    update('competitorUrls', updated);
  }

  return (
    <>
      <Field
        label="Describe your business"
        hint="This powers every AI insight. Example: 'We're a B2B SaaS company that sells project management tools to marketing teams at mid-size companies.'"
        error={errors.businessDescription}
      >
        <textarea rows={3}
          placeholder="What does your company do? Who do you serve? What do you sell?"
          value={form.businessDescription} onChange={e => update('businessDescription', e.target.value)}
          className={textareaClass} />
      </Field>

      <Field
        label="Target audience"
        hint="Who are you trying to reach? Example: 'VP of Marketing at companies with 50-200 employees'"
      >
        <input type="text" placeholder="Describe your ideal visitor or buyer"
          value={form.targetAudience} onChange={e => update('targetAudience', e.target.value)}
          className={inputClass} />
      </Field>

      <Field
        label="Primary value proposition"
        hint="What makes you different? Example: 'The only tool that shows exactly why visitors don't convert'"
      >
        <input type="text" placeholder="What sets you apart from alternatives?"
          value={form.primaryValueProp} onChange={e => update('primaryValueProp', e.target.value)}
          className={inputClass} />
      </Field>

      <div className="pt-2 border-t border-[#e0f2fe] mt-2">
        <p className="text-sm font-medium text-[#475569] mb-1">Competitors</p>
        <p className="text-xs text-[#64748b] mb-3 leading-relaxed">
          We'll analyze their keywords and content to find gaps you can exploit
        </p>
        {[0, 1, 2].map(i => (
          <div key={i} className="mb-3">
            <input type="url" placeholder={`https://competitor${i + 1}.com`}
              value={form.competitorUrls[i] ?? ''}
              onChange={e => updateCompetitor(i, e.target.value)} className={inputClass} />
          </div>
        ))}
      </div>

      {/* What WebGrade delivers */}
      <div className="mt-4">
        <button
          type="button"
          onClick={() => setShowDeliverables(!showDeliverables)}
          className="w-full flex items-center justify-between p-4 bg-[#f0f9ff] border border-[#bae6fd] rounded-xl hover:bg-[#e0f2fe] transition-colors"
        >
          <span className="text-sm font-medium text-[#0c4a6e]">What WebGrade delivers</span>
          <svg
            className={`w-4 h-4 text-[#0c4a6e] transition-transform ${showDeliverables ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {showDeliverables && (
          <div className="mt-2 p-5 bg-[#f0f9ff] border border-[#bae6fd] rounded-xl">
            <div className="space-y-2.5">
              {[
                'Live behavioral tracking from day 1',
                'Intent scoring on every visitor',
                'Drop-off analysis with revenue impact',
                'AI-powered fix recommendations',
                'SEO keyword intelligence (when GSC connected)',
                'Monthly trend tracking',
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <svg className="w-4 h-4 text-teal-600 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm text-[#475569]">{item}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Step 3: Connect Your Data (Optional)
// ---------------------------------------------------------------------------

function Step3({ form, update, siteId }: {
  form: OnboardingFormData;
  update: (f: keyof OnboardingFormData, v: unknown) => void;
  siteId: string;
}) {
  const searchParams = useSearchParams();

  // Pick up OAuth success params from callback redirect
  const ga4Param = searchParams.get('ga4');
  const gscParam = searchParams.get('gsc');
  const gadsParam = searchParams.get('gads');

  useEffect(() => {
    if (ga4Param === 'connected') update('ga4Connected', true);
    if (gscParam === 'connected') update('gscConnected', true);
    if (gadsParam === 'connected') update('gadsConnected', true);
  }, [ga4Param, gscParam, gadsParam]); // eslint-disable-line react-hooks/exhaustive-deps

  const [ga4Importing, setGa4Importing] = useState(false);
  const [ga4ImportDone, setGa4ImportDone] = useState(false);
  const [ga4ImportError, setGa4ImportError] = useState('');

  // Poll import status when GA4 connects
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
      if (attempts > 30) {
        clearInterval(interval);
        setGa4Importing(false);
        setGa4ImportError('Import is taking longer than expected. It will complete in the background.');
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [form.ga4Connected, siteId]); // eslint-disable-line react-hooks/exhaustive-deps

  function connectGA4() {
    if (!siteId) return;
    window.location.href = `/api/ga4/authorize?siteId=${siteId}`;
  }

  function connectGSC() {
    if (!siteId) return;
    window.location.href = `/api/gsc/authorize?siteId=${siteId}`;
  }

  function connectGAds() {
    if (!siteId) return;
    window.location.href = `/api/gads/authorize?siteId=${siteId}`;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-[#475569] -mt-2 mb-2 leading-relaxed">
        Everything here is optional \u2014 you can connect these anytime from Settings. WebGrade works without them, but each connection unlocks more intelligence.
      </p>

      {/* GA4 */}
      <DataSourceCard
        title="Google Analytics 4"
        description="Imports your last 90 days as a baseline. Every recommendation shows delta from this baseline."
        connected={form.ga4Connected}
        importing={ga4Importing}
        importDone={ga4ImportDone}
        importError={ga4ImportError}
        onConnect={connectGA4}
        disabled={!siteId}
      />

      {/* GSC */}
      <DataSourceCard
        title="Google Search Console"
        description="Keyword impressions, click-through rates, and ranking positions. Powers keyword intelligence."
        connected={form.gscConnected}
        onConnect={connectGSC}
        disabled={!siteId}
      />

      {/* Google Ads */}
      <DataSourceCard
        title="Google Ads"
        description="Ad spend, campaign performance, and cost-per-conversion data for ROI analysis."
        connected={form.gadsConnected}
        onConnect={connectGAds}
        disabled={!siteId}
      />

      {/* Revenue data */}
      <div className="pt-4 border-t border-[#e0f2fe]">
        <h3 className="text-sm font-medium text-[#0c4a6e] mb-1">Revenue context</h3>
        <p className="text-xs text-[#64748b] mb-4 leading-relaxed">
          These numbers let WebGrade convert behavioral findings into dollar impact \u2014 e.g. &quot;fixing this drop-off could be worth $X/mo&quot;.
        </p>

        <div className="space-y-4">
          <Field
            label="Monthly ad spend"
            tooltip="Used to calculate cost-per-lead and wasted ad spend from drop-offs. Leave blank if you don't run paid ads."
          >
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94a3b8] text-sm">$</span>
              <input type="number" placeholder="5000" value={form.monthlyAdSpend}
                onChange={e => update('monthlyAdSpend', e.target.value)} className={`${inputClass} pl-8`} />
            </div>
          </Field>

          <Field
            label="Average order / deal value"
            tooltip="Used to estimate revenue impact of conversion improvements. What is a typical sale worth?"
          >
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94a3b8] text-sm">$</span>
              <input type="number" placeholder="500" value={form.averageOrderValue}
                onChange={e => update('averageOrderValue', e.target.value)} className={`${inputClass} pl-8`} />
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field
              label="Lead-to-win rate"
              tooltip="The percentage of leads that eventually become paying customers. Used to project downstream revenue from conversion lifts."
            >
              <div className="relative">
                <input type="number" placeholder="20" min="0" max="100" value={form.leadToWinRate}
                  onChange={e => update('leadToWinRate', e.target.value)} className={`${inputClass} pr-8`} />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#94a3b8] text-sm">%</span>
              </div>
            </Field>

            <Field
              label="Website conversion rate"
              tooltip="The percentage of website visitors who complete your conversion goal. Used as the baseline for improvement estimates."
            >
              <div className="relative">
                <input type="number" placeholder="2.5" min="0" max="100" step="0.1" value={form.conversionRate}
                  onChange={e => update('conversionRate', e.target.value)} className={`${inputClass} pr-8`} />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#94a3b8] text-sm">%</span>
              </div>
            </Field>
          </div>
        </div>

        <p className="text-xs text-[#94a3b8] mt-3 italic">All revenue fields are optional. You can update them anytime in Settings.</p>
      </div>

      {/* No siteId warning */}
      {!siteId && (
        <p className="text-xs text-amber-600 text-center mt-4">
          Complete Step 1 first \u2014 we need your site URL before connecting data sources.
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared sub-components
// ---------------------------------------------------------------------------

function DataSourceCard({ title, description, connected, importing, importDone, importError, onConnect, disabled }: {
  title: string;
  description: string;
  connected: boolean;
  importing?: boolean;
  importDone?: boolean;
  importError?: string;
  onConnect: () => void;
  disabled: boolean;
}) {
  return (
    <div className={`p-5 border rounded-xl transition-all ${
      connected
        ? 'bg-emerald-50 border-emerald-200'
        : 'bg-white border-[#bae6fd]'
    }`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-medium text-[#0c4a6e] text-sm">{title}</h3>
            {connected && !importDone && importing && (
              <span className="flex items-center gap-1 text-xs text-amber-600">
                <span className="w-3 h-3 border border-amber-600 border-t-transparent rounded-full animate-spin inline-block" />
                Importing...
              </span>
            )}
            {importDone && (
              <span className="text-xs text-emerald-600">Baseline imported</span>
            )}
          </div>
          <p className="text-xs text-[#64748b] leading-relaxed">{description}</p>
          {importError && (
            <p className="text-xs text-amber-600 mt-1">{importError}</p>
          )}
        </div>
        {connected ? (
          <ConnectedBadge />
        ) : (
          <button
            onClick={onConnect}
            disabled={disabled}
            className="flex-shrink-0 px-3 py-1.5 bg-[#e0f2fe] hover:bg-[#bae6fd] disabled:opacity-40 border border-[#bae6fd] rounded-lg text-xs font-medium text-[#0c4a6e] transition-colors flex items-center gap-1.5"
          >
            <GoogleIcon /> Connect
          </button>
        )}
      </div>

      {/* Import progress for GA4 */}
      {connected && importing && (
        <div className="mt-3 pt-3 border-t border-emerald-200">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-[#64748b]">Importing 90-day baseline...</span>
            <span className="text-xs text-[#94a3b8]">This takes ~10 seconds</span>
          </div>
          <div className="h-1 bg-[#e0f2fe] rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full animate-pulse w-2/3" />
          </div>
        </div>
      )}

      {importDone && (
        <div className="mt-3 pt-3 border-t border-emerald-200">
          <p className="text-xs text-emerald-600">
            Sessions, bounce rate, conversion rate, and top pages imported. Your behavioral insights will be benchmarked against this baseline.
          </p>
        </div>
      )}
    </div>
  );
}

function ConnectedBadge() {
  return (
    <div className="flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1 bg-emerald-100 border border-emerald-200 rounded-lg">
      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
      <span className="text-xs font-medium text-emerald-700">Connected</span>
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
