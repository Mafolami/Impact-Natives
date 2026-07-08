// src/pages/HomePage.tsx
import { useState, useEffect, useRef } from 'react'
import { Link } from 'wouter'
import { Swiper, SwiperSlide } from 'swiper/react'
import { Navigation } from 'swiper/modules'
import 'swiper/css'
import {
  Network, ArrowRight, FlaskConical, Handshake,
  ChevronDown, ArrowLeft, Zap,
} from 'lucide-react'
import { NewsletterSignup } from '@/components/platform/NewsletterSignup'

/* ── THEME HOOK ────────────────────────────────────────── */
function useIsDark() {
  const [isDark, setIsDark] = useState(document.documentElement.classList.contains('dark'))
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'))
    })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])
  return isDark
}

/* ── DATA ──────────────────────────────────────────────── */
const FAQS = [
  {
    q: 'What is Natives?',
    a: "Natives is a coordination platform for Africa's impact ecosystem. It connects verified organisations, funders, and implementers so they can find each other, work together, and move resources more effectively.",
  },
  {
    q: 'Who can join Natives?',
    a: "Natives is open to NGOs, corporates, donors, DFIs, government agencies, founders, and ecosystem experts working in or with Africa's development and impact sectors.",
  },
  {
    q: 'What does verification mean on Natives?',
    a: 'Verified organisations have passed a structured review covering legal registration, programme delivery capacity, and financial credibility where applicable. Verification signals institutional trust to potential partners and funders.',
  },
  {
    q: 'What is an Innovation Lab?',
    a: 'An Innovation Lab is a structured, time-bound process where Natives convenes stakeholders around a specific systemic challenge. It is a managed service, not a self-service product.',
  },
  {
    q: 'How is Find Partnership different from Partner With Natives?',
    a: 'Find Partnership is about connecting with other ecosystem actors through the Natives network. Partner With Natives is about working directly with Impact Natives as an institution on strategic collaboration, research, or platform integration.',
  },
]

const ROLES = [
  {
    role: 'NGO / Non-Profit',
    intent: 'Get found by the funders and partners already looking for you.',
    desc: "Your delivery capacity exists. Your credibility exists. The gap is visibility. Natives gives you a verified profile in a structured ecosystem so the right funders, corporates, and implementers can find you without warm intros.",
    bg: 'linear-gradient(135deg, #071a10 0%, #0d2d1a 100%)',
    bgLight: 'linear-gradient(135deg, #eaf7f0 0%, #f2faf6 100%)',
    accent: '#2db87a',
    index: '01',
    href: '/solutions/ngos',
    image: '/ngos.png',
  },
  {
    role: 'Corporation',
    intent: 'Turn ESG and CSR commitments into verified delivery.',
    desc: "Finding credible, verified implementation partners shouldn't take months of manual due diligence. Natives gives you a searchable directory of verified NGOs and social enterprises.",
    bg: 'linear-gradient(135deg, #0d0c1c 0%, #16143a 100%)',
    bgLight: 'linear-gradient(135deg, #efedf9 0%, #f4f3fd 100%)',
    accent: '#7b6dd4',
    index: '02',
    href: '/solutions/corporates',
    image: '/corporates.png',
  },
  {
    role: 'Funder / Donor',
    intent: 'Find credible pipeline. Deploy capital with confidence.',
    desc: "Capital is available. The bottleneck is finding verified, credible organisations to deploy it through. Natives gives you structured access to a verified ecosystem, reducing discovery time and due diligence burden before the first conversation.",
    bg: 'linear-gradient(135deg, #071218 0%, #0d2130 100%)',
    bgLight: 'linear-gradient(135deg, #eaf4f9 0%, #f2f8fc 100%)',
    accent: '#2d9dd4',
    index: '03',
    href: '/solutions/donors',
    image: '/dfi.png',
  },
  {
    role: 'Startup / Social Enterprise',
    intent: 'From validated model to institutional partner.',
    desc: "You have a thesis and early evidence. What you need is the connective tissue: NGO co-development partners, corporate co-funders, and a structured pathway to capital. Natives gives you access to all three.",
    bg: 'linear-gradient(135deg, #12100a 0%, #26220d 100%)',
    bgLight: 'linear-gradient(135deg, #fdf6e3 0%, #fdf9ee 100%)',
    accent: '#d4a82d',
    index: '04',
    href: '/solutions/startups',
    image: '/founder.png',
  },
  {
    role: 'Individual / Creative',
    intent: 'Your expertise belongs in the ecosystem.',
    desc: "You don't need an organisation to participate. As a consultant, researcher, creative, or advocate, you can build a profile, post initiatives, and connect with the organisations and funders already looking for what you bring.",
    bg: 'linear-gradient(135deg, #1c0e0e 0%, #2d1a0d 100%)',
    bgLight: 'linear-gradient(135deg, #fdf0e8 0%, #fdf5ef 100%)',
    accent: '#c45c26',
    index: '05',
    href: '/solutions/individuals',
    image: '/founder.png',
  },
  {
    role: 'Research Institution',
    intent: 'Bridge your evidence to practice, policy, and action.',
    desc: "Findings without implementation pathways don't move systems. Natives connects research institutions to the NGOs, corporates, and funders who can translate evidence into programme design, policy advocacy, and on-the-ground delivery.",
    bg: 'linear-gradient(135deg, #0a0d18 0%, #121a2d 100%)',
    bgLight: 'linear-gradient(135deg, #eaeff9 0%, #f2f5fd 100%)',
    accent: '#4d8dd4',
    index: '06',
    href: '/solutions/research',
    image: '/founder.png',
  },
]

const STATS = [
  { value: '92%', label: 'Reputation drives partnerships', sub: 'Top reason corporates partner with NGOs', bridge: 'On Natives, your credibility is verified, visible, and travels with you.', src: 'Cause & Effect 2025', color: '#2db87a' },
  { value: '88%', label: 'Funding is the top motivator', sub: 'Top motivator for nonprofits to partner', bridge: 'Post your initiative on the marketplace. The right people find you.', src: 'Cause & Effect 2025', color: '#2d7ad4' },
  { value: '97%', label: 'Partnerships deepen understanding', sub: 'Partnerships improve societal issue knowledge', bridge: 'Every collaboration on Natives leaves a record the next team can build on.', src: 'Cause & Effect 2025', color: '#a84dd4' },
  { value: '91%', label: 'Mission alignment is non-negotiable', sub: 'Top factor in partner selection', bridge: 'Know if a partner shares your mission before you send the first message.', src: 'For Momentum 2025', color: '#c45c26' },
]

