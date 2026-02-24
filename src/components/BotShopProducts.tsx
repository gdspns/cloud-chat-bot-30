import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, Package, Eye, EyeOff, ChevronDown, ChevronUp, Copy, Bot, Trash2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from "@/components/ui/alert-dialog";

interface ShopProduct {
  id: string;
  bot_token: string;
  name: string;
  price: number;
  currency: string;
  category: string | null;
  keywords: string[] | null;
  stock_content: string[] | null;
  description: string | null;
  is_active: boolean | null;
  created_at: string;
  updated_at: string;
}

export function BotShopProducts() {
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedBots, setExpandedBots] = useState<Set<string>>(new Set());
  const [visibleStock, setVisibleStock] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const loadProducts = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("shop_products")
        .select("*")
        .order("bot_token")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setProducts((data as ShopProduct[]) || []);
    } catch (err) {
      console.error("Failed to load shop products:", err);
      toast({ title: "加载失败", description: "无法加载机器人商品数据", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadProducts(); }, []);

  const grouped = products.reduce<Record<string, ShopProduct[]>>((acc, p) => {
    if (!acc[p.bot_token]) acc[p.bot_token] = [];
    acc[p.bot_token].push(p);
    return acc;
  }, {});

  const botTokens = Object.keys(grouped);

  const toggleBot = (token: string) => {
    setExpandedBots(prev => {
      const next = new Set(prev);
      if (next.has(token)) next.delete(token); else next.add(token);
      return next;
    });
  };

  const toggleStockVisibility = (productId: string) => {
    setVisibleStock(prev => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId); else next.add(productId);
      return next;
    });
  };

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast({ title: "已复制" });
    });
  };

  const deleteProduct = async (productId: string) => {
    try {
      const { error } = await supabase.from("shop_products").delete().eq("id", productId);
      if (error) throw error;
      toast({ title: "删除成功", description: "商品已删除" });
      await loadProducts();
    } catch (err) {
      console.error("Failed to delete product:", err);
      toast({ title: "删除失败", description: "无法删除商品", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold">机器人商品总览</h3>
          <p className="text-sm text-muted-foreground">
            共 {botTokens.length} 个机器人，{products.length} 个商品
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadProducts} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? "animate-spin" : ""}`} />
          刷新
        </Button>
      </div>

      {isLoading && !products.length ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : botTokens.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          <Package className="h-10 w-10 mx-auto mb-2 opacity-50" />
          <p>暂无机器人商品数据</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {botTokens.map(token => {
            const botProducts = grouped[token];
            const isExpanded = expandedBots.has(token);
            const totalStock = botProducts.reduce((sum, p) => sum + (p.stock_content?.length || 0), 0);

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
                          {botProducts.length} 商品
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">
                          库存 {totalStock}
                        </Badge>
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
                            <TableHead className="w-[140px]">商品名称</TableHead>
                            <TableHead className="w-[80px]">价格</TableHead>
                            <TableHead className="w-[80px]">分类</TableHead>
                            <TableHead className="w-[60px]">库存</TableHead>
                            <TableHead>卡密内容</TableHead>
                            <TableHead className="w-[60px]">操作</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {botProducts.map(product => {
                            const stockVisible = visibleStock.has(product.id);
                            const stockItems = product.stock_content || [];

                            return (
                              <TableRow key={product.id}>
                                <TableCell>
                                  <div className="font-medium text-sm">{product.name}</div>
                                  {product.description && (
                                    <div className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">
                                      {product.description}
                                    </div>
                                  )}
                                </TableCell>
                                <TableCell className="font-mono text-sm">
                                  {product.price} {product.currency}
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="text-[10px]">
                                    {product.category || "默认"}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <Badge variant={stockItems.length > 0 ? "default" : "destructive"} className="text-[10px]">
                                    {stockItems.length}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  {stockItems.length === 0 ? (
                                    <span className="text-xs text-muted-foreground">无库存</span>
                                  ) : (
                                    <div className="space-y-1">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 px-2 text-xs"
                                        onClick={() => toggleStockVisibility(product.id)}
                                      >
                                        {stockVisible ? <EyeOff className="h-3 w-3 mr-1" /> : <Eye className="h-3 w-3 mr-1" />}
                                        {stockVisible ? "隐藏" : `查看 (${stockItems.length})`}
                                      </Button>
                                      {stockVisible && (
                                        <div className="max-h-[120px] overflow-y-auto space-y-0.5">
                                          {stockItems.map((item, idx) => (
                                            <div key={idx} className="flex items-center gap-1 group">
                                              <code className="text-[11px] bg-muted px-1.5 py-0.5 rounded break-all flex-1">
                                                {item}
                                              </code>
                                              <button
                                                onClick={() => copyText(item)}
                                                className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-muted transition-opacity shrink-0"
                                              >
                                                <Copy className="h-3 w-3 text-muted-foreground" />
                                              </button>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive">
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>确认删除商品</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          确定要删除商品「{product.name}」吗？该操作会同时从该机器人的TG商城中删除此商品，且不可恢复。
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>取消</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => deleteProduct(product.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                          删除
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </TableCell>
                              </TableRow>
                            );
                          })}
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
