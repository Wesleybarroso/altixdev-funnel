import { trpc } from "@/lib/trpc";
import DirectCrmIntegrations from "@/components/DirectCrmIntegrations";
import { Bell, Check, Download, FileJson, FileSpreadsheet, History, LayoutDashboard, LockKeyhole, LogOut, Mail, Network, Pencil, Plus, RefreshCw, Search, Send, Settings2, ShieldCheck, TestTube2, Trash2, Users, Webhook } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

const stageLabel = { new: "Novo", diagnostic: "Diagnóstico", proposal: "Proposta", won: "Fechado", lost: "Perdido" } as const;
const priorityLabel = { low: "Baixa", medium: "Média", high: "Alta" } as const;
const logTone = { info: "bg-slate-100 text-slate-600", success: "bg-emerald-50 text-emerald-700", warning: "bg-amber-50 text-amber-700", error: "bg-rose-50 text-rose-700" } as const;
type View = "leads" | "logs" | "integrations";
type WebhookDraft = { id?: number; name: string; url: string; authHeaderName: string; secret: string; enabled: boolean };
const emptyWebhook: WebhookDraft = { name: "", url: "", authHeaderName: "Authorization", secret: "", enabled: true };

function downloadFile(filename: string, type: string, content: string) {
  const blob = new Blob([content], { type });
  const anchor = document.createElement("a");
  anchor.href = URL.createObjectURL(blob);
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(anchor.href);
}

