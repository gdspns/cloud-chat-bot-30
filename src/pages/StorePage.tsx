import React, { useState, useEffect, useRef } from 'react';
import { 
  CreditCard, 
  Terminal, 
  CheckCircle, 
  Database, 
  X,
  Zap,
  Copy,
  Smartphone,
  AlertCircle,
  Clock,
  Search,
  History,
  User,
  Loader2
} from 'lucide-react';
import { Navbar } from "@/components/Navbar";
import { supabase } from "@/integrations/supabase/client";

// --- 全局工具函数 ---
interface Product {
  id: number;
  type: 'card' | 'auto';
  tags: string[];
  name: string;
  duration: number;
  price: number;
  usdt: number;
  trx: number;
  desc: string;
  codes: string[];
}

interface Order {
  orderNo: string;
  botId: string;
  contact: string;
  productName: string;
  amount: string;
  paymentMethod: string;
  code: string;
  type: string;
  time: string;
  status: 'pending' | 'paid' | 'expired';
}

interface Config {
  usdtAddress: string;
  tronGridApiKey: string;
  hupiGateway: string;
  enableUsdt: boolean;
  enableTrx: boolean;
  enableWechat: boolean;
  enableAlipay: boolean;
  enableAntiCollision: boolean;
  exchangeRateUsdtCny: number;
}

const getStockCount = (product: Product) => {
  if (!product) return 0;
  if (product.type === 'auto') return 9999; 
  return (product.codes || []).length;
};

const formatTimeDisplay = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

const copyToClipboard = (text: string, successMessage = "复制成功") => {
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).then(() => alert(successMessage)).catch(() => alert("复制失败，请手动复制"));
  } else {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-9999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy');
      alert(successMessage);
    } catch (err) {
      alert("复制失败，请手动复制");
    }
    document.body.removeChild(textArea);
  }
};

// --- 初始数据 ---
const CATEGORY_TAGS = [
  { id: 'chat', label: '双向聊天' },
  { id: 'keyboard', label: '菜单键盘' },
  { id: 'mall', label: 'TG商城' }
];

const DEFAULT_PRODUCTS: Product[] = [
  { id: 1, type: 'auto', tags: ['chat'], name: '1个月-自动订阅', duration: 30, price: 30, usdt: 5.000, trx: 40.000, desc: '支付后系统全自动激活，有效期30天', codes: [] },
  { id: 2, type: 'auto', tags: ['keyboard'], name: '3个月-自动订阅', duration: 90, price: 85, usdt: 14.000, trx: 110.000, desc: '季度优惠套餐，系统自动处理', codes: [] },
  { id: 5, type: 'card', tags: ['mall'], name: '1个月-独立激活码', duration: 30, price: 35, usdt: 6.000, trx: 45.000, desc: '购买后发放独立激活码，可转赠', codes: ['KEY-ADMIN-FIX-888', 'KEY-B2-999'] },
  { id: 8, type: 'card', tags: ['chat', 'mall'], name: '12个月-年费卡密', duration: 360, price: 320, usdt: 50.000, trx: 400.000, desc: '年度尊享授权，下单即刻发卡', codes: ['YEAR-KING-2026-PRO'] },
];

const DEFAULT_CONFIG: Config = {
  usdtAddress: '', 
  tronGridApiKey: '', 
  hupiGateway: 'https://api.xunhupay.com/payment/do.html',
  enableUsdt: true,
  enableTrx: true,
  enableWechat: true,
  enableAlipay: true,
  enableAntiCollision: false,
  exchangeRateUsdtCny: 7.40,
};

