"use client"

import { useState, useEffect, useRef } from "react"
import {
  Bot, Calendar, MessageSquare, Link2, Shield,
  RefreshCw, Check, Star, ArrowRight,
  ChevronDown, X, Menu, Zap, Clock, TrendingUp, Users,
  PhoneCall, Mic,
} from "lucide-react"
import { WebGLShader } from "@/components/ui/web-gl-shader"
import { LiquidButton } from "@/components/ui/liquid-glass-button"

// ─── Data ────────────────────────────────────────────────────────────────────

const HERO_PHRASES = [
  "Marketing that converts.",
  "Leads that close.",
  "Automation that works.",
  "Ads that pay off.",
]

const INTEGRATION_LOGOS = [
  "GoHighLevel","Google Ads","Meta Ads","Google Business","Jobber",
  "Stripe","Zapier","Twilio","OpenAI","Calendly","Google Analytics","Mailgun",
]

const INDUSTRY_DETAILS: Record<string, { headline: string; body: string; tags: string[] }> = {
  "HVAC":        { headline: "Fill your HVAC calendar year-round",         body: "Emergency calls don't wait for business hours. We put you at the top of local search, run seasonal Google Ads, and have Aria book service appointments at 2 AM when the AC breaks down.",              tags: ["Emergency call routing","Seasonal ads","Review automation"] },
  "Plumbing":    { headline: "Book more plumbing jobs, miss fewer leads",   body: "Most plumbing jobs go to whoever answers first. We make sure that's you — with a fast-loading site, targeted ads, and Aria booking the job while you're on the last one.",                         tags: ["Missed-call text-back","Google Ads","24/7 booking"] },
  "Dental":      { headline: "Grow your patient list on autopilot",         body: "We build your practice website, run new-patient Google Ads, and automate appointment reminders so your chair stays full and no-shows stop draining revenue.",                                       tags: ["New patient ads","Appointment reminders","Review requests"] },
  "Roofing":     { headline: "Storm season or slow season — stay booked",   body: "We keep your pipeline full with storm-targeted ads, a conversion-ready site, and automated follow-up that turns estimates into signed contracts before you leave the driveway.",                    tags: ["Storm targeting","Estimate follow-up","Lead automation"] },
  "Electrical":  { headline: "Be the electrician homeowners find first",    body: "Panel upgrades, emergency calls, EV charger installs — we put your electrical business in front of local homeowners at the exact moment they need help, and Aria books the job.",                  tags: ["Local SEO","Google Ads","AI receptionist"] },
  "Lawn Care":   { headline: "Build a recurring lawn care client base",     body: "We build your seasonal marketing engine — Google Ads for peak months, automated follow-ups for recurring clients, and a website that books estimates while your crew is in the field.",             tags: ["Seasonal campaigns","Recurring billing","Lead nurture"] },
  "Windows":     { headline: "Turn window shoppers into signed projects",   body: "Window replacement is a big decision. We build trust with a premium website, run targeted ads to homeowners ready to buy, and automate follow-up so no estimate goes cold.",                      tags: ["High-intent ads","Estimate follow-up","Trust-building site"] },
  "Cleaning":    { headline: "Scale your cleaning business with recurring clients", body: "One-time jobs are fine — recurring contracts are the goal. We build your brand, run ads that attract loyal clients, and automate the upsell from single clean to weekly service.",       tags: ["Recurring upsell","Google & Meta Ads","Review automation"] },
  "Med Spa":     { headline: "Fill your treatment calendar every week",     body: "Med spa clients research before they book. We build a premium site that builds instant trust, run Instagram and Google ads, and automate reminder sequences that keep your chairs full.",          tags: ["Instagram ads","Appointment reminders","Premium branding"] },
  "Pet Care":    { headline: "More bookings for boarding, grooming & training", body: "Pet owners are loyal when they trust you. We build your brand, run local ads, and set up automated follow-ups that turn a first grooming into a lifetime client.",                           tags: ["Loyalty automation","Local ads","Review requests"] },
  "Auto Repair": { headline: "Get more cars in your bays",                  body: "Car trouble is urgent — and customers go with whoever shows up first in search. We make sure that's your shop, with a fast site, local ads, and Aria booking while you're under the hood.",      tags: ["Emergency search ads","Missed-call text-back","Google Maps"] },
  "Healthcare":  { headline: "Grow your practice with consistent new patients", body: "Patients research online before they call. We build a compliant, conversion-ready website, run targeted ads, and automate follow-up reminders to reduce no-shows and grow your caseload.",   tags: ["HIPAA-aware setup","New patient ads","Appointment automation"] },
}


const FAQS = [
  { q: "What exactly do you build for me?",                            a: "Depending on your plan, we build and manage: a high-converting website, Google & Meta ad campaigns, a CRM & pipeline, automated SMS/email follow-up sequences, missed-call text-back, review request automation, and an AI receptionist. You don't need to hire a web developer, ad agency, or automation consultant separately." },
  { q: "How fast can you get my system live?",                         a: "Most clients are fully live within 48 hours of their strategy call. We handle all the setup, copywriting, design, and integration. You review and approve — we do the rest." },
  { q: "Do I need any technical skills?",                              a: "None at all. We build everything for you and manage it on an ongoing basis. You'll get a simple dashboard to see your results, but there's nothing to configure or maintain on your end." },
  { q: "How does paid ads management work?",                           a: "We write the ad copy, design the creatives, set the targeting, and manage your budget on Google and Meta. Every week we review performance and optimize. You only pay for the ad spend itself — our management fee is included in your plan." },
  { q: "What is missed-call text-back and why does it matter?",        a: "The moment a call goes unanswered — whether you're on a job or it's 11 PM — an automated text fires to the caller within seconds. It keeps the lead warm and routes them toward booking before they call your competitor. Most clients recover 3–5 jobs per month from this alone." },
  { q: "Is there a contract or setup fee?",                            a: "No setup fees and no long-term contracts. The Foundation plan is month-to-month. Booked Jobs and Growth System are custom engagements — we'll work out the right terms on your strategy call." },
  { q: "Do you work with businesses that already have a website?",     a: "Yes. If your existing website converts well, we'll keep it and focus on ads and automation. If it's hurting your conversion rate, we'll rebuild it. Either way, we audit everything before making recommendations." },
  { q: "What does 'custom pricing' actually mean?",                    a: "Custom pricing means we scope the project based on your market, ad budget, and goals — not a one-size-fits-all number. The Booked Jobs plan typically runs $600–$1,800/mo depending on your ad spend and market size. The Growth System, which adds the AI receptionist and advanced automations, typically runs $1,500–$3,500/mo. We'll give you an exact number on the strategy call — no vague proposals, no surprises." },
  { q: "What areas or industries do you work in?",                     a: "We work with local service businesses across the US — HVAC, plumbing, electrical, roofing, dental, med spa, cleaning, lawn care, auto repair, pet care, and more. If you're a service business that books jobs or appointments, we can build your system. Geography isn't a barrier — we work remotely with businesses nationwide." },
  { q: "What happens if I'm not happy with the results?",              a: "We stand behind the work. If your website and system aren't live within 48 hours as promised, you don't owe us for that period. For ongoing management, you're never locked in — if you feel the system isn't delivering, you can cancel with 30 days' notice. Our goal is to be the easiest vendor you've ever worked with." },
]

// Live call transcript lines — simulates an actual AI call
const CALL_LINES = [
  { role: "ai",       text: "Thanks for calling Riverside Electric, this is Aria! How can I help you today?" },
  { role: "caller",   text: "Hey, my power's been flickering all morning — pretty sure something's wrong with my panel." },
  { role: "ai",       text: "That definitely sounds like something we should get looked at quickly. Can I grab your name and address?" },
  { role: "caller",   text: "Sure — Tom Bennett, 217 Cedar Ridge Lane." },
  { role: "ai",       text: "Got it, Tom. We have a tech available this afternoon at 1:00 PM or 3:30 PM. Which works better?" },
  { role: "caller",   text: "1 PM works perfectly." },
  { role: "ai",       text: "Perfect! You're booked for 1:00 PM today. I'll send a confirmation text in just a moment. Anything else I can help with?" },
  { role: "caller",   text: "No, that's everything — thanks!" },
  { role: "ai",       text: "You're all set, Tom! We'll see you at 1 PM. Have a great day!" },
]

// ─── Page ────────────────────────────────────────────────────────────────────

