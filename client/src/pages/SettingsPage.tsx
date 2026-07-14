import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { authClient } from "../lib/auth-client";
import { Loader2, Save, Server, Shield, Mail, CheckCircle2, XCircle } from "lucide-react";

export default function SettingsPage() {
  const [config, setConfig] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const fetchData = async () => {
    try {
      const [{ data: configData }, { data: logsData }] = await Promise.all([
        authClient.fetch("/api/settings/email", {}),
        authClient.fetch("/api/settings/logs", {})
      ]);
      if (configData) {
        setConfig(configData);
      } else {
        setConfig({
          imapHost: "", imapPort: 993, imapUser: "", imapPassword: "", imapTls: true,
          smtpHost: "", smtpPort: 465, smtpUser: "", smtpPassword: "", smtpSecure: true,
          fromAddress: "", isActive: true
        });
      }
      setLogs(logsData || []);
    } catch (e: any) {
      setError("Failed to load settings.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const { error: apiError } = await authClient.fetch("/api/settings/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config)
      });
      if (apiError) throw apiError;
      
      await fetchData();
    } catch (e: any) {
      setError("Failed to save settings. Please check your inputs.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex h-[50vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Email Integration Settings</h2>
        <p className="text-muted-foreground mt-1">Configure your IMAP and SMTP connections to automatically receive and send emails.</p>
      </div>

      {error && <div className="p-4 bg-destructive/10 text-destructive rounded-lg font-medium">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Server className="h-5 w-5 text-primary" /> IMAP (Incoming)</CardTitle>
            <CardDescription>Server details for reading customer emails.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">IMAP Host</label>
              <Input value={config.imapHost} onChange={(e) => setConfig({...config, imapHost: e.target.value})} placeholder="imap.gmail.com" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">IMAP Port</label>
              <Input type="number" value={config.imapPort} onChange={(e) => setConfig({...config, imapPort: parseInt(e.target.value)})} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Email / Username</label>
              <Input value={config.imapUser} onChange={(e) => setConfig({...config, imapUser: e.target.value})} placeholder="support@yourdomain.com" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">App Password</label>
              <Input type="password" value={config.imapPassword} onChange={(e) => setConfig({...config, imapPassword: e.target.value})} placeholder="********" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Mail className="h-5 w-5 text-primary" /> SMTP (Outgoing)</CardTitle>
            <CardDescription>Server details for sending replies.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">SMTP Host</label>
              <Input value={config.smtpHost} onChange={(e) => setConfig({...config, smtpHost: e.target.value})} placeholder="smtp.gmail.com" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">SMTP Port</label>
              <Input type="number" value={config.smtpPort} onChange={(e) => setConfig({...config, smtpPort: parseInt(e.target.value)})} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Email / Username</label>
              <Input value={config.smtpUser} onChange={(e) => setConfig({...config, smtpUser: e.target.value})} placeholder="support@yourdomain.com" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">App Password</label>
              <Input type="password" value={config.smtpPassword} onChange={(e) => setConfig({...config, smtpPassword: e.target.value})} placeholder="********" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">From Address</label>
              <Input value={config.fromAddress} onChange={(e) => setConfig({...config, fromAddress: e.target.value})} placeholder="Support Team <support@domain.com>" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end gap-4">
        <Button onClick={handleSave} disabled={saving} className="min-w-[120px]">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="mr-2" /> Save Config</>}
        </Button>
      </div>

      <div className="mt-12">
        <h3 className="text-xl font-bold tracking-tight mb-4 flex items-center gap-2"><Shield className="h-5 w-5" /> Connection Logs</h3>
        <Card>
          <div className="divide-y divide-border">
            {logs.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground">No logs recorded yet.</div>
            ) : (
              logs.map((log: any) => (
                <div key={log.id} className="p-4 flex items-start gap-3 hover:bg-accent/50 transition-colors">
                  {log.level === "error" ? <XCircle className="h-5 w-5 text-destructive mt-0.5 shrink-0" /> : <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />}
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-[14px]">{log.component}</span>
                      <span className="text-xs text-muted-foreground">{new Date(log.createdAt).toLocaleString()}</span>
                    </div>
                    <p className="text-sm text-foreground mt-0.5">{log.message}</p>
                    {log.details && <p className="text-xs text-muted-foreground mt-1 font-mono bg-muted p-2 rounded">{log.details}</p>}
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
