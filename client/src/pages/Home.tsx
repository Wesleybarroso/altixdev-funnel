import { ArrowRight, Bot, Check, CheckCircle2, CircleDotDashed, Code2, MessageCircle, MoveRight, ShieldCheck, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

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

const questionSteps = [
  { key: "objective", eyebrow: "01 · Resultado desejado", title: "O que você quer tornar mais eficiente agora?", options: ["Gerar mais oportunidades", "Converter mais contatos", "Reduzir tarefas manuais", "Organizar uma operação digital"] },
  { key: "currentChannel", eyebrow: "02 · Canal atual", title: "Onde suas conversas e oportunidades começam hoje?", options: ["Instagram", "WhatsApp", "Indicação", "Site", "E-mail", "Outro"] },
  { key: "bottleneck", eyebrow: "03 · Principal gargalo", title: "Qual ponto mais trava seu avanço?", options: ["Site não explica bem a solução", "Leads não recebem resposta a tempo", "Atendimento é muito repetitivo", "Falta de processo comercial"] },
  { key: "urgency", eyebrow: "04 · Momento da decisão", title: "Qual é a urgência para resolver isso?", options: ["Quero começar nas próximas semanas", "Estou comparando soluções", "Quero estruturar o plano primeiro", "Ainda estou entendendo o problema"] },
] as const;

const initialForm: FormState = { objective: "", currentChannel: "", bottleneck: "", urgency: "", name: "", email: "", phone: "", company: "", consent: false };

const diagnosticDeliverables = ["Diagnóstico do principal gargalo", "Direção de site, WhatsApp ou IA", "Resumo da conversa já contextualizado"];

export default function Home() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(initialForm);
  const analyticsTag = trpc.analytics.publicTag.useQuery(undefined, { refetchOnWindowFocus: false });
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
  const createLead = trpc.leads.create.useMutation({
    onSuccess: ({ diagnosticSummary }) => {
      const message = `Olá, Wesley! Concluí o diagnóstico da Altixdev e gostaria de conversar. ${diagnosticSummary}`;
      window.location.assign(`https://wa.me/5591992261383?text=${encodeURIComponent(message)}`);
    },
    onError: () => toast.error("Não conseguimos registrar seu diagnóstico. Revise os dados e tente novamente."),
  });
  const isContactStep = step === questionSteps.length;
  const selected = isContactStep ? "" : form[questionSteps[step].key];
  const progress = Math.round(((step + 1) / (questionSteps.length + 1)) * 100);

  const chooseOption = (value: string) => {
    const key = questionSteps[step].key;
    setForm(current => ({ ...current, [key]: value }));
  };

  const next = () => {
    if (!selected) return toast.error("Escolha uma opção para continuar.");
    setStep(current => current + 1);
  };

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.consent) return toast.error("Confirme o consentimento para enviar o diagnóstico.");
    createLead.mutate({ ...form, company: form.company || undefined, consent: true });
  };

  const scrollToDiagnostic = () => document.getElementById("diagnostico")?.scrollIntoView({ behavior: "smooth" });

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#F7F8FC] text-[#08152D]">
      <section className="relative isolate overflow-hidden bg-[#071326] text-white">
        <div className="pointer-events-none absolute inset-0 opacity-70 [background:radial-gradient(circle_at_20%_20%,rgba(37,99,235,.38),transparent_30%),radial-gradient(circle_at_75%_40%,rgba(124,58,237,.24),transparent_28%)]" />
        <nav className="relative mx-auto flex max-w-7xl items-center justify-between px-5 py-6 lg:px-8">
          <a href="/" className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-white font-serif text-xl text-[#0B1730]">A</span><span className="font-semibold tracking-tight">altixdev</span></a>
          <div className="hidden gap-7 text-sm text-slate-300 md:flex"><a href="#solucoes" className="hover:text-white">Soluções</a><a href="#processo" className="hover:text-white">Como funciona</a><a href="#diagnostico" className="hover:text-white">Diagnóstico</a></div>
          <button onClick={scrollToDiagnostic} className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-[#0B1730] transition hover:-translate-y-0.5">Começar diagnóstico</button>
        </nav>

        <div className="relative mx-auto grid max-w-7xl gap-12 px-5 pb-14 pt-12 lg:grid-cols-[1.05fr_.95fr] lg:px-8 lg:pb-20 lg:pt-20">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-[#AFCBFF]"><Sparkles size={14} /> Diagnóstico gratuito em 5 etapas</div>
            <h1 className="mt-7 font-serif text-5xl leading-[.98] tracking-[-.05em] sm:text-6xl lg:text-7xl">Transforme visitas e mensagens em oportunidades com contexto.</h1>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-slate-300">Wesley une site, automação de WhatsApp e IA para ajudar sua empresa a explicar melhor a oferta, responder com mais clareza e conduzir cada contato até o próximo passo.</p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row"><button onClick={scrollToDiagnostic} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#2F6BFF] px-5 py-3.5 text-sm font-semibold shadow-[0_18px_60px_rgba(47,107,255,.35)] transition hover:-translate-y-0.5">Ver meu diagnóstico gratuito <ArrowRight size={17} /></button><a href="#como-ajudamos" className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 px-5 py-3.5 text-sm font-semibold text-white hover:bg-white/5">Entender o processo <MoveRight size={17} /></a></div>
            <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-300"><span className="inline-flex items-center gap-2"><Check size={14} className="text-[#8AB6FF]" /> Sem compromisso de contratação</span><span className="inline-flex items-center gap-2"><Check size={14} className="text-[#8AB6FF]" /> Resumo antes de abrir o WhatsApp</span></div>
          </div>
          <div className="relative mx-auto flex w-full max-w-lg items-center justify-center"><div className="absolute h-[22rem] w-[22rem] rounded-full border border-white/10" /><div className="absolute h-[16rem] w-[16rem] rounded-full border border-dashed border-white/15" /><div className="relative w-full rounded-3xl border border-white/10 bg-white/[.07] p-7 shadow-[0_30px_90px_rgba(0,0,0,.32)] backdrop-blur"><p className="text-xs font-bold uppercase tracking-[.18em] text-[#AFCBFF]">O que o diagnóstico organiza</p><div className="mt-6 space-y-3">{["Onde o lead entra hoje", "Qual ponto está esfriando a conversa", "O menor próximo passo para testar", "Como Wesley recebe o contexto"].map((item, index) => <div key={item} className="flex items-center gap-4 rounded-2xl border border-white/10 bg-[#0A1A35]/80 px-4 py-3"><span className="grid h-8 w-8 place-items-center rounded-lg bg-[#2F6BFF] text-xs font-bold">0{index + 1}</span><span className="text-sm font-medium">{item}</span><ArrowRight className="ml-auto text-[#8AB6FF]" size={16} /></div>)}</div><div className="mt-6 flex items-center gap-3 border-t border-white/10 pt-5 text-sm text-slate-300"><CircleDotDashed className="text-[#AFCBFF]" size={18} /> Você chega à conversa sem repetir tudo do zero.</div></div></div>
        </div>
        <div className="relative mx-auto grid max-w-7xl border-t border-white/10 px-5 lg:grid-cols-3 lg:px-8">{diagnosticDeliverables.map((item, index) => <div key={item} className={`flex items-center gap-3 py-5 text-sm text-slate-200 ${index !== 2 ? "lg:border-r lg:border-white/10" : ""}`}><span className="grid h-7 w-7 place-items-center rounded-full bg-white/10 text-xs font-bold text-[#AFCBFF]">{index + 1}</span>{item}</div>)}</div>
      </section>

      <section id="solucoes" className="mx-auto max-w-7xl px-5 py-20 lg:px-8 lg:py-28"><div className="max-w-2xl"><p className="text-xs font-bold uppercase tracking-[.18em] text-[#2563EB]">Soluções que se conectam</p><h2 className="mt-4 font-serif text-4xl tracking-[-.04em] sm:text-5xl">Mais clareza na mensagem. Menos fricção no caminho até a venda.</h2><p className="mt-5 leading-7 text-slate-600">Cada solução existe para resolver uma parte da mesma jornada: atrair a pessoa certa, explicar a oferta e conduzir o contato com consistência.</p></div><div className="mt-12 grid gap-4 md:grid-cols-3">{[{ icon: Code2, title: "Sites que posicionam", text: "Páginas que explicam sua solução, criam confiança e mostram com clareza o próximo passo." }, { icon: MessageCircle, title: "WhatsApp que organiza", text: "Fluxos de atendimento para responder, qualificar e transferir o contexto ao seu time." }, { icon: Bot, title: "IA com limites claros", text: "Automação com temas aprovados, rota humana e melhoria contínua conforme a operação." }].map(item => <article key={item.title} className="group rounded-3xl border border-slate-200 bg-white p-7 shadow-[0_18px_40px_rgba(15,23,42,.05)] transition hover:-translate-y-1 hover:border-[#B8CCFF]"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#EEF3FF] text-[#2563EB]"><item.icon size={23} /></span><h3 className="mt-8 font-serif text-2xl">{item.title}</h3><p className="mt-3 leading-7 text-slate-600">{item.text}</p><div className="mt-7 h-px w-10 bg-[#2563EB] transition-all group-hover:w-16" /></article>)}</div></section>

      <section id="como-ajudamos" className="border-y border-slate-200 bg-white"><div className="mx-auto grid max-w-7xl gap-12 px-5 py-20 lg:grid-cols-[.82fr_1.18fr] lg:px-8 lg:py-28"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-[#2563EB]">Onde a Altixdev ajuda mais</p><h2 className="mt-4 font-serif text-4xl tracking-[-.04em]">Não comece pelo código. Comece pelo gargalo que está custando conversas.</h2><p className="mt-6 max-w-md leading-7 text-slate-600">O diagnóstico é ideal para empresas que já recebem algum interesse, mas precisam transformar esforço em uma experiência mais clara para o lead e para a equipe.</p><button onClick={scrollToDiagnostic} className="mt-8 inline-flex items-center gap-2 rounded-xl bg-[#0B1730] px-5 py-3.5 text-sm font-semibold text-white transition hover:-translate-y-0.5">Identificar meu gargalo <ArrowRight size={17} /></button></div><div className="grid gap-4 sm:grid-cols-2"><article className="border-t-2 border-[#2F6BFF] pt-5"><p className="text-xs font-bold uppercase tracking-[.16em] text-[#2563EB]">Bom momento para começar</p><ul className="mt-5 space-y-3 text-sm leading-6 text-slate-600">{["Sua empresa recebe contatos, mas perde contexto.", "O site não deixa clara a diferença da sua solução.", "A equipe repete respostas ou demora a voltar.", "Você quer testar um fluxo antes de uma mudança maior."].map(item => <li key={item} className="flex gap-3"><Check size={16} className="mt-1 shrink-0 text-[#2563EB]" />{item}</li>)}</ul></article><article className="border-t border-slate-200 pt-5"><p className="text-xs font-bold uppercase tracking-[.16em] text-slate-500">O que não prometemos</p><ul className="mt-5 space-y-3 text-sm leading-6 text-slate-600">{["Automação sem limite ou sem responsável humano.", "Resultado garantido sem entender a operação.", "Uma proposta genérica antes do diagnóstico.", "Contato insistente depois de você pedir para parar."].map(item => <li key={item} className="flex gap-3"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />{item}</li>)}</ul></article></div></div></section>

      <section id="processo" className="mx-auto max-w-7xl px-5 py-20 lg:px-8 lg:py-28"><div className="grid gap-12 lg:grid-cols-[.85fr_1.15fr]"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-[#2563EB]">Como funciona</p><h2 className="mt-4 font-serif text-4xl tracking-[-.04em]">Wesley transforma tecnologia em uma jornada comercial mais simples.</h2><p className="mt-6 max-w-md leading-7 text-slate-600">Você não precisa começar com um projeto gigante. A Altixdev começa entendendo o objetivo, o gargalo e a menor mudança capaz de gerar aprendizado antes de ampliar qualquer automação.</p></div><div className="grid gap-4 sm:grid-cols-2">{[{ n: "01", title: "Descobrir", text: "Mapeamos objetivo, canal, gargalo e urgência." }, { n: "02", title: "Desenhar", text: "Conectamos mensagem, site, WhatsApp e pessoas." }, { n: "03", title: "Implantar", text: "Construímos com escopo, limites e responsáveis." }, { n: "04", title: "Evoluir", text: "Medimos, ajustamos e ampliamos o que faz sentido." }].map(item => <div key={item.n} className="border-t border-slate-200 pt-5"><span className="text-sm font-bold text-[#2563EB]">{item.n}</span><h3 className="mt-3 font-serif text-2xl">{item.title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{item.text}</p></div>)}</div></div></section>

      <section className="border-y border-slate-200 bg-white"><div className="mx-auto max-w-7xl px-5 py-20 lg:px-8 lg:py-24"><div className="max-w-2xl"><p className="text-xs font-bold uppercase tracking-[.18em] text-[#2563EB]">Antes de começar</p><h2 className="mt-4 font-serif text-4xl tracking-[-.04em]">Dúvidas comuns, respondidas com clareza.</h2></div><div className="mt-10 grid gap-3 lg:grid-cols-2">{[{ q: "O diagnóstico me obriga a contratar?", a: "Não. Ele serve para organizar o contexto e indicar um caminho de conversa. Você decide se quer seguir depois." }, { q: "Preciso já ter um site ou automação?", a: "Não. O diagnóstico também é útil quando você quer entender por onde começar e qual prioridade faz mais sentido." }, { q: "A IA substitui todo o atendimento?", a: "Não. A Altixdev trabalha com limites, assuntos aprovados e encaminhamento humano quando o contexto pede uma pessoa." }, { q: "O que acontece depois de enviar meus dados?", a: "O lead é registrado no painel da Altixdev, o resumo é incluído na mensagem de WhatsApp e Wesley pode continuar a conversa se você autorizar." }].map(item => <details key={item.q} className="group border-b border-slate-200 py-5"><summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-slate-800"><span>{item.q}</span><span className="text-xl font-normal text-[#2563EB] transition group-open:rotate-45">+</span></summary><p className="max-w-xl pt-3 text-sm leading-6 text-slate-600">{item.a}</p></details>)}</div></div></section>

      <section id="diagnostico" className="bg-[#EAF0FF] px-5 py-20 lg:py-28"><div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[.8fr_1.2fr] lg:px-8"><div className="lg:pt-8"><p className="text-xs font-bold uppercase tracking-[.18em] text-[#2563EB]">Diagnóstico guiado</p><h2 className="mt-4 font-serif text-4xl tracking-[-.04em] sm:text-5xl">Encontre o próximo passo mais útil antes de pedir uma proposta.</h2><p className="mt-6 max-w-md leading-7 text-slate-600">Em cinco etapas, você organiza o cenário. Ao final, Wesley recebe um resumo da necessidade e o WhatsApp abre com a conversa já preparada.</p><div className="mt-8 space-y-4">{["Você escolhe apenas respostas relevantes ao seu contexto.", "O registro evita que você precise explicar tudo novamente.", "O contato só continua se você consentir no formulário."].map(item => <div key={item} className="flex items-start gap-3 text-sm leading-6 text-slate-600"><ShieldCheck className="mt-0.5 shrink-0 text-[#2563EB]" size={18} />{item}</div>)}</div></div>
        <section className="rounded-[2rem] bg-white p-6 shadow-[0_25px_70px_rgba(37,99,235,.14)] sm:p-9"><div className="flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-[.16em] text-[#2563EB]">{isContactStep ? "05 · Seus dados" : questionSteps[step].eyebrow}</p><span className="text-xs font-semibold text-slate-400">{progress}% concluído</span></div><div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#2F6BFF] transition-all duration-300" style={{ width: `${progress}%` }} /></div>{!isContactStep ? <><h3 className="mt-8 font-serif text-3xl tracking-[-.03em]">{questionSteps[step].title}</h3><p className="mt-3 text-sm leading-6 text-slate-500">Sua resposta será usada apenas para montar um resumo mais útil para a conversa.</p><div className="mt-7 grid gap-3">{questionSteps[step].options.map(option => <button key={option} type="button" onClick={() => chooseOption(option)} className={`flex items-center justify-between rounded-2xl border px-5 py-4 text-left text-sm font-semibold transition ${selected === option ? "border-[#2563EB] bg-[#EEF3FF] text-[#1746BA]" : "border-slate-200 text-slate-700 hover:border-[#9DB9FF]"}`}><span>{option}</span><span className={`grid h-5 w-5 place-items-center rounded-full border ${selected === option ? "border-[#2563EB] bg-[#2563EB] text-white" : "border-slate-300"}`}>{selected === option ? <CheckCircle2 size={13} /> : null}</span></button>)}</div><div className="mt-8 flex justify-between gap-3"><button type="button" disabled={step === 0} onClick={() => setStep(current => current - 1)} className="rounded-xl px-4 py-3 text-sm font-semibold text-slate-500 disabled:opacity-40">Voltar</button><button type="button" onClick={next} className="inline-flex items-center gap-2 rounded-xl bg-[#0B1730] px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5">Continuar <ArrowRight size={16} /></button></div></> : <form onSubmit={submit}><h3 className="mt-8 font-serif text-3xl tracking-[-.03em]">Envie o resumo para sua conversa no WhatsApp.</h3><p className="mt-3 text-sm leading-6 text-slate-600">Registramos o diagnóstico no pipeline da Altixdev e abrimos o WhatsApp com o contexto já incluído.</p><div className="mt-7 grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold text-slate-700">Nome<input required value={form.name} onChange={event => setForm(current => ({ ...current, name: event.target.value }))} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-normal outline-none focus:border-[#2563EB]" placeholder="Como podemos chamar você?" /></label><label className="text-sm font-semibold text-slate-700">Empresa<input value={form.company} onChange={event => setForm(current => ({ ...current, company: event.target.value }))} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-normal outline-none focus:border-[#2563EB]" placeholder="Nome da empresa" /></label><label className="text-sm font-semibold text-slate-700">E-mail<input required type="email" value={form.email} onChange={event => setForm(current => ({ ...current, email: event.target.value }))} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-normal outline-none focus:border-[#2563EB]" placeholder="voce@empresa.com" /></label><label className="text-sm font-semibold text-slate-700">WhatsApp<input required value={form.phone} onChange={event => setForm(current => ({ ...current, phone: event.target.value }))} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-normal outline-none focus:border-[#2563EB]" placeholder="(00) 00000-0000" /></label></div><label className="mt-6 flex cursor-pointer items-start gap-3 rounded-xl bg-slate-50 p-4 text-xs leading-5 text-slate-600"><input type="checkbox" checked={form.consent} onChange={event => setForm(current => ({ ...current, consent: event.target.checked }))} className="mt-0.5 h-4 w-4 accent-[#2563EB]" /><span>Autorizo a Altixdev a usar meus dados para responder ao meu pedido, enviar o resumo deste diagnóstico e fazer contato sobre esta oportunidade. Posso solicitar a interrupção do contato a qualquer momento.</span></label><div className="mt-4 rounded-xl border border-[#CFE0FF] bg-[#F7FAFF] p-3 text-xs leading-5 text-slate-600">Ao continuar, você verá a mensagem com suas respostas no WhatsApp. Não há envio automático de propostas nem inclusão em listas sem autorização.</div><div className="mt-7 flex justify-between gap-3"><button type="button" onClick={() => setStep(current => current - 1)} className="rounded-xl px-4 py-3 text-sm font-semibold text-slate-500">Voltar</button><button disabled={createLead.isPending} className="inline-flex items-center gap-2 rounded-xl bg-[#2F6BFF] px-5 py-3 text-sm font-semibold text-white shadow-[0_15px_35px_rgba(47,107,255,.25)] disabled:opacity-60">{createLead.isPending ? "Salvando…" : "Ver resumo e falar no WhatsApp"} <MessageCircle size={17} /></button></div></form>}</section>
      </div></section>

      <footer className="bg-[#071326] px-5 py-10 text-slate-300"><div className="mx-auto flex max-w-7xl flex-col gap-5 text-sm sm:flex-row sm:items-center sm:justify-between lg:px-8"><div><strong className="text-white">altixdev</strong><span className="ml-3 text-slate-500">Tecnologia que prepara conversas melhores.</span></div><div className="flex gap-5"><a href="mailto:contato@altixdev.com" className="hover:text-white">contato@altixdev.com</a><a href="/painel" className="text-slate-500 hover:text-white">Acesso privado</a></div></div></footer>
    </main>
  );
}
