import React, { useState, useEffect, useCallback } from 'react';
import { ClipboardList, Search, Loader2, Copy } from 'lucide-react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/hooks/use-language";

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

const copyToClipboard = (text: string, successMessage: string) => {
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).then(() => alert(successMessage)).catch(() => alert("Copy failed"));
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
      alert("Copy failed");
    }
    document.body.removeChild(textArea);
  }
};

export const OrderCenter = () => {
  const { toast } = useToast();
  const { t } = useLanguage();
  const [orderFilter, setOrderFilter] = useState('all');
  const [orders, setOrders] = useState<Order[]>(() => {
    const saved = localStorage.getItem('app_orders_v41');
    return saved ? JSON.parse(saved) : [];
  });
  
  // 查单功能
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Order[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // 保存订单到 localStorage
  useEffect(() => { localStorage.setItem('app_orders_v41', JSON.stringify(orders)); }, [orders]);

  // Search orders from database
  const handleSearchOrders = useCallback(async () => {
    if (!searchQuery.trim()) {
      toast({ title: t('common.tips'), description: t('orderCenter.enterContact'), variant: "destructive" });
      return;
    }
    
    setIsSearching(true);
    setHasSearched(true);
    
    try {
      const { data, error } = await supabase
        .from('store_orders')
        .select('*')
        .or(`contact.ilike.%${searchQuery.trim()}%,bot_id.ilike.%${searchQuery.trim()}%`)
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (error) throw error;
      
      const results: Order[] = (data || []).map(o => ({
        orderNo: o.order_no,
        botId: o.bot_id || '',
        contact: o.contact || '',
        productName: o.product_name,
        amount: `${o.amount} ${o.currency}`,
        paymentMethod: o.payment_method,
        code: o.delivered_code || '',
        type: o.bot_id ? 'auto' : 'card',
        time: new Date(o.created_at).toLocaleString(),
        status: o.status as 'pending' | 'paid' | 'expired'
      }));
      
      setSearchResults(results);
      
      if (results.length === 0) {
        toast({ title: t('orderCenter.queryResult'), description: t('orderCenter.noResults') });
      } else {
        toast({ title: t('orderCenter.querySuccess'), description: t('orderCenter.foundOrders').replace('{count}', String(results.length)) });
      }
    } catch (error: any) {
      console.error('查询订单失败:', error);
      toast({ title: t('orderCenter.queryFailed'), description: error.message || t('orderCenter.tryLater'), variant: "destructive" });
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery, toast]);

  return (
    <div className="space-y-6">
      {/* Order search */}
      <Card className="p-6">
        <div className="flex items-center gap-3 border-b pb-4 mb-4">
          <div className="bg-primary p-2 rounded-lg">
            <Search size={20} className="text-primary-foreground"/>
          </div>
          <h4 className="font-bold text-base">{t('orderCenter.title')}</h4>
        </div>
        <div className="flex gap-3">
          <Input 
            placeholder={t('orderCenter.searchPlaceholder')} 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyPress={e => e.key === 'Enter' && handleSearchOrders()}
            className="flex-1"
          />
          <Button onClick={handleSearchOrders} disabled={isSearching}>
            {isSearching ? (
              <Loader2 size={16} className="animate-spin mr-2"/>
            ) : (
              <Search size={16} className="mr-2"/>
            )}
            {t('common.search')}
          </Button>
        </div>
        
        {/* Search results */}
        {hasSearched && (
          <div className="mt-4">
            <div className="flex justify-between items-center mb-3">
              <h5 className="font-bold text-sm text-muted-foreground">
                {t('orderCenter.queryResult')} ({searchResults.length} {t('orderCenter.records')})
              </h5>
              {searchResults.length > 0 && (
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={() => { setSearchResults([]); setHasSearched(false); setSearchQuery(''); }}
                >
                  {t('orderCenter.clearResults')}
                </Button>
              )}
            </div>
            {searchResults.length > 0 ? (
              <div className="overflow-x-auto border rounded-lg">
                <table className="w-full text-left">
                  <thead className="bg-muted text-muted-foreground text-xs border-b">
                    <tr>
                      <th className="p-3 font-bold">{t('orderCenter.orderNo')}</th>
                      <th className="p-3 font-bold">{t('orderCenter.productName')}</th>
                      <th className="p-3 font-bold">{t('orderCenter.payAmount')}</th>
                      <th className="p-3 font-bold">{t('orderCenter.contactAccount')}</th>
                      <th className="p-3 font-bold">{t('orderCenter.time')}</th>
                      <th className="p-3 font-bold text-center">{t('orderCenter.status')}</th>
                      <th className="p-3 font-bold">{t('orderCenter.actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border text-xs">
                    {searchResults.map(order => (
                      <tr key={order.orderNo} className="hover:bg-muted/50 transition-colors">
                        <td className="p-3 font-mono font-bold text-muted-foreground">{order.orderNo}</td>
                        <td className="p-3 font-bold">{order.productName}</td>
                        <td className="p-3 font-mono font-bold text-primary">{order.amount}</td>
                        <td className="p-3 text-muted-foreground">{order.type === 'auto' ? order.botId : order.contact}</td>
                        <td className="p-3 text-muted-foreground">{order.time}</td>
                        <td className="p-3 text-center">
                          <span className={`px-2 py-1 rounded text-xs font-bold ${
                            order.status === 'paid' ? 'bg-green-500/20 text-green-600' : 
                            (order.status === 'expired' ? 'bg-destructive/20 text-destructive' : 'bg-yellow-500/20 text-yellow-600')
                          }`}>
                            {order.status === 'paid' ? t('orderCenter.statusPaid') : (order.status === 'expired' ? t('orderCenter.statusExpired') : t('orderCenter.statusPending'))}
                          </span>
                        </td>
                        <td className="p-3">
                          {order.status === 'paid' && order.code && (
                            <Button size="sm" variant="outline" onClick={() => {copyToClipboard(order.code, t('orderCenter.codeCopied'))}}>{t('orderCenter.copyCode')}</Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-6 text-center text-muted-foreground bg-muted rounded-lg">
                {t('orderCenter.noResults')}
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Local order list */}
      <Card className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-bold text-lg flex items-center gap-3">
            <ClipboardList size={20} /> {t('orderCenter.localOrders')}
          </h3>
          <div className="flex bg-muted p-1 rounded-lg">
            {['all', 'pending', 'paid', 'expired'].map(status => (
              <button 
                key={status} 
                onClick={() => setOrderFilter(status)}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${orderFilter === status ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground'}`}
              >
                {status === 'all' ? t('common.all') : (status === 'pending' ? t('orderCenter.statusPending') : (status === 'paid' ? t('orderCenter.statusPaid') : t('orderCenter.statusExpired')))}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-muted text-muted-foreground text-xs border-b">
              <tr>
                <th className="p-4 font-bold">{t('orderCenter.orderNo')}</th>
                <th className="p-4 font-bold">{t('orderCenter.productName')}</th>
                <th className="p-4 font-bold">{t('orderCenter.payAmount')}</th>
                <th className="p-4 font-bold">{t('orderCenter.contactAccount')}</th>
                <th className="p-4 font-bold">{t('orderCenter.time')}</th>
                <th className="p-4 font-bold text-center">{t('orderCenter.status')}</th>
                <th className="p-4 font-bold">{t('orderCenter.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-xs">
              {orders.filter(o => orderFilter === 'all' || o.status === orderFilter).map(order => (
                <tr key={order.orderNo} className="hover:bg-muted/50 transition-colors">
                  <td className="p-4 font-mono font-bold text-muted-foreground">{order.orderNo}</td>
                  <td className="p-4 font-bold">{order.productName}</td>
                  <td className="p-4 font-mono font-bold text-primary">{order.amount}</td>
                  <td className="p-4 text-muted-foreground">{order.type === 'auto' ? order.botId : order.contact}</td>
                  <td className="p-4 text-muted-foreground">{order.time}</td>
                  <td className="p-4 text-center">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                      order.status === 'paid' ? 'bg-green-500/20 text-green-600' : 
                      (order.status === 'expired' ? 'bg-destructive/20 text-destructive' : 'bg-yellow-500/20 text-yellow-600')
                    }`}>
                      {order.status === 'paid' ? t('orderCenter.statusPaid') : (order.status === 'expired' ? t('orderCenter.statusExpired') : t('orderCenter.statusPending'))}
                    </span>
                  </td>
                  <td className="p-4">
                    {order.status === 'paid' && order.code && (
                      <Button size="sm" variant="outline" onClick={() => {copyToClipboard(order.code, t('orderCenter.codeCopied'))}}>{t('orderCenter.copyCode')}</Button>
                    )}
                  </td>
                </tr>
              ))}
              {orders.filter(o => orderFilter === 'all' || o.status === orderFilter).length === 0 && (
                <tr><td colSpan={7} className="p-10 text-center text-muted-foreground font-bold">{t('orderCenter.noOrders')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

export default OrderCenter;
