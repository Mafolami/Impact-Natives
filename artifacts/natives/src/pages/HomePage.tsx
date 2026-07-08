// src/pages/HomePage.tsx

import { useState, useEffect, useRef } from 'react'
import { Link } from 'wouter'
import { Swiper, SwiperSlide } from 'swiper/react'
import { Navigation } from 'swiper/modules'
import 'swiper/css'
import {
  Network, ArrowRight, FlaskConical, Handshake,
  ChevronDown, ArrowLeft, Shield, Globe,
  Users, Zap, CheckCircle,
} from 'lucide-react'
import { NewsletterSignup } from '@/components/platform/NewsletterSignup'

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
    role: 'Individual / Creative',
    intent: "Contribute your skills, ideas, and voice to Africa's impact work",
    desc: "You don't need to represent an organisation to make impact. As an individual — consultant, creative, researcher, advocate, or practitioner — you can post initiatives, join existing ones, and commission Innovation Labs. Natives gives you the same access to Africa's impact ecosystem as any institution.",
    bg: 'linear-gradient(135deg, #1c0e0e 0%, #2d1a0d 100%)',
    accent: '#c45c26',
    index: '01',
    href: '/signup',
    image: '/founder.png',
  },
  {
    role: 'NGO / Non-Profit',
    intent: 'Increase visibility, access aligned funding, and find implementation partners',
    desc: "Your organisation has the field presence, community trust, and delivery capacity that funders and corporates are looking for — but discovery is still broken. Natives gives you a structured profile, verified credibility, and direct access to funders, corporates seeking CSR partners, and implementers looking to collaborate.",
    bg: 'linear-gradient(135deg, #071a10 0%, #0d2d1a 100%)',
    accent: '#2db87a',
    index: '02',
    href: '/solutions',
    image: '/ngos.png',
  },
  {
    role: 'Startup / Social Enterprise',
    intent: 'Find co-founders, pilot partners, and early capital pathways',
    desc: "You have a validated thesis and a model worth backing — but without the right institutional connective tissue, you're stuck in the pitch cycle. Natives connects you with established NGOs willing to act as proof-of-concept partners, corporates open to co-development, and funders who need on-the-ground evidence before committing capital.",
    bg: 'linear-gradient(135deg, #12100a 0%, #26220d 100%)',
    accent: '#d4a82d',
    index: '03',
    href: '/solutions',
    image: '/founder.png',
  },
  {
    role: 'Corporation',
    intent: 'Move ESG and CSR commitments from policy to verified delivery',
    desc: "Your sustainability and social investment commitments are board-level mandates — but finding credible, verified delivery partners at the programme level is still manual and fragmented. Natives gives you a structured directory of verified implementers, filterable by sector, geography, and SDG alignment.",
    bg: 'linear-gradient(135deg, #0d0c1c 0%, #16143a 100%)',
    accent: '#7b6dd4',
    index: '04',
    href: '/solutions',
    image: '/corporates.png',
  },
  {
    role: 'Philanthropic Foundation / VC',
    intent: 'Aggregate credible pipeline and coordinate capital deployment',
    desc: "Portfolio management across Africa's impact sector is still largely relationship-dependent and manually intensive. Natives gives foundations and impact investors a verified deal flow layer — structured org profiles, sector and SDG filters, and coordination infrastructure that reduces due diligence burden.",
    bg: 'linear-gradient(135deg, #071218 0%, #0d2130 100%)',
    accent: '#2d9dd4',
    index: '05',
    href: '/solutions',
    image: '/dfi.png',
  },
  {
    role: 'Research & Academic Institution',
    intent: 'Bridge research outputs to policy, practice, and ecosystem action',
    desc: "Findings without implementation pathways don't move systems. Natives connects research institutions and universities to the NGOs, corporates, and funders who can translate evidence into programme design, policy advocacy, and on-the-ground delivery.",
    bg: 'linear-gradient(135deg, #0a0d18 0%, #121a2d 100%)',
    accent: '#4d8dd4',
    index: '06',
    href: '/solutions',
    image: '/founder.png',
  },
]

const STATS = [
  { value: '92%', label: 'Cite Reputation',     sub: 'Top reason corporates partner with NGOs',       src: 'Cause & Effect 2025', color: '#2db87a' },
  { value: '88%', label: 'Need Funding',         sub: 'Top motivator for nonprofits to partner',       src: 'Cause & Effect 2025', color: '#2d7ad4' },
  { value: '97%', label: 'Deeper Understanding', sub: 'Partnerships improve societal issue knowledge', src: 'Cause & Effect 2025', color: '#a84dd4' },
  { value: '91%', label: 'Mission Alignment',    sub: 'Top factor in partner selection',               src: 'For Momentum 2025',   color: '#c45c26' },
]

