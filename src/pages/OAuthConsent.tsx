// OAuth 2.1 consent page for the MCP server.
// Route: /.lovable/oauth/consent (see App.tsx and supabase--configure_oauth_server default).
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

type AnyAuth = any;

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) {
        setError("Parâmetro authorization_id ausente na URL.");
        return;
      }
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const next = window.location.pathname + window.location.search;
        window.location.href = "/login?next=" + encodeURIComponent(next);
        return;
      }
      try {
        const oauth = (supabase.auth as AnyAuth).oauth;
        if (!oauth?.getAuthorizationDetails) {
          setError("Servidor OAuth não disponível no cliente Supabase desta build.");
          return;
        }
        const { data, error } = await oauth.getAuthorizationDetails(authorizationId);
        if (!active) return;
        if (error) return setError(error.message);
        const immediate = data?.redirect_url ?? data?.redirect_to;
        if (immediate && !data?.client) {
          window.location.href = immediate;
          return;
        }
        setDetails(data);
      } catch (e: any) {
        setError(e?.message ?? "Erro ao carregar autorização.");
      }
    })();
    return () => { active = false; };
  }, [authorizationId]);

  async function decide(approve: boolean) {
    setBusy(true);
    try {
      const oauth = (supabase.auth as AnyAuth).oauth;
      const { data, error } = approve
        ? await oauth.approveAuthorization(authorizationId)
        : await oauth.denyAuthorization(authorizationId);
      if (error) { setBusy(false); return setError(error.message); }
      const target = data?.redirect_url ?? data?.redirect_to;
      if (!target) { setBusy(false); return setError("Servidor não retornou URL de redirecionamento."); }
      window.location.href = target;
    } catch (e: any) {
      setBusy(false);
      setError(e?.message ?? "Erro ao processar decisão.");
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-lg p-6 space-y-4">
        {error ? (
          <>
            <h1 className="text-xl font-semibold text-destructive">Não foi possível carregar</h1>
            <p className="text-sm text-muted-foreground break-words">{error}</p>
          </>
        ) : !details ? (
          <p className="text-sm text-muted-foreground">Carregando autorização…</p>
        ) : (
          <>
            <h1 className="text-xl font-semibold">
              Conectar {details.client?.name ?? "aplicativo externo"} ao Painel Central
            </h1>
            <p className="text-sm text-muted-foreground">
              Este aplicativo poderá acessar dados do Painel Central em seu nome, respeitando suas permissões.
            </p>
            {Array.isArray(details.scopes) && details.scopes.length > 0 && (
              <ul className="text-xs text-muted-foreground list-disc pl-4">
                {details.scopes.map((s: string) => <li key={s}>{s}</li>)}
              </ul>
            )}
            <div className="flex gap-2 pt-2">
              <button
                disabled={busy}
                onClick={() => decide(false)}
                className="flex-1 h-10 rounded-md border border-border text-sm hover:bg-muted disabled:opacity-50"
              >
                Negar
              </button>
              <button
                disabled={busy}
                onClick={() => decide(true)}
                className="flex-1 h-10 rounded-md bg-primary text-primary-foreground text-sm hover:opacity-90 disabled:opacity-50"
              >
                Aprovar
              </button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
