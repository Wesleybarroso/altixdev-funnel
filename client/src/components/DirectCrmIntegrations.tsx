import { trpc } from "@/lib/trpc";
import { BarChart3, CheckCircle2, Database, RefreshCw, Send, Settings2, Table2, TestTube2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type AnalyticsOverview = {
  period: string;
  propertyId: string;
  summary: { activeUsers: number; newUsers: number; sessions: number; pageViews: number; engagementRate: number };
  channels: Array<{ channel: string; sessions: number; users: number }>;
  pages: Array<{ path: string; pageViews: number; users: number }>;
};

function statusText(value: Date | string | null | undefined) {
  return value ? new Date(value).toLocaleString("pt-BR") : "Sem teste ainda";
}

export default function DirectCrmIntegrations() {
  const utils = trpc.useUtils();
  const directQuery = trpc.directCrm.get.useQuery();
  const analyticsQuery = trpc.analytics.get.useQuery();
  const leadsQuery = trpc.leads.list.useQuery(undefined);
  const analyticsOverview = trpc.analytics.overview.useQuery(undefined, { enabled: analyticsQuery.data?.enabled === true, retry: false, refetchOnWindowFocus: false });
  const [googleCredential, setGoogleCredential] = useState("");
  const [spreadsheetId, setSpreadsheetId] = useState("");
  const [sheetName, setSheetName] = useState("Leads");
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [postgresConnection, setPostgresConnection] = useState("");
  const [postgresTable, setPostgresTable] = useState("altixdev_leads");
  const [postgresSsl, setPostgresSsl] = useState(true);
  const [postgresEnabled, setPostgresEnabled] = useState(false);
  const [analyticsCredential, setAnalyticsCredential] = useState("");
  const [analyticsPropertyId, setAnalyticsPropertyId] = useState("");
  const [analyticsMeasurementId, setAnalyticsMeasurementId] = useState("");
  const [analyticsEnabled, setAnalyticsEnabled] = useState(false);
  const [leadId, setLeadId] = useState<number | "">("");

  useEffect(() => {
    const google = directQuery.data?.googleSheets;
    const postgres = directQuery.data?.postgres;
    if (google) { setSpreadsheetId(google.spreadsheetId ?? ""); setSheetName(google.sheetName ?? "Leads"); setGoogleEnabled(google.enabled); }
    if (postgres) { setPostgresTable(postgres.tableName ?? "altixdev_leads"); setPostgresSsl(Boolean(postgres.ssl)); setPostgresEnabled(postgres.enabled); }
  }, [directQuery.data]);

  useEffect(() => {
    const analytics = analyticsQuery.data;
    if (!analytics) return;
    setAnalyticsPropertyId(analytics.propertyId || "");
    setAnalyticsMeasurementId(analytics.measurementId || "");
    setAnalyticsEnabled(analytics.enabled);
  }, [analyticsQuery.data]);

  useEffect(() => {
    const first = leadsQuery.data?.[0];
    if (leadId === "" && first) setLeadId(first.id);
  }, [leadId, leadsQuery.data]);

  const refresh = () => {
    void utils.directCrm.get.invalidate();
    void utils.analytics.get.invalidate();
    void utils.analytics.overview.invalidate();
    void utils.logs.list.invalidate();
  };
  const saveGoogle = trpc.directCrm.saveGoogleSheets.useMutation({ onSuccess: () => { setGoogleCredential(""); refresh(); toast.success("Google Sheets salvo."); }, onError: error => toast.error(error.message) });
  const savePostgres = trpc.directCrm.savePostgres.useMutation({ onSuccess: () => { setPostgresConnection(""); refresh(); toast.success("PostgreSQL salvo."); }, onError: error => toast.error(error.message) });
  const testConnection = trpc.directCrm.test.useMutation({ onSuccess: () => { refresh(); toast.success("Conexão testada com sucesso."); }, onError: error => { refresh(); toast.error(error.message); } });
  const syncLead = trpc.directCrm.syncLead.useMutation({ onSuccess: () => { refresh(); toast.success("Lead sincronizado."); }, onError: error => { refresh(); toast.error(error.message); } });
  const saveAnalytics = trpc.analytics.save.useMutation({ onSuccess: () => { setAnalyticsCredential(""); refresh(); toast.success("Google Analytics salvo."); }, onError: error => toast.error(error.message) });
  const testAnalytics = trpc.analytics.test.useMutation({ onSuccess: () => { refresh(); toast.success("Conexão GA4 testada com sucesso."); }, onError: error => { refresh(); toast.error(error.message); } });

  const google = directQuery.data?.googleSheets;
  const postgres = directQuery.data?.postgres;
  const analytics = analyticsQuery.data;
  const overview = analyticsOverview.data;
  const leads = leadsQuery.data ?? [];
  const summary = overview?.summary;

  return <section className="mt-6 grid gap-6 xl:grid-cols-2">
    <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,.04)]">
      <div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2"><Table2 size={18} className="text-[#1D4ED8]" /><h2 className="font-serif text-2xl">Google Sheets</h2></div><p className="mt-2 text-sm leading-6 text-slate-500">Grave uma cópia estruturada dos leads em uma planilha compartilhada com a conta de serviço.</p></div><StatusBadge active={google?.enabled} /></div>
      <form onSubmit={event => { event.preventDefault(); saveGoogle.mutate({ serviceAccountJson: googleCredential || undefined, spreadsheetId, sheetName, enabled: googleEnabled }); }} className="mt-6 space-y-4">
        <Field label="ID da planilha"><input required value={spreadsheetId} onChange={event => setSpreadsheetId(event.target.value)} placeholder="1AbC..." /></Field>
        <Field label="Aba da planilha"><input required value={sheetName} onChange={event => setSheetName(event.target.value)} placeholder="Leads" /></Field>
        <Field label={<>JSON da conta de serviço <SensitiveHint configured={google?.hasCredential} /></>}><textarea value={googleCredential} onChange={event => setGoogleCredential(event.target.value)} className="min-h-28 font-mono text-xs" placeholder='{"type":"service_account", ...}' /></Field>
        <Toggle checked={googleEnabled} onChange={setGoogleEnabled}>Ativar Google Sheets</Toggle>
        <ActionButtons savePending={saveGoogle.isPending} configured={google?.configured} testing={testConnection.isPending} onTest={() => testConnection.mutate({ provider: "google_sheets" })} />
      </form><StatusLine value={google?.lastCheckAt} message={google?.lastMessage} />
    </article>

    <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,.04)]">
      <div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2"><Database size={18} className="text-[#1D4ED8]" /><h2 className="font-serif text-2xl">PostgreSQL</h2></div><p className="mt-2 text-sm leading-6 text-slate-500">Sincronize o lead com uma tabela externa. O painel cria e atualiza a tabela escolhida sem expor a senha.</p></div><StatusBadge active={postgres?.enabled} /></div>
      <form onSubmit={event => { event.preventDefault(); savePostgres.mutate({ connectionString: postgresConnection || undefined, tableName: postgresTable, ssl: postgresSsl, enabled: postgresEnabled }); }} className="mt-6 space-y-4">
        <Field label={<>String de conexão <SensitiveHint configured={postgres?.hasCredential} /></>}><input type="password" value={postgresConnection} onChange={event => setPostgresConnection(event.target.value)} placeholder="postgresql://usuario:senha@host:5432/banco" /></Field>
        <Field label="Tabela de destino"><input required value={postgresTable} onChange={event => setPostgresTable(event.target.value)} placeholder="altixdev_leads" /></Field>
        <div className="grid gap-3 sm:grid-cols-2"><Toggle checked={postgresSsl} onChange={setPostgresSsl}>Exigir SSL</Toggle><Toggle checked={postgresEnabled} onChange={setPostgresEnabled}>Ativar PostgreSQL</Toggle></div>
        <ActionButtons savePending={savePostgres.isPending} configured={postgres?.configured} testing={testConnection.isPending} onTest={() => testConnection.mutate({ provider: "postgres" })} />
      </form><StatusLine value={postgres?.lastCheckAt} message={postgres?.lastMessage} prefix={postgres?.host ? `Destino: ${postgres.host} · ` : ""} />
    </article>

    <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,.04)] xl:col-span-2">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex items-center gap-2"><BarChart3 size={18} className="text-[#1D4ED8]" /><h2 className="font-serif text-2xl">Google Analytics 4</h2></div><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Visualize no painel o desempenho da propriedade GA4 nos últimos 30 dias. A credencial fica cifrada no servidor e não é exibida novamente.</p></div><StatusBadge active={analytics?.enabled} /></div>
      <form onSubmit={event => { event.preventDefault(); saveAnalytics.mutate({ serviceAccountJson: analyticsCredential || undefined, propertyId: analyticsPropertyId, measurementId: analyticsMeasurementId || undefined, enabled: analyticsEnabled }); }} className="mt-6 grid gap-4 lg:grid-cols-2">
        <Field label="ID da propriedade GA4"><input required value={analyticsPropertyId} onChange={event => setAnalyticsPropertyId(event.target.value)} placeholder="123456789" /></Field>
        <Field label="ID de medição do site"><input value={analyticsMeasurementId} onChange={event => setAnalyticsMeasurementId(event.target.value)} placeholder="G-XXXXXXXXXX" /></Field>
        <div className="lg:col-span-2"><Field label={<>JSON da conta de serviço <SensitiveHint configured={analytics?.hasCredential} /></>}><textarea value={analyticsCredential} onChange={event => setAnalyticsCredential(event.target.value)} className="min-h-24 font-mono text-xs" placeholder='{"type":"service_account", ...}' /></Field></div>
        <div className="flex flex-wrap items-center gap-3 lg:col-span-2"><Toggle checked={analyticsEnabled} onChange={setAnalyticsEnabled}>Ativar coleta e métricas GA4</Toggle><button disabled={saveAnalytics.isPending} className="inline-flex items-center gap-2 rounded-xl bg-[#1D4ED8] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"><Settings2 size={16} /> Salvar</button><button type="button" disabled={!analytics?.configured || testAnalytics.isPending} onClick={() => testAnalytics.mutate()} className="secondary-button"><TestTube2 size={16} /> Testar</button><button type="button" disabled={!analytics?.enabled || analyticsOverview.isFetching} onClick={() => analyticsOverview.refetch()} className="secondary-button"><RefreshCw size={16} className={analyticsOverview.isFetching ? "animate-spin" : ""} /> Atualizar métricas</button></div>
      </form>
      <StatusLine value={analytics?.lastCheckAt} message={analytics?.lastMessage} />
      {analytics?.enabled && <div className="mt-6 border-t border-slate-100 pt-6">{analyticsOverview.isLoading ? <p className="text-sm text-slate-500">Carregando métricas GA4…</p> : analyticsOverview.isError ? <p className="text-sm text-rose-600">Não foi possível carregar as métricas. Revise a conexão e use “Testar”.</p> : summary ? <AnalyticsSummary overview={overview} /> : <p className="text-sm text-slate-500">Nenhuma métrica disponível para o período.</p>}</div>}
    </article>

    <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,.04)] xl:col-span-2"><div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><div className="flex items-center gap-2"><CheckCircle2 size={18} className="text-[#1D4ED8]" /><h2 className="font-serif text-2xl">Sincronização manual de oportunidade</h2></div><p className="mt-2 text-sm text-slate-500">Selecione um lead e envie-o diretamente à integração ativada. O resultado será registrado nos logs.</p></div><div className="flex flex-col gap-2 sm:flex-row"><select value={leadId} onChange={event => setLeadId(event.target.value ? Number(event.target.value) : "")} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none"><option value="">Selecione um lead</option>{leads.map(lead => <option key={lead.id} value={lead.id}>#{lead.id} · {lead.name}</option>)}</select><button disabled={!leadId || syncLead.isPending || !google?.enabled} onClick={() => leadId && syncLead.mutate({ provider: "google_sheets", leadId })} className="secondary-button"><Send size={16} /> Google Sheets</button><button disabled={!leadId || syncLead.isPending || !postgres?.enabled} onClick={() => leadId && syncLead.mutate({ provider: "postgres", leadId })} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0B1730] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"><Send size={16} /> PostgreSQL</button></div></div></article>
  </section>;
}