export default function Page() {
  const [scrolled, setScrolled]           = useState(false)
  const [mobileOpen, setMobileOpen]       = useState(false)
  const [openFaq, setOpenFaq]             = useState<number | null>(null)
  const [callLine, setCallLine]           = useState(0)
  const [callStarted, setCallStarted]     = useState(false)
  const [mousePos, setMousePos]           = useState({ x: -999, y: -999 })
  const [heroPhrase, setHeroPhrase]       = useState(0)
  const [phraseVisible, setPhraseVisible] = useState(true)
  const [selectedIndustry, setSelectedIndustry] = useState<string | null>(null)
  const fuRefs = useRef<(HTMLElement | null)[]>([])

  useEffect(() => {
    const fn = (e: MouseEvent) => setMousePos({ x: e.clientX, y: e.clientY })
    window.addEventListener("mousemove", fn, { passive: true })
    return () => window.removeEventListener("mousemove", fn)
  }, [])

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 50)
    window.addEventListener("scroll", fn, { passive: true })
    return () => window.removeEventListener("scroll", fn)
  }, [])

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add("fu-vis"); obs.unobserve(e.target) }
      }),
      { threshold: 0.07 }
    )
    fuRefs.current.forEach((el) => el && obs.observe(el))
    return () => obs.disconnect()
  }, [])

  // Auto-play call animation
  useEffect(() => {
    const timer = setTimeout(() => setCallStarted(true), 1200)
    return () => clearTimeout(timer)
  }, [])

  // Rotate hero phrase
  useEffect(() => {
    const interval = setInterval(() => {
      setPhraseVisible(false)
      setTimeout(() => {
        setHeroPhrase((n) => (n + 1) % HERO_PHRASES.length)
        setPhraseVisible(true)
      }, 350)
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!callStarted) return
    if (callLine >= CALL_LINES.length) return
    const delay = callLine === 0 ? 400 : CALL_LINES[callLine - 1].text.length * 28 + 900
    const t = setTimeout(() => setCallLine((n) => n + 1), delay)
    return () => clearTimeout(t)
  }, [callLine, callStarted])

  function ref(i: number) {
    return (el: HTMLElement | null) => { fuRefs.current[i] = el }
  }

  return (
    <div style={{ fontFamily: "var(--font-dm-sans), system-ui, sans-serif" }}
         className="min-h-screen bg-[#080808] text-[#F0EFE8] overflow-x-hidden">
      <style>{`
        .fu { opacity:0; transform:translateY(22px); transition:opacity .65s cubic-bezier(.4,0,.2,1), transform .65s cubic-bezier(.4,0,.2,1); }
        .fu-vis { opacity:1; transform:translateY(0); }
        @media(prefers-reduced-motion:reduce){ .fu{opacity:1!important;transform:none!important} *{animation-duration:.01ms!important;transition-duration:.01ms!important} }
        html { scroll-behavior:smooth; }
        .gold { background:linear-gradient(135deg,#8B5CF6,#C4B5FD,#8B5CF6); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
        .gold-rev { background:linear-gradient(135deg,#C4B5FD,#8B5CF6); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; }
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-7px)} }
        @keyframes shimmer { 0%{background-position:200% center} 100%{background-position:-200% center} }
        @keyframes typein { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        .shimmer { background:linear-gradient(90deg,transparent,rgba(139,92,246,0.5),transparent); background-size:200% 100%; animation:shimmer 3s ease-in-out infinite; }
        .grain::after { content:''; position:fixed; inset:0; pointer-events:none; z-index:999; background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.035'/%3E%3C/svg%3E"); opacity:.55; }
        .call-line { animation: typein .4s ease both; }
        .cursor { display:inline-block; animation:blink 1s step-end infinite; }
        @keyframes marquee { from{transform:translateX(0)} to{transform:translateX(-50%)} }
        .marquee-track { display:flex; animation:marquee 28s linear infinite; }
        .marquee-track:hover { animation-play-state:paused; }
        .phrase-in { animation:typein .35s ease both; display:inline-block; }
        .phrase-out { opacity:0; transition:opacity .3s ease; display:inline-block; }
      `}</style>

      <div className="grain" />

      {/* ── CURSOR SPOTLIGHT ─────────────────────────────────────── */}
      <div
        className="pointer-events-none fixed inset-0 z-40 hidden md:block"
        style={{
          background: `radial-gradient(280px circle at ${mousePos.x}px ${mousePos.y}px, rgba(139,92,246,0.13), transparent 70%)`,
        }}
      />

      {/* ── NAVBAR ────────────────────────────────────────────────── */}
      <nav className={`fixed inset-x-0 top-0 z-50 transition-all duration-500 ${
        scrolled ? "bg-[#080808]/96 backdrop-blur-2xl border-b border-[rgba(139,92,246,0.09)] py-3.5" : "py-6"
      }`}>
        <div className="mx-auto max-w-[1200px] px-8 flex items-center">
          <a href="#" className="mr-auto font-[family-name:var(--font-playfair)] font-bold text-xl tracking-wide gold">
            Scalero
          </a>
          <ul className="hidden md:flex gap-8 list-none mr-8">
            {[["Features","#features"],["How It Works","#how-it-works"],["Industries","#industries"],["Pricing","#pricing"],["FAQ","#faq"]].map(([l,h]) => (
              <li key={l}>
                <a href={h} className="text-[#8A8880] text-[0.82rem] font-medium tracking-wide hover:text-[#F0EFE8] transition-colors duration-300">{l}</a>
              </li>
            ))}
          </ul>
          <div className="hidden md:flex items-center gap-3">
            <a href="#book">
              <LiquidButton size="sm" className="text-white font-semibold border-0 rounded-full text-[0.82rem] tracking-wide"
                style={{ background: "linear-gradient(135deg,#8B5CF6,#7C3AED)" }}>
                Get Free Estimate <ArrowRight className="w-3.5 h-3.5 inline ml-1" />
              </LiquidButton>
            </a>
          </div>
          <button className="md:hidden p-2 text-[#8A8880]" onClick={() => setMobileOpen(true)} aria-label="Menu">
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </nav>

      {/* ── MOBILE MENU ────────────────────────────────────────── */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-[#080808] z-[999] flex flex-col items-center justify-center gap-10">
          <button className="absolute top-6 right-6 text-[#8A8880]" onClick={() => setMobileOpen(false)}><X className="w-5 h-5" /></button>
          {[["Features","#features"],["How It Works","#how-it-works"],["Industries","#industries"],["Pricing","#pricing"],["FAQ","#faq"]].map(([l,h]) => (
            <a key={l} href={h} onClick={() => setMobileOpen(false)}
               className="font-[family-name:var(--font-playfair)] text-2xl font-bold text-[#F0EFE8] hover:text-[#8B5CF6] transition-colors">{l}</a>
          ))}
        </div>
      )}

      {/* ── HERO ──────────────────────────────────────────────── */}
      <section className="relative min-h-[100dvh] flex items-center pt-32 pb-24 overflow-hidden">
        <WebGLShader className="absolute inset-0 w-full h-full block opacity-[0.10]" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#080808]/65 via-[#080808]/20 to-[#080808] pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#080808]/55 via-transparent to-[#080808]/55 pointer-events-none" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] pointer-events-none"
          style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(139,92,246,0.07) 0%, transparent 70%)" }} />

        <div className="relative z-10 mx-auto max-w-[1200px] px-8 w-full">
          <div className="grid lg:grid-cols-2 gap-16 items-center">

            {/* Left */}
            <div ref={ref(0)} className="fu">
              <div className="inline-flex items-center gap-2.5 mb-8 px-4 py-1.5 rounded-full border border-[rgba(139,92,246,0.20)] bg-[rgba(139,92,246,0.04)]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#8B5CF6] animate-pulse" />
                <span className="text-[#8B5CF6] text-[0.7rem] font-medium tracking-[0.18em] uppercase">Web Design · Marketing · Automation · AI</span>
              </div>

              <h1 className="font-[family-name:var(--font-playfair)] font-bold text-[clamp(2.8rem,5.5vw,5rem)] text-[#F0EFE8] leading-[1.06] tracking-tight mb-6">
                Websites that wow.<br />
                <span className="block relative" style={{ height: "1.15em" }}>
                  <em className={`not-italic gold absolute left-0 top-0 whitespace-nowrap ${phraseVisible ? "phrase-in" : "phrase-out"}`}>
                    {HERO_PHRASES[heroPhrase]}
                  </em>
                </span>
              </h1>

              <div className="w-16 h-px shimmer mb-7" />

              <p className="text-[#8A8880] text-lg leading-[1.9] mb-4 max-w-[440px] font-light">
                We build premium 3D websites, run your ads, and automate your entire customer journey — so local service businesses stand out online and wake up to a full schedule.
              </p>

              {/* Micro-stats row */}
              <div className="flex gap-6 mb-10">
                {[["3D","immersive web design"],["<48hrs","fully live & running"],["24/7","automated lead capture"]].map(([v,l]) => (
                  <div key={l} className="flex flex-col">
                    <span className="font-[family-name:var(--font-playfair)] text-xl font-bold gold leading-none">{v}</span>
                    <span className="text-[0.68rem] text-[#3A3A38] mt-1 tracking-wide uppercase">{l}</span>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-3 mb-10">
                <a href="#book">
                  <LiquidButton size="xl"
                    className="text-white font-semibold border-0 rounded-full tracking-wide"
                    style={{ background: "linear-gradient(135deg,#8B5CF6,#7C3AED)", boxShadow: "0 8px 32px rgba(139,92,246,0.35)" }}>
                    Get Free Estimate <ArrowRight className="w-4 h-4 inline ml-1.5" />
                  </LiquidButton>
                </a>
                <a href="#how-it-works" className="inline-flex items-center px-7 h-12 rounded-full text-sm font-medium text-[#8A8880] border border-[rgba(255,255,255,0.08)] hover:border-[rgba(139,92,246,0.20)] hover:text-[#F0EFE8] transition-all duration-300 gap-2 tracking-wide">
                  <Zap className="w-3.5 h-3.5" /> See How It Works
                </a>
              </div>

              <div className="flex items-center gap-3">
                <p className="text-[#8A8880] text-xs tracking-wide">
                  Built for local service businesses · <span className="text-[#8B5CF6] font-medium">No engineering team needed</span>
                </p>
              </div>
            </div>

            {/* Right — Live Call Demo Preview */}
            <div ref={ref(1)} className="fu hidden lg:block" style={{ transitionDelay: "200ms" }}>
              <div className="relative">
                {/* Float badges */}
                <div className="absolute -top-5 -left-8 z-20 bg-[#0D0D0D]/98 border border-[rgba(139,92,246,0.18)] rounded-2xl px-4 py-2.5 text-xs font-medium flex items-center gap-2 shadow-2xl backdrop-blur-2xl" style={{ animation: "float 5s ease-in-out infinite" }}>
                  <span className="w-1.5 h-1.5 rounded-full bg-[#22c840] animate-pulse" />
                  <span className="text-[#F0EFE8]">AI Answering Now</span>
                </div>
                <div className="absolute bottom-10 -right-6 z-20 bg-[#0D0D0D]/98 border border-[rgba(139,92,246,0.18)] rounded-2xl px-4 py-2.5 text-xs font-medium flex items-center gap-2.5 shadow-2xl backdrop-blur-2xl" style={{ animation: "float 5s ease-in-out 1s infinite" }}>
                  <Check className="w-3.5 h-3.5 text-[#8B5CF6]" />
                  <span className="text-[#F0EFE8]">Appointment Booked</span>
                </div>

                {/* Call transcript card */}
                <div className="bg-[#0D0D0D]/96 border border-[rgba(139,92,246,0.15)] rounded-3xl overflow-hidden shadow-[0_40px_100px_rgba(0,0,0,0.8)] backdrop-blur-xl">
                  {/* Card header */}
                  <div className="flex items-center gap-3 px-5 py-4 border-b border-[rgba(139,92,246,0.08)]"
                       style={{ background: "rgba(139,92,246,0.03)" }}>
                    <div className="flex gap-1.5">
                      <i className="w-2.5 h-2.5 rounded-full bg-[#ff5f57] not-italic" />
                      <i className="w-2.5 h-2.5 rounded-full bg-[#febc2e] not-italic" />
                      <i className="w-2.5 h-2.5 rounded-full bg-[#28c840] not-italic" />
                    </div>
                    <div className="flex items-center gap-2 ml-1">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: "linear-gradient(135deg,#8B5CF6,#7C3AED)" }}>
                        <Mic className="w-3.5 h-3.5 text-white" />
                      </div>
                      <div>
                        <div className="text-[0.72rem] font-semibold text-[#F0EFE8] tracking-wide">Aria — AI Receptionist</div>
                        <div className="text-[0.6rem] text-[#8A8880]">Riverside Electric · Live Call</div>
                      </div>
                    </div>
                    <span className="ml-auto flex items-center gap-1.5 text-[0.62rem] font-semibold text-[#22c840] bg-[#22c840]/10 px-2.5 py-1 rounded-full border border-[#22c840]/20">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#22c840] animate-pulse" />LIVE
                    </span>
                  </div>

                  {/* Transcript */}
                  <div className="px-5 py-5 flex flex-col gap-3 min-h-[320px]">
                    {CALL_LINES.slice(0, callLine).map((line, i) => (
                      <div key={i} className={`call-line flex gap-2.5 ${line.role === "ai" ? "" : "flex-row-reverse"}`}>
                        <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                             style={{ background: line.role === "ai" ? "linear-gradient(135deg,#8B5CF6,#7C3AED)" : "rgba(255,255,255,0.08)" }}>
                          {line.role === "ai"
                            ? <Bot className="w-3 h-3 text-white" />
                            : <Users className="w-3 h-3 text-[#8A8880]" />}
                        </div>
                        <div className={`max-w-[78%] px-3.5 py-2.5 rounded-2xl text-[0.78rem] leading-relaxed ${
                          line.role === "ai"
                            ? "bg-[rgba(139,92,246,0.10)] border border-[rgba(139,92,246,0.18)] text-[#F0EFE8] rounded-tl-sm"
                            : "bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.08)] text-[#8A8880] rounded-tr-sm"
                        }`}>
                          {line.text}
                        </div>
                      </div>
                    ))}
                    {callLine > 0 && callLine < CALL_LINES.length && (
                      <div className="flex gap-2.5">
                        <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "linear-gradient(135deg,#8B5CF6,#7C3AED)" }}>
                          <Bot className="w-3 h-3 text-white" />
                        </div>
                        <div className="px-3.5 py-2.5 rounded-2xl rounded-tl-sm bg-[rgba(139,92,246,0.10)] border border-[rgba(139,92,246,0.18)]">
                          <span className="flex gap-1 items-center">
                            {[0,1,2].map(i => <span key={i} className="w-1.5 h-1.5 rounded-full bg-[#8B5CF6]" style={{ animation: `blink 1.2s ${i*0.2}s ease-in-out infinite` }} />)}
                          </span>
                        </div>
                      </div>
                    )}
                    {callLine >= CALL_LINES.length && (
                      <div className="mt-2 p-3 rounded-xl border border-[rgba(139,92,246,0.20)] bg-[rgba(139,92,246,0.06)] flex items-center gap-2.5">
                        <Check className="w-4 h-4 text-[#8B5CF6] flex-shrink-0" />
                        <div>
                          <div className="text-[0.75rem] font-semibold text-[#F0EFE8]">Appointment Booked · CRM Updated</div>
                          <div className="text-[0.67rem] text-[#8A8880]">Tom Bennett · 1:00 PM today · Synced to Jobber</div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="px-5 py-3.5 border-t border-[rgba(139,92,246,0.08)] flex items-center justify-between"
                       style={{ background: "rgba(139,92,246,0.02)" }}>
                    <span className="text-[0.67rem] text-[#8A8880]">Call duration: 0:47 · No human involved</span>
                    <button onClick={() => { setCallLine(0); setTimeout(() => setCallStarted(true), 100) }}
                            className="text-[0.67rem] text-[#8B5CF6] hover:text-[#C4B5FD] transition-colors font-medium tracking-wide">
                      Replay ↺
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── INTEGRATIONS MARQUEE ─────────────────────────────────── */}
      <div className="border-y border-[rgba(139,92,246,0.08)] py-6 overflow-hidden" style={{ background: "rgba(139,92,246,0.02)" }}>
        <p className="text-center text-[0.6rem] font-medium tracking-[0.22em] uppercase text-[#3A3A38] mb-5">Tools we use to build your system</p>
        <div className="relative">
          <div className="marquee-track gap-5" style={{ width: "max-content" }}>
            {[...INTEGRATION_LOGOS, ...INTEGRATION_LOGOS].map((logo, i) => (
              <span key={i} className="inline-flex items-center px-5 py-2 rounded-full border border-[rgba(139,92,246,0.12)] bg-[rgba(139,92,246,0.03)] text-[0.78rem] font-semibold text-[#4A4A48] tracking-wide whitespace-nowrap mx-2.5">
                {logo}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── PROBLEM ──────────────────────────────────────────────── */}
      <section className="py-28" style={{ background: "#0D0D0D" }}>
        <div className="mx-auto max-w-[1200px] px-8">
          <div className="max-w-2xl mb-16">
            <span ref={ref(2)} className="fu block text-[0.65rem] font-medium tracking-[0.22em] uppercase text-[#8B5CF6] mb-5">The Problem</span>
            <h2 ref={ref(3)} className="fu font-[family-name:var(--font-playfair)] font-bold text-[clamp(2.2rem,4vw,3.4rem)] text-[#F0EFE8] leading-[1.1] tracking-tight mb-6" style={{ transitionDelay:"80ms" }}>
              Your competitors look better.<br /><em className="not-italic gold-rev">And they&apos;re getting your customers.</em>
            </h2>
            <div className="w-12 h-px shimmer mb-6" />
            <p ref={ref(4)} className="fu text-[#8A8880] text-lg leading-[1.85] font-light" style={{ transitionDelay:"160ms" }}>
              A generic website, no ad presence, zero follow-up automation — most local businesses are invisible online and leaving <span className="text-[#8B5CF6] font-medium">$50,000+ on the table every year</span> without realising it.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {[
              { n: "94%",   title: "of first impressions are your website", sub: "Customers judge your business in 0.05 seconds. A generic template tells them to keep scrolling — straight to your competitor.", i: 5, d: "0ms" },
              { n: "78%",   title: "of leads never get followed up",         sub: "No text-back, no email sequence, no review ask. One missed touchpoint and the job goes to someone else.", i: 6, d: "80ms" },
              { n: "$50K+", title: "lost per year from being invisible",      sub: "No ads, a slow website, zero automation. Each gap compounds. Together they're costing you six figures a year.", i: 7, d: "160ms" },
            ].map(({ n, title, sub, i, d }) => (
              <div key={n} ref={ref(i)} className="fu p-8 rounded-2xl border border-[rgba(139,92,246,0.10)] bg-[rgba(139,92,246,0.03)] hover:border-[rgba(139,92,246,0.22)] hover:bg-[rgba(139,92,246,0.05)] transition-all duration-400" style={{ transitionDelay: d }}>
                <div className="font-[family-name:var(--font-playfair)] text-5xl font-bold gold leading-none mb-3">{n}</div>
                <div className="text-sm font-semibold text-[#F0EFE8] mb-2.5 tracking-wide">{title}</div>
                <div className="text-sm text-[#8A8880] leading-relaxed font-light">{sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── INDUSTRIES ────────────────────────────────────────────── */}
      <section id="industries" className="py-28" style={{ background: "#080808" }}>
        <div className="mx-auto max-w-[1200px] px-8">
          <div className="text-center mb-16">
            <span ref={ref(8)} className="fu block text-[0.65rem] font-medium tracking-[0.22em] uppercase text-[#8B5CF6] mb-5">Who We Serve</span>
            <h2 ref={ref(9)} className="fu font-[family-name:var(--font-playfair)] font-bold text-[clamp(2.2rem,4vw,3.4rem)] text-[#F0EFE8] leading-[1.1] tracking-tight mb-5" style={{ transitionDelay:"80ms" }}>
              We make local businesses<br /><em className="not-italic gold">look like industry leaders</em>
            </h2>
            <p ref={ref(10)} className="fu text-[#8A8880] text-lg max-w-lg mx-auto leading-[1.85] font-light" style={{ transitionDelay:"160ms" }}>
              From HVAC to dental, we build the brand, website, and marketing system that makes you the obvious choice in your market — not just another option.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
            {[
              { icon:"🔧", name:"HVAC",        i:11, d:"0ms" },
              { icon:"🔩", name:"Plumbing",    i:12, d:"60ms" },
              { icon:"🦷", name:"Dental",      i:13, d:"120ms" },
              { icon:"🏠", name:"Roofing",     i:14, d:"180ms" },
              { icon:"⚡", name:"Electrical",  i:15, d:"240ms" },
              { icon:"🌿", name:"Lawn Care",   i:16, d:"300ms" },
              { icon:"🪟", name:"Windows",     i:17, d:"60ms" },
              { icon:"🧹", name:"Cleaning",    i:18, d:"120ms" },
              { icon:"💆", name:"Med Spa",     i:19, d:"180ms" },
              { icon:"🐾", name:"Pet Care",    i:20, d:"240ms" },
              { icon:"🚗", name:"Auto Repair", i:21, d:"300ms" },
              { icon:"🏥", name:"Healthcare",  i:22, d:"360ms" },
            ].map(({ icon, name, i, d }) => (
              <button key={name} ref={ref(i)}
                   onClick={() => setSelectedIndustry(selectedIndustry === name ? null : name)}
                   className={`fu group p-5 rounded-2xl border transition-all duration-300 text-center w-full ${
                     selectedIndustry === name
                       ? "border-[rgba(139,92,246,0.55)] bg-[rgba(139,92,246,0.10)]"
                       : "border-[rgba(139,92,246,0.10)] bg-[rgba(139,92,246,0.02)] hover:border-[rgba(139,92,246,0.28)] hover:bg-[rgba(139,92,246,0.06)]"
                   }`}
                   style={{ transitionDelay: d }}>
                <div className="text-2xl mb-3">{icon}</div>
                <div className="text-sm font-semibold text-[#F0EFE8] tracking-wide">{name}</div>
              </button>
            ))}
          </div>

          {/* Industry detail panel */}
          {selectedIndustry && INDUSTRY_DETAILS[selectedIndustry] && (
            <div className="phrase-in rounded-2xl border border-[rgba(139,92,246,0.22)] p-8 md:p-10"
                 style={{ background: "rgba(139,92,246,0.04)" }}>
              <div className="flex flex-col md:flex-row md:items-start gap-6">
                <div className="flex-1">
                  <h3 className="font-[family-name:var(--font-playfair)] text-xl font-bold text-[#F0EFE8] mb-3 leading-snug">
                    {INDUSTRY_DETAILS[selectedIndustry].headline}
                  </h3>
                  <p className="text-[#8A8880] text-sm leading-relaxed font-light mb-5">
                    {INDUSTRY_DETAILS[selectedIndustry].body}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {INDUSTRY_DETAILS[selectedIndustry].tags.map((tag) => (
                      <span key={tag} className="px-3 py-1 rounded-full text-[0.72rem] font-medium border border-[rgba(139,92,246,0.22)] text-[#8B5CF6]"
                            style={{ background: "rgba(139,92,246,0.06)" }}>{tag}</span>
                    ))}
                  </div>
                </div>
                <a href="#book"
                   className="flex-shrink-0 self-start px-6 py-3 rounded-xl text-sm font-semibold text-white whitespace-nowrap transition-all duration-300 hover:brightness-110"
                   style={{ background: "linear-gradient(135deg,#8B5CF6,#7C3AED)", boxShadow: "0 4px 20px rgba(139,92,246,0.30)" }}>
                  Get a free estimate →
                </a>
              </div>
            </div>
          )}

          {!selectedIndustry && (
            <p className="text-center text-[0.75rem] text-[#3A3A38] tracking-wide mt-2">
              Click your industry to see what we build for you
            </p>
          )}
        </div>
      </section>

      {/* ── FEATURES ──────────────────────────────────────────────── */}
      <section id="features" className="py-28" style={{ background: "#0D0D0D" }}>
        <div className="mx-auto max-w-[1200px] px-8">
          <div className="text-center mb-16">
            <span ref={ref(23)} className="fu block text-[0.65rem] font-medium tracking-[0.22em] uppercase text-[#8B5CF6] mb-5">What We Do</span>
            <h2 ref={ref(24)} className="fu font-[family-name:var(--font-playfair)] font-bold text-[clamp(2.2rem,4vw,3.4rem)] text-[#F0EFE8] leading-[1.1] tracking-tight mb-5" style={{ transitionDelay:"80ms" }}>
              Design. Market. Automate.<br /><em className="not-italic gold">Dominate your market.</em>
            </h2>
            <p ref={ref(25)} className="fu text-[#8A8880] text-lg max-w-lg mx-auto leading-[1.85] font-light" style={{ transitionDelay:"160ms" }}>
              From a stunning 3D website that stops the scroll, to ads that fill your pipeline, to automation that closes the loop — we build and run the whole thing.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
            <GoldCard span="lg:col-span-4" delay="0ms" idx={26} r={ref}>
              <IconBadge color="#8B5CF6"><Zap className="w-[18px] h-[18px]" /></IconBadge>
              <Label>3D & Premium Web Design</Label>
              <h3 className="font-[family-name:var(--font-playfair)] text-xl font-bold text-[#F0EFE8] mb-3 leading-snug">A website so good, customers trust you before they call.</h3>
              <p className="text-[#8A8880] text-sm leading-relaxed font-light mb-6">We build immersive, 3D-enhanced websites with animations, glass effects, and layouts that make local businesses look like premium brands. Fast, mobile-perfect, and built to convert — not just impress.</p>
              <div className="flex gap-8">
                {[["3D","animations & effects"],["<1s","load time"],["100%","mobile optimized"]].map(([v,l]) => (
                  <div key={l}>
                    <div className="font-[family-name:var(--font-playfair)] text-2xl font-bold gold leading-none">{v}</div>
                    <div className="text-[0.65rem] text-[#3A3A38] mt-1.5 tracking-wide uppercase">{l}</div>
                  </div>
                ))}
              </div>
            </GoldCard>

            <GoldCard span="lg:col-span-2" delay="70ms" idx={27} r={ref}>
              <IconBadge color="#C4B5FD"><TrendingUp className="w-[18px] h-[18px]" /></IconBadge>
              <Label>Paid Ads Management</Label>
              <h3 className="font-[family-name:var(--font-playfair)] text-lg font-bold text-[#F0EFE8] mb-3 leading-snug">Google & Meta ads managed for you, every week</h3>
              <p className="text-[#8A8880] text-sm leading-relaxed font-light mb-5">We write the copy, set the targeting, and optimize your budget weekly. Leads come in — you just answer the phone.</p>
              <Tags tags={["Google Ads","Meta Ads","Weekly optimization"]} />
            </GoldCard>

            <GoldCard span="lg:col-span-2" delay="130ms" idx={28} r={ref}>
              <IconBadge color="#8B5CF6"><Star className="w-[18px] h-[18px]" /></IconBadge>
              <Label>Review & Reputation System</Label>
              <h3 className="font-[family-name:var(--font-playfair)] text-lg font-bold text-[#F0EFE8] mb-3 leading-snug">More 5-star reviews on autopilot</h3>
              <p className="text-[#8A8880] text-sm leading-relaxed font-light mb-5">After every job, an automated review request goes out at the perfect moment — so you build your reputation on Google Maps without lifting a finger.</p>
              <Tags tags={["Google","Facebook","Automated"]} />
            </GoldCard>

            <GoldCard span="lg:col-span-4" delay="190ms" idx={29} r={ref}>
              <IconBadge color="#C4B5FD"><MessageSquare className="w-[18px] h-[18px]" /></IconBadge>
              <Label>Lead Automation & Follow-Up</Label>
              <h3 className="font-[family-name:var(--font-playfair)] text-xl font-bold text-[#F0EFE8] mb-3 leading-snug">Every lead followed up. Every appointment confirmed. Zero manual work.</h3>
              <p className="text-[#8A8880] text-sm leading-relaxed font-light mb-5">Missed-call text-backs, booking confirmations, reminders, and re-engagement campaigns all run automatically — so every lead gets followed up and every appointment shows up.</p>
              <Tags tags={["Missed-call text-back","SMS reminders","Email sequences","Re-engagement"]} />
            </GoldCard>

            <GoldCard span="lg:col-span-3" delay="250ms" idx={30} r={ref}>
              <IconBadge color="#8B5CF6"><Link2 className="w-[18px] h-[18px]" /></IconBadge>
              <Label>CRM & Pipeline Setup</Label>
              <h3 className="font-[family-name:var(--font-playfair)] text-lg font-bold text-[#F0EFE8] mb-3">Every lead tracked. Every deal visible.</h3>
              <p className="text-[#8A8880] text-sm leading-relaxed font-light mb-4">We build and configure your CRM so every lead has a status, every follow-up is triggered, and nothing gets lost. Built on GoHighLevel — the platform made for service businesses.</p>
              <Tags tags={["GoHighLevel","Jobber","ServiceTitan","Zapier"]} />
            </GoldCard>

            <GoldCard span="lg:col-span-3" delay="310ms" idx={31} r={ref}>
              <IconBadge color="#C4B5FD"><Bot className="w-[18px] h-[18px]" /></IconBadge>
              <Label>AI Receptionist</Label>
              <h3 className="font-[family-name:var(--font-playfair)] text-lg font-bold text-[#F0EFE8] mb-3">Never miss a call. Never miss a booking.</h3>
              <p className="text-[#8A8880] text-sm leading-relaxed font-light">Available in our Growth System — an AI that answers calls, books appointments, and handles FAQs 24/7. One more way your business runs while you sleep.</p>
            </GoldCard>
          </div>
        </div>
      </section>

      {/* ── TECH STACK / WHAT'S INSIDE ────────────────────────────── */}
      <section className="py-20 border-t border-[rgba(139,92,246,0.07)]" style={{ background: "#080808" }}>
        <div className="mx-auto max-w-[1200px] px-8">
          <div className="text-center mb-12">
            <span className="block text-[0.65rem] font-medium tracking-[0.22em] uppercase text-[#8B5CF6] mb-4">Under the Hood</span>
            <h2 className="font-[family-name:var(--font-playfair)] font-bold text-[clamp(1.8rem,3vw,2.6rem)] text-[#F0EFE8] leading-[1.1] tracking-tight">
              Built on tools that <em className="not-italic gold">actually work</em>
            </h2>
            <p className="text-[#8A8880] text-base mt-4 max-w-md mx-auto font-light leading-relaxed">
              We don't build custom software or reinvent the wheel. We wire together the best-in-class platforms so your system is reliable, proven, and maintainable.
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { name: "GoHighLevel",    role: "CRM, automation & pipelines",   icon: "⚙️" },
              { name: "Google Ads",     role: "Search & display advertising",   icon: "🔍" },
              { name: "Meta Ads",       role: "Facebook & Instagram campaigns", icon: "📣" },
              { name: "Twilio",         role: "SMS & voice infrastructure",     icon: "📱" },
              { name: "Next.js",        role: "3D websites & landing pages",    icon: "🌐" },
              { name: "Jobber",         role: "Field service job management",   icon: "🗂️" },
              { name: "Zapier",         role: "Cross-platform integrations",    icon: "🔗" },
              { name: "OpenAI",         role: "AI receptionist & voice agent",  icon: "🤖" },
            ].map(({ name, role, icon }) => (
              <div key={name} className="flex items-start gap-3 p-5 rounded-xl border border-[rgba(139,92,246,0.09)] bg-[rgba(139,92,246,0.02)] hover:border-[rgba(139,92,246,0.22)] hover:bg-[rgba(139,92,246,0.04)] transition-all duration-300">
                <span className="text-xl flex-shrink-0 mt-0.5">{icon}</span>
                <div>
                  <div className="text-[0.82rem] font-semibold text-[#F0EFE8] tracking-wide">{name}</div>
                  <div className="text-[0.7rem] text-[#8A8880] mt-0.5 font-light">{role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── LIVE DEMO SECTION ─────────────────────────────────────── */}
      <section id="demo" className="py-28 relative overflow-hidden" style={{ background: "#080808" }}>
        <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 60% 50% at 50% 50%, rgba(139,92,246,0.05), transparent 70%)" }} />
        <div className="relative z-10 mx-auto max-w-[1200px] px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <span ref={ref(32)} className="fu block text-[0.65rem] font-medium tracking-[0.22em] uppercase text-[#8B5CF6] mb-5">What You Get</span>
              <h2 ref={ref(33)} className="fu font-[family-name:var(--font-playfair)] font-bold text-[clamp(2rem,3.5vw,3.2rem)] text-[#F0EFE8] leading-[1.1] tracking-tight mb-6" style={{ transitionDelay:"80ms" }}>
                A brand that stands out.<br /><em className="not-italic gold">A system that runs itself.</em>
              </h2>
              <div className="w-12 h-px shimmer mb-6" />
              <p ref={ref(34)} className="fu text-[#8A8880] text-lg leading-[1.85] font-light mb-8" style={{ transitionDelay:"160ms" }}>
                We design the website, launch the ads, build the automations, and manage everything on an ongoing basis. You get a premium brand presence and a full pipeline — without the overhead of an in-house team.
              </p>
              <div ref={ref(35)} className="fu space-y-4" style={{ transitionDelay:"240ms" }}>
                {[
                  ["A premium 3D website live within 48 hours"],
                  ["Google &amp; Meta ads generating inbound leads"],
                  ["Automated follow-up that closes leads while you sleep"],
                  ["Reviews, CRM, and pipeline all running on autopilot"],
                ].map(([t], i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 border border-[rgba(139,92,246,0.25)] bg-[rgba(139,92,246,0.08)] text-[#8B5CF6]">
                      <Check className="w-3 h-3" strokeWidth={2.5} />
                    </span>
                    <span className="text-sm text-[#8A8880] font-light leading-relaxed" dangerouslySetInnerHTML={{ __html: t }} />
                  </div>
                ))}
              </div>
            </div>

            {/* Animated waveform + call stats */}
            <div ref={ref(36)} className="fu" style={{ transitionDelay:"150ms" }}>
              <div className="bg-[#0D0D0D]/95 border border-[rgba(139,92,246,0.15)] rounded-3xl p-6 shadow-[0_32px_80px_rgba(0,0,0,0.6)]">
                {/* Waveform visual */}
                <div className="flex items-center gap-3 mb-6 pb-5 border-b border-[rgba(139,92,246,0.08)]">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "linear-gradient(135deg,#8B5CF6,#7C3AED)" }}>
                    <Mic className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-[#F0EFE8] tracking-wide">Aria · AI Receptionist</div>
                    <div className="text-xs text-[#8A8880]">Natural language · Zero latency</div>
                  </div>
                  <div className="ml-auto flex items-end gap-0.5 h-6">
                    {[3,6,9,7,4,8,5,10,6,3,7,8,4,9,5,6,8,4,7,5].map((h,i) => (
                      <div key={i} className="w-1 rounded-full bg-[#8B5CF6]"
                           style={{ height: `${h * 2}px`, opacity: 0.4 + (h / 10) * 0.6, animation: `blink ${0.8 + (i % 3) * 0.2}s ${i * 0.05}s ease-in-out infinite` }} />
                    ))}
                  </div>
                </div>

                {/* Live metrics */}
                <div className="grid grid-cols-2 gap-3 mb-5">
                  {[
                    { icon: <PhoneCall className="w-4 h-4" />, label: "Calls Answered", val: "24/7", c:"#8B5CF6" },
                    { icon: <Calendar className="w-4 h-4" />, label: "Appointments Booked", val: "Auto", c:"#8B5CF6" },
                    { icon: <Clock className="w-4 h-4" />,     label: "Response Time",  val: "<5s", c:"#8A9FD4" },
                    { icon: <TrendingUp className="w-4 h-4" />,label: "Human Involved",  val: "0", c:"#A0C0A0" },
                  ].map(({ icon, label, val, c }) => (
                    <div key={label} className="p-3.5 rounded-xl border border-[rgba(139,92,246,0.08)] bg-[rgba(139,92,246,0.03)]">
                      <div className="flex items-center gap-1.5 mb-2" style={{ color: c }}>{icon}<span className="text-[0.65rem] font-medium tracking-wide text-[#8A8880]">{label}</span></div>
                      <div className="font-[family-name:var(--font-playfair)] text-2xl font-bold" style={{ color: c }}>{val}</div>
                    </div>
                  ))}
                </div>

                <div className="p-3.5 rounded-xl border border-[rgba(139,92,246,0.15)] bg-[rgba(139,92,246,0.05)] flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background:"linear-gradient(135deg,#8B5CF6,#7C3AED)" }}>
                    <TrendingUp className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <div className="text-[0.78rem] font-semibold text-[#F0EFE8]">Every missed call becomes a booked job</div>
                    <div className="text-[0.67rem] text-[#8A8880]">Automated text-back fires in seconds — no lead left behind</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ──────────────────────────────────────────── */}
      <section id="how-it-works" className="py-28" style={{ background: "#0D0D0D" }}>
        <div className="mx-auto max-w-[1200px] px-8">
          <div className="text-center mb-16">
            <span ref={ref(37)} className="fu block text-[0.65rem] font-medium tracking-[0.22em] uppercase text-[#8B5CF6] mb-5">How It Works</span>
            <h2 ref={ref(38)} className="fu font-[family-name:var(--font-playfair)] font-bold text-[clamp(2.2rem,4vw,3.4rem)] text-[#F0EFE8] leading-[1.1] tracking-tight mb-5" style={{ transitionDelay:"80ms" }}>
              Built for you.<br /><em className="not-italic gold">Running in 48 hours.</em>
            </h2>
            <p ref={ref(39)} className="fu text-[#8A8880] text-lg max-w-md mx-auto leading-[1.85] font-light" style={{ transitionDelay:"160ms" }}>
              No tech skills needed. We design, build, and launch everything — you just approve and watch the leads come in.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 relative">
            <div className="hidden md:block absolute top-14 left-[calc(16.67%+20px)] right-[calc(16.67%+20px)] h-px shimmer opacity-40" />
            {[
              { n:"01", title:"Free Strategy Call",          body:"We audit your online presence, learn your market, and map out your custom growth system — website design, ad strategy, and automation plan. No obligation.", i:40, d:"50ms" },
              { n:"02", title:"We Design, Build & Launch",  body:"Our team builds your 3D website, sets up your ads and CRM, and wires your automation. You get a premium brand and a full system live in under 48 hours.", i:41, d:"180ms" },
              { n:"03", title:"Leads In. Jobs Booked.",     body:"Ads bring customers to your site. The site converts them. Automation follows up. Reviews build trust. The flywheel spins — with or without you at the desk.", i:42, d:"310ms" },
            ].map(({ n, title, body, i, d }) => (
              <div key={n} ref={ref(i)}
                   className="fu p-10 rounded-2xl border border-[rgba(139,92,246,0.10)] bg-[rgba(139,92,246,0.02)] hover:border-[rgba(139,92,246,0.22)] hover:bg-[rgba(139,92,246,0.04)] transition-all duration-500 text-left"
                   style={{ transitionDelay: d }}>
                <div className="font-[family-name:var(--font-playfair)] text-4xl font-bold gold leading-none mb-5 tracking-tight">{n}</div>
                <div className="w-8 h-px shimmer mb-5" />
                <h3 className="font-[family-name:var(--font-playfair)] text-lg font-bold text-[#F0EFE8] mb-3 leading-snug">{title}</h3>
                <p className="text-[#8A8880] text-sm leading-relaxed font-light">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── STATS ─────────────────────────────────────────────────── */}
      <div style={{ background: "#080808" }}>
        <div className="mx-auto max-w-[1200px] px-8">
          <div ref={ref(43)} className="fu grid grid-cols-2 md:grid-cols-4 border border-[rgba(139,92,246,0.10)] rounded-2xl overflow-hidden" style={{ background: "#0D0D0D" }}>
            {[["3D","immersive web design"],["Google & Meta","ads managed for you"],["24/7","AI receptionist & automation"],["<48hrs","website & system live"]].map(([v,l],i) => (
              <div key={l} className={`py-14 px-6 text-center hover:bg-[rgba(139,92,246,0.04)] transition-colors ${i<3?"border-r border-[rgba(139,92,246,0.08)]":""} ${i>=2?"border-t md:border-t-0 border-[rgba(139,92,246,0.08)]":""}`}>
                <div className="font-[family-name:var(--font-playfair)] text-4xl md:text-5xl font-bold gold leading-none mb-3">{v}</div>
                <div className="text-[#8A8880] text-xs tracking-[0.12em] uppercase font-medium">{l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── EARLY ADOPTER CTA ─────────────────────────────────────── */}
      <section className="py-28" style={{ background: "#080808" }}>
        <div className="mx-auto max-w-[1200px] px-8">
          <div ref={ref(44)} className="fu rounded-2xl border border-[rgba(139,92,246,0.18)] p-14 text-center relative overflow-hidden"
               style={{ background: "rgba(139,92,246,0.03)" }}>
            <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 60% 60% at 50% 0%, rgba(139,92,246,0.07), transparent 70%)" }} />
            <div className="absolute inset-x-0 top-0 h-px shimmer" />
            <div className="relative z-10">
              <span className="block text-[0.65rem] font-medium tracking-[0.22em] uppercase text-[#8B5CF6] mb-6">Early Clients</span>
              <h2 ref={ref(45)} className="font-[family-name:var(--font-playfair)] font-bold text-[clamp(2rem,3.5vw,3rem)] text-[#F0EFE8] leading-[1.1] tracking-tight mb-5" style={{ transitionDelay:"80ms" }}>
                Be our first case study.
              </h2>
              <p className="text-[#8A8880] text-lg leading-[1.85] font-light max-w-lg mx-auto mb-8">
                We're taking on a select number of founding clients — businesses that want to be first in their market with a system like this. You get our full attention. We get to prove what we can do.
              </p>
              <a href="#book">
                <LiquidButton size="lg"
                  className="text-white font-semibold border-0 rounded-full tracking-wide"
                  style={{ background: "linear-gradient(135deg,#8B5CF6,#7C3AED)", boxShadow: "0 8px 32px rgba(139,92,246,0.35)" }}>
                  Claim a Founding Spot <ArrowRight className="w-4 h-4 inline ml-1.5" />
                </LiquidButton>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── COMPARISON TABLE ──────────────────────────────────────── */}
      <section className="py-28" style={{ background: "#0D0D0D" }}>
        <div className="mx-auto max-w-[900px] px-8">
          <div className="text-center mb-14">
            <span ref={ref(49)} className="fu block text-[0.65rem] font-medium tracking-[0.22em] uppercase text-[#8B5CF6] mb-5">Why Scalero</span>
            <h2 ref={ref(50)} className="fu font-[family-name:var(--font-playfair)] font-bold text-[clamp(2rem,3.5vw,3.2rem)] text-[#F0EFE8] leading-[1.1] tracking-tight" style={{ transitionDelay:"80ms" }}>
              One system beats<br /><em className="not-italic gold">five separate vendors</em>
            </h2>
          </div>

          <div ref={ref(51)} className="fu rounded-2xl border border-[rgba(139,92,246,0.15)] overflow-hidden" style={{ transitionDelay:"120ms" }}>
            {/* Header */}
            <div className="grid grid-cols-4 border-b border-[rgba(139,92,246,0.10)]" style={{ background: "rgba(139,92,246,0.05)" }}>
              <div className="p-5 text-[0.7rem] font-semibold text-[#3A3A38] uppercase tracking-wide">Feature</div>
              {[
                { label: "Scalero", gold: true },
                { label: "Hiring Separately", gold: false },
                { label: "DIY / Doing Nothing", gold: false },
              ].map(({ label, gold }) => (
                <div key={label} className={`p-5 text-center text-[0.78rem] font-bold tracking-wide ${gold ? "text-[#8B5CF6]" : "text-[#8A8880]"}`}>{label}</div>
              ))}
            </div>
            {[
              ["High-converting website",         true,  "Dev + designer: $5K+", false],
              ["Paid ads management",              true,  "Agency: $1,500+/mo",   false],
              ["Missed-call text-back",            true,  "Separate tool: $99+",  false],
              ["CRM & pipeline setup",             true,  "Consultant: $2K+",     false],
              ["Automated SMS & email follow-up",  true,  "Tool + setup: $200+",  false],
              ["Review request automation",        true,  "Tool: $99+/mo",        false],
              ["AI receptionist (24/7)",           true,  "VA: $1,800+/mo",       false],
              ["All-in monthly cost",              "From $100/mo", "$5,000–$10,000/mo", "$0 (but $50K/yr in lost jobs)"],
            ].map(([feat, sc, hu, vm], i) => {
              const cell = (val: boolean | string, highlight = false) => (
                <div className={`p-4 text-center flex items-center justify-center ${highlight ? "bg-[rgba(139,92,246,0.04)]" : ""}`}>
                  {typeof val === "boolean"
                    ? val
                      ? <Check className="w-4 h-4 text-[#8B5CF6] mx-auto" strokeWidth={2.5} />
                      : <X className="w-4 h-4 text-[#3A3A38] mx-auto" strokeWidth={2} />
                    : <span className={`text-[0.78rem] font-medium ${highlight ? "text-[#8B5CF6]" : "text-[#8A8880]"}`}>{val}</span>
                  }
                </div>
              )
              return (
                <div key={String(feat)} className={`grid grid-cols-4 border-b border-[rgba(139,92,246,0.07)] last:border-0 ${i%2===0?"":"bg-[rgba(255,255,255,0.01)]"}`}>
                  <div className="p-4 text-sm text-[#8A8880] font-light">{feat}</div>
                  {cell(sc, true)}
                  {cell(hu)}
                  {cell(vm)}
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── PRICING ───────────────────────────────────────────────── */}
      <section id="pricing" className="py-28 relative overflow-hidden" style={{ background: "#080808" }}>
        <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 70% 50% at 50% 50%, rgba(139,92,246,0.05), transparent 70%)" }} />
        <div className="relative z-10 mx-auto max-w-[1100px] px-8">

          {/* Header */}
          <div className="text-center mb-16">
            <span ref={ref(52)} className="fu block text-[0.65rem] font-medium tracking-[0.22em] uppercase text-[#8B5CF6] mb-5">Pricing</span>
            <h2 ref={ref(53)} className="fu font-[family-name:var(--font-playfair)] font-bold text-[clamp(2.2rem,4vw,3.4rem)] text-[#F0EFE8] leading-[1.1] tracking-tight mb-5" style={{ transitionDelay:"80ms" }}>
              Simple, transparent pricing
            </h2>
            <p ref={ref(54)} className="fu text-[#8A8880] text-lg max-w-lg mx-auto leading-[1.85] font-light" style={{ transitionDelay:"160ms" }}>
              Choose the system that fits where you are — and where you want to go.
            </p>
          </div>

          {/* Cards */}
          <div className="grid md:grid-cols-3 gap-5 items-stretch">

            {/* Foundation */}
            <div ref={ref(56)} className="fu flex flex-col rounded-2xl border border-[rgba(255,255,255,0.07)] p-8 transition-all duration-500 hover:border-[rgba(139,92,246,0.25)]"
                 style={{ background:"rgba(255,255,255,0.03)", transitionDelay:"0ms" }}>
              <div className="text-[0.63rem] font-semibold uppercase tracking-[0.22em] text-[#8A8880] mb-3">Foundation</div>
              <p className="text-[#8A8880] text-sm font-light leading-relaxed mb-6">Professional system to capture and book leads.</p>
              <div className="mb-1">
                <span className="font-[family-name:var(--font-playfair)] text-4xl font-bold text-[#F0EFE8] leading-none">$300</span>
                <span className="text-[#8A8880] text-sm font-light"> + $150/mo</span>
              </div>
              <div className="w-8 h-px mb-7 mt-4" style={{ background:"rgba(139,92,246,0.3)" }} />
              <ul className="flex flex-col gap-3 flex-1 mb-8">
                {["High-converting website","Online booking calendar","Mobile optimization","Basic CRM setup","Hosting & maintenance"].map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-[0.83rem] text-[#8A8880] font-light">
                    <span className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 border border-[rgba(139,92,246,0.22)] bg-[rgba(139,92,246,0.08)] text-[#8B5CF6]">
                      <Check className="w-2.5 h-2.5" strokeWidth={2.5} />
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
              <a href="#book" className="block w-full py-3.5 rounded-xl text-sm font-semibold tracking-wide text-center transition-all duration-300 border border-[rgba(139,92,246,0.22)] text-[#8B5CF6] hover:bg-[rgba(139,92,246,0.08)]"
                 style={{ background:"rgba(139,92,246,0.05)" }}>
                Get Started
              </a>
            </div>

            {/* Booked Jobs — Popular */}
            <div ref={ref(57)} className="fu flex flex-col rounded-2xl relative overflow-hidden p-8 transition-all duration-500"
                 style={{ background:"rgba(139,92,246,0.07)", border:"1px solid rgba(139,92,246,0.35)", transform:"translateY(-8px)", boxShadow:"0 0 60px rgba(139,92,246,0.15), 0 32px 80px rgba(0,0,0,0.5)", transitionDelay:"120ms" }}>
              {/* Top shimmer line */}
              <div className="absolute inset-x-0 top-0 h-px shimmer" />
              {/* Purple glow */}
              <div className="absolute inset-0 pointer-events-none rounded-2xl" style={{ background:"radial-gradient(ellipse 80% 40% at 50% 0%, rgba(139,92,246,0.12), transparent 60%)" }} />

              <div className="flex items-center justify-between mb-3 relative">
                <div className="text-[0.63rem] font-semibold uppercase tracking-[0.22em] text-[#8A8880]">Booked Jobs</div>
                <div className="inline-flex items-center gap-1.5 text-white text-[0.65rem] font-bold px-3 py-1.5 rounded-full tracking-[0.1em] uppercase"
                     style={{ background:"linear-gradient(135deg,#8B5CF6,#7C3AED)" }}>
                  <Star className="w-3 h-3 fill-white" /> Popular
                </div>
              </div>
              <p className="text-[#8A8880] text-sm font-light leading-relaxed mb-6 relative">Consistent booked appointments every month.</p>
              <div className="mb-1 relative">
                <span className="font-[family-name:var(--font-playfair)] text-4xl font-bold text-[#F0EFE8] leading-none">$800</span>
                <span className="text-[#8A8880] text-sm font-light">–$2,500/mo</span>
              </div>
              <div className="text-[0.68rem] text-[#8A8880] font-light mb-1 relative">Based on your ad spend & market size</div>
              <div className="w-8 h-px mb-7 mt-4 shimmer" />
              <ul className="flex flex-col gap-3 flex-1 mb-8 relative">
                {["Paid ads management","High-converting website","CRM & pipeline setup","Automated SMS & email follow-up","Missed-call text-back","Review request automation","Monthly optimization"].map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-[0.83rem] text-[#8A8880] font-light">
                    <span className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 border border-[rgba(139,92,246,0.35)] bg-[rgba(139,92,246,0.15)] text-[#8B5CF6]">
                      <Check className="w-2.5 h-2.5" strokeWidth={2.5} />
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
              <a href="#book" className="block w-full py-3.5 rounded-xl text-sm font-semibold tracking-wide text-center text-white relative transition-all duration-300 hover:brightness-110"
                 style={{ background:"linear-gradient(135deg,#8B5CF6,#7C3AED)", boxShadow:"0 4px 24px rgba(139,92,246,0.40)" }}>
                Get Free Estimate
              </a>
            </div>

            {/* Growth System */}
            <div ref={ref(58)} className="fu flex flex-col rounded-2xl border border-[rgba(255,255,255,0.07)] p-8 transition-all duration-500 hover:border-[rgba(139,92,246,0.25)]"
                 style={{ background:"rgba(255,255,255,0.03)", transitionDelay:"240ms" }}>
              <div className="text-[0.63rem] font-semibold uppercase tracking-[0.22em] text-[#8A8880] mb-3">Growth System</div>
              <p className="text-[#8A8880] text-sm font-light leading-relaxed mb-6">Scale and maximize every lead with AI.</p>
              <div className="mb-1">
                <span className="font-[family-name:var(--font-playfair)] text-4xl font-bold text-[#F0EFE8] leading-none">$1,500</span>
                <span className="text-[#8A8880] text-sm font-light">–$3,500/mo</span>
              </div>
              <div className="text-[0.68rem] text-[#8A8880] font-light mb-1">Includes AI receptionist & full automation suite</div>
              <div className="w-8 h-px mb-7 mt-4" style={{ background:"rgba(139,92,246,0.3)" }} />
              <ul className="flex flex-col gap-3 flex-1 mb-8">
                {["Everything in Booked Jobs","AI receptionist","Customer reactivation","Upsell & retention automations","Membership setup","Advanced reporting"].map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-[0.83rem] text-[#8A8880] font-light">
                    <span className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 border border-[rgba(139,92,246,0.22)] bg-[rgba(139,92,246,0.08)] text-[#8B5CF6]">
                      <Check className="w-2.5 h-2.5" strokeWidth={2.5} />
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
              <a href="#book" className="block w-full py-3.5 rounded-xl text-sm font-semibold tracking-wide text-center transition-all duration-300 border border-[rgba(139,92,246,0.22)] text-[#8B5CF6] hover:bg-[rgba(139,92,246,0.08)]"
                 style={{ background:"rgba(139,92,246,0.05)" }}>
                Get Free Estimate
              </a>
            </div>

          </div>

          {/* Guarantee + reassurance row */}
          <div className="mt-8 grid md:grid-cols-3 gap-4">
            {[
              { icon: <Check className="w-4 h-4 text-[#8B5CF6]" />, title: "Live in 48 hours — guaranteed", body: "If your system isn't live within 48 hours of your strategy call, you don't pay for that period. No excuses." },
              { icon: <RefreshCw className="w-4 h-4 text-[#8B5CF6]" />, title: "No long-term contracts", body: "Month-to-month on Foundation. Custom engagements can be cancelled with 30 days' notice — no lock-in." },
              { icon: <Shield className="w-4 h-4 text-[#8B5CF6]" />, title: "No setup fees, ever", body: "What you see is what you pay. No onboarding fees, no hidden charges, no surprise invoices." },
            ].map(({ icon, title, body }) => (
              <div key={title} className="flex gap-4 p-5 rounded-xl border border-[rgba(139,92,246,0.10)] bg-[rgba(139,92,246,0.02)]">
                <div className="w-8 h-8 rounded-lg border border-[rgba(139,92,246,0.22)] bg-[rgba(139,92,246,0.08)] flex items-center justify-center flex-shrink-0 mt-0.5">{icon}</div>
                <div>
                  <div className="text-[0.82rem] font-semibold text-[#F0EFE8] mb-1 tracking-wide">{title}</div>
                  <div className="text-[0.78rem] text-[#8A8880] font-light leading-relaxed">{body}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Promo Banner */}
          <div ref={ref(59)} className="fu mt-6 rounded-2xl border border-[rgba(139,92,246,0.20)] p-8 flex flex-col md:flex-row items-center justify-between gap-6"
               style={{ background:"rgba(139,92,246,0.05)", transitionDelay:"320ms" }}>
            <div>
              <div className="font-[family-name:var(--font-playfair)] text-xl font-bold text-[#F0EFE8] mb-2">Not sure which plan fits?</div>
              <p className="text-[#8A8880] text-sm font-light leading-relaxed max-w-lg">
                Book a free 30-minute strategy call. We'll audit your online presence, tell you exactly what you need, and give you a firm quote — no pressure, no vague proposals.
              </p>
            </div>
            <a href="#book" className="flex-shrink-0 px-7 py-3.5 rounded-xl text-sm font-semibold tracking-wide text-white transition-all duration-300 hover:brightness-110 whitespace-nowrap"
               style={{ background:"linear-gradient(135deg,#8B5CF6,#7C3AED)", boxShadow:"0 4px 24px rgba(139,92,246,0.30)" }}>
              Book a Free Call
            </a>
          </div>

        </div>
      </section>

      {/* ── FAQ ───────────────────────────────────────────────────── */}
      <section id="faq" className="py-28" style={{ background: "#0D0D0D" }}>
        <div className="mx-auto max-w-[680px] px-8 text-center">
          <span ref={ref(60)} className="fu block text-[0.65rem] font-medium tracking-[0.22em] uppercase text-[#8B5CF6] mb-5">FAQ</span>
          <h2 ref={ref(61)} className="fu font-[family-name:var(--font-playfair)] font-bold text-[clamp(2rem,3.5vw,3.2rem)] text-[#F0EFE8] leading-[1.1] tracking-tight mb-12" style={{ transitionDelay:"80ms" }}>
            Questions? <em className="not-italic gold">We&apos;ve got answers.</em>
          </h2>
          <div className="flex flex-col gap-2.5 text-left">
            {FAQS.map((faq, i) => (
              <div key={i} ref={ref(62+i)}
                   className="fu rounded-xl border overflow-hidden transition-all duration-300"
                   style={{ transitionDelay:`${i*40}ms`, background: openFaq===i?"rgba(139,92,246,0.04)":"rgba(139,92,246,0.02)", borderColor: openFaq===i?"rgba(139,92,246,0.25)":"rgba(139,92,246,0.10)" }}>
                <button className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left text-[0.88rem] font-medium text-[#F0EFE8] hover:text-[#8B5CF6] transition-colors tracking-wide"
                        aria-expanded={openFaq===i} onClick={() => setOpenFaq(openFaq===i?null:i)}>
                  {faq.q}
                  <ChevronDown className={`w-4 h-4 flex-shrink-0 transition-all duration-300 ${openFaq===i?"rotate-180 text-[#8B5CF6]":"text-[#3A3A38]"}`} />
                </button>
                <div className={`overflow-hidden transition-all duration-400 ${openFaq===i?"max-h-52":"max-h-0"}`}>
                  <p className="px-6 pb-5 text-[#8A8880] text-sm leading-[1.85] font-light">{faq.a}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ─────────────────────────────────────────────── */}
      <section className="py-32 relative overflow-hidden text-center" style={{ background: "#080808" }}>
        <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 80% 60% at 50% 50%, rgba(139,92,246,0.06), transparent 70%)" }} />
        <div className="absolute inset-x-0 top-0 h-px shimmer" />
        <div className="absolute inset-x-0 bottom-0 h-px shimmer" />
        <div className="relative z-10 mx-auto max-w-[580px] px-8">
          <span ref={ref(70)} className="fu block text-[0.65rem] font-medium tracking-[0.22em] uppercase text-[#8B5CF6] mb-7">Start Today</span>
          <h2 ref={ref(71)} className="fu font-[family-name:var(--font-playfair)] font-bold text-[clamp(2.4rem,4.5vw,4rem)] text-[#F0EFE8] leading-[1.06] tracking-tight mb-6" style={{ transitionDelay:"80ms" }}>
            Look better than everyone.<br />Book more than anyone.
          </h2>
          <div className="w-16 h-px shimmer mx-auto mb-7" />
          <p ref={ref(72)} className="fu text-[#8A8880] text-lg leading-[1.85] font-light mb-12" style={{ transitionDelay:"160ms" }}>
            Book a free 30-minute strategy call. We&apos;ll show you exactly what your website, ads, and automation system should look like — then we&apos;ll build it.
          </p>
          <div ref={ref(73)} className="fu flex flex-wrap justify-center gap-4 mb-10" style={{ transitionDelay:"240ms" }}>
            <a href="#book">
              <LiquidButton size="xl"
                className="text-white font-semibold border-0 rounded-full tracking-wide"
                style={{ background:"linear-gradient(135deg,#8B5CF6,#7C3AED)", boxShadow:"0 8px 40px rgba(139,92,246,0.35)" }}>
                Book a Free Strategy Call <ArrowRight className="w-4 h-4 inline ml-1.5" />
              </LiquidButton>
            </a>
          </div>

          {/* Email capture — not ready to call yet */}
          <div className="mb-10 max-w-md mx-auto">
            <p className="text-[#8A8880] text-xs tracking-wide mb-3 uppercase font-medium">Not ready to call? Get the free guide instead.</p>
            <form className="flex gap-2" onSubmit={(e) => e.preventDefault()}>
              <input
                type="email"
                placeholder="your@email.com"
                className="flex-1 bg-[rgba(139,92,246,0.05)] border border-[rgba(139,92,246,0.18)] rounded-full px-5 py-3 text-sm text-[#F0EFE8] placeholder-[#3A3A38] outline-none focus:border-[rgba(139,92,246,0.45)] transition-colors"
              />
              <button type="submit" className="px-5 py-3 rounded-full text-sm font-semibold text-white flex-shrink-0 hover:brightness-110 transition-all"
                      style={{ background:"linear-gradient(135deg,#8B5CF6,#7C3AED)" }}>
                Send it
              </button>
            </form>
            <p className="text-[#3A3A38] text-[0.65rem] mt-2 tracking-wide">We&apos;ll send you &ldquo;5 things killing your local business online&rdquo; — free.</p>
          </div>

          <p className="text-[#3A3A38] text-[0.7rem] tracking-wide">Free strategy call · No setup fees · System live in under 48 hours</p>
        </div>
      </section>

      {/* ── BOOK A CALL ───────────────────────────────────────────── */}
      <section id="book" className="py-28" style={{ background: "#0D0D0D" }}>
        <div className="mx-auto max-w-[1200px] px-8">
          <div className="text-center mb-12">
            <span className="block text-[0.65rem] font-medium tracking-[0.22em] uppercase text-[#8B5CF6] mb-5">Book a Call</span>
            <h2 className="font-[family-name:var(--font-playfair)] font-bold text-[clamp(2rem,3.5vw,3.2rem)] text-[#F0EFE8] leading-[1.1] tracking-tight mb-4">
              Pick a time. <em className="not-italic gold">We&apos;ll handle the rest.</em>
            </h2>
            <p className="text-[#8A8880] text-lg font-light max-w-md mx-auto leading-relaxed">
              30 minutes. Free. We&apos;ll audit your online presence and show you exactly what your system should look like.
            </p>
          </div>
          <div className="rounded-2xl overflow-hidden border border-[rgba(139,92,246,0.15)]" style={{ background: "#080808" }}>
            <div
              className="calendly-inline-widget"
              data-url="https://calendly.com/iugaclaudiu8/30min?primary_color=8700ff"
              style={{ minWidth: "320px", height: "700px" }}
            />
          </div>
        </div>
      </section>

      {/* ── FOOTER ────────────────────────────────────────────────── */}
      <footer className="border-t border-[rgba(139,92,246,0.08)] pt-20 pb-10" style={{ background: "#080808" }}>
        <div className="mx-auto max-w-[1200px] px-8">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-14 mb-16">
            <div>
              <div className="font-[family-name:var(--font-playfair)] font-bold text-xl tracking-wide gold mb-4">Scalero</div>
              <p className="text-[#8A8880] text-sm leading-[1.85] max-w-[220px] mb-6 font-light">Done-for-you marketing systems for local service businesses. We build it, we run it, you get the jobs.</p>
              <div className="flex gap-2">
                {["𝕏 Twitter","in LinkedIn"].map((s) => (
                  <a key={s} href="#" className="text-[0.7rem] font-medium text-[#8A8880] border border-[rgba(139,92,246,0.10)] rounded-lg px-3 py-1.5 hover:border-[rgba(139,92,246,0.25)] hover:text-[#8B5CF6] transition-all tracking-wide">{s}</a>
                ))}
              </div>
            </div>
            {[
              { head:"Product", links:["Features","Pricing","How It Works","Integrations","Changelog"] },
              { head:"Company", links:["About","Blog","Careers","Press","Contact"] },
              { head:"Legal",   links:["Privacy Policy","Terms of Service","HIPAA Compliance","Security","Cookie Policy"] },
            ].map(({ head, links }) => (
              <div key={head}>
                <h4 className="text-[0.63rem] font-semibold uppercase tracking-[0.22em] text-[#3A3A38] mb-5">{head}</h4>
                <ul className="flex flex-col gap-3">
                  {links.map((l) => <li key={l}><a href="#" className="text-[#8A8880] text-sm font-light hover:text-[#8B5CF6] transition-colors">{l}</a></li>)}
                </ul>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4 pt-8 border-t border-[rgba(139,92,246,0.08)]">
            <p className="text-[#3A3A38] text-[0.7rem] tracking-wide">© 2025 Scalero. All rights reserved.</p>
            <div className="flex flex-wrap gap-2">
              {[[<Shield key="s" className="w-3 h-3" />,"256-bit SSL"]].map(([icon,label]) => (
                <span key={String(label)} className="inline-flex items-center gap-1.5 text-[0.67rem] text-[#8A8880] border border-[rgba(139,92,246,0.08)] rounded-lg px-3 py-1.5 tracking-wide">{icon}{label}</span>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

// ─── Micro-components ─────────────────────────────────────────────────────────

function IconBadge({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-5 flex-shrink-0 border"
         style={{ color, background: `${color}18`, borderColor: `${color}30` }}>
      {children}
    </div>
  )
}

function Label({ children, c = "#8B5CF6" }: { children: React.ReactNode; c?: string }) {
  return <span className="block text-[0.63rem] font-semibold tracking-[0.18em] uppercase mb-2" style={{ color: c }}>{children}</span>
}

function Tags({ tags, c = "#8B5CF6", bc = "rgba(139,92,246,0.18)" }: { tags: string[]; c?: string; bc?: string }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((t) => (
        <span key={t} className="text-[0.65rem] font-medium px-2.5 py-1 rounded-full border" style={{ color: c, borderColor: bc, background: `${c}0D` }}>{t}</span>
      ))}
    </div>
  )
}

function GoldCard({ children, span, delay, idx, r }: { children: React.ReactNode; span?: string; delay: string; idx: number; r: (i: number) => (el: HTMLElement | null) => void }) {
  return (
    <div ref={r(idx)}
         className={`fu group p-8 rounded-2xl border border-[rgba(139,92,246,0.10)] bg-[rgba(139,92,246,0.02)] hover:border-[rgba(139,92,246,0.24)] hover:bg-[rgba(139,92,246,0.05)] transition-all duration-500 ${span??""}`}
         style={{ transitionDelay: delay }}>
      {children}
    </div>
  )
}

