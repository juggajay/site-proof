import { useEffect, useRef, useState } from 'react';
import { fetchWithTimeout } from '@/lib/fetchWithTimeout';
import { renderChainageTicks } from '@/lib/chainageTicks';
import './landing.css';

/* ============================================================
   CIVOS — early-access landing page.
   A faithful port of docs/design-mockups/landing-early-access-v2.html
   ("Quiet Authority / survey plan at night"). All styling lives in
   landing.css, namespaced under .sp-lp so it never touches the app
   shell. Copy is grounded in dogfooded product truth — no fabricated
   stats, logos or testimonials, by design.
   ============================================================ */

const FORMSPREE_ENDPOINT = 'https://formspree.io/f/mzdqayao';
const FOUNDER_EMAIL = 'jaysonryan21@hotmail.com';

const TEMPLATE_CELLS = [
  { auth: 'AUSTROADS', region: 'National baseline', n: '6' },
  { auth: 'TfNSW', region: 'New South Wales', n: '14' },
  { auth: 'TMR', region: 'Queensland', n: '32' },
  { auth: 'DIT', region: 'South Australia', n: '32' },
  { auth: 'VicRoads', region: 'Victoria', n: '32' },
];

const PROBLEM_ROWS = [
  {
    n: '1.1',
    text: 'ITP sign-offs live in ute consoles, email chains and whoever’s notebook was closest.',
  },
  {
    n: '1.2',
    text: 'Hold points sit in a superintendent’s inbox — nobody on site can see where they’re stuck.',
  },
  {
    n: '1.3',
    text: 'Dockets and the daily diary get reconciled days later, from memory and crumpled carbon copies.',
  },
  {
    n: '1.4',
    text: 'Claims get assembled at month end from whatever can be found — and disputed over whatever can’t.',
  },
];

const FIELD_CARDS = [
  {
    micro: 'Any phone',
    h3: 'Runs in the browser. Nothing to install.',
    p: 'Foremen and subbies work from whatever phone is in their pocket. No app store, no IT rollout, no version mismatch between the shed and the office.',
  },
  {
    micro: 'Patchy signal',
    h3: 'Key field workflows keep working offline.',
    p: 'ITP completions, photos and core diary updates queue locally when coverage drops and sync when it returns. Lot edit conflicts can be resolved when two people touched the same lot.',
  },
  {
    micro: 'Zero friction',
    h3: 'Superintendents never need an account.',
    p: 'Hold point releases run on secure, expiring links. The person you need a signature from doesn’t have to learn your software — they open the link and act on the evidence.',
  },
];

const FAQ_ITEMS = [
  {
    q: 'Q.1',
    summary: 'Is this another do-everything construction management suite?',
    answer: [
      'No — deliberately not. CIVOS is narrower: lots, ITPs, hold points, dockets, diaries, NCRs, test results and progress claims for Australian civil work. If you need scheduling, estimating and accounting in one giant system, that’s not us. If you need the evidence side of your projects under control, it is.',
    ],
  },
  {
    q: 'Q.2',
    summary: 'What does it cost?',
    answer: [
      'There’s no published pricing yet, and we won’t pretend there is. Early crews get in first and help shape it — that’s part of the deal.',
    ],
  },
  {
    q: 'Q.3',
    summary: 'Will our subbies actually use it?',
    answer: [
      'Subbies get their own portal scoped to what’s theirs: dockets, assigned work, the ITPs and hold points that concern them, and documents. They submit dockets from their own phone; your foreman approves, queries or adjusts from theirs. One subbie login works across the projects they’re invited to.',
    ],
  },
  {
    q: 'Q.4',
    summary: 'Can we use our own ITP templates?',
    answer: [
      'Yes. Start from the Austroads and state authority libraries and adapt them per project, or build your own. Templates are editable — they’re a head start, not a cage.',
    ],
  },
  {
    q: 'Q.5',
    summary: 'Does it work where there’s no signal?',
    answer: [
      'The core field workflows keep working offline — ITP completions, photos and selected diary actions. Work queues on the device and syncs when coverage returns, and lot-edit conflicts can be reviewed before sync. Docket submission, admin and reporting need a connection.',
    ],
  },
];

