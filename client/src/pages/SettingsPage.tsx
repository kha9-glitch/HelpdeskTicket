import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { authClient } from "../lib/auth-client";
import { Loader2, Save, Server, Mail, Activity } from "lucide-react";

export default function SettingsPage() {
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingImap, setTestingImap] = useState(false);
  const [testingSmtp, setTestingSmtp] = useState(false);
  const [message, setMessage] = useState<{type: "error" | "success", text: string} | null>(null);

  const fetchData = async () => {
    try {
      const { data: configData } = await authClient.fetch("/api/settings/email", {});
      if (configData) {
        setConfig(configData);
      } else {
        setConfig({
          imapHost: "", imapPort: 993, imapUser: "", imapPassword: "", imapTls: true,
          smtpHost: "", smtpPort: 465, smtpUser: "", smtpPassword: "", smtpSecure: true,
          fromAddress: "", isActive: true
        });
      }
    } catch (e: any) {
      setMessage({ type: "error", text: "Failed to load settings." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const { error: apiError } = await authClient.fetch("/api/settings/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config)
      });
      if (apiError) throw apiError;
      
      setMessage({ type: "success", text: "Configuration saved successfully!" });
      await fetchData();
    } catch (e: any) {
      setMessage({ type: "error", text: "Failed to save settings. Please check your inputs." });
    } finally {
      setSaving(false);
    }
  };

  const handleTestImap = async () => {
    setTestingImap(true);
    setMessage(null);
    try {
      const { data, error: apiError } = await authClient.fetch("/api/settings/test-imap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config)
      });
      if (apiError || (data as any)?.success === false) throw apiError || (data as any)?.message;
      setMessage({ type: "success", text: "IMAP Connection Successful!" });
    } catch (e: any) {
      console.error(e);
      let errorMsg = "Unknown error";
      if (typeof e === 'string') errorMsg = e;
      else if (e?.error?.message) errorMsg = e.error.message;
      else if (e?.body?.message) errorMsg = e.body.message;
      else if (e?.message) errorMsg = e.message;
      else errorMsg = JSON.stringify(e);
      
      setMessage({ type: "error", text: `IMAP Test Failed: ${errorMsg}` });
    } finally {
      setTestingImap(false);
    }
  };

  const handleTestSmtp = async () => {
    setTestingSmtp(true);
    setMessage(null);
    try {
      const { data, error: apiError } = await authClient.fetch("/api/settings/test-smtp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config)
      });
      if (apiError || (data as any)?.success === false) throw apiError || (data as any)?.message;
      setMessage({ type: "success", text: "SMTP Connection Successful!" });
    } catch (e: any) {
      console.error(e);
      let errorMsg = "Unknown error";
      if (typeof e === 'string') errorMsg = e;
      else if (e?.error?.message) errorMsg = e.error.message;
      else if (e?.body?.message) errorMsg = e.body.message;
      else if (e?.message) errorMsg = e.message;
      else errorMsg = JSON.stringify(e);
      
      setMessage({ type: "error", text: `SMTP Test Failed: ${errorMsg}` });
    } finally {
      setTestingSmtp(false);
    }
  };

  if (loading) {
    return <div className="flex h-[50vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Email Server Configurations</h2>
        <p className="text-muted-foreground mt-1">Setup your inbound (IMAP) and outbound (SMTP) email connections separately.</p>
      </div>

      {message && (
        <div className={`p-4 rounded-lg font-medium border ${message.type === 'error' ? 'bg-destructive/10 text-destructive border-destructive/20' : 'bg-green-500/10 text-green-600 border-green-500/20'}`}>
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* IMAP SETTINGS */}
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Server className="h-5 w-5 text-primary" /> Inbound Mail (IMAP)</CardTitle>
            <CardDescription>Configure how the system reads incoming emails to create tickets.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 flex-1">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">IMAP Host</label>
              <Input value={config.imapHost || ""} onChange={(e) => setConfig({...config, imapHost: e.target.value})} placeholder="imap.gmail.com" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">IMAP Port</label>
              <Input type="number" value={config.imapPort || ""} onChange={(e) => setConfig({...config, imapPort: parseInt(e.target.value) || 993})} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Email / Username</label>
              <Input value={config.imapUser || ""} onChange={(e) => setConfig({...config, imapUser: e.target.value})} placeholder="support@yourdomain.com" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">App Password</label>
              <Input type="password" value={config.imapPassword || ""} onChange={(e) => setConfig({...config, imapPassword: e.target.value})} placeholder={config.imapPassword === "********" ? "******** (Unchanged)" : "Enter password"} />
            </div>
          </CardContent>
          <CardFooter className="border-t pt-4 bg-muted/20 flex justify-between">
            <Button variant="outline" onClick={handleTestImap} disabled={testingImap || saving}>
              {testingImap ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Activity className="h-4 w-4 mr-2" />}
              Test IMAP Connection
            </Button>
          </CardFooter>
        </Card>

        {/* SMTP SETTINGS */}
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Mail className="h-5 w-5 text-primary" /> Outbound Mail (SMTP)</CardTitle>
            <CardDescription>Configure how the system sends replies back to customers.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 flex-1">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">SMTP Host</label>
              <Input value={config.smtpHost || ""} onChange={(e) => setConfig({...config, smtpHost: e.target.value})} placeholder="smtp.gmail.com" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">SMTP Port</label>
              <Input type="number" value={config.smtpPort || ""} onChange={(e) => setConfig({...config, smtpPort: parseInt(e.target.value) || 465})} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Email / Username</label>
              <Input value={config.smtpUser || ""} onChange={(e) => setConfig({...config, smtpUser: e.target.value})} placeholder="support@yourdomain.com" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">App Password</label>
              <Input type="password" value={config.smtpPassword || ""} onChange={(e) => setConfig({...config, smtpPassword: e.target.value})} placeholder={config.smtpPassword === "********" ? "******** (Unchanged)" : "Enter password"} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">From Address</label>
              <Input value={config.fromAddress || ""} onChange={(e) => setConfig({...config, fromAddress: e.target.value})} placeholder="Support Team <support@domain.com>" />
            </div>
          </CardContent>
          <CardFooter className="border-t pt-4 bg-muted/20 flex justify-between">
            <Button variant="outline" onClick={handleTestSmtp} disabled={testingSmtp || saving}>
              {testingSmtp ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Activity className="h-4 w-4 mr-2" />}
              Test SMTP Connection
            </Button>
          </CardFooter>
        </Card>
      </div>

      <div className="flex justify-end pt-4 border-t">
        <Button size="lg" onClick={handleSave} disabled={saving} className="min-w-[200px]">
          {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Save className="mr-2 h-5 w-5" /> Save All Configurations</>}
        </Button>
      </div>
    </div>
  );
}