function csvValue(value: unknown) {
  const text = value == null ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function formatDate(value: Date | string | null | undefined) {
  return value ? new Date(value).toLocaleString("pt-BR") : "—";
}

export default function LeadDashboard() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [activeView, setActiveView] = useState<View>("leads");
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState<"" | keyof typeof stageLabel>("");
  const [logCategory, setLogCategory] = useState("");
  const [logStatus, setLogStatus] = useState<"" | keyof typeof logTone>("");
  const [selectedWebhookId, setSelectedWebhookId] = useState<number | "">("");
  const [webhookDraft, setWebhookDraft] = useState<WebhookDraft>(emptyWebhook);
  const [ntfyServer, setNtfyServer] = useState("https://ntfy.sh");
  const [ntfyTopic, setNtfyTopic] = useState("");
  const [ntfyToken, setNtfyToken] = useState("");
  const [ntfyEnabled, setNtfyEnabled] = useState(false);

  const queryInput = useMemo(() => ({ search: search || undefined, stage: stage || undefined }), [search, stage]);
  const logInput = useMemo(() => ({ category: logCategory || undefined, status: logStatus || undefined, limit: 250 }), [logCategory, logStatus]);
  const utils = trpc.useUtils();
  const adminStatus = trpc.auth.adminStatus.useQuery(undefined, { retry: false, refetchOnWindowFocus: false });
  const hasAccess = adminStatus.data?.authenticated === true;
  const leadsQuery = trpc.leads.list.useQuery(queryInput, { enabled: hasAccess });
  const metricsQuery = trpc.leads.metrics.useQuery(undefined, { enabled: hasAccess });
  const logsQuery = trpc.logs.list.useQuery(logInput, { enabled: hasAccess && activeView === "logs" });
  const webhooksQuery = trpc.webhooks.list.useQuery(undefined, { enabled: hasAccess && activeView !== "logs" });
  const ntfyQuery = trpc.ntfy.get.useQuery(undefined, { enabled: hasAccess && activeView === "integrations" });

  useEffect(() => {
    const config = ntfyQuery.data;
    if (!config) return;
    setNtfyServer(config.serverUrl || "https://ntfy.sh");
    setNtfyTopic(config.topic || "");
    setNtfyEnabled(config.enabled);
  }, [ntfyQuery.data]);

  useEffect(() => {
    const active = webhooksQuery.data?.find((webhook): webhook is NonNullable<typeof webhook> => webhook !== null && webhook.enabled);
    if (selectedWebhookId === "" && active) setSelectedWebhookId(active.id);
  }, [selectedWebhookId, webhooksQuery.data]);

  const adminLogin = trpc.auth.adminLogin.useMutation({
    onSuccess: async ({ sessionToken }) => {
      setPassword("");
      sessionStorage.setItem("altixdev-admin-session", sessionToken);
      localStorage.setItem("altixdev-admin-session", sessionToken);
      const status = await adminStatus.refetch();
      if (status.data?.authenticated) return toast.success("Acesso liberado.");
      toast.error("Não foi possível confirmar a sessão. Tente novamente.");
    },
    onError: () => toast.error("E-mail ou senha inválidos."),
  });
  const adminLogout = trpc.auth.adminLogout.useMutation({
    onSuccess: () => {
      sessionStorage.removeItem("altixdev-admin-session");
      localStorage.removeItem("altixdev-admin-session");
      utils.auth.adminStatus.invalidate();
      toast.success("Sessão encerrada.");
    },
  });
  const updateMutation = trpc.leads.update.useMutation({
    onSuccess: () => {
      utils.leads.list.invalidate();
      utils.leads.metrics.invalidate();
      utils.logs.list.invalidate();
      toast.success("Lead atualizado.");
    },
    onError: () => toast.error("Não foi possível atualizar o lead."),
  });
  const recordExport = trpc.logs.recordExport.useMutation({ onSuccess: () => utils.logs.list.invalidate() });
  const saveNtfy = trpc.ntfy.save.useMutation({
    onSuccess: () => { setNtfyToken(""); utils.ntfy.get.invalidate(); utils.logs.list.invalidate(); toast.success("Configuração ntfy salva."); },
    onError: error => toast.error(error.message),
  });
  const testNtfy = trpc.ntfy.test.useMutation({
    onSuccess: result => { utils.ntfy.get.invalidate(); utils.logs.list.invalidate(); result.ok ? toast.success("Teste enviado ao ntfy.") : toast.error("ntfy respondeu com erro."); },
    onError: error => toast.error(error.message),
  });
  const saveWebhook = trpc.webhooks.create.useMutation({
    onSuccess: () => { setWebhookDraft(emptyWebhook); utils.webhooks.list.invalidate(); utils.logs.list.invalidate(); toast.success("Webhook salvo."); },
    onError: error => toast.error(error.message),
  });
  const updateWebhook = trpc.webhooks.update.useMutation({
    onSuccess: () => { setWebhookDraft(emptyWebhook); utils.webhooks.list.invalidate(); utils.logs.list.invalidate(); toast.success("Webhook atualizado."); },
    onError: error => toast.error(error.message),
  });
  const deleteWebhook = trpc.webhooks.delete.useMutation({
    onSuccess: () => { setSelectedWebhookId(""); utils.webhooks.list.invalidate(); utils.logs.list.invalidate(); toast.success("Webhook removido."); },
    onError: error => toast.error(error.message),
  });
  const testWebhook = trpc.webhooks.test.useMutation({
    onSuccess: result => { utils.webhooks.list.invalidate(); utils.logs.list.invalidate(); result.ok ? toast.success("Webhook respondeu corretamente.") : toast.error("Webhook respondeu com erro."); },
    onError: error => toast.error(error.message),
  });
  const sendLead = trpc.webhooks.sendLead.useMutation({
    onSuccess: result => { utils.webhooks.list.invalidate(); utils.logs.list.invalidate(); result.ok ? toast.success("Lead enviado ao webhook.") : toast.error("Webhook respondeu com erro."); },
    onError: error => toast.error(error.message),
  });

  const exportLeads = (format: "csv" | "json") => {
    const records = leadsQuery.data ?? [];
    const rows = records.map(lead => ({
      id: lead.id,
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      company: lead.company ?? "",
      lifecycle_stage: lead.stage,
      lead_priority: lead.priority,
      lead_source: lead.source,
      objective: lead.objective,
      current_channel: lead.currentChannel,
      bottleneck: lead.bottleneck,
      urgency: lead.urgency,
      diagnostic_summary: lead.diagnosticSummary,
      notes: lead.notes ?? "",
      next_step: lead.nextStep ?? "",
      consent: lead.consent ? "yes" : "no",
      created_at: new Date(lead.createdAt).toISOString(),
      updated_at: new Date(lead.updatedAt).toISOString(),
    }));
    const stamp = new Date().toISOString().slice(0, 10);
    if (format === "json") downloadFile(`altixdev-leads-${stamp}.json`, "application/json", JSON.stringify(rows, null, 2));
    else {
      const headers = Object.keys(rows[0] ?? { id: "" });
      const content = [headers.join(","), ...rows.map(row => headers.map(header => csvValue(row[header as keyof typeof row])).join(","))].join("\n");
      downloadFile(`altixdev-leads-${stamp}.csv`, "text/csv;charset=utf-8", `\ufeff${content}`);
    }
    recordExport.mutate({ format, count: rows.length, dataType: "leads" });
  };

  const exportLogs = (format: "csv" | "json") => {
    const records = logsQuery.data ?? [];
    const rows = records.map(log => ({ id: log.id, category: log.category, event_type: log.eventType, status: log.status, message: log.message, metadata: JSON.stringify(log.metadata ?? {}), created_at: new Date(log.createdAt).toISOString() }));
    const stamp = new Date().toISOString().slice(0, 10);
    if (format === "json") downloadFile(`altixdev-logs-${stamp}.json`, "application/json", JSON.stringify(rows, null, 2));
    else {
      const headers = Object.keys(rows[0] ?? { id: "" });
      const content = [headers.join(","), ...rows.map(row => headers.map(header => csvValue(row[header as keyof typeof row])).join(","))].join("\n");
      downloadFile(`altixdev-logs-${stamp}.csv`, "text/csv;charset=utf-8", `\ufeff${content}`);
    }
    recordExport.mutate({ format, count: rows.length, dataType: "logs" });
  };

  const submitWebhook = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!webhookDraft.id && !webhookDraft.url) return toast.error("Informe a URL do webhook.");
    if (webhookDraft.id) {
      updateWebhook.mutate({ id: webhookDraft.id, name: webhookDraft.name, ...(webhookDraft.url ? { url: webhookDraft.url } : {}), authHeaderName: webhookDraft.authHeaderName || null, ...(webhookDraft.secret ? { secret: webhookDraft.secret } : {}), enabled: webhookDraft.enabled });
      return;
    }
    saveWebhook.mutate({ name: webhookDraft.name, url: webhookDraft.url, authHeaderName: webhookDraft.authHeaderName || null, secret: webhookDraft.secret || null, enabled: webhookDraft.enabled });
  };

  if (adminStatus.isLoading) return <div className="grid min-h-screen place-items-center bg-[#071326] font-medium text-white">Verificando acesso…</div>;
  if (adminStatus.isError) return <main className="grid min-h-screen place-items-center bg-[#071326] px-6 text-white"><section className="max-w-md text-center"><ShieldCheck className="mx-auto text-[#8AB6FF]" size={40} /><h1 className="mt-5 font-serif text-4xl">Não foi possível verificar o acesso.</h1><p className="mt-4 text-slate-300">Atualize a página e tente novamente.</p><button onClick={() => adminStatus.refetch()} className="mt-8 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-[#071326]">Tentar novamente</button></section></main>;
  if (!hasAccess) return <main className="grid min-h-screen place-items-center bg-[#071326] px-6 text-white"><section className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[.05] p-7 text-center shadow-[0_24px_80px_rgba(0,0,0,.3)] backdrop-blur sm:p-9"><div className="mx-auto mb-6 grid h-14 w-14 place-items-center rounded-2xl bg-[#1D4ED8]"><ShieldCheck size={28} /></div><p className="text-xs uppercase tracking-[.2em] text-[#8AB6FF]">Altixdev · acesso seguro</p><h1 className="mt-4 font-serif text-4xl tracking-tight">Seu painel comercial é privado.</h1><p className="mt-4 text-base leading-7 text-slate-300">Use seu e-mail e senha administrativos para acompanhar oportunidades e integrações.</p><form onSubmit={event => { event.preventDefault(); adminLogin.mutate({ email, password }); }} className="mt-7 space-y-4 text-left"><label className="block text-xs font-bold uppercase tracking-[.14em] text-slate-300">E-mail<div className="mt-2 flex items-center gap-2 rounded-xl border border-white/15 bg-[#061126] px-3"><Mail size={16} className="text-[#8AB6FF]" /><input required type="email" value={email} onChange={event => setEmail(event.target.value)} className="w-full bg-transparent py-3 text-sm text-white outline-none" placeholder="voce@altixdev.com.br" /></div></label><label className="block text-xs font-bold uppercase tracking-[.14em] text-slate-300">Senha<div className="mt-2 flex items-center gap-2 rounded-xl border border-white/15 bg-[#061126] px-3"><LockKeyhole size={16} className="text-[#8AB6FF]" /><input required type="password" value={password} onChange={event => setPassword(event.target.value)} className="w-full bg-transparent py-3 text-sm text-white outline-none" placeholder="Sua senha" /></div></label><button disabled={adminLogin.isPending} className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-5 py-3.5 text-sm font-semibold text-[#071326] disabled:opacity-60">{adminLogin.isPending ? "Entrando…" : "Acessar painel"} <ShieldCheck size={17} /></button></form></section></main>;

  const metrics = metricsQuery.data ?? { total: 0, new: 0, diagnostic: 0, proposal: 0, won: 0 };
  const records = leadsQuery.data ?? [];
  const webhooks = (webhooksQuery.data ?? []).filter((webhook): webhook is NonNullable<typeof webhook> => webhook !== null);
  const activeWebhooks = webhooks.filter(webhook => webhook.enabled);
  const metricCards = [{ label: "Total de leads", value: metrics.total, tone: "bg-[#1D4ED8]" }, { label: "Novos contatos", value: metrics.new, tone: "bg-[#0F766E]" }, { label: "Em diagnóstico", value: metrics.diagnostic, tone: "bg-[#A16207]" }, { label: "Propostas", value: metrics.proposal, tone: "bg-[#7C3AED]" }, { label: "Vendas fechadas", value: metrics.won, tone: "bg-[#15803D]" }];
  const nav = [{ id: "leads" as const, label: "Pipeline", icon: LayoutDashboard }, { id: "integrations" as const, label: "Integrações", icon: Network }, { id: "logs" as const, label: "Logs", icon: History }];

  return <main className="min-h-screen bg-[#F7F8FC] text-slate-950"><header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur"><div className="mx-auto flex max-w-[1440px] items-center justify-between px-5 py-4 lg:px-10"><a href="/" className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#0B1730] font-serif text-xl text-white">A</span><span><strong className="text-sm tracking-tight">altixdev</strong><small className="ml-2 text-[10px] uppercase tracking-[.16em] text-slate-400">Pipeline</small></span></a><div className="flex items-center gap-3"><span className="hidden text-sm text-slate-500 sm:inline">{adminStatus.data?.email || "Administrador"}</span><button onClick={() => adminLogout.mutate()} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"><LogOut size={15} /> Sair</button></div></div></header>
    <div className="mx-auto grid max-w-[1440px] grid-cols-1 lg:grid-cols-[230px_1fr]"><aside className="border-b border-slate-200 bg-white p-3 lg:min-h-[calc(100vh-73px)] lg:border-b-0 lg:border-r lg:p-5"><p className="mb-3 hidden px-3 text-[10px] font-bold uppercase tracking-[.18em] text-slate-400 lg:block">Comercial</p><div className="flex gap-2 overflow-x-auto lg:block lg:space-y-1">{nav.map(item => <button key={item.id} onClick={() => setActiveView(item.id)} className={`flex shrink-0 items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold ${activeView === item.id ? "bg-[#EEF3FF] text-[#1D4ED8]" : "text-slate-600 hover:bg-slate-50"}`}><item.icon size={17} /> {item.label}</button>)}</div></aside>
      <section className="p-5 lg:p-10">
        {activeView === "leads" && <><div className="flex flex-col justify-between gap-5 md:flex-row md:items-end"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-[#1D4ED8]">Painel de oportunidades</p><h1 className="mt-2 font-serif text-4xl tracking-tight">Acompanhe cada conversa até a decisão.</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">Os leads chegam com o contexto do diagnóstico. Atualize o estágio e encaminhe uma oportunidade ao CRM quando estiver pronta.</p></div><div className="inline-flex items-center gap-2 self-start rounded-full bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 md:self-auto"><Check size={14} /> Acesso do proprietário</div></div><div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-5">{metricCards.map(card => <div key={card.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_10px_25px_rgba(15,23,42,.04)]"><span className={`mb-4 block h-1.5 w-9 rounded-full ${card.tone}`} /><strong className="text-3xl tracking-tight">{card.value}</strong><p className="mt-1 text-xs font-medium text-slate-500">{card.label}</p></div>)}</div><section className="mt-8 rounded-2xl border border-slate-200 bg-white shadow-[0_10px_30px_rgba(15,23,42,.04)]"><div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-5 xl:flex-row xl:items-center xl:justify-between"><div><h2 className="font-serif text-2xl">Leads</h2><p className="mt-1 text-sm text-slate-500">{records.length} oportunidade{records.length === 1 ? "" : "s"} encontrada{records.length === 1 ? "" : "s"}</p></div><div className="flex flex-col gap-2 sm:flex-row"><button onClick={() => exportLeads("csv")} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium hover:bg-slate-50"><FileSpreadsheet size={16} /> CSV</button><button onClick={() => exportLeads("json")} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium hover:bg-slate-50"><FileJson size={16} /> JSON</button><label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-slate-400"><Search size={16} /><input value={search} onChange={event => setSearch(event.target.value)} className="w-full bg-transparent text-sm text-slate-900 outline-none sm:w-40" placeholder="Buscar" /></label><select value={stage} onChange={event => setStage(event.target.value as typeof stage)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"><option value="">Todos os estágios</option>{Object.entries(stageLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div></div><div className="flex flex-wrap items-center gap-3 border-b border-slate-100 bg-slate-50/70 px-5 py-3"><Webhook size={16} className="text-[#1D4ED8]" /><span className="text-sm font-medium text-slate-600">Enviar lead para:</span><select value={selectedWebhookId} onChange={event => setSelectedWebhookId(event.target.value ? Number(event.target.value) : "")} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none"><option value="">Selecione um webhook</option>{activeWebhooks.map(webhook => <option key={webhook.id} value={webhook.id}>{webhook.name} · {webhook.destinationHost}</option>)}</select>{activeWebhooks.length === 0 && <button onClick={() => setActiveView("integrations")} className="text-sm font-semibold text-[#1D4ED8]">Configurar integração</button>}</div>{leadsQuery.isLoading ? <div className="p-10 text-center text-sm text-slate-500">Carregando oportunidades…</div> : records.length === 0 ? <div className="p-10 text-center"><Users className="mx-auto text-slate-300" size={32} /><h3 className="mt-3 font-semibold">Nenhum lead ainda</h3><p className="mt-1 text-sm text-slate-500">Quando um visitante concluir o diagnóstico, ele aparecerá aqui.</p></div> : <div className="divide-y divide-slate-100">{records.map(lead => <article key={lead.id} className="p-5"><div className="grid gap-5 xl:grid-cols-[1.3fr_.72fr_.72fr_.95fr]"><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{lead.name}</h3>{lead.company ? <span className="text-sm text-slate-500">· {lead.company}</span> : null}<span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase tracking-[.12em] text-slate-500">{lead.source}</span></div><p className="mt-2 text-sm leading-6 text-slate-600">{lead.diagnosticSummary}</p><p className="mt-2 text-xs text-slate-400">{lead.email} · {lead.phone} · {new Date(lead.createdAt).toLocaleDateString("pt-BR")}</p><button disabled={!selectedWebhookId || sendLead.isPending} onClick={() => selectedWebhookId && sendLead.mutate({ id: selectedWebhookId, leadId: lead.id })} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#0B1730] px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"><Send size={14} /> Enviar ao CRM</button></div><label className="text-xs font-bold uppercase tracking-[.12em] text-slate-400">Estágio<select value={lead.stage} onChange={event => updateMutation.mutate({ id: lead.id, stage: event.target.value as keyof typeof stageLabel })} className="mt-2 block w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm font-medium normal-case tracking-normal text-slate-700 outline-none">{Object.entries(stageLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="text-xs font-bold uppercase tracking-[.12em] text-slate-400">Prioridade<select value={lead.priority} onChange={event => updateMutation.mutate({ id: lead.id, priority: event.target.value as keyof typeof priorityLabel })} className="mt-2 block w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm font-medium normal-case tracking-normal text-slate-700 outline-none">{Object.entries(priorityLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><div className="space-y-3"><label className="block text-xs font-bold uppercase tracking-[.12em] text-slate-400">Próximo passo<input defaultValue={lead.nextStep ?? ""} onBlur={event => updateMutation.mutate({ id: lead.id, nextStep: event.target.value || null })} className="mt-2 w-full rounded-lg border border-slate-200 px-2 py-2 text-sm font-normal normal-case tracking-normal text-slate-700 outline-none focus:border-[#1D4ED8]" placeholder="Ex.: agendar diagnóstico" /></label><label className="block text-xs font-bold uppercase tracking-[.12em] text-slate-400">Observações<textarea defaultValue={lead.notes ?? ""} onBlur={event => updateMutation.mutate({ id: lead.id, notes: event.target.value || null })} className="mt-2 min-h-20 w-full rounded-lg border border-slate-200 px-2 py-2 text-sm font-normal normal-case tracking-normal text-slate-700 outline-none focus:border-[#1D4ED8]" placeholder="Contexto e combinados" /></label></div></div></article>)}</div>}</section></>}
        {activeView === "integrations" && <><div><p className="text-xs font-bold uppercase tracking-[.18em] text-[#1D4ED8]">Integrações</p><h1 className="mt-2 font-serif text-4xl tracking-tight">Conecte seu pipeline aos seus canais.</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">As URLs e os tokens são protegidos no servidor. O painel mostra apenas o status e permite testar cada destino.</p></div><div className="mt-8 grid gap-6 xl:grid-cols-[.9fr_1.1fr]"><section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,.04)]"><div className="flex items-start justify-between gap-4"><div><div className="flex items-center gap-2"><Bell size={18} className="text-[#1D4ED8]" /><h2 className="font-serif text-2xl">Notificações ntfy</h2></div><p className="mt-2 text-sm leading-6 text-slate-500">Envie avisos de leads, CRM, exportações e falhas diretamente para seu celular.</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${ntfyQuery.data?.enabled ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{ntfyQuery.data?.enabled ? "Ativo" : "Inativo"}</span></div><form onSubmit={event => { event.preventDefault(); saveNtfy.mutate({ serverUrl: ntfyServer, topic: ntfyTopic, token: ntfyToken || undefined, removeToken: false, enabled: ntfyEnabled }); }} className="mt-6 space-y-4"><label className="block text-sm font-semibold text-slate-700">Servidor ntfy<input required value={ntfyServer} onChange={event => setNtfyServer(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-normal outline-none focus:border-[#1D4ED8]" placeholder="https://ntfy.sh" /></label><label className="block text-sm font-semibold text-slate-700">Tópico<input required value={ntfyTopic} onChange={event => setNtfyTopic(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-normal outline-none focus:border-[#1D4ED8]" placeholder="altixdev_seu_topico_secreto" /></label><label className="block text-sm font-semibold text-slate-700">Token de acesso <span className="font-normal text-slate-400">(opcional)</span><input type="password" value={ntfyToken} onChange={event => setNtfyToken(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-normal outline-none focus:border-[#1D4ED8]" placeholder={ntfyQuery.data?.hasToken ? "Token já configurado" : "tk_..."} /></label><label className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 text-sm font-medium text-slate-700"><input type="checkbox" checked={ntfyEnabled} onChange={event => setNtfyEnabled(event.target.checked)} className="h-4 w-4 accent-[#1D4ED8]" /> Ativar notificações automáticas</label><div className="flex flex-wrap gap-3"><button disabled={saveNtfy.isPending} className="inline-flex items-center gap-2 rounded-xl bg-[#0B1730] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"><Settings2 size={16} /> Salvar ntfy</button><button type="button" disabled={!ntfyQuery.data?.enabled || testNtfy.isPending} onClick={() => testNtfy.mutate()} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold hover:bg-slate-50 disabled:opacity-40"><TestTube2 size={16} /> Testar no celular</button></div></form><p className="mt-5 text-xs text-slate-500">Última verificação: {formatDate(ntfyQuery.data?.lastCheckAt)} · {ntfyQuery.data?.lastMessage || "Sem teste ainda"}</p></section><section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,.04)]"><div className="flex items-center gap-2"><Webhook size={18} className="text-[#1D4ED8]" /><h2 className="font-serif text-2xl">Webhooks para CRM e n8n</h2></div><p className="mt-2 text-sm leading-6 text-slate-500">Cadastre um destino, teste a conexão e escolha um webhook para receber leads do pipeline.</p><form onSubmit={submitWebhook} className="mt-6 grid gap-3 sm:grid-cols-2"><label className="text-sm font-semibold text-slate-700">Nome<input required value={webhookDraft.name} onChange={event => setWebhookDraft(current => ({ ...current, name: event.target.value }))} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-normal outline-none focus:border-[#1D4ED8]" placeholder="n8n CRM" /></label><label className="text-sm font-semibold text-slate-700">Cabeçalho de autenticação<input value={webhookDraft.authHeaderName} onChange={event => setWebhookDraft(current => ({ ...current, authHeaderName: event.target.value }))} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-normal outline-none focus:border-[#1D4ED8]" placeholder="Authorization" /></label><label className="sm:col-span-2 text-sm font-semibold text-slate-700">URL do webhook {webhookDraft.id ? <span className="font-normal text-slate-400">(preencha para alterar)</span> : null}<input required={!webhookDraft.id} value={webhookDraft.url} onChange={event => setWebhookDraft(current => ({ ...current, url: event.target.value }))} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-normal outline-none focus:border-[#1D4ED8]" placeholder="https://seu-n8n.com/webhook/..." /></label><label className="sm:col-span-2 text-sm font-semibold text-slate-700">Token ou segredo {webhookDraft.id ? <span className="font-normal text-slate-400">(deixe vazio para manter)</span> : null}<input type="password" value={webhookDraft.secret} onChange={event => setWebhookDraft(current => ({ ...current, secret: event.target.value }))} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-normal outline-none focus:border-[#1D4ED8]" placeholder="Opcional" /></label><label className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 text-sm font-medium text-slate-700"><input type="checkbox" checked={webhookDraft.enabled} onChange={event => setWebhookDraft(current => ({ ...current, enabled: event.target.checked }))} className="h-4 w-4 accent-[#1D4ED8]" /> Ativo para receber leads</label><div className="flex items-center gap-2"><button disabled={saveWebhook.isPending || updateWebhook.isPending} className="inline-flex items-center gap-2 rounded-xl bg-[#1D4ED8] px-4 py-2.5 text-sm font-semibold text-white"><Plus size={16} /> {webhookDraft.id ? "Atualizar" : "Adicionar"}</button>{webhookDraft.id && <button type="button" onClick={() => setWebhookDraft(emptyWebhook)} className="rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-500">Cancelar</button>}</div></form><div className="mt-7 divide-y divide-slate-100 border-t border-slate-100">{webhooksQuery.isLoading ? <p className="py-6 text-sm text-slate-500">Carregando destinos…</p> : webhooks.length === 0 ? <p className="py-6 text-sm text-slate-500">Nenhum webhook configurado.</p> : webhooks.map(webhook => <div key={webhook.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2"><strong className="text-sm">{webhook.name}</strong><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${webhook.enabled ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{webhook.enabled ? "Ativo" : "Inativo"}</span></div><p className="mt-1 text-xs text-slate-500">{webhook.destinationHost} · último teste: {formatDate(webhook.lastTestAt)} {webhook.lastStatus ? `(${webhook.lastStatus})` : ""}</p></div><div className="flex gap-2"><button onClick={() => testWebhook.mutate({ id: webhook.id })} className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50" title="Testar"><TestTube2 size={15} /></button><button onClick={() => setWebhookDraft({ id: webhook.id, name: webhook.name, url: "", authHeaderName: webhook.authHeaderName || "Authorization", secret: "", enabled: webhook.enabled })} className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50" title="Editar"><Pencil size={15} /></button><button onClick={() => deleteWebhook.mutate({ id: webhook.id })} className="rounded-lg border border-rose-100 p-2 text-rose-600 hover:bg-rose-50" title="Excluir"><Trash2 size={15} /></button></div></div>)}</div></section></div></>}
        {activeView === "logs" && <><div className="flex flex-col justify-between gap-5 md:flex-row md:items-end"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-[#1D4ED8]">Auditoria operacional</p><h1 className="mt-2 font-serif text-4xl tracking-tight">Logs de CRM e integrações.</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">Acompanhe entradas, exportações, atualizações e testes de conexão. Os logs podem ser exportados para auditoria.</p></div><div className="flex gap-2"><button onClick={() => exportLogs("csv")} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50"><Download size={16} /> CSV</button><button onClick={() => exportLogs("json")} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50"><FileJson size={16} /> JSON</button></div></div><section className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_10px_30px_rgba(15,23,42,.04)]"><div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row"><select value={logCategory} onChange={event => setLogCategory(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"><option value="">Todas as categorias</option><option value="crm">CRM</option><option value="integration">Integrações</option><option value="export">Exportações</option></select><select value={logStatus} onChange={event => setLogStatus(event.target.value as typeof logStatus)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"><option value="">Todos os status</option><option value="success">Sucesso</option><option value="info">Informação</option><option value="warning">Atenção</option><option value="error">Erro</option></select><button onClick={() => logsQuery.refetch()} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium hover:bg-slate-50"><RefreshCw size={15} /> Atualizar</button></div>{logsQuery.isLoading ? <div className="p-10 text-center text-sm text-slate-500">Carregando logs…</div> : (logsQuery.data?.length ?? 0) === 0 ? <div className="p-10 text-center"><History className="mx-auto text-slate-300" size={32} /><h3 className="mt-3 font-semibold">Ainda não há eventos</h3><p className="mt-1 text-sm text-slate-500">Os novos leads, exportações e testes de integração serão registrados aqui.</p></div> : <div className="divide-y divide-slate-100">{logsQuery.data?.map(log => <article key={log.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-[.1em] ${logTone[log.status]}`}>{log.status}</span><span className="text-xs font-semibold uppercase tracking-[.12em] text-slate-400">{log.category} · {log.eventType}</span></div><p className="mt-2 text-sm font-medium text-slate-800">{log.message}</p>{log.metadata ? <p className="mt-1 text-xs text-slate-500">{JSON.stringify(log.metadata)}</p> : null}</div><time className="text-xs text-slate-400">{formatDate(log.createdAt)}</time></article>)}</div>}</section></>}
        {activeView === "integrations" && <DirectCrmIntegrations />}
      </section></div></main>;
}
