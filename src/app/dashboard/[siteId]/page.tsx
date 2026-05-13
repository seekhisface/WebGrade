// The site root used to render the behavioral intelligence dashboard
// directly. As of the front-door redesign, Overview is the new landing —
// so this route just redirects to it server-side. The old behavioral
// view stays accessible at /dashboard/[siteId]/behavioral so existing
// links don't break and so the deeper drill-in is still one click away
// from the "More" menu.

import { redirect } from 'next/navigation';

export default function SiteRootRedirect({ params }: { params: { siteId: string } }) {
  redirect(`/dashboard/${params.siteId}/overview`);
}
