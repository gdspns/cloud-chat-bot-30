import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Download, Upload, FileJson, FileSpreadsheet, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface DataExportImportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDataImported?: () => void;
}

interface ExportData {
  exportDate: string;
  version: string;
  bot_activations: any[];
  messages: any[];
  activation_codes: any[];
  bot_trial_records: any[];
  disabled_users: any[];
  keyboard_configs: any[];
  store_products: any[];
  store_card_keys: any[];
  store_orders: any[];
  shop_configs: any[];
  shop_products: any[];
  shop_orders: any[];
  shop_user_balances: any[];
  shop_balance_transactions: any[];
  bot_users: any[];
  articles: any[];
  user_roles: any[];
  cron_job_logs: any[];
}

export const DataExportImport = ({ open, onOpenChange, onDataImported }: DataExportImportProps) => {
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importPreview, setImportPreview] = useState<ExportData | null>(null);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // 导出为JSON
  const handleExportJSON = async () => {
    setIsExporting(true);
    try {
      const exportData = await fetchAllData();
      const jsonStr = JSON.stringify(exportData, null, 2);
      downloadFile(jsonStr, `telegram-bot-data-${formatDate(new Date())}.json`, 'application/json');
      toast({
        title: "导出成功",
        description: "数据已导出为JSON格式",
      });
    } catch (error: any) {
      toast({
        title: "导出失败",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  // 导出为CSV
  const handleExportCSV = async () => {
    setIsExporting(true);
    try {
      const exportData = await fetchAllData();
      
      // 导出机器人数据
      if (exportData.bot_activations.length > 0) {
        const botsCsv = convertToCSV(exportData.bot_activations);
        downloadFile(botsCsv, `bots-${formatDate(new Date())}.csv`, 'text/csv');
      }

      // 导出消息数据
      if (exportData.messages.length > 0) {
        const messagesCsv = convertToCSV(exportData.messages);
        downloadFile(messagesCsv, `messages-${formatDate(new Date())}.csv`, 'text/csv');
      }

      // 导出激活码数据
      if (exportData.activation_codes.length > 0) {
        const codesCsv = convertToCSV(exportData.activation_codes);
        downloadFile(codesCsv, `activation-codes-${formatDate(new Date())}.csv`, 'text/csv');
      }

      toast({
        title: "导出成功",
        description: "数据已导出为CSV格式（多个文件）",
      });
    } catch (error: any) {
      toast({
        title: "导出失败",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  // 获取所有数据
  const fetchAllData = async (): Promise<ExportData> => {
    const fetchTable = async (table: string, orderCol: string = 'created_at') => {
      const { data, error } = await supabase
        .from(table as any)
        .select('*')
        .order(orderCol, { ascending: false });
      if (error) throw error;
      return data || [];
    };

    const [
      bot_activations, messages, activation_codes, bot_trial_records, disabled_users,
      keyboard_configs, store_products, store_card_keys, store_orders,
      shop_configs, shop_products, shop_orders, shop_user_balances, shop_balance_transactions,
      bot_users, articles, user_roles, cron_job_logs
    ] = await Promise.all([
      fetchTable('bot_activations'), fetchTable('messages'), fetchTable('activation_codes'),
      fetchTable('bot_trial_records'), fetchTable('disabled_users', 'disabled_at'),
      fetchTable('keyboard_configs'), fetchTable('store_products'), fetchTable('store_card_keys'),
      fetchTable('store_orders'), fetchTable('shop_configs'), fetchTable('shop_products'),
      fetchTable('shop_orders'), fetchTable('shop_user_balances'), fetchTable('shop_balance_transactions'),
      fetchTable('bot_users'), fetchTable('articles'), fetchTable('user_roles'), fetchTable('cron_job_logs', 'started_at'),
    ]);

    return {
      exportDate: new Date().toISOString(),
      version: '2.0',
      bot_activations, messages, activation_codes, bot_trial_records, disabled_users,
      keyboard_configs, store_products, store_card_keys, store_orders,
      shop_configs, shop_products, shop_orders, shop_user_balances, shop_balance_transactions,
      bot_users, articles, user_roles, cron_job_logs,
    };
  };

  // 转换为CSV
  const convertToCSV = (data: any[]): string => {
    if (data.length === 0) return '';
    
    const headers = Object.keys(data[0]);
    const rows = data.map(item => 
      headers.map(header => {
        const value = item[header];
        if (value === null || value === undefined) return '';
        if (typeof value === 'object') return JSON.stringify(value).replace(/"/g, '""');
        const stringValue = String(value);
        // 如果包含逗号、换行或引号，需要用引号包裹
        if (stringValue.includes(',') || stringValue.includes('\n') || stringValue.includes('"')) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
      }).join(',')
    );
    
    return [headers.join(','), ...rows].join('\n');
  };

  // 下载文件
  const downloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 格式化日期
  const formatDate = (date: Date): string => {
    return date.toISOString().split('T')[0];
  };

  // 处理文件选择
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text) as ExportData;
      
      // 验证数据格式
      const errors: string[] = [];
      if (!data.version) errors.push('缺少版本信息');
      if (!data.exportDate) errors.push('缺少导出日期');
      if (!Array.isArray(data.bot_activations)) errors.push('机器人数据格式错误');
      if (!Array.isArray(data.messages)) errors.push('消息数据格式错误');
      if (!Array.isArray(data.activation_codes)) errors.push('激活码数据格式错误');
      
      setImportErrors(errors);
      setImportPreview(data);
    } catch (error) {
      toast({
        title: "解析失败",
        description: "文件格式不正确，请选择有效的JSON导出文件",
        variant: "destructive",
      });
    }
    
    // 重置文件输入
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // 执行导入
  const handleImport = async () => {
    if (!importPreview || importErrors.length > 0) return;

    setIsImporting(true);
    try {
      const upsertTable = async (table: string, data: any[]) => {
        if (!data || data.length === 0) return;
        const batchSize = 100;
        for (let i = 0; i < data.length; i += batchSize) {
          const batch = data.slice(i, i + batchSize);
          const { error } = await supabase
            .from(table as any)
            .upsert(batch as any, { onConflict: 'id' });
          if (error) console.error(`导入 ${table} 失败:`, error);
        }
      };

      // 按依赖顺序导入
      await upsertTable('activation_codes', importPreview.activation_codes);
      await upsertTable('user_roles', importPreview.user_roles);
      await upsertTable('bot_trial_records', importPreview.bot_trial_records);
      await upsertTable('disabled_users', importPreview.disabled_users);
      await upsertTable('bot_activations', importPreview.bot_activations);
      await upsertTable('bot_users', importPreview.bot_users);
      await upsertTable('messages', importPreview.messages);
      await upsertTable('keyboard_configs', importPreview.keyboard_configs);
      await upsertTable('articles', importPreview.articles);
      await upsertTable('store_products', importPreview.store_products);
      await upsertTable('store_card_keys', importPreview.store_card_keys);
      await upsertTable('store_orders', importPreview.store_orders);
      await upsertTable('shop_configs', importPreview.shop_configs);
      await upsertTable('shop_products', importPreview.shop_products);
      await upsertTable('shop_orders', importPreview.shop_orders);
      await upsertTable('shop_user_balances', importPreview.shop_user_balances);
      await upsertTable('shop_balance_transactions', importPreview.shop_balance_transactions);
      await upsertTable('cron_job_logs', importPreview.cron_job_logs);

      const totalCount = Object.entries(importPreview)
        .filter(([k]) => !['exportDate', 'version'].includes(k))
        .reduce((sum, [, v]) => sum + (Array.isArray(v) ? v.length : 0), 0);

      toast({
        title: "导入成功",
        description: `已导入 ${totalCount} 条数据记录`,
      });

      setImportPreview(null);
      onDataImported?.();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "导入失败",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>数据导出/导入</DialogTitle>
          <DialogDescription>
            导出或导入系统数据，支持JSON和CSV格式
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="export" className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="export">
              <Download className="h-4 w-4 mr-2" />
              导出数据
            </TabsTrigger>
            <TabsTrigger value="import">
              <Upload className="h-4 w-4 mr-2" />
              导入数据
            </TabsTrigger>
          </TabsList>

          <TabsContent value="export" className="space-y-4">
            <Card className="p-4">
              <h3 className="font-medium mb-3">选择导出格式</h3>
              <div className="grid grid-cols-2 gap-4">
                <Button
                  variant="outline"
                  className="h-24 flex flex-col gap-2"
                  onClick={handleExportJSON}
                  disabled={isExporting}
                >
                  {isExporting ? (
                    <Loader2 className="h-8 w-8 animate-spin" />
                  ) : (
                    <FileJson className="h-8 w-8" />
                  )}
                  <span>导出 JSON</span>
                  <span className="text-xs text-muted-foreground">单个文件，可导入</span>
                </Button>
                <Button
                  variant="outline"
                  className="h-24 flex flex-col gap-2"
                  onClick={handleExportCSV}
                  disabled={isExporting}
                >
                  {isExporting ? (
                    <Loader2 className="h-8 w-8 animate-spin" />
                  ) : (
                    <FileSpreadsheet className="h-8 w-8" />
                  )}
                  <span>导出 CSV</span>
                  <span className="text-xs text-muted-foreground">多个文件，Excel可查看</span>
                </Button>
              </div>
            </Card>

            <Card className="p-4">
              <h3 className="font-medium mb-2">导出内容说明</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• 机器人配置：令牌、个人ID、问候语、状态等</li>
                <li>• 聊天消息：所有对话记录</li>
                <li>• 激活码：所有生成的激活码及使用状态</li>
                <li>• 试用记录：机器人试用历史</li>
                <li>• 禁用用户：被禁用的用户列表</li>
                <li>• 菜单键盘配置：指令、菜单、自动回复规则</li>
                <li>• 商品管理：商品、卡密库存、网站订单</li>
                <li>• TG商城：商品、订单、配置、用户余额</li>
                <li>• 机器人用户：所有机器人的用户记录</li>
                <li>• 文章管理：配置说明文章</li>
                <li>• 用户角色：管理员权限分配</li>
                <li>• 定时任务日志：系统定时任务执行记录</li>
              </ul>
            </Card>
          </TabsContent>

          <TabsContent value="import" className="space-y-4">
            <Card className="p-4">
              <h3 className="font-medium mb-3">选择JSON文件导入</h3>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Button
                variant="outline"
                className="w-full h-24 border-dashed"
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="flex flex-col items-center gap-2">
                  <Upload className="h-8 w-8" />
                  <span>点击选择JSON文件</span>
                  <span className="text-xs text-muted-foreground">仅支持本系统导出的JSON格式</span>
                </div>
              </Button>
            </Card>

            {importPreview && (
              <Card className="p-4">
                <h3 className="font-medium mb-3 flex items-center gap-2">
                  导入预览
                  {importErrors.length > 0 ? (
                    <Badge variant="destructive">有错误</Badge>
                  ) : (
                    <Badge variant="default">可导入</Badge>
                  )}
                </h3>

                {importErrors.length > 0 && (
                  <div className="bg-destructive/10 p-3 rounded-lg mb-3">
                    <div className="flex items-center gap-2 text-destructive mb-2">
                      <AlertCircle className="h-4 w-4" />
                      <span className="font-medium">发现以下错误：</span>
                    </div>
                    <ul className="text-sm text-destructive space-y-1">
                      {importErrors.map((error, index) => (
                        <li key={index}>• {error}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <ScrollArea className="h-[300px]">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>导出日期：</span>
                      <span>{new Date(importPreview.exportDate).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>版本：</span>
                      <span>{importPreview.version}</span>
                    </div>
                    {[
                      ['机器人', 'bot_activations'],
                      ['消息', 'messages'],
                      ['激活码', 'activation_codes'],
                      ['试用记录', 'bot_trial_records'],
                      ['禁用用户', 'disabled_users'],
                      ['菜单键盘配置', 'keyboard_configs'],
                      ['网站商品', 'store_products'],
                      ['卡密库存', 'store_card_keys'],
                      ['网站订单', 'store_orders'],
                      ['TG商城配置', 'shop_configs'],
                      ['TG商城商品', 'shop_products'],
                      ['TG商城订单', 'shop_orders'],
                      ['用户余额', 'shop_user_balances'],
                      ['余额流水', 'shop_balance_transactions'],
                      ['机器人用户', 'bot_users'],
                      ['文章', 'articles'],
                      ['用户角色', 'user_roles'],
                      ['定时任务日志', 'cron_job_logs'],
                    ].map(([label, key]) => (
                      <div key={key} className="flex justify-between text-sm">
                        <span>{label}：</span>
                        <span>{(importPreview as any)[key]?.length || 0}</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>

                <div className="flex gap-2 mt-4">
                  <Button
                    onClick={handleImport}
                    disabled={isImporting || importErrors.length > 0}
                    className="flex-1"
                  >
                    {isImporting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        导入中...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4 mr-2" />
                        确认导入
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setImportPreview(null)}
                    disabled={isImporting}
                  >
                    取消
                  </Button>
                </div>
              </Card>
            )}

            <Card className="p-4">
              <h3 className="font-medium mb-2">导入注意事项</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• 仅支持本系统导出的JSON格式文件</li>
                <li>• 相同ID的数据将被覆盖更新</li>
                <li>• 导入后需要重新设置Telegram Webhook</li>
                <li>• 建议在导入前先备份当前数据</li>
              </ul>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
