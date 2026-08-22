import { ArrowRight, Bot, Check, CheckCircle2, ChevronDown, CircleDotDashed, Code2, Globe2, MessageCircle, MoveRight, ShieldCheck, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { DEFAULT_LOCALE, emailPlaceholders, getSiteCopy, isLocale, localeOptions, privateAccessLabels, SITE_CONTACT_EMAIL, type Locale } from "@/lib/siteI18n";

type FormState = {
  objective: string;
  currentChannel: string;
  bottleneck: string;
  urgency: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  consent: boolean;
};

const questionKeys = ["objective", "currentChannel", "bottleneck", "urgency"] as const;
const solutionIcons = [Code2, MessageCircle, Bot];
const initialForm: FormState = { objective: "", currentChannel: "", bottleneck: "", urgency: "", name: "", email: "", phone: "", company: "", consent: false };

function getInitialLocale(): Locale {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  const requested = new URLSearchParams(window.location.search).get("lang");
  if (isLocale(requested)) return requested;
  const stored = window.localStorage.getItem("altixdev-locale");
  if (isLocale(stored)) return stored;
  const browserLocale = navigator.language;
  if (isLocale(browserLocale)) return browserLocale;
  return localeOptions.find(option => browserLocale.toLowerCase().startsWith(option.code.split("-")[0].toLowerCase()))?.code ?? DEFAULT_LOCALE;
}

export default function Home() {
  const [locale, setLocale] = useState<Locale>(getInitialLocale);
  const [isLanguageMenuOpen, setIsLanguageMenuOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(initialForm);
  const languageMenuRef = useRef<HTMLDivElement>(null);
  const copy = getSiteCopy(locale);
  const questionSteps = copy.diagnostic.questionSteps;
  const selectedLocale = localeOptions.find(option => option.code === locale) ?? localeOptions[0];
  const analyticsTag = trpc.analytics.publicTag.useQuery(undefined, { refetchOnWindowFocus: false });

  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = copy.metaTitle;
    window.localStorage.setItem("altixdev-locale", locale);
  }, [copy.metaTitle, locale]);

  useEffect(() => {
    const measurementId = analyticsTag.data?.measurementId;
    if (!measurementId || document.querySelector(`script[data-altixdev-ga="${measurementId}"]`)) return;
    const analyticsWindow = window as Window & { dataLayer?: unknown[][]; gtag?: (...args: unknown[]) => void };
    analyticsWindow.dataLayer = analyticsWindow.dataLayer ?? [];
    analyticsWindow.gtag = analyticsWindow.gtag ?? ((...args: unknown[]) => analyticsWindow.dataLayer?.push(args));
    analyticsWindow.gtag("js", new Date());
    analyticsWindow.gtag("config", measurementId, { anonymize_ip: true });
    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
    script.dataset.altixdevGa = measurementId;
    document.head.appendChild(script);
  }, [analyticsTag.data?.measurementId]);

  useEffect(() => {
    if (!isLanguageMenuOpen) return;

    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!languageMenuRef.current?.contains(event.target as Node)) setIsLanguageMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsLanguageMenuOpen(false);
    };

    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isLanguageMenuOpen]);

  const createLead = trpc.leads.create.useMutation({
    onSuccess: ({ diagnosticSummary }) => {
      const message = `${copy.whatsappIntro} ${diagnosticSummary}`;
      window.location.assign(`https://wa.me/5591992261383?text=${encodeURIComponent(message)}`);
    },
    onError: () => toast.error(copy.toasts.createLeadError),
  });

  const isContactStep = step === questionSteps.length;
  const selected = isContactStep ? "" : form[questionKeys[step]];
  const progress = Math.round(((step + 1) / (questionSteps.length + 1)) * 100);
  const scrollToDiagnostic = () => document.getElementById("diagnostico")?.scrollIntoView({ behavior: "smooth" });

  const chooseOption = (value: string) => setForm(current => ({ ...current, [questionKeys[step]]: value }));
  const next = () => {
    if (!selected) return toast.error(copy.toasts.chooseOption);
    setStep(current => current + 1);
  };
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.consent) return toast.error(copy.toasts.consent);
    createLead.mutate({ ...form, company: form.company || undefined, consent: true });
  };
  const changeLocale = (nextLocale: Locale) => {
    if (nextLocale === locale) return;
    const url = new URL(window.location.href);
    url.searchParams.set("lang", nextLocale);
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    setLocale(nextLocale);
    setIsLanguageMenuOpen(false);
    setForm(initialForm);
    setStep(0);
  };

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#F7F8FC] text-[#08152D]">
      <section className="relative isolate overflow-hidden bg-[#071326] text-white">
        <div className="pointer-events-none absolute inset-0 opacity-70 [background:radial-gradient(circle_at_20%_20%,rgba(37,99,235,.38),transparent_30%),radial-gradient(circle_at_75%_40%,rgba(124,58,237,.24),transparent_28%)]" />
        <nav className="relative mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-6 lg:px-8">
          <a href="/" className="flex shrink-0 items-center gap-3" aria-label="Altixdev"><span className="grid h-10 w-10 place-items-center rounded-xl bg-white font-serif text-xl text-[#0B1730]">A</span><span className="font-semibold tracking-tight">altixdev</span></a>
          <div className="hidden gap-7 text-sm text-slate-300 md:flex"><a href="#solucoes" className="hover:text-white">{copy.nav.solutions}</a><a href="#processo" className="hover:text-white">{copy.nav.process}</a><a href="#diagnostico" className="hover:text-white">{copy.nav.diagnostic}</a></div>
          <div className="flex items-center gap-2 sm:gap-3">
            <div ref={languageMenuRef} className="relative">
              <button type="button" onClick={() => setIsLanguageMenuOpen(current => !current)} aria-haspopup="listbox" aria-expanded={isLanguageMenuOpen} aria-label={copy.languageLabel} className={`group relative flex h-10 max-w-[10.5rem] items-center gap-2 overflow-hidden rounded-xl border px-3 text-xs font-semibold text-white outline-none transition duration-200 focus-visible:ring-2 focus-visible:ring-[#AFCBFF] sm:max-w-none sm:min-w-[10.75rem] ${isLanguageMenuOpen ? "border-[#9FC1FF] bg-[#16366D]/80 shadow-[0_0_0_3px_rgba(82,137,255,.17),0_14px_34px_rgba(29,87,209,.24)]" : "border-white/15 bg-white/[.055] hover:border-[#85B0FF]/80 hover:bg-white/[.1] hover:shadow-[0_12px_28px_rgba(8,25,55,.28)]"}`}>
                <span className={`pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(104,165,255,.27),transparent_42%)] transition-opacity duration-300 ${isLanguageMenuOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`} />
                <Globe2 size={15} className="relative shrink-0 text-[#AFCBFF]" aria-hidden="true" />
                <span className="relative text-left sm:hidden">{locale.toUpperCase()}</span>
                <span className="relative hidden truncate text-left sm:block">{selectedLocale.label}</span>
                <ChevronDown size={15} className={`relative ml-auto shrink-0 text-[#AFCBFF] transition-transform duration-200 ${isLanguageMenuOpen ? "rotate-180" : ""}`} aria-hidden="true" />
              </button>
              {isLanguageMenuOpen ? <div role="listbox" aria-label={copy.languageLabel} className="absolute right-0 z-50 mt-3 w-[17rem] origin-top-right overflow-hidden rounded-2xl border border-white/15 bg-[#08172E]/95 p-1.5 shadow-[0_24px_60px_rgba(0,0,0,.42),0_0_0_1px_rgba(126,174,255,.08)] backdrop-blur-xl motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 motion-safe:slide-in-from-top-2">
                <div className="border-b border-white/10 px-3 pb-2.5 pt-1.5 text-[10px] font-bold uppercase tracking-[.18em] text-[#AFCBFF]">{copy.languageLabel}</div>
                <div className="mt-1 max-h-[min(65vh,28rem)] space-y-0.5 overflow-y-auto pr-0.5">{localeOptions.map(option => {
                  const active = option.code === locale;
                  return <button key={option.code} type="button" role="option" aria-selected={active} onClick={() => changeLocale(option.code)} className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm outline-none transition duration-150 focus-visible:ring-2 focus-visible:ring-[#AFCBFF] ${active ? "bg-[linear-gradient(100deg,rgba(47,107,255,.46),rgba(74,126,239,.13))] text-white shadow-[inset_0_0_0_1px_rgba(151,188,255,.36)]" : "text-slate-300 hover:bg-white/[.08] hover:text-white"}`}>
                    <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg border text-[9px] font-bold tracking-wide ${active ? "border-[#AFCBFF]/70 bg-[#2F6BFF] text-white shadow-[0_0_18px_rgba(74,137,255,.52)]" : "border-white/10 bg-white/[.045] text-slate-400 group-hover:border-white/20 group-hover:text-slate-200"}`}>{option.code.split("-")[0].toUpperCase()}</span>
                    <span className="min-w-0 flex-1 truncate">{option.label}</span>
                    {active ? <Check size={15} className="shrink-0 text-[#B8D3FF]" aria-hidden="true" /> : <span className="h-2 w-2 shrink-0 rounded-full bg-slate-600/70 transition group-hover:bg-[#8AB6FF]" aria-hidden="true" />}
                  </button>;
                })}</div>
              </div> : null}
            </div>
            <button onClick={scrollToDiagnostic} className="hidden rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-[#0B1730] transition hover:-translate-y-0.5 sm:inline-flex">{copy.nav.start}</button>
          </div>
        </nav>

        <div className="relative mx-auto grid max-w-7xl gap-12 px-5 pb-14 pt-12 lg:grid-cols-[1.05fr_.95fr] lg:px-8 lg:pb-20 lg:pt-20">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-[#AFCBFF]"><Sparkles size={14} /> {copy.hero.badge}</div>
            <h1 className="mt-7 font-serif text-5xl leading-[.98] tracking-[-.05em] sm:text-6xl lg:text-7xl">{copy.hero.title}</h1>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-slate-300">{copy.hero.description}</p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row"><button onClick={scrollToDiagnostic} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#2F6BFF] px-5 py-3.5 text-sm font-semibold shadow-[0_18px_60px_rgba(47,107,255,.35)] transition hover:-translate-y-0.5">{copy.hero.primaryCta} <ArrowRight size={17} /></button><a href="#como-ajudamos" className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 px-5 py-3.5 text-sm font-semibold text-white hover:bg-white/5">{copy.hero.secondaryCta} <MoveRight size={17} /></a></div>
            <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-300">{copy.hero.highlights.map(item => <span key={item} className="inline-flex items-center gap-2"><Check size={14} className="text-[#8AB6FF]" /> {item}</span>)}</div>
          </div>
          <div className="relative mx-auto flex w-full max-w-lg items-center justify-center"><div className="absolute h-[22rem] w-[22rem] rounded-full border border-white/10" /><div className="absolute h-[16rem] w-[16rem] rounded-full border border-dashed border-white/15" /><div className="relative w-full rounded-3xl border border-white/10 bg-white/[.07] p-7 shadow-[0_30px_90px_rgba(0,0,0,.32)] backdrop-blur"><p className="text-xs font-bold uppercase tracking-[.18em] text-[#AFCBFF]">{copy.heroPanel.eyebrow}</p><div className="mt-6 space-y-3">{copy.heroPanel.items.map((item, index) => <div key={item} className="flex items-center gap-4 rounded-2xl border border-white/10 bg-[#0A1A35]/80 px-4 py-3"><span className="grid h-8 w-8 place-items-center rounded-lg bg-[#2F6BFF] text-xs font-bold">0{index + 1}</span><span className="text-sm font-medium">{item}</span><ArrowRight className="ml-auto shrink-0 text-[#8AB6FF]" size={16} /></div>)}</div><div className="mt-6 flex items-center gap-3 border-t border-white/10 pt-5 text-sm text-slate-300"><CircleDotDashed className="shrink-0 text-[#AFCBFF]" size={18} /> {copy.heroPanel.bottom}</div></div></div>
        </div>
        <div className="relative mx-auto grid max-w-7xl border-t border-white/10 px-5 lg:grid-cols-3 lg:px-8">{copy.deliverables.map((item, index) => <div key={item} className={`flex items-center gap-3 py-5 text-sm text-slate-200 ${index !== 2 ? "lg:border-r lg:border-white/10" : ""}`}><span className="grid h-7 w-7 place-items-center rounded-full bg-white/10 text-xs font-bold text-[#AFCBFF]">{index + 1}</span>{item}</div>)}</div>
      </section>

      <section id="solucoes" className="mx-auto max-w-7xl px-5 py-20 lg:px-8 lg:py-28"><div className="max-w-2xl"><p className="text-xs font-bold uppercase tracking-[.18em] text-[#2563EB]">{copy.solutions.eyebrow}</p><h2 className="mt-4 font-serif text-4xl tracking-[-.04em] sm:text-5xl">{copy.solutions.title}</h2><p className="mt-5 leading-7 text-slate-600">{copy.solutions.description}</p></div><div className="mt-12 grid gap-4 md:grid-cols-3">{copy.solutions.cards.map((item, index) => { const Icon = solutionIcons[index] ?? Code2; return <article key={item.title} className="group rounded-3xl border border-slate-200 bg-white p-7 shadow-[0_18px_40px_rgba(15,23,42,.05)] transition hover:-translate-y-1 hover:border-[#B8CCFF]"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#EEF3FF] text-[#2563EB]"><Icon size={23} /></span><h3 className="mt-8 font-serif text-2xl">{item.title}</h3><p className="mt-3 leading-7 text-slate-600">{item.text}</p><div className="mt-7 h-px w-10 bg-[#2563EB] transition-all group-hover:w-16" /></article>; })}</div></section>

      <section id="como-ajudamos" className="border-y border-slate-200 bg-white"><div className="mx-auto grid max-w-7xl gap-12 px-5 py-20 lg:grid-cols-[.82fr_1.18fr] lg:px-8 lg:py-28"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-[#2563EB]">{copy.friction.eyebrow}</p><h2 className="mt-4 font-serif text-4xl tracking-[-.04em]">{copy.friction.title}</h2><p className="mt-6 max-w-md leading-7 text-slate-600">{copy.friction.description}</p><button onClick={scrollToDiagnostic} className="mt-8 inline-flex items-center gap-2 rounded-xl bg-[#0B1730] px-5 py-3.5 text-sm font-semibold text-white transition hover:-translate-y-0.5">{copy.friction.cta} <ArrowRight size={17} /></button></div><div className="grid gap-4 sm:grid-cols-2"><article className="border-t-2 border-[#2F6BFF] pt-5"><p className="text-xs font-bold uppercase tracking-[.16em] text-[#2563EB]">{copy.friction.positiveTitle}</p><ul className="mt-5 space-y-3 text-sm leading-6 text-slate-600">{copy.friction.positiveItems.map(item => <li key={item} className="flex gap-3"><Check size={16} className="mt-1 shrink-0 text-[#2563EB]" />{item}</li>)}</ul></article><article className="border-t border-slate-200 pt-5"><p className="text-xs font-bold uppercase tracking-[.16em] text-slate-500">{copy.friction.negativeTitle}</p><ul className="mt-5 space-y-3 text-sm leading-6 text-slate-600">{copy.friction.negativeItems.map(item => <li key={item} className="flex gap-3"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />{item}</li>)}</ul></article></div></div></section>

      <section id="processo" className="mx-auto max-w-7xl px-5 py-20 lg:px-8 lg:py-28"><div className="grid gap-12 lg:grid-cols-[.85fr_1.15fr]"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-[#2563EB]">{copy.process.eyebrow}</p><h2 className="mt-4 font-serif text-4xl tracking-[-.04em]">{copy.process.title}</h2><p className="mt-6 max-w-md leading-7 text-slate-600">{copy.process.description}</p></div><div className="grid gap-4 sm:grid-cols-2">{copy.process.steps.map((item, index) => <div key={item.title} className="border-t border-slate-200 pt-5"><span className="text-sm font-bold text-[#2563EB]">0{index + 1}</span><h3 className="mt-3 font-serif text-2xl">{item.title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{item.text}</p></div>)}</div></div></section>

      <section className="border-y border-slate-200 bg-white"><div className="mx-auto max-w-7xl px-5 py-20 lg:px-8 lg:py-24"><div className="max-w-2xl"><p className="text-xs font-bold uppercase tracking-[.18em] text-[#2563EB]">{copy.faq.eyebrow}</p><h2 className="mt-4 font-serif text-4xl tracking-[-.04em]">{copy.faq.title}</h2></div><div className="mt-10 grid gap-3 lg:grid-cols-2">{copy.faq.items.map(item => <details key={item.question} className="group border-b border-slate-200 py-5"><summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-slate-800"><span>{item.question}</span><span className="text-xl font-normal text-[#2563EB] transition group-open:rotate-45">+</span></summary><p className="max-w-xl pt-3 text-sm leading-6 text-slate-600">{item.answer}</p></details>)}</div></div></section>

      <section id="diagnostico" className="bg-[#EAF0FF] px-5 py-20 lg:py-28"><div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[.8fr_1.2fr] lg:px-8"><div className="lg:pt-8"><p className="text-xs font-bold uppercase tracking-[.18em] text-[#2563EB]">{copy.diagnostic.eyebrow}</p><h2 className="mt-4 font-serif text-4xl tracking-[-.04em] sm:text-5xl">{copy.diagnostic.title}</h2><p className="mt-6 max-w-md leading-7 text-slate-600">{copy.diagnostic.description}</p><div className="mt-8 space-y-4">{copy.diagnostic.benefits.map(item => <div key={item} className="flex items-start gap-3 text-sm leading-6 text-slate-600"><ShieldCheck className="mt-0.5 shrink-0 text-[#2563EB]" size={18} />{item}</div>)}</div></div>
        <section className="rounded-[2rem] bg-white p-6 shadow-[0_25px_70px_rgba(37,99,235,.14)] sm:p-9"><div className="flex items-center justify-between gap-4"><p className="text-xs font-bold uppercase tracking-[.16em] text-[#2563EB]">{isContactStep ? copy.diagnostic.contactEyebrow : questionSteps[step].eyebrow}</p><span className="shrink-0 text-xs font-semibold text-slate-400">{copy.diagnostic.progress.replace("{{progress}}", String(progress))}</span></div><div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#2F6BFF] transition-all duration-300" style={{ width: `${progress}%` }} /></div>{!isContactStep ? <><h3 className="mt-8 font-serif text-3xl tracking-[-.03em]">{questionSteps[step].title}</h3><p className="mt-3 text-sm leading-6 text-slate-500">{copy.diagnostic.responseNotice}</p><div className="mt-7 grid gap-3">{questionSteps[step].options.map(option => <button key={option} type="button" onClick={() => chooseOption(option)} className={`flex items-center justify-between gap-4 rounded-2xl border px-5 py-4 text-left text-sm font-semibold transition ${selected === option ? "border-[#2563EB] bg-[#EEF3FF] text-[#1746BA]" : "border-slate-200 text-slate-700 hover:border-[#9DB9FF]"}`}><span>{option}</span><span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border ${selected === option ? "border-[#2563EB] bg-[#2563EB] text-white" : "border-slate-300"}`}>{selected === option ? <CheckCircle2 size={13} /> : null}</span></button>)}</div><div className="mt-8 flex justify-between gap-3"><button type="button" disabled={step === 0} onClick={() => setStep(current => current - 1)} className="rounded-xl px-4 py-3 text-sm font-semibold text-slate-500 disabled:opacity-40">{copy.diagnostic.back}</button><button type="button" onClick={next} className="inline-flex items-center gap-2 rounded-xl bg-[#0B1730] px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5">{copy.diagnostic.continue} <ArrowRight size={16} /></button></div></> : <form onSubmit={submit}><h3 className="mt-8 font-serif text-3xl tracking-[-.03em]">{copy.diagnostic.contactTitle}</h3><p className="mt-3 text-sm leading-6 text-slate-600">{copy.diagnostic.contactDescription}</p><div className="mt-7 grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold text-slate-700">{copy.diagnostic.fields.name}<input required value={form.name} onChange={event => setForm(current => ({ ...current, name: event.target.value }))} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-normal outline-none focus:border-[#2563EB]" placeholder={copy.diagnostic.fields.namePlaceholder} /></label><label className="text-sm font-semibold text-slate-700">{copy.diagnostic.fields.company}<input value={form.company} onChange={event => setForm(current => ({ ...current, company: event.target.value }))} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-normal outline-none focus:border-[#2563EB]" placeholder={copy.diagnostic.fields.companyPlaceholder} /></label><label className="text-sm font-semibold text-slate-700">{copy.diagnostic.fields.email}<input required type="email" value={form.email} onChange={event => setForm(current => ({ ...current, email: event.target.value }))} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-normal outline-none focus:border-[#2563EB]" placeholder={emailPlaceholders[locale]} /></label><label className="text-sm font-semibold text-slate-700">{copy.diagnostic.fields.phone}<input required value={form.phone} onChange={event => setForm(current => ({ ...current, phone: event.target.value }))} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-normal outline-none focus:border-[#2563EB]" placeholder={copy.diagnostic.fields.phonePlaceholder} /></label></div><label className="mt-6 flex cursor-pointer items-start gap-3 rounded-xl bg-slate-50 p-4 text-xs leading-5 text-slate-600"><input type="checkbox" checked={form.consent} onChange={event => setForm(current => ({ ...current, consent: event.target.checked }))} className="mt-0.5 h-4 w-4 accent-[#2563EB]" /><span>{copy.diagnostic.consent}</span></label><div className="mt-4 rounded-xl border border-[#CFE0FF] bg-[#F7FAFF] p-3 text-xs leading-5 text-slate-600">{copy.diagnostic.privacyNotice}</div><div className="mt-7 flex justify-between gap-3"><button type="button" onClick={() => setStep(current => current - 1)} className="rounded-xl px-4 py-3 text-sm font-semibold text-slate-500">{copy.diagnostic.back}</button><button disabled={createLead.isPending} className="inline-flex items-center gap-2 rounded-xl bg-[#2F6BFF] px-5 py-3 text-sm font-semibold text-white shadow-[0_15px_35px_rgba(47,107,255,.25)] disabled:opacity-60">{createLead.isPending ? copy.diagnostic.submitting : copy.diagnostic.submit} <MessageCircle size={17} /></button></div></form>}</section>
      </div></section>

      <footer className="bg-[#071326] px-5 py-10 text-slate-300"><div className="mx-auto flex max-w-7xl flex-col gap-5 text-sm sm:flex-row sm:items-center sm:justify-between lg:px-8"><div><strong className="text-white">altixdev</strong><span className="ml-3 text-slate-500">{copy.footerTagline}</span></div><div className="flex gap-5"><a href={`mailto:${SITE_CONTACT_EMAIL}`} className="hover:text-white">{SITE_CONTACT_EMAIL}</a><a href="/painel" className="text-slate-500 hover:text-white">{privateAccessLabels[locale]}</a></div></div></footer>
    </main>
  );
}
