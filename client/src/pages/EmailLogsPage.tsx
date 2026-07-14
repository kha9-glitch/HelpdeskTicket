import { useEffect, useState } from "react";
import { Card } from "../components/ui/card";
import { authClient } from "../lib/auth-client";
import { Loader2, CheckCircle2, XCircle, Activity } from "lucide-react";

export default function EmailLogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const res = await fetch("/api/settings/logs");
        if (res.ok) {
          const data = await res.json();
          setLogs(data as any[]);
        } else {
          throw new Error("Failed to load");
        }
      } catch (e: any) {
        setError("Failed to load email logs.");
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, []);

  if (loading) {
    return <div className="flex h-[50vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Email Activity Logs</h2>
        <p className="text-muted-foreground mt-1">Monitor all incoming emails (IMAP) and outgoing replies (SMTP).</p>
      </div>

      {error && <div className="p-4 bg-destructive/10 text-destructive rounded-lg font-medium">{error}</div>}

      <Card>
        <div className="divide-y divide-border">
          {logs.length === 0 ? (
            <div className="p-12 text-center flex flex-col items-center text-muted-foreground">
              <Activity className="h-10 w-10 mb-4 opacity-50" />
              <p>No email activity recorded yet.</p>
              <p className="text-sm mt-1">Make sure your IMAP and SMTP configurations are saved and active.</p>
            </div>
          ) : (
            logs.map((log: any) => (
              <div key={log.id} className="p-4 flex items-start gap-4 hover:bg-accent/30 transition-colors">
                <div className="mt-0.5 shrink-0">
                  {log.level === "error" ? (
                    <XCircle className="h-5 w-5 text-destructive" />
                  ) : (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${log.component === 'IMAP' ? 'bg-blue-500/10 text-blue-600' : 'bg-orange-500/10 text-orange-600'}`}>
                        {log.component}
                      </span>
                      <span className={`text-xs font-semibold uppercase ${log.level === 'error' ? 'text-destructive' : 'text-green-600'}`}>
                        {log.level}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm text-foreground font-medium">{log.message}</p>
                  {log.details && (
                    <p className="text-xs text-muted-foreground mt-1.5 font-mono bg-muted/50 p-2 rounded break-all">
                      {log.details}
                    </p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
