import React, { useState, useEffect, useCallback } from "react";
import { Wallet, RefreshCw, Plus, Minus, Search, ArrowUpDown, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/hooks/use-language";

interface UserBalance {
  id: string;
  telegram_user_id: number;
  telegram_username: string | null;
  first_name: string | null;
  balance: number;
  currency: string;
  updated_at: string;
}

interface BalanceTransaction {
  id: string;
  telegram_user_id: number;
  type: string;
  amount: number;
  balance_after: number;
  order_no: string | null;
  description: string | null;
  created_at: string;
}

interface BalanceManagerProps {
  botToken?: string;
  showToast: (type: "success" | "error" | "info", message: string) => void;
  readOnly?: boolean;
}

interface BotUser {
  telegram_user_id: number;
  username: string | null;
  first_name: string;
}

export function BalanceManager({ botToken, showToast, readOnly = false }: BalanceManagerProps) {
  const { language } = useLanguage();
  const [users, setUsers] = useState<UserBalance[]>([]);
  const [botUsers, setBotUsers] = useState<BotUser[]>([]);
  const [transactions, setTransactions] = useState<BalanceTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustNote, setAdjustNote] = useState("");
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [adjustType, setAdjustType] = useState<"add" | "deduct">("add");
  const [showAdjustDialog, setShowAdjustDialog] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!botToken) return;
    setIsLoading(true);
    try {
      const [balancesRes, txRes, botUsersRes] = await Promise.all([
        supabase
          .from("shop_user_balances" as any)
          .select("*")
          .eq("bot_token", botToken)
          .order("updated_at", { ascending: false }),
        supabase
          .from("shop_balance_transactions" as any)
          .select("*")
          .eq("bot_token", botToken)
          .order("created_at", { ascending: false })
          .limit(100),
        supabase
          .from("bot_users")
          .select("telegram_user_id, username, first_name")
          .eq("bot_token", botToken),
      ]);

      if (balancesRes.data) setUsers(balancesRes.data as any[]);
      if (txRes.data) setTransactions(txRes.data as any[]);
      if (botUsersRes.data) setBotUsers(botUsersRes.data as BotUser[]);
    } catch (e) {
      console.error("Failed to load balance data:", e);
    } finally {
      setIsLoading(false);
    }
  }, [botToken]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAdjust = async () => {
    if (!botToken || !selectedUserId || !adjustAmount) return;
    const amount = parseFloat(adjustAmount);
    if (isNaN(amount) || amount <= 0) {
      showToast("error", language === "zh" ? "请输入有效金额" : "Please enter a valid amount");
      return;
    }

    setIsAdjusting(true);
    try {
      const user = users.find((u) => u.telegram_user_id === selectedUserId);
      const currentBalance = user?.balance || 0;
      const delta = adjustType === "add" ? amount : -amount;
      const newBalance = currentBalance + delta;

      if (newBalance < 0) {
        showToast("error", language === "zh" ? "余额不足，无法扣除" : "Insufficient balance");
        setIsAdjusting(false);
        return;
      }

      // Update or insert balance
      if (user) {
        await supabase
          .from("shop_user_balances" as any)
          .update({ balance: newBalance, updated_at: new Date().toISOString() } as any)
          .eq("id", user.id);
      } else {
        const botUser = botUsers.find((bu) => bu.telegram_user_id === selectedUserId);
        await supabase.from("shop_user_balances" as any).insert({
          bot_token: botToken,
          telegram_user_id: selectedUserId,
          balance: newBalance,
          currency: "USDT",
          telegram_username: botUser?.username || null,
          first_name: botUser?.first_name || null,
        } as any);
      }

      // Record transaction
      await supabase.from("shop_balance_transactions" as any).insert({
        bot_token: botToken,
        telegram_user_id: selectedUserId,
        type: "adjust",
        amount: delta,
        balance_after: newBalance,
        description: adjustNote || (adjustType === "add"
          ? (language === "zh" ? "管理员手动增加" : "Admin manual add")
          : (language === "zh" ? "管理员手动扣除" : "Admin manual deduct")),
      } as any);

      showToast("success", language === "zh" ? "调账成功" : "Balance adjusted");
      setShowAdjustDialog(false);
      setAdjustAmount("");
      setAdjustNote("");
      loadData();
    } catch (e) {
      console.error("Adjust balance error:", e);
      showToast("error", language === "zh" ? "调账失败" : "Failed to adjust balance");
    } finally {
      setIsAdjusting(false);
    }
  };

  const handleDeleteUser = async (user: UserBalance) => {
    if (!botToken || user.id.startsWith("bot-user-")) return;
    setDeletingUserId(user.id);
    try {
      await supabase
        .from("shop_user_balances" as any)
        .delete()
        .eq("id", user.id);
      showToast("success", language === "zh" ? "已删除用户余额记录" : "User balance deleted");
      loadData();
    } catch (e) {
      console.error("Delete user balance error:", e);
      showToast("error", language === "zh" ? "删除失败" : "Failed to delete");
    } finally {
      setDeletingUserId(null);
    }
  };

  // Merge bot_users that don't have a balance record (shown only when searching)
  const mergedUsers: UserBalance[] = (() => {
    if (!searchTerm) return users;
    const balanceUserIds = new Set(users.map((u) => u.telegram_user_id));
    const extraUsers: UserBalance[] = botUsers
      .filter((bu) => !balanceUserIds.has(bu.telegram_user_id))
      .map((bu) => ({
        id: `bot-user-${bu.telegram_user_id}`,
        telegram_user_id: bu.telegram_user_id,
        telegram_username: bu.username,
        first_name: bu.first_name,
        balance: 0,
        currency: "USDT",
        updated_at: "",
      }));
    return [...users, ...extraUsers];
  })();

  const filteredUsers = mergedUsers.filter((u) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      u.telegram_username?.toLowerCase().includes(term) ||
      u.first_name?.toLowerCase().includes(term) ||
      String(u.telegram_user_id).includes(term)
    );
  });

  const selectedUserTxs = selectedUserId
    ? transactions.filter((tx) => tx.telegram_user_id === selectedUserId)
    : transactions;

  const typeLabel = (type: string) => {
    const map: Record<string, { zh: string; en: string }> = {
      recharge: { zh: "充值", en: "Recharge" },
      purchase: { zh: "消费", en: "Purchase" },
      adjust: { zh: "调账", en: "Adjust" },
    };
    return map[type]?.[language] || type;
  };

  const typeColor = (type: string) => {
    if (type === "recharge") return "text-green-600";
    if (type === "purchase") return "text-red-500";
    return "text-orange-500";
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <RefreshCw className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col xl:flex-row h-full">
      {/* Left: Users list */}
      <div className="flex-1 xl:w-1/2 bg-card flex flex-col xl:border-r border-border">
        <div className="p-4 border-b bg-muted flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wallet size={16} className="text-primary" />
            <h2 className="font-semibold text-foreground text-sm">
              {language === "zh" ? "用户余额列表" : "User Balances"}
            </h2>
            <span className="text-xs text-muted-foreground">({users.length})</span>
          </div>
          <button onClick={loadData} className="p-1.5 hover:bg-muted rounded">
            <RefreshCw size={14} />
          </button>
        </div>

        <div className="p-3 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-muted-foreground" size={14} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={language === "zh" ? "搜索用户名/ID..." : "Search username/ID..."}
              className="w-full pl-9 p-2 border rounded bg-background text-foreground text-sm outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {filteredUsers.length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-8">
              {language === "zh" ? "暂无用户余额记录" : "No user balances yet"}
            </div>
          )}
          {filteredUsers.map((u) => (
            <div
              key={u.id}
              onClick={() => setSelectedUserId(u.telegram_user_id === selectedUserId ? null : u.telegram_user_id)}
              className={`p-3 border rounded-lg cursor-pointer hover:bg-muted transition-colors ${
                selectedUserId === u.telegram_user_id ? "bg-primary/5 border-primary ring-1 ring-primary" : "bg-background"
              }`}
            >
              <div className="flex justify-between items-center">
                <div>
                  <div className="font-medium text-sm text-foreground">
                    {u.first_name || u.telegram_username || `User ${u.telegram_user_id}`}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {u.telegram_username ? `@${u.telegram_username}` : ""} · ID: {u.telegram_user_id}
                  </div>
                </div>
                <div className="text-right flex flex-col items-end gap-0.5">
                  <div className="font-bold text-primary text-sm">{Number(u.balance).toFixed(2)} {u.currency}</div>
                  {!readOnly && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedUserId(u.telegram_user_id);
                          setShowAdjustDialog(true);
                        }}
                        className="text-[10px] text-muted-foreground hover:text-primary"
                      >
                        <ArrowUpDown size={12} className="inline mr-0.5" />
                        {language === "zh" ? "调账" : "Adjust"}
                      </button>
                      {!u.id.startsWith("bot-user-") && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(language === "zh" ? "确定删除该用户余额记录？" : "Delete this user balance?")) {
                              handleDeleteUser(u);
                            }
                          }}
                          disabled={deletingUserId === u.id}
                          className="text-[10px] text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 size={12} className="inline" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right: Transactions + Adjust dialog */}
      <div className="flex-1 xl:w-1/2 bg-card flex flex-col">
        <div className="p-4 border-b bg-muted flex items-center justify-between">
          <h2 className="font-semibold text-foreground text-sm">
            {selectedUserId
              ? (language === "zh" ? `用户 ${selectedUserId} 的流水` : `Transactions for ${selectedUserId}`)
              : (language === "zh" ? "最近流水记录" : "Recent Transactions")}
          </h2>
          {selectedUserId && (
            <button onClick={() => setSelectedUserId(null)} className="text-xs text-muted-foreground hover:text-foreground">
              {language === "zh" ? "查看全部" : "View All"}
            </button>
          )}
        </div>

        {/* Adjust dialog */}
        {showAdjustDialog && (
          <div className="p-4 border-b bg-muted/50 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <ArrowUpDown size={14} />
              {language === "zh" ? "手动调账" : "Manual Adjustment"} — ID: {selectedUserId}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setAdjustType("add")}
                className={`flex-1 py-2 rounded text-sm font-medium flex items-center justify-center gap-1 ${
                  adjustType === "add" ? "bg-green-500/10 border border-green-500/50 text-green-600" : "bg-muted border border-border text-muted-foreground"
                }`}
              >
                <Plus size={14} /> {language === "zh" ? "增加" : "Add"}
              </button>
              <button
                onClick={() => setAdjustType("deduct")}
                className={`flex-1 py-2 rounded text-sm font-medium flex items-center justify-center gap-1 ${
                  adjustType === "deduct" ? "bg-red-500/10 border border-red-500/50 text-red-500" : "bg-muted border border-border text-muted-foreground"
                }`}
              >
                <Minus size={14} /> {language === "zh" ? "扣除" : "Deduct"}
              </button>
            </div>
            <input
              type="number"
              value={adjustAmount}
              onChange={(e) => setAdjustAmount(e.target.value)}
              placeholder={language === "zh" ? "输入金额" : "Enter amount"}
              className="w-full p-2 border rounded bg-background text-foreground text-sm outline-none"
            />
            <input
              type="text"
              value={adjustNote}
              onChange={(e) => setAdjustNote(e.target.value)}
              placeholder={language === "zh" ? "备注（可选）" : "Note (optional)"}
              className="w-full p-2 border rounded bg-background text-foreground text-sm outline-none"
            />
            <div className="flex gap-2">
              <button onClick={() => setShowAdjustDialog(false)} className="flex-1 py-2 rounded border text-sm text-muted-foreground hover:bg-muted">
                {language === "zh" ? "取消" : "Cancel"}
              </button>
              <button
                onClick={handleAdjust}
                disabled={isAdjusting || !adjustAmount}
                className="flex-1 py-2 rounded bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
              >
                {isAdjusting ? "..." : (language === "zh" ? "确认" : "Confirm")}
              </button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {selectedUserTxs.length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-8">
              {language === "zh" ? "暂无流水记录" : "No transactions yet"}
            </div>
          )}
          {selectedUserTxs.map((tx) => (
            <div key={tx.id} className="p-3 border rounded-lg bg-background">
              <div className="flex justify-between items-start">
                <div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded ${typeColor(tx.type)} bg-current/10`}>
                    {typeLabel(tx.type)}
                  </span>
                  {tx.order_no && <span className="text-xs text-muted-foreground ml-2">#{tx.order_no}</span>}
                </div>
                <span className={`font-mono font-bold text-sm ${Number(tx.amount) >= 0 ? "text-green-600" : "text-red-500"}`}>
                  {Number(tx.amount) >= 0 ? "+" : ""}{Number(tx.amount).toFixed(2)}
                </span>
              </div>
              {tx.description && <div className="text-xs text-muted-foreground mt-1">{tx.description}</div>}
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1.5">
                <span>ID: {tx.telegram_user_id}</span>
                <span>{language === "zh" ? "余额" : "Balance"}: {Number(tx.balance_after).toFixed(2)}</span>
                <span>{new Date(tx.created_at).toLocaleString()}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
