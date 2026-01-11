import React, { useState, useMemo } from "react";
import { Eye, Check, Download, RefreshCw, Trash2, Clock, XCircle, CheckCircle } from "lucide-react";
import { Order } from "./types";
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

  const filterTabs: { key: OrderFilter; label: string; icon: React.ReactNode; showClear: boolean }[] = [
    { key: 'all', label: '全部', icon: null, showClear: false },
    { key: 'paid', label: '已付款', icon: <CheckCircle size={14} className="text-green-500" />, showClear: true },
    { key: 'pending', label: '待付款', icon: <Clock size={14} className="text-yellow-500" />, showClear: true },
    { key: 'cancelled', label: '已过期', icon: <XCircle size={14} className="text-muted-foreground" />, showClear: true },
  ];

  const handleExportCSV = () => {
    const headers = ['订单号', '商品', '用户', '金额', '货币', '状态', '时间'];
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

  const getStatusLabel = (status: Order['status']) => {
    switch (status) {
      case 'paid': return '已付款';
      case 'pending': return '待付款';
      case 'cancelled': return '已过期';
      default: return status;
    }
  };

  return (
    <div className="p-8 h-full overflow-y-auto">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-foreground">订单记录</h2>
          <div className="flex gap-2">
            {onRefresh && (
              <button 
                onClick={onRefresh}
                disabled={isLoading}
                className="bg-card border px-4 py-2 rounded text-sm hover:bg-muted flex items-center gap-2 disabled:opacity-50"
              >
                <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} /> 刷新
              </button>
            )}
            <button 
              onClick={handleExportCSV}
              className="bg-card border px-4 py-2 rounded text-sm hover:bg-muted flex items-center gap-2"
            >
              <Download size={14} /> 导出 CSV
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
                  title={`清空${tab.label}订单`}
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
                <th className="px-6 py-4">订单号</th>
                <th className="px-6 py-4">商品</th>
                <th className="px-6 py-4">用户</th>
                <th className="px-6 py-4">金额</th>
                <th className="px-6 py-4">状态</th>
                <th className="px-6 py-4">时间</th>
                <th className="px-6 py-4 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredOrders.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-muted-foreground">
                    {activeFilter === 'all' 
                      ? '暂无订单数据，去模拟器生成一笔吧！' 
                      : `暂无${getStatusLabel(activeFilter as Order['status'])}订单`}
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
                      {order.status === 'paid' ? '已付款' : order.status === 'pending' ? '待付款' : '已过期'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-muted-foreground">
                    {order.createdAt ? new Date(order.createdAt).toLocaleString() : 'Just now'}
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
            <AlertDialogTitle>确认清空订单</AlertDialogTitle>
            <AlertDialogDescription>
              确定要清空所有{clearingStatus && getStatusLabel(clearingStatus)}订单吗？此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmClear} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              确认清空
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}