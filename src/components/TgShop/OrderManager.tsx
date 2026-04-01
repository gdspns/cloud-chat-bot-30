import React, { useState, useMemo } from "react";
import { Eye, Check, Download, RefreshCw, Trash2, Clock, XCircle, CheckCircle, Search, X, Copy, Truck, Package } from "lucide-react";
import { Order } from "./types";
import { useLanguage } from "@/hooks/use-language";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

type OrderFilter = 'all' | 'paid' | 'pending' | 'cancelled' | 'shipped';

interface OrderManagerProps {
  orders: Order[];
  onRefresh?: () => Promise<void>;
  onClearOrders?: (status: Order['status']) => Promise<void>;
  isLoading?: boolean;
  readOnly?: boolean;
}

export function OrderManager({ orders, onRefresh, onClearOrders, isLoading, readOnly }: OrderManagerProps) {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const [activeFilter, setActiveFilter] = useState<OrderFilter>('all');
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [clearingStatus, setClearingStatus] = useState<Order['status'] | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [shipDialogOpen, setShipDialogOpen] = useState(false);
  const [shipOrder, setShipOrder] = useState<Order | null>(null);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [isShipping, setIsShipping] = useState(false);

  const filteredOrders = useMemo(() => {
    let result = orders;
    if (activeFilter !== 'all') {
      result = result.filter(order => order.status === activeFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(order =>
        order.orderId.toLowerCase().includes(q) ||
        order.productName.toLowerCase().includes(q) ||
        order.customer.toLowerCase().includes(q) ||
        (order.deliveryContent && order.deliveryContent.toLowerCase().includes(q))
      );
    }
    return result;
  }, [orders, activeFilter, searchQuery]);

  const orderCounts = useMemo(() => ({
    all: orders.length,
    paid: orders.filter(o => o.status === 'paid').length,
    pending: orders.filter(o => o.status === 'pending').length,
    cancelled: orders.filter(o => o.status === 'cancelled').length,
    shipped: orders.filter(o => o.status === 'shipped').length,
  }), [orders]);

  const handleClearClick = (status: Order['status']) => {
    setClearingStatus(status);
    setClearDialogOpen(true);
  };

  const handleConfirmClear = async () => {
    if (clearingStatus && onClearOrders) {
      await onClearOrders(clearingStatus);
    }
    setClearDialogOpen(false);
    setClearingStatus(null);
  };

  const getStatusLabel = (status: Order['status']) => {
    switch (status) {
      case 'paid': return t('tgshop.order.paid');
      case 'pending': return t('tgshop.order.pending');
      case 'cancelled': return t('tgshop.order.cancelled');
      case 'shipped': return language === 'zh' ? '已发货' : 'Shipped';
      default: return status;
    }
  };

  const getPaymentMethodLabel = (method?: string) => {
    if (!method) return '-';
    const map: Record<string, string> = {
      balance: language === 'zh' ? '余额支付' : 'Balance',
      usdt: 'USDT',
      trx: 'TRX',
      alipay: language === 'zh' ? '支付宝' : 'Alipay',
      wechat: language === 'zh' ? '微信支付' : 'WeChat',
      pending: language === 'zh' ? '待选择' : 'Pending',
      cancelled: language === 'zh' ? '已取消' : 'Cancelled',
    };
    return map[method] || method;
  };

  const getOrderTypeLabel = (type?: string) => {
    if (!type) return '-';
    const map: Record<string, string> = {
      purchase: language === 'zh' ? '发卡商品' : 'Card/Key',
      physical: language === 'zh' ? '实物商品' : 'Physical',
      recharge: language === 'zh' ? '充值' : 'Recharge',
    };
    return map[type] || type;
  };

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const handleShipClick = (order: Order, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setShipOrder(order);
    setTrackingNumber('');
    setShipDialogOpen(true);
  };

  const handleConfirmShip = async () => {
    if (!shipOrder) return;
    setIsShipping(true);
    try {
      const { data, error } = await supabase.functions.invoke('ship-order', {
        body: {
          orderNo: shipOrder.orderId,
          trackingNumber: trackingNumber.trim() || undefined,
        },
      });

      if (error) throw error;

      toast({
        title: language === 'zh' ? '发货成功' : 'Shipped',
        description: language === 'zh' ? '已通知买家订单已发货' : 'Buyer has been notified',
      });

      setShipDialogOpen(false);
      setShipOrder(null);
      if (onRefresh) await onRefresh();
    } catch (err) {
      console.error('Ship error:', err);
      toast({
        title: language === 'zh' ? '发货失败' : 'Ship failed',
        description: String(err),
        variant: 'destructive',
      });
    } finally {
      setIsShipping(false);
    }
  };

  const filterTabs: { key: OrderFilter; label: string; icon: React.ReactNode; showClear: boolean }[] = [
    { key: 'all', label: t('tgshop.order.all'), icon: null, showClear: false },
    { key: 'paid', label: t('tgshop.order.paid'), icon: <CheckCircle size={14} className="text-green-500" />, showClear: true },
    { key: 'shipped', label: language === 'zh' ? '已发货' : 'Shipped', icon: <Truck size={14} className="text-blue-500" />, showClear: false },
    { key: 'pending', label: t('tgshop.order.pending'), icon: <Clock size={14} className="text-yellow-500" />, showClear: true },
    { key: 'cancelled', label: t('tgshop.order.cancelled'), icon: <XCircle size={14} className="text-muted-foreground" />, showClear: true },
  ];

  const handleExportCSV = () => {
    const headers = language === 'zh' 
      ? ['订单号', '商品', '用户', '金额', '货币', '状态', '支付方式', '发货内容', '时间']
      : ['Order No.', 'Product', 'User', 'Amount', 'Currency', 'Status', 'Payment', 'Delivery', 'Time'];
    const rows = filteredOrders.map(order => [
      order.orderId,
      order.productName,
      order.customer,
      order.amount.toString(),
      order.currency,
      order.status,
      order.paymentMethod || '',
      (order.deliveryContent || '').replace(/,/g, '，'),
      order.createdAt || ''
    ]);
    
    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `orders_${activeFilter}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getStatusStyle = (status: Order['status']) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'shipped':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getStatusIcon = (status: Order['status']) => {
    switch (status) {
      case 'paid': return <Check size={10}/>;
      case 'shipped': return <Truck size={10}/>;
      case 'pending': return <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"/>;
      default: return <XCircle size={10}/>;
    }
  };

  return (
    <div className="p-8 h-full overflow-y-auto">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-foreground">{t('tgshop.order.title')}</h2>
          <div className="flex gap-2">
            {onRefresh && (
              <button 
                onClick={onRefresh}
                disabled={isLoading}
                className="bg-card border px-4 py-2 rounded text-sm hover:bg-muted flex items-center gap-2 disabled:opacity-50"
              >
                <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} /> {t('tgshop.order.refresh')}
              </button>
            )}
            <button 
              onClick={handleExportCSV}
              className="bg-card border px-4 py-2 rounded text-sm hover:bg-muted flex items-center gap-2"
            >
              <Download size={14} /> {t('tgshop.order.exportCsv')}
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative mb-4">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={language === 'zh' ? '搜索订单号、商品名、用户名、发货内容...' : 'Search order no, product, user, delivery content...'}
            className="w-full pl-10 pr-10 py-2.5 rounded-lg border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X size={16} />
            </button>
          )}
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          {filterTabs.map(tab => (
            <div key={tab.key} className="flex items-center gap-1">
              <button
                onClick={() => setActiveFilter(tab.key)}
                className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${
                  activeFilter === tab.key
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-card border hover:bg-muted'
                }`}
              >
                {tab.icon}
                {tab.label}
                <span className={`ml-1 px-1.5 py-0.5 rounded-full text-xs ${
                  activeFilter === tab.key
                    ? 'bg-primary-foreground/20'
                    : 'bg-muted'
                }`}>
                  {orderCounts[tab.key]}
                </span>
              </button>
              {tab.showClear && orderCounts[tab.key] > 0 && activeFilter === tab.key && onClearOrders && !readOnly && (
                <button
                  onClick={() => handleClearClick(tab.key as Order['status'])}
                  className="p-2 rounded-lg text-destructive hover:bg-destructive/10 transition-colors"
                  title={language === 'zh' ? `清空${tab.label}订单` : `Clear ${tab.label} orders`}
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          ))}
          {searchQuery && (
            <span className="text-sm text-muted-foreground ml-2">
              {language === 'zh' ? `找到 ${filteredOrders.length} 条结果` : `${filteredOrders.length} results found`}
            </span>
          )}
        </div>
        
        <div className="bg-card rounded-xl shadow-sm border overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-muted border-b text-muted-foreground text-xs uppercase font-medium">
              <tr>
                <th className="px-6 py-4">{t('tgshop.order.orderNo')}</th>
                <th className="px-6 py-4">{t('tgshop.order.product')}</th>
                <th className="px-6 py-4">{t('tgshop.order.user')}</th>
                <th className="px-6 py-4">{t('tgshop.order.amount')}</th>
                <th className="px-6 py-4">{t('tgshop.order.status')}</th>
                <th className="px-6 py-4">{t('tgshop.order.time')}</th>
                <th className="px-6 py-4 text-right">{t('tgshop.order.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredOrders.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-muted-foreground">
                    {searchQuery
                      ? (language === 'zh' ? '未找到匹配的订单' : 'No matching orders found')
                      : activeFilter === 'all' 
                        ? t('tgshop.order.noOrders')
                        : (language === 'zh' ? `暂无${getStatusLabel(activeFilter as Order['status'])}订单` : `No ${getStatusLabel(activeFilter as Order['status']).toLowerCase()} orders`)}
                  </td>
                </tr>
              )}
              {filteredOrders.map(order => (
                <tr 
                  key={order.id} 
                  className="hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => setSelectedOrder(order)}
                >
                  <td className="px-6 py-4 font-mono text-sm text-muted-foreground">{order.orderId}</td>
                  <td className="px-6 py-4 font-medium text-foreground">
                    <div className="flex items-center gap-1.5">
                      {order.orderType === 'physical' && <Package size={14} className="text-blue-500 flex-shrink-0" />}
                      {order.productName}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-primary">{order.customer}</td>
                  <td className="px-6 py-4 text-sm font-bold text-green-600">{order.amount} {order.currency}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusStyle(order.status)}`}>
                      {getStatusIcon(order.status)}
                      {getStatusLabel(order.status)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-muted-foreground">
                    {order.createdAt ? new Date(order.createdAt).toLocaleString() : t('tgshop.order.justNow')}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {/* 实物商品已付款显示发货按钮 */}
                      {order.orderType === 'physical' && order.status === 'paid' && !readOnly && (
                        <button 
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-blue-500 text-white hover:bg-blue-600 transition-colors"
                          onClick={(e) => handleShipClick(order, e)}
                          title={language === 'zh' ? '发货' : 'Ship'}
                        >
                          <Truck size={12}/> {language === 'zh' ? '发货' : 'Ship'}
                        </button>
                      )}
                      <button 
                        className="text-muted-foreground hover:text-primary"
                        onClick={(e) => { e.stopPropagation(); setSelectedOrder(order); }}
                      >
                        <Eye size={18}/>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Order Detail Dialog */}
      <Dialog open={!!selectedOrder} onOpenChange={(open) => !open && setSelectedOrder(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{language === 'zh' ? '订单详情' : 'Order Details'}</DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">{language === 'zh' ? '订单号' : 'Order No.'}</span>
                  <div className="font-mono mt-1 flex items-center gap-1">
                    {selectedOrder.orderId}
                    <button onClick={() => copyText(selectedOrder.orderId)} className="text-muted-foreground hover:text-primary"><Copy size={12}/></button>
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">{language === 'zh' ? '状态' : 'Status'}</span>
                  <div className="mt-1">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusStyle(selectedOrder.status)}`}>
                      {getStatusLabel(selectedOrder.status)}
                    </span>
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">{language === 'zh' ? '商品名称' : 'Product'}</span>
                  <div className="font-medium mt-1">{selectedOrder.productName}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">{language === 'zh' ? '商品类型' : 'Type'}</span>
                  <div className="mt-1">{getOrderTypeLabel(selectedOrder.orderType)}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">{language === 'zh' ? '金额' : 'Amount'}</span>
                  <div className="font-bold text-green-600 mt-1">{selectedOrder.amount} {selectedOrder.currency}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">{language === 'zh' ? '支付方式' : 'Payment'}</span>
                  <div className="mt-1">{getPaymentMethodLabel(selectedOrder.paymentMethod)}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">{language === 'zh' ? '买家' : 'Buyer'}</span>
                  <div className="mt-1 text-primary">{selectedOrder.customer}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">{language === 'zh' ? '下单时间' : 'Time'}</span>
                  <div className="mt-1 text-xs">{selectedOrder.createdAt ? new Date(selectedOrder.createdAt).toLocaleString() : '-'}</div>
                </div>
              </div>

              {selectedOrder.txHash && (
                <div>
                  <span className="text-sm text-muted-foreground">{language === 'zh' ? '交易哈希' : 'Tx Hash'}</span>
                  <div className="mt-1 font-mono text-xs bg-muted p-2 rounded break-all flex items-start gap-1">
                    {selectedOrder.txHash}
                    <button onClick={() => copyText(selectedOrder.txHash!)} className="text-muted-foreground hover:text-primary flex-shrink-0 mt-0.5"><Copy size={12}/></button>
                  </div>
                </div>
              )}

              {selectedOrder.deliveryContent && (
                <div>
                  <span className="text-sm text-muted-foreground">
                    {selectedOrder.orderType === 'physical' 
                      ? (language === 'zh' ? '收货地址' : 'Shipping Address')
                      : (language === 'zh' ? '发货内容（卡密）' : 'Delivery Content (Card/Key)')}
                  </span>
                  <div className="mt-1 bg-muted p-3 rounded-lg border">
                    <pre className="font-mono text-sm whitespace-pre-wrap break-all">{selectedOrder.deliveryContent}</pre>
                    <button 
                      onClick={() => copyText(selectedOrder.deliveryContent!)}
                      className="mt-2 text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
                    >
                      <Copy size={12}/> {language === 'zh' ? '复制' : 'Copy'}
                    </button>
                  </div>
                </div>
              )}

              {!selectedOrder.deliveryContent && selectedOrder.status === 'paid' && (
                <div className="text-sm text-muted-foreground italic">
                  {selectedOrder.orderType === 'physical'
                    ? (language === 'zh' ? '等待买家提供收货地址...' : 'Waiting for buyer to provide shipping address...')
                    : (language === 'zh' ? '暂无发货内容' : 'No delivery content')}
                </div>
              )}

              {/* 发货按钮在详情弹窗中 */}
              {selectedOrder.orderType === 'physical' && selectedOrder.status === 'paid' && !readOnly && (
                <div className="pt-2 border-t">
                  <button
                    onClick={() => { setSelectedOrder(null); handleShipClick(selectedOrder); }}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-colors font-medium"
                  >
                    <Truck size={16}/> {language === 'zh' ? '确认发货并通知买家' : 'Ship & Notify Buyer'}
                  </button>
                </div>
              )}

              {selectedOrder.status === 'shipped' && (
                <div className="pt-2 border-t">
                  <div className="flex items-center gap-2 text-blue-600 text-sm font-medium">
                    <Truck size={16}/> {language === 'zh' ? '此订单已发货' : 'This order has been shipped'}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Ship Confirmation Dialog */}
      <Dialog open={shipDialogOpen} onOpenChange={(open) => { if (!open) { setShipDialogOpen(false); setShipOrder(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck size={20} className="text-blue-500" />
              {language === 'zh' ? '确认发货' : 'Confirm Shipment'}
            </DialogTitle>
          </DialogHeader>
          {shipOrder && (
            <div className="space-y-4">
              <div className="bg-muted rounded-lg p-3 text-sm space-y-1">
                <div><span className="text-muted-foreground">{language === 'zh' ? '订单号：' : 'Order: '}</span><span className="font-mono">{shipOrder.orderId}</span></div>
                <div><span className="text-muted-foreground">{language === 'zh' ? '商品：' : 'Product: '}</span><span className="font-medium">{shipOrder.productName}</span></div>
                <div><span className="text-muted-foreground">{language === 'zh' ? '买家：' : 'Buyer: '}</span><span className="text-primary">{shipOrder.customer}</span></div>
              </div>

              {shipOrder.deliveryContent && (
                <div>
                  <label className="text-sm text-muted-foreground">{language === 'zh' ? '收货地址' : 'Shipping Address'}</label>
                  <div className="mt-1 bg-muted p-2 rounded text-sm font-mono whitespace-pre-wrap">{shipOrder.deliveryContent}</div>
                </div>
              )}

              <div>
                <label className="text-sm font-medium">{language === 'zh' ? '快递单号（可选）' : 'Tracking Number (optional)'}</label>
                <input
                  type="text"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  placeholder={language === 'zh' ? '输入快递单号...' : 'Enter tracking number...'}
                  className="w-full mt-1 px-3 py-2 rounded-lg border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              <p className="text-xs text-muted-foreground">
                {language === 'zh' ? '确认后将通过 Telegram 机器人通知买家订单已发货' : 'Buyer will be notified via Telegram bot after confirmation'}
              </p>
            </div>
          )}
          <DialogFooter>
            <button
              onClick={() => { setShipDialogOpen(false); setShipOrder(null); }}
              className="px-4 py-2 rounded-lg border bg-card hover:bg-muted text-sm"
              disabled={isShipping}
            >
              {language === 'zh' ? '取消' : 'Cancel'}
            </button>
            <button
              onClick={handleConfirmShip}
              disabled={isShipping}
              className="px-4 py-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600 text-sm font-medium flex items-center gap-2 disabled:opacity-50"
            >
              {isShipping ? <RefreshCw size={14} className="animate-spin" /> : <Truck size={14} />}
              {language === 'zh' ? '确认发货' : 'Confirm Ship'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Clear Confirmation Dialog */}
      <AlertDialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('tgshop.order.confirmClear')}</AlertDialogTitle>
            <AlertDialogDescription>
              {language === 'zh' 
                ? `确定要清空所有${clearingStatus && getStatusLabel(clearingStatus)}订单吗？此操作不可撤销。`
                : `Clear all ${clearingStatus && getStatusLabel(clearingStatus).toLowerCase()} orders? This cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('tgshop.order.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmClear} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t('tgshop.order.confirmClearBtn')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
