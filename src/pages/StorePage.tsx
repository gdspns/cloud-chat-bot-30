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
import { useStoreProducts, StoreProduct } from "@/hooks/useStoreProducts";
import { useLanguage } from "@/hooks/use-language";
import { useBinanceRates } from "@/hooks/useBinanceRates";

// --- 全局工具函数 ---
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

const formatTimeDisplay = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

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
  const { t, language } = useLanguage();
  
  // 复制到剪贴板函数
  const copyToClipboard = (text: string, successMessage?: string) => {
    const msg = successMessage || t('store.copySuccess');
    const failMsg = t('store.copyFailed');
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(() => alert(msg)).catch(() => alert(failMsg));
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
        alert(msg);
      } catch (err) {
        alert(failMsg);
      }
      document.body.removeChild(textArea);
    }
  };

  // 分类标签 - 使用翻译
  const CATEGORY_TAGS = [
    { id: 'chat', label: t('store.chat') },
    { id: 'keyboard', label: t('store.keyboardMenu') },
    { id: 'mall', label: t('store.tgMall') }
  ];
  
  // 使用数据库 hook 加载商品
  const { products, loading: productsLoading, getStockCount, loadProducts } = useStoreProducts();

  // 使用币安实时汇率（每60秒刷新）
  const { rates, fetchRates } = useBinanceRates();
  
  // 自动刷新汇率
  useEffect(() => {
    fetchRates(); // 初始加载
    const interval = setInterval(fetchRates, 60000); // 60秒刷新
    return () => clearInterval(interval);
  }, [fetchRates]);

  // 根据CNY价格和实时汇率计算USDT/TRX价格
  const getUsdtPrice = (cnyPrice: number): number => {
    if (!rates) return 0;
    return cnyPrice / rates.usdtCny;
  };
  const getTrxPrice = (cnyPrice: number): number => {
    if (!rates) return 0;
    return cnyPrice / rates.usdtCny / rates.trxUsdt;
  };

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
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null); 
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
  const [isLoadingCardKey, setIsLoadingCardKey] = useState(false);
  const [cardKeyRetryCount, setCardKeyRetryCount] = useState(0);
  const [cardKeyRetryError, setCardKeyRetryError] = useState('');

  const paymentTimerRef = useRef<NodeJS.Timeout | null>(null);
  const orderPollingRef = useRef<NodeJS.Timeout | null>(null);
  const cardKeyPollingRef = useRef<NodeJS.Timeout | null>(null);

  // --- 安全防护：禁止 F12, Ctrl+Shift+I, 部分右键 ---
  useEffect(() => {
    // 处理右键菜单
    const handleContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // 允许在 INPUT 和 TEXTAREA 元素上使用右键（为了复制粘贴）
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }
      // 其他区域禁止右键
      e.preventDefault();
    };

    // 处理键盘快捷键
    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. 禁止 F12
      if (e.key === 'F12' || e.keyCode === 123) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      // 2. 禁止 Ctrl+Shift+I (不区分大小写)
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'i') {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
    };

    // 添加全局监听
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);

    // 组件卸载时移除监听
    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);
  
  // 停止订单轮询
  const stopOrderPolling = () => {
    if (orderPollingRef.current) {
      clearInterval(orderPollingRef.current);
      orderPollingRef.current = null;
    }
  };

  // 停止卡密轮询
  const stopCardKeyPolling = () => {
    if (cardKeyPollingRef.current) {
      clearInterval(cardKeyPollingRef.current);
      cardKeyPollingRef.current = null;
    }
  };

  // 直接调用 deliver-card-key 发货（单一入口）
  const deliverCardKey = async (orderNo: string, productId: string): Promise<string | null> => {
    console.log('[发货] 调用 deliver-card-key:', { orderNo, productId });
    try {
      const { data, error } = await supabase.functions.invoke('deliver-card-key', {
        body: { orderNo, productId }
      });

      if (error) {
        console.error('[发货] 云函数调用失败:', error);
        return null;
      }

      if (data?.success && data.cardKey) {
        console.log('[发货] 成功获取卡密:', data.cardKey.slice(0, 10) + '...');
        return data.cardKey;
      } else {
        console.error('[发货] 返回失败:', data?.error_message || data);
        return null;
      }
    } catch (err) {
      console.error('[发货] 异常:', err);
      return null;
    }
  };

  // 卡密发货机制 - 检测到 paid 后主动调用发货接口
  const startCardKeyDelivery = async (orderNo: string, productId: string) => {
    stopCardKeyPolling();
    setIsLoadingCardKey(true);
    setCardKeyRetryCount(0);
    setCardKeyRetryError('');
    
    const MAX_RETRIES = 3;
    const RETRY_INTERVAL = 2000; // 2秒
    let retryCount = 0;
    
    const tryDeliver = async (): Promise<boolean> => {
      retryCount++;
      setCardKeyRetryCount(retryCount);
      console.log(`[卡密发货] 第 ${retryCount} 次尝试, 订单号:`, orderNo);
      
      const cardKey = await deliverCardKey(orderNo, productId);
      
      if (cardKey) {
        stopCardKeyPolling();
        setIsLoadingCardKey(false);
        
        // 更新订单状态和卡密
        setOrders(prev => prev.map(o => 
          o.orderNo === orderNo ? { ...o, status: 'paid' as const, code: cardKey } : o
        ));
        setCurrentOrder(prev => prev && prev.orderNo === orderNo ? { ...prev, status: 'paid' as const, code: cardKey } : prev);
        
        // 刷新商品列表以更新库存
        loadProducts();
        return true;
      }
      
      return false;
    };
    
    // 第一次立即尝试
    if (await tryDeliver()) return;
    
    // 设置重试轮询
    cardKeyPollingRef.current = setInterval(async () => {
      if (retryCount >= MAX_RETRIES) {
        console.warn('[卡密发货] 超过最大重试次数:', orderNo);
        setIsLoadingCardKey(false);
        setCardKeyRetryError(t('store.deliveryFailed'));
        stopCardKeyPolling();
        return;
      }
      
      if (await tryDeliver()) {
        // 成功，已在 tryDeliver 中处理
      }
    }, RETRY_INTERVAL);
  };

  // 手动重试发货
  const retryCardKeyDelivery = (orderNo: string, productId?: string) => {
    const pid = productId || selectedProductId;
    if (!pid) {
      setCardKeyRetryError(t('store.cannotGetProduct'));
      return;
    }
    startCardKeyDelivery(orderNo, pid);
  };

  // 开始轮询订单状态（法币支付时使用）
  const startOrderPolling = (orderNo: string) => {
    stopOrderPolling();
    
    orderPollingRef.current = setInterval(async () => {
      try {
        const { data: dbOrder, error } = await supabase
          .from('store_orders')
          .select('status, delivered_code')
          .eq('order_no', orderNo)
          .maybeSingle();
        
        if (error) {
          console.error('轮询订单状态失败:', error);
          return;
        }
        
        if (dbOrder?.status === 'paid') {
          console.log('检测到订单已支付:', orderNo, 'delivered_code:', dbOrder.delivered_code);
          stopMonitoring();
          
          const product = products.find(p => p.id === selectedProductId);
          const isCardProduct = product?.type === 'card';

          // 1) 卡密商品：检查后端是否已发货
          if (isCardProduct && product?.id) {
            stopOrderPolling();
            if (dbOrder.delivered_code) {
              // 后端 cron 已发货，直接显示卡密
              console.log('[卡密] 后端已发货:', dbOrder.delivered_code);
              updateOrderStatus('paid', dbOrder.delivered_code);
              setPaymentStep('success');
              loadProducts();
            } else {
              // 后端未发货，前端主动发货
              updateOrderStatus('paid', '');
              setPaymentStep('success');
              startCardKeyDelivery(orderNo, product.id);
            }
            return;
          }

          // 2) 自动充值商品：检查 delivered_code 是否已写入
          if (dbOrder.delivered_code && !dbOrder.delivered_code.includes('激活失败')) {
            // 激活成功 - 停止轮询，显示结果
            console.log('[自动充值] 激活成功:', dbOrder.delivered_code);
            stopOrderPolling();
            setPaymentStep('success');
            // 同时更新 currentOrder 和 orders 确保UI显示
            setCurrentOrder(prev => prev && prev.orderNo === orderNo 
              ? { ...prev, status: 'paid' as const, code: dbOrder.delivered_code } 
              : prev
            );
            setOrders(prev => prev.map(o => 
              o.orderNo === orderNo ? { ...o, status: 'paid' as const, code: dbOrder.delivered_code } : o
            ));
            loadProducts();
          } else if (dbOrder.delivered_code && dbOrder.delivered_code.includes('激活失败')) {
            // 激活失败 - 停止轮询，显示失败原因
            console.error('[自动充值] 激活失败:', dbOrder.delivered_code);
            stopOrderPolling();
            setPaymentStep('success');
            setCurrentOrder(prev => prev && prev.orderNo === orderNo 
              ? { ...prev, status: 'paid' as const, code: dbOrder.delivered_code } 
              : prev
            );
          } else {
            // 还在处理中 - 先进入成功页但继续轮询
            setPaymentStep('success');
            if (!currentOrder?.code || currentOrder.code === 'AUTO_PROCESSING') {
              setCurrentOrder(prev => prev && prev.orderNo === orderNo 
                ? { ...prev, status: 'paid' as const, code: 'AUTO_PROCESSING' } 
                : prev
              );
            }
            // 继续轮询等待 delivered_code
          }
        }
      } catch (err) {
        console.error('轮询异常:', err);
      }
    }, 2000); // 每2秒轮询一次（加快轮询频率）
  };

  // 保存订单到 localStorage
  useEffect(() => { localStorage.setItem('app_orders_v41', JSON.stringify(orders)); }, [orders]);

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

  // 倒计时 - 只依赖 paymentStep，避免每次 timeLeft 变化都重建 interval
  useEffect(() => {
    if (paymentStep !== 'paying') return;
    const timer = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [paymentStep]);

  // 倒计时到期处理
  useEffect(() => {
    if (timeLeft === 0 && paymentStep === 'paying') {
      setPaymentStep('expired');
      stopMonitoring();
      stopOrderPolling();
      stopCardKeyPolling();
      updateOrderStatus('expired');
    }
  }, [timeLeft, paymentStep]);

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

  const handlePayment = async () => {
    if (activeTab === 'card' && !contactInfo.trim()) {
      return setValidationError(t('store.fillContactHint'));
    }
    if (!selectedProductId) return setValidationError(t('store.selectProductFirst'));
    if (!paymentMethod) return setValidationError(t('store.selectPaymentMethod'));
    if (activeTab === 'auto' && !botId.trim()) {
      return setValidationError(t('store.enterAccountId'));
    }
    const product = products.find(p => p.id === selectedProductId);
    if (!product) return;
    // 检查所有商品类型的库存（包括自动充值商品）
    if (getStockCount(product) <= 0) {
      return setValidationError(t('store.noStock'));
    }
    setValidationError("");

    let basePrice = paymentMethod === 'usdt' ? getUsdtPrice(product.price) : (paymentMethod === 'trx' ? getTrxPrice(product.price) : product.price);
    let finalAmount = Number(basePrice.toFixed(3));
    
    if (config.enableAntiCollision && (paymentMethod === 'usdt' || paymentMethod === 'trx')) {
      const offset = (Math.floor(Math.random() * 19) + 1) / 1000;
      finalAmount = Number((basePrice + offset).toFixed(3));
    }

    const orderNo = 'ORD' + Date.now();
    const currency = paymentMethod === 'usdt' ? 'USDT' : (paymentMethod === 'trx' ? 'TRX' : 'CNY');

    // 先将订单保存到数据库（供轮询和回调使用）
    const { error: dbError } = await supabase
      .from('store_orders')
      .insert({
        order_no: orderNo,
        product_id: String(product.id),
        product_name: product.name,
        amount: finalAmount,
        currency: currency,
        payment_method: paymentMethod,
        contact: contactInfo || null,
        bot_id: activeTab === 'auto' ? botId : null,
        status: 'pending'
      });

    if (dbError) {
      console.error('创建订单失败:', dbError);
      return setValidationError(t('store.createOrderFailed'));
    }

    setRealPayAmount(finalAmount); 
    setTimeLeft(600); 
    setPaymentStep('paying');
    setHupiPayUrl(''); 
    
    const newOrder: Order = {
      orderNo,
      botId: activeTab === 'auto' ? botId : t('store.anonymous'),
      contact: contactInfo || t('store.none'), 
      productName: product.name,
      amount: `${finalAmount} ${currency}`,
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
      // 加密货币也同时轮询数据库订单状态，确保回调被检测到
      startOrderPolling(orderNo);
    } else {
      generateHupijiaoUrl(paymentMethod, finalAmount, orderNo);
      // 法币支付开始轮询订单状态
      startOrderPolling(orderNo);
    }
  };

  const handleClosePayment = () => {
    setPaymentStep('selection');
    stopMonitoring();
    stopOrderPolling();
    if (currentOrder && currentOrder.status === 'pending') {
      updateOrderStatus('expired');
    }
  };

  const handleQueryOrder = () => {
    if (!contactInfo.trim()) {
      return setValidationError(t('store.queryOrderHint'));
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
            return Math.abs(txAmount - amount) < 0.01;
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
      alert(t('store.queryFailed'));
      return;
    }
    
    if (dbOrder?.status === 'paid') {
      // 订单已在后台确认支付
      const product = products.find(p => p.id === selectedProductId);
      const isCardProduct = product?.type === 'card';
      
      // 卡密商品 - 主动调用发货接口
      if (isCardProduct && product?.id) {
        // 先显示成功页面，同时开始发货
        updateOrderStatus('paid', '');
        setPaymentStep('success');
        startCardKeyDelivery(currentOrder.orderNo, product.id);
      } else {
        // 自动充值：支付已确认，检查激活结果
        setPaymentStep('success');
        if (dbOrder.delivered_code && !dbOrder.delivered_code.includes('激活失败')) {
          // 已激活成功 - 直接显示结果
          setCurrentOrder(prev => prev && prev.orderNo === currentOrder.orderNo 
            ? { ...prev, status: 'paid' as const, code: dbOrder.delivered_code } 
            : prev
          );
          setOrders(prev => prev.map(o => 
            o.orderNo === currentOrder.orderNo ? { ...o, status: 'paid' as const, code: dbOrder.delivered_code } : o
          ));
          loadProducts();
        } else if (dbOrder.delivered_code && dbOrder.delivered_code.includes('激活失败')) {
          // 激活失败 - 显示失败原因
          setCurrentOrder(prev => prev && prev.orderNo === currentOrder.orderNo 
            ? { ...prev, status: 'paid' as const, code: dbOrder.delivered_code } 
            : prev
          );
        } else {
          // 还在处理中 - 继续轮询
          setCurrentOrder(prev => prev && prev.orderNo === currentOrder.orderNo 
            ? { ...prev, status: 'paid' as const, code: 'AUTO_PROCESSING' } 
            : prev
          );
          startOrderPolling(currentOrder.orderNo);
        }
      }
    } else {
      // 订单未确认支付
      alert(t('store.paymentNotDetected'));
    }
  };

  const completeOrder = async (txId: string) => {
    const product = products.find(p => p.id === selectedProductId);
    if (!product || !currentOrder) return;

    // 卡密类型商品 - 调用云函数从数据库原子获取卡密
    if (product.type === 'card') {
      try {
        const { data, error } = await supabase.functions.invoke('deliver-card-key', {
          body: {
            orderNo: currentOrder.orderNo,
            productId: product.id
          }
        });

        if (error || !data?.success) {
          updateOrderStatus('paid', t('store.cardSoldOut'));
        } else {
          // 成功从数据库获取卡密
          updateOrderStatus('paid', data.cardKey);
          // 刷新商品列表以更新库存显示
          loadProducts();
        }
      } catch (err) {
        console.error('获取卡密失败:', err);
        updateOrderStatus('paid', t('store.systemError'));
      }
    } else {
      // 自动充值商品 - 加密货币支付需要手动更新数据库并触发自动激活
      updateOrderStatus('paid', 'AUTO_PROCESSING');
      
      try {
        // 1. 更新订单状态为 paid
        await supabase
          .from('store_orders')
          .update({
            status: 'paid',
            tx_hash: txId,
            updated_at: new Date().toISOString()
          })
          .eq('order_no', currentOrder.orderNo);

        console.log('[Crypto Auto] 订单已标记为 paid:', currentOrder.orderNo);

        // 2. 调用 store-auto-activate 触发自动激活
        const botToken = botId.trim();
        if (botToken && botToken.length >= 20) {
          // 确定功能类型
          const productTags = product.tags || [];
          let featureType = 'chat';
          if (productTags.includes('chat') && productTags.includes('keyboard') && productTags.includes('mall')) {
            featureType = 'all';
          } else if (productTags.includes('chat') && productTags.includes('mall')) {
            featureType = 'chat_shop';
          } else if (productTags.includes('keyboard') && productTags.includes('mall')) {
            featureType = 'keyboard_shop';
          } else if (productTags.includes('chat') && productTags.includes('keyboard')) {
            featureType = 'both';
          } else if (productTags.includes('keyboard')) {
            featureType = 'keyboard';
          } else if (productTags.includes('mall')) {
            featureType = 'shop';
          }

          console.log('[Crypto Auto] 调用自动激活:', { orderNo: currentOrder.orderNo, featureType, botToken: botToken.slice(-8) });

          const { data: activateResult, error: activateError } = await supabase.functions.invoke('store-auto-activate', {
            body: {
              orderNo: currentOrder.orderNo,
              botToken,
              featureType,
              validityDays: product.duration || 30,
              productId: product.id
            }
          });

          if (activateError) {
            console.error('[Crypto Auto] 激活调用失败:', activateError);
            updateOrderStatus('paid', `激活失败: ${activateError.message}`);
          } else if (activateResult?.success) {
            console.log('[Crypto Auto] 激活成功:', activateResult);
            const deliveredMsg = activateResult.message || `已激活: ${activateResult.activatedFeatures?.join(', ')}`;
            updateOrderStatus('paid', deliveredMsg);
            
            // 更新数据库 delivered_code
            await supabase
              .from('store_orders')
              .update({ delivered_code: deliveredMsg, updated_at: new Date().toISOString() })
              .eq('order_no', currentOrder.orderNo);
            
            loadProducts();
          } else {
            console.error('[Crypto Auto] 激活失败:', activateResult?.error);
            updateOrderStatus('paid', `激活失败: ${activateResult?.error || '未知错误'}`);
          }
        } else {
          console.error('[Crypto Auto] 缺少有效的 bot_token');
          updateOrderStatus('paid', '激活失败: 缺少机器人Token');
        }
      } catch (err) {
        console.error('[Crypto Auto] 处理异常:', err);
        updateOrderStatus('paid', '激活处理异常，请联系客服');
      }
    }
    
    setPaymentStep('success');
  };

  const toggleUserTag = (tagId: string) => {
    setActiveTags(prev => 
      prev.includes(tagId) ? prev.filter(t => t !== tagId) : [...prev, tagId]
    );
  };

  const renderPaymentModal = () => {
    const product = products.find(p => p.id === selectedProductId);
    if (!product) return null;

    const isCrypto = paymentMethod === 'usdt' || paymentMethod === 'trx';

    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in">
        <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden flex flex-col max-h-[90vh]">
          <div className="p-4 border-b flex justify-between items-center bg-gray-50/50">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-gray-800 text-sm">{paymentStep === 'success' ? t('store.paySuccess') : (paymentStep === 'expired' ? t('store.expired') : t('store.confirmPayment'))}</h3>
            {paymentStep === 'paying' && (<div className="flex items-center gap-1 text-red-500 bg-red-50 px-2 py-0.5 rounded-full text-xs font-bold border border-red-100"><Clock size={12} /> {formatTimeDisplay(timeLeft)}</div>)}
            </div>
            {paymentStep !== 'success' && (<button onClick={handleClosePayment} className="text-gray-400 hover:text-red-500"><X size={20} /></button>)}
          </div>
          <div className="p-6 text-center overflow-y-auto">
            {paymentStep === 'paying' && (
              <>
                <div className="flex flex-col items-center mb-4">
                  <div className="w-12 h-12 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin mb-3"></div>
                  <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">{t('store.connectedGateway')}</p>
                </div>
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 space-y-4 shadow-inner">
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-[10px] text-blue-500 font-bold">{t('store.payAmount')}</span>
                    <div className="flex items-end justify-center gap-1">
                      <span className="text-3xl font-mono font-black text-blue-800">{realPayAmount}</span>
                      <span className="text-[10px] font-bold text-blue-400 mb-1 uppercase">{paymentMethod}</span>
                    </div>
                  </div>

                  {isCrypto && (
                    <div className="w-full bg-white/60 py-2 rounded-lg text-[9px] font-black text-blue-900 border border-blue-200 tracking-wide">
                      {t('store.paymentNetwork')}
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
                      <button onClick={() => copyToClipboard(config.usdtAddress, t('store.addressCopied'))} className="text-blue-600 hover:text-blue-800">
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
                          <p className="text-xs text-gray-500 mt-2">{t('store.gettingPayLink')}</p>
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
                            {paymentMethod === 'wechat' ? t('store.wechatScan') : t('store.alipayScan')}
                          </p>
                          
                          {/* 支付宝 - 手机用户跳转按钮 */}
                          {paymentMethod === 'alipay' && hupiPayUrl && (
                            <a
                              href={hupiPayUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center justify-center gap-2 w-full bg-[#1677FF] hover:bg-[#0958d9] text-white py-2.5 rounded-xl font-bold text-sm shadow-md transition-all active:scale-95"
                            >
                              <Smartphone size={16} />
                              {t('store.openAlipay')}
                            </a>
                          )}
                        </div>
                      )}
                      
                      <button 
                        onClick={confirmHupijiaoPayment}
                        className="w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded-xl font-bold text-sm shadow-md transition-all active:scale-95"
                      >
                        {t('store.paidDone')}
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
            {paymentStep === 'success' && currentOrder && (
              <div className="animate-in zoom-in duration-300">
                <div className="w-16 h-16 bg-green-500 text-white rounded-full flex items-center justify-center mx-auto shadow-lg mb-4"><CheckCircle size={32} /></div>
                <h3 className="text-lg font-bold text-gray-900 mb-4">{t('store.orderComplete')}</h3>
                <div className="bg-gray-900 rounded-xl p-4 text-left text-white shadow-xl">
                  {currentOrder.type === 'card' ? (
                    <div className="bg-white/10 p-3 rounded-lg border border-white/10">
                      <div className="flex justify-between items-center mb-1">
                        <p className="text-[9px] text-gray-400 font-bold uppercase">{t('store.cardInfo')}</p>
                        {!isLoadingCardKey && currentOrder.code && !cardKeyRetryError && (
                          <button 
                            onClick={() => copyToClipboard(currentOrder.code, t('store.copySuccess'))}
                            className="bg-green-600 hover:bg-green-500 text-white px-3 py-1 rounded text-[10px] font-bold flex items-center gap-1 transition-colors"
                          >
                            <Copy size={12} /> {t('store.copy')}
                          </button>
                        )}
                      </div>
                      
                      {/* 卡密加载中状态 */}
                      {isLoadingCardKey && (
                        <div className="flex flex-col items-center justify-center py-4 space-y-3">
                          <Loader2 size={24} className="text-blue-400 animate-spin" />
                          <p className="text-blue-400 font-medium text-sm animate-pulse">
                            {t('store.loadingCardFromCloud')}
                          </p>
                          <p className="text-gray-500 text-xs">
                            {language === 'zh' ? `正在进行第 ${cardKeyRetryCount} 次尝试` : `Attempt ${cardKeyRetryCount}`}
                          </p>
                        </div>
                      )}
                      
                      {/* 卡密获取失败状态 */}
                      {!isLoadingCardKey && cardKeyRetryError && (
                        <div className="py-3">
                          <p className="text-yellow-400 font-medium text-sm">{cardKeyRetryError}</p>
                          {currentOrder?.orderNo && (
                            <button
                              onClick={() => retryCardKeyDelivery(currentOrder.orderNo, selectedProductId || undefined)}
                              className="mt-3 w-full bg-white/10 hover:bg-white/20 border border-white/10 text-white py-2 rounded-lg text-xs font-bold transition-all active:scale-95"
                            >
                              {t('store.manualRetry')}
                            </button>
                          )}
                        </div>
                      )}
                      
                      {/* 卡密成功显示 */}
                      {!isLoadingCardKey && !cardKeyRetryError && currentOrder.code && (
                        <p className="font-mono font-bold text-base text-green-400 break-all">{currentOrder.code}</p>
                      )}
                    </div>
                  ) : (
                    <div className="py-2 text-center">
                      {currentOrder.code && currentOrder.code !== 'AUTO_PROCESSING' ? (
                        <p className="text-green-400 font-bold text-sm break-words">{currentOrder.code}</p>
                      ) : (
                        <div className="flex flex-col items-center justify-center gap-2">
                          <Loader2 size={22} className="text-blue-400 animate-spin" />
                          <p className="text-gray-300 text-sm font-bold">{t('store.paidActivating')}</p>
                          <p className="text-gray-500 text-[10px]">{t('store.activatingHint')}</p>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="mt-3 pt-3 border-t border-white/10 text-[9px] flex justify-between opacity-60 font-bold">
                    <span>{t('store.orderNo')}: {currentOrder.orderNo}</span>
                    <span>{currentOrder.amount}</span>
                  </div>
                </div>
                <button onClick={() => {setPaymentStep('selection'); setBotId(''); setPaymentMethod(''); setIsLoadingCardKey(false); setCardKeyRetryError(''); stopCardKeyPolling();}} className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold mt-6 text-sm">{t('store.confirm')}</button>
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
            <h3 className="font-bold text-gray-900">{t('store.orderQueryTitle')}</h3>
            <button onClick={() => setShowQueryModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
          </div>
          <div className="p-4 overflow-y-auto bg-gray-50 flex-1">
            <p className="text-xs text-gray-500 mb-4 px-1">{t('store.queryAccount')}: <span className="font-bold text-blue-600">{contactInfo}</span></p>
            {myOrders.length === 0 ? (
              <div className="py-12 text-center text-gray-400 flex flex-col items-center">
                <History size={32} className="mb-2 opacity-30" />
                <p className="text-xs">{t('store.noRecords')}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {myOrders.map(order => (
                  <div key={order.orderNo} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                    <div className="flex justify-between items-start mb-2">
                      <div><p className="font-bold text-sm text-gray-800">{order.productName}</p><p className="text-[10px] text-gray-400">{order.time}</p></div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${order.status === 'paid' ? 'bg-green-100 text-green-700' : (order.status === 'expired' ? 'bg-gray-100 text-gray-500' : 'bg-yellow-100 text-yellow-700')}`}>{order.status === 'paid' ? t('store.transacted') : (order.status === 'expired' ? t('store.expired') : t('store.pending'))}</span>
                    </div>
                    {order.status === 'paid' && (
                      <div className="bg-gray-50 p-2 rounded-lg border border-gray-100 mt-2">
                        <p className="text-[9px] text-gray-400 font-bold uppercase mb-1">{order.type === 'auto' ? t('store.autoAuthId') : t('store.cardContent')}</p>
                        <div className="flex items-center justify-between">
                          <p className="font-mono text-sm text-gray-700 break-all select-all">{order.type === 'auto' ? order.botId : order.code}</p>
                          {order.type === 'card' && (
                            <button onClick={() => copyToClipboard(order.code, t('store.cardCopied'))} className="text-blue-500 ml-2">
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

  const currentProduct = products.find(p => p.id === selectedProductId);
  let displayPrice = '---';
  if (currentProduct) {
    const priceVal = Number(currentProduct.price) || 0;
    const usdtVal = getUsdtPrice(priceVal);
    const trxVal = getTrxPrice(priceVal);
    if (paymentMethod === 'usdt') displayPrice = `${usdtVal.toFixed(3)} U`;
    else if (paymentMethod === 'trx') displayPrice = `${trxVal.toFixed(3)} T`;
    else if (paymentMethod === 'wechat' || paymentMethod === 'alipay') displayPrice = `¥${priceVal.toFixed(2)}`;
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
            <button onClick={() => setValidationError("")} className="w-full bg-gray-900 text-white py-3 rounded-xl font-bold">{t('store.confirm')}</button>
          </div>
        </div>
      )}

      {/* 商城主内容 */}
      <div className="container mx-auto px-4 py-8">
        {/* 顶部切换 */}
        <div className="flex flex-col items-center gap-6 mb-8">
          {/* <div className="flex items-center gap-4 font-black text-3xl tracking-tighter">
            <Terminal className="text-primary w-8 h-8" /> 自助商城
          </div> */}
          <div className="flex bg-muted p-2 rounded-2xl border gap-2">
            <button onClick={() => {setActiveTab('auto'); setValidationError(""); setActiveTags([]);}} className={`px-8 py-3 rounded-xl text-lg font-bold transition-all ${activeTab === 'auto' ? 'bg-background text-primary shadow-lg' : 'text-muted-foreground hover:text-foreground'}`}>{t('store.auto')}</button>
            <button onClick={() => {setActiveTab('card'); setValidationError(""); setActiveTags([]);}} className={`px-8 py-3 rounded-xl text-lg font-bold transition-all ${activeTab === 'card' ? 'bg-background text-primary shadow-lg' : 'text-muted-foreground hover:text-foreground'}`}>{t('store.card')}</button>
          </div>
          
          {/* 分类标签 */}
          <div className="flex justify-center gap-3">
            {CATEGORY_TAGS.map(tag => (
              <button key={tag.id} onClick={() => toggleUserTag(tag.id)} className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all border ${activeTags.includes(tag.id) ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground border-border hover:border-primary'}`}>{tag.label}</button>
            ))}
          </div>
          {rates && (
            <p className="text-center text-[10px] text-muted-foreground mt-2">
              {language === 'zh' ? '币安实时汇率' : 'Binance Live'}: 1 USDT ≈ ¥{rates.usdtCny.toFixed(2)} | 1 TRX ≈ ${rates.trxUsdt.toFixed(4)} ({language === 'zh' ? '每60秒刷新' : 'refreshes every 60s'})
            </p>
          )}
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          <div className="md:col-span-2 space-y-6">
            {/* 联系方式/账号ID */}
            {activeTab === 'card' && (
              <div className="bg-card p-6 rounded-2xl shadow-sm border">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="font-bold flex items-center gap-2 text-sm">
                    <span className="bg-primary text-primary-foreground w-5 h-5 rounded flex items-center justify-center text-[10px]">01</span> 
                    {t('store.contactInfo')}
                  </h2>
                  <button onClick={handleQueryOrder} className="text-xs text-primary font-bold hover:underline flex items-center gap-1"><Search size={12}/> {t('store.orderQuery')}</button>
                </div>
                <div className="relative">
                  <input 
                    type="text" 
                    value={contactInfo} 
                    onChange={(e) => setContactInfo(e.target.value)} 
                    placeholder={t('store.contactPlaceholder')} 
                    className="w-full pl-10 pr-4 py-4 bg-muted border border-border rounded-xl outline-none font-bold text-sm focus:border-primary transition-all"
                  />
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                </div>
              </div>
            )}

            {activeTab === 'auto' && (
              <div className="bg-card p-6 rounded-2xl shadow-sm border">
                <h2 className="font-bold mb-4 flex items-center gap-2 text-sm"><span className="bg-primary text-primary-foreground w-5 h-5 rounded flex items-center justify-center text-[10px]">01</span> {t('store.botIdTitle')}</h2>
                <input type="text" value={botId} onChange={(e) => setBotId(e.target.value)} placeholder={t('store.botIdPlaceholder')} className="w-full p-4 bg-muted border border-border rounded-xl outline-none font-bold text-base focus:border-primary transition-all" />
              </div>
            )}

            <div className="bg-card p-6 rounded-2xl shadow-sm border">
              <h2 className="font-bold mb-4 flex items-center gap-2 text-sm"><span className="bg-primary text-primary-foreground w-5 h-5 rounded flex items-center justify-center text-[10px]">02</span> {t('store.selectPlan')}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {filteredProducts.length > 0 ? (
                  filteredProducts.map(p => {
                    const isSelected = selectedProductId === p.id;
                    const stock = getStockCount(p);
                    const isSoldOut = stock <= 0;
                    const productName = language === 'en' && p.nameEn ? p.nameEn : p.name;
                    return (
                      <div key={p.id} onClick={() => !isSoldOut && setSelectedProductId(p.id)} className={`relative cursor-pointer p-5 rounded-2xl border transition-all ${isSelected ? 'border-primary bg-primary/5 shadow-md ring-1 ring-primary' : 'border-border bg-background hover:border-primary/50'} ${isSoldOut ? 'opacity-40 cursor-not-allowed' : ''}`}>
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="font-bold text-sm leading-tight">{productName}</h3>
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${stock > 0 ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive'}`}>{t('store.stockLabel')}:{stock}</span>
                        </div>
                        <div className="flex gap-1 mb-2 flex-wrap">
                          {(p.tags || []).map(tid => {
                            const tagLabel = CATEGORY_TAGS.find(t => t.id === tid)?.label;
                            if(!tagLabel) return null;
                            return <span key={tid} className="text-[9px] px-2 py-1 bg-muted text-muted-foreground rounded font-bold border">{tagLabel}</span>
                          })}
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-xl font-black">¥{(Number(p.price) || 0).toFixed(2)}</span>
                          <div className="flex justify-between text-[9px] text-muted-foreground font-bold">
                            <span>{getUsdtPrice(Number(p.price) || 0).toFixed(3)} U</span>
                            <span>{getTrxPrice(Number(p.price) || 0).toFixed(3)} T</span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="col-span-2 text-center py-10 text-muted-foreground text-sm font-bold border-2 border-dashed border-border rounded-xl">{t('store.noMatchProducts')}</div>
                )}
              </div>
            </div>
          </div>

          <div className="md:col-span-1">
            <div className="bg-card p-6 rounded-2xl shadow-lg border sticky top-20">
              <h2 className="font-bold mb-4 text-sm border-b pb-3">{t('store.checkout')}</h2>
              <div className="bg-foreground rounded-xl p-4 mb-6 text-background shadow-lg text-center">
                <p className="text-[9px] text-muted uppercase font-bold tracking-widest mb-1">{t('store.total')}</p>
                <p className="text-2xl font-black font-mono tracking-tight">{paymentStep === 'paying' ? `${realPayAmount} ${paymentMethod.toUpperCase()}` : displayPrice}</p>
              </div>
              <div className="grid grid-cols-2 gap-2 mb-6">
                {config.enableUsdt && <button onClick={()=>setPaymentMethod('usdt')} className={`py-2 rounded-lg border font-bold text-[10px] transition-all ${paymentMethod==='usdt'?'border-primary bg-primary/10 text-primary':'border-border bg-muted text-muted-foreground'}`}>USDT</button>}
                {config.enableTrx && <button onClick={()=>setPaymentMethod('trx')} className={`py-2 rounded-lg border font-bold text-[10px] transition-all ${paymentMethod==='trx'?'border-destructive bg-destructive/10 text-destructive':'border-border bg-muted text-muted-foreground'}`}>TRX</button>}
                {config.enableWechat && <button onClick={()=>setPaymentMethod('wechat')} className={`py-2 rounded-lg border font-bold text-[10px] transition-all ${paymentMethod==='wechat'?'border-green-600 bg-green-50 text-green-600':'border-border bg-muted text-muted-foreground'}`}>{t('store.wechatPay')}</button>}
                {config.enableAlipay && <button onClick={()=>setPaymentMethod('alipay')} className={`py-2 rounded-lg border font-bold text-[10px] transition-all ${paymentMethod==='alipay'?'border-blue-500 bg-blue-50 text-blue-500':'border-border bg-muted text-muted-foreground'}`}>{t('store.alipayPay')}</button>}
              </div>
              <button onClick={handlePayment} className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-bold shadow-lg active:scale-95 transition-all">{t('store.payNow')}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StorePage;