function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) { return <label className="block text-sm font-semibold text-slate-700">{label}<div className="mt-2 [&>input]:w-full [&>input]:rounded-xl [&>input]:border [&>input]:border-slate-200 [&>input]:px-3 [&>input]:py-2.5 [&>input]:text-sm [&>input]:font-normal [&>input]:outline-none [&>textarea]:w-full [&>textarea]:rounded-xl [&>textarea]:border [&>textarea]:border-slate-200 [&>textarea]:px-3 [&>textarea]:py-2.5 [&>textarea]:font-normal [&>textarea]:outline-none">{children}</div></label>; }
function Toggle({ checked, onChange, children }: { checked: boolean; onChange: (value: boolean) => void; children: React.ReactNode }) { return <label className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 text-sm font-medium text-slate-700"><input type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)} className="h-4 w-4 accent-[#1D4ED8]" /> {children}</label>; }
function StatusBadge({ active }: { active?: boolean }) { return <span className={`self-start rounded-full px-2.5 py-1 text-xs font-semibold ${active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{active ? "Ativo" : "Inativo"}</span>; }
function SensitiveHint({ configured }: { configured?: boolean }) { return <span className="font-normal text-slate-400">{configured ? "(já protegido; cole apenas para substituir)" : ""}</span>; }
function StatusLine({ value, message, prefix = "" }: { value?: Date | string | null; message?: string | null; prefix?: string }) { return <p className="mt-5 text-xs text-slate-500">{prefix}Última verificação: {statusText(value)} · {message || "Aguardando configuração"}</p>; }
function ActionButtons({ savePending, configured, testing, onTest }: { savePending: boolean; configured?: boolean; testing: boolean; onTest: () => void }) { return <div className="flex flex-wrap gap-3"><button disabled={savePending} className="inline-flex items-center gap-2 rounded-xl bg-[#1D4ED8] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"><Settings2 size={16} /> Salvar</button><button type="button" disabled={!configured || testing} onClick={onTest} className="secondary-button"><TestTube2 size={16} /> Testar</button></div>; }
function AnalyticsSummary({ overview }: { overview: AnalyticsOverview }) { const summary = overview.summary; const metrics = [{ label: "Usuários ativos", value: summary.activeUsers.toLocaleString("pt-BR") }, { label: "Novos usuários", value: summary.newUsers.toLocaleString("pt-BR") }, { label: "Sessões", value: summary.sessions.toLocaleString("pt-BR") }, { label: "Visualizações", value: summary.pageViews.toLocaleString("pt-BR") }, { label: "Engajamento", value: `${(summary.engagementRate * 100).toFixed(1).replace(".", ",")}%` }]; return <><div className="grid grid-cols-2 gap-3 lg:grid-cols-5">{metrics.map(metric => <div key={metric.label} className="rounded-xl bg-[#F7F8FC] p-4"><p className="text-xs font-medium text-slate-500">{metric.label}</p><strong className="mt-2 block text-2xl tracking-tight text-slate-900">{metric.value}</strong></div>)}</div><div className="mt-5 grid gap-5 lg:grid-cols-2"><AnalyticsList title="Canais principais" rows={overview.channels.map(channel => [channel.channel, `${channel.sessions.toLocaleString("pt-BR")} sessões`])} /><AnalyticsList title="Páginas principais" rows={overview.pages.map(page => [page.path, `${page.pageViews.toLocaleString("pt-BR")} visualizações`])} /></div></>; }
function AnalyticsList({ title, rows }: { title: string; rows: Array<[string, string]> }) { return <div><p className="text-xs font-bold uppercase tracking-[.14em] text-slate-400">{title}</p><div className="mt-3 space-y-2">{rows.map(([label, value]) => <div key={`${label}-${value}`} className="flex items-center justify-between gap-3 border-b border-slate-100 py-2 text-sm"><span className="truncate text-slate-600">{label}</span><strong className="shrink-0">{value}</strong></div>)}</div></div>; }
