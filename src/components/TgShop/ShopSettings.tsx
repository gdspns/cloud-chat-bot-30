import React, { useState, useEffect } from "react";
import { Bot, CreditCard, Wallet, Power, PlugZap, RefreshCw, Coins, Copy, Check, ExternalLink, Plus, X, Key } from "lucide-react";
import { ShopConfig } from "./types";

interface ShopSettingsProps {
  config: ShopConfig;
  onSave: (config: Partial<ShopConfig>) => void;
  showToast: (type: "success" | "error" | "info", message: string) => void;
  botToken?: string;
}

export function ShopSettings({ config, onSave, showToast, botToken }: ShopSettingsProps) {
  const [localConfig, setLocalConfig] = useState(config);
  const [isVerifying, setIsVerifying] = useState(false);
  const [copied, setCopied] = useState(false);
  const [webhookCopied, setWebhookCopied] = useState(false);

  useEffect(() => {
    setLocalConfig(config);
  }, [config]);

  const handleChange = (key: keyof ShopConfig, value: any) => {
    setLocalConfig(prev => ({ ...prev, [key]: value }));
  };

  const handleVerifyConnection = async () => {
    const token = botToken || localConfig.token;
    if (!token) {
      showToast("error", "请先填写 Telegram Bot Token");
      return;
    }
    setIsVerifying(true);
    
    try {
      // 调用真实的 Telegram API 验证 Bot Token
      const response = await fetch(`https://api.telegram.org/bot${token}/getMe`);
      const data = await response.json();
      
      if (data.ok && data.result) {
        const botInfo = data.result;
        const newConfig = { 
          ...localConfig, 
          status: 'online' as const,
          botUsername: botInfo.username,
          botFirstName: botInfo.first_name
        };
        setLocalConfig(newConfig);
        onSave(newConfig);
        showToast("success", `连接成功！机器人 @${botInfo.username} 已上线。`);
      } else {
        showToast("error", `验证失败: ${data.description || 'Token 无效'}`);
      }
    } catch (error) {
      console.error('Bot verification error:', error);
      showToast("error", "网络错误，请检查网络连接后重试");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleDisconnect = () => {
    if (!confirm("确定要断开连接吗？\n机器人将停止响应用户的购买指令。")) return;
    
    const newConfig = { ...localConfig, status: 'offline' as const };
    setLocalConfig(newConfig);
    onSave(newConfig);
    showToast("info", "机器人已断开连接");
  };

  const handleSaveClick = () => {
    onSave(localConfig);
  };

  const handleCopyAddress = () => {
    if (!localConfig.walletAddress) return;
    navigator.clipboard.writeText(localConfig.walletAddress).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      showToast("error", "复制失败");
    });
  };

  // 生成 Webhook URL
  const getWebhookUrl = () => {
    const token = botToken || localConfig.token;
    if (!token) return '';
    const baseUrl = import.meta.env.VITE_SUPABASE_URL || '';
    return `${baseUrl}/functions/v1/shop-payment-webhook?bot_token=${token}`;
  };

  const handleCopyWebhook = (type: string) => {
    const token = botToken || localConfig.token;
    if (!token) return;
    const url = `${getWebhookUrl()}&type=${type}`;
    navigator.clipboard.writeText(url).then(() => {
      setWebhookCopied(true);
      setTimeout(() => setWebhookCopied(false), 2000);
      showToast("success", "Webhook URL 已复制");
    }).catch(() => {
      showToast("error", "复制失败");
    });
  };

  return (
    <div className="p-8 max-w-6xl mx-auto overflow-y-auto h-full pb-20">
      <h2 className="text-2xl font-bold text-foreground mb-6">商城配置</h2>
      
      <div className="space-y-6">
        {/* 机器人连接 */}
        <div className="bg-card p-6 rounded-xl border shadow-sm">
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-foreground">
            <Bot size={20} className="text-primary"/> 机器人与管理员
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {!botToken && (
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-foreground mb-1">Telegram Bot Token (必填)</label>
                <input 
                  type="password" 
                  value={localConfig.token}
                  onChange={(e) => handleChange('token', e.target.value)}
                  placeholder="123456789:ABCdefGHIjklMNOpqrs..."
                  className="w-full p-2 bg-background border rounded font-mono text-sm focus:ring-2 focus:ring-primary outline-none"
                />
              </div>
            )}
            {botToken && (
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-foreground mb-1">Telegram Bot Token</label>
                <div className="flex items-center gap-2 p-2 bg-muted border rounded">
                  <span className="font-mono text-sm text-muted-foreground">***{botToken.slice(-8)}</span>
                  <span className="text-xs text-green-600 bg-green-500/10 px-2 py-0.5 rounded">已从菜单键盘继承</span>
                </div>
              </div>
            )}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-foreground mb-1">管理员 ID (Admin ID)</label>
              <input 
                type="text" 
                value={localConfig.adminId}
                onChange={(e) => handleChange('adminId', e.target.value)}
                placeholder="例如: 12345678"
                className="w-full p-2 bg-background border rounded font-mono text-sm focus:ring-2 focus:ring-primary outline-none"
              />
            </div>
          </div>

          {/* 状态与操作区域 - 使用边框分隔 */}
          <div className="mt-4 grid grid-cols-1 xl:grid-cols-2 gap-4">
            {/* 左侧：机器人状态 */}
            <div className="p-3 bg-muted rounded-lg border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${localConfig.status === 'online' ? 'bg-green-500 animate-pulse' : 'bg-muted-foreground'}`}></div>
                  <span className="text-sm font-medium text-foreground">
                    状态: {localConfig.status === 'online' ? '已连接 (Online)' : '未连接 (Offline)'}
                  </span>
                </div>
                
                {localConfig.status === 'online' ? (
                  <button 
                    onClick={handleDisconnect}
                    className="flex items-center gap-2 text-destructive hover:text-destructive/80 text-xs font-bold border border-destructive/20 bg-background hover:bg-destructive/10 px-3 py-1.5 rounded transition-colors"
                  >
                    <Power size={12} /> 断开连接
                  </button>
                ) : (
                  <button 
                    onClick={handleVerifyConnection}
                    disabled={isVerifying}
                    className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold px-4 py-1.5 rounded transition-colors disabled:opacity-50"
                  >
                    {isVerifying ? <RefreshCw className="animate-spin" size={12}/> : <PlugZap size={12}/>}
                    {isVerifying ? '验证中...' : '验证并连接'}
                  </button>
                )}
              </div>
            </div>

            {/* 右侧：激活绑定 */}
            <div className="p-3 bg-muted rounded-lg border">
              <div className="flex items-center gap-2">
                <input 
                  type="text" 
                  value={localConfig.activationCode || ''}
                  onChange={(e) => handleChange('activationCode', e.target.value)}
                  placeholder="输入激活码绑定..."
                  className="flex-1 p-2 bg-background border rounded font-mono text-xs focus:ring-2 focus:ring-primary outline-none"
                />
                <button 
                  onClick={async () => {
                    if (!localConfig.activationCode?.trim()) {
                      showToast("error", "请输入激活码");
                      return;
                    }
                    // 调用后端绑定激活码
                    try {
                      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-bot`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          action: 'bind-shop-code',
                          botToken: botToken || localConfig.token,
                          activationCode: localConfig.activationCode.trim()
                        })
                      });
                      const data = await response.json();
                      if (data.ok) {
                        showToast("success", data.message || "激活码绑定成功");
                        // 更新本地状态
                        setLocalConfig(prev => ({
                          ...prev,
                          shopExpireAt: data.expireAt,
                          activationCode: ''
                        }));
                        onSave({ shopExpireAt: data.expireAt });
                      } else {
                        showToast("error", data.error || "绑定失败");
                      }
                    } catch (error) {
                      showToast("error", "绑定失败，请检查网络");
                    }
                  }}
                  className="flex items-center gap-1 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold px-3 py-2 rounded transition-colors"
                >
                  <Key size={12} /> 绑定
                </button>
              </div>
              {/* 状态提示 */}
              <div className="mt-2 text-xs">
                {localConfig.shopExpireAt ? (
                  new Date(localConfig.shopExpireAt) > new Date() ? (
                    <span className="text-green-600">
                      ✅ 有效期至: {new Date(localConfig.shopExpireAt).toLocaleDateString('zh-CN')}
                    </span>
                  ) : (
                    <span className="text-destructive">
                      ❌ 已过期 ({new Date(localConfig.shopExpireAt).toLocaleDateString('zh-CN')}) - 请输入激活码续期
                    </span>
                  )
                ) : localConfig.shopTrialStartedAt ? (
                  (() => {
                    const trialStart = new Date(localConfig.shopTrialStartedAt);
                    const trialEnd = new Date(trialStart.getTime() + 24 * 60 * 60 * 1000);
                    const now = new Date();
                    if (now > trialEnd) {
                      return <span className="text-destructive">❌ 试用已过期 - 请输入激活码激活</span>;
                    }
                    const hoursLeft = Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60));
                    return <span className="text-amber-600">⏳ 首次试用中 (剩余 {hoursLeft} 小时)</span>;
                  })()
                ) : (
                  <span className="text-muted-foreground">💡 首次使用可免费试用24小时</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 支付回调 Webhook - 暂时注释
        <div className="bg-card p-6 rounded-xl border shadow-sm">
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-foreground">
            <ExternalLink size={20} className="text-blue-600"/> 支付回调 Webhook
          </h3>
          <p className="text-sm text-muted-foreground mb-2">
            将以下 Webhook URL 配置到您的支付平台，用于接收支付成功通知并自动发货。
          </p>
          <p className="text-xs text-green-600 bg-green-500/10 p-2 rounded mb-4">
            ✅ <strong>USDT/TRX 链上监控已自动启用：</strong>系统已配置 pg_cron 定时任务，每分钟自动调用 TronGrid API 检测链上转账并完成发货。无需手动配置。
          </p>
          
          <div className="space-y-3">
            <div className="p-3 bg-muted rounded-lg border">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-medium text-foreground">USDT/TRX 链上支付</span>
                <button 
                  onClick={() => handleCopyWebhook('crypto')}
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                  {webhookCopied ? <Check size={12}/> : <Copy size={12}/>} 复制
                </button>
              </div>
              <code className="text-xs text-muted-foreground break-all block">
                {getWebhookUrl()}&type=crypto
              </code>
            </div>
            
            <div className="p-3 bg-muted rounded-lg border">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-medium text-foreground">YunGouOS 回调</span>
                <button 
                  onClick={() => handleCopyWebhook('yungou')}
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                  <Copy size={12}/> 复制
                </button>
              </div>
              <code className="text-xs text-muted-foreground break-all block">
                {getWebhookUrl()}&type=yungou
              </code>
            </div>
            
            <div className="p-3 bg-muted rounded-lg border">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-medium text-foreground">虎皮椒 (XunHuPay) 回调</span>
                <button 
                  onClick={() => handleCopyWebhook('xunhu')}
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                  <Copy size={12}/> 复制
                </button>
              </div>
              <code className="text-xs text-muted-foreground break-all block">
                {getWebhookUrl()}&type=xunhu
              </code>
            </div>
          </div>
        </div>
        */}

        {/* Telegram 购买命令 + 支付说明并排 */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Telegram 购买命令说明 */}
          <div className="bg-card p-6 rounded-xl border shadow-sm">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-foreground">
              <Bot size={20} className="text-purple-600"/> Telegram 购买命令
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              用户在 Telegram 中与您的机器人对话时，可以使用以下命令直接购买商品。您可以添加自定义中文指令别名（模糊匹配，只需匹配2个中文字符）：
            </p>
          
          <div className="space-y-4">
            {/* /shop 命令 */}
            <div className="p-3 bg-muted rounded-lg border">
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2">
                  <code className="text-sm font-bold text-primary">/shop</code>
                  <span className="text-xs text-muted-foreground">查看商品列表</span>
                </div>
                <button
                  onClick={() => {
                    const newCommands = { ...localConfig.customCommands };
                    newCommands.shop = [...(newCommands.shop || []), ''];
                    handleChange('customCommands', newCommands);
                  }}
                  className="text-xs text-primary hover:text-primary/80 flex items-center gap-1"
                >
                  <Plus size={12}/> 添加别名
                </button>
              </div>
              <p className="text-xs text-muted-foreground mb-2">显示所有上架商品及价格</p>
              {localConfig.customCommands?.shop?.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {localConfig.customCommands.shop.map((cmd, idx) => (
                    <div key={idx} className="flex items-center gap-1 bg-background px-2 py-1 rounded border">
                      <input
                        type="text"
                        value={cmd}
                        onChange={(e) => {
                          const newCommands = { ...localConfig.customCommands };
                          newCommands.shop[idx] = e.target.value;
                          handleChange('customCommands', newCommands);
                        }}
                        placeholder="例如: 商城"
                        className="w-16 text-xs bg-transparent outline-none"
                      />
                      <button
                        onClick={() => {
                          const newCommands = { ...localConfig.customCommands };
                          newCommands.shop = newCommands.shop.filter((_, i) => i !== idx);
                          handleChange('customCommands', newCommands);
                        }}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <X size={12}/>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {/* /buy 命令 */}
            <div className="p-3 bg-muted rounded-lg border">
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2">
                  <code className="text-sm font-bold text-primary">/buy &lt;商品名&gt;</code>
                  <span className="text-xs text-muted-foreground">购买商品</span>
                </div>
                <button
                  onClick={() => {
                    const newCommands = { ...localConfig.customCommands };
                    newCommands.buy = [...(newCommands.buy || []), ''];
                    handleChange('customCommands', newCommands);
                  }}
                  className="text-xs text-primary hover:text-primary/80 flex items-center gap-1"
                >
                  <Plus size={12}/> 添加别名
                </button>
              </div>
              <p className="text-xs text-muted-foreground mb-2">例如: <code>/buy VIP会员</code> 或 <code>购买 VIP会员</code></p>
              {localConfig.customCommands?.buy?.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {localConfig.customCommands.buy.map((cmd, idx) => (
                    <div key={idx} className="flex items-center gap-1 bg-background px-2 py-1 rounded border">
                      <input
                        type="text"
                        value={cmd}
                        onChange={(e) => {
                          const newCommands = { ...localConfig.customCommands };
                          newCommands.buy[idx] = e.target.value;
                          handleChange('customCommands', newCommands);
                        }}
                        placeholder="例如: 购买"
                        className="w-16 text-xs bg-transparent outline-none"
                      />
                      <button
                        onClick={() => {
                          const newCommands = { ...localConfig.customCommands };
                          newCommands.buy = newCommands.buy.filter((_, i) => i !== idx);
                          handleChange('customCommands', newCommands);
                        }}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <X size={12}/>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {/* /order 命令 */}
            <div className="p-3 bg-muted rounded-lg border">
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2">
                  <code className="text-sm font-bold text-primary">/order</code>
                  <span className="text-xs text-muted-foreground">查看我的订单</span>
                </div>
                <button
                  onClick={() => {
                    const newCommands = { ...localConfig.customCommands };
                    newCommands.order = [...(newCommands.order || []), ''];
                    handleChange('customCommands', newCommands);
                  }}
                  className="text-xs text-primary hover:text-primary/80 flex items-center gap-1"
                >
                  <Plus size={12}/> 添加别名
                </button>
              </div>
              <p className="text-xs text-muted-foreground mb-2">查看已付款订单，支持 <code>/order 订单号</code> 查询特定订单</p>
              {localConfig.customCommands?.order?.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {localConfig.customCommands.order.map((cmd, idx) => (
                    <div key={idx} className="flex items-center gap-1 bg-background px-2 py-1 rounded border">
                      <input
                        type="text"
                        value={cmd}
                        onChange={(e) => {
                          const newCommands = { ...localConfig.customCommands };
                          newCommands.order[idx] = e.target.value;
                          handleChange('customCommands', newCommands);
                        }}
                        placeholder="例如: 订单"
                        className="w-16 text-xs bg-transparent outline-none"
                      />
                      <button
                        onClick={() => {
                          const newCommands = { ...localConfig.customCommands };
                          newCommands.order = newCommands.order.filter((_, i) => i !== idx);
                          handleChange('customCommands', newCommands);
                        }}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <X size={12}/>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          
            <p className="text-xs text-green-600 bg-green-500/10 p-2 rounded mt-4">
              ✅ 这些命令已自动集成到您的 Telegram 机器人。自定义中文指令支持模糊匹配（匹配2个字符即可触发）。
            </p>
          </div>

          {/* 支付说明自定义 */}
          <div className="bg-card p-6 rounded-xl border shadow-sm">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-foreground">
              <CreditCard size={20} className="text-blue-600"/> 订单支付说明
            </h3>
            <p className="text-sm text-muted-foreground mb-3">
              自定义订单支付详情页面显示的提示信息（在"支付截止时间"下方显示）：
            </p>
            <textarea
              value={localConfig.paymentNotice || ''}
              onChange={(e) => handleChange('paymentNotice', e.target.value)}
              className="w-full p-3 bg-background border rounded font-mono text-sm min-h-[200px]"
              placeholder="请输入支付说明..."
            />
            <p className="text-xs text-muted-foreground mt-2">
              💡 支持 emoji 表情符号，修改后保存即可在 Telegram 订单支付详情中生效
            </p>
          </div>
        </div>

        {/* 虚拟货币设置 */}
        <div className="bg-card p-6 rounded-xl border shadow-sm">
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-foreground">
            <CreditCard size={20} className="text-green-600"/> 虚拟货币设置 (TRC20)
          </h3>
          
          <div className="space-y-5">
            {/* 钱包地址和API Key + USDT/TRX选项并排 */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              <div className="xl:col-span-2 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">USDT/TRX 收款地址</label>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={localConfig.walletAddress}
                      onChange={(e) => handleChange('walletAddress', e.target.value)}
                      className="flex-1 p-2 bg-background border rounded font-mono text-sm"
                    />
                    <button 
                      onClick={handleCopyAddress}
                      className="px-3 py-2 border rounded bg-muted hover:bg-muted/80 transition-colors"
                    >
                      {copied ? <Check size={16} className="text-green-500"/> : <Copy size={16}/>}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">TronGrid API Key【请看TG商城下面的配置说明】</label>
                  <input 
                    type="password" 
                    value={localConfig.tronGridKey}
                    onChange={(e) => handleChange('tronGridKey', e.target.value)}
                    className="w-full p-2 bg-background border rounded font-mono text-sm"
                  />
                </div>
              </div>

              {/* USDT/TRX 接收选项 */}
              <div className="space-y-3">
                <div 
                  className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                    localConfig.acceptUsdt ? 'bg-green-500/10 border-green-500' : 'bg-muted border-border'
                  }`} 
                  onClick={() => handleChange('acceptUsdt', !localConfig.acceptUsdt)}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Coins size={18} className={localConfig.acceptUsdt ? 'text-green-600' : 'text-muted-foreground'}/>
                    <span className="font-bold text-sm">接收 USDT</span>
                  </div>
                  <p className="text-xs text-muted-foreground">稳定币，推荐</p>
                </div>
                
                <div 
                  className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                    localConfig.acceptTrx ? 'bg-primary/10 border-primary' : 'bg-muted border-border'
                  }`} 
                  onClick={() => handleChange('acceptTrx', !localConfig.acceptTrx)}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Coins size={18} className={localConfig.acceptTrx ? 'text-primary' : 'text-muted-foreground'}/>
                    <span className="font-bold text-sm">接收 TRX</span>
                  </div>
                  <p className="text-xs text-muted-foreground">波场原生代币</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              <input 
                type="checkbox"
                checked={localConfig.randomDecimals}
                onChange={(e) => handleChange('randomDecimals', e.target.checked)}
                className="rounded"
              />
              <div>
                <div className="text-sm font-medium">随机小数防撞单</div>
                <div className="text-xs text-muted-foreground">自动在金额后添加随机小数，避免多用户同时付款时撞单</div>
              </div>
            </div>
          </div>
        </div>

        {/* 法币支付配置 */}
        <div className="bg-card p-6 rounded-xl border shadow-sm">
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-foreground">
            <Wallet size={20} className="text-purple-600"/> 法币支付设置 (CNY)
          </h3>
          
          <div className="space-y-6">
            {/* 虎皮椒微信和支付宝并排 */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {/* 虎皮椒 (XunHuPay) - 微信 */}
              <div className="p-4 bg-muted rounded-lg border">
                <h4 className="font-bold text-sm text-foreground mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span> 
                  虎皮椒 - 微信支付【推荐！注册申请门槛低！】
                </h4>
                <p className="text-xs text-muted-foreground mb-3">官网：www.xunhupay.com</p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">应用 App ID</label>
                    <input 
                      type="text" 
                      value={localConfig.xunhuId}
                      onChange={(e) => handleChange('xunhuId', e.target.value)}
                      className="w-full p-2 bg-background border rounded text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">密钥 App Secret</label>
                    <input 
                      type="password" 
                      value={localConfig.xunhuSecret}
                      onChange={(e) => handleChange('xunhuSecret', e.target.value)}
                      className="w-full p-2 bg-background border rounded text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* 虎皮椒 (XunHuPay) - 支付宝 */}
              <div className="p-4 bg-muted rounded-lg border">
                <h4 className="font-bold text-sm text-foreground mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 bg-blue-500 rounded-full"></span> 
                  虎皮椒 - 支付宝【推荐！注册申请门槛低！】
                </h4>
                <p className="text-xs text-muted-foreground mb-3">官网：www.xunhupay.com</p>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-2 bg-background rounded-lg border">
                    <input 
                      type="checkbox"
                      checked={localConfig.xunhuAlipayH5}
                      onChange={(e) => handleChange('xunhuAlipayH5', e.target.checked)}
                      className="rounded shrink-0"
                    />
                    <div>
                      <div className="text-xs font-medium">启用 H5 支付</div>
                      <div className="text-[10px] text-muted-foreground">营业执照注册的支付渠道可用</div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">应用 App ID</label>
                    <input 
                      type="text" 
                      value={localConfig.xunhuAlipayId}
                      onChange={(e) => handleChange('xunhuAlipayId', e.target.value)}
                      className="w-full p-2 bg-background border rounded text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">密钥 App Secret</label>
                    <input 
                      type="password" 
                      value={localConfig.xunhuAlipaySecret}
                      onChange={(e) => handleChange('xunhuAlipaySecret', e.target.value)}
                      className="w-full p-2 bg-background border rounded text-sm"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* YunGouOS 微信和支付宝并排 */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {/* YunGouOS - 微信 */}
              <div className="p-4 bg-muted rounded-lg border">
                <h4 className="font-bold text-sm text-foreground mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span> 
                  YunGouOS - 微信支付【不推荐！申请麻烦！有注册的联系我们修改接口】
                </h4>
                <p className="text-xs text-muted-foreground mb-3">官网：www.yungouos.com</p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">商户号 (Merchant ID)</label>
                    <input 
                      type="text" 
                      value={localConfig.yungouWechatId}
                      onChange={(e) => handleChange('yungouWechatId', e.target.value)}
                      className="w-full p-2 bg-background border rounded text-sm"
                      placeholder="例如: 1234567890"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">密钥 (Key)</label>
                    <input 
                      type="password" 
                      value={localConfig.yungouWechatKey}
                      onChange={(e) => handleChange('yungouWechatKey', e.target.value)}
                      className="w-full p-2 bg-background border rounded text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* YunGouOS - 支付宝 */}
              <div className="p-4 bg-muted rounded-lg border">
                <h4 className="font-bold text-sm text-foreground mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 bg-blue-500 rounded-full"></span> 
                  YunGouOS - 支付宝【不推荐！申请麻烦！有注册的联系我们修改接口】
                </h4>
                <p className="text-xs text-muted-foreground mb-3">官网：www.yungouos.com</p>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-2 bg-background rounded-lg border">
                    <input 
                      type="checkbox"
                      checked={localConfig.yungouAlipayH5}
                      onChange={(e) => handleChange('yungouAlipayH5', e.target.checked)}
                      className="rounded shrink-0"
                    />
                    <div>
                      <div className="text-xs font-medium">启用 H5 支付</div>
                      <div className="text-[10px] text-muted-foreground">营业执照注册的支付渠道可用</div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">商户号 (Merchant ID)</label>
                    <input 
                      type="text" 
                      value={localConfig.yungouAlipayId}
                      onChange={(e) => handleChange('yungouAlipayId', e.target.value)}
                      className="w-full p-2 bg-background border rounded text-sm"
                      placeholder="例如: 1234567890"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">密钥 (Key)</label>
                    <input 
                      type="password" 
                      value={localConfig.yungouAlipayKey}
                      onChange={(e) => handleChange('yungouAlipayKey', e.target.value)}
                      className="w-full p-2 bg-background border rounded text-sm"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 支付渠道开关 */}
            <div className="p-4 bg-muted rounded-lg border">
              <h4 className="font-bold text-sm text-foreground mb-3">启用支付渠道</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className={`p-3 rounded-lg border flex flex-col gap-2 ${
                  localConfig.enableAlipay ? 'bg-blue-500/10 border-blue-500' : 'bg-card border-border'
                }`}>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                      <div className="w-5 h-5 bg-blue-500 text-white rounded flex items-center justify-center text-[10px]">支</div> 支付宝
                    </div>
                    <button 
                      onClick={() => handleChange('enableAlipay', !localConfig.enableAlipay)}
                      className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        localConfig.enableAlipay ? 'bg-blue-600' : 'bg-muted'
                      }`}
                    >
                      <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        localConfig.enableAlipay ? 'translate-x-4' : 'translate-x-0'
                      }`} />
                    </button>
                  </div>
                  {localConfig.enableAlipay && (
                    <select 
                      value={localConfig.alipayProvider || 'xunhu'} 
                      onChange={(e) => handleChange('alipayProvider', e.target.value as 'yungou' | 'xunhu')}
                      className="w-full text-xs p-1 border rounded bg-background"
                    >
                      <option value="xunhu">使用 虎皮椒</option>
                      <option value="yungou">使用 YunGouOS</option>
                    </select>
                  )}
                </div>

                <div className={`p-3 rounded-lg border flex flex-col gap-2 ${
                  localConfig.enableWechat ? 'bg-green-500/10 border-green-500' : 'bg-card border-border'
                }`}>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                      <div className="w-5 h-5 bg-green-500 text-white rounded flex items-center justify-center text-[10px]">微</div> 微信
                    </div>
                    <button 
                      onClick={() => handleChange('enableWechat', !localConfig.enableWechat)}
                      className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        localConfig.enableWechat ? 'bg-green-600' : 'bg-muted'
                      }`}
                    >
                      <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        localConfig.enableWechat ? 'translate-x-4' : 'translate-x-0'
                      }`} />
                    </button>
                  </div>
                  {localConfig.enableWechat && (
                    <select 
                      value={localConfig.wechatProvider || 'xunhu'} 
                      onChange={(e) => handleChange('wechatProvider', e.target.value as 'yungou' | 'xunhu')}
                      className="w-full text-xs p-1 border rounded bg-background"
                    >
                      <option value="xunhu">使用 虎皮椒</option>
                      <option value="yungou">使用 YunGouOS</option>
                    </select>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>


        <button 
          onClick={handleSaveClick}
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-3 rounded-lg shadow-lg transition-all"
        >
          保存所有配置
        </button>
      </div>
    </div>
  );
}
