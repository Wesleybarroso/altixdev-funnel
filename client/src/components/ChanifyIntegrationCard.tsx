import { trpc } from "@/lib/trpc";
import { BellRing, Settings2, TestTube2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

function formatDate(value: Date | string | null | undefined) {
  return value ? new Date(value).toLocaleString("pt-BR") : "Sem teste ainda";
}

function HealthBadge({ status }: { status: number | null | undefined }) {
  if (!status) return <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">Sem teste</span>;
  if (status >= 200 && status < 300) return <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">Saudável</span>;
  return <span className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700">Com erro</span>;
}

export default function ChanifyIntegrationCard() {
  const utils = trpc.useUtils();
  const configQuery = trpc.chanify.get.useQuery();
  const [token, setToken] = useState("");
  const [serverUrl, setServerUrl] = useState("https://api.chanify.net");
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (configQuery.data) {
      setEnabled(configQuery.data.enabled);
      setServerUrl(configQuery.data.serverUrl || "https://api.chanify.net");
    }
  }, [configQuery.data]);

  const refresh = () => {
    void utils.chanify.get.invalidate();
    void utils.logs.list.invalidate();
  };
  const save = trpc.chanify.save.useMutation({
    onSuccess: () => { setToken(""); refresh(); toast.success("Configuração Chanify salva."); },
    onError: error => toast.error(error.message),
  });
  const test = trpc.chanify.test.useMutation({
    onSuccess: result => { refresh(); result.ok ? toast.success("Teste enviado ao Chanify.") : toast.error("Chanify respondeu com erro."); },
    onError: error => toast.error(error.message),
  });

  const config = configQuery.data;
  return <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,.04)]">
    <div className="flex items-start justify-between gap-4">
      <div><div className="flex items-center gap-2"><BellRing size={18} className="text-[#1D4ED8]" /><h2 className="font-serif text-2xl">Notificações Chanify</h2></div><p className="mt-2 text-sm leading-6 text-slate-500">Receba alertas comerciais no iPhone pelo Chanify. O token fica cifrado no servidor e não volta para o navegador.</p></div>
      <div className="flex flex-wrap justify-end gap-2"><HealthBadge status={config?.lastStatus} /><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${config?.enabled ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{config?.enabled ? "Ativo" : "Inativo"}</span></div>
    </div>
    <form onSubmit={event => { event.preventDefault(); save.mutate({ serverUrl, token: token || undefined, removeToken: false, enabled }); }} className="mt-6 space-y-4">
      <label className="block text-sm font-semibold text-slate-700">Servidor Chanify<input required type="url" value={serverUrl} onChange={event => setServerUrl(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-normal outline-none focus:border-[#1D4ED8]" placeholder="https://chanify.seudominio.com" /></label>
      <label className="block text-sm font-semibold text-slate-700">Token Chanify <span className="font-normal text-slate-400">{config?.hasToken ? "(já protegido; cole apenas para substituir)" : ""}</span><input required={!config?.hasToken} type="password" value={token} onChange={event => setToken(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-normal outline-none focus:border-[#1D4ED8]" placeholder="Token do canal Chanify" /></label>
      <label className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 text-sm font-medium text-slate-700"><input type="checkbox" checked={enabled} onChange={event => setEnabled(event.target.checked)} className="h-4 w-4 accent-[#1D4ED8]" /> Ativar alertas automáticos pelo Chanify</label>
      <div className="flex flex-wrap gap-3"><button disabled={save.isPending} className="inline-flex items-center gap-2 rounded-xl bg-[#1D4ED8] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"><Settings2 size={16} /> Salvar Chanify</button><button type="button" disabled={!config?.enabled || test.isPending} onClick={() => test.mutate()} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold hover:bg-slate-50 disabled:opacity-40"><TestTube2 size={16} /> Testar no celular</button></div>
    </form>
    <p className="mt-5 text-xs text-slate-500">Última verificação: {formatDate(config?.lastCheckAt)} · {config?.lastMessage || "Aguardando configuração"}</p>
    <p className="mt-3 text-xs leading-5 text-slate-400">Use `https://api.chanify.net` para o serviço oficial ou o endereço HTTPS do seu domínio EasyPanel. No Chanify: crie ou selecione um canal, abra os detalhes e copie o token. Cole-o somente neste campo.</p>
  </article>;
}
