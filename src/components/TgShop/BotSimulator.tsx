import React, { useState, useEffect, useRef } from "react";
import { Terminal, Zap, CreditCard } from "lucide-react";
import { Product, Order, ShopConfig } from "./types";

interface BotSimulatorProps {
  products: Product[];
  orders: Order[];
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  onAddOrder?: (order: Omit<Order, 'id'>, productId?: string, telegramUserId?: number, telegramUsername?: string) => Promise<Order | null>;
  onUpdateOrderStatus?: (orderId: string, status: Order['status']) => Promise<boolean>;
  config: ShopConfig;
  showToast: (type: "success" | "error" | "info", message: string) => void;
}

interface Message {
  id: string;
  text: string;
  isBot: boolean;
  buttons?: { text: string; onClick: () => void }[];
  image?: string;
}

function TgMessage({ text, isBot = false, buttons = [], image }: {
  text: string;
  isBot?: boolean;
  buttons?: { text: string; onClick: () => void }[];
  image?: string;
}) {
  return (
    <div className={`flex w-full mb-3 ${isBot ? 'justify-start' : 'justify-end'}`}>
      <div className={`max-w-[85%] rounded-lg p-3 text-sm whitespace-pre-wrap shadow-sm ${
        isBot ? 'bg-card text-card-foreground rounded-tl-none border' : 'bg-primary text-primary-foreground rounded-tr-none'
      }`}>
        {image && (
          <div className="mb-3 rounded-lg overflow-hidden border bg-card p-1">
            <img src={image} alt="QR Code" className="w-full h-auto block rounded" />
          </div>
        )}
        
        {text}
        
        {buttons.length > 0 && (
          <div className="mt-2 grid grid-cols-1 gap-1">
            {buttons.map((btn, idx) => (
              <button 
                key={idx} 
                onClick={btn.onClick} 
                className="bg-primary/10 hover:bg-primary/20 text-primary font-medium py-2 px-3 rounded text-center text-xs border border-primary/20 transition-colors w-full"
              >
                {btn.text}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function BotSimulator({ 
  products, 
  orders, 
  setOrders, 
  onAddOrder,
  onUpdateOrderStatus,
  config, 
  showToast 
}: BotSimulatorProps) {
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', text: '👋 欢迎使用模拟器！\n🔹 输入 /buy [关键词] 购买\n🔹 输入 /orders 查询订单', isBot: true }
  ]);
  const [input, setInput] = useState('');
  const msgEndRef = useRef<HTMLDivElement>(null);

  const generateId = () => Date.now().toString() + Math.random().toString(36).substring(2);

  useEffect(() => {
    msgEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const getCollisionProofAmount = (baseAmount: number) => {
    if (!config.randomDecimals) return baseAmount;
    const randomOffset = Math.floor(Math.random() * 5 + 1) / 100;
    return Number((baseAmount + randomOffset).toFixed(2));
  };

  const fetchTrxRate = async () => {
    try {
      const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=tron&vs_currencies=usd');
      const data = await res.json();
      const trxPriceInUsd = data.tron.usd;
      if (trxPriceInUsd) {
        const rate = 1 / trxPriceInUsd;
        return rate.toFixed(2);
      }
    } catch (e) {
      console.error("API Rate Limit or Error", e);
    }
    return "7.85";
  };

  const handleSimulatePayment = async (product: Product, orderId: string) => {
    setMessages(prev => [...prev, { id: generateId(), text: '🔄 模拟链上数据监测中...', isBot: true }]);

    // 更新订单状态
    if (onUpdateOrderStatus) {
      await onUpdateOrderStatus(orderId, 'paid');
    } else {
      setOrders(prev => prev.map(o => 
        o.orderId === orderId ? { ...o, status: 'paid' as const } : o
      ));
    }

    setTimeout(() => {
      const stockLine = product.stockContent ? product.stockContent.split('\n')[0] : '库存不足，请联系管理员补货';
      
      setMessages(prev => [...prev, { 
        id: generateId(), 
        text: `✅ **支付成功！**\n\n💰 已确认收到款项\n────────────────\n🎁 **您的卡密：**\n\`${stockLine}\`\n────────────────\n感谢您的惠顾！`, 
        isBot: true 
      }]);
    }, 1500);
  };

  const handleSend = async (textOverride?: string) => {
    const cmd = textOverride || input.trim();
    if (!cmd) return;
    
    setMessages(prev => [...prev, { id: generateId(), text: cmd, isBot: false }]);
    if (!textOverride) setInput('');

    setTimeout(async () => {
      let responseText = '';
      let buttons: { text: string; onClick: () => void }[] = [];
      let image: string | undefined;

      if (cmd.startsWith('/buy')) {
        const keyword = cmd.split(' ')[1]?.toLowerCase();
        if (!keyword) {
          responseText = '⚠️ 请输入关键词，例如: /buy nf';
        } else {
          const product = products.find(p => p.keywordsList?.includes(keyword));
          if (product) {
            responseText = `📦 **${product.name}**\n\n${product.description}\n\n💰 价格: ${product.price} ${product.currency}`;
            
            const payBtns: { text: string; onClick: () => void }[] = [];
            if (config.acceptUsdt) {
              payBtns.push({ 
                text: `💳 USDT 支付`, 
                onClick: () => handleSend(`payload_pay_usdt_${product.id}`)
              });
            }
            if (config.acceptTrx) {
              payBtns.push({ 
                text: `💎 TRX 支付`, 
                onClick: () => handleSend(`payload_pay_trx_${product.id}`)
              });
            }
            if (config.enableAlipay) {
              payBtns.push({ 
                text: `💙 支付宝 (Alipay)`, 
                onClick: () => handleSend(`payload_pay_alipay_${product.id}`)
              });
            }
            if (config.enableWechat) {
              payBtns.push({ 
                text: `💚 微信支付 (WeChat)`, 
                onClick: () => handleSend(`payload_pay_wechat_${product.id}`)
              });
            }
            
            if (payBtns.length === 0) {
              buttons = [{ text: '⚠️ 商家未配置支付方式', onClick: () => {} }];
            } else {
              buttons = payBtns;
            }
          } else {
            responseText = `🔍 未找到关键词为 "${keyword}" 的商品。`;
          }
        }
      } else if (cmd === '/orders' || cmd === '/myorders') {
        const userOrders = orders.filter(o => o.customer === 'SimulatorUser');
        if (userOrders.length === 0) {
          responseText = "📭 你还没有订单记录。";
        } else {
          let msg = "📂 **我的订单中心**\n\n";
          userOrders.forEach(order => {
            const statusIcon = order.status === 'paid' ? '✅' : '⏳';
            msg += `${statusIcon} \`${order.orderId}\` | ${order.productName} | ${order.amount} ${order.currency}\n`;
          });
          responseText = msg + "\n输入 /buy 继续购买";
        }
      } else if (cmd.startsWith('payload_pay_')) {
        const parts = cmd.split('_');
        const method = parts[2];
        const prodId = parts[3];
        const product = products.find(p => p.id === prodId);
        
        if (product) {
          const orderId = 'ORD' + Date.now().toString().slice(-6);
          let payAmount = product.price;
          let currency = 'CNY';
          let rateMsg = '';
          let isCrypto = false;

          if (method === 'usdt') {
            currency = 'USDT';
            isCrypto = true;
          } else if (method === 'trx') {
            setMessages(prev => [...prev, { id: generateId(), text: '🔄 正在获取实时汇率...', isBot: true }]);
            const rate = await fetchTrxRate();
            payAmount = Number((product.price * Number(rate)).toFixed(2));
            currency = 'TRX';
            isCrypto = true;
            rateMsg = `\n📊 实时汇率: 1 USDT ≈ ${rate} TRX`;
          } else {
            currency = 'CNY';
          }

          const finalAmount = isCrypto ? getCollisionProofAmount(payAmount) : payAmount;
          
          // 创建订单
          const newOrder: Omit<Order, 'id'> = {
            orderId,
            productName: product.name,
            amount: finalAmount,
            currency,
            status: 'pending',
            createdAt: new Date().toISOString(),
            customer: 'SimulatorUser'
          };

          if (onAddOrder) {
            await onAddOrder(newOrder, product.id, undefined, 'SimulatorUser');
          } else {
            setOrders(prev => [...prev, { ...newOrder, id: generateId() }]);
          }

          if (isCrypto) {
            // 加密货币支付 - 生成钱包地址二维码
            const qrData = config.walletAddress || 'TRC20_ADDRESS_NOT_CONFIGURED';
            image = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${qrData}`;
            responseText = `🧾 **订单已创建**\n订单号: \`${orderId}\`${rateMsg}\n\n请扫码支付准确金额 (防撞单):\n\n💎 **${finalAmount} ${currency}**\n\n收款地址 (TRC20):\n\`${config.walletAddress || '未配置'}\`\n\n⏳ 系统自动监控链上转账，支付后自动发货。`;
          } else {
            // 法币支付 - 调用真实支付API
            const provider = method === 'alipay' ? config.alipayProvider : config.wechatProvider;
            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
            const notifyUrl = `${supabaseUrl}/functions/v1/shop-payment-webhook?bot_token=${config.token}&type=${provider}`;
            
            try {
              setMessages(prev => [...prev, { id: generateId(), text: '🔄 正在创建支付订单...', isBot: true }]);
              
              const payRes = await fetch(`${supabaseUrl}/functions/v1/create-payment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  bot_token: config.token,
                  order_no: orderId,
                  product_name: product.name,
                  amount: finalAmount,
                  payment_method: method,
                  provider: provider,
                  notify_url: notifyUrl
                })
              });
              
              const payData = await payRes.json();
              
              if (payData.success && payData.qr_code) {
                image = payData.qr_code;
                responseText = `🧾 **${method === 'alipay' ? '支付宝' : '微信'}订单已创建**\n订单号: \`${orderId}\`\n通道: ${provider === 'yungou' ? 'YunGouOS' : 'XunHuPay'}\n\n请支付: **${finalAmount} CNY**\n\n⏳ 扫码支付后自动发货。`;
              } else {
                // 支付API失败，使用模拟
                image = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=PAYMENT_${orderId}`;
                responseText = `⚠️ 支付通道暂不可用\n错误: ${payData.error || '未知错误'}\n\n订单号: \`${orderId}\`\n金额: **${finalAmount} CNY**\n\n请联系管理员配置支付通道。`;
              }
            } catch (payError) {
              console.error('Payment API error:', payError);
              image = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=PAYMENT_${orderId}`;
              responseText = `⚠️ 网络错误，无法创建支付\n\n订单号: \`${orderId}\`\n金额: **${finalAmount} CNY**`;
            }
          }
          
          buttons = [{ text: '✅ 我已支付 (点击模拟回调)', onClick: () => handleSimulatePayment(product, orderId) }];
        }
      } else {
        responseText = '❓ 未知指令。尝试 /buy [关键词] 或 /orders';
      }

      if (responseText) {
        setMessages(prev => [...prev, { id: generateId(), text: responseText, isBot: true, buttons, image }]);
      }
    }, 100);
  };

  return (
    <div className="flex h-full flex-col max-w-4xl mx-auto p-6">
      <div className="bg-card rounded-xl shadow-lg border flex flex-col h-[600px] overflow-hidden">
        <div className="bg-foreground p-4 flex justify-between items-center">
          <div className="flex items-center gap-2 text-background">
            <Terminal size={20} />
            <span className="font-bold">Bot Logic Debugger</span>
          </div>
          <span className="text-xs bg-green-500 px-2 py-1 rounded text-white">Live Environment</span>
        </div>
        
        <div className="bg-primary/5 border-b p-3 text-xs text-foreground flex justify-between items-center">
          <div className="flex gap-4">
            <span className="font-bold flex items-center gap-1"><Zap size={12}/> 常用指令:</span>
            <code 
              className="bg-card px-1 rounded cursor-pointer hover:bg-primary/10 border" 
              onClick={() => handleSend('/buy nf')}
            >
              /buy [关键词]
            </code>
            <code 
              className="bg-card px-1 rounded cursor-pointer hover:bg-primary/10 border" 
              onClick={() => handleSend('/orders')}
            >
              /orders
            </code>
          </div>
          <div className="text-[10px] text-muted-foreground">模拟器</div>
        </div>

        <div className="flex-1 bg-muted/30 p-6 overflow-y-auto space-y-4">
          {messages.map(m => (
            <TgMessage key={m.id} text={m.text} isBot={m.isBot} buttons={m.buttons} image={m.image} />
          ))}
          <div ref={msgEndRef} />
        </div>
        
        <div className="p-4 bg-card border-t">
          <div className="flex gap-2">
            <input 
              type="text" 
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              placeholder="输入指令 (如 /buy nf)..."
              className="flex-1 border rounded-lg px-4 py-2 bg-background focus:ring-2 focus:ring-primary outline-none"
            />
            <button 
              onClick={() => handleSend()} 
              className="bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-2 rounded-lg font-medium transition-colors"
            >
              发送
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}