/** Site footer: credits, contact, collaboration and quality statement. Also exports the brand logo. */

export const CONTACT = {
  name: 'Kaleem Ullah',
  cls: 'CE-45 A',
  email: 'kullah.ce45ceme@student.nust.edu.pk',
  github: 'https://github.com/kaleemullah6698',
  linkedin: 'https://www.linkedin.com/in/kaleem-ullah-3b8663299',
} as const;

/**
 * Brand mark: a light tile (contrasts with the navy header/footer) showing an s-plane with
 * dark-green root-locus branches leaving a red pole and a navy zero.
 */
export function Logo({ size = 40, id = 'rl' }: { size?: number; id?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden className="shrink-0">
      <defs>
        <linearGradient id={`${id}-tile`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#e7edf7" />
        </linearGradient>
        <linearGradient id={`${id}-locus`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2f9e44" />
          <stop offset="1" stopColor="#14532d" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="62" height="62" rx="15" fill={`url(#${id}-tile)`} stroke="#ffffff" strokeOpacity="0.6" />
      <path d="M10 34h44M38 10v44" stroke="#9aa9c4" strokeWidth="1.6" strokeLinecap="round" />
      <path
        d="M24 34c3-11 8.5-17.5 20-20.5M24 34c3 11 8.5 17.5 20 20.5"
        fill="none"
        stroke={`url(#${id}-locus)`}
        strokeWidth="4.2"
        strokeLinecap="round"
      />
      <path d="M9.5 34H24" stroke={`url(#${id}-locus)`} strokeWidth="4.2" strokeLinecap="round" />
      <path d="M19.5 29.5l9 9M28.5 29.5l-9 9" stroke="#c92a2a" strokeWidth="3.2" strokeLinecap="round" />
      <circle cx="47" cy="34" r="3.6" fill="#fff" stroke="#1f3b6e" strokeWidth="2.4" />
    </svg>
  );
}

function Icon({ kind }: { kind: 'github' | 'linkedin' | 'mail' | 'check' | 'handshake' }) {
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
  if (kind === 'check')
    return (
      <svg {...common} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5l-8-3Z" />
        <path d="m8.5 12 2.5 2.5 4.5-5" />
      </svg>
    );
  if (kind === 'handshake')
    return (
      <svg width={22} height={22} viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="m11 17 2 2a1 1 0 1 0 3-3" />
        <path d="m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4" />
        <path d="m21 3 1 11h-2" />
        <path d="M3 3 2 14l6.5 6.5a1 1 0 1 0 3-3" />
        <path d="M3 4h8" />
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
  'inline-flex items-center gap-2.5 text-slate-300 underline-offset-4 transition-colors hover:text-white hover:underline focus-visible:text-white';
const heading = 'text-[12px] font-semibold uppercase tracking-[0.16em] text-emerald-300/90';

export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="no-print mt-8 border-t-[3px] border-[#1b7a43] bg-[#0a1730] text-slate-200" aria-labelledby="footer-heading">
      <h2 id="footer-heading" className="sr-only">
        About, credits and contact
      </h2>
      <div className="mx-auto grid max-w-[1880px] gap-10 px-6 pb-10 pt-12 md:grid-cols-2 lg:grid-cols-[1.35fr_0.9fr_1.25fr] lg:px-12">
        {/* brand + quality */}
        <section>
          <div className="flex items-center gap-3.5">
            <Logo size={58} id="rl-foot" />
            <div>
              <div className="text-[22px] font-bold tracking-tight text-white">Root Locus Studio</div>
              <div className="mt-0.5 text-[13px] text-slate-300">
                Developed by <span className="font-semibold text-white">{CONTACT.name}</span>
                <span className="ml-1.5 rounded border border-white/15 px-1.5 py-px text-[11.5px] text-slate-200">{CONTACT.cls}</span>
              </div>
            </div>
          </div>
          <p className="mt-5 max-w-md text-[13.5px] leading-relaxed text-slate-300">
            Complete root-locus solutions by the 7-rule method (R1–R7): exact Routh array in K, exact stability ranges and an
            interactive plot for positive and negative gain.
          </p>
          <div className="mt-5 flex max-w-md gap-3 rounded-xl border border-emerald-400/25 bg-emerald-400/[0.06] p-3.5 text-[13px] leading-relaxed text-slate-200">
            <span className="mt-0.5 text-emerald-300">
              <Icon kind="check" />
            </span>
            <p>
              <span className="font-semibold text-white">Tested and built following best practices.</span> The maths engine is verified
              against python-control, with automated unit, browser and accessibility checks. Found a bug, error or inconsistency?
              Please report it on{' '}
              <a className="font-medium text-white underline underline-offset-4 hover:text-emerald-200" href={CONTACT.github} target="_blank" rel="noopener noreferrer">
                GitHub
              </a>{' '}
              or by{' '}
              <a className="font-medium text-white underline underline-offset-4 hover:text-emerald-200" href={`mailto:${CONTACT.email}?subject=Bug%20report%20-%20Root%20Locus%20Studio`}>
                email
              </a>
              .
            </p>
          </div>
        </section>

        {/* acknowledgements */}
        <section aria-labelledby="footer-credits">
          <h3 id="footer-credits" className={heading}>
            Acknowledgements
          </h3>
          <dl className="mt-4 space-y-4 text-[14px]">
            <div className="border-l-2 border-emerald-500/70 pl-3">
              <dt className="text-[12.5px] text-slate-400">Supervised by</dt>
              <dd className="font-semibold text-white">Lt. Col. Dr. Atif Qayyum</dd>
            </div>
            <div className="border-l-2 border-emerald-500/70 pl-3">
              <dt className="text-[12.5px] text-slate-400">Emotional support by</dt>
              <dd className="font-semibold text-white">Dawood Ali Khan</dd>
            </div>
          </dl>
        </section>

        {/* contact + collaboration */}
        <section aria-labelledby="footer-contact">
          <h3 id="footer-contact" className={heading}>
            Contact
          </h3>
          <ul className="mt-4 space-y-2.5 text-[13.5px]">
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

          <div className="relative mt-6 overflow-hidden rounded-2xl border border-white/15 bg-gradient-to-br from-white/[0.10] to-white/[0.03] p-5 shadow-[0_8px_30px_rgba(0,0,0,0.35)] ring-1 ring-inset ring-white/5 backdrop-blur-md">
            <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-emerald-500/20 blur-2xl" />
            <div className="relative flex items-start gap-3.5">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-emerald-500 to-green-800 text-white shadow-lg">
                <Icon kind="handshake" />
              </span>
              <div>
                <div className="text-[15px] font-semibold text-white">Collaboration &amp; Joint Ventures</div>
                <p className="mt-1 text-[13px] leading-relaxed text-slate-300">
                  Open to academic collaboration, research partnerships and joint projects in control systems and engineering software.
                </p>
                <a
                  href={`mailto:${CONTACT.email}?subject=Collaboration%20-%20Root%20Locus%20Studio`}
                  className="mt-3 inline-flex items-center gap-2 rounded-lg bg-white px-3.5 py-2 text-[13px] font-semibold text-[#0a1730] shadow transition hover:bg-emerald-50"
                >
                  <Icon kind="mail" />
                  Get in touch
                </a>
              </div>
            </div>
          </div>
        </section>
      </div>

      <div className="border-t border-white/10">
        <p className="mx-auto max-w-[1880px] px-6 py-4 text-center text-[12.5px] text-slate-400 lg:px-12">
          © {year} {CONTACT.name}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
