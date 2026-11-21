import katex from 'katex';
import { memo, useMemo, type ReactNode } from 'react';

const cache = new Map<string, string>();
function render(tex: string, display: boolean): string {
  const key = (display ? 'D' : 'I') + tex;
  let html = cache.get(key);
  if (html === undefined) {
    html = katex.renderToString(tex, { throwOnError: false, displayMode: display, strict: 'ignore', output: 'html' });
    if (cache.size > 4000) cache.clear();
    cache.set(key, html);
  }
  return html;
}

/** KaTeX formula. `label` is the accessible plain-text reading. */
export const Tex = memo(function Tex({
  tex,
  display = false,
  className,
  label,
}: {
  tex: string;
  display?: boolean;
  className?: string;
  label?: string;
}) {
  const html = useMemo(() => render(tex, display), [tex, display]);
  return (
    <span
      className={className}
      aria-label={label}
      role={label ? 'math' : undefined}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
});

/**
 * Mixed text: `$…$` segments are KaTeX, `**…**` is bold, everything else is plain text.
 */
export const MathText = memo(function MathText({ text, className }: { text: string; className?: string }) {
  const parts = useMemo(() => {
    const out: ReactNode[] = [];
    const re = /\$([^$]+)\$|\*\*([^*]+)\*\*/g;
    let last = 0,
      m: RegExpExecArray | null,
      k = 0;
    while ((m = re.exec(text))) {
      if (m.index > last) out.push(text.slice(last, m.index));
      if (m[1] !== undefined) out.push(<Tex key={k++} tex={m[1]} />);
      else out.push(<strong key={k++}>{renderInline(m[2], k)}</strong>);
      last = re.lastIndex;
    }
    if (last < text.length) out.push(text.slice(last));
    return out;
  }, [text]);
  return <span className={className}>{parts}</span>;
});

function renderInline(s: string, k: number): ReactNode {
  // allow $…$ inside bold
  const segs = s.split(/\$([^$]+)\$/);
  return segs.map((seg, i) => (i % 2 ? <Tex key={`${k}-${i}`} tex={seg} /> : seg));
}

/** Several MathText lines. */
export function Lines({ lines, className }: { lines: string[]; className?: string }) {
  return (
    <div className={className}>
      {lines.map((l, i) => (
        <div key={i} className="py-[1px]">
          <MathText text={l} />
        </div>
      ))}
    </div>
  );
}
