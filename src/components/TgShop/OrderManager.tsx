import React, { useState, useMemo } from "react";
import { Eye, Check, Download, RefreshCw, Trash2, Clock, XCircle, CheckCircle } from "lucide-react";
import { Order } from "./types";
import { useLanguage } from "@/hooks/use-language";
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

type OrderFilter = 'all' | 'paid' | 'pending' | 'cancelled';

interface OrderManagerProps {
  orders: Order[];
  onRefresh?: () => Promise<void>;
  onClearOrders?: (status: Order['status']) => Promise<void>;
  isLoading?: boolean;
}

export function OrderManager({ orders, onRefresh, onClearOrders, isLoading }: OrderManagerProps) {
  const { t, language } = useLanguage();
  const [activeFilter, setActiveFilter] = useState<OrderFilter>('all');
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [clearingStatus, setClearingStatus] = useState<Order['status'] | null>(null);

  const filteredOrders = useMemo(() => {
    if (activeFilter === 'all') return orders;
    return orders.filter(order => order.status === activeFilter);
  }, [orders, activeFilter]);

  const orderCounts = useMemo(() => ({
    all: orders.length,
    paid: orders.filter(o => o.status === 'paid').length,
    pending: orders.filter(o => o.status === 'pending').length,
    cancelled: orders.filter(o => o.status === 'cancelled').length,
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
      default: return status;
    }
  };

  const filterTabs: { key: OrderFilter; label: string; icon: React.ReactNode; showClear: boolean }[] = [
    { key: 'all', label: t('tgshop.order.all'), icon: null, showClear: false },
    { key: 'paid', label: t('tgshop.order.paid'), icon: <CheckCircle size={14} className="text-green-500" />, showClear: true },
    { key: 'pending', label: t('tgshop.order.pending'), icon: <Clock size={14} className="text-yellow-500" />, showClear: true },
    { key: 'cancelled', label: t('tgshop.order.cancelled'), icon: <XCircle size={14} className="text-muted-foreground" />, showClear: true },
  ];

  const handleExportCSV = () => {
    const headers = language === 'zh' 
      ? ['订单号', '商品', '用户', '金额', '货币', '状态', '时间']
      : ['Order No.', 'Product', 'User', 'Amount', 'Currency', 'Status', 'Time'];
    const rows = filteredOrders.map(order => [
      order.orderId,
      order.productName,
      order.customer,
      order.amount.toString(),
      order.currency,
      order.status,
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
              {tab.showClear && orderCounts[tab.key] > 0 && activeFilter === tab.key && onClearOrders && (
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
                    {activeFilter === 'all' 
                      ? t('tgshop.order.noOrders')
                      : (language === 'zh' ? `暂无${getStatusLabel(activeFilter as Order['status'])}订单` : `No ${getStatusLabel(activeFilter as Order['status']).toLowerCase()} orders`)}
                  </td>
                </tr>
              )}
              {filteredOrders.map(order => (
                <tr key={order.id} className="hover:bg-muted/50 transition-colors">
                  <td className="px-6 py-4 font-mono text-sm text-muted-foreground">{order.orderId}</td>
                  <td className="px-6 py-4 font-medium text-foreground">{order.productName}</td>
                  <td className="px-6 py-4 text-sm text-primary">{order.customer}</td>
                  <td className="px-6 py-4 text-sm font-bold text-green-600">{order.amount} {order.currency}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      order.status === 'paid' 
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                        : order.status === 'pending' 
                          ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' 
                          : 'bg-muted text-muted-foreground'
                    }`}>
                      {order.status === 'paid' ? <Check size={10}/> : order.status === 'pending' ? <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"/> : <XCircle size={10}/>}
                      {getStatusLabel(order.status)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-muted-foreground">
                    {order.createdAt ? new Date(order.createdAt).toLocaleString() : t('tgshop.order.justNow')}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="text-muted-foreground hover:text-primary">
                      <Eye size={18}/>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

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