'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

// Onboarding steps
const STEPS = [
  { id: 1, title: 'Your site', description: 'Tell us about the site you want to analyze' },
  { id: 2, title: 'Your business', description: 'Help us give you smarter, more relevant insights' },
  { id: 3, title: 'Competitors', description: 'We\'ll track what they rank for that you don\'t' },
  { id: 4, title: 'Connect GA4', description: 'Import your historical baseline (optional but recommended)' },
  { id: 5, title: 'Your goals', description: 'Set revenue context so insights include dollar impact' },
];

interface OnboardingFormData {
  // Step 1
  siteUrl: string;
  siteName: string;
  conversionGoalUrl: string;
  conversionGoalName: string;
  // Step 2
  businessDescription: string;
  targetAudience: string;
  primaryValueProp: string;
  // Step 3
  competitorUrls: string[];
  // Step 4
  ga4Connected: boolean;
  // Step 5
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
  monthlyAdSpend: '',
  averageOrderValue: '',
  leadToWinRate: '',
  conversionRate: '',
};

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<OnboardingFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const totalSteps = STEPS.length;
  const currentStep = STEPS[step - 1];
  const progress = ((step - 1) / (totalSteps - 1)) * 100;

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
      if (!form.conversionGoalUrl) newErrors.conversionGoalUrl = 'Conversion goal URL is required — this is what WebGrade measures toward';
      if (!form.conversionGoalName) newErrors.conversionGoalName = 'Name this goal (e.g. "Free trial signup")';
    }

    if (step === 2) {
      if (!form.businessDescription || form.businessDescription.length < 20) {
        newErrors.businessDescription = 'Please describe your business (at least 20 characters) — this is injected into every AI insight';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleNext() {
    if (!validateStep()) return;

    if (step < totalSteps) {
      setStep(s => s + 1);
      return;
    }

    // Final step — submit
    setSaving(true);
    try {
      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      if (!res.ok) throw new Error('Failed to save onboarding');

      const data = await res.json();
      router.push(`/dashboard/${data.siteId}`);
    } catch (err) {
      console.error(err);
      setErrors({ _general: 'Something went wrong. Please try again.' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white flex flex-col">
      {/* Header */}
      <header className="px-8 py-6 flex items-center justify-between border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">W</span>
          </div>
          <span className="font-semibold text-white">WebGrade</span>
        </div>
        <span className="text-sm text-white/40">Step {step} of {totalSteps}</span>
      </header>

      {/* Progress bar */}
      <div className="h-1 bg-white/5">
        <div
          className="h-full bg-brand-500 transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-xl">
          {/* Step indicator dots */}
          <div className="flex items-center gap-2 mb-10 justify-center">
            {STEPS.map(s => (
              <div
                key={s.id}
                className={`rounded-full transition-all duration-300 ${
                  s.id === step
                    ? 'w-6 h-2 bg-brand-500'
                    : s.id < step
                    ? 'w-2 h-2 bg-brand-700'
                    : 'w-2 h-2 bg-white/10'
                }`}
              />
            ))}
          </div>

          {/* Step heading */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">{currentStep.title}</h1>
            <p className="text-white/50 text-base">{currentStep.description}</p>
          </div>

          {/* Form fields */}
          <div className="space-y-5">
            {step === 1 && <Step1 form={form} update={update} errors={errors} />}
            {step === 2 && <Step2 form={form} update={update} errors={errors} />}
            {step === 3 && <Step3 form={form} update={update} errors={errors} />}
            {step === 4 && <Step4 form={form} update={update} />}
            {step === 5 && <Step5 form={form} update={update} errors={errors} />}
          </div>

          {errors._general && (
            <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              {errors._general}
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between mt-10">
            {step > 1 ? (
              <button
                onClick={() => setStep(s => s - 1)}
                className="px-5 py-2.5 text-white/50 hover:text-white transition-colors text-sm"
              >
                ← Back
              </button>
            ) : (
              <div />
            )}

            <button
              onClick={handleNext}
              disabled={saving}
              className="px-6 py-3 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors text-sm"
            >
              {saving ? 'Setting up...' : step === totalSteps ? 'Launch WebGrade →' : 'Continue →'}
            </button>
          </div>

          {/* Skip hint for optional steps */}
          {(step === 3 || step === 4 || step === 5) && (
            <p className="text-center text-white/25 text-xs mt-4">
              This step is optional — you can always complete it later in Settings
            </p>
          )}
        </div>
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step components
// ---------------------------------------------------------------------------

function Field({
  label, hint, error, children
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-white/80 mb-1.5">{label}</label>
      {hint && <p className="text-xs text-white/35 mb-2">{hint}</p>}
      {children}
      {error && <p className="mt-1.5 text-xs text-red-400">{error}</p>}
    </div>
  );
}

const inputClass = `
  w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white
  placeholder:text-white/25 focus:outline-none focus:border-brand-500 focus:ring-1
  focus:ring-brand-500/50 transition-colors text-sm
`.trim();

const textareaClass = `${inputClass} resize-none`;

function Step1({
  form, update, errors
}: {
  form: OnboardingFormData;
  update: (f: keyof OnboardingFormData, v: unknown) => void;
  errors: Record<string, string>;
}) {
  return (
    <>
      <Field label="Site URL" error={errors.siteUrl}>
        <input
          type="url"
          placeholder="https://yoursite.com"
          value={form.siteUrl}
          onChange={e => update('siteUrl', e.target.value)}
          className={inputClass}
        />
      </Field>

      <Field label="Site name" error={errors.siteName}>
        <input
          type="text"
          placeholder="Acme Inc"
          value={form.siteName}
          onChange={e => update('siteName', e.target.value)}
          className={inputClass}
        />
      </Field>

      <Field
        label="Conversion goal URL"
        hint="The page a visitor lands on after completing your most important action (e.g. /thank-you, /welcome, /confirmation). Everything WebGrade measures points toward this."
        error={errors.conversionGoalUrl}
      >
        <input
          type="url"
          placeholder="https://yoursite.com/thank-you"
          value={form.conversionGoalUrl}
          onChange={e => update('conversionGoalUrl', e.target.value)}
          className={inputClass}
        />
      </Field>

      <Field label="What is this goal called?" error={errors.conversionGoalName}>
        <input
          type="text"
          placeholder="e.g. Free trial signup, Demo booked, Purchase complete"
          value={form.conversionGoalName}
          onChange={e => update('conversionGoalName', e.target.value)}
          className={inputClass}
        />
      </Field>
    </>
  );
}

function Step2({
  form, update, errors
}: {
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
        <textarea
          rows={3}
          placeholder="e.g. We sell project management software to marketing teams at SaaS companies. Our main competitor is Asana. Our free trial converts at about 12%."
          value={form.businessDescription}
          onChange={e => update('businessDescription', e.target.value)}
          className={textareaClass}
        />
      </Field>

      <Field label="Who is your target visitor?" hint="Who are you trying to convert?">
        <input
          type="text"
          placeholder="e.g. Founders of SaaS companies with 10–50 employees"
          value={form.targetAudience}
          onChange={e => update('targetAudience', e.target.value)}
          className={inputClass}
        />
      </Field>

      <Field label="What is your primary value proposition?">
        <input
          type="text"
          placeholder="e.g. The only tool that shows you exactly why visitors don't convert"
          value={form.primaryValueProp}
          onChange={e => update('primaryValueProp', e.target.value)}
          className={inputClass}
        />
      </Field>
    </>
  );
}

function Step3({
  form, update, errors: _errors
}: {
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
      <p className="text-sm text-white/50 -mt-2 mb-4">
        We&apos;ll crawl these sites to find keywords they rank for that you don&apos;t, and compare their above-fold messaging to yours.
      </p>
      {[0, 1, 2].map(i => (
        <Field key={i} label={`Competitor ${i + 1} URL`}>
          <input
            type="url"
            placeholder={`https://competitor${i + 1}.com`}
            value={form.competitorUrls[i] ?? ''}
            onChange={e => updateCompetitor(i, e.target.value)}
            className={inputClass}
          />
        </Field>
      ))}
    </>
  );
}

function Step4({
  form, update
}: {
  form: OnboardingFormData;
  update: (f: keyof OnboardingFormData, v: unknown) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="p-5 bg-white/3 border border-white/8 rounded-xl">
        <h3 className="font-medium text-white mb-1">Why connect GA4?</h3>
        <p className="text-sm text-white/45 leading-relaxed">
          WebGrade imports your last 90 days of GA4 data as a baseline — sessions, bounce rate, conversion rate, and session duration.
          Every recommendation shows the delta from this baseline so you can see what actually improved.
        </p>
      </div>

      {!form.ga4Connected ? (
        <button
          onClick={() => {
            // In production: initiate Google OAuth flow
            // For now: simulate connection
            update('ga4Connected', true);
          }}
          className="w-full flex items-center justify-center gap-3 px-5 py-3.5 bg-white/5 hover:bg-white/8 border border-white/10 hover:border-white/20 rounded-lg transition-all text-sm font-medium text-white"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Connect Google Analytics 4
        </button>
      ) : (
        <div className="flex items-center gap-3 p-4 bg-status-green/10 border border-status-green/20 rounded-lg">
          <div className="w-5 h-5 bg-status-green rounded-full flex items-center justify-center flex-shrink-0">
            <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
              <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-white">GA4 connected</p>
            <p className="text-xs text-white/40">Baseline import will run in the background</p>
          </div>
        </div>
      )}

      <p className="text-center text-white/25 text-xs">
        Read-only access only. We never modify your GA4 data.
      </p>
    </div>
  );
}

function Step5({
  form, update, errors
}: {
  form: OnboardingFormData;
  update: (f: keyof OnboardingFormData, v: unknown) => void;
  errors: Record<string, string>;
}) {
  return (
    <>
      <p className="text-sm text-white/50 -mt-2 mb-4">
        These numbers let WebGrade convert behavioral findings into dollar impact — e.g. &ldquo;fixing this drop-off could be worth $X/mo&rdquo;.
      </p>

      <Field
        label="Monthly ad spend (USD)"
        hint="Leave blank if you don't run paid ads"
        error={errors.monthlyAdSpend}
      >
        <div className="relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30 text-sm">$</span>
          <input
            type="number"
            placeholder="5000"
            value={form.monthlyAdSpend}
            onChange={e => update('monthlyAdSpend', e.target.value)}
            className={`${inputClass} pl-8`}
          />
        </div>
      </Field>

      <Field label="Average order / deal value (USD)" error={errors.averageOrderValue}>
        <div className="relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30 text-sm">$</span>
          <input
            type="number"
            placeholder="500"
            value={form.averageOrderValue}
            onChange={e => update('averageOrderValue', e.target.value)}
            className={`${inputClass} pl-8`}
          />
        </div>
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Lead-to-win rate" hint="% of leads that become customers">
          <div className="relative">
            <input
              type="number"
              placeholder="20"
              min="0"
              max="100"
              value={form.leadToWinRate}
              onChange={e => update('leadToWinRate', e.target.value)}
              className={`${inputClass} pr-8`}
            />
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30 text-sm">%</span>
          </div>
        </Field>

        <Field label="Site conversion rate" hint="% of visitors who convert">
          <div className="relative">
            <input
              type="number"
              placeholder="2.5"
              min="0"
              max="100"
              step="0.1"
              value={form.conversionRate}
              onChange={e => update('conversionRate', e.target.value)}
              className={`${inputClass} pr-8`}
            />
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30 text-sm">%</span>
          </div>
        </Field>
      </div>
    </>
  );
}