const FEATURES = [
  {
    num: '01', title: 'Find the right partners', sub: 'You know what you need. We help you find who.',
    desc: 'Browse and filter verified organisations by sector, country, and focus area. Send an expression of interest directly. No cold outreach, no guessing, no multi-month email chains.',
    image: '/find-partners.png',
    Illustration: IllustrationPartner,
    tint: 'rgba(45,184,122,0.05)', borderTint: 'rgba(45,184,122,0.12)',
    tintLight: 'rgba(45,184,122,0.07)', borderTintLight: 'rgba(45,184,122,0.25)',
    illustrationColor: '#2db87a',
    flip: false,
  },
  {
    num: '02', title: 'Post and discover initiatives', sub: 'Put your work in front of the right people.',
    desc: 'Create an initiative on the marketplace and let funders, implementers, and partners find you. Or browse what others are building and express interest in seconds.',
    image: '/create-initiative.png',
    Illustration: IllustrationMarketplace,
    tint: 'rgba(45,122,212,0.05)', borderTint: 'rgba(45,122,212,0.12)',
    tintLight: 'rgba(45,122,212,0.07)', borderTintLight: 'rgba(45,122,212,0.25)',
    illustrationColor: '#2d7ad4',
    flip: true,
  },
  {
    num: '03', title: 'Build verified trust', sub: "Know who you're working with before you commit.",
    desc: 'Verified organisation badges are earned through document review. Every profile is structured so you can assess fit before the first conversation, removing ambiguity at the top of the funnel.',
    image: '/build-trust.png',
    Illustration: IllustrationVerification,
    tint: 'rgba(196,92,38,0.05)', borderTint: 'rgba(196,92,38,0.12)',
    tintLight: 'rgba(196,92,38,0.07)', borderTintLight: 'rgba(196,92,38,0.25)',
    illustrationColor: '#c45c26',
    flip: false,
  },
  {
    num: '04', title: 'Commission an Innovation Lab', sub: "There's a challenge you want solved. We'll convene the room.",
    desc: "Natives Labs bring together the right mix of organisations, expertise, and resources around a specific systemic challenge. You define the problem. We structure the process and manage delivery.",
    image: '/commission-lab.png',
    Illustration: IllustrationLab,
    tint: 'rgba(168,77,212,0.05)', borderTint: 'rgba(168,77,212,0.12)',
    tintLight: 'rgba(168,77,212,0.07)', borderTintLight: 'rgba(168,77,212,0.25)',
    illustrationColor: '#a84dd4',
    flip: true,
  },
]

/* ── HOOKS ─────────────────────────────────────────────── */
function useCountUp(target: number, isVisible: boolean, duration = 1500) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!isVisible) return
    let start: number | null = null
    const step = (ts: number) => {
      if (!start) start = ts
      const p = Math.min((ts - start) / duration, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      setCount(Math.floor(eased * target))
      if (p < 1) requestAnimationFrame(step)
      else setCount(target)
    }
    const raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [isVisible, target, duration])
  return count
}

/* ── IMAGE WITH FALLBACK ────────────────────────────────── */
function ImgFallback({
  src, alt, className, style,
  FallbackIcon,
}: {
  src: string; alt: string; className?: string; style?: React.CSSProperties;
  FallbackIcon?: React.ComponentType<React.SVGProps<SVGSVGElement>>
}) {
  const isDark = useIsDark()
  const [err, setErr] = useState(false)
  if (err) {
    return (
      <div style={{ ...style, display: 'flex', alignItems: 'center', justifyContent: 'center', background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)', border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}` }}>
        {FallbackIcon && <FallbackIcon style={{ width: '3rem', height: '3rem', opacity: 0.15, color: isDark ? '#f7f3ed' : '#14110d' }} />}
      </div>
    )
  }
  return <img src={src} alt={alt} className={className} style={style} onError={() => setErr(true)} />
}

/* ── STAT CELL ─────────────────────────────────────────── */
function StatCell({ stat, i, isVisible }: { stat: typeof STATS[0]; i: number; isVisible: boolean }) {
  const numeric = parseInt(stat.value.replace(/\D/g, ''), 10)
  const suffix = stat.value.replace(/[0-9]/g, '')
  const count = useCountUp(numeric, isVisible)
  const isDark = useIsDark()
  return (
    <div style={{
      padding: 'clamp(1.5rem, 3vw, 2.5rem) clamp(1rem, 2vw, 2rem)',
      textAlign: 'center',
      borderRight: i < STATS.length - 1 ? `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` : 'none',
    }}>
      <div style={{
        fontFamily: "'Bricolage Grotesque', sans-serif",
        fontSize: 'clamp(2.25rem, 4.5vw, 3.5rem)',
        fontWeight: 800,
        letterSpacing: '-0.04em',
        color: stat.color,
        lineHeight: 1,
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateY(0)' : 'translateY(12px)',
        transition: `opacity 0.6s ease ${0.05 + i * 0.12}s, transform 0.6s ease ${0.05 + i * 0.12}s`,
      }}>
        {isVisible ? `${count}${suffix}` : `0${suffix}`}
      </div>
      <div style={{
        marginTop: '0.625rem',
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateY(0)' : 'translateY(8px)',
        transition: `opacity 0.6s ease ${0.1 + i * 0.12}s, transform 0.6s ease ${0.1 + i * 0.12}s`,
      }}>
        <div style={{
          fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.18em',
          textTransform: 'uppercase', marginBottom: '0.4rem',
          color: isDark ? 'rgba(247,243,237,0.55)' : '#1a1a1a',
        }}>
          {stat.label}
        </div>
        <span style={{
          display: 'inline-block', marginTop: '0.75rem',
          padding: '0.2rem 0.75rem', borderRadius: '9999px',
          fontSize: '0.625rem', fontWeight: 600, letterSpacing: '0.06em',
          background: isDark ? 'rgba(255,252,248,0.06)' : 'rgba(0,0,0,0.06)',
          border: `1px solid ${isDark ? 'rgba(255,252,248,0.1)' : 'rgba(0,0,0,0.1)'}`,
          color: isDark ? 'rgba(247,243,237,0.38)' : '#2a2a2a',
        }}>
          {stat.src}
        </span>
        <p style={{
          fontSize: '0.75rem', maxWidth: '160px', margin: '0.5rem auto 0', lineHeight: 1.5,
          fontWeight: 600,
          color: isDark ? 'rgba(247,243,237,0.65)' : '#0a0a0a',
        }}>
          {stat.bridge}
        </p>
      </div>
    </div>
  )
}

/* ── FEATURE ROW ───────────────────────────────────────── */
function FeatureRow({ feat, i }: { feat: typeof FEATURES[0]; i: number }) {
  const isDark = useIsDark()
  return (
    <div style={{
      background: isDark ? feat.tint : feat.tintLight,
      borderBottom: i < FEATURES.length - 1 ? `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` : 'none',
    }}>
      <div className="hp-feature-row-grid" style={{
        maxWidth: '1280px', margin: '0 auto',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        alignItems: 'center',
        gap: 'clamp(2rem, 5vw, 5rem)',
        padding: 'clamp(2.5rem, 5vw, 4.5rem) clamp(1.25rem, 3vw, 3rem)',
        minHeight: 'clamp(300px, 42vh, 480px)',
      }}>
        {/* Text */}
        <div style={{ order: feat.flip ? 2 : 1, maxWidth: '520px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.75rem' }}>
            <span style={{
              fontFamily: "'Bricolage Grotesque', sans-serif",
              fontSize: '3rem', fontWeight: 800, letterSpacing: '-0.05em',
              color: isDark ? 'rgba(247,243,237,0.08)' : 'rgba(0,0,0,0.08)', lineHeight: 1,
            }}>{feat.num}</span>
            <div style={{ width: '1.5px', height: '2.25rem', background: isDark ? feat.borderTint : feat.borderTintLight }} />
          </div>
          <h3 style={{
            fontFamily: "'Bricolage Grotesque', sans-serif",
            fontSize: 'clamp(1.25rem, 2.5vw, 1.75rem)', fontWeight: 700,
            letterSpacing: '-0.025em', lineHeight: 1.15, marginBottom: '0.5rem',
            color: isDark ? '#f7f3ed' : '#14110d',
          }}>{feat.title}</h3>
          <p style={{ fontSize: '0.8125rem', fontStyle: 'italic', color: isDark ? 'rgba(247,243,237,0.38)' : '#3a3a3a', marginBottom: '1.125rem', letterSpacing: '0.01em' }}>
            {feat.sub}
          </p>
          <p style={{ fontSize: '1rem', color: isDark ? 'rgba(247,243,237,0.55)' : '#1a1a1a', lineHeight: 1.75, maxWidth: '440px' }}>
            {feat.desc}
          </p>
        </div>
        {/* Image */}
        <div style={{
          order: feat.flip ? 1 : 2,
          borderRadius: '1.25rem', overflow: 'hidden',
          border: `1px solid ${isDark ? feat.borderTint : feat.borderTintLight}`,
          background: isDark ? feat.tint : feat.tintLight,
          aspectRatio: '4/3',
          width: '100%',
          flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative' as const,
        }}>
          <img
            src={feat.image}
            alt={feat.title}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = 'none';
              const parent = e.currentTarget.parentElement;
              if (parent) {
                const svg = document.createElement('div');
                svg.style.width = '100%';
                svg.style.height = '100%';
                svg.style.position = 'absolute';
                svg.style.inset = '0';
                parent.appendChild(svg);
              }
            }}
          />
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
            <feat.Illustration color={feat.illustrationColor} isDark={isDark} />
          </div>
        </div>
      </div>
    </div>
  )
}