const FEATURES = [
  {
    num: '01', title: 'Find the right partners', sub: 'You know what you need. We help you find who.',
    desc: 'Browse and filter verified organisations by sector, country, and focus area. Send an expression of interest directly. No cold outreach, no guessing, no three-month email chains.',
    image: '/partner.png', tint: 'rgba(45,184,122,0.05)', borderTint: 'rgba(45,184,122,0.12)', icon: Users, flip: false,
  },
  {
    num: '02', title: 'Post and discover initiatives', sub: 'Put your work in front of the right people.',
    desc: 'Create an initiative on the marketplace and let funders, implementers, and partners find you — or browse what others are building and express interest in seconds.',
    image: '/workspace.png', tint: 'rgba(45,122,212,0.05)', borderTint: 'rgba(45,122,212,0.12)', icon: Globe, flip: true,
  },
  {
    num: '03', title: 'Build verified trust', sub: "Know who you're working with before you commit.",
    desc: 'Verified organisation badges are earned through document review. Every profile is structured so you can assess fit before the first conversation — removing ambiguity at the top of the funnel.',
    image: '/verified.png', tint: 'rgba(196,92,38,0.05)', borderTint: 'rgba(196,92,38,0.12)', icon: Shield, flip: false,
  },
  {
    num: '04', title: 'Commission an Innovation Lab', sub: "There's a challenge you want solved. We'll convene the room.",
    desc: "Natives Labs bring together the right mix of organisations, expertise, and resources around a specific systemic challenge. You define the problem. We structure the process and manage delivery.",
    image: '/labs.png', tint: 'rgba(168,77,212,0.05)', borderTint: 'rgba(168,77,212,0.12)', icon: FlaskConical, flip: true,
  },
]

