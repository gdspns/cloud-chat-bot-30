import React from "react";
import { Eye, Check, Download } from "lucide-react";
import { Order } from "./types";

interface OrderManagerProps {
  orders: Order[];
}

export function OrderManager({ orders }: OrderManagerProps) {
  const handleExportCSV = () => {
    const headers = ['订单号', '商品', '用户', '金额', '货币', '状态', '时间'];
    const rows = orders.map(order => [
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
    a.download = `orders_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-8 h-full overflow-y-auto">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-foreground">订单记录</h2>
          <div className="flex gap-2">
            <button 
              onClick={handleExportCSV}
              className="bg-card border px-4 py-2 rounded text-sm hover:bg-muted flex items-center gap-2"
            >
              <Download size={14} /> 导出 CSV
            </button>
          </div>
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
              {orders.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-muted-foreground">
                    暂无订单数据，去模拟器生成一笔吧！
                  </td>
                </tr>
              )}
              {orders.map(order => (
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
                      {order.status === 'paid' ? <Check size={10}/> : <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"/>}
                      {order.status.toUpperCase()}
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
    </div>
  );
}