function IllustrationPartner({ color, isDark }: { color: string; isDark: boolean }) {
  const opacity = isDark ? 1 : 0.7
  return (
    <svg viewBox="0 0 400 300" width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
      <defs>
        <radialGradient id="pg1" cx="35%" cy="50%" r="50%">
          <stop offset="0%" stopColor={color} stopOpacity={isDark ? 0.15 : 0.1} />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </radialGradient>
        <radialGradient id="pg2" cx="65%" cy="50%" r="50%">
          <stop offset="0%" stopColor={color} stopOpacity={isDark ? 0.15 : 0.1} />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="400" height="300" fill="url(#pg1)" />
      <rect width="400" height="300" fill="url(#pg2)" />
      <rect x="40" y="90" width="120" height="120" rx="20" fill={color} fillOpacity={isDark ? 0.08 : 0.12} stroke={color} strokeOpacity={isDark ? 0.2 : 0.35} strokeWidth="1" />
      <circle cx="100" cy="130" r="22" fill={color} fillOpacity={isDark ? 0.15 : 0.2} stroke={color} strokeOpacity={isDark ? 0.4 : 0.6} strokeWidth="1" />
      <rect x="68" y="162" width="64" height="6" rx="3" fill={color} fillOpacity={isDark ? 0.25 : 0.35} />
      <rect x="78" y="174" width="44" height="4" rx="2" fill={color} fillOpacity={isDark ? 0.15 : 0.22} />
      <rect x="240" y="90" width="120" height="120" rx="20" fill={color} fillOpacity={isDark ? 0.08 : 0.12} stroke={color} strokeOpacity={isDark ? 0.2 : 0.35} strokeWidth="1" />
      <circle cx="300" cy="130" r="22" fill={color} fillOpacity={isDark ? 0.15 : 0.2} stroke={color} strokeOpacity={isDark ? 0.4 : 0.6} strokeWidth="1" />
      <rect x="268" y="162" width="64" height="6" rx="3" fill={color} fillOpacity={isDark ? 0.25 : 0.35} />
      <rect x="278" y="174" width="44" height="4" rx="2" fill={color} fillOpacity={isDark ? 0.15 : 0.22} />
      <line x1="165" y1="150" x2="235" y2="150" stroke={color} strokeOpacity={isDark ? 0.3 : 0.5} strokeWidth="1.5" strokeDasharray="6 4" />
      <circle cx="200" cy="150" r="10" fill={color} fillOpacity={isDark ? 0.15 : 0.22} stroke={color} strokeOpacity={isDark ? 0.5 : 0.7} strokeWidth="1" />
      <text x="200" y="155" textAnchor="middle" fontSize="10" fill={color} fillOpacity={opacity} fontWeight="700">↔</text>
      <circle cx="122" cy="108" r="10" fill={color} fillOpacity={isDark ? 0.3 : 0.4} stroke={color} strokeOpacity={isDark ? 0.5 : 0.7} strokeWidth="1" />
      <text x="122" y="113" textAnchor="middle" fontSize="9" fill={color} fillOpacity={opacity} fontWeight="700">✓</text>
      <circle cx="322" cy="108" r="10" fill={color} fillOpacity={isDark ? 0.3 : 0.4} stroke={color} strokeOpacity={isDark ? 0.5 : 0.7} strokeWidth="1" />
      <text x="322" y="113" textAnchor="middle" fontSize="9" fill={color} fillOpacity={opacity} fontWeight="700">✓</text>
    </svg>
  )
}