const ALIGN = [
  { letter: 'A', word: 'Accountability', desc: 'Verified credentials and transparent track records, not self-reported claims.' },
  { letter: 'L', word: 'Leverage',       desc: 'Coordinating existing capacity rather than duplicating it across the ecosystem.' },
  { letter: 'I', word: 'Intentionality', desc: 'Purpose-driven partnerships that map to real systemic outcomes.' },
  { letter: 'G', word: 'Growth',         desc: "Building platforms that scale with Africa's evolving impact infrastructure." },
  { letter: 'N', word: 'Networks',       desc: 'Prioritising relational capital — the connective tissue that moves ideas into action.' },
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
  const [err, setErr] = useState(false)
  if (err) {
    return (
      <div style={{ ...style, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
        {FallbackIcon && <FallbackIcon style={{ width: '3rem', height: '3rem', opacity: 0.15, color: '#f7f3ed' }} />}
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

  return (
    <div style={{
      padding: 'clamp(1.5rem, 3vw, 2.5rem) clamp(1rem, 2vw, 2rem)',
      textAlign: 'center',
      borderRight: i < STATS.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
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
        <div style={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(247,243,237,0.55)', marginBottom: '0.4rem' }}>
          {stat.label}
        </div>
        <p style={{ fontSize: '0.8125rem', color: 'rgba(247,243,237,0.45)', maxWidth: '160px', margin: '0 auto', lineHeight: 1.55 }}>
          {stat.sub}
        </p>
        <span style={{
          display: 'inline-block', marginTop: '0.75rem',
          padding: '0.2rem 0.75rem', borderRadius: '9999px',
          fontSize: '0.625rem', fontWeight: 600, letterSpacing: '0.06em',
          background: 'rgba(255,252,248,0.06)', border: '1px solid rgba(255,252,248,0.1)',
          color: 'rgba(247,243,237,0.38)',
        }}>
          {stat.src}
        </span>
      </div>
    </div>
  )
}

/* ── FEATURE ROW ───────────────────────────────────────── */
function FeatureRow({ feat, i }: { feat: typeof FEATURES[0]; i: number }) {
  const FeatIcon = feat.icon
  return (
    <div style={{
      background: feat.tint,
      borderBottom: i < FEATURES.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
    }}>
      <div style={{
        maxWidth: '1280px', margin: '0 auto',
        display: 'grid',
        gridTemplateColumns: feat.flip ? 'auto 1fr' : '1fr auto',
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
              color: 'rgba(247,243,237,0.08)', lineHeight: 1,
            }}>{feat.num}</span>
            <div style={{ width: '1.5px', height: '2.25rem', background: feat.borderTint }} />
            <div style={{
              width: '2rem', height: '2rem', borderRadius: '0.5rem',
              background: feat.tint, border: `1px solid ${feat.borderTint}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <FeatIcon style={{ width: '0.875rem', height: '0.875rem', color: 'rgba(247,243,237,0.5)' }} />
            </div>
          </div>
          <h3 style={{
            fontFamily: "'Bricolage Grotesque', sans-serif",
            fontSize: 'clamp(1.25rem, 2.5vw, 1.75rem)', fontWeight: 700,
            letterSpacing: '-0.025em', lineHeight: 1.15, marginBottom: '0.5rem',
            color: '#f7f3ed',
          }}>{feat.title}</h3>
          <p style={{ fontSize: '0.8125rem', fontStyle: 'italic', color: 'rgba(247,243,237,0.38)', marginBottom: '1.125rem', letterSpacing: '0.01em' }}>
            {feat.sub}
          </p>
          <p style={{ fontSize: '1rem', color: 'rgba(247,243,237,0.55)', lineHeight: 1.75, maxWidth: '440px' }}>
            {feat.desc}
          </p>
        </div>
        {/* Image */}
        <div style={{
          order: feat.flip ? 1 : 2,
          borderRadius: '1.25rem', overflow: 'hidden',
          border: `1px solid ${feat.borderTint}`,
          background: feat.tint,
          aspectRatio: '4/3',
          width: 'clamp(220px, 32vw, 460px)',
          flexShrink: 0,
        }}>
          <ImgFallback
            src={feat.image} alt={feat.title}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            FallbackIcon={FeatIcon}
          />
        </div>
      </div>
    </div>
  )
}

/* ── ROLES CAROUSEL ────────────────────────────────────── */
function RolesStack() {
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
            background: item.bg,
            minHeight: 'clamp(360px, 62vh, 520px)',
            display: 'flex', alignItems: 'center',
            padding: 'clamp(2.5rem, 5vw, 5rem) clamp(1.25rem, 3vw, 3rem)',
          }}>
            <div style={{ maxWidth: '1280px', margin: '0 auto', width: '100%' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '3rem', alignItems: 'center' }}>
                <div style={{ maxWidth: '640px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', marginBottom: '1.75rem' }}>
                    <span style={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: item.accent, opacity: 0.8 }}>
                      {item.index}
                    </span>
                    <span style={{ width: '2rem', height: '1px', background: item.accent, opacity: 0.4, display: 'block' }} />
                    <span style={{ fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(247,243,237,0.38)' }}>
                      {item.role}
                    </span>
                  </div>
                  <h3 style={{
                    fontFamily: "'Bricolage Grotesque', sans-serif",
                    fontSize: 'clamp(1.625rem, 3.5vw, 2.625rem)',
                    fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.1,
                    color: '#f7f3ed', marginBottom: '1rem',
                  }}>{item.intent}</h3>
                  <p style={{ fontSize: '1rem', lineHeight: 1.75, color: 'rgba(247,243,237,0.52)', maxWidth: '500px', marginBottom: '2rem' }}>
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
                        border: '1px solid rgba(255,252,248,0.14)',
                        background: 'rgba(255,252,248,0.05)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', color: '#f7f3ed', transition: 'all 0.2s ease',
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
                <div style={{
                  width: 'clamp(160px, 22vw, 300px)', height: 'clamp(160px, 22vw, 300px)',
                  borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
                  border: `2px solid ${item.accent}30`, background: `${item.accent}0e`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <ImgFallback
                    src={item.image} alt={item.role}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    FallbackIcon={Users}
                  />
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
  const videos = ['/hero3.mp4', '/hero1.mp4']
  const [currentVideo, setCurrentVideo] = useState(0)
  const [videoError, setVideoError] = useState(false)
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
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
    const vid = videoRef.current
    if (!vid) return
    vid.muted = true
    vid.playbackRate = 0.45
    vid.load()
    const tryPlay = () => vid.play().catch(() => {})
    if (vid.readyState >= 3) tryPlay()
    else vid.addEventListener('canplay', tryPlay, { once: true })
  }, [currentVideo])

  // Scroll reveal
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

  const S = {
    // shared section padding
    sectionPad: { padding: 'clamp(3.5rem, 7vw, 6rem) 0' } as React.CSSProperties,
    sectionPadSm: { padding: 'clamp(2.5rem, 5vw, 4rem) 0' } as React.CSSProperties,
    contentMax: { maxWidth: '1280px', margin: '0 auto', padding: '0 clamp(1.25rem, 3vw, 3rem)' } as React.CSSProperties,
    sectionLabel: {
      fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.2em',
      textTransform: 'uppercase' as const, color: '#C45C26',
      marginBottom: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.625rem',
    },
    h2: {
      fontFamily: "'Bricolage Grotesque', sans-serif",
      fontSize: 'clamp(1.875rem, 3.5vw, 2.875rem)',
      fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.1,
      color: '#f7f3ed',
    } as React.CSSProperties,
    reveal: {
      opacity: 0,
      transform: 'translateY(24px)',
      transition: 'opacity 0.7s ease, transform 0.7s ease',
    } as React.CSSProperties,
  }

  return (
    <div style={{ background: 'hsl(193,20%,7%)', minHeight: '100vh', color: '#f7f3ed' }}>

      {/* ── HERO ──────────────────────────────────────────── */}
      <section style={{ position: 'relative', minHeight: '100vh', display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
        {/* Glow orbs */}
        <div style={{ position: 'absolute', width: '70vw', height: '70vh', top: '-15%', right: '-10%', background: 'radial-gradient(ellipse, rgba(196,92,38,0.1) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 1 }} />
        <div style={{ position: 'absolute', width: '50vw', height: '50vh', bottom: '0', left: '10%', background: 'radial-gradient(ellipse, rgba(45,184,122,0.05) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 1 }} />

        {/* Background video */}
        <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
          {videoError ? (
            <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #0e0a14 0%, #1a0e0a 40%, #0a0e14 100%)' }} />
          ) : (
            <video
              ref={videoRef}
              key={currentVideo}
              autoPlay muted playsInline
              onEnded={() => setCurrentVideo(v => (v + 1) % videos.length)}
              onError={() => setVideoError(true)}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', filter: 'brightness(0.3) saturate(0.7)' }}
            >
              <source src={videos[currentVideo]} type="video/mp4" />
            </video>
          )}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(9,8,10,0.25) 0%, rgba(9,8,10,0.08) 35%, rgba(9,8,10,0.6) 80%, rgba(9,8,10,1) 100%)' }} />
        </div>

        <div style={{ ...S.contentMax, position: 'relative', zIndex: 10, paddingTop: '6rem', paddingBottom: '6rem', width: '100%' }}>
          {/* Live badge */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginBottom: '2rem', padding: '0.375rem 1rem', borderRadius: '9999px', background: 'rgba(196,92,38,0.1)', border: '1px solid rgba(196,92,38,0.28)', backdropFilter: 'blur(12px)' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#C45C26', display: 'block', animation: 'hp-glowPulse 2s ease-in-out infinite' }} />
            <span style={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#e07a4a' }}>
              Africa's Impact Coordination Platform
            </span>
          </div>

          <h1 style={{
            fontFamily: "'Bricolage Grotesque', sans-serif",
            fontSize: 'clamp(2.75rem, 6.5vw, 5rem)',
            fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1.05,
            maxWidth: '820px', marginBottom: '1.75rem', color: '#f7f3ed',
          }}>
            Africa's impact work is stalling at the{' '}
            <span style={{ background: 'linear-gradient(90deg, #C45C26, #e07a4a, #C45C26)', backgroundSize: '200% auto', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', animation: 'hp-shimmer 3s linear infinite' }}>
              coordination layer.
            </span>
          </h1>

          <p style={{ fontSize: 'clamp(1rem, 2vw, 1.25rem)', lineHeight: 1.72, color: 'rgba(247,243,237,0.65)', maxWidth: '600px', marginBottom: '2.5rem' }}>
            Impact Natives is the platform where NGOs, funders, corporates, and ecosystem builders find each other, verify trust, and form partnerships that move — without the email chains and three-month delays.
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.875rem' }}>
            <Link href="/dashboard/natives">
              <button className="hp-btn-primary">
                Find a Partner
                <ArrowRight style={{ width: '1rem', height: '1rem' }} />
              </button>
            </Link>
            <Link href="/labs">
              <button className="hp-btn-glass">Commission a Lab</button>
            </Link>
          </div>
        </div>

        {/* Scroll indicator */}
        <div style={{ position: 'absolute', bottom: '2.5rem', left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', opacity: 0.3, zIndex: 10 }}>
          <span style={{ fontSize: '0.5625rem', letterSpacing: '0.25em', textTransform: 'uppercase', fontWeight: 700 }}>Scroll</span>
          <div style={{ width: '1px', height: '2.5rem', background: 'linear-gradient(to bottom, #f7f3ed, transparent)' }} />
        </div>
      </section>

      {/* ── PROBLEM ───────────────────────────────────────── */}
      <section className="hp-reveal" style={{ ...S.sectionPad, ...S.reveal, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', width: '500px', height: '500px', top: '-50px', left: '-150px', background: 'radial-gradient(circle, rgba(45,122,212,0.05) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={S.contentMax}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'clamp(2.5rem, 6vw, 6rem)', alignItems: 'center' }}>
            <div>
              <div style={S.sectionLabel}>The Challenge</div>
              <h2 style={{ ...S.h2, marginBottom: '1.5rem' }}>
                Not short of capital or ideas. Short of{' '}
                <em style={{ fontStyle: 'normal', color: '#e07a4a' }}>coordination.</em>
              </h2>
              <p style={{ fontSize: '1.0625rem', lineHeight: 1.75, color: 'rgba(247,243,237,0.55)', marginBottom: '1.25rem' }}>
                The right organisations exist. The funding exists. The intention exists. What breaks down is the match — finding the right partner, knowing they're credible, and moving from interest to action.
              </p>
              <p style={{ fontSize: '1.0625rem', lineHeight: 1.75, color: 'rgba(247,243,237,0.55)', marginBottom: '2.5rem' }}>
                Natives is built to fix that.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {[
                  'No shared standard for who is credible and who is not',
                  'The best implementers are invisible to the funders who need them',
                  'Partnerships stall in inboxes and never become real',
                ].map((point, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', padding: '0.875rem 1.125rem', borderRadius: '0.875rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#C45C26', flexShrink: 0, marginTop: '0.45em' }} />
                    <span style={{ fontSize: '0.9375rem', color: 'rgba(247,243,237,0.6)', lineHeight: 1.6 }}>{point}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ borderRadius: '1.25rem', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)', aspectRatio: '4/3', position: 'relative', background: 'rgba(255,255,255,0.03)' }}>
              <ImgFallback
                src="/homepage1.jpeg" alt="Africa impact coordination"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                FallbackIcon={Network}
              />
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(9,8,10,0.5) 0%, transparent 55%)' }} />
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS ─────────────────────────────────────────── */}
      <section style={{ ...S.sectionPad, position: 'relative', borderTop: '1px solid rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', width: '60vw', height: '50vh', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: 'radial-gradient(ellipse, rgba(196,92,38,0.07) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div ref={statsRef} style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ ...S.contentMax, textAlign: 'center', marginBottom: '3.5rem' }}>
            <div style={{ ...S.sectionLabel, justifyContent: 'center' }}>
              <span style={{ width: '1.5rem', height: '1.5px', background: '#C45C26', display: 'block' }} />
              The ROI Case
              <span style={{ width: '1.5rem', height: '1.5px', background: '#C45C26', display: 'block' }} />
            </div>
            <h2 style={{ ...S.h2, marginBottom: '0.75rem' }}>Why unified partnership management matters</h2>
            <p style={{ color: 'rgba(247,243,237,0.45)', fontSize: '1rem', maxWidth: '500px', margin: '0 auto', lineHeight: 1.65 }}>
              Across NGOs, founders, government, DFIs, and corporate partners
            </p>
          </div>
          <div style={S.contentMax}>
            <div style={{ borderRadius: '1.25rem', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(14,12,16,0.65)', backdropFilter: 'blur(32px)', overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)' }}>
                {STATS.map((stat, i) => <StatCell key={i} stat={stat} i={i} isVisible={statsVisible} />)}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURES ──────────────────────────────────────── */}
      <section style={S.sectionPad}>
        <div className="hp-reveal" style={{ ...S.contentMax, ...S.reveal, marginBottom: '3.5rem' }}>
          <div style={S.sectionLabel}>Platform Features</div>
          <h2 style={S.h2}>How Natives helps you</h2>
        </div>
        <div style={{ border: '1px solid rgba(255,255,255,0.06)', borderRadius: '1.25rem', overflow: 'hidden' }}>
          {FEATURES.map((feat, i) => <FeatureRow key={i} feat={feat} i={i} />)}
        </div>
      </section>

      {/* ── WHO IT'S FOR ──────────────────────────────────── */}
      <section style={{ borderTop: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden' }}>
        <div className="hp-reveal" style={{ ...S.contentMax, ...S.reveal, paddingTop: '5rem', paddingBottom: '2.5rem' }}>
          <div style={S.sectionLabel}>Built For</div>
          <h2 style={S.h2}>Who it's for</h2>
        </div>
        <RolesStack />
      </section>

      {/* ── ABOUT ─────────────────────────────────────────── */}
      <section className="hp-reveal" style={{ ...S.sectionPad, ...S.reveal, borderTop: '1px solid rgba(255,255,255,0.06)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', width: '500px', height: '500px', top: '-80px', right: '-80px', background: 'radial-gradient(circle, rgba(196,92,38,0.07) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={S.contentMax}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'clamp(2.5rem, 6vw, 6rem)', alignItems: 'center' }}>
            <div>
              <div style={S.sectionLabel}>About Us</div>
              <h2 style={{ ...S.h2, marginBottom: '1.5rem' }}>We build infrastructure for people doing serious work.</h2>
              <p style={{ fontSize: '1.0625rem', lineHeight: 1.75, color: 'rgba(247,243,237,0.55)', marginBottom: '1.25rem' }}>
                Impact Natives was built by practitioners who spent years watching good work fail at the coordination layer — the moment between intention and execution where partnerships stall, funding misses its mark, and implementers go unseen.
              </p>
              <p style={{ fontSize: '1.0625rem', lineHeight: 1.75, color: 'rgba(247,243,237,0.55)', marginBottom: '1.25rem' }}>
                We build the infrastructure that makes coordination reliable: verified profiles, structured partnerships, and a platform where the right organisations can find each other and move.
              </p>
              <p style={{ fontSize: '1.0625rem', lineHeight: 1.75, color: 'rgba(247,243,237,0.55)', marginBottom: '2.5rem' }}>
                Based in Lagos, Nigeria. Working across Africa.
              </p>
              <Link href="/about">
                <button className="hp-btn-outline">
                  Learn more about us
                  <ArrowRight style={{ width: '0.875rem', height: '0.875rem' }} />
                </button>
              </Link>
            </div>
            <div style={{ borderRadius: '1.25rem', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(20px)', aspectRatio: '4/3', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ width: '4.5rem', height: '4.5rem', borderRadius: '50%', background: 'rgba(196,92,38,0.1)', border: '1px solid rgba(196,92,38,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Network style={{ width: '2rem', height: '2rem', color: '#C45C26' }} />
              </div>
              <p style={{ fontSize: '0.75rem', color: 'rgba(247,243,237,0.25)', letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 600 }}>Team Image</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── ALIGN ─────────────────────────────────────────── */}
      <section className="hp-reveal" style={{ ...S.sectionPad, ...S.reveal, borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)', position: 'relative', overflow: 'hidden' }}>
        <div style={S.contentMax}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'clamp(3rem, 6vw, 7rem)', alignItems: 'start' }}>
            <div style={{ position: 'sticky', top: '6rem' }}>
              <div style={S.sectionLabel}>Our Framework</div>
              <h2 style={{ ...S.h2, marginBottom: '1.5rem' }}>Rooted in the ALIGN principles.</h2>
              <p style={{ fontSize: '1.0625rem', lineHeight: 1.75, color: 'rgba(247,243,237,0.55)', marginBottom: '2rem' }}>
                ALIGN guides how Natives approaches coordination, verification, and ecosystem infrastructure — what it takes to build trust and move capital effectively across Africa's impact sector.
              </p>
              <Link href="/about">
                <button className="hp-btn-outline">
                  Read about ALIGN
                  <ArrowRight style={{ width: '0.875rem', height: '0.875rem' }} />
                </button>
              </Link>
            </div>
            <div style={{ borderRadius: '1.25rem', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.07)' }}>
              {ALIGN.map((item, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'flex-start', gap: '1.25rem',
                  padding: '1.375rem 1.75rem',
                  background: i % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'transparent',
                  borderBottom: i < ALIGN.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                }}>
                  <div style={{
                    width: '2.375rem', height: '2.375rem', borderRadius: '0.625rem',
                    background: 'rgba(196,92,38,0.1)', border: '1px solid rgba(196,92,38,0.22)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    fontFamily: "'Bricolage Grotesque', sans-serif",
                    fontWeight: 800, fontSize: '0.9375rem', color: '#C45C26',
                  }}>
                    {item.letter}
                  </div>
                  <div>
                    <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 700, fontSize: '1rem', marginBottom: '0.3rem', letterSpacing: '-0.015em', color: '#f7f3ed' }}>
                      {item.word}
                    </div>
                    <p style={{ fontSize: '0.9rem', color: 'rgba(247,243,237,0.5)', lineHeight: 1.65 }}>{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── THREE PATHS ───────────────────────────────────── */}
      <section className="hp-reveal" style={{ ...S.sectionPad, ...S.reveal, borderTop: '1px solid rgba(255,255,255,0.06)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', width: '700px', height: '700px', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: 'radial-gradient(ellipse, rgba(196,92,38,0.05) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ ...S.contentMax, position: 'relative', zIndex: 1 }}>
          <div style={{ marginBottom: '3.5rem' }}>
            <div style={S.sectionLabel}>Choose Your Path</div>
            <h2 style={{ ...S.h2, marginBottom: '0.875rem' }}>What would you like to do?</h2>
            <p style={{ fontSize: '1.0625rem', color: 'rgba(247,243,237,0.5)', maxWidth: '520px', lineHeight: 1.65 }}>
              Natives serves three distinct purposes. Choose the one that fits your intent.
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.25rem' }}>
            {[
              {
                icon: Network, title: 'Connect with Partners',
                desc: 'Search and connect with verified NGOs, funders, founders, corporates, and implementers. Filter by sector, country, and SDG alignment.',
                points: ['NGO to funder matching', 'Founder to pilot partner', 'Corporate to implementer'],
                href: '/dashboard/natives', cta: 'Get Matched', featured: true,
              },
              {
                icon: FlaskConical, title: 'Commission an Innovation Lab',
                desc: "Natives convenes and structures stakeholders around a specific systemic challenge. A managed coordination process, not a self-service product.",
                points: ['Multi-stakeholder coordination', 'Sector-specific labs', 'Outcome-driven design'],
                href: '/labs', cta: 'Submit Lab Proposal', featured: false,
              },
              {
                icon: Handshake, title: 'Create an Initiative',
                desc: "Post your initiative to the marketplace and connect with the funders, implementers, and partners already looking for what you're building.",
                points: ['Marketplace visibility', 'Direct expressions of interest', 'Confirmed partnership tracking'],
                href: '/dashboard/marketplace', cta: 'Create Initiative', featured: false,
              },
            ].map((item, i) => (
              <div key={i} style={{
                display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                padding: '2rem',
                borderRadius: '1.25rem',
                border: item.featured ? '1px solid rgba(196,92,38,0.3)' : '1px solid rgba(255,255,255,0.07)',
                background: item.featured ? 'rgba(196,92,38,0.07)' : 'rgba(255,255,255,0.02)',
                transition: 'border-color 0.2s ease, background 0.2s ease',
              }}>
                <div>
                  <div style={{ width: '2.75rem', height: '2.75rem', borderRadius: '0.75rem', background: item.featured ? 'rgba(196,92,38,0.15)' : 'rgba(255,255,255,0.05)', border: `1px solid ${item.featured ? 'rgba(196,92,38,0.3)' : 'rgba(255,255,255,0.08)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem' }}>
                    <item.icon style={{ width: '1.125rem', height: '1.125rem', color: item.featured ? '#C45C26' : 'rgba(247,243,237,0.4)' }} />
                  </div>
                  <h3 style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: '1.125rem', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: '0.75rem', color: '#f7f3ed' }}>{item.title}</h3>
                  <p style={{ fontSize: '0.9375rem', color: 'rgba(247,243,237,0.5)', lineHeight: 1.65, marginBottom: '1.5rem' }}>{item.desc}</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '2rem' }}>
                    {item.points.map((pt, j) => (
                      <div key={j} style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', fontSize: '0.875rem', color: 'rgba(247,243,237,0.45)' }}>
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
      <section className="hp-reveal" style={{ ...S.sectionPad, ...S.reveal, borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
        <div style={S.contentMax}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 'clamp(3rem, 6vw, 6rem)', alignItems: 'start' }}>
            <div style={{ position: 'sticky', top: '6rem' }}>
              <div style={S.sectionLabel}>FAQ</div>
              <h2 style={{ ...S.h2, marginBottom: '1rem' }}>Common questions</h2>
              <p style={{ fontSize: '1.0625rem', color: 'rgba(247,243,237,0.5)', lineHeight: 1.7, marginBottom: '2rem' }}>
                A few things people ask before joining. The full FAQ has more.
              </p>
              <Link href="/faq">
                <button className="hp-btn-outline">
                  View all questions
                  <ArrowRight style={{ width: '0.875rem', height: '0.875rem' }} />
                </button>
              </Link>
            </div>
            <div style={{ borderRadius: '1.25rem', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.07)' }}>
              {FAQS.map((faq, i) => (
                <div key={i} style={{ borderBottom: i < FAQS.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
                  <button
                    type="button"
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      gap: '1rem', padding: '1.25rem 1.625rem',
                      background: openFaq === i ? 'rgba(255,255,255,0.03)' : 'transparent',
                      border: 'none', cursor: 'pointer', color: '#f7f3ed', textAlign: 'left',
                      transition: 'background 0.2s ease',
                    }}
                  >
                    <span style={{ fontWeight: 600, fontSize: '0.9375rem', lineHeight: 1.5, flex: 1 }}>
                      {faq.q}
                    </span>
                    <ChevronDown style={{ width: '1.125rem', height: '1.125rem', flexShrink: 0, color: 'rgba(247,243,237,0.4)', transform: openFaq === i ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s ease' }} />
                  </button>
                  <div style={{
                    maxHeight: openFaq === i ? '400px' : '0',
                    overflow: 'hidden',
                    transition: 'max-height 0.35s ease',
                  }}>
                    <p style={{ padding: '0 1.625rem 1.25rem', fontSize: '0.9375rem', color: 'rgba(247,243,237,0.5)', lineHeight: 1.72 }}>
                      {faq.a}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────── */}
      <section className="hp-reveal" style={{ ...S.sectionPadSm, ...S.reveal, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ ...S.contentMax, textAlign: 'center' }}>
          <h2 style={{ ...S.h2, fontSize: 'clamp(1.5rem, 3vw, 2.25rem)', marginBottom: '0.875rem' }}>
            Not sure where to start?
          </h2>
          <p style={{ color: 'rgba(247,243,237,0.5)', fontSize: '1.0625rem', lineHeight: 1.65, maxWidth: '460px', margin: '0 auto 2.5rem' }}>
            Tell us what you're trying to do and we'll route you to the right place.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0.875rem' }}>
            <Link href="/dashboard/natives"><button className="hp-btn-glass">I want to find partners</button></Link>
            <Link href="/labs"><button className="hp-btn-glass">I want to solve a complex challenge</button></Link>
            <Link href="/dashboard/marketplace"><button className="hp-btn-glass">I want to post an initiative</button></Link>
            <Link href="/signup"><button className="hp-btn-primary">Get started <ArrowRight style={{ width: '0.875rem', height: '0.875rem' }} /></button></Link>
          </div>
        </div>
      </section>

      {/* ── NEWSLETTER ────────────────────────────────────── */}
      <NewsletterSignup variant="section" />

      {/* ── FINAL CTA ─────────────────────────────────────── */}
      <section style={{ ...S.sectionPad, borderTop: '1px solid rgba(255,255,255,0.06)', position: 'relative', overflow: 'hidden', textAlign: 'center' }}>
        <div style={{ position: 'absolute', width: '80vw', height: '60vh', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: 'radial-gradient(ellipse, rgba(196,92,38,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ ...S.contentMax, position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', padding: '0.375rem 1rem', borderRadius: '9999px', background: 'rgba(196,92,38,0.08)', border: '1px solid rgba(196,92,38,0.2)' }}>
            <Zap style={{ width: '0.75rem', height: '0.75rem', color: '#C45C26' }} />
            <span style={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#e07a4a' }}>
              Early Access
            </span>
          </div>
          <h2 style={{ ...S.h2, fontSize: 'clamp(1.875rem, 4vw, 3rem)', maxWidth: '700px', margin: '0 auto 1.25rem' }}>
            The infrastructure is being built now.
          </h2>
          <p style={{ fontSize: '1.125rem', color: 'rgba(247,243,237,0.5)', maxWidth: '500px', margin: '0 auto 3rem', lineHeight: 1.7 }}>
            Join the organisations already on Natives and be part of how Africa's impact sector coordinates next.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '1rem' }}>
            <Link href="/signup">
              <button className="hp-btn-primary" style={{ padding: '0 2rem', height: '3rem', fontSize: '1rem' }}>
                Join Impact Natives
                <ArrowRight style={{ width: '1rem', height: '1rem' }} />
              </button>
            </Link>
            <Link href="/partner">
              <button className="hp-btn-glass" style={{ padding: '0 2rem', height: '3rem', fontSize: '1rem' }}>
                Partner with us
              </button>
            </Link>
          </div>
        </div>
      </section>

    </div>
  )
}