function BrandMark({ bg, stroke }: { bg: string; stroke: string }) {
  return (
    <svg viewBox="0 0 192 192" role="img" aria-hidden="true">
      <rect width="192" height="192" rx="40" fill={bg} />
      <path
        d="M52 118c11 11 24 17 39 17 28 0 49-21 49-49 0-11-3-21-9-30"
        fill="none"
        stroke={stroke}
        strokeWidth="16"
        strokeLinecap="round"
      />
      <path
        d="M55 78c10-13 24-20 41-20 13 0 25 5 34 14"
        fill="none"
        stroke="#d97706"
        strokeWidth="16"
        strokeLinecap="round"
      />
      <path
        d="M67 100l19 19 43-52"
        fill="none"
        stroke={stroke}
        strokeWidth="14"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function LandingPage() {
  const rootRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const chainRef = useRef<HTMLDivElement>(null);
  const pipRef = useRef<HTMLDivElement>(null);
  const chReadRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const [navLite, setNavLite] = useState(false);
  const [released, setReleased] = useState(false);
  const [formStatus, setFormStatus] = useState<'idle' | 'busy' | 'sent' | 'error'>('idle');
  const [okBody, setOkBody] = useState(
    'Thanks — this went straight to the founder’s inbox. You’ll get a personal reply, usually within a day or two.',
  );

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const prevTitle = document.title;
    document.title = 'CIVOS — Every lot. Every ITP. Every docket. Claim-ready or not.';

    const prevScrollBehavior = document.documentElement.style.scrollBehavior;
    if (!prefersReduced) document.documentElement.style.scrollBehavior = 'smooth';

    // The app shell's global CSS sets `body { overflow-x: hidden }`, which (per
    // the CSS overflow spec) forces body's overflow-y to compute to `auto` —
    // making <body> a second scroll container. On this body-scrolled page that
    // breaks mouse-wheel scrolling: the wheel lands on the non-scrolling body
    // and never reaches the html scrollbar (dragging the bar still works, which
    // is the tell). `clip` prevents horizontal overflow WITHOUT creating a
    // scroll container, so the document scrolls by wheel normally. The page
    // wrapper (.sp-lp) already clips its own x-overflow. Restored on unmount.
    const prevBodyOverflowX = document.body.style.overflowX;
    document.body.style.overflowX = 'clip';

    // reveal on scroll (and convergence: the .conv stage shares this .in class)
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in');
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 },
    );
    root.querySelectorAll('.rv').forEach((el) => io.observe(el));

    // readiness board: hold point releases, lot moves on
    let boardTimer: number | undefined;
    let bio: IntersectionObserver | undefined;
    const boardEl = boardRef.current;
    if (boardEl && !prefersReduced) {
      bio = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              boardTimer = window.setTimeout(() => setReleased(true), 2400);
              bio?.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.5 },
      );
      bio.observe(boardEl);
    }

    // chainage ticks along the hero bottom
    if (chainRef.current) renderChainageTicks(chainRef.current);

    // chainage scroll ruler + nav night -> lite past the seam
    const pip = pipRef.current;
    const chRead = chReadRef.current;
    const hero = heroRef.current;
    let rafPending = false;
    let lite = false;
    const onScroll = () => {
      if (rafPending) return;
      rafPending = true;
      requestAnimationFrame(() => {
        rafPending = false;
        const max = document.documentElement.scrollHeight - window.innerHeight;
        const p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
        if (pip) pip.style.top = p * 212 + 'px';
        if (chRead) chRead.textContent = 'CH ' + String(Math.round(p * 2800)).padStart(4, '0');
        if (hero) {
          const past = window.scrollY > hero.offsetHeight - 70;
          if (past !== lite) {
            lite = past;
            setNavLite(past);
          }
        }
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    return () => {
      document.title = prevTitle;
      document.documentElement.style.scrollBehavior = prevScrollBehavior;
      document.body.style.overflowX = prevBodyOverflowX;
      io.disconnect();
      bio?.disconnect();
      if (boardTimer) window.clearTimeout(boardTimer);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  const handleSubmit = async (ev: React.FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    const form = ev.currentTarget;
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    setFormStatus('busy');
    try {
      const res = await fetchWithTimeout(
        FORMSPREE_ENDPOINT,
        {
          method: 'POST',
          body: new FormData(form),
          headers: { Accept: 'application/json' },
        },
        15000,
      );
      if (!res.ok) throw new Error('formspree ' + res.status);
      const first = String(new FormData(form).get('name') || '')
        .trim()
        .split(' ')[0];
      if (first) {
        setOkBody(
          `Thanks ${first} — this went straight to the founder’s inbox. You’ll get a personal reply, usually within a day or two.`,
        );
      }
      setFormStatus('sent');
      requestAnimationFrame(() => {
        formRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      });
    } catch {
      setFormStatus('error');
    }
  };

  return (
    <div className="sp-lp" ref={rootRef}>
      {/* chainage scroll ruler */}
      <div className="ruler" aria-hidden="true">
        <div className="line">
          <div className="pip" ref={pipRef} />
        </div>
        <div className="ch" ref={chReadRef}>
          CH 0000
        </div>
      </div>

      {/* NAV */}
      <div className={'nav-outer' + (navLite ? ' lite' : '')}>
        <div className="wrap nav">
          <a className="brand" href="#top" aria-label="CIVOS home">
            <BrandMark
              bg={navLite ? '#1b1714' : '#f3efe8'}
              stroke={navLite ? '#ffffff' : '#14100d'}
            />
            CIVOS
          </a>
          <a className="lnk" href="#problem">
            The problem
          </a>
          <a className="lnk" href="#how">
            How it works
          </a>
          <a className="lnk" href="#templates">
            Templates
          </a>
          <a className="lnk" href="#faq">
            FAQ
          </a>
          <a className={'btn' + (navLite ? ' primary' : ' night')} href="#early-access">
            Request early access
          </a>
        </div>
      </div>

      {/* HERO */}
      <header className="hero" id="top" ref={heroRef}>
        <div className="grain" />
        <div className="wrap">
          <span className="kicker">
            <span className="d" />
            <span className="micro">Early access — Australian civil contractors</span>
          </span>

          <h1
            className="stack"
            aria-label="Every lot. Every ITP. Every docket. One answer: claim-ready or not."
          >
            <span className="frag">
              Every lot.<span className="idx">LOT-012 · CH 2400–2600</span>
            </span>
            <span className="frag">
              Every ITP.<span className="idx">ITP-E2 · item 14 of 22</span>
            </span>
            <span className="frag">
              Every docket.<span className="idx">DKT-341 · 6 men · 2 plant</span>
            </span>
          </h1>

          <div className="answer">
            <span className="lead">One answer:</span>
            <span className="stamp yes s1">
              <span className="d" />
              Claim-ready
            </span>
            <span className="or">or</span>
            <span className="stamp no s2">
              <span className="d" />
              Not yet — here&rsquo;s why
            </span>
          </div>

          <p className="hero-sub">
            CIVOS pulls <strong>ITPs, hold points, tests, dockets and photos</strong> onto the lot,
            so Australian civil teams can claim on evidence instead of optimism.
          </p>

          <div className="hero-ctas">
            <a className="btn night lg" href="#early-access">
              Request early access<span className="ar">→</span>
            </a>
            <a className="btn ghost-night lg" href="#how">
              See how it works
            </a>
          </div>
          <p className="hero-note">
            No pricing published yet — the first crews on board help set it. No credit card, no
            sales pitch.
          </p>

          <div className="chainage" ref={chainRef} aria-hidden="true" />
        </div>
      </header>

      {/* BOARD ON THE SEAM */}
      <div className="board-dock">
        <div className="wrap board-wrap">
          <div className="board-side">
            <span className="micro" style={{ color: 'var(--accent)' }}>
              The spine of the product
            </span>
            <h2>Evidence readiness, lot by lot</h2>
            <p>
              Each lot pulls its ITP completions, hold points, test results, dockets and photos into
              one answer. What&rsquo;s missing is named — while there&rsquo;s still time to fix it.
            </p>
          </div>
          <div className="board-holder">
            <div
              className="board"
              ref={boardRef}
              aria-label="Evidence readiness board — illustrative sample data"
            >
              <div className="board-h">
                <span className="t">Evidence readiness</span>
                <span className="claim mono micro">Claim 04 · period ending 30 Jun</span>
                <span className="live">
                  <span className="d" />
                  Live
                </span>
              </div>
              <div className="lot">
                <div className="lot-r">
                  <span className="code">LOT-012</span>
                  <span className="desc">Bulk earthworks CH 2400–2600</span>
                  <span className="st ready">
                    <span className="d" />
                    Claim ready
                  </span>
                </div>
              </div>
              <div className="lot">
                <div className="lot-r">
                  <span className="code">LOT-014</span>
                  <span className="desc">Subgrade preparation CH 2600–2800</span>
                  <span className="st ready">
                    <span className="d" />
                    Claim ready
                  </span>
                </div>
              </div>
              <div className="lot">
                <div className="lot-r">
                  <span className="code">LOT-015</span>
                  <span className="desc">Select fill &amp; box-out CH 2800–3000</span>
                  <span className="st block">
                    <span className="d" />
                    <span>{released ? '1 blocker' : '2 blockers'}</span>
                  </span>
                </div>
                <div className="blockers">
                  <div className={'bk' + (released ? ' done' : '')}>
                    <span className="ic">{released ? '✓ HP-07' : 'HP-07'}</span>
                    <span>
                      {released
                        ? 'Subgrade inspection — released by superintendent via secure link'
                        : 'Subgrade inspection — awaiting superintendent release'}
                    </span>
                    <span className="when">{released ? 'just now' : 'sent 9:02 am'}</span>
                  </div>
                  <div className="bk">
                    <span className="ic">TEST</span>
                    <span>Compaction test CH 2850 — result not yet recorded</span>
                    <span className="when">due today</span>
                  </div>
                </div>
              </div>
              <div className="lot">
                <div className="lot-r">
                  <span className="code">LOT-018</span>
                  <span className="desc">Stormwater RCP Ø600 — install &amp; backfill</span>
                  <span className="st block">
                    <span className="d" />1 blocker
                  </span>
                </div>
                <div className="blockers">
                  <div className="bk">
                    <span className="ic">DKT</span>
                    <span>Docket #341 — pending foreman approval</span>
                    <span className="when">today</span>
                  </div>
                </div>
              </div>
              <div className="lot">
                <div className="lot-r">
                  <span className="code">LOT-019</span>
                  <span className="desc">Kerb &amp; channel CH 2400–2700</span>
                  <span className="st prog">
                    <span className="d" />
                    In progress
                  </span>
                </div>
              </div>
              <div className="board-f">
                <b>2</b>&nbsp;of 5 lots claim-ready&nbsp;·&nbsp;<b>{released ? '2' : '3'}</b>
                &nbsp;open blockers
              </div>
            </div>
            <div className="board-cap micro">
              Illustrative data — this is the product&rsquo;s evidence readiness view
            </div>
          </div>
        </div>
      </div>

      {/* TICKER */}
      <div className="ticker-outer" aria-hidden="true">
        <div className="ticker">
          <span>ITP template libraries —</span>
          <span>
            <b>Austroads</b> national baseline
          </span>
          <span>·</span>
          <span>
            <b>TfNSW</b> New South Wales
          </span>
          <span>·</span>
          <span>
            <b>TMR</b> Queensland
          </span>
          <span>·</span>
          <span>
            <b>DIT</b> South Australia
          </span>
          <span>·</span>
          <span>
            <b>VicRoads</b> Victoria
          </span>
          <span>·</span>
          <span>116 ITP templates · 3,070 checklist points · adapted per project</span>
          <span>·</span>
        </div>
      </div>

      {/* PROBLEM */}
      <section id="problem">
        <div className="wrap">
          <div className="sec-head rv">
            <span className="ghost" aria-hidden="true">
              01
            </span>
            <span className="num">01</span>
            <h2>
              The evidence exists.
              <br />
              It&rsquo;s just everywhere.
            </h2>
          </div>
          <p className="sec-lead rv">
            Civil teams don&rsquo;t lose claim arguments because the work wasn&rsquo;t done. They
            lose because the proof is scattered across utes, inboxes and site sheds when someone
            finally asks for it.
          </p>
          <div className="prob-grid">
            <div className="plist rv">
              {PROBLEM_ROWS.map((row) => (
                <div className="prow" key={row.n}>
                  <span className="n">{row.n}</span>
                  <p>{row.text}</p>
                </div>
              ))}
            </div>
            <div className="conv rv" aria-label="Scattered evidence converging onto one lot record">
              <div className="lot-head">
                LOT-015{' '}
                <span className="st">
                  <span className="d" />
                  Evidence complete
                </span>
              </div>
              <div className="scrap">
                <span className="tag">ITP</span>Sign-off — select fill, item 14 of 22
              </div>
              <div className="scrap">
                <span className="tag">HP</span>HP-07 release — superintendent, 2:14 pm
              </div>
              <div className="scrap">
                <span className="tag">TEST</span>Compaction result — CH 2850
              </div>
              <div className="scrap">
                <span className="tag">DKT</span>Docket #341 — approved, 6 men · 2 plant
              </div>
              <div className="scrap">
                <span className="tag">PHOTO</span>Box-out, north face — geotagged
              </div>
              <div className="cap micro">Every record lands on the lot</div>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how">
        <div className="wrap">
          <div className="sec-head rv">
            <span className="ghost" aria-hidden="true">
              02
            </span>
            <span className="num">02</span>
            <h2>Three loops. One spine.</h2>
          </div>
          <p className="sec-lead rv">
            Compliance, daily operations and the commercial cycle each feed evidence onto the lot.
            Readiness is just the truth of what&rsquo;s landed.
          </p>

          <div className="flows">
            <div className="flow rv">
              <div className="flow-copy">
                <span className="micro">Compliance</span>
                <h3>ITPs and hold points, lot by lot</h3>
                <p>
                  Build lots against ITP templates, capture inspection evidence in the field, and
                  run hold points with a full trail.
                </p>
                <p>
                  When a hold point needs release, CIVOS emails the superintendent a secure 48-hour
                  link. They review the evidence in the page and release —{' '}
                  <strong>no login, no PDF attachments, no chasing</strong>.
                </p>
              </div>
              <div className="flow-viz">
                <div className="chipline">
                  <span className="chip">ITP item signed</span>
                  <span className="arr">→</span>
                  <span className="chip">evidence attached</span>
                  <span className="arr">→</span>
                  <span className="chip hot">hold point</span>
                </div>
                <div className="chipline">
                  <span className="chip">secure link → superintendent</span>
                  <span className="arr">→</span>
                  <span className="chip ok">released</span>
                </div>
                <p className="viz-note">The superintendent never needs an account.</p>
              </div>
            </div>

            <div className="flow rv">
              <div className="flow-copy">
                <span className="micro">Daily operations</span>
                <h3>Dockets your foreman actually approves</h3>
                <p>
                  Subbies submit labour and plant dockets from their own portal; foremen approve,
                  query, reject or adjust them before the hours flow into the project diary and
                  commercial record.
                </p>
                <p>
                  Approved labour and plant land in the daily diary automatically — weather, delays
                  and site notes stay in your foreman&rsquo;s hands.
                </p>
              </div>
              <div className="flow-viz">
                <div className="chipline">
                  <span className="chip">subbie submits</span>
                  <span className="arr">→</span>
                  <span className="chip hot">foreman approves · queries · adjusts</span>
                </div>
                <div className="chipline">
                  <span className="chip ok">diary auto-fills labour + plant</span>
                  <span className="arr">→</span>
                  <span className="chip">commercial record</span>
                </div>
                <p className="viz-note">Every adjustment carries a recorded reason.</p>
              </div>
            </div>

            <div className="flow rv">
              <div className="flow-copy">
                <span className="micro">Commercial</span>
                <h3>Claims built on evidence, not optimism</h3>
                <p>
                  Run the claim cycle with per-lot evidence readiness in view the whole way. Before
                  you claim a lot, you can see whether its ITPs, hold points, tests and dockets
                  actually back it up.
                </p>
                <p>
                  What&rsquo;s missing shows up as a named blocker weeks before claim day — not as a
                  dispute after it.
                </p>
              </div>
              <div className="flow-viz">
                <div className="chipline">
                  <span className="chip">draft</span>
                  <span className="arr">→</span>
                  <span className="chip">submitted</span>
                  <span className="arr">→</span>
                  <span className="chip">certified</span>
                  <span className="arr">→</span>
                  <span className="chip ok">paid</span>
                </div>
                <div className="chipline">
                  <span className="chip hot">blockers visible per lot, per claim line</span>
                </div>
                <p className="viz-note">
                  Readiness pulls from ITPs, hold points, tests, dockets and photos.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* TEMPLATES */}
      <section id="templates">
        <div className="wrap">
          <div className="sec-head rv">
            <span className="ghost" aria-hidden="true">
              03
            </span>
            <span className="num">03</span>
            <h2>Start from the specs you already work to.</h2>
          </div>
          <p className="sec-lead rv">
            ITP template libraries built from Austroads and state authority specifications — seeded
            into your project, then yours to adapt. Not a blank form builder.
          </p>
          <div className="tgrid rv">
            {TEMPLATE_CELLS.map((cell) => (
              <div className="tcell" key={cell.auth}>
                <div className="auth">{cell.auth}</div>
                <div className="st8">{cell.region}</div>
                <div className="n">{cell.n}</div>
                <div className="lbl">ITP templates</div>
              </div>
            ))}
          </div>
          <p className="tfoot rv">
            <span className="mono" style={{ color: 'var(--ink)', fontWeight: 600 }}>
              116 templates · 3,070 checklist points · 813 hold points
            </span>{' '}
            across earthworks, pavements, asphalt, drainage, structures, road furniture and
            environmental work. Templates reference the relevant Australian Standards inside the
            checklist content — they&rsquo;re starting points to review against your project
            specification, not a compliance guarantee.
          </p>
        </div>
      </section>

      {/* FIELD-FIRST */}
      <section id="field">
        <div className="wrap">
          <div className="sec-head rv">
            <span className="ghost" aria-hidden="true">
              04
            </span>
            <span className="num">04</span>
            <h2>Built for the ute, not the office.</h2>
          </div>
          <div className="fgrid">
            {FIELD_CARDS.map((card) => (
              <div className="fcard rv" key={card.micro}>
                <span className="micro">{card.micro}</span>
                <h3>{card.h3}</h3>
                <p>{card.p}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* EARLY ACCESS */}
      <div className="ea-outer" id="early-access">
        <div className="grain" />
        <div className="wrap ea-inner">
          <div className="ea-head rv">
            <span className="num">05</span>
            <h2>No logos. No invented stats. Just the product.</h2>
          </div>
          <div className="ea">
            <div className="ea-copy rv">
              <span className="micro">Why there&rsquo;s no proof wall on this page</span>
              <h3>You&rsquo;d be among the first crews. We&rsquo;re not pretending otherwise.</h3>
              <p>
                Most software pages this early are padded with stock photos of hard hats and
                statistics nobody can source. We&rsquo;d rather show you the real product and earn
                the case studies.
              </p>
              <p>
                CIVOS is <b>founder-built out of the paperwork pain of running real crews</b> —
                built in Australia, for Australian civil work, dogfooded on the workflows on this
                page.
              </p>
              <ul className="ea-list">
                <li>
                  <span className="tick">01</span>A working product — the docket, hold point, diary
                  and claim flows above are built and in daily use, not a roadmap.
                </li>
                <li>
                  <span className="tick">02</span>A direct line to the founder. What&rsquo;s missing
                  for your crew gets built or answered fast.
                </li>
                <li>
                  <span className="tick">03</span>A say in pricing before it exists. Early crews
                  help set it — you won&rsquo;t be surprised by it.
                </li>
              </ul>
              <p className="ea-sign">— Jayson, founder · CIVOS</p>
            </div>

            <form
              className={'ea-form rv' + (formStatus === 'sent' ? ' sent' : '')}
              ref={formRef}
              action={FORMSPREE_ENDPOINT}
              method="POST"
              noValidate
              onSubmit={handleSubmit}
            >
              <h3>Request early access</h3>
              <p className="fs">
                Tell us where it hurts. Takes 30 seconds — and a real person replies, not a
                sequence.
              </p>
              <input type="hidden" name="_subject" value="CIVOS early access — new request" />
              <input
                type="text"
                name="_gotcha"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  left: '-9999px',
                  width: '1px',
                  height: '1px',
                  opacity: 0,
                }}
              />
              <div className="frow">
                <label htmlFor="f-name">Name</label>
                <input id="f-name" name="name" type="text" autoComplete="name" required />
              </div>
              <div className="frow">
                <label htmlFor="f-email">Work email</label>
                <input id="f-email" name="email" type="email" autoComplete="email" required />
              </div>
              <div className="frow">
                <label htmlFor="f-company">Company</label>
                <input
                  id="f-company"
                  name="company"
                  type="text"
                  autoComplete="organization"
                  required
                />
              </div>
              <div className="frow">
                <label htmlFor="f-state">State</label>
                <select id="f-state" name="state" defaultValue="" required>
                  <option value="" disabled>
                    Select…
                  </option>
                  <option>NSW</option>
                  <option>QLD</option>
                  <option>SA</option>
                  <option>VIC</option>
                  <option>WA</option>
                  <option>TAS</option>
                  <option>NT</option>
                  <option>ACT</option>
                </select>
              </div>
              <div className="frow">
                <label htmlFor="f-pain">What hurts most right now?</label>
                <select id="f-pain" name="pain" defaultValue="" required>
                  <option value="" disabled>
                    Select…
                  </option>
                  <option>ITPs &amp; hold points</option>
                  <option>Dockets &amp; daily diary</option>
                  <option>Progress claims &amp; evidence</option>
                  <option>NCRs &amp; test results</option>
                  <option>All of it</option>
                </select>
              </div>
              <button
                className="btn primary lg"
                type="submit"
                id="ea-submit"
                aria-busy={formStatus === 'busy'}
              >
                Request early access<span className="ar">→</span>
              </button>
              <div
                className={'form-ok' + (formStatus === 'sent' ? ' show' : '')}
                role="status"
                aria-live="polite"
              >
                <div className="ok-ring" aria-hidden="true">
                  ✓
                </div>
                <h4>Request received</h4>
                <p>{okBody}</p>
              </div>
              <div className={'form-err' + (formStatus === 'error' ? ' show' : '')}>
                Something went wrong sending that. Email{' '}
                <a href={`mailto:${FOUNDER_EMAIL}`}>{FOUNDER_EMAIL}</a> directly and we&rsquo;ll
                sort it.
              </div>
              <p className="form-fine">
                We&rsquo;ll only use this to contact you about CIVOS early access. No mailing-list
                spam.
              </p>
            </form>
          </div>
        </div>
      </div>

      {/* FAQ */}
      <section id="faq">
        <div className="wrap">
          <div className="sec-head rv">
            <span className="ghost" aria-hidden="true">
              06
            </span>
            <span className="num">06</span>
            <h2>Fair questions.</h2>
          </div>
          <div className="faq rv">
            {FAQ_ITEMS.map((item) => (
              <details key={item.q}>
                <summary>
                  <span className="q">{item.q}</span>
                  {item.summary}
                </summary>
                <div className="a">
                  {item.answer.map((para, i) => (
                    <p key={i}>{para}</p>
                  ))}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer>
        <div className="wrap foot">
          <span className="brand">
            <BrandMark bg="#1b1714" stroke="#ffffff" />
            CIVOS
          </span>
          <a href="#problem">The problem</a>
          <a href="#how">How it works</a>
          <a href="#templates">Templates</a>
          <a href="#early-access">Early access</a>
          <div className="fine">
            <span>© 2026 CIVOS · Built in Australia for civil crews · Evidence, lot by lot.</span>
            <span className="mono">CH 2800 — END OF JOB</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default LandingPage;