function IllustrationMarketplace({ color, isDark }: { color: string; isDark: boolean }) {
  return (
    <svg viewBox="0 0 400 300" width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
      <defs>
        <radialGradient id="mg1" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor={color} stopOpacity={isDark ? 0.12 : 0.1} />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="400" height="300" fill="url(#mg1)" />
      {[
        { x: 40, y: 60, w: 150, h: 80 },
        { x: 210, y: 60, w: 150, h: 80 },
        { x: 40, y: 160, w: 150, h: 80 },
        { x: 210, y: 160, w: 150, h: 80 },
      ].map((r, i) => (
        <g key={i}>
          <rect x={r.x} y={r.y} width={r.w} height={r.h} rx="12"
            fill={color} fillOpacity={i === 0 ? (isDark ? 0.12 : 0.15) : (isDark ? 0.06 : 0.09)}
            stroke={color} strokeOpacity={i === 0 ? (isDark ? 0.35 : 0.5) : (isDark ? 0.15 : 0.25)} strokeWidth="1" />
          <rect x={r.x + 12} y={r.y + 14} width={r.w * 0.5} height="6" rx="3" fill={color} fillOpacity={isDark ? 0.35 : 0.45} />
          <rect x={r.x + 12} y={r.y + 28} width={r.w * 0.7} height="4" rx="2" fill={color} fillOpacity={isDark ? 0.18 : 0.28} />
          <rect x={r.x + 12} y={r.y + 38} width={r.w * 0.55} height="4" rx="2" fill={color} fillOpacity={isDark ? 0.12 : 0.2} />
          <rect x={r.x + 12} y={r.y + 54} width={48} height="16" rx="8"
            fill={color} fillOpacity={i === 0 ? (isDark ? 0.3 : 0.4) : (isDark ? 0.1 : 0.18)} stroke={color} strokeOpacity={isDark ? 0.3 : 0.5} strokeWidth="1" />
          <text x={r.x + 36} y={r.y + 66} textAnchor="middle" fontSize="8" fill={color} fillOpacity={isDark ? 0.8 : 1} fontWeight="700">
            {i === 0 ? 'Express →' : 'View'}
          </text>
        </g>
      ))}
      <rect x="40" y="20" width="320" height="28" rx="14"
        fill={color} fillOpacity={isDark ? 0.06 : 0.09} stroke={color} strokeOpacity={isDark ? 0.2 : 0.35} strokeWidth="1" />
      <circle cx="62" cy="34" r="6" fill="none" stroke={color} strokeOpacity={isDark ? 0.4 : 0.6} strokeWidth="1.5" />
      <line x1="67" y1="39" x2="72" y2="44" stroke={color} strokeOpacity={isDark ? 0.4 : 0.6} strokeWidth="1.5" />
      <rect x="82" y="30" width="80" height="8" rx="4" fill={color} fillOpacity={isDark ? 0.15 : 0.25} />
    </svg>
  )
}

function IllustrationVerification({ color, isDark }: { color: string; isDark: boolean }) {
  return (
    <svg viewBox="0 0 400 300" width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
      <defs>
        <radialGradient id="vg1" cx="50%" cy="50%" r="55%">
          <stop offset="0%" stopColor={color} stopOpacity={isDark ? 0.15 : 0.12} />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="400" height="300" fill="url(#vg1)" />
      <path d="M200 50 L260 80 L260 160 Q260 210 200 240 Q140 210 140 160 L140 80 Z"
        fill={color} fillOpacity={isDark ? 0.08 : 0.12} stroke={color} strokeOpacity={isDark ? 0.3 : 0.5} strokeWidth="1.5" />
      <path d="M200 70 L245 95 L245 158 Q245 198 200 222 Q155 198 155 158 L155 95 Z"
        fill={color} fillOpacity={isDark ? 0.06 : 0.09} stroke={color} strokeOpacity={isDark ? 0.2 : 0.35} strokeWidth="1" />
      <polyline points="178,148 193,163 224,132"
        fill="none" stroke={color} strokeOpacity={isDark ? 0.8 : 1} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      {[0, 72, 144, 216, 288].map((angle, i) => (
        <circle key={i}
          cx={200 + 90 * Math.cos((angle * Math.PI) / 180)}
          cy={145 + 90 * Math.sin((angle * Math.PI) / 180)}
          r="5" fill={color} fillOpacity={isDark ? 0.3 : 0.45} stroke={color} strokeOpacity={isDark ? 0.5 : 0.7} strokeWidth="1" />
      ))}
      <circle cx="200" cy="145" r="90" fill="none" stroke={color} strokeOpacity={isDark ? 0.1 : 0.2} strokeWidth="1" strokeDasharray="4 6" />
      <rect x="48" y="100" width="70" height="8" rx="4" fill={color} fillOpacity={isDark ? 0.2 : 0.3} />
      <rect x="48" y="116" width="50" height="5" rx="2.5" fill={color} fillOpacity={isDark ? 0.12 : 0.2} />
      <rect x="282" y="100" width="70" height="8" rx="4" fill={color} fillOpacity={isDark ? 0.2 : 0.3} />
      <rect x="292" y="116" width="50" height="5" rx="2.5" fill={color} fillOpacity={isDark ? 0.12 : 0.2} />
    </svg>
  )
}

function IllustrationLab({ color, isDark }: { color: string; isDark: boolean }) {
  return (
    <svg viewBox="0 0 400 300" width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
      <defs>
        <radialGradient id="lg1" cx="50%" cy="60%" r="60%">
          <stop offset="0%" stopColor={color} stopOpacity={isDark ? 0.15 : 0.12} />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="400" height="300" fill="url(#lg1)" />
      <circle cx="200" cy="150" r="36" fill={color} fillOpacity={isDark ? 0.1 : 0.15} stroke={color} strokeOpacity={isDark ? 0.3 : 0.5} strokeWidth="1.5" />
      <circle cx="200" cy="150" r="20" fill={color} fillOpacity={isDark ? 0.15 : 0.22} stroke={color} strokeOpacity={isDark ? 0.4 : 0.6} strokeWidth="1" />
      <text x="200" y="155" textAnchor="middle" fontSize="14" fill={color} fillOpacity={isDark ? 0.7 : 0.9} fontWeight="800">Lab</text>
      {[
        { angle: -90, label: 'NGO' },
        { angle: -18, label: 'Gov' },
        { angle: 54, label: 'Corp' },
        { angle: 126, label: 'Fund' },
        { angle: 198, label: 'Tech' },
      ].map(({ angle, label }, i) => {
        const rad = (angle * Math.PI) / 180
        const x = 200 + 95 * Math.cos(rad)
        const y = 150 + 95 * Math.sin(rad)
        const mx = 200 + 58 * Math.cos(rad)
        const my = 150 + 58 * Math.sin(rad)
        return (
          <g key={i}>
            <line x1={mx} y1={my} x2={x} y2={y}
              stroke={color} strokeOpacity={isDark ? 0.2 : 0.4} strokeWidth="1" strokeDasharray="4 3" />
            <circle cx={x} cy={y} r="22"
              fill={color} fillOpacity={isDark ? 0.08 : 0.14} stroke={color} strokeOpacity={isDark ? 0.25 : 0.4} strokeWidth="1" />
            <text x={x} y={y + 4} textAnchor="middle" fontSize="8" fill={color} fillOpacity={isDark ? 0.6 : 0.85} fontWeight="700">
              {label}
            </text>
          </g>
        )
      })}
      <circle cx="200" cy="150" r="55" fill="none" stroke={color} strokeOpacity={isDark ? 0.08 : 0.15} strokeWidth="1" />
      <circle cx="200" cy="150" r="75" fill="none" stroke={color} strokeOpacity={isDark ? 0.05 : 0.1} strokeWidth="1" />
    </svg>
  )
}

