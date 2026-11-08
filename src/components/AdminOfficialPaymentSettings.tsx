import { useEffect, useState } from "react";
import { CreditCard, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

type Config = {
  bot_token: string;
  official_wechat_enabled: boolean | null;
  official_wechat_app_id: string | null;
  official_wechat_mch_id: string | null;
  official_wechat_serial_no: string | null;
  official_wechat_private_key: string | null;
  official_wechat_api_v3_key: string | null;
  official_wechat_platform_public_key: string | null;
  official_alipay_enabled: boolean | null;
  official_alipay_app_id: string | null;
  official_alipay_private_key: string | null;
  official_alipay_public_key: string | null;
};

export function AdminOfficialPaymentSettings() {
  const { toast } = useToast();
  const [configs, setConfigs] = useState<Config[]>([]);
  const [selected, setSelected] = useState("");
  const [form, setForm] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("shop_configs").select("bot_token,official_wechat_enabled,official_wechat_app_id,official_wechat_mch_id,official_wechat_serial_no,official_wechat_private_key,official_wechat_api_v3_key,official_wechat_platform_public_key,official_alipay_enabled,official_alipay_app_id,official_alipay_private_key,official_alipay_public_key").order("updated_at", { ascending: false });
    if (error) toast({ title: "加载失败", description: error.message, variant: "destructive" });
    const rows = (data || []) as Config[];
    setConfigs(rows);
    const token = selected || rows[0]?.bot_token || "";
    setSelected(token);
    setForm(rows.find(row => row.bot_token === token) || null);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { setForm(configs.find(row => row.bot_token === selected) || null); }, [selected, configs]);

  const change = (key: keyof Config, value: string | boolean) => setForm(current => current ? { ...current, [key]: value } : current);
  const save = async () => {
    if (!form) return;
    if (form.official_wechat_enabled && (!form.official_wechat_app_id || !form.official_wechat_mch_id || !form.official_wechat_serial_no || !form.official_wechat_private_key || !form.official_wechat_api_v3_key || !form.official_wechat_platform_public_key)) {
      toast({ title: "微信官方配置未填写完整", variant: "destructive" }); return;
    }
    if (form.official_alipay_enabled && (!form.official_alipay_app_id || !form.official_alipay_private_key || !form.official_alipay_public_key)) {
      toast({ title: "支付宝官方配置未填写完整", variant: "destructive" }); return;
    }
    setSaving(true);
    const { bot_token, ...values } = form;
    const { error } = await supabase.from("shop_configs").update(values as any).eq("bot_token", bot_token);
    setSaving(false);
    if (error) toast({ title: "保存失败", description: error.message, variant: "destructive" });
    else { toast({ title: "官方支付配置已保存" }); await load(); }
  };

  if (loading) return <div className="flex items-center gap-2 py-8"><Loader2 className="animate-spin" />正在加载支付配置…</div>;
  return <div className="space-y-5 max-w-5xl">
    <div>
      <h3 className="text-xl font-bold flex items-center gap-2"><CreditCard className="h-5 w-5" />微信/支付宝官方支付</h3>
      <p className="text-sm text-muted-foreground mt-1">选择 Telegram 商城机器人后配置官方商户。每个机器人可使用不同商户。</p>
    </div>
    <select className="w-full rounded-md border bg-background p-2" value={selected} onChange={e => setSelected(e.target.value)}>
      {configs.map(row => <option key={row.bot_token} value={row.bot_token}>{row.bot_token.slice(0, 12) + "…"}</option>)}
    </select>
    {!form ? <Card className="p-6 text-muted-foreground">暂无 Telegram 商城配置，请先连接一个商城机器人。</Card> : <>
      <Card className="p-5 space-y-4 border-green-500/30">
        <div className="flex items-center justify-between"><div><div className="font-bold">微信支付官方商户（Native）</div><div className="text-xs text-muted-foreground">扫码支付，支付成功后自动验签发货</div></div><Switch checked={!!form.official_wechat_enabled} onCheckedChange={v => change("official_wechat_enabled", v)} /></div>
        <div className="grid md:grid-cols-2 gap-3">
          <Input value={form.official_wechat_app_id || ""} onChange={e => change("official_wechat_app_id", e.target.value)} placeholder="公众号/应用 AppID" />
          <Input value={form.official_wechat_mch_id || ""} onChange={e => change("official_wechat_mch_id", e.target.value)} placeholder="微信支付商户号 mchid" />
          <Input value={form.official_wechat_serial_no || ""} onChange={e => change("official_wechat_serial_no", e.target.value)} placeholder="商户 API 证书序列号" />
          <Input type="password" value={form.official_wechat_api_v3_key || ""} onChange={e => change("official_wechat_api_v3_key", e.target.value)} placeholder="API v3 密钥（32位）" />
          <Textarea rows={5} value={form.official_wechat_private_key || ""} onChange={e => change("official_wechat_private_key", e.target.value)} placeholder="商户私钥 PEM" className="font-mono text-xs" />
          <Textarea rows={5} value={form.official_wechat_platform_public_key || ""} onChange={e => change("official_wechat_platform_public_key", e.target.value)} placeholder="微信支付公钥/平台证书公钥 PEM" className="font-mono text-xs" />
        </div>
      </Card>
      <Card className="p-5 space-y-4 border-blue-500/30">
        <div className="flex items-center justify-between"><div><div className="font-bold">支付宝官方商户（当面付）</div><div className="text-xs text-muted-foreground">RSA2 签名，请确保应用已签约当面付</div></div><Switch checked={!!form.official_alipay_enabled} onCheckedChange={v => change("official_alipay_enabled", v)} /></div>
        <Input value={form.official_alipay_app_id || ""} onChange={e => change("official_alipay_app_id", e.target.value)} placeholder="支付宝开放平台 AppID" />
        <div className="grid md:grid-cols-2 gap-3">
          <Textarea rows={5} value={form.official_alipay_private_key || ""} onChange={e => change("official_alipay_private_key", e.target.value)} placeholder="应用私钥 PEM（不是应用公钥）" className="font-mono text-xs" />
          <Textarea rows={5} value={form.official_alipay_public_key || ""} onChange={e => change("official_alipay_public_key", e.target.value)} placeholder="支付宝公钥 PEM（不是应用公钥）" className="font-mono text-xs" />
        </div>
      </Card>
      <Button className="w-full" onClick={save} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}保存官方支付配置</Button>
    </>}
  </div>;
}
