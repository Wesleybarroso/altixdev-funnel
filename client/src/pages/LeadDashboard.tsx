import { trpc } from "@/lib/trpc";
import { Check, LayoutDashboard, LockKeyhole, LogOut, Mail, Search, ShieldCheck, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

const stageLabel = {
  new: "Novo",
  diagnostic: "Diagnóstico",
  proposal: "Proposta",
  won: "Fechado",
  lost: "Perdido",
} as const;

const priorityLabel = { low: "Baixa", medium: "Média", high: "Alta" } as const;

export default function LeadDashboard() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState<"" | keyof typeof stageLabel>("");
  const queryInput = useMemo(() => ({ search: search || undefined, stage: stage || undefined }), [search, stage]);
  const utils = trpc.useUtils();
  const adminStatus = trpc.auth.adminStatus.useQuery();
  const hasAccess = adminStatus.data?.authenticated === true;
  const leadsQuery = trpc.leads.list.useQuery(queryInput, { enabled: hasAccess });
  const metricsQuery = trpc.leads.metrics.useQuery(undefined, { enabled: hasAccess });
  const adminLogin = trpc.auth.adminLogin.useMutation({
    onSuccess: () => {
      setPassword("");
      toast.success("Acesso liberado.");
      window.location.assign("/painel");
    },
    onError: () => toast.error("E-mail ou senha inválidos."),
  });
  const adminLogout = trpc.auth.adminLogout.useMutation({
    onSuccess: () => {
      utils.auth.adminStatus.invalidate();
      utils.leads.list.invalidate();
      toast.success("Sessão encerrada.");
    },
  });
  const updateMutation = trpc.leads.update.useMutation({
    onSuccess: () => {
      utils.leads.list.invalidate();
      utils.leads.metrics.invalidate();
      toast.success("Lead atualizado.");
    },
    onError: () => toast.error("Não foi possível atualizar o lead."),
  });

  if (adminStatus.isLoading) return <div className="min-h-screen bg-[#071326] text-white grid place-items-center font-medium">Verificando acesso…</div>;

  if (!hasAccess) {
    return (
      <main className="min-h-screen bg-[#071326] text-white grid place-items-center px-6">
        <section className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[.05] p-7 text-center shadow-[0_24px_80px_rgba(0,0,0,.3)] backdrop-blur sm:p-9">
          <div className="mx-auto mb-6 grid h-14 w-14 place-items-center rounded-2xl bg-[#1D4ED8] shadow-[0_18px_60px_rgba(29,78,216,.35)]"><ShieldCheck size={28} /></div>
          <p className="text-xs uppercase tracking-[.2em] text-[#8AB6FF]">Altixdev · acesso seguro</p>
          <h1 className="mt-4 font-serif text-4xl tracking-tight">Seu painel comercial é privado.</h1>
          <p className="mt-4 text-base leading-7 text-slate-300">Use seu e-mail e senha administrativos para acompanhar diagnósticos, propostas e oportunidades em andamento.</p>
          <form onSubmit={event => { event.preventDefault(); adminLogin.mutate({ email, password }); }} className="mt-7 space-y-4 text-left">
            <label className="block text-xs font-bold uppercase tracking-[.14em] text-slate-300">E-mail<div className="mt-2 flex items-center gap-2 rounded-xl border border-white/15 bg-[#061126] px-3"><Mail size={16} className="text-[#8AB6FF]" /><input required type="email" value={email} onChange={event => setEmail(event.target.value)} className="w-full bg-transparent py-3 text-sm text-white outline-none" placeholder="voce@altixdev.com.br" /></div></label>
            <label className="block text-xs font-bold uppercase tracking-[.14em] text-slate-300">Senha<div className="mt-2 flex items-center gap-2 rounded-xl border border-white/15 bg-[#061126] px-3"><LockKeyhole size={16} className="text-[#8AB6FF]" /><input required type="password" value={password} onChange={event => setPassword(event.target.value)} className="w-full bg-transparent py-3 text-sm text-white outline-none" placeholder="Sua senha" /></div></label>
            <button disabled={adminLogin.isPending} className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-5 py-3.5 text-sm font-semibold text-[#071326] transition hover:-translate-y-0.5 disabled:opacity-60">{adminLogin.isPending ? "Entrando…" : "Acessar painel"} <ShieldCheck size={17} /></button>
          </form>
          <p className="mt-5 text-xs leading-5 text-slate-400">A sessão é privada e pode ser encerrada a qualquer momento.</p>
        </section>
      </main>
    );
  }

  const metrics = metricsQuery.data ?? { total: 0, new: 0, diagnostic: 0, proposal: 0, won: 0 };
  const records = leadsQuery.data ?? [];
  const metricCards = [
    { label: "Total de leads", value: metrics.total, tone: "bg-[#1D4ED8]" },
    { label: "Novos contatos", value: metrics.new, tone: "bg-[#0F766E]" },
    { label: "Em diagnóstico", value: metrics.diagnostic, tone: "bg-[#A16207]" },
    { label: "Propostas", value: metrics.proposal, tone: "bg-[#7C3AED]" },
    { label: "Vendas fechadas", value: metrics.won, tone: "bg-[#15803D]" },
  ];

  return (
    <main className="min-h-screen bg-[#F7F8FC] text-slate-950">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between px-5 py-4 lg:px-10">
          <a href="/" className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#0B1730] font-serif text-xl text-white">A</span><span><strong className="text-sm tracking-tight">altixdev</strong><small className="ml-2 text-[10px] uppercase tracking-[.16em] text-slate-400">Pipeline</small></span></a>
          <div className="flex items-center gap-3"><span className="hidden text-sm text-slate-500 sm:inline">{adminStatus.data?.email || "Administrador"}</span><button onClick={() => adminLogout.mutate()} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"><LogOut size={15} /> Sair</button></div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1440px] grid-cols-1 lg:grid-cols-[230px_1fr]">
        <aside className="hidden min-h-[calc(100vh-73px)] border-r border-slate-200 bg-white p-5 lg:block">
          <p className="mb-4 px-3 text-[10px] font-bold uppercase tracking-[.18em] text-slate-400">Comercial</p>
          <a href="#leads" className="flex items-center gap-3 rounded-xl bg-[#EEF3FF] px-3 py-3 text-sm font-semibold text-[#1D4ED8]"><LayoutDashboard size={17} /> Pipeline de leads</a>
          <a href="#metricas" className="mt-1 flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50"><Users size={17} /> Métricas</a>
        </aside>
        <section className="p-5 lg:p-10">
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-[#1D4ED8]">Painel de oportunidades</p><h1 className="mt-2 font-serif text-4xl tracking-tight">Acompanhe cada conversa até a decisão.</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">Os leads chegam com o contexto do diagnóstico. Atualize o estágio, a prioridade, as notas e o próximo passo enquanto conduz a oportunidade.</p></div><div className="inline-flex items-center gap-2 self-start rounded-full bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 md:self-auto"><Check size={14} /> Acesso do proprietário</div></div>

          <div id="metricas" className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-5">{metricCards.map(card => <div key={card.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_10px_25px_rgba(15,23,42,.04)]"><span className={`mb-4 block h-1.5 w-9 rounded-full ${card.tone}`} /><strong className="text-3xl tracking-tight">{card.value}</strong><p className="mt-1 text-xs font-medium text-slate-500">{card.label}</p></div>)}</div>

          <section id="leads" className="mt-8 rounded-2xl border border-slate-200 bg-white shadow-[0_10px_30px_rgba(15,23,42,.04)]">
            <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-5 md:flex-row md:items-center md:justify-between"><div><h2 className="font-serif text-2xl">Leads</h2><p className="mt-1 text-sm text-slate-500">{records.length} oportunidade{records.length === 1 ? "" : "s"} encontrada{records.length === 1 ? "" : "s"}</p></div><div className="flex flex-col gap-2 sm:flex-row"><label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-slate-400"><Search size={16} /><input value={search} onChange={event => setSearch(event.target.value)} className="w-full bg-transparent text-sm text-slate-900 outline-none sm:w-48" placeholder="Buscar nome ou empresa" /></label><select value={stage} onChange={event => setStage(event.target.value as typeof stage)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"><option value="">Todos os estágios</option>{Object.entries(stageLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div></div>
            {leadsQuery.isLoading ? <div className="p-10 text-center text-sm text-slate-500">Carregando oportunidades…</div> : records.length === 0 ? <div className="p-10 text-center"><Users className="mx-auto text-slate-300" size={32} /><h3 className="mt-3 font-semibold">Nenhum lead ainda</h3><p className="mt-1 text-sm text-slate-500">Quando um visitante concluir o diagnóstico, ele aparecerá aqui.</p></div> : <div className="divide-y divide-slate-100">{records.map(lead => <article key={lead.id} className="p-5"><div className="grid gap-5 xl:grid-cols-[1.25fr_.85fr_.8fr_.9fr]"><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{lead.name}</h3>{lead.company ? <span className="text-sm text-slate-500">· {lead.company}</span> : null}<span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase tracking-[.12em] text-slate-500">{lead.source}</span></div><p className="mt-2 text-sm leading-6 text-slate-600">{lead.diagnosticSummary}</p><p className="mt-2 text-xs text-slate-400">{lead.email} · {lead.phone} · {new Date(lead.createdAt).toLocaleDateString("pt-BR")}</p></div><label className="text-xs font-bold uppercase tracking-[.12em] text-slate-400">Estágio<select value={lead.stage} onChange={event => updateMutation.mutate({ id: lead.id, stage: event.target.value as keyof typeof stageLabel })} className="mt-2 block w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm font-medium normal-case tracking-normal text-slate-700 outline-none">{Object.entries(stageLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="text-xs font-bold uppercase tracking-[.12em] text-slate-400">Prioridade<select value={lead.priority} onChange={event => updateMutation.mutate({ id: lead.id, priority: event.target.value as keyof typeof priorityLabel })} className="mt-2 block w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm font-medium normal-case tracking-normal text-slate-700 outline-none">{Object.entries(priorityLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><div className="space-y-3"><label className="block text-xs font-bold uppercase tracking-[.12em] text-slate-400">Próximo passo<input defaultValue={lead.nextStep ?? ""} onBlur={event => updateMutation.mutate({ id: lead.id, nextStep: event.target.value || null })} className="mt-2 w-full rounded-lg border border-slate-200 px-2 py-2 text-sm font-normal normal-case tracking-normal text-slate-700 outline-none focus:border-[#1D4ED8]" placeholder="Ex.: agendar diagnóstico" /></label><label className="block text-xs font-bold uppercase tracking-[.12em] text-slate-400">Observações<textarea defaultValue={lead.notes ?? ""} onBlur={event => updateMutation.mutate({ id: lead.id, notes: event.target.value || null })} className="mt-2 min-h-20 w-full rounded-lg border border-slate-200 px-2 py-2 text-sm font-normal normal-case tracking-normal text-slate-700 outline-none focus:border-[#1D4ED8]" placeholder="Contexto, objeções e combinados" /></label></div></div></article>)}</div>}
          </section>
        </section>
      </div>
    </main>
  );
}
