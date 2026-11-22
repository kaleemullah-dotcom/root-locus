/** Site footer: credits, contact and quality statement. */

export const CONTACT = {
  name: 'Kaleem Ullah',
  cls: 'CE-45 A',
  email: 'kullah.ce45ceme@student.nust.edu.pk',
  github: 'https://github.com/kaleemullah6698',
  linkedin: 'https://www.linkedin.com/in/kaleem-ullah-3b8663299',
} as const;

function Icon({ kind }: { kind: 'github' | 'linkedin' | 'mail' }) {
  const common = { width: 16, height: 16, viewBox: '0 0 24 24', 'aria-hidden': true, className: 'shrink-0' } as const;
  if (kind === 'github')
    return (
      <svg {...common} fill="currentColor">
        <path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.53-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.41-2.69 5.38-5.26 5.67.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z" />
      </svg>
    );
  if (kind === 'linkedin')
    return (
      <svg {...common} fill="currentColor">
        <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.34V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13ZM7.12 20.45H3.56V9h3.56v11.45ZM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0Z" />
      </svg>
    );
  return (
    <svg {...common} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 6-10 7L2 6" />
    </svg>
  );
}

const link =
  'inline-flex items-center gap-2 rounded-md text-blue-100 underline-offset-4 transition-colors hover:text-white hover:underline focus-visible:text-white';

export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="no-print mt-6 bg-gradient-to-br from-[#14264a] via-[#1f3b6e] to-[#1a3260] text-blue-50" aria-labelledby="footer-heading">
      <h2 id="footer-heading" className="sr-only">
        About, credits and contact
      </h2>
      <div className="mx-auto grid max-w-[1880px] gap-8 px-6 py-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1.2fr] lg:px-10">
        <section>
          <div className="flex items-center gap-2.5">
            <Logo size={30} />
            <span className="text-lg font-bold tracking-tight text-white">Root Locus Studio</span>
          </div>
          <p className="mt-3 max-w-md text-[13.5px] leading-relaxed text-blue-100">
            Complete root-locus solutions by the 7-rule method (R1–R7): exact Routh array in K, exact stability ranges and an
            interactive, accurate plot for positive and negative gain.
          </p>
          <p className="mt-4 text-[13.5px]">
            Developed by <span className="font-semibold text-white">{CONTACT.name}</span>{' '}
            <span className="rounded bg-white/10 px-1.5 py-0.5 text-[12px] font-medium text-blue-100">{CONTACT.cls}</span>
          </p>
        </section>

        <section aria-labelledby="footer-credits">
          <h3 id="footer-credits" className="text-[12px] font-semibold uppercase tracking-[0.14em] text-blue-200">
            Acknowledgements
          </h3>
          <dl className="mt-3 space-y-3 text-[13.5px]">
            <div>
              <dt className="text-blue-200">Supervised by</dt>
              <dd className="font-semibold text-white">Prof. Dr. Atif Qayyum</dd>
            </div>
            <div>
              <dt className="text-blue-200">Emotional support by</dt>
              <dd className="font-semibold text-white">Dawood Ali Khan</dd>
            </div>
          </dl>
        </section>

        <section aria-labelledby="footer-contact">
          <h3 id="footer-contact" className="text-[12px] font-semibold uppercase tracking-[0.14em] text-blue-200">
            Contact
          </h3>
          <ul className="mt-3 space-y-2 text-[13.5px]">
            <li>
              <a className={link} href={`mailto:${CONTACT.email}`}>
                <Icon kind="mail" />
                <span className="break-all">{CONTACT.email}</span>
              </a>
            </li>
            <li>
              <a className={link} href={CONTACT.github} target="_blank" rel="noopener noreferrer">
                <Icon kind="github" />
                github.com/kaleemullah6698
              </a>
            </li>
            <li>
              <a className={link} href={CONTACT.linkedin} target="_blank" rel="noopener noreferrer">
                <Icon kind="linkedin" />
                linkedin.com/in/kaleem-ullah-3b8663299
              </a>
            </li>
          </ul>
          <div className="mt-4 rounded-lg border border-white/15 bg-white/5 p-3 text-[13px] leading-relaxed">
            <span className="font-semibold text-white">Collaboration &amp; joint ventures</span>
            <br />
            Open to academic collaboration, research and joint projects — please{' '}
            <a className="font-semibold text-white underline underline-offset-4 hover:text-blue-100" href={`mailto:${CONTACT.email}?subject=Collaboration%20-%20Root%20Locus%20Studio`}>
              get in touch by email
            </a>
            .
          </div>
        </section>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-[1880px] flex-col gap-2 px-6 py-4 text-[12.5px] text-blue-200 md:flex-row md:items-center md:justify-between lg:px-10">
          <p className="leading-relaxed">
            Tested and built following best practices — the maths engine is verified against python-control, with automated unit,
            browser and accessibility checks. Found a bug, error or inconsistency? Please report it on{' '}
            <a className="font-medium text-white underline underline-offset-4" href={CONTACT.github} target="_blank" rel="noopener noreferrer">
              GitHub
            </a>{' '}
            or by{' '}
            <a className="font-medium text-white underline underline-offset-4" href={`mailto:${CONTACT.email}?subject=Bug%20report%20-%20Root%20Locus%20Studio`}>
              email
            </a>
            .
          </p>
          <p className="shrink-0 text-blue-300">© {year} {CONTACT.name}</p>
        </div>
      </div>
    </footer>
  );
}

/** Brand mark shared by header and footer. */
export function Logo({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden className="shrink-0 drop-shadow">
      <defs>
        <linearGradient id="rl-logo-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3b6bc4" />
          <stop offset="1" stopColor="#1a3260" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill="url(#rl-logo-g)" />
      <path d="M8 32h48M32 8v48" stroke="#9fb6dd" strokeWidth="2" />
      <path d="M20 32c4-14 10-20 24-22M20 32c4 14 10 20 24 22" fill="none" stroke="#8cc0ff" strokeWidth="4" strokeLinecap="round" />
      <path d="M15 27l10 10M25 27L15 37" stroke="#ff8787" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}