// --- 商城页面组件 ---
export const StorePage = () => {
  const [products, setProducts] = useState<Product[]>(() => {
    const saved = localStorage.getItem('app_products_v41');
    return saved ? JSON.parse(saved) : DEFAULT_PRODUCTS;
  });
  const [config] = useState<Config>(() => {
    const saved = localStorage.getItem('app_config_v41');
    return saved ? { ...DEFAULT_CONFIG, ...JSON.parse(saved) } : DEFAULT_CONFIG;
  });
  const [orders, setOrders] = useState<Order[]>(() => {
    const saved = localStorage.getItem('app_orders_v41');
    return saved ? JSON.parse(saved) : [];
  });

  const [activeTab, setActiveTab] = useState<'auto' | 'card'>('auto'); 
  const [activeTags, setActiveTags] = useState<string[]>([]); 
  const [botId, setBotId] = useState('');
  const [contactInfo, setContactInfo] = useState(''); 
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null); 
  const [paymentMethod, setPaymentMethod] = useState(''); 
  const [paymentStep, setPaymentStep] = useState<'selection' | 'paying' | 'success' | 'expired'>('selection'); 
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null); 
  const [realPayAmount, setRealPayAmount] = useState(0);
  const [validationError, setValidationError] = useState(''); 
  const [timeLeft, setTimeLeft] = useState(600); 
  const [showQueryModal, setShowQueryModal] = useState(false); 
  const [hupiPayUrl, setHupiPayUrl] = useState('');
  const [hupiQrCodeUrl, setHupiQrCodeUrl] = useState('');
  const [paymentLoading, setPaymentLoading] = useState(false);

  const paymentTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 监听 Storage 变化
  useEffect(() => {
    const handleStorageChange = () => {
      const savedProducts = localStorage.getItem('app_products_v41');
      if (savedProducts) setProducts(JSON.parse(savedProducts));
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  useEffect(() => { localStorage.setItem('app_orders_v41', JSON.stringify(orders)); }, [orders]);
  useEffect(() => { localStorage.setItem('app_products_v41', JSON.stringify(products)); }, [products]);

  // 筛选重置
  useEffect(() => {
    const filtered = products.filter(p => {
      const matchType = p.type === activeTab;
      const matchTags = activeTags.length === 0 || activeTags.every(tag => (p.tags || []).includes(tag));
      return matchType && matchTags;
    });

    if (selectedProductId && !filtered.find(p => p.id === selectedProductId)) {
      setSelectedProductId(null);
    }
  }, [activeTab, activeTags, products, selectedProductId]);

  // 倒计时
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (paymentStep === 'paying' && timeLeft > 0) {
      timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    } else if (timeLeft === 0 && paymentStep === 'paying') {
      setPaymentStep('expired');
      stopMonitoring();
      updateOrderStatus('expired'); 
    }
    return () => clearInterval(timer);
  }, [paymentStep, timeLeft]);

  // --- 逻辑函数 ---
  const stopMonitoring = () => {
    if (paymentTimerRef.current) {
      clearInterval(paymentTimerRef.current);
      paymentTimerRef.current = null;
    }
  };

  const generateHupijiaoUrl = async (method: string, amount: number, orderId: string) => {
    setPaymentLoading(true);
    setHupiQrCodeUrl('');
    setHupiPayUrl('');
    
    try {
      const { data, error } = await supabase.functions.invoke('create-payment-url', {
        body: {
          orderId,
          amount,
          paymentMethod: method,
        }
      });

      if (error) {
        console.error('获取支付链接失败:', error);
        setValidationError('获取支付链接失败，请稍后重试');
        return;
      }

      if (data?.success) {
        // 优先使用二维码图片URL
        if (data.qrCodeUrl) {
          setHupiQrCodeUrl(data.qrCodeUrl);
        }
        // 备用支付页面URL
        if (data.payUrl) {
          setHupiPayUrl(data.payUrl);
        }
        console.log('支付接口返回:', data);
      } else if (data?.error) {
        console.error('支付配置错误:', data.error);
        setValidationError(data.error);
      }
    } catch (err) {
      console.error('调用支付接口异常:', err);
      setValidationError('支付服务暂时不可用');
    } finally {
      setPaymentLoading(false);
    }
  };

  const handlePayment = () => {
    if (activeTab === 'card' && !contactInfo.trim()) {
      return setValidationError("请填写邮箱或手机号，以便后续查询订单卡密！");
    }
    if (!selectedProductId) return setValidationError("请先选择商品");
    if (!paymentMethod) return setValidationError("请选择支付方式");
    if (activeTab === 'auto' && !botId.trim()) {
      return setValidationError("请输入账号ID");
    }
    const product = products.find(p => Number(p.id) === Number(selectedProductId));
    if (!product) return;
    if (product.type === 'card' && getStockCount(product) <= 0) {
      return setValidationError("库存不足");
    }
    setValidationError(""); 

    let basePrice = paymentMethod === 'usdt' ? product.usdt : (paymentMethod === 'trx' ? product.trx : product.price);
    let finalAmount = basePrice;
    
    if (config.enableAntiCollision && (paymentMethod === 'usdt' || paymentMethod === 'trx')) {
      const offset = (Math.floor(Math.random() * 99) + 1) / 1000;
      finalAmount = Number((basePrice + offset).toFixed(3));
    }

    setRealPayAmount(finalAmount); 
    setTimeLeft(600); 
    setPaymentStep('paying');
    setHupiPayUrl(''); 
    
    const newOrder: Order = {
      orderNo: 'ORD' + Date.now(),
      botId: activeTab === 'auto' ? botId : '匿名',
      contact: contactInfo || '无', 
      productName: product.name,
      amount: `${finalAmount} ${paymentMethod.toUpperCase()}`,
      paymentMethod,
      code: '',
      type: product.type,
      time: new Date().toLocaleString(),
      status: 'pending'
    };
    
    setOrders(prev => [newOrder, ...prev]);
    setCurrentOrder(newOrder);

    if (paymentMethod === 'usdt' || paymentMethod === 'trx') {
      startCryptoMonitoring(paymentMethod.toUpperCase(), finalAmount);
    } else {
      generateHupijiaoUrl(paymentMethod, finalAmount, newOrder.orderNo);
    }
  };

  const handleClosePayment = () => {
    setPaymentStep('selection');
    stopMonitoring();
    if (currentOrder && currentOrder.status === 'pending') {
      updateOrderStatus('expired');
    }
  };

  const handleQueryOrder = () => {
    if (!contactInfo.trim()) {
      return setValidationError("请输入邮箱或手机号以查询订单！");
    }
    setValidationError("");
    setShowQueryModal(true);
  };

  const updateOrderStatus = (status: 'pending' | 'paid' | 'expired', code = '') => {
    if (!currentOrder) return;
    setOrders(prev => prev.map(o => {
      if (o.orderNo === currentOrder.orderNo) {
        return { ...o, status, code };
      }
      return o;
    }));
    setCurrentOrder(prev => prev ? { ...prev, status, code } : null);
  };

  const startCryptoMonitoring = (currency: string, amount: number) => {
    const startTime = Date.now();
    paymentTimerRef.current = setInterval(async () => {
      try {
        const headers: Record<string, string> = config.tronGridApiKey ? { 'TRON-PRO-API-KEY': config.tronGridApiKey } : {};
        let url = currency === 'USDT' 
          ? `https://api.trongrid.io/v1/accounts/${config.usdtAddress}/transactions/trc20?limit=20&only_confirmed=true`
          : `https://api.trongrid.io/v1/accounts/${config.usdtAddress}/transactions?limit=20&only_confirmed=true`;
        const res = await fetch(url, { headers });
        const data = await res.json();
        if (data?.data) {
          const match = data.data.find((tx: any) => {
            const txTime = tx.block_timestamp;
            if (txTime <= startTime) return false;
            let txAmount = currency === 'USDT' ? parseFloat(tx.value) / 1000000 : (tx.raw_data?.contract[0]?.parameter?.value?.amount / 1000000);
            return Math.abs(txAmount - amount) < 0.00001;
          });
          if (match) {
            stopMonitoring();
            completeOrder(match.txID || match.transaction_id);
          }
        }
      } catch (e) {}
    }, 5000);
  };

  const confirmHupijiaoPayment = async () => {
    if (!currentOrder) return;
    
    // 从数据库查询订单支付状态（通过虎皮椒回调自动更新）
    const { data: dbOrder, error } = await supabase
      .from('store_orders')
      .select('status, delivered_code')
      .eq('order_no', currentOrder.orderNo)
      .maybeSingle();
    
    if (error) {
      console.error('查询订单状态失败:', error);
      alert('查询订单状态失败，请稍后重试');
      return;
    }
    
    if (dbOrder?.status === 'paid') {
      // 订单已在后台确认支付，直接完成
      if (dbOrder.delivered_code) {
        updateOrderStatus('paid', dbOrder.delivered_code);
        setPaymentStep('success');
      } else {
        completeOrder(`HUPI-CALLBACK-` + Date.now());
      }
    } else {
      // 订单未确认支付
      alert('未检测到支付成功，请确保已完成支付后再试。如已支付请稍等片刻后重试。');
    }
  };

  const completeOrder = async (txId: string) => {
    const productIdx = products.findIndex(p => Number(p.id) === Number(selectedProductId));
    if (productIdx === -1) return;

    const product = products[productIdx];
    
    // 卡密类型商品 - 调用云函数从数据库原子获取卡密
    if (product.type === 'card' && currentOrder) {
      try {
        const { data, error } = await supabase.functions.invoke('deliver-card-key', {
          body: {
            orderNo: currentOrder.orderNo,
            productId: String(product.id)
          }
        });

        if (error || !data?.success) {
          // 数据库无卡密时回退到本地库存
          if (product.codes && product.codes.length > 0) {
            const localCode = product.codes[0];
            const updatedProducts = [...products];
            const newCodes = [...product.codes];
            newCodes.shift();
            updatedProducts[productIdx] = { ...product, codes: newCodes };
            setProducts(updatedProducts);
            updateOrderStatus('paid', localCode);
          } else {
            updateOrderStatus('paid', '卡密已售罄，请联系客服');
          }
        } else {
          // 成功从数据库获取卡密
          updateOrderStatus('paid', data.cardKey);
        }
      } catch (err) {
        console.error('获取卡密失败:', err);
        // 回退到本地
        if (product.codes && product.codes.length > 0) {
          const localCode = product.codes[0];
          const updatedProducts = [...products];
          const newCodes = [...product.codes];
          newCodes.shift();
          updatedProducts[productIdx] = { ...product, codes: newCodes };
          setProducts(updatedProducts);
          updateOrderStatus('paid', localCode);
        } else {
          updateOrderStatus('paid', '系统错误，请联系客服');
        }
      }
    } else {
      // 自动订阅类型
      updateOrderStatus('paid', 'AUTO_OK');
    }
    
    setPaymentStep('success');
  };

  const toggleUserTag = (tagId: string) => {
    setActiveTags(prev => 
      prev.includes(tagId) ? prev.filter(t => t !== tagId) : [...prev, tagId]
    );
  };

  const renderPaymentModal = () => {
    const product = products.find(p => Number(p.id) === Number(selectedProductId));
    if (!product) return null;

    const isCrypto = paymentMethod === 'usdt' || paymentMethod === 'trx';

    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in">
        <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden flex flex-col max-h-[90vh]">
          <div className="p-4 border-b flex justify-between items-center bg-gray-50/50">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-gray-800 text-sm">{paymentStep === 'success' ? '支付成功' : (paymentStep === 'expired' ? '已过期' : '确认支付')}</h3>
              {paymentStep === 'paying' && (<div className="flex items-center gap-1 text-red-500 bg-red-50 px-2 py-0.5 rounded-full text-xs font-bold border border-red-100"><Clock size={12} /> {formatTimeDisplay(timeLeft)}</div>)}
            </div>
            {paymentStep !== 'success' && (<button onClick={handleClosePayment} className="text-gray-400 hover:text-red-500"><X size={20} /></button>)}
          </div>
          <div className="p-6 text-center overflow-y-auto">
            {paymentStep === 'paying' && (
              <>
                <div className="flex flex-col items-center mb-4">
                  <div className="w-12 h-12 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin mb-3"></div>
                  <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">已连接支付网关...</p>
                </div>
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 space-y-4 shadow-inner">
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-[10px] text-blue-500 font-bold">请支付精确金额</span>
                    <div className="flex items-end justify-center gap-1">
                      <span className="text-3xl font-mono font-black text-blue-800">{realPayAmount}</span>
                      <span className="text-[10px] font-bold text-blue-400 mb-1 uppercase">{paymentMethod}</span>
                    </div>
                  </div>

                  {isCrypto && (
                    <div className="w-full bg-white/60 py-2 rounded-lg text-[9px] font-black text-blue-900 border border-blue-200 tracking-wide">
                      当前支付网络协议为 （TRX/TRC20）
                    </div>
                  )}

                  {/* 只有加密货币才显示二维码，法币支付跳转支付页面 */}
                  {isCrypto && (
                    <div className="flex justify-center bg-white p-2 rounded-xl border border-blue-100 shadow-sm mx-auto w-fit">
                      <img 
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(config.usdtAddress)}`}
                        alt="支付二维码"
                        className="w-[150px] h-[150px]"
                      />
                    </div>
                  )}

                  {isCrypto && (
                    <div className="flex items-center justify-center gap-2 bg-white/60 py-2 rounded-lg border border-blue-200">
                      <span className="text-[9px] font-mono text-gray-600 truncate max-w-[180px]">{config.usdtAddress}</span>
                      <button onClick={() => copyToClipboard(config.usdtAddress, '地址已复制')} className="text-blue-600 hover:text-blue-800">
                        <Copy size={12} />
                      </button>
                    </div>
                  )}
                  
                  {!isCrypto && (
                    <div className="text-center space-y-3">
                      {/* 加载状态 */}
                      {paymentLoading && (
                        <div className="flex flex-col items-center py-4">
                          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                          <p className="text-xs text-gray-500 mt-2">正在获取支付链接...</p>
                        </div>
                      )}
                      
                      {/* 支付二维码 */}
                      {!paymentLoading && (hupiQrCodeUrl || hupiPayUrl) && (
                        <div className="space-y-3">
                          {/* 直接显示二维码 */}
                          <div className="flex justify-center bg-white p-4 rounded-xl border border-gray-100 shadow-sm mx-auto w-fit">
                            <img 
                              src={hupiQrCodeUrl || `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(hupiPayUrl || '')}`}
                              alt="支付二维码"
                              className="w-[200px] h-[200px]"
                              onError={(e) => {
                                // 如果虎皮椒二维码加载失败，使用备用方案
                                if (hupiPayUrl && e.currentTarget.src !== `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(hupiPayUrl)}`) {
                                  e.currentTarget.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(hupiPayUrl)}`;
                                }
                              }}
                            />
                          </div>
                          <p className="text-sm text-gray-600 font-medium">
                            请使用{paymentMethod === 'wechat' ? '微信' : '支付宝'}扫码支付
                          </p>
                        </div>
                      )}
                      
                      <button 
                        onClick={confirmHupijiaoPayment}
                        className="w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded-xl font-bold text-sm shadow-md transition-all active:scale-95"
                      >
                        我已完成支付
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
            {paymentStep === 'success' && currentOrder && (
              <div className="animate-in zoom-in duration-300">
                <div className="w-16 h-16 bg-green-500 text-white rounded-full flex items-center justify-center mx-auto shadow-lg mb-4"><CheckCircle size={32} /></div>
                <h3 className="text-lg font-bold text-gray-900 mb-4">订单完成</h3>
                <div className="bg-gray-900 rounded-xl p-4 text-left text-white shadow-xl">
                  {currentOrder.type === 'card' ? (
                    <div className="bg-white/10 p-3 rounded-lg border border-white/10">
                      <div className="flex justify-between items-center mb-1">
                        <p className="text-[9px] text-gray-400 font-bold uppercase">卡密信息</p>
                        <button 
                          onClick={() => copyToClipboard(currentOrder.code, "复制成功")}
                          className="bg-green-600 hover:bg-green-500 text-white px-3 py-1 rounded text-[10px] font-bold flex items-center gap-1 transition-colors"
                        >
                          <Copy size={12} /> 复制
                        </button>
                      </div>
                      <p className="font-mono font-bold text-base text-green-400 break-all">{currentOrder.code}</p>
                    </div>
                  ) : (<p className="text-green-400 font-bold text-center py-2 text-sm">权益已发放</p>)}
                  <div className="mt-3 pt-3 border-t border-white/10 text-[9px] flex justify-between opacity-60 font-bold">
                    <span>单号: {currentOrder.orderNo}</span>
                    <span>{currentOrder.amount}</span>
                  </div>
                </div>
                <button onClick={() => {setPaymentStep('selection'); setBotId(''); setPaymentMethod('');}} className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold mt-6 text-sm">确定</button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderQueryModal = () => {
    const myOrders = orders.filter(o => o.contact === contactInfo);
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in">
        <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full flex flex-col max-h-[80vh]">
          <div className="p-4 border-b flex justify-between items-center">
            <h3 className="font-bold text-gray-900">订单查询</h3>
            <button onClick={() => setShowQueryModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
          </div>
          <div className="p-4 overflow-y-auto bg-gray-50 flex-1">
            <p className="text-xs text-gray-500 mb-4 px-1">查询账号: <span className="font-bold text-blue-600">{contactInfo}</span></p>
            {myOrders.length === 0 ? (
              <div className="py-12 text-center text-gray-400 flex flex-col items-center">
                <History size={32} className="mb-2 opacity-30" />
                <p className="text-xs">暂无记录</p>
              </div>
            ) : (
              <div className="space-y-3">
                {myOrders.map(order => (
                  <div key={order.orderNo} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                    <div className="flex justify-between items-start mb-2">
                      <div><p className="font-bold text-sm text-gray-800">{order.productName}</p><p className="text-[10px] text-gray-400">{order.time}</p></div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${order.status === 'paid' ? 'bg-green-100 text-green-700' : (order.status === 'expired' ? 'bg-gray-100 text-gray-500' : 'bg-yellow-100 text-yellow-700')}`}>{order.status === 'paid' ? '已成交' : (order.status === 'expired' ? '已过期' : '待付款')}</span>
                    </div>
                    {order.status === 'paid' && (
                      <div className="bg-gray-50 p-2 rounded-lg border border-gray-100 mt-2">
                        <p className="text-[9px] text-gray-400 font-bold uppercase mb-1">{order.type === 'auto' ? '自动授权 ID' : '卡密内容'}</p>
                        <div className="flex items-center justify-between">
                          <p className="font-mono text-sm text-gray-700 break-all select-all">{order.type === 'auto' ? order.botId : order.code}</p>
                          {order.type === 'card' && (
                            <button onClick={() => copyToClipboard(order.code, '卡密已复制')} className="text-blue-500 ml-2">
                              <Copy size={12} />
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const currentProduct = products.find(p => Number(p.id) === Number(selectedProductId));
  let displayPrice = '---';
  if (currentProduct) {
    if (paymentMethod === 'usdt') displayPrice = `${currentProduct.usdt.toFixed(3)} U`;
    else if (paymentMethod === 'trx') displayPrice = `${currentProduct.trx.toFixed(3)} T`;
    else if (paymentMethod === 'wechat' || paymentMethod === 'alipay') displayPrice = `¥${currentProduct.price}`;
    else displayPrice = '0.00';
  }
  
  const filteredProducts = products.filter(p => {
    const matchType = p.type === activeTab;
    const pTags = p.tags || [];
    const matchTags = activeTags.length === 0 || (
      pTags.length === activeTags.length && 
      activeTags.every(tag => pTags.includes(tag))
    );
    return matchType && matchTags;
  });

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      {paymentStep !== 'selection' && renderPaymentModal()}
      {showQueryModal && renderQueryModal()}
      {validationError && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-6 animate-in fade-in">
          <div className="bg-white rounded-2xl p-6 shadow-xl max-w-sm w-full text-center">
            <div className="w-12 h-12 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4"><AlertCircle size={24} /></div>
            <p className="text-sm text-gray-600 mb-6 font-bold">{validationError}</p>
            <button onClick={() => setValidationError("")} className="w-full bg-gray-900 text-white py-3 rounded-xl font-bold">确定</button>
          </div>
        </div>
      )}

      {/* 商城主内容 */}
      <div className="container mx-auto px-4 py-8">
        {/* 顶部切换 */}
        <div className="flex flex-col items-center gap-6 mb-8">
          <div className="flex items-center gap-4 font-black text-3xl tracking-tighter">
            <Terminal className="text-primary w-8 h-8" /> 自助商城
          </div>
          <div className="flex bg-muted p-2 rounded-2xl border gap-2">
            <button onClick={() => {setActiveTab('auto'); setValidationError(""); setActiveTags([]);}} className={`px-8 py-3 rounded-xl text-lg font-bold transition-all ${activeTab === 'auto' ? 'bg-background text-primary shadow-lg' : 'text-muted-foreground hover:text-foreground'}`}>自动充值</button>
            <button onClick={() => {setActiveTab('card'); setValidationError(""); setActiveTags([]);}} className={`px-8 py-3 rounded-xl text-lg font-bold transition-all ${activeTab === 'card' ? 'bg-background text-primary shadow-lg' : 'text-muted-foreground hover:text-foreground'}`}>购买卡密</button>
          </div>
          
          {/* 分类标签 */}
          <div className="flex justify-center gap-3">
            {CATEGORY_TAGS.map(tag => (
              <button key={tag.id} onClick={() => toggleUserTag(tag.id)} className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all border ${activeTags.includes(tag.id) ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground border-border hover:border-primary'}`}>{tag.label}</button>
            ))}
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          <div className="md:col-span-2 space-y-6">
            {/* 联系方式/账号ID */}
            {activeTab === 'card' && (
              <div className="bg-card p-6 rounded-2xl shadow-sm border">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="font-bold flex items-center gap-2 text-sm">
                    <span className="bg-primary text-primary-foreground w-5 h-5 rounded flex items-center justify-center text-[10px]">01</span> 
                    联系方式
                  </h2>
                  <button onClick={handleQueryOrder} className="text-xs text-primary font-bold hover:underline flex items-center gap-1"><Search size={12}/> 查询订单</button>
                </div>
                <div className="relative">
                  <input 
                    type="text" 
                    value={contactInfo} 
                    onChange={(e) => setContactInfo(e.target.value)} 
                    placeholder="请输入邮箱或手机号 (用于接收卡密)" 
                    className="w-full pl-10 pr-4 py-4 bg-muted border border-border rounded-xl outline-none font-bold text-sm focus:border-primary transition-all" 
                  />
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                </div>
              </div>
            )}

            {activeTab === 'auto' && (
              <div className="bg-card p-6 rounded-2xl shadow-sm border">
                <h2 className="font-bold mb-4 flex items-center gap-2 text-sm"><span className="bg-primary text-primary-foreground w-5 h-5 rounded flex items-center justify-center text-[10px]">01</span> 输入账号 ID</h2>
                <input type="text" value={botId} onChange={(e) => setBotId(e.target.value)} placeholder="请输入ID" className="w-full p-4 bg-muted border border-border rounded-xl outline-none font-bold text-base focus:border-primary transition-all" />
              </div>
            )}

            <div className="bg-card p-6 rounded-2xl shadow-sm border">
              <h2 className="font-bold mb-4 flex items-center gap-2 text-sm"><span className="bg-primary text-primary-foreground w-5 h-5 rounded flex items-center justify-center text-[10px]">02</span> 选择套餐</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {filteredProducts.length > 0 ? (
                  filteredProducts.map(p => {
                    const isSelected = Number(selectedProductId) === Number(p.id);
                    const stock = getStockCount(p);
                    const isSoldOut = stock <= 0;
                    return (
                      <div key={p.id} onClick={() => !isSoldOut && setSelectedProductId(p.id)} className={`relative cursor-pointer p-5 rounded-2xl border transition-all ${isSelected ? 'border-primary bg-primary/5 shadow-md ring-1 ring-primary' : 'border-border bg-background hover:border-primary/50'} ${isSoldOut ? 'opacity-40' : ''}`}>
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="font-bold text-sm leading-tight">{p.name}</h3>
                          {p.type === 'card' && (<span className={`text-[9px] font-bold px-2 py-0.5 rounded ${stock > 0 ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive'}`}>库存:{stock}</span>)}
                        </div>
                        <div className="flex gap-1 mb-2 flex-wrap">
                          {(p.tags || []).map(tid => {
                            const tagLabel = CATEGORY_TAGS.find(t => t.id === tid)?.label;
                            if(!tagLabel) return null;
                            return <span key={tid} className="text-[9px] px-2 py-1 bg-muted text-muted-foreground rounded font-bold border">{tagLabel}</span>
                          })}
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-xl font-black">¥{p.price}</span>
                          <div className="flex justify-between text-[9px] text-muted-foreground font-bold">
                            <span>{p.usdt.toFixed(3)} U</span>
                            <span>{p.trx.toFixed(3)} T</span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="col-span-2 text-center py-10 text-muted-foreground text-sm font-bold border-2 border-dashed border-border rounded-xl">暂无完全匹配的商品</div>
                )}
              </div>
            </div>
          </div>

          <div className="md:col-span-1">
            <div className="bg-card p-6 rounded-2xl shadow-lg border sticky top-20">
              <h2 className="font-bold mb-4 text-sm border-b pb-3">结算台</h2>
              <div className="bg-foreground rounded-xl p-4 mb-6 text-background shadow-lg text-center">
                <p className="text-[9px] text-muted uppercase font-bold tracking-widest mb-1">Total</p>
                <p className="text-2xl font-black font-mono tracking-tight">{paymentStep === 'paying' ? `${realPayAmount} ${paymentMethod.toUpperCase()}` : displayPrice}</p>
              </div>
              <div className="grid grid-cols-2 gap-2 mb-6">
                {config.enableUsdt && <button onClick={()=>setPaymentMethod('usdt')} className={`py-2 rounded-lg border font-bold text-[10px] transition-all ${paymentMethod==='usdt'?'border-primary bg-primary/10 text-primary':'border-border bg-muted text-muted-foreground'}`}>USDT</button>}
                {config.enableTrx && <button onClick={()=>setPaymentMethod('trx')} className={`py-2 rounded-lg border font-bold text-[10px] transition-all ${paymentMethod==='trx'?'border-destructive bg-destructive/10 text-destructive':'border-border bg-muted text-muted-foreground'}`}>TRX</button>}
                {config.enableWechat && <button onClick={()=>setPaymentMethod('wechat')} className={`py-2 rounded-lg border font-bold text-[10px] transition-all ${paymentMethod==='wechat'?'border-green-600 bg-green-50 text-green-600':'border-border bg-muted text-muted-foreground'}`}>微信</button>}
                {config.enableAlipay && <button onClick={()=>setPaymentMethod('alipay')} className={`py-2 rounded-lg border font-bold text-[10px] transition-all ${paymentMethod==='alipay'?'border-blue-500 bg-blue-50 text-blue-500':'border-border bg-muted text-muted-foreground'}`}>支付宝</button>}
              </div>
              <button onClick={handlePayment} className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-bold shadow-lg active:scale-95 transition-all">确认支付</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StorePage;
