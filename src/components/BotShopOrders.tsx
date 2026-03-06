import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, ShoppingCart, ChevronDown, ChevronUp, Copy, Bot, Search, Loader2, Download } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

interface ShopOrder {
  id: string;
  bot_token: string;
  order_no: string;
  product_name: string;
  amount: number;
  currency: string;
  payment_method: string;
  status: string;
  telegram_user_id: number | null;
  telegram_username: string | null;
  delivery_content: string | null;
  tx_hash: string | null;
  order_type: string;
  created_at: string;
}

type OrderFilter = 'all' | 'pending' | 'paid' | 'cancelled';

export function BotShopOrders() {
  const [orders, setOrders] = useState<ShopOrder[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedBots, setExpandedBots] = useState<Set<string>>(new Set());
  const [activeFilter, setActiveFilter] = useState<OrderFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const { toast } = useToast();

  const loadOrders = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("shop_orders")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1000);

      if (error) throw error;
      setOrders((data as ShopOrder[]) || []);
    } catch (err) {
      console.error("Failed to load shop orders:", err);
      toast({ title: "加载失败", description: "无法加载商品订单数据", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  // Filter orders
  const filteredOrders = orders.filter(o => {
    const statusMatch = activeFilter === 'all' || o.status === activeFilter;
    const searchMatch = !searchQuery.trim() || 
      o.order_no.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.product_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (o.telegram_username || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(o.telegram_user_id || '').includes(searchQuery);
    return statusMatch && searchMatch;
  });

  // Group by bot_token
  const grouped = filteredOrders.reduce<Record<string, ShopOrder[]>>((acc, o) => {
    if (!acc[o.bot_token]) acc[o.bot_token] = [];
    acc[o.bot_token].push(o);
    return acc;
  }, {});

  const botTokens = Object.keys(grouped);

  // Order counts
  const orderCounts = {
    all: orders.length,
    pending: orders.filter(o => o.status === 'pending').length,
    paid: orders.filter(o => o.status === 'paid').length,
    cancelled: orders.filter(o => o.status === 'cancelled').length,
  };

  const toggleBot = (token: string) => {
    setExpandedBots(prev => {
      const next = new Set(prev);
      if (next.has(token)) next.delete(token); else next.add(token);
      return next;
    });
  };

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast({ title: "已复制" });
    });
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-CN', {
      month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-green-500/20 text-green-600 border-green-500/30 text-[10px]">已支付</Badge>;
      case 'cancelled':
        return <Badge variant="destructive" className="text-[10px]">已取消</Badge>;
      default:
        return <Badge className="bg-yellow-500/20 text-yellow-600 border-yellow-500/30 text-[10px]">待支付</Badge>;
    }
  };

  const handleExportCSV = () => {
    if (filteredOrders.length === 0) return;
    const headers = ['订单号', '商品名称', '金额', '币种', '支付方式', '状态', '用户ID', '用户名', '类型', '发货内容', '创建时间', 'Bot Token'];
    const rows = filteredOrders.map(o => [
      o.order_no, o.product_name, o.amount, o.currency, o.payment_method,
      o.status, o.telegram_user_id || '', o.telegram_username || '', o.order_type,
      o.delivery_content || '', o.created_at, o.bot_token
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shop_orders_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold">商品订单总览</h3>
          <p className="text-sm text-muted-foreground">
            共 {botTokens.length} 个机器人，{filteredOrders.length} 笔订单
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={filteredOrders.length === 0}>
            <Download className="h-4 w-4 mr-1" />
            导出
          </Button>
          <Button variant="outline" size="sm" onClick={loadOrders} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? "animate-spin" : ""}`} />
            刷新
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex bg-muted p-1 rounded-lg">
          {(['all', 'paid', 'pending', 'cancelled'] as OrderFilter[]).map(status => (
            <button
              key={status}
              onClick={() => setActiveFilter(status)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                activeFilter === status ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {status === 'all' ? '全部' : status === 'paid' ? '已支付' : status === 'pending' ? '待支付' : '已取消'}
              <span className="ml-1 opacity-70">({orderCounts[status]})</span>
            </button>
          ))}
        </div>
        <div className="flex-1 max-w-xs">
          <Input
            placeholder="搜索订单号/商品/用户名..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="h-8 text-xs"
          />
        </div>
      </div>

      {/* Content */}
      {isLoading && !orders.length ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : botTokens.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          <ShoppingCart className="h-10 w-10 mx-auto mb-2 opacity-50" />
          <p>暂无商品订单数据</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {botTokens.map(token => {
            const botOrders = grouped[token];
            const isExpanded = expandedBots.has(token);
            const paidCount = botOrders.filter(o => o.status === 'paid').length;
            const totalAmount = botOrders.filter(o => o.status === 'paid').reduce((sum, o) => sum + o.amount, 0);

            return (
              <Card key={token} className="overflow-hidden">
                <button
                  onClick={() => toggleBot(token)}
                  className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <Bot className="h-5 w-5 text-primary shrink-0" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-medium break-all">{token}</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); copyText(token); }}
                          className="p-0.5 rounded hover:bg-muted shrink-0"
                        >
                          <Copy className="h-3 w-3 text-muted-foreground" />
                        </button>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant="secondary" className="text-[10px]">
                          {botOrders.length} 订单
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">
                          已支付 {paidCount}
                        </Badge>
                        {totalAmount > 0 && (
                          <Badge className="bg-green-500/10 text-green-600 border-green-500/30 text-[10px]">
                            成交 {totalAmount.toFixed(2)}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>

                {isExpanded && (
                  <div className="border-t">
                    <ScrollArea className="max-h-[500px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[120px]">订单号</TableHead>
                            <TableHead className="w-[120px]">商品</TableHead>
                            <TableHead className="w-[90px]">金额</TableHead>
                            <TableHead className="w-[80px]">支付方式</TableHead>
                            <TableHead className="w-[70px]">状态</TableHead>
                            <TableHead className="w-[100px]">用户</TableHead>
                            <TableHead className="w-[60px]">类型</TableHead>
                            <TableHead>发货内容</TableHead>
                            <TableHead className="w-[100px]">时间</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {botOrders.map(order => (
                            <TableRow key={order.id}>
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  <span className="font-mono text-[11px] text-muted-foreground">{order.order_no}</span>
                                  <button onClick={() => copyText(order.order_no)} className="p-0.5 rounded hover:bg-muted shrink-0">
                                    <Copy className="h-3 w-3 text-muted-foreground" />
                                  </button>
                                </div>
                              </TableCell>
                              <TableCell className="font-medium text-sm">{order.product_name}</TableCell>
                              <TableCell className="font-mono text-sm">
                                {order.amount} {order.currency}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-[10px]">
                                  {order.payment_method}
                                </Badge>
                              </TableCell>
                              <TableCell>{getStatusBadge(order.status)}</TableCell>
                              <TableCell>
                                <div className="text-xs">
                                  {order.telegram_username ? (
                                    <span className="text-primary">@{order.telegram_username}</span>
                                  ) : order.telegram_user_id ? (
                                    <span className="font-mono text-muted-foreground">{order.telegram_user_id}</span>
                                  ) : (
                                    <span className="text-muted-foreground">-</span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-[10px]">
                                  {order.order_type === 'recharge' ? '充值' : '购买'}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {order.delivery_content ? (
                                  <div className="flex items-center gap-1">
                                    <code className="text-[11px] bg-muted px-1.5 py-0.5 rounded max-w-[150px] truncate block">
                                      {order.delivery_content}
                                    </code>
                                    <button onClick={() => copyText(order.delivery_content!)} className="p-0.5 rounded hover:bg-muted shrink-0">
                                      <Copy className="h-3 w-3 text-muted-foreground" />
                                    </button>
                                  </div>
                                ) : (
                                  <span className="text-xs text-muted-foreground">-</span>
                                )}
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {formatTime(order.created_at)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