/* ── ROLES CAROUSEL ────────────────────────────────────── */
function RolesStack() {
  const isDark = useIsDark()
  return (
    <Swiper
      modules={[Navigation]}
      slidesPerView={1}
      speed={750}
      loop
      grabCursor
      navigation={{ nextEl: '.roles-next', prevEl: '.roles-prev' }}
      style={{ width: '100%' }}
    >
      {ROLES.map((item) => (
        <SwiperSlide key={item.role}>
          <div style={{
            background: isDark ? item.bg : item.bgLight,
            minHeight: 'clamp(360px, 62vh, 520px)',
            display: 'flex', alignItems: 'center',
            padding: 'clamp(2.5rem, 5vw, 5rem) clamp(1.25rem, 3vw, 3rem)',
          }}>
            <div style={{ maxWidth: '1280px', margin: '0 auto', width: '100%' }}>
              <div className="hp-roles-grid" style={{ display: 'grid', gridTemplateColumns: '1fr clamp(200px, 28vw, 340px)', gap: '3rem', alignItems: 'center' }}>
                <div style={{ maxWidth: '640px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', marginBottom: '1.75rem' }}>
                    <span style={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: item.accent, opacity: 0.8 }}>
                      {item.index}
                    </span>
                    <span style={{ width: '2rem', height: '1px', background: item.accent, opacity: 0.4, display: 'block' }} />
                    <span style={{ fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase', color: isDark ? 'rgba(247,243,237,0.38)' : '#3a3a3a' }}>
                      {item.role}
                    </span>
                  </div>
                  <h3 style={{
                    fontFamily: "'Bricolage Grotesque', sans-serif",
                    fontSize: 'clamp(1.625rem, 3.5vw, 2.625rem)',
                    fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.1,
                    color: isDark ? '#f7f3ed' : '#14110d', marginBottom: '1rem',
                  }}>{item.intent}</h3>
                  <p style={{ fontSize: '1rem', lineHeight: 1.75, color: isDark ? 'rgba(247,243,237,0.52)' : '#1a1a1a', maxWidth: '500px', marginBottom: '2rem' }}>
                    {item.desc}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', flexWrap: 'wrap' }}>
                    <Link href={item.href}>
                      <button className="hp-btn-glass" style={{ borderColor: `${item.accent}40` }}>
                        Learn more
                        <ArrowRight style={{ width: '0.8125rem', height: '0.8125rem', marginLeft: '0.375rem' }} />
                      </button>
                    </Link>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button type="button" className="roles-prev" style={{
                        width: '2.375rem', height: '2.375rem', borderRadius: '50%',
                        border: `1px solid ${isDark ? 'rgba(255,252,248,0.14)' : 'rgba(20,17,13,0.18)'}`,
                        background: isDark ? 'rgba(255,252,248,0.05)' : 'rgba(20,17,13,0.05)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', color: isDark ? '#f7f3ed' : '#14110d', transition: 'all 0.2s ease',
                      }}>
                        <ArrowLeft style={{ width: '0.8125rem', height: '0.8125rem' }} />
                      </button>
                      <button type="button" className="roles-next" style={{
                        width: '2.375rem', height: '2.375rem', borderRadius: '50%',
                        border: `1px solid ${item.accent}50`,
                        background: `${item.accent}20`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', color: item.accent, transition: 'all 0.2s ease',
                      }}>
                        <ArrowRight style={{ width: '0.8125rem', height: '0.8125rem' }} />
                      </button>
                    </div>
                  </div>
                </div>
                <div className="hp-roles-img" style={{
                  width: 'clamp(200px, 28vw, 340px)',
                  height: 'clamp(200px, 28vw, 340px)',
                  borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
                  border: `2px solid ${item.accent}40`,
                  background: `linear-gradient(135deg, ${item.accent}20, ${item.accent}08)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  position: 'relative' as const,
                }}>
                  <svg viewBox="0 0 200 200" width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
                    <circle cx="100" cy="100" r="80" fill="none" stroke={item.accent} strokeWidth="0.5" opacity={isDark ? 0.3 : 0.5} />
                    <circle cx="100" cy="100" r="55" fill="none" stroke={item.accent} strokeWidth="0.5" opacity={isDark ? 0.2 : 0.35} />
                    {[0,45,90,135,180,225,270,315].map((angle) => (
                      <line
                        key={angle}
                        x1="100" y1="100"
                        x2={100 + 78 * Math.cos((angle * Math.PI) / 180)}
                        y2={100 + 78 * Math.sin((angle * Math.PI) / 180)}
                        stroke={item.accent} strokeWidth="0.5" opacity={isDark ? 0.15 : 0.25}
                      />
                    ))}
                    {[0,60,120,180,240,300].map((angle) => (
                      <circle
                        key={angle}
                        cx={100 + 80 * Math.cos((angle * Math.PI) / 180)}
                        cy={100 + 80 * Math.sin((angle * Math.PI) / 180)}
                        r="2.5" fill={item.accent} opacity={isDark ? 0.5 : 0.7}
                      />
                    ))}
                    <circle cx="100" cy="100" r="12" fill={item.accent} opacity={isDark ? 0.15 : 0.25} />
                    <circle cx="100" cy="100" r="6" fill={item.accent} opacity={isDark ? 0.4 : 0.6} />
                    <text x="100" y="170" textAnchor="middle" fontSize="11" fontWeight="700"
                      letterSpacing="0.15em" fill={item.accent} opacity={isDark ? 0.4 : 0.6}
                      fontFamily="'Bricolage Grotesque', sans-serif">
                      {item.index}
                    </text>
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </SwiperSlide>
      ))}
    </Swiper>
  )
}

/* ── HOME PAGE ─────────────────────────────────────────── */
export default function HomePage() {
  const isDark = useIsDark()
  const [videoError] = useState(false)
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const statsRef = useRef<HTMLDivElement>(null)
  const [statsVisible, setStatsVisible] = useState(false)

  useEffect(() => {
    const el = statsRef.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setStatsVisible(true); obs.disconnect() } },
      { threshold: 0.2 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  

  useEffect(() => {
    const targets = document.querySelectorAll('.hp-reveal')
    if (!targets.length) return
    const obs = new IntersectionObserver(
      (entries) => entries.forEach(e => {
        if (e.isIntersecting) {
          ;(e.target as HTMLElement).style.opacity = '1'
          ;(e.target as HTMLElement).style.transform = 'translateY(0)'
          obs.unobserve(e.target)
        }
      }),
      { threshold: 0.08 }
    )
    targets.forEach(t => obs.observe(t))
    return () => obs.disconnect()
  }, [])

  // Theme-responsive tokens
  const T = {
    bg:         isDark ? 'hsl(193,20%,7%)'          : '#f7f3ed',
    text:       isDark ? '#f7f3ed'                   : '#0a0a0a',
    textDim:    isDark ? 'rgba(247,243,237,0.55)'    : '#1a1a1a',
    textDimmer: isDark ? 'rgba(247,243,237,0.45)'    : '#2a2a2a',
    textFaint:  isDark ? 'rgba(247,243,237,0.38)'    : '#3a3a3a',
    border:     isDark ? 'rgba(255,255,255,0.06)'    : 'rgba(0,0,0,0.1)',
    borderMd:   isDark ? 'rgba(255,255,255,0.08)'    : 'rgba(0,0,0,0.14)',
    surface:    isDark ? 'rgba(255,255,255,0.02)'    : '#ffffff',
    surfaceMd:  isDark ? 'rgba(255,255,255,0.03)'    : '#ffffff',
    statsCard:  isDark ? 'rgba(14,12,16,0.65)'       : '#ffffff',
  }

  const S = {
    sectionPad:   { padding: 'clamp(3.5rem, 7vw, 6rem) 0' } as React.CSSProperties,
    sectionPadSm: { padding: 'clamp(2.5rem, 5vw, 4rem) 0' } as React.CSSProperties,
    contentMax:   {} as React.CSSProperties,
    sectionLabel: {
      fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.2em',
      textTransform: 'uppercase' as const, color: '#C45C26',
      marginBottom: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.625rem',
    },
    h2: {
      fontFamily: "'Bricolage Grotesque', sans-serif",
      fontSize: 'clamp(1.875rem, 3.5vw, 2.875rem)',
      fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.1,
      color: T.text,
    } as React.CSSProperties,
    reveal: {
      opacity: 0,
      transform: 'translateY(24px)',
      transition: 'opacity 0.7s ease, transform 0.7s ease',
    } as React.CSSProperties,
  }

  return (
    <div style={{ background: T.bg, minHeight: '100vh', color: T.text }}>

      {/* ── HERO ──────────────────────────────────────────── */}
      <section style={{ position: 'relative', minHeight: '100vh', display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, zIndex: 0, background: isDark ? 'hsl(193,20%,7%)' : '#ffffff' }} />
        <div style={{ position: 'absolute', width: '70vw', height: '70vh', top: '-15%', right: '-10%', background: 'radial-gradient(ellipse, rgba(196,92,38,0.08) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 1 }} />
        <div style={{ position: 'absolute', width: '50vw', height: '50vh', bottom: '0', left: '10%', background: 'radial-gradient(ellipse, rgba(45,184,122,0.04) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 1 }} />
        <div className="hp-section-wrap hp-hero" style={{ position: 'relative', zIndex: 10, paddingTop: '7rem', paddingBottom: '6rem', width: '100%', textAlign: isDark ? 'left' : 'center', display: 'flex', flexDirection: 'column', alignItems: isDark ? 'flex-start' : 'center' }}>
          <h1 style={{
            fontFamily: "'Bricolage Grotesque', sans-serif",
            fontSize: 'clamp(2.75rem, 6.5vw, 5rem)',
            fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1.05,
            maxWidth: '820px', marginBottom: '1.75rem', color: T.text,
          }}>
            Africa's impact work is stalling at the{' '}
            <span style={{ background: 'linear-gradient(90deg, #C45C26, #e07a4a, #C45C26)', backgroundSize: '200% auto', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', animation: 'hp-shimmer 3s linear infinite' }}>
              coordination layer.
            </span>
          </h1>
          <p style={{ fontSize: 'clamp(1rem, 2vw, 1.25rem)', lineHeight: 1.72, color: T.textDim, maxWidth: '600px', marginBottom: '2.5rem' }}>
            Impact Natives is the platform where NGOs, funders, corporates, and ecosystem builders find each other, verify trust, and form partnerships that work, without the email chains and multi-month delays.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.875rem', justifyContent: isDark ? 'flex-start' : 'center' }}>
            <Link href="/platform/partnership-os">
              <button className="hp-btn-primary">
                Find a Partner
                <ArrowRight style={{ width: '1rem', height: '1rem' }} />
              </button>
            </Link>
            <Link href="/platform/impact-marketplace">
              <button style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.625rem 1.5rem', borderRadius: '9999px',
                fontSize: '0.9375rem', fontWeight: 600, cursor: 'pointer',
                transition: 'all 0.2s ease',
                background: isDark ? 'rgba(255,255,255,0.05)' : '#ffffff',
                border: isDark ? '1px solid rgba(255,255,255,0.14)' : '1px solid #0a0a0a',
                color: isDark ? '#f7f3ed' : '#0a0a0a',
              }}>
                Create an Initiative
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── PROBLEM ───────────────────────────────────────── */}
      <section className="hp-reveal" style={{ ...S.sectionPad, ...S.reveal, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', width: '500px', height: '500px', top: '-50px', left: '-150px', background: 'radial-gradient(circle, rgba(45,122,212,0.05) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div className="hp-section-wrap hp-hero">
          <div className="hp-mobile-stack" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'clamp(2.5rem, 6vw, 6rem)', alignItems: 'center' }}>
            <div className="hp-mobile-text-first">
              <div style={S.sectionLabel}>The Challenge</div>
              <h2 style={{ ...S.h2, marginBottom: '1.5rem' }}>
                Not short of capital or ideas. Short of{' '}
                <em style={{ fontStyle: 'normal', color: '#e07a4a' }}>coordination.</em>
              </h2>
              <p style={{ fontSize: '1.0625rem', lineHeight: 1.75, color: T.textDim, marginBottom: '1.25rem' }}>
                The right organisations exist. The funding exists. The intention exists. What breaks down is the match: finding the right partner, knowing they're credible, and moving from interest to action.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {[
                  'No shared infrastructure for discovering and vetting partners',
                  'Capital sits idle while credible implementers go unfunded',
                  'Every partnership starts from scratch: no shared coordination memory, no unified vetting standard, no common infrastructure',
                ].map((point, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', padding: '0.875rem 1.125rem', borderRadius: '0.875rem', background: T.surfaceMd, border: `1px solid ${T.border}` }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#C45C26', flexShrink: 0, marginTop: '0.45em' }} />
                    <span style={{ fontSize: '0.9375rem', color: T.textDim, lineHeight: 1.6 }}>{point}</span>
                  </div>
                ))}
                <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <p style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 'clamp(1.5rem, 3vw, 2.25rem)', fontWeight: 400, color: '#e07a4a', letterSpacing: '-0.03em', lineHeight: 1.1, textAlign: 'center', paddingTop: '0.5rem', borderTop: '1px solid rgba(196,92,38,0.2)' }}>
                    Natives is built to fix that.
                  </p>
                </div>
              </div>
            </div>
            <div className="hp-mobile-img-below" style={{ borderRadius: '1.25rem', overflow: 'hidden', border: `1px solid ${T.borderMd}`, aspectRatio: '4/3', position: 'relative', background: T.surfaceMd }}>
              <ImgFallback
                src="/homepage1.jpeg" alt="Africa impact coordination"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                FallbackIcon={Network}
              />
              <div style={{ position: 'absolute', inset: 0, background: isDark ? 'linear-gradient(to top, rgba(9,8,10,0.5) 0%, transparent 55%)' : 'linear-gradient(to top, rgba(247,243,237,0.3) 0%, transparent 55%)' }} />
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS ─────────────────────────────────────────── */}
      <section className="hp-light-section" style={{ ...S.sectionPad, position: 'relative', borderTop: `1px solid ${T.border}`, borderBottom: `1px solid ${T.border}`, background: T.surface, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', width: '60vw', height: '50vh', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: 'radial-gradient(ellipse, rgba(196,92,38,0.07) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div ref={statsRef} style={{ position: 'relative', zIndex: 1 }}>
          <div className="hp-section-wrap" style={{ ...S.contentMax, textAlign: 'center', marginBottom: '3.5rem' }}>
            <div style={{ ...S.sectionLabel, justifyContent: 'center' }}>
              <span style={{ width: '1.5rem', height: '1.5px', background: '#C45C26', display: 'block' }} />
              The ROI Case
              <span style={{ width: '1.5rem', height: '1.5px', background: '#C45C26', display: 'block' }} />
            </div>
            <h2 style={{ ...S.h2, marginBottom: '0.75rem' }}>Why unified partnership management matters</h2>
            <p style={{ color: T.textDimmer, fontSize: '1rem', maxWidth: '500px', margin: '0 auto', lineHeight: 1.65 }}>
              Across NGOs, founders, government, DFIs, and corporate partners
            </p>
          </div>
          <div className="hp-section-wrap" style={S.contentMax}>
            <div className="hp-stats-card" style={{ borderRadius: '1.25rem', border: `1px solid ${T.borderMd}`, background: T.statsCard, backdropFilter: 'blur(32px)', overflow: 'hidden' }}>
              <div className="hp-stats-inner" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)' }}>
                {STATS.map((stat, i) => <StatCell key={i} stat={stat} i={i} isVisible={statsVisible} />)}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURES ──────────────────────────────────────── */}
      <section style={S.sectionPad}>
        <div className="hp-reveal hp-section-wrap hp-hero" style={{ ...S.reveal, marginBottom: '3.5rem' }}>
          <div style={S.sectionLabel}>Platform Features</div>
          <h2 style={S.h2}>How Natives helps you</h2>
        </div>
        <div style={{ border: `1px solid ${T.border}`, borderRadius: '1.25rem', overflow: 'hidden' }}>
          {FEATURES.map((feat, i) => <FeatureRow key={i} feat={feat} i={i} />)}
        </div>
      </section>

      {/* ── WHO IT'S FOR ──────────────────────────────────── */}
      <section style={{ borderTop: `1px solid ${T.border}`, overflow: 'hidden' }}>
        <div className="hp-reveal hp-section-wrap hp-hero" style={{ ...S.reveal, paddingTop: '5rem', paddingBottom: '2.5rem' }}>
          <div style={S.sectionLabel}>Who it's for</div>
          <h2 style={S.h2}>Natives</h2>
        </div>
        <RolesStack />
      </section>

      {/* ── ABOUT ─────────────────────────────────────────── */}
      <section className="hp-reveal" style={{ ...S.sectionPad, ...S.reveal, borderTop: `1px solid ${T.border}`, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', width: '500px', height: '500px', top: '-80px', right: '-80px', background: 'radial-gradient(circle, rgba(196,92,38,0.07) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div className="hp-section-wrap hp-hero">
          <div className="hp-mobile-stack" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'clamp(2.5rem, 6vw, 6rem)', alignItems: 'center' }}>
            <div className="hp-mobile-text-first">
              <div style={S.sectionLabel}>About Us</div>
              <h2 style={{ ...S.h2, marginBottom: '1.5rem' }}>Built for the work that should exist but doesn't yet.</h2>
              <p style={{ fontSize: '1.0625rem', lineHeight: 1.75, color: T.textDim, marginBottom: '1.25rem' }}>
                For too long, making impact has required knowing somebody. The right conference. The right introduction. The right institutional stamp. Good ideas, credible organisations, and serious funders kept missing each other, not for lack of intent, but for lack of infrastructure.
              </p>
              <p style={{ fontSize: '1.0625rem', lineHeight: 1.75, color: T.textDim, marginBottom: '0' }}>
                We built Impact Natives to close that gap. One place where an idea finds its partners, a funder finds its pipeline, a corporate finds its delivery partner, and an implementer finally gets seen.
              </p>
            </div>
            <div style={{ borderRadius: '1.25rem', border: `1px solid ${T.borderMd}`, background: T.surfaceMd, backdropFilter: 'blur(20px)', padding: '2.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', justifyContent: 'center' }}>
              {/* Years */}
              <div style={{ padding: '1.5rem 1.75rem', borderRadius: '0.875rem', background: T.surfaceMd, border: `1px solid ${T.border}` }}>
                <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 'clamp(2rem, 4vw, 2.75rem)', fontWeight: 800, letterSpacing: '-0.04em', color: T.text, lineHeight: 1, marginBottom: '0.5rem' }}>
                  10+
                </div>
                <div style={{ fontSize: '0.875rem', color: T.textDimmer, lineHeight: 1.5 }}>
                  Years building and working in Africa's impact sector
                </div>
              </div>
              {/* ALIGN */}
              <div style={{ padding: '1.5rem 1.75rem', borderRadius: '0.875rem', background: 'rgba(196,92,38,0.06)', border: '1px solid rgba(196,92,38,0.18)' }}>
                <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: '1.25rem', fontWeight: 800, letterSpacing: '0.08em', color: '#C45C26', lineHeight: 1, marginBottom: '0.5rem' }}>
                  A.L.I.G.N.
                </div>
                <div style={{ fontSize: '0.875rem', color: T.textDimmer, lineHeight: 1.6, marginBottom: '1rem' }}>
                  The principles that guide how we build — accountability, linkage, intentionality, governance, and networks.
                </div>
               
              </div>
              {/* Philosophy */}
              <div style={{ padding: '1.5rem 1.75rem', borderRadius: '0.875rem', background: T.surfaceMd, border: `1px solid ${T.border}` }}>
                <div style={{ fontSize: '1rem', fontStyle: 'italic', color: T.textDim, lineHeight: 1.65 }}>
                  Most ideas die with the person who had them. We're building the exit.
                </div>
              </div>
            </div>
            <div className="hp-about-cta" style={{ gridColumn: 'span 2' }}>
              <Link href="/about">
                <button className="hp-btn-outline">
                  Learn more about us
                  <ArrowRight style={{ width: '0.875rem', height: '0.875rem' }} />
                </button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── THREE PATHS ───────────────────────────────────── */}
      <section className="hp-reveal hp-light-section" style={{ ...S.sectionPad, ...S.reveal, borderTop: `1px solid ${T.border}`, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', width: '700px', height: '700px', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: 'radial-gradient(ellipse, rgba(196,92,38,0.05) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div className="hp-section-wrap hp-hero" style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ marginBottom: '3.5rem' }}>
            <div style={S.sectionLabel}>Choose Your Path</div>
            <h2 style={{ ...S.h2, marginBottom: '0.875rem' }}>What would you like to do?</h2>
            <p style={{ fontSize: '1.0625rem', color: T.textDimmer, maxWidth: '700px', lineHeight: 1.65 }}>
              Natives serves three distinct purposes. Choose the one that fits your intent. Tell us what you're trying to do and we'll route you to the right place.
            </p>
          </div>
          <div className="hp-path-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.25rem' }}>
            {[
              {
                icon: Network, title: 'I want to find partners',
                desc: 'Search and connect with verified NGOs, funders, founders, corporates, and implementers, tailored to your needs.',
                points: ['NGO to funder matching', 'Founder to pilot partner', 'Corporate to implementer'],
                href: '/platform/partnership-os', cta: 'Get Matched', featured: true,
              },
              {
                icon: FlaskConical, title: 'I want to solve a complex challenge',
                desc: "Natives convenes and structures stakeholders around a specific systemic challenge. A managed coordination process, not a self-service product.",
                points: ['You define the problem, Natives designs the room', 'Curated participants, not open networking', 'You leave with a partnership roadmap and a path to execution'],
                href: '/labs/commission', cta: 'Submit Lab Proposal', featured: false,
              },
              {
                icon: Handshake, title: 'I want to post an initiative',
                desc: "Post your initiative to the marketplace and connect with the funders, implementers, and partners already looking for what you're building.",
                points: ['Marketplace visibility', 'Direct expressions of interest', 'Confirmed partnership tracking'],
                href: '/platform/impact-marketplace', cta: 'Create Initiative', featured: false,
              },
            ].map((item, i) => (
              <div key={i} className={item.featured ? 'hp-path-card hp-path-card-featured' : 'hp-path-card'} style={{
                display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                padding: '2rem',
                borderRadius: '1.25rem',
                border: item.featured ? '1px solid rgba(196,92,38,0.3)' : `1px solid ${T.border}`,
                background: item.featured ? 'rgba(196,92,38,0.07)' : T.surface,
                transition: 'border-color 0.2s ease, background 0.2s ease',
              }}>
                <div>
                  <div style={{ width: '2.75rem', height: '2.75rem', borderRadius: '0.75rem', background: item.featured ? 'rgba(196,92,38,0.15)' : T.surfaceMd, border: `1px solid ${item.featured ? 'rgba(196,92,38,0.3)' : T.borderMd}`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem' }}>
                    <item.icon style={{ width: '1.125rem', height: '1.125rem', color: item.featured ? '#C45C26' : T.textFaint }} />
                  </div>
                  <h3 style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: '1.125rem', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: '0.75rem', color: T.text }}>{item.title}</h3>
                  <p style={{ fontSize: '0.9375rem', color: T.textDimmer, lineHeight: 1.65, marginBottom: '1.5rem' }}>{item.desc}</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '2rem' }}>
                    {item.points.map((pt, j) => (
                      <div key={j} className="hp-path-point" style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', fontSize: '0.875rem', color: T.textFaint }}>
                        <ArrowRight style={{ width: '0.75rem', height: '0.75rem', color: '#C45C26', flexShrink: 0 }} />
                        {pt}
                      </div>
                    ))}
                  </div>
                </div>
                <Link href={item.href} style={{ display: 'block' }}>
                  <button className={item.featured ? 'hp-btn-primary' : 'hp-btn-glass'} style={{ width: '100%', justifyContent: 'center' }}>
                    {item.cta}
                  </button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ───────────────────────────────────────────── */}
      <section className="hp-reveal" style={{ ...S.sectionPad, ...S.reveal, borderTop: `1px solid ${T.border}`, background: T.surface }}>
        <div className="hp-section-wrap hp-hero">
          <div className="hp-faq-grid hp-mobile-stack" style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 'clamp(3rem, 6vw, 6rem)', alignItems: 'start' }}>
            <div className="hp-mobile-unstick" style={{ position: 'sticky', top: '6rem' }}>
              <div style={S.sectionLabel}>FAQ</div>
              <h2 style={{ ...S.h2, marginBottom: '1rem' }}>Common questions</h2>
              <p style={{ fontSize: '1.0625rem', color: T.textDimmer, lineHeight: 1.7, marginBottom: '2rem' }}>
                A few things people ask before joining. The full FAQ has more.
              </p>
              <Link href="/faq">
                <button className="hp-btn-outline">
                  View all questions
                  <ArrowRight style={{ width: '0.875rem', height: '0.875rem' }} />
                </button>
              </Link>
            </div>
            <div style={{ borderRadius: '1.25rem', overflow: 'hidden', border: `1px solid ${T.border}` }}>
              {FAQS.map((faq, i) => (
                <div key={i} style={{ borderBottom: i < FAQS.length - 1 ? `1px solid ${T.border}` : 'none' }}>
                  <button
                    type="button"
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      gap: '1rem', padding: '1.25rem 1.625rem',
                      background: openFaq === i ? T.surfaceMd : 'transparent',
                      border: 'none', cursor: 'pointer', color: T.text, textAlign: 'left',
                      transition: 'background 0.2s ease',
                    }}
                  >
                    <span style={{ fontWeight: 600, fontSize: '0.9375rem', lineHeight: 1.5, flex: 1 }}>
                      {faq.q}
                    </span>
                    <ChevronDown style={{ width: '1.125rem', height: '1.125rem', flexShrink: 0, color: T.textFaint, transform: openFaq === i ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s ease' }} />
                  </button>
                  <div style={{ maxHeight: openFaq === i ? '400px' : '0', overflow: 'hidden', transition: 'max-height 0.35s ease' }}>
                    <p style={{ padding: '0 1.625rem 1.25rem', fontSize: '0.9375rem', color: T.textDimmer, lineHeight: 1.72 }}>
                      {faq.a}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>      

      {/* ── NEWSLETTER ────────────────────────────────────── */}
      <NewsletterSignup variant="section" />

    </div>
  )
}
