'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SiteInfo {
  id: string;
  name: string;
  domain: string;
  snippetId: string;
  installStatus: 'PENDING' | 'INSTALLED' | 'VERIFIED' | 'FAILED' | null;
  installMethod: string | null;
}

type Method = 'script' | 'gtm' | 'wordpress' | 'nextjs';

// ---------------------------------------------------------------------------
// Installation page
// ---------------------------------------------------------------------------

export default function SnippetInstallPage() {
  const params = useParams();
  const siteId = params.siteId as string;

  const [site, setSite] = useState<SiteInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);
  const [activeMethod, setActiveMethod] = useState<Method>('script');
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<'success' | 'fail' | null>(null);

  useEffect(() => {
    fetch(`/api/snippet/status?siteId=${siteId}`)
      .then(r => r.json())
      .then(setSite)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [siteId]);

  function copyToClipboard(text: string, label: string) {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  }

  async function verifyInstallation() {
    setVerifying(true);
    setVerifyResult(null);
    try {
      const res = await fetch(`/api/snippet/verify?siteId=${siteId}`);
      const data = await res.json();
      setVerifyResult(data.verified ? 'success' : 'fail');
      if (data.verified && site) {
        setSite({ ...site, installStatus: 'VERIFIED' });
      }
    } catch {
      setVerifyResult('fail');
    } finally {
      setVerifying(false);
    }
  }

  if (loading || !site) {
    return (
      <div className="min-h-screen bg-[#f0f9ff]">
        <div className="max-w-3xl mx-auto px-6 py-12 animate-pulse">
          <div className="h-8 w-64 bg-[#bae6fd] rounded-lg mb-4" />
          <div className="h-4 w-96 bg-[#bae6fd] rounded mb-8" />
          <div className="h-64 bg-white border border-[#bae6fd] rounded-2xl" />
        </div>
      </div>
    );
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const snippetUrl = `${origin}/api/snippet?id=${site.snippetId}`;
  const scriptTag = `<script src="${snippetUrl}" async></script>`;
  const gtmTag = `<script>\n(function(){\n  var s = document.createElement('script');\n  s.src = '${snippetUrl}';\n  s.async = true;\n  document.head.appendChild(s);\n})()\n</script>`;
  const nextjsCode = `// app/layout.tsx or pages/_app.tsx\nimport Script from 'next/script';\n\n<Script\n  src="${snippetUrl}"\n  strategy="afterInteractive"\n/>`;
  const wpSnippet = `// Add to your theme's functions.php:\nfunction webgrade_tracking_snippet() {\n  wp_enqueue_script(\n    'webgrade',\n    '${snippetUrl}',\n    array(),\n    '1.0.0',\n    true\n  );\n}\nadd_action('wp_enqueue_scripts', 'webgrade_tracking_snippet');`;

  const methods: { id: Method; label: string; icon: string; code: string }[] = [
    { id: 'script', label: 'HTML Script Tag', icon: '</>', code: scriptTag },
    { id: 'gtm',    label: 'Google Tag Manager', icon: 'GTM', code: gtmTag },
    { id: 'nextjs', label: 'Next.js', icon: 'N', code: nextjsCode },
    { id: 'wordpress', label: 'WordPress', icon: 'WP', code: wpSnippet },
  ];

  const activeCode = methods.find(m => m.id === activeMethod)?.code ?? '';

  return (
    <div className="min-h-screen bg-[#f0f9ff]" style={{ fontFamily: "'Inter', -apple-system, sans-serif" }}>
      <div className="max-w-3xl mx-auto px-6 py-10">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-black text-[#0c4a6e] mb-1">Install WebGrade</h1>
          <p className="text-sm text-[#64748b]">
            Add the tracking snippet to <strong className="text-[#0c4a6e]">{site.domain}</strong> to start collecting behavioral data.
          </p>
        </div>

        {/* Status banner */}
        {site.installStatus === 'VERIFIED' ? (
          <div className="mb-6 p-4 bg-[#f0fdf4] border border-[#bbf7d0] rounded-2xl flex items-center gap-3">
            <div className="w-8 h-8 bg-[#0d9488]/10 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-[#0d9488]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-[#0d9488]">Snippet verified and active</p>
              <p className="text-xs text-[#64748b]">WebGrade is collecting data for {site.domain}</p>
            </div>
          </div>
        ) : site.installStatus === 'INSTALLED' ? (
          <div className="mb-6 p-4 bg-[#fffbeb] border border-[#fde68a] rounded-2xl flex items-center gap-3">
            <div className="w-8 h-8 bg-[#b45309]/10 rounded-lg flex items-center justify-center">
              <span className="text-[#b45309]">⏳</span>
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-[#b45309]">Snippet installed — awaiting verification</p>
              <p className="text-xs text-[#64748b]">Click "Verify" below to confirm it's working.</p>
            </div>
          </div>
        ) : null}

        {/* Snippet ID */}
        <div className="mb-6 p-4 bg-white border border-[#e0f2fe] rounded-2xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-[#64748b] uppercase tracking-wider mb-1">Your Snippet ID</p>
              <p className="text-lg font-mono font-bold text-[#0c4a6e]">{site.snippetId}</p>
            </div>
            <button
              onClick={() => copyToClipboard(site.snippetId, 'id')}
              className="px-3 py-1.5 bg-[#f0f9ff] border border-[#bae6fd] text-[#0c4a6e] text-xs font-semibold rounded-lg hover:bg-[#e0f2fe] transition-colors"
            >
              {copied === 'id' ? '✓ Copied' : 'Copy ID'}
            </button>
          </div>
        </div>

        {/* Installation methods */}
        <div className="mb-6">
          <p className="text-xs font-bold text-[#64748b] uppercase tracking-wider mb-3">Choose your method</p>
          <div className="flex gap-2 mb-4">
            {methods.map(m => (
              <button
                key={m.id}
                onClick={() => setActiveMethod(m.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  activeMethod === m.id
                    ? 'bg-[#0c4a6e] text-white shadow-sm'
                    : 'bg-white border border-[#bae6fd] text-[#64748b] hover:text-[#0c4a6e] hover:border-[#0c4a6e]'
                }`}
              >
                <span className={`w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold ${
                  activeMethod === m.id ? 'bg-white/20' : 'bg-[#f0f9ff]'
                }`}>
                  {m.icon}
                </span>
                {m.label}
              </button>
            ))}
          </div>

          {/* Code block */}
          <div className="bg-[#0f172a] rounded-2xl overflow-hidden border border-[#1e293b]">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#1e293b]">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500/70" />
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/70" />
              </div>
              <button
                onClick={() => copyToClipboard(activeCode, 'code')}
                className="px-3 py-1 bg-white/10 hover:bg-white/20 text-white/70 text-xs font-medium rounded-lg transition-colors"
              >
                {copied === 'code' ? '✓ Copied!' : 'Copy code'}
              </button>
            </div>
            <pre className="p-5 text-sm text-emerald-300 font-mono overflow-x-auto leading-relaxed">
              {activeCode}
            </pre>
          </div>
        </div>

        {/* Instructions per method */}
        <div className="mb-8 p-5 bg-white border border-[#e0f2fe] rounded-2xl">
          <p className="text-xs font-bold text-[#64748b] uppercase tracking-wider mb-3">Instructions</p>
          {activeMethod === 'script' && (
            <ol className="text-sm text-[#334155] space-y-2 list-decimal list-inside">
              <li>Copy the script tag above</li>
              <li>Paste it into the <code className="px-1.5 py-0.5 bg-[#f0f9ff] border border-[#bae6fd] rounded text-xs text-[#0c4a6e] font-mono">&lt;head&gt;</code> section of your website</li>
              <li>Deploy your changes</li>
              <li>Click "Verify Installation" below to confirm</li>
            </ol>
          )}
          {activeMethod === 'gtm' && (
            <ol className="text-sm text-[#334155] space-y-2 list-decimal list-inside">
              <li>Open Google Tag Manager</li>
              <li>Create a new <strong>Custom HTML</strong> tag</li>
              <li>Paste the code above into the tag</li>
              <li>Set trigger to <strong>All Pages</strong></li>
              <li>Publish your container</li>
              <li>Click "Verify Installation" below to confirm</li>
            </ol>
          )}
          {activeMethod === 'nextjs' && (
            <ol className="text-sm text-[#334155] space-y-2 list-decimal list-inside">
              <li>Open your root layout file (<code className="px-1.5 py-0.5 bg-[#f0f9ff] border border-[#bae6fd] rounded text-xs text-[#0c4a6e] font-mono">app/layout.tsx</code>)</li>
              <li>Import <code className="px-1.5 py-0.5 bg-[#f0f9ff] border border-[#bae6fd] rounded text-xs text-[#0c4a6e] font-mono">Script</code> from <code className="px-1.5 py-0.5 bg-[#f0f9ff] border border-[#bae6fd] rounded text-xs text-[#0c4a6e] font-mono">next/script</code></li>
              <li>Add the Script component inside the body</li>
              <li>Deploy and click "Verify Installation" below</li>
            </ol>
          )}
          {activeMethod === 'wordpress' && (
            <ol className="text-sm text-[#334155] space-y-2 list-decimal list-inside">
              <li>Open your theme's <code className="px-1.5 py-0.5 bg-[#f0f9ff] border border-[#bae6fd] rounded text-xs text-[#0c4a6e] font-mono">functions.php</code> file</li>
              <li>Add the code above at the end of the file</li>
              <li>Save and deploy</li>
              <li>Click "Verify Installation" below to confirm</li>
            </ol>
          )}
        </div>

        {/* Verify button */}
        <div className="flex items-center gap-4">
          <button
            onClick={verifyInstallation}
            disabled={verifying}
            className="px-6 py-3 bg-[#0c4a6e] hover:bg-[#075985] text-white text-sm font-bold rounded-xl transition-colors shadow-sm disabled:opacity-50"
          >
            {verifying ? 'Verifying...' : 'Verify Installation'}
          </button>

          {verifyResult === 'success' && (
            <div className="flex items-center gap-2 text-[#0d9488]">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm font-semibold">Snippet detected and working!</span>
            </div>
          )}
          {verifyResult === 'fail' && (
            <div className="flex items-center gap-2 text-[#b91c1c]">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              <span className="text-sm font-semibold">Snippet not detected yet. Check your installation and try again.</span>
            </div>
          )}
        </div>

        {/* Help section */}
        <div className="mt-10 p-5 bg-white border border-[#e0f2fe] rounded-2xl">
          <p className="text-xs font-bold text-[#64748b] uppercase tracking-wider mb-3">What happens next?</p>
          <div className="grid grid-cols-3 gap-4">
            {[
              { step: '1', title: 'Install snippet', desc: 'Add the code to your site. Takes under 2 minutes.' },
              { step: '2', title: 'Data collection begins', desc: 'WebGrade starts tracking behavioral signals within minutes.' },
              { step: '3', title: 'Insights in 24–48 hours', desc: 'Your dashboard will populate with intent scoring, drop-off analysis, and revenue impact.' },
            ].map(s => (
              <div key={s.step} className="flex gap-3">
                <div className="w-7 h-7 bg-[#0c4a6e] rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-xs font-bold">{s.step}</span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#0c4a6e] mb-0.5">{s.title}</p>
                  <p className="text-xs text-[#64748b] leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
