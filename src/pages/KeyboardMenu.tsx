import React, { useState, useEffect, useRef } from "react";
import {
  Send,
  Settings,
  Image as ImageIcon,
  Link as LinkIcon,
  Plus,
  X,
  Bot,
  Zap,
  Eye,
  MessageSquare,
  MoreVertical,
  ArrowLeft,
  Menu,
  Check,
  Trash2,
  Layout,
  LogOut,
  Loader2,
  List,
  Save,
  AlertCircle,
  User,
  RefreshCw,
  Layers,
  Globe,
  MessageCircle,
  Play,
  Edit3,
  AlertTriangle,
  Hash,
  Terminal,
  Info,
  ExternalLink,
  Command,
  Tag,
  Download,
  Upload,
  FileJson,
  Bug,
  Activity,
  Wifi,
  WifiOff,
  BarChart2,
  Users,
  Calendar,
  ChevronLeft,
  Folder,
  Target,
  SendHorizontal,
  Radio,
  Server,
  MessageCircleQuestion,
  Search,
  RadioReceiver,
  RotateCcw,
  Copy,
  EyeOff,
  PlugZap,
  Cloud,
  CloudOff,
  Smile,
  Video,
  ShoppingCart,
  HelpCircle,
  Timer,
  Shield,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { TgShopPanel, ConfigGuide } from "@/components/TgShop";
import { Navbar } from "@/components/Navbar";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/hooks/use-language";

// --- Version Control ---
const APP_VERSION = "v3.32.0";

// --- 类型定义 ---
interface BotProfile {
  id: number;
  first_name: string;
  username: string;
  token: string;
}

interface InlineButton {
  text: string;
  type: "url" | "callback_data" | "web_app";
  value: string;
}

interface ReplyButton {
  text: string;
  textEn?: string; // 英文文本
  actionType: "text" | "navigate";
  actionValue?: string;
}

interface MenuPage {
  id: string;
  name: string;
  rows: ReplyButton[][];
}

interface BotCommand {
  command: string;
  description: string;
}

interface MessageData {
  id: string;
  label?: string;
  // 修改：添加 video 类型
  type: "text" | "photo" | "video";
  content: string;
  mediaUrl?: string;
  inlineKeyboard?: InlineButton[][];
  disableWebPagePreview?: boolean;
}

interface ChatMessage {
  id: string;
  sender: "user" | "bot";
  content: string;
  // 修改：添加 video 类型
  type: "text" | "photo" | "video";
  mediaUrl?: string;
  timestamp: string;
  inlineKeyboard?: InlineButton[][];
}

interface AutoReplyRule {
  id: string;
  triggerType: "keyword" | "command";
  triggerValue: string;
  replyMessages: MessageData[];
}

interface UserStat {
  id: number;
  first_name: string;
  username?: string;
  last_seen: number;
  joined_at: number;
}

interface AppConfig {
  version: string;
  timestamp: number;
  tokenInput: string;
  targetChatId: string;
  commands: BotCommand[];
  menuPages: MenuPage[];
  autoReplyRules: AutoReplyRule[];
  flowMessages: MessageData[];
  knownUsers: UserStat[];
  // TG商城配置
  shopConfig?: any;
  shopProducts?: any[];
  shopOrders?: any[];
  shopUserBalances?: any[];
  shopBalanceTransactions?: any[];
  // 文章/配置说明
  articles?: any[];
}

// --- 工具函数 ---
const getCurrentTime = () => {
  const now = new Date();
  return `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
};

const uuid = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2, 15);
};

const escapeHtml = (unsafe: string) => {
  if (!unsafe) return "";
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

// --- Root Component ---
export default function KeyboardMenu() {
  const { t } = useLanguage();
  useEffect(() => {
    // 禁用键盘快捷键 (F12, Ctrl+Shift+I/J/C, Ctrl+U)
    const handleKeyDown = (e: KeyboardEvent) => {
      // 禁用 F12
      if (e.key === "F12" || e.keyCode === 123) {
        e.preventDefault();
        return false;
      }

      // 禁用 Ctrl+Shift+I (开发者工具), Ctrl+Shift+J (控制台), Ctrl+Shift+C (元素选择)
      if (e.ctrlKey && e.shiftKey) {
        const key = e.key.toLowerCase();
        if (
          key === 'i' || key === 'I' || e.keyCode === 73 ||
          key === 'j' || key === 'J' || e.keyCode === 74 ||
          key === 'c' || key === 'C' || e.keyCode === 67
        ) {
          e.preventDefault();
          e.stopPropagation();
          return false;
        }
      }

      // 禁用 Ctrl+U (查看源代码)
      if (e.ctrlKey && e.key.toLowerCase() === "u") {
        e.preventDefault();
        return false;
      }
    };

    // 禁用右键菜单 (但在输入框中允许，以便复制粘贴)
    const handleContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // 检查点击目标是否为输入框、文本域或可编辑元素
      const isEditable = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;

      // 如果不是可编辑区域，则阻止右键菜单
      if (!isEditable) {
        e.preventDefault();
        return false;
      }
      // 如果是可编辑区域，允许右键菜单（Copy/Paste）
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("contextmenu", handleContextMenu);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("contextmenu", handleContextMenu);
    };
  }, []);
  const [isConnected, setIsConnected] = useState(false);
  const [botProfile, setBotProfile] = useState<BotProfile | null>(null);

  const [tokenInput, setTokenInput] = useState("");
  const [userIdInput, setUserIdInput] = useState("");
  const [targetChatId, setTargetChatId] = useState("");

  const [loading, setLoading] = useState(false);
  const [useProxy, setUseProxy] = useState(false);
  const [autoReplyRules, setAutoReplyRules] = useState<AutoReplyRule[]>([]);

  const [isMonitoring, setIsMonitoring] = useState(false);
  const [webhookInfo, setWebhookInfo] = useState<any>(null);
  const [knownUsers, setKnownUsers] = useState<UserStat[]>([]);

  const [menuPages, setMenuPages] = useState<MenuPage[]>([
    {
      id: "main",
      name: t('km.keyboard.mainMenu'),
      rows: [
        [
          { text: t('km.default.productList'), actionType: "navigate", actionValue: "products" },
          { text: t('km.default.contactSupport'), actionType: "text" },
        ],
      ],
    },
    {
      id: "products",
      name: t('km.keyboard.productList'),
      rows: [
        [
          { text: t('km.default.softwareProducts'), actionType: "text" },
          { text: t('km.default.hardwareProducts'), actionType: "text" },
        ],
        [{ text: t('km.default.back'), actionType: "navigate", actionValue: "main" }],
      ],
    },
  ]);

  const [commands, setCommands] = useState<BotCommand[]>([
    { command: "start", description: t('km.default.start') },
    { command: "help", description: t('km.default.help') },
  ]);

  const showToast = (type: "success" | "error" | "info", message: string) => {
    if (type === "success") toast.success(message);
    else if (type === "error") toast.error(message);
    else toast.info(message);
  };

  const callTelegramApi = async (
    token: string,
    method: string,
    body: any,
    signal?: AbortSignal,
    proxy: boolean = true,
  ) => {
    const baseUrl = `https://api.telegram.org/bot${token}/${method}?t=${Date.now()}`;
    const url = proxy ? `https://corsproxy.io/?${encodeURIComponent(baseUrl)}` : baseUrl;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: signal,
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errText}`);
      }

      const data = await response.json();
      if (!data.ok) throw new Error(data.description || "API Request Failed");
      return data.result;
    } catch (error: any) {
      if (error.message && error.message.includes("Failed to fetch")) {
        throw new Error(t('km.settings.networkFailed'));
      }
      throw error;
    }
  };

  // --- 持久化 & 自动重连逻辑 ---
  const getStorageKey = (key: string, token?: string) => {
    const t = token || tokenInput;
    if (!t) return `keyboard_menu_${key}`;
    const tokenSuffix = t.slice(-8);
    return `keyboard_menu_${key}_${tokenSuffix}`;
  };

  useEffect(() => {
    const savedToken = localStorage.getItem("keyboard_menu_token");
    const savedUser = savedToken ? localStorage.getItem(getStorageKey("userid", savedToken)) : null;

    if (savedToken) {
      setTokenInput(savedToken);
      handleConnect(savedToken, savedUser || "");
      if (savedUser) {
        setUserIdInput(savedUser);
        setTargetChatId(savedUser);
      }
      const savedUsers = localStorage.getItem(getStorageKey("users", savedToken));
      if (savedUsers) {
        try {
          setKnownUsers(JSON.parse(savedUsers));
        } catch (e) {}
      }
    } else {
      // 没有保存的token时，尝试从bot_activations同步（双向聊天添加的机器人自动连接）
      (async () => {
        try {
          const { data: { user: currentUser } } = await supabase.auth.getUser();
          if (!currentUser) return;
          
          const { data: bots } = await supabase
            .from('bot_activations')
            .select('bot_token, personal_user_id')
            .eq('user_id', currentUser.id)
            .order('created_at', { ascending: false })
            .limit(1);
          
          if (bots && bots.length > 0) {
            const bot = bots[0];
            setTokenInput(bot.bot_token);
            if (bot.personal_user_id) {
              setUserIdInput(bot.personal_user_id);
              setTargetChatId(bot.personal_user_id);
            }
            handleConnect(bot.bot_token, bot.personal_user_id || "");
          }
        } catch (e) {
          console.warn('[KeyboardMenu] Auto-sync from bot_activations failed:', e);
        }
      })();
    }
  }, []);

  useEffect(() => {
    if (tokenInput) {
      localStorage.setItem("keyboard_menu_token", tokenInput);
      if (userIdInput) localStorage.setItem(getStorageKey("userid", tokenInput), userIdInput);
    }
  }, [tokenInput, userIdInput]);

  useEffect(() => {
    if (knownUsers.length > 0 && tokenInput) {
      localStorage.setItem(getStorageKey("users", tokenInput), JSON.stringify(knownUsers));
    }
  }, [knownUsers, tokenInput]);

  const checkWebhookStatus = async (token: string) => {
    try {
      const info = await callTelegramApi(token, "getWebhookInfo", {}, undefined, useProxy);
      setWebhookInfo(info);
      if (info && info.url) {
        localStorage.setItem("keyboard_menu_saved_webhook", info.url);
      }
      return info;
    } catch (e) {
      console.error("Check webhook failed", e);
      return null;
    }
  };

  const handleConnect = async (tokenOverride?: string, userOverride?: string) => {
    const token = tokenOverride || tokenInput;
    if (!token.trim()) return;
    setLoading(true);
    try {
      const profile = await callTelegramApi(token, "getMe", {}, undefined, useProxy);
      setBotProfile({ ...profile, token: token });
      const userId = userOverride || userIdInput;
      if (userId.trim()) setTargetChatId(userId.trim());

      setIsConnected(true);
      checkWebhookStatus(token);

      if (!tokenOverride) showToast("success", `${t('km.settings.connected')}: ${profile.first_name}`);
    } catch (err: any) {
      if (!tokenOverride) showToast("error", t('km.settings.connectFailed') + ": " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setIsConnected(false);
    setIsMonitoring(false);
    setBotProfile(null);
    setTokenInput("");
    setUserIdInput("");
    setTargetChatId("");
    setWebhookInfo(null);
    // 重置根组件中的配置状态，防止数据泄漏到下一个机器人
    setAutoReplyRules([]);
    setKnownUsers([]);
    setCommands([
      { command: "start", description: t('km.default.start') },
      { command: "help", description: t('km.default.help') },
    ]);
    setMenuPages([
      {
        id: "main",
        name: t('km.keyboard.mainMenu'),
        rows: [
          [
            { text: t('km.default.productList'), actionType: "navigate", actionValue: "products" },
            { text: t('km.default.contactSupport'), actionType: "text" },
          ],
        ],
      },
      {
        id: "products",
        name: t('km.keyboard.productList'),
        rows: [
          [
            { text: t('km.default.softwareProducts'), actionType: "text" },
            { text: t('km.default.hardwareProducts'), actionType: "text" },
          ],
          [{ text: t('km.default.back'), actionType: "navigate", actionValue: "main" }],
        ],
      },
    ]);
    localStorage.removeItem("keyboard_menu_token");
    localStorage.removeItem("keyboard_menu_userid");
    showToast("info", t('km.settings.disconnected'));
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <Workspace
        isConnected={isConnected}
        botProfile={botProfile}
        tokenInput={tokenInput}
        setTokenInput={setTokenInput}
        userIdInput={userIdInput}
        setUserIdInput={setUserIdInput}
        targetChatId={targetChatId}
        setTargetChatId={setTargetChatId}
        loading={loading}
        onConnect={() => handleConnect()}
        onLogout={handleLogout}
        useProxy={useProxy}
        setUseProxy={setUseProxy}
        autoReplyRules={autoReplyRules}
        setAutoReplyRules={setAutoReplyRules}
        showToast={showToast}
        callApi={(method: string, body: any) =>
          callTelegramApi(botProfile?.token || tokenInput, method, body, undefined, useProxy)
        }
        isMonitoring={isMonitoring}
        setIsMonitoring={setIsMonitoring}
        knownUsers={knownUsers}
        setKnownUsers={setKnownUsers}
        webhookInfo={webhookInfo}
        refreshWebhook={() => checkWebhookStatus(botProfile?.token || tokenInput)}
        menuPages={menuPages}
        setMenuPages={setMenuPages}
        commands={commands}
        setCommands={setCommands}
      />
    </div>
  );
}

// --- Sidebar Item ---
function SidebarItem({ icon, label, active, onClick, notification }: any) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all relative ${active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
    >
      {icon}
      <span>{label}</span>
      {notification && <span className="absolute right-3 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>}
    </button>
  );
}

// --- Demo Bot Button ---
function DemoBotButton() {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    supabase.from('articles').select('content').eq('title', '__SYSTEM_DEMO_BOT_URL__').maybeSingle().then(({ data }) => {
      if (data?.content) setUrl(data.content);
    });
  }, []);
  if (!url) return null;
  return (
    <button
      onClick={() => window.open(url, '_blank')}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-muted-foreground hover:text-foreground hover:bg-muted"
    >
      <Bot size={18} />
      <span>示范机器人</span>
      <ExternalLink size={14} className="ml-auto opacity-50" />
    </button>
  );
}

// --- Main Workspace ---
function Workspace({
  isConnected,
  botProfile,
  tokenInput,
  setTokenInput,
  userIdInput,
  setUserIdInput,
  targetChatId,
  setTargetChatId,
  loading,
  onConnect,
  onLogout,
  useProxy,
  setUseProxy,
  autoReplyRules,
  setAutoReplyRules,
  showToast,
  callApi,
  isMonitoring,
  setIsMonitoring,
  knownUsers,
  setKnownUsers,
  webhookInfo,
  refreshWebhook,
  menuPages,
  setMenuPages,
  commands,
  setCommands,
}: any) {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<"message" | "keyboard" | "commands" | "settings" | "users" | "shop" | "guide" | "botDescription">("settings");
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [simulatorVisible, setSimulatorVisible] = useState(false);

  const defaultFlowMsgId = uuid();
  const [flowMessages, setFlowMessages] = useState<MessageData[]>([
    { id: defaultFlowMsgId, label: "/start", type: "text", content: "", inlineKeyboard: [], disableWebPagePreview: false },
  ]);
  const [activeFlowMsgId, setActiveFlowMsgId] = useState<string>(defaultFlowMsgId);
  const [restorableWebhook, setRestorableWebhook] = useState<string | null>(null);
  const [isSyncingToCloud, setIsSyncingToCloud] = useState(false);
  const [cloudSyncStatus, setCloudSyncStatus] = useState<"idle" | "synced" | "error">("idle");
  const [forceMenuOnStart, setForceMenuOnStart] = useState(false);
  const [activityLogEnabled, setActivityLogEnabled] = useState(true);
  const [bilingualButtonEnabled, setBilingualButtonEnabled] = useState(false);
  const [chatStartEnabled, setChatStartEnabled] = useState(true);
  const [keyboardStartEnabled, setKeyboardStartEnabled] = useState(true);
  const [autoCleanupEnabled, setAutoCleanupEnabled] = useState(false);
  const [autoCleanupDays, setAutoCleanupDays] = useState(0);
  const [rateLimitEnabled, setRateLimitEnabled] = useState(true);
  const [rateLimitPerMinute, setRateLimitPerMinute] = useState(10);
  // 机器人介绍（搜索/未点开始前显示）
  const [botDescriptionEnabled, setBotDescriptionEnabled] = useState(false);
  const [botDescriptionText, setBotDescriptionText] = useState("");
  const [botShortDescriptionText, setBotShortDescriptionText] = useState("");

  // Keyboard menu trial status
  const [keyboardTrialExpired, setKeyboardTrialExpired] = useState(false);
  const [keyboardTrialChecked, setKeyboardTrialChecked] = useState(false);
  
  // Save switch states before expiration for restoration after activation
  const savedSettingsRef = useRef<{ activityLogEnabled: boolean; bilingualButtonEnabled: boolean } | null>(null);

  // 检查键盘菜单试用状态 - 从 keyboard_configs 表独立获取
  const checkKeyboardTrialStatus = async (token: string) => {
    try {
      // 从 keyboard_configs 表获取独立的试用/激活状态
      const { data: keyboardConfig } = await supabase
        .from("keyboard_configs")
        .select("keyboard_trial_started_at, keyboard_expire_at, activity_log_enabled, bilingual_button_enabled")
        .eq("bot_token", token)
        .maybeSingle();

      const now = new Date();
      let isExpired = false;

      // 检查是否有激活有效期
      if (keyboardConfig?.keyboard_expire_at) {
        const keyboardExpireAt = new Date(keyboardConfig.keyboard_expire_at);
        if (keyboardExpireAt > now) {
          // 有效期内 - 检查是否需要恢复设置
          if (savedSettingsRef.current) {
            setActivityLogEnabled(savedSettingsRef.current.activityLogEnabled);
            setBilingualButtonEnabled(savedSettingsRef.current.bilingualButtonEnabled);
            savedSettingsRef.current = null;
          }
          setKeyboardTrialExpired(false);
          setKeyboardTrialChecked(true);
          return;
        } else {
          isExpired = true;
        }
      }

      // 检查试用状态
      if (!isExpired && keyboardConfig?.keyboard_trial_started_at) {
        const firstUsedAt = new Date(keyboardConfig.keyboard_trial_started_at);
        const trialExpireAt = new Date(firstUsedAt.getTime() + 24 * 60 * 60 * 1000); // 24小时
        if (now > trialExpireAt) {
          isExpired = true;
        } else {
          setKeyboardTrialExpired(false);
          setKeyboardTrialChecked(true);
          return;
        }
      }

      // 已过期 - 保存当前设置并自动关闭开关
      if (isExpired) {
        // 只保存一次，避免覆盖
        if (!savedSettingsRef.current) {
          savedSettingsRef.current = {
            activityLogEnabled: keyboardConfig?.activity_log_enabled ?? activityLogEnabled,
            bilingualButtonEnabled: keyboardConfig?.bilingual_button_enabled ?? bilingualButtonEnabled,
          };
        }
        // 自动关闭活动记录和双语按钮
        setActivityLogEnabled(false);
        setBilingualButtonEnabled(false);
        setKeyboardTrialExpired(true);
        setKeyboardTrialChecked(true);
        return;
      }

      // 没有任何记录时，创建试用记录
      const nowIso = new Date().toISOString();
      await supabase.from("keyboard_configs").upsert(
        {
          bot_token: token,
          keyboard_trial_started_at: nowIso,
          updated_at: nowIso,
        } as any,
        { onConflict: "bot_token" },
      );
      setKeyboardTrialExpired(false);
      setKeyboardTrialChecked(true);
    } catch (error) {
      console.error("Check keyboard trial status failed:", error);
      setKeyboardTrialChecked(true);
    }
  };

  const handleActivationStatusChange = () => {
    if (botProfile?.token) {
      checkKeyboardTrialStatus(botProfile.token);
    }
  };

  useEffect(() => {
    if (isConnected && botProfile?.token) {
      checkKeyboardTrialStatus(botProfile.token);
    } else {
      setKeyboardTrialChecked(false);
      setKeyboardTrialExpired(false);
    }
  }, [isConnected, botProfile?.token]);

  const showTrialExpiredToast = () => {
    showToast("error", t('km.settings.trialExpired'));
  };

  const lastPersistedActivityLogRef = useRef<boolean | null>(null);
  useEffect(() => {
    if (!botProfile?.token) return;
    if (lastPersistedActivityLogRef.current === activityLogEnabled) return;

    lastPersistedActivityLogRef.current = activityLogEnabled;

    (async () => {
      try {
        const { error } = await supabase.from("keyboard_configs").upsert(
          {
            bot_token: botProfile.token,
            bot_username: botProfile.username,
            bot_first_name: botProfile.first_name,
            activity_log_enabled: activityLogEnabled,
            updated_at: new Date().toISOString(),
          } as any,
          { onConflict: "bot_token" },
        );

        if (error) throw error;
        setCloudSyncStatus("synced");
      } catch (e) {
        console.error("Auto-save activity_log_enabled failed:", e);
        setCloudSyncStatus("error");
      }
    })();
  }, [activityLogEnabled, botProfile?.token]);

  const isInitialLoadRef = useRef(true);
  const autoSyncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const syncConfigToCloudSilent = async () => {
    if (!botProfile?.token) return;

    try {
      const menuAdminId = targetChatId ? parseInt(targetChatId) || null : null;

      const { data: existing } = await supabase
        .from("keyboard_configs")
        .select("id")
        .eq("bot_token", botProfile.token)
        .maybeSingle();

      const configPayload = {
        bot_token: botProfile.token,
        bot_username: botProfile.username,
        bot_first_name: botProfile.first_name,
        reply_keyboard: menuPages as any,
        auto_reply_rules: autoReplyRules as any,
        flow_messages: flowMessages as any,
        commands: commands as any,
        force_menu_on_start: forceMenuOnStart,
        activity_log_enabled: activityLogEnabled,
        bilingual_button_enabled: bilingualButtonEnabled,
        auto_cleanup_enabled: autoCleanupEnabled,
        auto_cleanup_days: autoCleanupDays,
        menu_admin_chat_id: menuAdminId,
        chat_start_enabled: chatStartEnabled,
        keyboard_start_enabled: keyboardStartEnabled,
        rate_limit_enabled: rateLimitEnabled,
        rate_limit_per_minute: rateLimitPerMinute,
        bot_description_enabled: botDescriptionEnabled,
        bot_description_text: botDescriptionText,
        bot_short_description_text: botShortDescriptionText,
        updated_at: new Date().toISOString(),
      };

      let error;
      if (existing) {
        const result = await supabase
          .from("keyboard_configs")
          .update(configPayload as any)
          .eq("bot_token", botProfile.token);
        error = result.error;
      } else {
        const result = await supabase.from("keyboard_configs").insert(configPayload as any);
        error = result.error;
      }

      if (error) throw error;

      // 确保该机器人也会出现在管理员后台机器人列表（管理员列表基于 bot_activations）
      try {
        await supabase.functions.invoke('manage-bot', {
          body: {
            action: 'ensure-bot-listing',
            botToken: botProfile.token,
            personalUserId: (targetChatId || userIdInput || '').toString(),
          }
        });
      } catch (e) {
        console.warn('[AutoSync] ensure-bot-listing failed (ignored):', e);
      }

      setCloudSyncStatus("synced");
      console.log("[AutoSync] Configuration synced to cloud successfully");
    } catch (error: any) {
      console.error("[AutoSync] Sync failed:", error);
      setCloudSyncStatus("error");
    }
  };

  useEffect(() => {
    if (isInitialLoadRef.current) return;
    if (!botProfile?.token) return;

    if (autoSyncTimeoutRef.current) {
      clearTimeout(autoSyncTimeoutRef.current);
    }

    autoSyncTimeoutRef.current = setTimeout(() => {
      syncConfigToCloudSilent();
    }, 500);

    return () => {
      if (autoSyncTimeoutRef.current) {
        clearTimeout(autoSyncTimeoutRef.current);
      }
    };
  }, [
    menuPages,
    autoReplyRules,
    flowMessages,
    commands,
    forceMenuOnStart,
    activityLogEnabled,
    bilingualButtonEnabled,
    autoCleanupEnabled,
    autoCleanupDays,
    targetChatId,
    rateLimitEnabled,
    rateLimitPerMinute,
    botDescriptionEnabled,
    botDescriptionText,
    botShortDescriptionText,
    botProfile?.token,
  ]);

  const syncConfigToCloud = async () => {
    if (!botProfile?.token) {
      showToast("error", t('km.settings.connectFirst'));
      return;
    }

    setIsSyncingToCloud(true);
    try {
      const menuAdminId = targetChatId ? parseInt(targetChatId) || null : null;

      const { data: existing } = await supabase
        .from("keyboard_configs")
        .select("id")
        .eq("bot_token", botProfile.token)
        .maybeSingle();

      const configPayload = {
        bot_token: botProfile.token,
        bot_username: botProfile.username,
        bot_first_name: botProfile.first_name,
        reply_keyboard: menuPages as any,
        auto_reply_rules: autoReplyRules as any,
        flow_messages: flowMessages as any,
        commands: commands as any,
        force_menu_on_start: forceMenuOnStart,
        activity_log_enabled: activityLogEnabled,
        bilingual_button_enabled: bilingualButtonEnabled,
        auto_cleanup_enabled: autoCleanupEnabled,
        auto_cleanup_days: autoCleanupDays,
        menu_admin_chat_id: menuAdminId,
        chat_start_enabled: chatStartEnabled,
        keyboard_start_enabled: keyboardStartEnabled,
        rate_limit_enabled: rateLimitEnabled,
        rate_limit_per_minute: rateLimitPerMinute,
        bot_description_enabled: botDescriptionEnabled,
        bot_description_text: botDescriptionText,
        bot_short_description_text: botShortDescriptionText,
        updated_at: new Date().toISOString(),
      };

      let error;
      if (existing) {
        const result = await supabase
          .from("keyboard_configs")
          .update(configPayload as any)
          .eq("bot_token", botProfile.token);
        error = result.error;
      } else {
        const result = await supabase.from("keyboard_configs").insert(configPayload as any);
        error = result.error;
      }

      if (error) throw error;

      setCloudSyncStatus("synced");
      showToast("success", t('km.settings.configSynced'));
    } catch (error: any) {
      console.error("Sync to cloud failed:", error);
      setCloudSyncStatus("error");
      showToast("error", t('km.settings.syncFailed') + ": " + error.message);
    } finally {
      setIsSyncingToCloud(false);
    }
  };

  const loadConfigFromCloud = async (token: string) => {
    isInitialLoadRef.current = true;

    // 重置所有配置状态到默认值，确保机器人数据隔离
    const defaultMenuPages: MenuPage[] = [
      {
        id: "main",
        name: t('km.keyboard.mainMenu'),
        rows: [
          [
            { text: t('km.default.productList'), actionType: "navigate", actionValue: "products" },
            { text: t('km.default.contactSupport'), actionType: "text" },
          ],
        ],
      },
      {
        id: "products",
        name: t('km.keyboard.productList'),
        rows: [
          [
            { text: t('km.default.softwareProducts'), actionType: "text" },
            { text: t('km.default.hardwareProducts'), actionType: "text" },
          ],
          [{ text: t('km.default.back'), actionType: "navigate", actionValue: "main" }],
        ],
      },
    ];
    setMenuPages(defaultMenuPages);
    setAutoReplyRules([]);
    setFlowMessages([]);
    setActiveFlowMsgId('');
    setCommands([
      { command: "start", description: t('km.default.start') },
      { command: "help", description: t('km.default.help') },
    ]);
    setForceMenuOnStart(true);
    setActivityLogEnabled(true);
    setBilingualButtonEnabled(false);
    setAutoCleanupEnabled(false);
    setAutoCleanupDays(0);
    setChatStartEnabled(true);
    setKeyboardStartEnabled(true);
    setRateLimitEnabled(true);
    setRateLimitPerMinute(10);
    setBotDescriptionEnabled(false);
    setBotDescriptionText("");
    setBotShortDescriptionText("");
    setCloudSyncStatus("idle");

    try {
      const { data, error } = await supabase.from("keyboard_configs").select("*").eq("bot_token", token).maybeSingle();

      if (error) throw error;

      if (data) {
        if (data.reply_keyboard && Array.isArray(data.reply_keyboard) && (data.reply_keyboard as any[]).length > 0) setMenuPages(data.reply_keyboard as any);
        if (data.auto_reply_rules && Array.isArray(data.auto_reply_rules)) setAutoReplyRules(data.auto_reply_rules as any);
        if (data.flow_messages && Array.isArray(data.flow_messages) && (data.flow_messages as any[]).length > 0) {
          setFlowMessages(data.flow_messages as any);
          setActiveFlowMsgId((data.flow_messages as any)[0]?.id || '');
        }
        if (data.commands && Array.isArray(data.commands)) setCommands(data.commands as any);
        if (data.force_menu_on_start !== null) setForceMenuOnStart(data.force_menu_on_start);
        if (data.activity_log_enabled !== null && data.activity_log_enabled !== undefined)
          setActivityLogEnabled(data.activity_log_enabled);
        if (data.bilingual_button_enabled !== null && data.bilingual_button_enabled !== undefined)
          setBilingualButtonEnabled(data.bilingual_button_enabled);
        if ((data as any).auto_cleanup_enabled !== null && (data as any).auto_cleanup_enabled !== undefined)
          setAutoCleanupEnabled((data as any).auto_cleanup_enabled);
        if ((data as any).auto_cleanup_days !== null && (data as any).auto_cleanup_days !== undefined)
          setAutoCleanupDays((data as any).auto_cleanup_days);
        if ((data as any).chat_start_enabled !== null && (data as any).chat_start_enabled !== undefined)
          setChatStartEnabled((data as any).chat_start_enabled);
        if ((data as any).keyboard_start_enabled !== null && (data as any).keyboard_start_enabled !== undefined)
          setKeyboardStartEnabled((data as any).keyboard_start_enabled);
        if ((data as any).rate_limit_enabled !== null && (data as any).rate_limit_enabled !== undefined)
          setRateLimitEnabled((data as any).rate_limit_enabled);
        if ((data as any).rate_limit_per_minute !== null && (data as any).rate_limit_per_minute !== undefined)
          setRateLimitPerMinute((data as any).rate_limit_per_minute);
        if ((data as any).bot_description_enabled !== null && (data as any).bot_description_enabled !== undefined)
          setBotDescriptionEnabled((data as any).bot_description_enabled);
        if ((data as any).bot_description_text !== null && (data as any).bot_description_text !== undefined)
          setBotDescriptionText((data as any).bot_description_text);
        if ((data as any).bot_short_description_text !== null && (data as any).bot_short_description_text !== undefined)
          setBotShortDescriptionText((data as any).bot_short_description_text);
        setCloudSyncStatus("synced");
        showToast("success", t('km.settings.configLoaded'));
      } else {
        showToast("info", t('km.settings.noCloudConfig') || '该机器人暂无云端配置，已使用默认配置');
      }

      // 连接机器人后立即确保机器人出现在管理员后台列表
      try {
        await supabase.functions.invoke('manage-bot', {
          body: {
            action: 'ensure-bot-listing',
            botToken: token,
            personalUserId: (targetChatId || userIdInput || '').toString(),
          }
        });
        console.log('[KeyboardMenu] ensure-bot-listing called on connect');
      } catch (e) {
        console.warn('[KeyboardMenu] ensure-bot-listing failed (ignored):', e);
      }

      setTimeout(() => {
        isInitialLoadRef.current = false;
      }, 1000);
    } catch (error: any) {
      console.error("Load from cloud failed:", error);
      setTimeout(() => {
        isInitialLoadRef.current = false;
      }, 1000);
    }
  };

  useEffect(() => {
    if (isConnected && botProfile?.token) {
      loadConfigFromCloud(botProfile.token);
    }
  }, [isConnected, botProfile?.token]);

  const handleToggleMonitoring = async () => {
    if (isMonitoring) {
      setIsMonitoring(false);
      const urlToRestore = restorableWebhook || localStorage.getItem("keyboard_menu_saved_webhook");
      if (urlToRestore) {
      try {
        await callApi("setWebhook", { url: urlToRestore });
        showToast("success", t('km.toast.webhookRestored'));
        refreshWebhook();
      } catch (e: any) {
        showToast("error", `${t('km.toast.webhookRestoreFailed')}: ${e.message}`);
      }
      setRestorableWebhook(null);
    } else {
      showToast("info", t('km.toast.listenClosed'));
      refreshWebhook();
    }
  } else {
    try {
        const info = await callApi("getWebhookInfo", {});
      if (info && info.url) {
        setRestorableWebhook(info.url);
        localStorage.setItem("keyboard_menu_saved_webhook", info.url);
        await callApi("deleteWebhook", { drop_pending_updates: true });
        showToast("success", t('km.toast.webhookBackupSuccess'));
      } else {
        const cached = localStorage.getItem("keyboard_menu_saved_webhook");
        if (cached) {
          setRestorableWebhook(cached);
          showToast("success", t('km.toast.safeListenOnWithBackup'));
        } else {
          showToast("success", t('km.toast.safeListenOn'));
        }
        await callApi("deleteWebhook", { drop_pending_updates: true });
      }
      setIsMonitoring(true);
        refreshWebhook();
    } catch (e: any) {
      showToast("error", `${t('km.toast.startFailed')}: ${e.message}`);
      setIsMonitoring(false);
    }
  }
};

  const rulesRef = useRef(autoReplyRules);
  useEffect(() => {
    rulesRef.current = autoReplyRules;
  }, [autoReplyRules]);

  const menuPagesRef = useRef(menuPages);
  useEffect(() => {
    menuPagesRef.current = menuPages;
  }, [menuPages]);

  const offsetRef = useRef(0);
  const monitorIntervalRef = useRef<any>(null);

  useEffect(() => {
    if (isConnected && isMonitoring) {
      const poll = async () => {
        try {
          const updates = await callApi("getUpdates", {
            offset: offsetRef.current,
            timeout: 2,
            limit: 10,
            allowed_updates: ["message", "callback_query"],
          });

          if (updates && Array.isArray(updates)) {
            updates.forEach(async (u: any) => {
              offsetRef.current = u.update_id + 1;

              const msg = u.message || u.callback_query?.message;
              const from = u.message?.from || u.callback_query?.from;
              const text = u.message?.text || u.callback_query?.data;
              const chatId = u.message?.chat?.id || u.callback_query?.message?.chat?.id;

              if (from) {
                setKnownUsers((prev: UserStat[]) => {
                  const exists = prev.find((user) => user.id === from.id);
                  const now = Date.now();
                  if (exists) {
                    return prev.map((user) =>
                      user.id === from.id
                        ? { ...user, last_seen: now, first_name: from.first_name, username: from.username }
                        : user,
                    );
                  } else {
                    return [
                      ...prev,
                      {
                        id: from.id,
                        first_name: from.first_name,
                        username: from.username,
                        last_seen: now,
                        joined_at: now,
                      },
                    ];
                  }
                });
              }

              if (text && chatId) {
                setChatHistory((prev) => [
                  ...prev,
                  {
                    id: uuid(),
                    sender: "user",
                    type: "text",
                    content: `[${from?.first_name}] ${text}`,
                    timestamp: getCurrentTime(),
                  },
                ]);

                const textNorm = text.trim().toLowerCase();
                let responseHandled = false;

                // Menu Navigation
                if (!responseHandled) {
                  for (const page of menuPagesRef.current) {
                    for (const row of page.rows) {
                      for (const btn of row) {
                        if (btn.text.toLowerCase() === textNorm && btn.actionType === "navigate" && btn.actionValue) {
                          const targetPage = menuPagesRef.current.find((p: MenuPage) => p.id === btn.actionValue);
                          if (targetPage) {
                            try {
                              await callApi("sendMessage", {
                                chat_id: chatId,
                                text: `📂 切换菜单: ${targetPage.name}`,
                                reply_markup: {
                                  keyboard: targetPage.rows.map((r: ReplyButton[]) =>
                                    r.map((b: ReplyButton) => ({ text: b.text })),
                                  ),
                                  resize_keyboard: true,
                                  one_time_keyboard: false,
                                },
                              });
                              responseHandled = true;
                              showToast("success", `已为用户切换至: ${targetPage.name}`);
                            } catch (e) {
                              console.error("Navigation failed", e);
                            }
                          }
                        }
                        if (responseHandled) break;
                      }
                      if (responseHandled) break;
                    }
                    if (responseHandled) break;
                  }
                }

                // Auto Reply
                if (!responseHandled) {
                  const matchedRule = rulesRef.current.find((r: AutoReplyRule) => {
                    const ruleVal = r.triggerValue.toLowerCase();
                    const cleanText = textNorm.replace(/^\//, "");
                    const cleanRule = ruleVal.replace(/^\//, "");
                    return cleanText === cleanRule;
                  });

                  if (matchedRule) {
                    for (const reply of matchedRule.replyMessages) {
                      const body: any = { chat_id: chatId, parse_mode: "HTML" };
                      if (reply.disableWebPagePreview) body.disable_web_page_preview = true;
                      if (reply.inlineKeyboard && reply.inlineKeyboard.length > 0) {
                        body.reply_markup = {
                          inline_keyboard: reply.inlineKeyboard.map((row: InlineButton[]) =>
                            row.map((btn: InlineButton) => ({ text: btn.text, [btn.type]: btn.value })),
                          ),
                        };
                      }
                      try {
                        if (reply.type === "photo") {
                          body.photo = reply.mediaUrl;
                          body.caption = reply.content;
                          await callApi("sendPhoto", body);
                        } else if (reply.type === "video") {
                          // 修改：添加视频发送支持
                          body.video = reply.mediaUrl;
                          body.caption = reply.content;
                          await callApi("sendVideo", body);
                        } else {
                          body.text = reply.content;
                          await callApi("sendMessage", body);
                        }
                        responseHandled = true;
                      } catch (e) {
                        console.error("Auto-reply failed", e);
                      }
                    }
                  }
                }

                // Forward to admin
                if (targetChatId) {
                  const safeText = escapeHtml(text);
                  const safeName = escapeHtml(from?.first_name || "Unknown");
                  callApi("sendMessage", {
                    chat_id: targetChatId,
                    text: `🔔 <b>用户活动捕获</b>\n\n👤 用户: ${safeName} (ID: ${from?.id})\n💬 内容: ${safeText}\n${responseHandled ? "✅ 已自动处理" : "⚠️ 未匹配规则"}`,
                    parse_mode: "HTML",
                    reply_markup: { inline_keyboard: [[{ text: `💬 发起私聊`, url: `tg://user?id=${from?.id}` }]] },
                  }).catch(() => {});
                }
              }
            });
          }
        } catch (err: any) {
          if (err.message && (err.message.includes("409") || err.message.includes("Conflict"))) {
            try {
              callApi("deleteWebhook", { drop_pending_updates: true });
            } catch (ignore) {}
          }
        }
      };
      monitorIntervalRef.current = setInterval(poll, 3000);
    } else {
      if (monitorIntervalRef.current) clearInterval(monitorIntervalRef.current);
    }
    return () => {
      if (monitorIntervalRef.current) clearInterval(monitorIntervalRef.current);
    };
  }, [isConnected, isMonitoring, targetChatId]);

  const handleExportConfig = async () => {
    const config: AppConfig = {
      version: APP_VERSION,
      timestamp: Date.now(),
      tokenInput,
      targetChatId,
      commands,
      menuPages,
      autoReplyRules,
      flowMessages,
      knownUsers,
    };

    // 从数据库获取TG商城配置、商品、订单、余额、流水
    if (tokenInput) {
      try {
        const [shopConfigRes, shopProductsRes, shopOrdersRes, shopUserBalancesRes, shopBalanceTxRes, articlesRes] = await Promise.all([
          supabase.from('shop_configs').select('*').eq('bot_token', tokenInput).maybeSingle(),
          supabase.from('shop_products').select('*').eq('bot_token', tokenInput),
          supabase.from('shop_orders').select('*').eq('bot_token', tokenInput),
          supabase.from('shop_user_balances').select('*').eq('bot_token', tokenInput),
          supabase.from('shop_balance_transactions').select('*').eq('bot_token', tokenInput),
          supabase.from('articles').select('*'),
        ]);
        if (shopConfigRes.data) config.shopConfig = shopConfigRes.data;
        if (shopProductsRes.data) config.shopProducts = shopProductsRes.data;
        if (shopOrdersRes.data) config.shopOrders = shopOrdersRes.data;
        if (shopUserBalancesRes.data) config.shopUserBalances = shopUserBalancesRes.data;
        if (shopBalanceTxRes.data) config.shopBalanceTransactions = shopBalanceTxRes.data;
        if (articlesRes.data) config.articles = articlesRes.data;
      } catch (e) {
        console.error('Export additional data failed:', e);
      }
    }

    const blob = new Blob([JSON.stringify(config, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `keyboard_config_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast("success", t('km.settings.configExported'));
  };

  const handleImportConfig = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const config = JSON.parse(event.target?.result as string) as AppConfig;
        if (config.tokenInput) setTokenInput(config.tokenInput);
        if (config.targetChatId) {
          setTargetChatId(config.targetChatId);
          setUserIdInput(config.targetChatId);
        }
        if (config.commands) setCommands(config.commands);
        if (config.menuPages) setMenuPages(config.menuPages);
        if (config.autoReplyRules) setAutoReplyRules(config.autoReplyRules);
        if (config.flowMessages && Array.isArray(config.flowMessages) && config.flowMessages.length > 0) {
          setFlowMessages(config.flowMessages);
          setActiveFlowMsgId(config.flowMessages[0]?.id || '');
        }
        if (config.knownUsers && Array.isArray(config.knownUsers)) {
          setKnownUsers(config.knownUsers);
          localStorage.setItem("keyboard_menu_users", JSON.stringify(config.knownUsers));
        }

        // 导入TG商城配置 - 使用当前连接的机器人token，而非导出文件中的token
        const importBotToken = tokenInput || config.tokenInput;
        if (importBotToken) {
          if (config.shopConfig) {
            const { id, created_at, updated_at, shop_expire_at, shop_trial_started_at, shop_saved_expire_at, ...shopData } = config.shopConfig;
            const { error: configErr } = await supabase.from('shop_configs').upsert(
              { ...shopData, bot_token: importBotToken },
              { onConflict: 'bot_token' }
            );
            if (configErr) console.error('[Import] shop_configs upsert error:', configErr);
          }
          if (config.shopProducts && config.shopProducts.length > 0) {
            // 先清除新机器人的旧商品（避免残留），再插入导入的商品
            await supabase.from('shop_products').delete().eq('bot_token', importBotToken);
            const productsToInsert = config.shopProducts.map((product: any) => {
              const { id, created_at, updated_at, ...productData } = product;
              return { ...productData, bot_token: importBotToken };
            });
            const { error: prodErr } = await supabase.from('shop_products').insert(productsToInsert);
            if (prodErr) console.error('[Import] shop_products insert error:', prodErr);
            else console.log(`[Import] Successfully imported ${productsToInsert.length} products for bot ${importBotToken.split(':')[0]}`);
          }
        }
        // 导入TG商城订单
        if (importBotToken && config.shopOrders && config.shopOrders.length > 0) {
          for (const order of config.shopOrders) {
            await supabase.from('shop_orders').upsert(
              { ...order, bot_token: importBotToken },
              { onConflict: 'id' }
            );
          }
        }
        // 导入TG商城用户余额
        if (importBotToken && config.shopUserBalances && config.shopUserBalances.length > 0) {
          for (const balance of config.shopUserBalances) {
            await supabase.from('shop_user_balances').upsert(
              { ...balance, bot_token: importBotToken },
              { onConflict: 'id' }
            );
          }
        }
        // 导入TG商城余额流水
        if (importBotToken && config.shopBalanceTransactions && config.shopBalanceTransactions.length > 0) {
          for (const tx of config.shopBalanceTransactions) {
            await supabase.from('shop_balance_transactions').upsert(
              { ...tx, bot_token: importBotToken },
              { onConflict: 'id' }
            );
          }
        }
        // 导入文章/配置说明
        if (config.articles && config.articles.length > 0) {
          for (const article of config.articles) {
            await supabase.from('articles').upsert(article, { onConflict: 'id' });
          }
        }

        showToast("success", t('km.settings.configImported'));
      } catch (err) {
        showToast("error", t('km.settings.configImportError'));
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  useEffect(() => {
    setChatHistory([{ id: uuid(), sender: "bot", type: "text", content: t('km.default.systemReady'), timestamp: getCurrentTime() }]);
  }, []);

  const handleSimulatorInteraction = (text: string) => {
    const userMsg: ChatMessage = {
      id: uuid(),
      sender: "user",
      type: "text",
      content: text,
      timestamp: getCurrentTime(),
    };
    setChatHistory((prev) => [...prev, userMsg]);

    const textNorm = text.trim().toLowerCase();
    let handled = false;

    for (const page of menuPages) {
      for (const row of page.rows) {
        for (const btn of row) {
          if (btn.text.toLowerCase() === textNorm && btn.actionType === "navigate" && btn.actionValue) {
            const targetPage = menuPages.find((p: MenuPage) => p.id === btn.actionValue);
          if (targetPage) {
            setChatHistory((prev) => [
              ...prev,
              {
                id: uuid(),
                sender: "bot",
                type: "text",
                content: `${t('km.default.simulateJump')}: ${targetPage.name}`,
                timestamp: getCurrentTime(),
              },
            ]);
            handled = true;
          }
          }
          if (handled) break;
        }
        if (handled) break;
      }
      if (handled) break;
    }

    if (!handled) {
      const rule = autoReplyRules.find((r: AutoReplyRule) => {
        if (r.triggerType === "keyword") return r.triggerValue.toLowerCase() === textNorm;
        if (r.triggerType === "command")
          return (
            r.triggerValue.toLowerCase() === textNorm.replace("/", "") ||
            "/" + r.triggerValue.toLowerCase() === textNorm
          );
        return false;
      });
      if (rule) {
        setTimeout(() => {
          const botResponses: ChatMessage[] = rule.replyMessages.map((m: MessageData) => ({
            id: uuid(),
            sender: "bot",
            type: m.type,
            content: m.content,
            mediaUrl: m.mediaUrl,
            inlineKeyboard: m.inlineKeyboard,
            timestamp: getCurrentTime(),
          }));
          setChatHistory((prev) => [...prev, ...botResponses]);
        }, 600);
      }
    }
  };

  const handleRealSend = async (msg: MessageData, chatId: string) => {
    if (!botProfile || !chatId) {
      showToast("error", t('km.message.notConnectedOrEmpty'));
      return;
    }
    setChatHistory((prev) => [
      ...prev,
      {
        id: uuid(),
        sender: "bot",
        type: msg.type,
        content: msg.content,
        mediaUrl: msg.mediaUrl,
        timestamp: getCurrentTime(),
        inlineKeyboard: msg.inlineKeyboard,
      },
    ]);
    try {
      const body: any = { chat_id: chatId, parse_mode: "HTML" };
      if (msg.disableWebPagePreview) body.disable_web_page_preview = true;
      if (msg.inlineKeyboard && msg.inlineKeyboard.length > 0) {
        body.reply_markup = {
          inline_keyboard: msg.inlineKeyboard.map((row: InlineButton[]) =>
            row.map((btn: InlineButton) => ({ text: btn.text, [btn.type]: btn.value })),
          ),
        };
      }
      if (msg.type === "photo") {
        body.photo = msg.mediaUrl;
        body.caption = msg.content;
        await callApi("sendPhoto", body);
      } else if (msg.type === "video") {
        // 修改：支持视频发送
        body.video = msg.mediaUrl;
        body.caption = msg.content;
        await callApi("sendVideo", body);
      } else {
        body.text = msg.content;
        await callApi("sendMessage", body);
      }
    } catch (e: any) {
      showToast("error", t('km.message.sendFailed') + ": " + e.message);
    }
  };

  const handleSendFlow = async (messages: MessageData[]) => {
    if (!targetChatId) {
      showToast("error", t('km.message.configUserIdFirst'));
      return;
    }
    for (const msg of messages) {
      await handleRealSend(msg, targetChatId);
      await new Promise((r) => setTimeout(r, 300));
    }
    showToast("success", `${t('km.message.sentMessages')} ${messages.length}`);
  };

  const handlePushMenu = async (userId: number, userName: string) => {
    const mainPage = menuPages.find((p: MenuPage) => p.id === "main");
    if (!mainPage) return;
    try {
      await callApi("sendMessage", {
        chat_id: userId,
        text: t('km.users.welcomeMenu'),
        reply_markup: {
          keyboard: mainPage.rows.map((row: ReplyButton[]) => row.map((btn: ReplyButton) => ({ text: btn.text }))),
          resize_keyboard: true,
        },
      });
      showToast("success", `${t('km.users.pushSuccess')}: ${userName}`);
    } catch (e: any) {
      showToast("error", `${t('km.users.pushFailed')}: ${e.message}`);
    }
  };

  return (
    <div className="flex h-[calc(100vh-3.5rem)] bg-muted overflow-hidden relative">
      {/* Mobile Sidebar Overlay */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setMobileSidebarOpen(false)} />
      )}

      {/* Mobile Header Bar */}
      <div className="fixed top-14 left-0 right-0 z-30 flex items-center gap-2 bg-card border-b px-3 py-2 md:hidden">
        <button onClick={() => setMobileSidebarOpen(true)} className="p-1.5 rounded-lg hover:bg-muted">
          <Menu size={20} />
        </button>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Bot size={16} className="text-primary shrink-0" />
          <span className="font-semibold text-sm truncate">{t('km.sidebar.title')}</span>
        </div>
      </div>

      {/* Sidebar */}
      <div className={`
        ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0 fixed md:relative z-50 md:z-auto
        w-[260px] md:w-[220px] bg-card border-r flex flex-col shrink-0
        h-[calc(100vh-3.5rem)] transition-transform duration-200
      `}>
        <div className="p-5 border-b flex items-center gap-3">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shadow-lg">
            <Bot className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="font-bold text-lg">{t('km.sidebar.title')}</span>
          <button onClick={() => setMobileSidebarOpen(false)} className="ml-auto p-1 rounded hover:bg-muted md:hidden">
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 px-3 py-6 space-y-2 overflow-y-auto">
          <SidebarItem
            icon={<Settings size={18} />}
            label={t('km.sidebar.idConnect')}
            active={activeTab === "settings"}
            onClick={() => {
              setActiveTab("settings");
              setMobileSidebarOpen(false);
              refreshWebhook();
            }}
            notification={!isConnected}
          />
          <SidebarItem
            icon={<MessageCircleQuestion size={18} />}
            label="机器人介绍"
            active={activeTab === "botDescription"}
            onClick={() => { setActiveTab("botDescription"); setMobileSidebarOpen(false); }}
          />
          <SidebarItem
            icon={<List size={18} />}
            label={t('km.sidebar.commandMgmt')}
            active={activeTab === "commands"}
            onClick={() => { setActiveTab("commands"); setMobileSidebarOpen(false); }}
          />
          <SidebarItem
            icon={<Layout size={18} />}
            label={t('km.sidebar.keyboardConfig')}
            active={activeTab === "keyboard"}
            onClick={() => { setActiveTab("keyboard"); setMobileSidebarOpen(false); }}
          />
          <SidebarItem
            icon={<Layers size={18} />}
            label={t('km.sidebar.messagePush')}
            active={activeTab === "message"}
            onClick={() => { setActiveTab("message"); setMobileSidebarOpen(false); }}
          />
          <SidebarItem
            icon={<Users size={18} />}
            label={t('km.sidebar.userData')}
            active={activeTab === "users"}
            onClick={() => { setActiveTab("users"); setMobileSidebarOpen(false); }}
          />
          
          {/* Separator */}
          <Separator className="my-4" />
          
          {/* TG Shop Entry */}
          <SidebarItem
            icon={<ShoppingCart size={18} />}
            label={t('km.sidebar.tgShop')}
            active={activeTab === "shop"}
            onClick={() => { setActiveTab("shop"); setMobileSidebarOpen(false); }}
          />
          <SidebarItem
            icon={<HelpCircle size={18} />}
            label={t('km.sidebar.configGuide')}
            active={activeTab === "guide"}
            onClick={() => { setActiveTab("guide"); setMobileSidebarOpen(false); }}
          />
          {/* 示范机器人按钮 */}
          <DemoBotButton />
        </nav>

        <div className="p-4 border-t space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleExportConfig}
              className="flex items-center justify-center gap-1.5 bg-muted hover:bg-accent text-foreground text-[10px] py-2 rounded-lg transition font-medium"
            >
              <Download size={12} /> {t('km.settings.exportConfig')}
            </button>
            <label className="flex items-center justify-center gap-1.5 bg-muted hover:bg-accent text-foreground text-[10px] py-2 rounded-lg transition cursor-pointer font-medium">
              <Upload size={12} /> {t('km.settings.importConfig')}
              <input type="file" accept=".json" onChange={handleImportConfig} className="hidden" />
            </label>
          </div>
        </div>

        {isConnected && (
          <div className="p-4 border-t">
            <div className="flex items-center gap-3">
              <div className="relative shrink-0">
                <div className="w-9 h-9 rounded-full bg-muted border flex items-center justify-center text-xs font-bold">
                  {botProfile?.first_name.substring(0, 1)}
                </div>
                <div className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-card bg-green-500"></div>
              </div>
              <div className="overflow-hidden flex-1">
                <h4 className="font-bold text-sm truncate">{botProfile?.first_name}</h4>
                <span className="text-xs text-muted-foreground truncate block">@{botProfile?.username}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden pt-12 md:pt-0">
        <div className="flex-1 p-3 md:p-6 overflow-y-auto">
          {activeTab === "settings" && (
            <SettingsPanel
              isConnected={isConnected}
              botProfile={botProfile}
              tokenInput={tokenInput}
              setTokenInput={setTokenInput}
              userIdInput={userIdInput}
              setUserIdInput={setUserIdInput}
              targetChatId={targetChatId}
              setTargetChatId={setTargetChatId}
              loading={loading}
              onConnect={onConnect}
              onLogout={onLogout}
              showToast={showToast}
              useProxy={useProxy}
              setUseProxy={setUseProxy}
              callApi={callApi}
              isMonitoring={isMonitoring}
              setIsMonitoring={setIsMonitoring}
              webhookInfo={webhookInfo}
              refreshWebhook={refreshWebhook}
              handleToggleMonitoring={handleToggleMonitoring}
              knownUsers={knownUsers}
              setKnownUsers={setKnownUsers}
              setMenuPages={setMenuPages}
              setCommands={setCommands}
              setAutoReplyRules={setAutoReplyRules}
              flowMessages={flowMessages}
              setFlowMessages={setFlowMessages}
              syncConfigToCloud={syncConfigToCloud}
              isSyncingToCloud={isSyncingToCloud}
              cloudSyncStatus={cloudSyncStatus}
              forceMenuOnStart={forceMenuOnStart}
              setForceMenuOnStart={setForceMenuOnStart}
              activityLogEnabled={activityLogEnabled}
              setActivityLogEnabled={setActivityLogEnabled}
              bilingualButtonEnabled={bilingualButtonEnabled}
              setBilingualButtonEnabled={setBilingualButtonEnabled}
              keyboardStartEnabled={keyboardStartEnabled}
              setKeyboardStartEnabled={setKeyboardStartEnabled}
              autoCleanupEnabled={autoCleanupEnabled}
              setAutoCleanupEnabled={setAutoCleanupEnabled}
              autoCleanupDays={autoCleanupDays}
              setAutoCleanupDays={setAutoCleanupDays}
              handleExportConfig={handleExportConfig}
              handleImportConfig={handleImportConfig}
              botToken={botProfile?.token}
              keyboardTrialExpired={keyboardTrialExpired}
              showTrialExpiredToast={showTrialExpiredToast}
              onActivationStatusChange={handleActivationStatusChange}
              rateLimitEnabled={rateLimitEnabled}
              setRateLimitEnabled={setRateLimitEnabled}
              rateLimitPerMinute={rateLimitPerMinute}
              setRateLimitPerMinute={setRateLimitPerMinute}
              botDescriptionEnabled={botDescriptionEnabled}
              setBotDescriptionEnabled={setBotDescriptionEnabled}
              botDescriptionText={botDescriptionText}
              setBotDescriptionText={setBotDescriptionText}
              botShortDescriptionText={botShortDescriptionText}
              setBotShortDescriptionText={setBotShortDescriptionText}
            />
          )}
          {activeTab === "keyboard" && (
            <KeyboardEditor
              menuPages={menuPages}
              setMenuPages={setMenuPages}
              isConnected={isConnected}
              targetChatId={targetChatId}
              showToast={showToast}
              callApi={callApi}
              knownUsers={knownUsers}
              botToken={botProfile?.token}
              syncConfigToCloud={syncConfigToCloud}
              keyboardTrialExpired={keyboardTrialExpired}
              showTrialExpiredToast={showTrialExpiredToast}
            />
          )}
          {activeTab === "commands" && (
            <CommandsEditor
              commands={commands}
              setCommands={setCommands}
              isConnected={isConnected}
              showToast={showToast}
              callApi={callApi}
              targetChatId={targetChatId}
              syncConfigToCloud={syncConfigToCloud}
              keyboardTrialExpired={keyboardTrialExpired}
              showTrialExpiredToast={showTrialExpiredToast}
              botToken={botProfile?.token}
            />
          )}
          {activeTab === "message" && (
            <MessageFlowEditor
              onSendFlow={handleSendFlow}
              isConnected={isConnected}
              targetChatId={targetChatId}
              setAutoReplyRules={setAutoReplyRules}
              showToast={showToast}
              messages={flowMessages}
              setMessages={setFlowMessages}
              activeMsgId={activeFlowMsgId}
              setActiveMsgId={setActiveFlowMsgId}
              syncConfigToCloud={syncConfigToCloud}
              keyboardTrialExpired={keyboardTrialExpired}
              showTrialExpiredToast={showTrialExpiredToast}
            />
          )}
          {activeTab === "users" && (
            <UsersPanel
              knownUsers={knownUsers}
              setKnownUsers={setKnownUsers}
              showToast={showToast}
              callApi={callApi}
              menuPages={menuPages}
              setTargetChatId={setTargetChatId}
              handlePushMenu={handlePushMenu}
              botToken={botProfile?.token}
              adminUserId={userIdInput}
            />
          )}
          {activeTab === "shop" && (
            <TgShopPanel
              botToken={botProfile?.token}
              showToast={showToast}
            />
          )}
          {activeTab === "guide" && (
            <ConfigGuide />
          )}
        </div>

        {/* Phone Simulator - desktop only */}
        {activeTab !== "shop" && activeTab !== "guide" && (
          <div className="hidden md:flex w-[320px] p-6 items-center justify-center bg-muted/50 border-l shrink-0">
            <PhoneSimulator
              chatHistory={chatHistory}
              botProfile={botProfile}
              menuPages={menuPages}
              commands={commands}
              isConnected={isConnected}
              onSimulateInteraction={handleSimulatorInteraction}
            />
          </div>
        )}
      </main>
    </div>
  );
}

// --- Activation Code Binder ---
interface KeyboardActivationInfo {
  chatExpireAt: string | null;
  keyboardExpireAt: string | null;
  isAuthorized: boolean;
  keyboardTrialStartedAt: string | null;
}

function ActivationCodeBinder({
  botToken,
  showToast,
  onStatusChange,
}: {
  botToken?: string;
  showToast: any;
  onStatusChange?: () => void;
}) {
  const { t } = useLanguage();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [activationInfo, setActivationInfo] = useState<KeyboardActivationInfo | null>(null);

  const fetchActivationInfo = async () => {
    if (!botToken) return;

    // 优先从 keyboard_configs 表获取键盘菜单的独立激活状态
    const { data: keyboardConfig } = await supabase
      .from("keyboard_configs")
      .select("keyboard_trial_started_at, keyboard_expire_at")
      .eq("bot_token", botToken)
      .maybeSingle();

    // 同时获取双向聊天的激活状态（如果有）
    const { data: botActivation } = await supabase
      .from("bot_activations")
      .select("expire_at, is_authorized")
      .eq("bot_token", botToken)
      .maybeSingle();

    // 合并两个表的数据，keyboard_configs 的键盘数据优先
    setActivationInfo({
      chatExpireAt: botActivation?.expire_at || null,
      keyboardExpireAt: keyboardConfig?.keyboard_expire_at || null,
      isAuthorized: botActivation?.is_authorized || false,
      keyboardTrialStartedAt: keyboardConfig?.keyboard_trial_started_at || null,
    });
  };

  // 初始化试用：如果没有试用记录，创建一个
  const initializeTrialIfNeeded = async () => {
    if (!botToken) return;

    const { data: existing } = await supabase
      .from("keyboard_configs")
      .select("keyboard_trial_started_at, keyboard_expire_at")
      .eq("bot_token", botToken)
      .maybeSingle();

    // 如果已有激活或试用记录，不需要初始化
    if (existing?.keyboard_expire_at || existing?.keyboard_trial_started_at) {
      return;
    }

    // 创建或更新 keyboard_configs 记录，开始试用
    const now = new Date().toISOString();
    await supabase.from("keyboard_configs").upsert(
      {
        bot_token: botToken,
        keyboard_trial_started_at: now,
        updated_at: now,
      } as any,
      { onConflict: "bot_token" },
    );

    // 刷新状态
    await fetchActivationInfo();
  };

  useEffect(() => {
    if (botToken) {
      fetchActivationInfo().then(() => {
        // 获取完状态后检查是否需要初始化试用
        initializeTrialIfNeeded();
      });
    }
  }, [botToken]);

  const handleBind = async () => {
    if (!code.trim() || !botToken) {
      showToast("error", t('km.settings.enterCode'));
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-bot", {
        body: { action: "bind-keyboard-code", activationCode: code.trim(), botToken },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const featureType = data.featureType || "keyboard";
      const messages: string[] = [];
      if (featureType === "chat" || featureType === "both") {
        messages.push(`${t('km.activation.chatExpire')}: ${data.newExpireAt ? new Date(data.newExpireAt).toLocaleDateString() : t('km.activation.success')}`);
      }
      if (featureType === "keyboard" || featureType === "both") {
        messages.push(
          `${t('km.activation.keyboardExpire')}: ${data.newKeyboardExpireAt ? new Date(data.newKeyboardExpireAt).toLocaleDateString() : t('km.activation.success')}`,
        );
      }
      showToast("success", `${t('km.activation.success')} - ${messages.join(", ")}`);
      setCode("");

      await fetchActivationInfo();
      onStatusChange?.();
    } catch (e: any) {
      showToast("error", e.message || t('km.activation.bindFailed'));
    } finally {
      setLoading(false);
    }
  };

  // 实时倒计时
  const [countdown, setCountdown] = useState('');
  const [countdownExpired, setCountdownExpired] = useState(false);
  const [countdownType, setCountdownType] = useState<'active' | 'trial' | 'expired' | 'none'>('none');

  useEffect(() => {
    if (!activationInfo) return;

    const calc = () => {
      let end: Date | null = null;
      let type: 'active' | 'trial' | 'expired' | 'none' = 'none';

      // 优先检查激活有效期
      if (activationInfo.keyboardExpireAt) {
        const keyboardExpire = new Date(activationInfo.keyboardExpireAt);
        if (keyboardExpire > new Date()) {
          end = keyboardExpire;
          type = 'active';
        } else {
          setCountdown('00:00:00');
          setCountdownExpired(true);
          setCountdownType('expired');
          return;
        }
      } else if (activationInfo.keyboardTrialStartedAt) {
        // 试用状态
        const trialStart = new Date(activationInfo.keyboardTrialStartedAt);
        const trialExpire = new Date(trialStart.getTime() + 24 * 60 * 60 * 1000);
        if (trialExpire > new Date()) {
          end = trialExpire;
          type = 'trial';
        } else {
          setCountdown('00:00:00');
          setCountdownExpired(true);
          setCountdownType('expired');
          return;
        }
      }

      if (!end) {
        setCountdown('');
        setCountdownExpired(false);
        setCountdownType('none');
        return;
      }

      const diff = end.getTime() - Date.now();
      if (diff <= 0) {
        setCountdown('00:00:00');
        setCountdownExpired(true);
        setCountdownType('expired');
        return;
      }

      setCountdownExpired(false);
      setCountdownType(type);
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      if (h >= 24) {
        const d = Math.floor(h / 24), rh = h % 24;
        setCountdown(`${d}${t('km.activation.days')} ${String(rh).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
      } else {
        setCountdown(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
      }
    };

    calc();
    const timer = setInterval(calc, 1000);
    return () => clearInterval(timer);
  }, [activationInfo]);

  return (
    <div className="flex-1 flex flex-col gap-2">
      <div className="flex gap-1">
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder={t('km.settings.activationCode')}
          className="flex-1 bg-muted border rounded px-2 py-1.5 text-xs focus:ring-1 focus:ring-primary outline-none"
        />
        <button
          onClick={handleBind}
          disabled={loading || !code.trim()}
          className="px-2 py-1.5 bg-primary text-primary-foreground rounded text-xs font-medium hover:bg-primary/90 disabled:bg-muted transition flex items-center gap-1"
        >
          {loading ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
          {t('km.settings.bind')}
        </button>
      </div>
      {/* 实时倒计时状态 */}
      {countdown || countdownType === 'none' ? (
        <div className={`flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-lg border ${
          countdownExpired
            ? 'bg-destructive/10 border-destructive/30 text-destructive'
            : countdownType === 'trial'
              ? 'bg-orange-500/10 border-orange-500/30 text-orange-600'
              : countdownType === 'active'
                ? 'bg-green-500/10 border-green-500/30 text-green-600'
                : 'bg-muted border-border text-muted-foreground'
        }`}>
          <Timer size={12} className={countdownExpired ? '' : 'animate-pulse'} />
          {countdownExpired ? (
            <span>❌ {t('km.activation.expired')} - {t('km.settings.enterCode')}</span>
          ) : countdownType === 'trial' ? (
            <span className="font-mono font-medium">⏳ {t('km.activation.trial')}: {countdown}</span>
          ) : countdownType === 'active' ? (
            <span className="font-mono font-medium">✅ {t('km.activation.valid')}: {countdown}</span>
          ) : (
            <span>💡 {t('km.activation.firstUse')}</span>
          )}
        </div>
      ) : null}
    </div>
  );
}

// --- Settings Panel ---
function SettingsPanel({
  isConnected,
  botProfile,
  tokenInput,
  setTokenInput,
  userIdInput,
  setUserIdInput,
  targetChatId,
  setTargetChatId,
  loading,
  onConnect,
  onLogout,
  showToast,
  useProxy,
  setUseProxy,
  callApi,
  isMonitoring,
  setIsMonitoring,
  webhookInfo,
  refreshWebhook,
  handleToggleMonitoring,
  knownUsers,
  setKnownUsers,
  setMenuPages,
  setCommands,
  setAutoReplyRules,
  flowMessages,
  setFlowMessages,
  syncConfigToCloud,
  isSyncingToCloud,
  cloudSyncStatus,
  forceMenuOnStart,
  setForceMenuOnStart,
  activityLogEnabled,
  setActivityLogEnabled,
  bilingualButtonEnabled,
  setBilingualButtonEnabled,
  keyboardStartEnabled,
  setKeyboardStartEnabled,
  autoCleanupEnabled,
  setAutoCleanupEnabled,
  autoCleanupDays,
  setAutoCleanupDays,
  handleExportConfig,
  handleImportConfig,
  botToken,
  keyboardTrialExpired,
  showTrialExpiredToast,
  onActivationStatusChange,
  rateLimitEnabled,
  setRateLimitEnabled,
  rateLimitPerMinute,
  setRateLimitPerMinute,
}: any) {
  const { t } = useLanguage();
  const [isResetting, setIsResetting] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [customCleanupDays, setCustomCleanupDays] = useState("");




  const handleSyncToCloud = () => {
    if (keyboardTrialExpired) {
      showTrialExpiredToast();
      return;
    }
    syncConfigToCloud?.();
  };

  const handleRestoreWebhook = async () => {
    const savedUrl = localStorage.getItem("keyboard_menu_saved_webhook");
    if (!savedUrl) return;
    try {
      await callApi("setWebhook", { url: savedUrl });
      showToast("success", t('km.toast.backupRestored'));
      refreshWebhook();
    } catch (e: any) {
      showToast("error", `${t('km.toast.restoreFailed')}: ${e.message}`);
    }
  };

  const handleForceReset = async () => {
    setIsResetting(true);
    showToast("info", t('km.settings.deepResetting'));

    try {
      const { data, error } = await supabase.functions.invoke("manage-bot", {
        body: {
          action: "deep-reset",
          botToken: botToken,
          adminChatId: targetChatId ? parseInt(targetChatId) : null,
        },
      });

      if (error) throw error;

      if (data?.ok) {
        showToast("success", data.message || t('km.settings.deepResetSuccess'));
        await syncConfigToCloud?.();
      } else {
        throw new Error(data?.error || t('km.settings.deepResetFailed'));
      }
    } catch (e: any) {
      console.error("Deep reset failed:", e);
      showToast("error", `${t('km.settings.deepResetFailed')}: ${e.message}`);
    } finally {
      setIsResetting(false);
    }
  };

  const handleTestSend = async () => {
    if (!targetChatId) {
      showToast("error", t('km.settings.inputTargetId'));
      return;
    }
    setTestLoading(true);
    try {
      await callApi("sendMessage", { chat_id: targetChatId, text: "🔔 This is a test message, connection verified!" });
      showToast("success", t('km.settings.testSendSuccess'));
    } catch (e: any) {
      showToast("error", `${t('km.settings.testSendFailed')}: ${e.message}`);
    } finally {
      setTestLoading(false);
    }
  };

  const hasBackup = !!localStorage.getItem("keyboard_menu_saved_webhook");
  const isDisconnected = webhookInfo && !webhookInfo.url;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="border-b pb-4">
        <h2 className="text-2xl font-bold mb-1">{t('km.settings.title')}</h2>
        <p className="text-muted-foreground text-sm">{t('km.settings.desc')}</p>
      </div>
      <div className="grid grid-cols-1 gap-6">
        <div className="bg-card p-6 rounded-xl border shadow-sm">
          <h3 className="font-bold mb-4 flex items-center gap-2">
            <Zap className="text-primary" size={18} /> {t('km.settings.connectSettings')}
          </h3>

          {!isConnected ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">{t('km.settings.botId')}</label>
                <input
                  type="password"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  placeholder="123456:ABC-DEF..."
                  className="w-full bg-muted border rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-primary outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('km.settings.userId')}</label>
                <input
                  type="text"
                  value={userIdInput}
                  onChange={(e) => setUserIdInput(e.target.value)}
                  placeholder="e.g. 12345678"
                  className="w-full bg-muted border rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-primary outline-none font-mono"
                />
              </div>
              <div className="flex items-center gap-2 mb-2 pt-2">
                <input
                  type="checkbox"
                  id="useProxy"
                  checked={useProxy}
                  onChange={(e) => setUseProxy(e.target.checked)}
                  className="rounded text-primary focus:ring-primary"
                />
                <label htmlFor="useProxy" className="text-xs text-muted-foreground cursor-pointer">
                  {t('km.settings.proxyMode')}
                </label>
              </div>
              <button
                onClick={onConnect}
                disabled={loading || !tokenInput}
                className="w-full bg-primary hover:bg-primary/90 disabled:bg-muted text-primary-foreground py-2.5 rounded-lg font-bold transition flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : t('km.settings.verifyConnect')}
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center gap-4 bg-muted p-4 rounded-lg border">
                <div className="w-12 h-12 bg-card rounded-full flex items-center justify-center text-xl font-bold">
                  {botProfile.first_name.charAt(0)}
                </div>
                <div className="flex-1">
                  <h4 className="font-bold text-lg">{botProfile.first_name}</h4>
                  <span className="text-sm text-primary font-mono">@{botProfile.username}</span>
                </div>
              </div>
              <div className="bg-primary/10 p-4 rounded-lg border border-primary/20">
                <label className="block text-sm font-bold text-primary mb-2 flex items-center gap-2">
                  <User size={16} /> {t('km.settings.userIdReceive')}
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={targetChatId}
                    onChange={(e) => setTargetChatId(e.target.value)}
                    className="flex-1 bg-card border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none font-mono"
                  />
                  <button
                    onClick={handleTestSend}
                    disabled={testLoading || !targetChatId}
                    className="px-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:bg-muted transition flex items-center justify-center"
                  >
                    {testLoading ? <Loader2 size={14} className="animate-spin" /> : <MessageCircleQuestion size={16} />}
                  </button>
                </div>
              </div>
              {/* Disconnect + Activation Code Binding */}
              <div className="flex gap-2">
                <button
                  onClick={onLogout}
                  className="flex-1 border border-destructive/20 text-destructive hover:bg-destructive/10 py-2 rounded-lg font-medium transition flex items-center justify-center gap-2 text-sm"
                >
                  <LogOut size={14} /> {t('km.settings.disconnect')}
                </button>
                <ActivationCodeBinder
                  botToken={botProfile?.token}
                  showToast={showToast}
                  onStatusChange={onActivationStatusChange}
                />
              </div>

              {/* Cloud sync and config functions */}
              <div className="border-t pt-4 mt-2 space-y-3">
                {/* Cloud sync button */}
                <button
                  onClick={handleSyncToCloud}
                  disabled={isSyncingToCloud}
                  className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg font-bold text-sm transition ${
                    cloudSyncStatus === "synced"
                      ? "bg-green-500/10 text-green-600 border border-green-200 hover:bg-green-500/20"
                      : cloudSyncStatus === "error"
                        ? "bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20"
                        : "bg-primary text-primary-foreground hover:bg-primary/90"
                  }`}
                >
                  {isSyncingToCloud ? (
                    <>
                      <Loader2 size={14} className="animate-spin" /> {t('km.settings.syncing')}
                    </>
                  ) : cloudSyncStatus === "synced" ? (
                    <>
                      <Cloud size={14} /> {t('km.settings.synced')}
                    </>
                  ) : cloudSyncStatus === "error" ? (
                    <>
                      <CloudOff size={14} /> {t('km.settings.syncFailed')}
                    </>
                  ) : (
                    <>
                      <Cloud size={14} /> {t('km.settings.cloudSync')}
                    </>
                  )}
                </button>

                {/* 用户活动记录开关 */}
                <div className="flex items-center justify-between bg-muted p-3 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Activity size={14} className="text-muted-foreground" />
                    <span className="text-xs font-medium text-muted-foreground">
                      {t('km.settings.activityLog')}
                    </span>
                  </div>
                  <button
                    onClick={() => setActivityLogEnabled(!activityLogEnabled)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${activityLogEnabled ? "bg-primary" : "bg-muted-foreground/30"}`}
                  >
                    <span
                      className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${activityLogEnabled ? "translate-x-4" : "translate-x-1"}`}
                    />
                  </button>
                </div>

                {/* 中英双语切换开关 */}
                <div className="flex items-center justify-between bg-muted p-3 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Globe size={14} className="text-muted-foreground" />
                    <div className="flex flex-col text-left">
                      <span className="text-xs font-medium text-muted-foreground">
                        {t('km.settings.bilingualBtn')}
                      </span>
                      <span className="text-[10px] text-red-500 leading-tight mt-0.5">
                        {t('km.settings.bilingualHint1')}
                      </span>
                      <span className="text-[10px] text-red-500 leading-tight mt-0.5">
                        {t('km.settings.bilingualHint2')}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setBilingualButtonEnabled(!bilingualButtonEnabled);
                      setTimeout(() => syncConfigToCloud?.(), 100);
                    }}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${bilingualButtonEnabled ? "bg-primary" : "bg-muted-foreground/30"}`}
                  >
                    <span
                      className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${bilingualButtonEnabled ? "translate-x-4" : "translate-x-1"}`}
                    />
                  </button>
                </div>

                {/* 菜单键盘 /start 开关 */}
                <div className="flex items-center justify-between bg-muted p-3 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Layout size={14} className="text-muted-foreground" />
                    <div className="flex flex-col text-left">
                      <span className="text-xs font-medium text-muted-foreground">
                        菜单键盘 /start
                      </span>
                      <span className="text-[10px] text-muted-foreground leading-tight mt-0.5">
                        开启后用户点击/start会发送菜单键盘
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setKeyboardStartEnabled(!keyboardStartEnabled);
                      setTimeout(() => syncConfigToCloud?.(), 100);
                    }}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${keyboardStartEnabled ? "bg-primary" : "bg-muted-foreground/30"}`}
                  >
                    <span
                      className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${keyboardStartEnabled ? "translate-x-4" : "translate-x-1"}`}
                    />
                  </button>
                </div>

                {/* 防轰炸频率限制 */}
                <div className="bg-muted p-3 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Shield size={14} className="text-muted-foreground" />
                      <div className="flex flex-col text-left">
                        <span className="text-xs font-medium text-muted-foreground">
                          防轰炸保护
                        </span>
                        <span className="text-[10px] text-muted-foreground leading-tight mt-0.5">
                          限制用户每分钟消息数量，防止恶意刷屏
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setRateLimitEnabled(!rateLimitEnabled);
                        setTimeout(() => syncConfigToCloud?.(), 100);
                      }}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${rateLimitEnabled ? "bg-primary" : "bg-muted-foreground/30"}`}
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${rateLimitEnabled ? "translate-x-4" : "translate-x-1"}`}
                      />
                    </button>
                  </div>
                  {rateLimitEnabled && (
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">每分钟限制</span>
                      <input
                        type="number"
                        min={3}
                        max={100}
                        value={rateLimitPerMinute}
                        onChange={(e) => {
                          const val = Math.max(3, Math.min(100, parseInt(e.target.value) || 10));
                          setRateLimitPerMinute(val);
                          setTimeout(() => syncConfigToCloud?.(), 300);
                        }}
                        className="w-16 bg-card border rounded px-2 py-1 text-xs text-center focus:ring-1 focus:ring-primary outline-none"
                      />
                      <span className="text-[10px] text-muted-foreground">条消息</span>
                    </div>
                  )}
                </div>

                {/* Deep Reset */}
                <button
                  onClick={handleForceReset}
                  disabled={isResetting}
                  className="w-full bg-destructive/10 border border-destructive/20 text-destructive hover:bg-destructive/20 py-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-colors"
                >
                  {isResetting ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                  {t('km.settings.deepReset')}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 机器人介绍（搜索/未点开始前显示） */}
        {isConnected && (
          <div className="bg-card p-6 rounded-xl border shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold flex items-center gap-2">
                <MessageCircleQuestion className="text-primary" size={18} /> 机器人介绍
                <span className="text-xs font-normal text-muted-foreground ml-1">
                  （用户搜到机器人、未点 /start 前显示）
                </span>
              </h3>
              <button
                onClick={() => {
                  setBotDescriptionEnabled(!botDescriptionEnabled);
                  setTimeout(() => syncConfigToCloud?.(), 100);
                }}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${botDescriptionEnabled ? "bg-primary" : "bg-muted-foreground/30"}`}
                aria-label="启用机器人介绍"
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${botDescriptionEnabled ? "translate-x-4" : "translate-x-1"}`}
                />
              </button>
            </div>

            <div className={`space-y-4 ${botDescriptionEnabled ? "" : "opacity-50 pointer-events-none"}`}>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium">
                    介绍语 <span className="text-xs text-muted-foreground">（对话为空时显示，最多 512 字，支持 emoji 😀）</span>
                  </label>
                  <span className={`text-[10px] ${botDescriptionText.length > 512 ? "text-destructive" : "text-muted-foreground"}`}>
                    {botDescriptionText.length}/512
                  </span>
                </div>
                <textarea
                  value={botDescriptionText}
                  onChange={(e) => setBotDescriptionText(e.target.value.slice(0, 512))}
                  rows={5}
                  placeholder="例如：👋 欢迎使用本机器人！这里提供 24h 自助下单、卡密发货、在线客服等服务。点击 /start 开始体验～"
                  className="w-full bg-muted border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none resize-y"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium">
                    简介 <span className="text-xs text-muted-foreground">（搜索结果/资料页显示，最多 120 字）</span>
                  </label>
                  <span className={`text-[10px] ${botShortDescriptionText.length > 120 ? "text-destructive" : "text-muted-foreground"}`}>
                    {botShortDescriptionText.length}/120
                  </span>
                </div>
                <textarea
                  value={botShortDescriptionText}
                  onChange={(e) => setBotShortDescriptionText(e.target.value.slice(0, 120))}
                  rows={2}
                  placeholder="例如：🛒 24h 自助商城，卡密秒发货 ⚡"
                  className="w-full bg-muted border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none resize-y"
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleLoadDescriptionFromTelegram}
                  disabled={isLoadingDescription}
                  className="flex-1 border bg-muted hover:bg-muted/70 py-2 rounded-lg font-medium transition flex items-center justify-center gap-2 text-sm disabled:opacity-50"
                >
                  {isLoadingDescription ? <Loader2 size={14} className="animate-spin" /> : <Cloud size={14} />}
                  从 Telegram 加载
                </button>
                <button
                  onClick={handleSaveDescriptionToTelegram}
                  disabled={isSavingDescription || botDescriptionText.length > 512 || botShortDescriptionText.length > 120}
                  className="flex-1 bg-primary hover:bg-primary/90 disabled:bg-muted text-primary-foreground py-2 rounded-lg font-bold transition flex items-center justify-center gap-2 text-sm"
                >
                  {isSavingDescription ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                  保存到 Telegram
                </button>
              </div>

              <p className="text-[11px] text-muted-foreground leading-relaxed bg-muted/50 p-2 rounded border">
                提示：Telegram 官方 Bot API 的「机器人介绍」目前仅支持<strong>纯文本+emoji</strong>。
                机器人<strong>头像、介绍图片、介绍视频</strong>无法通过本网站设置，需在 Telegram 中打开
                <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" className="text-primary underline mx-1">@BotFather</a>
                ，依次选择 <em>/mybots → 你的机器人 → Edit Bot → Edit Botpic / Edit Description Picture</em> 进行设置。
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// --- Keyboard Editor ---
function KeyboardEditor({
  menuPages,
  setMenuPages,
  isConnected,
  targetChatId,
  showToast,
  callApi,
  knownUsers,
  botToken,
  syncConfigToCloud,
  keyboardTrialExpired,
  showTrialExpiredToast,
}: any) {
  const { t } = useLanguage();
  const [activePageId, setActivePageId] = useState("main");
  const [isPushing, setIsPushing] = useState(false);
  const [dbUsers, setDbUsers] = useState<any[]>([]);

  // 当云端数据加载后，页面ID可能与默认的"main"不匹配，自动修正
  useEffect(() => {
    if (menuPages.length > 0 && !menuPages.find((p: MenuPage) => p.id === activePageId)) {
      setActivePageId(menuPages[0].id);
    }
  }, [menuPages]);
  // 安全获取activePage，确保始终有有效值
  const defaultPage: MenuPage = { id: 'main', name: t('km.keyboard.mainMenu'), rows: [] };
  const activePage = (menuPages.length > 0 
    ? (menuPages.find((p: MenuPage) => p.id === activePageId) || menuPages[0])
    : defaultPage);

  useEffect(() => {
    const loadUsers = async () => {
      if (!botToken) return;
      const { data } = await supabase
        .from("bot_users")
        .select("telegram_user_id, first_name")
        .eq("bot_token", botToken);
      if (data) setDbUsers(data);
    };
    loadUsers();
  }, [botToken]);

  const addPage = () => {
    const newId = `page_${uuid().substring(0, 6)}`;
    setMenuPages([...menuPages, { id: newId, name: t('km.keyboard.newPageName'), rows: [[{ text: t('km.keyboard.newButton'), actionType: "text" }]] }]);
    setActivePageId(newId);
  };
  const deletePage = (id: string) => {
    if (id === "main") return;
    const newPages = menuPages.filter((p: MenuPage) => p.id !== id);
    setMenuPages(newPages);
    setActivePageId("main");
  };
  const addRow = () => {
    setMenuPages(
      menuPages.map((p: MenuPage) =>
        p.id === activePageId ? { ...p, rows: [...p.rows, [{ text: t('km.keyboard.newButton'), actionType: "text" }]] } : p,
      ),
    );
  };
  const updateBtn = (rIdx: number, cIdx: number, field: string, val: string) => {
    setMenuPages(
      menuPages.map((p: MenuPage) => {
        if (p.id !== activePageId) return p;
        const newRows = [...p.rows];
        newRows[rIdx] = [...newRows[rIdx]];
        newRows[rIdx][cIdx] = { ...newRows[rIdx][cIdx], [field]: val };
        return { ...p, rows: newRows };
      }),
    );
  };
  const removeRow = (rIdx: number) => {
    setMenuPages(
      menuPages.map((p: MenuPage) =>
        p.id === activePageId ? { ...p, rows: p.rows.filter((_: any, i: number) => i !== rIdx) } : p,
      ),
    );
  };
  const addBtnToRow = (rIdx: number) => {
    setMenuPages(
      menuPages.map((p: MenuPage) => {
        if (p.id !== activePageId) return p;
        const newRows = [...p.rows];
        if (newRows[rIdx].length < 3) newRows[rIdx].push({ text: t('km.keyboard.newButton'), actionType: "text" });
        return { ...p, rows: newRows };
      }),
    );
  };
  const removeBtn = (rIdx: number, cIdx: number) => {
    setMenuPages(
      menuPages.map((p: MenuPage) => {
        if (p.id !== activePageId) return p;
        const newRows = [...p.rows];
        newRows[rIdx] = newRows[rIdx].filter((_: any, i: number) => i !== cIdx);
        if (newRows[rIdx].length === 0) return { ...p, rows: p.rows.filter((_: any, i: number) => i !== rIdx) };
        return { ...p, rows: newRows };
      }),
    );
  };

  const pushKeyboardToTelegram = async () => {
    if (keyboardTrialExpired) {
      showTrialExpiredToast();
      return;
    }
    if (!isConnected || !targetChatId) {
      showToast("error", t('km.keyboard.connectAndConfigUserId'));
      return;
    }
    setIsPushing(true);
    try {
      await callApi("sendMessage", {
        chat_id: targetChatId,
        text: `${t('km.keyboard.menuUpdate')}: ${activePage.name}`,
        reply_markup: {
          keyboard: activePage.rows.map((row: ReplyButton[]) => row.map((btn: ReplyButton) => ({ text: btn.text }))),
          resize_keyboard: true,
          one_time_keyboard: false,
          is_persistent: true,
        },
      });
      showToast("success", `${t('km.keyboard.pushSuccess')} "${activePage.name}"`);
      syncConfigToCloud?.();
    } catch (e: any) {
      showToast("error", `${t('km.keyboard.pushFailed')}: ${e.message}`);
    } finally {
      setIsPushing(false);
    }
  };

  const pushToAllUsers = async () => {
    if (keyboardTrialExpired) {
      showTrialExpiredToast();
      return;
    }
    if (!isConnected) {
      showToast("error", t('km.settings.connectFirst'));
      return;
    }
    if (dbUsers.length === 0) {
      showToast("error", t('km.keyboard.noUsers'));
      return;
    }
    setIsPushing(true);
    showToast("info", `${t('km.keyboard.broadcastStart')} ${dbUsers.length} ${t('km.users.users')}...`);
    let success = 0;
    for (const user of dbUsers) {
      try {
        await callApi("sendMessage", {
          chat_id: user.telegram_user_id,
          text: `${t('km.keyboard.menuUpdate')}: ${activePage.name}`,
          reply_markup: {
            keyboard: activePage.rows.map((row: ReplyButton[]) => row.map((btn: ReplyButton) => ({ text: btn.text }))),
            resize_keyboard: true,
            one_time_keyboard: false,
          },
        });
        success++;
      } catch (e) {}
      await new Promise((r) => setTimeout(r, 100));
    }
    setIsPushing(false);
    showToast("success", `${t('km.keyboard.broadcastComplete')}: ${success}/${dbUsers.length} ${t('km.keyboard.success')}`);
    syncConfigToCloud?.();
  };

  return (
    <div className="space-y-6">
      <div className="border-b pb-4 flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold mb-1">{t('km.keyboard.title')}</h2>
          <p className="text-xs text-muted-foreground">{t('km.keyboard.desc')}</p>
        </div>
        <button
          onClick={addPage}
          className="text-xs bg-primary/10 text-primary px-3 py-1.5 rounded-lg hover:bg-primary/20 font-bold flex items-center gap-1"
        >
          <Plus size={14} /> {t('km.keyboard.newPage')}
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2">
        {menuPages.map((p: MenuPage) => (
          <div
            key={p.id}
            onClick={() => setActivePageId(p.id)}
            className={`px-3 py-1.5 rounded-t-lg border-b-2 cursor-pointer text-sm font-bold flex items-center gap-2 whitespace-nowrap transition-colors ${activePageId === p.id ? "border-primary text-primary bg-primary/10" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            {p.id === "main" ? <Layout size={14} /> : <Folder size={14} />}
            {p.name}
            {p.id !== "main" && (
              <X
                size={12}
                className="hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  deletePage(p.id);
                }}
              />
            )}
          </div>
        ))}
      </div>

      <div className="bg-card p-6 rounded-b-xl rounded-tr-xl border shadow-sm space-y-4">
        <div className="flex items-center gap-2 mb-4 border-b pb-2">
          <Edit3 size={14} className="text-muted-foreground" />
          <input
            value={activePage.name}
            onChange={(e) =>
              setMenuPages(menuPages.map((p: MenuPage) => (p.id === activePageId ? { ...p, name: e.target.value } : p)))
            }
            className="font-bold outline-none w-full bg-transparent"
            placeholder={t('km.keyboard.menuPageName')}
          />
        </div>

        {activePage.rows.map((row: ReplyButton[], rIdx: number) => (
          <div key={rIdx} className="flex gap-2 bg-muted p-2 rounded-lg border items-start">
            <div className="flex-1 flex gap-2 overflow-x-auto">
              {row.map((btn: ReplyButton, cIdx: number) => (
                <div
                  key={cIdx}
                  className="min-w-[150px] bg-card p-2 rounded border shadow-sm flex flex-col gap-2 relative group"
                >
                  <div className="flex justify-between items-center">
                    <button
                      onClick={() => removeBtn(rIdx, cIdx)}
                      className="text-destructive hover:text-destructive/80 hover:bg-destructive/10 p-0.5 rounded transition"
                    >
                      <X size={12} />
                    </button>
                  </div>
                  <input
                    type="text"
                    value={btn.text}
                    onChange={(e) => updateBtn(rIdx, cIdx, "text", e.target.value)}
                    className="w-full text-center text-xs font-bold border-b pb-1 outline-none bg-transparent"
                    placeholder={t('km.keyboard.btnTextCn')}
                  />
                  <input
                    type="text"
                    value={btn.textEn || ""}
                    onChange={(e) => updateBtn(rIdx, cIdx, "textEn", e.target.value)}
                    className="w-full text-center text-[10px] text-muted-foreground border-b pb-1 outline-none bg-transparent"
                    placeholder={t('km.keyboard.btnTextEn')}
                  />
                  <select
                    value={btn.actionType}
                    onChange={(e) => updateBtn(rIdx, cIdx, "actionType", e.target.value)}
                    className="w-full text-[10px] bg-muted border rounded px-1 py-0.5 outline-none font-medium"
                  >
                    <option value="text">{t('km.keyboard.sendText')}</option>
                    <option value="navigate">{t('km.keyboard.navigateMenu')}</option>
                  </select>
                  {btn.actionType === "navigate" && (
                    <select
                      value={btn.actionValue || ""}
                      onChange={(e) => updateBtn(rIdx, cIdx, "actionValue", e.target.value)}
                      className="w-full text-[10px] bg-primary/10 text-primary border border-primary/20 px-1 py-0.5 rounded outline-none"
                    >
                      <option value="">{t('km.keyboard.selectTarget')}</option>
                      {menuPages.map((p: MenuPage) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              ))}
              {row.length < 3 && (
                <button
                  onClick={() => addBtnToRow(rIdx)}
                  className="w-8 flex items-center justify-center border border-dashed rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition self-stretch"
                >
                  <Plus size={16} />
                </button>
              )}
            </div>
            <button
              onClick={() => removeRow(rIdx)}
              className="p-2 text-muted-foreground hover:text-destructive self-center"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        <button
          onClick={addRow}
          className="w-full py-2 border-2 border-dashed rounded-lg text-muted-foreground font-bold hover:border-primary hover:text-primary transition flex items-center justify-center gap-2 text-sm"
        >
          <Plus size={16} /> {t('km.keyboard.addNewRow')}
        </button>
        <div className="border-t pt-4 mt-2 grid grid-cols-2 gap-3">
          <button
            onClick={pushKeyboardToTelegram}
            disabled={isPushing}
            className="w-full bg-foreground text-background py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-foreground/90 transition disabled:opacity-50"
          >
            {isPushing ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />} {t('km.keyboard.pushCurrent')}
          </button>
          <button
            onClick={pushToAllUsers}
            disabled={isPushing}
            className="w-full bg-primary text-primary-foreground py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-primary/90 transition disabled:opacity-50"
          >
            {isPushing ? <Loader2 size={18} className="animate-spin" /> : <RadioReceiver size={18} />} {t('km.keyboard.broadcastUpdate')}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Commands Editor ---
function CommandsEditor({
  commands,
  setCommands,
  isConnected,
  showToast,
  callApi,
  targetChatId,
  syncConfigToCloud,
  keyboardTrialExpired,
  showTrialExpiredToast,
  botToken,
}: any) {
  const { t } = useLanguage();
  const [newCmd, setNewCmd] = useState({ command: "", description: "" });
  const [isSaving, setIsSaving] = useState(false);
  const [menuBtnType, setMenuBtnType] = useState<"commands" | "web_app">("commands");
  const [webAppUrl, setWebAppUrl] = useState("");
  const [webAppText, setWebAppText] = useState("Open App");

  const addCommand = () => {
    setCommands([...commands, newCmd]);
    setNewCmd({ command: "", description: "" });
  };
  const updateCommand = (idx: number, field: keyof BotCommand, val: string) => {
    const newC = [...commands];
    newC[idx][field] = val;
    setCommands(newC);
  };
  const removeCommand = (index: number) => {
    setCommands(commands.filter((_: any, i: number) => i !== index));
  };

  const save = async () => {
    if (keyboardTrialExpired) {
      showTrialExpiredToast();
      return;
    }
    if (!isConnected) {
      showToast("error", t('km.settings.connectFirst'));
      return;
    }
    setIsSaving(true);
    try {
      // 过滤掉空命令
      const validCommands = commands.filter((c: BotCommand) => c.command && c.command.trim());
      
      // 1. 同步指令 (Commands)
      if (validCommands.length === 0) {
        // 如果没有命令，使用 deleteMyCommands 完全清除
        // A. 全局删除
        await callApi("deleteMyCommands", {});
        // B. 针对管理员删除
        if (targetChatId) {
          await callApi("deleteMyCommands", {
            scope: { type: "chat", chat_id: targetChatId },
          });
        }
        // C. 针对所有已知用户删除（解决用户缓存不刷新）
        const { data: botUsers } = await supabase
          .from("bot_users")
          .select("telegram_user_id")
          .eq("bot_token", botToken || "");
        if (botUsers && botUsers.length > 0) {
          for (const user of botUsers) {
            if (targetChatId && user.telegram_user_id.toString() === targetChatId.toString()) continue;
            try {
              await callApi("deleteMyCommands", {
                scope: { type: "chat", chat_id: user.telegram_user_id },
              });
            } catch (e) {
              console.log(`Skip user ${user.telegram_user_id}:`, e);
            }
          }
        }
      } else {
        // A. 全局更新
        await callApi("setMyCommands", { commands: validCommands });
        // B. 针对管理员强制更新 (解决缓存不刷新)
        if (targetChatId) {
          await callApi("setMyCommands", {
            commands: validCommands,
            scope: { type: "chat", chat_id: targetChatId },
          });
        }
        // C. 针对所有已知用户强制更新（解决用户缓存不刷新）
        const { data: botUsers } = await supabase
          .from("bot_users")
          .select("telegram_user_id")
          .eq("bot_token", botToken || "");
        if (botUsers && botUsers.length > 0) {
          for (const user of botUsers) {
            if (targetChatId && user.telegram_user_id.toString() === targetChatId.toString()) continue;
            try {
              await callApi("setMyCommands", {
                commands: validCommands,
                scope: { type: "chat", chat_id: user.telegram_user_id },
              });
            } catch (e) {
              console.log(`Skip user ${user.telegram_user_id}:`, e);
            }
          }
        }
      }

      // 2. 同步左下角菜单按钮 (Menu Button)
      const baseMenuConfig: any = {};
      if (menuBtnType === "web_app") {
        baseMenuConfig.menu_button = { type: "web_app", text: webAppText, web_app: { url: webAppUrl } };
      } else {
        baseMenuConfig.menu_button = { type: "commands" };
      }

      // A. 全局更新 (新用户默认看到这个)
      await callApi("setChatMenuButton", baseMenuConfig);

      // B. 针对管理员强制更新 (让你立即看到效果)
      if (targetChatId) {
        await callApi("setChatMenuButton", {
          ...baseMenuConfig,
          chat_id: targetChatId,
        });
      }

      // C. 针对所有已知用户强制更新菜单按钮
      const { data: botUsersForMenu } = await supabase
        .from("bot_users")
        .select("telegram_user_id")
        .eq("bot_token", botToken || "");
      if (botUsersForMenu && botUsersForMenu.length > 0) {
        for (const user of botUsersForMenu) {
          if (targetChatId && user.telegram_user_id.toString() === targetChatId.toString()) continue;
          try {
            await callApi("setChatMenuButton", {
              ...baseMenuConfig,
              chat_id: user.telegram_user_id,
            });
          } catch (e) {
            console.log(`Skip menu button for user ${user.telegram_user_id}:`, e);
          }
        }
      }

      showToast("success", validCommands.length === 0 ? t('km.commands.menuConfigCleared') : t('km.commands.menuSyncSuccess'));
      syncConfigToCloud?.();
    } catch (e: any) {
      showToast("error", e.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="border-b pb-4">
        <h2 className="text-2xl font-bold mb-1">{t('km.commands.title')}</h2>
      </div>

      <div className="bg-card p-5 rounded-xl border shadow-sm">
        <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
          <Layout size={16} className="text-primary" /> {t('km.commands.menuBtnConfig')}
        </h3>
        <div className="flex gap-4 mb-3">
          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <input
              type="radio"
              checked={menuBtnType === "commands"}
              onChange={() => setMenuBtnType("commands")}
              className="text-primary"
            />
            {t('km.commands.showCommandList')}
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <input
              type="radio"
              checked={menuBtnType === "web_app"}
              onChange={() => setMenuBtnType("web_app")}
              className="text-primary"
            />
            {t('km.commands.openWebApp')}
          </label>
        </div>
        {menuBtnType === "web_app" && (
          <div className="grid grid-cols-2 gap-3 animate-in fade-in">
            <input
              value={webAppText}
              onChange={(e) => setWebAppText(e.target.value)}
              placeholder={t('km.commands.btnText')}
              className="border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <input
              value={webAppUrl}
              onChange={(e) => setWebAppUrl(e.target.value)}
              placeholder={t('km.commands.webAppUrl')}
              className="border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>
        )}
      </div>

      {menuBtnType !== "web_app" && (
        <div className="bg-card p-6 rounded-xl border shadow-sm space-y-4">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <List size={16} /> {t('km.commands.commandList')}
          </h3>
          <div className="space-y-2">
            {commands.map((c: BotCommand, i: number) => (
              <div key={i} className="flex gap-2 text-sm items-center group">
                <span className="text-primary font-bold text-xs">/</span>
                <input
                  value={c.command}
                  onChange={(e) => updateCommand(i, "command", e.target.value)}
                  className="w-24 border rounded px-2 py-1 text-sm font-bold outline-none"
                />
                <input
                  value={c.description}
                  onChange={(e) => updateCommand(i, "description", e.target.value)}
                  className="flex-1 border rounded px-2 py-1 text-sm outline-none min-w-0"
                />
                <button
                  onClick={() => removeCommand(i)}
                  className="p-1 text-destructive bg-destructive/10 rounded transition shrink-0"
                >
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2 pt-3 border-t">
            <div className="relative w-1/3">
              <span className="absolute left-2 top-1.5 text-muted-foreground text-sm">/</span>
              <input
                value={newCmd.command}
                onChange={(e) => setNewCmd({ ...newCmd, command: e.target.value })}
                placeholder={t('km.commands.newCmd')}
                className="w-full pl-5 pr-2 py-1 border rounded text-sm outline-none"
              />
            </div>
            <input
              value={newCmd.description}
              onChange={(e) => setNewCmd({ ...newCmd, description: e.target.value })}
              placeholder={t('km.commands.description')}
              className="flex-1 border rounded px-2 py-1 text-sm outline-none"
            />
            <button onClick={addCommand} className="bg-muted hover:bg-accent px-3 rounded">
              <Plus size={16} />
            </button>
          </div>
          <button
            onClick={save}
            disabled={isSaving}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-2 rounded-lg font-bold text-sm transition flex items-center justify-center gap-2"
          >
            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} {t('km.commands.syncToTelegram')}
          </button>
        </div>
      )}

      {menuBtnType === "web_app" && (
        <div className="flex justify-end">
          <button
            onClick={save}
            disabled={isSaving}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-2 rounded-lg font-bold text-sm transition flex items-center justify-center gap-2 shadow-sm"
          >
            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} {t('km.commands.saveWebApp')}
          </button>
        </div>
      )}
    </div>
  );
}

// --- Message Flow Editor ---
function MessageFlowEditor({
  onSendFlow,
  isConnected,
  targetChatId,
  setAutoReplyRules,
  showToast,
  messages,
  setMessages,
  activeMsgId,
  setActiveMsgId,
  syncConfigToCloud,
  keyboardTrialExpired,
  showTrialExpiredToast,
}: any) {
  const { t } = useLanguage();
  const [showLinkInserter, setShowLinkInserter] = useState(false);
  const [linkForm, setLinkForm] = useState({ text: "", url: "" });
  const [showCopyInserter, setShowCopyInserter] = useState(false);
  const [copyText, setCopyText] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Telegram 常用表情列表
  const telegramEmojis = [
    "😀",
    "😃",
    "😄",
    "😁",
    "😆",
    "😅",
    "🤣",
    "😂",
    "🙂",
    "😊",
    "😇",
    "🥰",
    "😍",
    "🤩",
    "😘",
    "😗",
    "😚",
    "😋",
    "😛",
    "😜",
    "🤪",
    "😝",
    "🤑",
    "🤗",
    "🤭",
    "🤫",
    "🤔",
    "🤐",
    "🤨",
    "😐",
    "😑",
    "😶",
    "😏",
    "😒",
    "🙄",
    "😬",
    "🤥",
    "😌",
    "😔",
    "😪",
    "🤤",
    "😴",
    "😷",
    "🤒",
    "🤕",
    "🤢",
    "🤮",
    "🤧",
    "🥵",
    "🥶",
    "🥴",
    "😵",
    "🤯",
    "🤠",
    "🥳",
    "😎",
    "🤓",
    "🧐",
    "😕",
    "😟",
    "🙁",
    "☹️",
    "😮",
    "😯",
    "😲",
    "😳",
    "🥺",
    "😦",
    "😧",
    "😨",
    "😰",
    "😥",
    "😢",
    "😭",
    "😱",
    "😖",
    "😣",
    "😞",
    "😓",
    "😩",
    "👍",
    "👎",
    "👌",
    "✌️",
    "🤞",
    "🤟",
    "🤘",
    "🤙",
    "👈",
    "👉",
    "👆",
    "👇",
    "☝️",
    "👋",
    "🤚",
    "🖐️",
    "✋",
    "🖖",
    "👏",
    "🙌",
    "🔥",
    "⭐",
    "✨",
    "💫",
    "💥",
    "💢",
    "💦",
    "💨",
    "🎉",
    "🎊",
    "❤️",
    "🧡",
    "💛",
    "💚",
    "💙",
    "💜",
    "🖤",
    "🤍",
    "🤎",
    "💔",
  ];

  const defaultMsg: MessageData = { id: 'default', label: '/start', type: 'text', content: '', inlineKeyboard: [], disableWebPagePreview: false };
  const activeMsg = (messages.length > 0 ? (messages.find((m: MessageData) => m.id === activeMsgId) || messages[0]) : defaultMsg);

  const updateActiveMsg = (field: keyof MessageData, value: any) => {
    const targetId = activeMsg.id;
    setMessages((msgs: MessageData[]) =>
      msgs.map((m: MessageData) => (m.id === targetId ? { ...m, [field]: value } : m)),
    );
  };

  const addMessage = () => {
    const newId = uuid();
    const randomCmd = `cmd_${Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, "0")}`;
    setMessages([
      ...messages,
      {
        id: newId,
        label: `/${randomCmd}`,
        type: "text",
        content: "",
        inlineKeyboard: [],
        disableWebPagePreview: false,
      },
    ]);
    setActiveMsgId(newId);
  };

  const removeActiveMessage = () => {
    if (messages.length <= 1) return;

    // 获取要删除的消息的 label（触发词）
    const msgToRemove = messages.find((m: MessageData) => m.id === activeMsgId);

    // 从 messages 中移除
    const newMsgs = messages.filter((m: MessageData) => m.id !== activeMsgId);
    setMessages(newMsgs);
    if (newMsgs.length > 0) {
      setActiveMsgId(newMsgs[0].id);
    }

    // 同时从 autoReplyRules 中删除对应的规则（根据 label 匹配）
    if (msgToRemove?.label) {
      const cleanTrigger = msgToRemove.label.trim().replace(/^\//, "");
      setAutoReplyRules((prev: AutoReplyRule[]) => {
        const filtered = prev.filter((r: AutoReplyRule) => {
          const ruleClean = r.triggerValue.trim().replace(/^\//, "").toLowerCase();
          return ruleClean !== cleanTrigger.toLowerCase();
        });
        // 如果有删除规则，记录日志
        if (filtered.length !== prev.length) {
          console.log(`[AutoSync] Removed auto-reply rule for: ${msgToRemove.label}`);
        }
        return filtered;
      });
    }
  };

  const openCopyInserter = () => {
    setCopyText("");
    setShowCopyInserter(true);
    setShowLinkInserter(false);
    setShowEmojiPicker(false);
  };
  const confirmInsertCopy = () => {
    if (!copyText) return;
    const codeString = `<code>${copyText}</code>`;
    updateActiveMsg("content", activeMsg.content + codeString);
    setShowCopyInserter(false);
  };

  const openLinkInserter = () => {
    setLinkForm({ text: "", url: "" });
    setShowLinkInserter(true);
    setShowCopyInserter(false);
    setShowEmojiPicker(false);
  };
  const confirmInsertLink = () => {
    if (!linkForm.url) return;
    const linkString = `<a href="${linkForm.url}">${linkForm.text || "链接"}</a>`;
    updateActiveMsg("content", activeMsg.content + linkString);
    setShowLinkInserter(false);
  };

  const openEmojiPicker = () => {
    setShowEmojiPicker(true);
    setShowLinkInserter(false);
    setShowCopyInserter(false);
  };
  const insertEmoji = (emoji: string) => {
    updateActiveMsg("content", activeMsg.content + emoji);
  };

  const addInlineRow = () => {
    const currentKb = activeMsg.inlineKeyboard || [];
    updateActiveMsg("inlineKeyboard", [...currentKb, [{ text: t('km.keyboard.newButton'), type: "url", value: "" }]]);
  };

  const addInlineCol = (rIdx: number) => {
    const currentKb = [...(activeMsg.inlineKeyboard || [])];
    if (currentKb[rIdx].length < 3) {
      currentKb[rIdx].push({ text: t('km.keyboard.newButton'), type: "url", value: "" });
      updateActiveMsg("inlineKeyboard", currentKb);
    }
  };

  const removeInlineBtn = (rIdx: number, cIdx: number) => {
    const currentKb = [...(activeMsg.inlineKeyboard || [])];
    currentKb[rIdx] = currentKb[rIdx].filter((_: any, i: number) => i !== cIdx);
    if (currentKb[rIdx].length === 0) {
      updateActiveMsg(
        "inlineKeyboard",
        currentKb.filter((_: any, i: number) => i !== rIdx),
      );
    } else {
      updateActiveMsg("inlineKeyboard", currentKb);
    }
  };

  const updateBtn = (rIdx: number, cIdx: number, field: string, val: string) => {
    const currentKb = [...(activeMsg.inlineKeyboard || [])];
    const row = [...currentKb[rIdx]];
    row[cIdx] = { ...row[cIdx], [field]: val };
    currentKb[rIdx] = row;
    updateActiveMsg("inlineKeyboard", currentKb);
  };

  // 验证内联按钮是否填写了必要的值
  const validateInlineButtons = (): string | null => {
    const inlineKeyboard = activeMsg.inlineKeyboard || [];
    for (let rIdx = 0; rIdx < inlineKeyboard.length; rIdx++) {
      const row = inlineKeyboard[rIdx];
      for (let cIdx = 0; cIdx < row.length; cIdx++) {
        const btn = row[cIdx];
        if (!btn.text || !btn.text.trim()) {
          return `${t('km.message.row')} ${rIdx + 1} ${t('km.message.column')} ${cIdx + 1} ${t('km.message.btn')} ${t('km.message.btnMissingText')}`;
        }
        if (!btn.value || !btn.value.trim()) {
          if (btn.type === "url") {
            return `${t('km.message.row')} ${rIdx + 1} ${t('km.message.column')} ${cIdx + 1} ${t('km.message.btn')} "${btn.text}" ${t('km.message.btnMissingUrl')}`;
          } else if (btn.type === "callback_data") {
            return `${t('km.message.row')} ${rIdx + 1} ${t('km.message.column')} ${cIdx + 1} ${t('km.message.btn')} "${btn.text}" ${t('km.message.btnMissingCallback')}`;
          } else if (btn.type === "web_app") {
            return `${t('km.message.row')} ${rIdx + 1} ${t('km.message.column')} ${cIdx + 1} ${t('km.message.btn')} "${btn.text}" ${t('km.message.btnMissingWebApp')}`;
          }
        }
        // 额外验证 URL 格式
        if (btn.type === "url" || btn.type === "web_app") {
          if (btn.value && !btn.value.startsWith("http://") && !btn.value.startsWith("https://")) {
            return `${t('km.message.row')} ${rIdx + 1} ${t('km.message.column')} ${cIdx + 1} ${t('km.message.btn')} "${btn.text}" ${t('km.message.urlMustStartWith')}`;
          }
        }
      }
    }
    return null;
  };

  const saveAsAutoCommand = () => {
    // 检查试用是否过期
    if (keyboardTrialExpired) {
      showTrialExpiredToast();
      return;
    }

    // 先验证内联按钮
    const validationError = validateInlineButtons();
    if (validationError) {
      showToast("error", validationError);
      return;
    }

    const rawLabel = activeMsg.label || `cmd_${uuid().substring(0, 5)}`;
    const trigger = rawLabel.trim();
    const isCommand = trigger.startsWith("/");
    const type = isCommand ? "command" : "keyword";
    const cleanTrigger = isCommand ? trigger.replace(/^\//, "") : trigger;

    setAutoReplyRules((prev: AutoReplyRule[]) => {
      const existingIdx = prev.findIndex(
        (r: AutoReplyRule) => r.triggerValue === cleanTrigger && r.triggerType === type,
      );
      const newRule: AutoReplyRule = {
        id: uuid(),
        triggerType: type,
        triggerValue: cleanTrigger,
        replyMessages: [{ ...activeMsg }],
      };
      if (existingIdx !== -1) {
        const updated = [...prev];
        updated[existingIdx] = newRule;
        return updated;
      }
      return [...prev, newRule];
    });
    showToast("success", `${t('km.message.savedAsAutoReply')}: ${trigger}`);
    // 自动同步到云端
    setTimeout(() => {
      syncConfigToCloud?.();
    }, 100);
  };

  // 发送至目标 - 检查试用状态
  const handleSendFlow = () => {
    if (keyboardTrialExpired) {
      showTrialExpiredToast();
      return;
    }
    onSendFlow(activeMsg);
  };

  return (
    <div className="space-y-6">
      <div className="border-b pb-4 flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold mb-1">{t('km.message.title')}</h2>
          <p className="text-xs text-muted-foreground">{t('km.message.desc')}</p>
        </div>
        <button
          onClick={addMessage}
          className="text-xs bg-primary/10 text-primary px-3 py-1.5 rounded-lg hover:bg-primary/20 font-bold flex items-center gap-1"
        >
          <Plus size={14} /> {t('km.message.newMessage')}
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 border-b">
        {messages.map((m: MessageData) => (
          <div
            key={m.id}
            onClick={() => setActiveMsgId(m.id)}
            className={`px-3 py-1.5 rounded-lg cursor-pointer text-xs font-bold flex items-center gap-2 whitespace-nowrap transition-colors ${activeMsgId === m.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}
          >
            <Hash size={12} />
            {m.label || t('km.message.message')}
          </div>
        ))}
      </div>

      <div className="bg-card p-6 rounded-xl border shadow-sm space-y-4">
        <div className="flex items-center gap-2 border-b pb-3">
          <Tag size={14} className="text-muted-foreground" />
          <input
            value={activeMsg.label || ""}
            onChange={(e) => updateActiveMsg("label", e.target.value)}
            className="font-bold outline-none flex-1 bg-transparent"
            placeholder={t('km.message.triggerLabel')}
          />
          {messages.length > 1 && (
            <button onClick={removeActiveMessage} className="text-destructive hover:bg-destructive/10 p-1 rounded">
              <Trash2 size={14} />
            </button>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex gap-2">
            <select
              value={activeMsg.type}
              onChange={(e) => updateActiveMsg("type", e.target.value)}
              className="border rounded-lg px-3 py-2 text-sm outline-none"
            >
              <option value="text">{t('km.message.textMsg')}</option>
              <option value="photo">{t('km.message.photoMsg')}</option>
              <option value="video">{t('km.message.videoMsg')}</option>
            </select>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={activeMsg.disableWebPagePreview || false}
                onChange={(e) => updateActiveMsg("disableWebPagePreview", e.target.checked)}
                className="rounded"
              />
              {t('km.message.disableLinkPreview')}
            </div>
          </div>

          {activeMsg.type === "photo" && (
            <input
              value={activeMsg.mediaUrl || ""}
              onChange={(e) => updateActiveMsg("mediaUrl", e.target.value)}
              placeholder={t('km.message.photoUrl')}
              className="w-full border rounded-lg px-3 py-2 text-sm outline-none"
            />
          )}

          {activeMsg.type === "video" && (
            <input
              value={activeMsg.mediaUrl || ""}
              onChange={(e) => updateActiveMsg("mediaUrl", e.target.value)}
              placeholder={t('km.message.videoUrl')}
              className="w-full border rounded-lg px-3 py-2 text-sm outline-none"
            />
          )}

          <div className="relative">
            <textarea
              value={activeMsg.content}
              onChange={(e) => updateActiveMsg("content", e.target.value)}
              placeholder={t('km.message.content')}
              className="w-full h-32 border rounded-lg px-3 py-2 text-sm outline-none resize-none font-mono"
            />
            <div className="absolute bottom-2 right-2 flex gap-1">
              <button
                onClick={openLinkInserter}
                className="px-2 py-1 bg-muted hover:bg-accent rounded text-muted-foreground flex items-center gap-1 text-[10px]"
                title={t('km.message.link')}
              >
                <LinkIcon size={12} />
                <span>{t('km.message.link')}</span>
              </button>
              <button
                onClick={openCopyInserter}
                className="px-2 py-1 bg-muted hover:bg-accent rounded text-muted-foreground flex items-center gap-1 text-[10px]"
                title={t('km.message.copyableText')}
              >
                <Copy size={12} />
                <span>{t('km.message.copy')}</span>
              </button>
              <button
                onClick={openEmojiPicker}
                className="px-2 py-1 bg-muted hover:bg-accent rounded text-muted-foreground flex items-center gap-1 text-[10px]"
                title={t('km.message.selectEmoji')}
              >
                <Smile size={12} />
                <span>{t('km.message.emoji')}</span>
              </button>
            </div>
          </div>

          {showLinkInserter && (
            <div className="bg-muted p-3 rounded-lg space-y-2 animate-in fade-in">
              <input
                value={linkForm.text}
                onChange={(e) => setLinkForm({ ...linkForm, text: e.target.value })}
                placeholder={t('km.message.linkText')}
                className="w-full border rounded px-2 py-1 text-sm outline-none"
              />
              <input
                value={linkForm.url}
                onChange={(e) => setLinkForm({ ...linkForm, url: e.target.value })}
                placeholder={t('km.message.linkUrl')}
                className="w-full border rounded px-2 py-1 text-sm outline-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={confirmInsertLink}
                  className="bg-primary text-primary-foreground px-3 py-1 rounded text-xs font-bold"
                >
                  {t('km.message.insert')}
                </button>
                <button
                  onClick={() => setShowLinkInserter(false)}
                  className="bg-muted-foreground/20 px-3 py-1 rounded text-xs"
                >
                  {t('km.message.cancel')}
                </button>
              </div>
            </div>
          )}

          {showCopyInserter && (
            <div className="bg-muted p-3 rounded-lg space-y-2 animate-in fade-in">
              <input
                value={copyText}
                onChange={(e) => setCopyText(e.target.value)}
                placeholder={t('km.message.copyableText')}
                className="w-full border rounded px-2 py-1 text-sm outline-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={confirmInsertCopy}
                  className="bg-primary text-primary-foreground px-3 py-1 rounded text-xs font-bold"
                >
                  {t('km.message.insert')}
                </button>
                <button
                  onClick={() => setShowCopyInserter(false)}
                  className="bg-muted-foreground/20 px-3 py-1 rounded text-xs"
                >
                  {t('km.message.cancel')}
                </button>
              </div>
            </div>
          )}

          {showEmojiPicker && (
            <div className="bg-muted p-3 rounded-lg animate-in fade-in">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold text-muted-foreground">{t('km.message.selectEmoji')}</span>
                <button
                  onClick={() => setShowEmojiPicker(false)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X size={14} />
                </button>
              </div>
              <div className="grid grid-cols-10 gap-1 max-h-40 overflow-y-auto">
                {telegramEmojis.map((emoji, idx) => (
                  <button
                    key={idx}
                    onClick={() => insertEmoji(emoji)}
                    className="w-8 h-8 flex items-center justify-center text-lg hover:bg-accent rounded transition"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="border-t pt-4">
          <div className="flex justify-between items-center mb-3">
            <h4 className="text-sm font-bold">{t('km.message.inlineButtons')}</h4>
            <button
              onClick={addInlineRow}
              className="text-xs bg-muted hover:bg-accent px-2 py-1 rounded flex items-center gap-1"
            >
              <Plus size={12} /> {t('km.message.addRow')}
            </button>
          </div>
          <div className="space-y-2">
            {(activeMsg.inlineKeyboard || []).map((row: InlineButton[], rIdx: number) => (
              <div key={rIdx} className="flex gap-2 bg-muted p-2 rounded-lg">
                {row.map((btn: InlineButton, cIdx: number) => (
                  <div key={cIdx} className="flex-1 bg-card p-2 rounded border space-y-1">
                    <div className="flex justify-between">
                      <input
                        value={btn.text}
                        onChange={(e) => updateBtn(rIdx, cIdx, "text", e.target.value)}
                        className="w-full text-xs font-bold outline-none bg-transparent"
                        placeholder={t('km.message.btnText')}
                      />
                      <button onClick={() => removeInlineBtn(rIdx, cIdx)} className="text-destructive">
                        <X size={12} />
                      </button>
                    </div>
                    <select
                      value={btn.type}
                      onChange={(e) => updateBtn(rIdx, cIdx, "type", e.target.value)}
                      className="w-full text-[10px] bg-muted border rounded px-1 py-0.5 outline-none"
                    >
                      <option value="url">{t('km.message.urlType')}</option>
                      <option value="callback_data">{t('km.message.callbackType')}</option>
                      <option value="web_app">{t('km.message.webAppType')}</option>
                    </select>
                    <input
                      value={btn.value}
                      onChange={(e) => updateBtn(rIdx, cIdx, "value", e.target.value)}
                      placeholder={t('km.message.value')}
                      className="w-full text-[10px] border rounded px-1 py-0.5 outline-none"
                    />
                  </div>
                ))}
                {row.length < 3 && (
                  <button
                    onClick={() => addInlineCol(rIdx)}
                    className="w-8 flex items-center justify-center border border-dashed rounded text-muted-foreground hover:text-primary"
                  >
                    <Plus size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="border-t pt-4 grid grid-cols-2 gap-3">
          <button
            onClick={saveAsAutoCommand}
            className="w-full bg-muted hover:bg-accent py-2.5 rounded-lg font-bold text-sm flex items-center justify-center gap-2"
          >
            <Save size={16} /> {t('km.message.saveAsAutoReply')}
          </button>
          <button
            onClick={() => handleSendFlow()}
            disabled={!isConnected || !targetChatId}
            className="w-full bg-primary hover:bg-primary/90 disabled:bg-muted text-primary-foreground py-2.5 rounded-lg font-bold text-sm flex items-center justify-center gap-2"
          >
            <Send size={16} /> {t('km.message.sendToTarget')}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Users Panel ---
function UsersPanel({
  knownUsers,
  setKnownUsers,
  showToast,
  callApi,
  menuPages,
  setTargetChatId,
  handlePushMenu,
  botToken,
  adminUserId,
}: any) {
  const { t } = useLanguage();
  const [dbUsers, setDbUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [blockedUsers, setBlockedUsers] = useState<Record<number, boolean>>({});
  const [togglingBlock, setTogglingBlock] = useState<number | null>(null);
  const [userPage, setUserPage] = useState(1);
  const [blacklistPage, setBlacklistPage] = useState(1);
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [blacklistSearchQuery, setBlacklistSearchQuery] = useState("");
  const [selectedNormalUsers, setSelectedNormalUsers] = useState<Set<number>>(new Set());
  const [selectedBlacklistUsers, setSelectedBlacklistUsers] = useState<Set<number>>(new Set());
  const [batchProcessing, setBatchProcessing] = useState(false);
  const [batchUnblockProcessing, setBatchUnblockProcessing] = useState(false);
  const PAGE_SIZE = 500;
  const FETCH_BATCH_SIZE = 1000;

  // 从数据库分批加载全部用户（绕过默认 1000 行限制）
  const loadUsersFromDb = async () => {
    if (!botToken) {
      setDbUsers([]);
      return;
    }

    const allUsers: any[] = [];
    let from = 0;

    while (true) {
      const { data, error } = await supabase
        .from("bot_users")
        .select("*")
        .eq("bot_token", botToken)
        .order("last_seen_at", { ascending: false })
        .range(from, from + FETCH_BATCH_SIZE - 1);

      if (error) throw error;

      const chunk = data || [];
      allUsers.push(...chunk);

      if (chunk.length < FETCH_BATCH_SIZE) break;
      from += FETCH_BATCH_SIZE;
    }

    // 按 telegram_user_id 去重，保留最新（last_seen_at 最大）的记录
    const uniqueMap = new Map<string, any>();
    for (const u of allUsers) {
      const uid = String(u.telegram_user_id);
      const existing = uniqueMap.get(uid);
      if (!existing || new Date(u.last_seen_at) > new Date(existing.last_seen_at)) {
        uniqueMap.set(uid, u);
      }
    }
    setDbUsers(Array.from(uniqueMap.values()));
  };

  // 分批加载全部黑名单状态（绕过默认 1000 行限制）
  const loadBlockedStatus = async () => {
    if (!botToken) {
      setBlockedUsers({});
      return;
    }

    const blocked: Record<number, boolean> = {};
    let from = 0;

    while (true) {
      const { data, error } = await supabase
        .from("bot_rate_limits")
        .select("telegram_user_id")
        .eq("bot_token", botToken)
        .eq("is_blocked", true)
        .order("telegram_user_id", { ascending: true })
        .range(from, from + FETCH_BATCH_SIZE - 1);

      if (error) throw error;

      const chunk = data || [];
      chunk.forEach((r: any) => {
        blocked[r.telegram_user_id] = true;
      });

      if (chunk.length < FETCH_BATCH_SIZE) break;
      from += FETCH_BATCH_SIZE;
    }

    setBlockedUsers(blocked);
  };

  const loadAllUserData = async () => {
    setLoading(true);
    try {
      await Promise.all([loadUsersFromDb(), loadBlockedStatus()]);
    } catch (e: any) {
      console.error("Failed to load user panel data:", e);
      showToast("error", `加载失败: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  // 切换黑名单状态
  const toggleBlacklist = async (telegramUserId: number, userName: string) => {
    if (!botToken) return;
    setTogglingBlock(telegramUserId);
    const isCurrentlyBlocked = blockedUsers[telegramUserId] || false;

    try {
      if (isCurrentlyBlocked) {
        // 解除黑名单 - 删除记录或更新为非拉黑
        const { error } = await supabase
          .from("bot_rate_limits")
          .update({ is_blocked: false, blocked_at: null, blocked_reason: null, updated_at: new Date().toISOString() })
          .eq("bot_token", botToken)
          .eq("telegram_user_id", telegramUserId);
        if (error) throw error;
        setBlockedUsers((prev) => {
          const next = { ...prev };
          delete next[telegramUserId];
          return next;
        });
        showToast("success", `已解除黑名单: ${userName}`);
      } else {
        // 加入黑名单 - upsert记录
        const { data: existing } = await supabase
          .from("bot_rate_limits")
          .select("id")
          .eq("bot_token", botToken)
          .eq("telegram_user_id", telegramUserId)
          .maybeSingle();

        if (existing) {
          const { error } = await supabase
            .from("bot_rate_limits")
            .update({ is_blocked: true, blocked_at: new Date().toISOString(), blocked_reason: "手动拉黑", updated_at: new Date().toISOString() })
            .eq("id", existing.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("bot_rate_limits").insert({
            bot_token: botToken,
            telegram_user_id: telegramUserId,
            is_blocked: true,
            blocked_at: new Date().toISOString(),
            blocked_reason: "手动拉黑",
            message_count: 0,
          });
          if (error) throw error;
        }
        setBlockedUsers((prev) => ({ ...prev, [telegramUserId]: true }));
        showToast("success", `已加入黑名单: ${userName}`);
      }
    } catch (e: any) {
      showToast("error", `操作失败: ${e.message}`);
    } finally {
      setTogglingBlock(null);
    }
  };

  // 批量拉黑 - 使用upsert批量操作提速
  const batchBlock = async () => {
    if (!botToken || selectedNormalUsers.size === 0) return;
    if (!confirm(`确定要将选中的 ${selectedNormalUsers.size} 个用户加入黑名单？`)) return;
    setBatchProcessing(true);
    try {
      const now = new Date().toISOString();
      const rows = Array.from(selectedNormalUsers).map(uid => ({
        bot_token: botToken,
        telegram_user_id: uid,
        is_blocked: true,
        blocked_at: now,
        blocked_reason: "批量拉黑",
        message_count: 0,
        updated_at: now,
      }));
      let failedCount = 0;
      // 分批upsert，每批500条
      for (let i = 0; i < rows.length; i += 500) {
        const batch = rows.slice(i, i + 500);
        const { error } = await supabase.from("bot_rate_limits").upsert(batch, { onConflict: "bot_token,telegram_user_id", ignoreDuplicates: false });
        if (error) {
          console.error(`Batch block upsert error at ${i}:`, error.message);
          failedCount += batch.length;
        }
      }
      // 操作完成后从数据库重新加载真实状态
      await loadBlockedStatus();
      const count = selectedNormalUsers.size;
      setSelectedNormalUsers(new Set());
      if (failedCount > 0) {
        showToast("error", `批量拉黑部分失败：${count - failedCount}/${count} 成功`);
      } else {
        showToast("success", `已批量拉黑 ${count} 个用户`);
      }
    } catch (e: any) {
      showToast("error", `批量拉黑失败: ${e.message}`);
    } finally {
      setBatchProcessing(false);
    }
  };

  // 批量解除黑名单 - 使用in批量操作提速
  const batchUnblock = async () => {
    if (!botToken || selectedBlacklistUsers.size === 0) return;
    if (!confirm(`确定要解除选中的 ${selectedBlacklistUsers.size} 个用户的黑名单？`)) return;
    setBatchUnblockProcessing(true);
    try {
      const uids = Array.from(selectedBlacklistUsers);
      let failedCount = 0;
      // 分批更新，每批500条
      for (let i = 0; i < uids.length; i += 500) {
        const batch = uids.slice(i, i + 500);
        const { error } = await supabase.from("bot_rate_limits").update({ is_blocked: false, blocked_at: null, blocked_reason: null, updated_at: new Date().toISOString() }).eq("bot_token", botToken).in("telegram_user_id", batch);
        if (error) {
          console.error(`Batch unblock error at ${i}:`, error.message);
          failedCount += batch.length;
        }
      }
      // 从数据库重新加载真实状态
      await loadBlockedStatus();
      const count = selectedBlacklistUsers.size;
      setSelectedBlacklistUsers(new Set());
      if (failedCount > 0) {
        showToast("error", `批量解除部分失败：${count - failedCount}/${count} 成功`);
      } else {
        showToast("success", `已批量解除 ${count} 个用户`);
      }
    } catch (e: any) {
      showToast("error", `批量解除失败: ${e.message}`);
    } finally {
      setBatchUnblockProcessing(false);
    }
  };

  const toggleSelectUser = (uid: number, isBlacklisted: boolean) => {
    const setter = isBlacklisted ? setSelectedBlacklistUsers : setSelectedNormalUsers;
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid); else next.add(uid);
      return next;
    });
  };


  useEffect(() => {
    loadAllUserData();

    if (!botToken) return;

    const usersChannel = supabase
      .channel(`bot-users-changes-${botToken}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bot_users", filter: `bot_token=eq.${botToken}` },
        () => {
          loadUsersFromDb().catch((e) => console.error("Realtime load users failed:", e));
        },
      )
      .subscribe();

    const blacklistChannel = supabase
      .channel(`bot-rate-limits-changes-${botToken}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bot_rate_limits", filter: `bot_token=eq.${botToken}` },
        () => {
          loadBlockedStatus().catch((e) => console.error("Realtime load blocked status failed:", e));
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(usersChannel);
      supabase.removeChannel(blacklistChannel);
    };
  }, [botToken]);

  // 删除单个用户
  const deleteUser = async (userId: string, telegramUserId: number) => {
    setDeleting(userId);
    try {
      const { error } = await supabase.from("bot_users").delete().eq("id", userId);
      if (error) throw error;
      setDbUsers((prev) => prev.filter((u) => u.id !== userId));
      showToast("success", `${t('km.users.deleted')}: ${telegramUserId}`);
    } catch (e: any) {
      showToast("error", `${t('km.users.deleteFailed')}: ${e.message}`);
    } finally {
      setDeleting(null);
    }
  };

  // 分离正常用户和黑名单用户
  const normalUsers = dbUsers.filter((u) => !blockedUsers[u.telegram_user_id]);
  const blacklistedUsers = dbUsers.filter((u) => blockedUsers[u.telegram_user_id]);

  // 搜索过滤函数
  const filterUsers = (users: any[], query: string) => {
    if (!query.trim()) return users;
    const q = query.trim().toLowerCase();
    return users.filter((u: any) =>
      String(u.telegram_user_id).includes(q) ||
      (u.first_name && u.first_name.toLowerCase().includes(q)) ||
      (u.last_name && u.last_name.toLowerCase().includes(q)) ||
      (u.username && u.username.toLowerCase().includes(q))
    );
  };

  const filteredNormalUsers = filterUsers(normalUsers, userSearchQuery);
  const filteredBlacklistUsers = filterUsers(blacklistedUsers, blacklistSearchQuery);

  // 分页
  const normalTotalPages = Math.max(1, Math.ceil(filteredNormalUsers.length / PAGE_SIZE));
  const blacklistTotalPages = Math.max(1, Math.ceil(filteredBlacklistUsers.length / PAGE_SIZE));
  const pagedNormalUsers = filteredNormalUsers.slice((userPage - 1) * PAGE_SIZE, userPage * PAGE_SIZE);
  const pagedBlacklistUsers = filteredBlacklistUsers.slice((blacklistPage - 1) * PAGE_SIZE, blacklistPage * PAGE_SIZE);

  useEffect(() => {
    if (userPage > normalTotalPages) setUserPage(normalTotalPages);
  }, [userPage, normalTotalPages]);

  useEffect(() => {
    if (blacklistPage > blacklistTotalPages) setBlacklistPage(blacklistTotalPages);
  }, [blacklistPage, blacklistTotalPages]);
  const renderPagination = (currentPage: number, totalPages: number, setPage: (p: number) => void, total: number) => {
    if (totalPages <= 1) return null;
    return (
      <div className="flex items-center justify-between mt-3 px-2">
        <span className="text-xs text-muted-foreground">共 {total} 条，每页 {PAGE_SIZE} 条</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setPage(Math.max(1, currentPage - 1))}
            disabled={currentPage <= 1}
            className="px-2 py-1 text-xs rounded border bg-card hover:bg-muted disabled:opacity-40"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="text-xs px-2">{currentPage} / {totalPages}</span>
          <button
            onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage >= totalPages}
            className="px-2 py-1 text-xs rounded border bg-card hover:bg-muted disabled:opacity-40"
          >
            <ChevronLeft size={14} className="rotate-180" />
          </button>
        </div>
      </div>
    );
  };

  const renderUserRow = (u: any, isBlacklisted: boolean) => {
    const selected = isBlacklisted ? selectedBlacklistUsers.has(u.telegram_user_id) : selectedNormalUsers.has(u.telegram_user_id);
    return (
    <tr key={u.id} className="hover:bg-muted/50">
      <td className="px-2 py-3 w-8">
        <input
          type="checkbox"
          checked={selected}
          onChange={() => toggleSelectUser(u.telegram_user_id, isBlacklisted)}
          className="rounded border-muted-foreground"
        />
      </td>
      <td className="px-4 py-3 font-mono text-muted-foreground">{u.telegram_user_id}</td>
      <td className="px-4 py-3">
        <div className="font-medium">
          {u.first_name}
          {u.last_name ? ` ${u.last_name}` : ""}
        </div>
        {u.username && <div className="text-xs text-primary">@{u.username}</div>}
      </td>
      <td className="px-4 py-3 text-muted-foreground text-xs">
        {new Date(u.first_seen_at).toLocaleString("zh-CN")}
      </td>
      <td className="px-4 py-3 text-muted-foreground text-xs">
        {new Date(u.last_seen_at).toLocaleString("zh-CN")}
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex justify-end gap-2">
          {!isBlacklisted && (
            <>
              <button
                onClick={() => {
                  setTargetChatId(u.telegram_user_id.toString());
                  showToast("success", `${t('km.users.locked')}: ${u.first_name}`);
                }}
                className="flex items-center gap-1 bg-muted hover:bg-accent px-2 py-1.5 rounded text-xs transition"
                title={t('km.users.lock')}
              >
                <Target size={14} /> {t('km.users.lock')}
              </button>
              <button
                onClick={() => handlePushMenu(u.telegram_user_id, u.first_name)}
                className="flex items-center gap-1 bg-primary/10 hover:bg-primary/20 text-primary px-2 py-1.5 rounded text-xs transition font-medium"
                title={t('km.users.push')}
              >
                <SendHorizontal size={14} /> {t('km.users.push')}
              </button>
            </>
          )}
          <button
            onClick={() => toggleBlacklist(u.telegram_user_id, u.first_name)}
            disabled={togglingBlock === u.telegram_user_id}
            className={`flex items-center gap-1 px-2 py-1.5 rounded text-xs transition font-medium ${
              isBlacklisted
                ? "bg-green-500/10 hover:bg-green-500/20 text-green-600"
                : "bg-red-500/10 hover:bg-red-500/20 text-red-600"
            }`}
            title={isBlacklisted ? "解除黑名单" : "加入黑名单"}
          >
            {togglingBlock === u.telegram_user_id ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Shield size={14} />
            )}
            {isBlacklisted ? "解除" : "拉黑"}
          </button>
          <button
            onClick={() => deleteUser(u.id, u.telegram_user_id)}
            disabled={deleting === u.id}
            className="flex items-center gap-1 bg-destructive/10 hover:bg-destructive/20 text-destructive px-2 py-1.5 rounded text-xs transition"
            title={t('common.delete')}
          >
            {deleting === u.id ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
          </button>
        </div>
      </td>
    </tr>
    );
  };

  const isAllNormalSelected = pagedNormalUsers.length > 0 && pagedNormalUsers.every((u: any) => selectedNormalUsers.has(u.telegram_user_id));
  const isAllBlacklistSelected = pagedBlacklistUsers.length > 0 && pagedBlacklistUsers.every((u: any) => selectedBlacklistUsers.has(u.telegram_user_id));

  const toggleSelectAllNormal = () => {
    if (isAllNormalSelected) {
      setSelectedNormalUsers((prev) => {
        const next = new Set(prev);
        pagedNormalUsers.forEach((u: any) => next.delete(u.telegram_user_id));
        return next;
      });
    } else {
      setSelectedNormalUsers((prev) => {
        const next = new Set(prev);
        pagedNormalUsers.forEach((u: any) => next.add(u.telegram_user_id));
        return next;
      });
    }
  };

  const toggleSelectAllBlacklist = () => {
    if (isAllBlacklistSelected) {
      setSelectedBlacklistUsers((prev) => {
        const next = new Set(prev);
        pagedBlacklistUsers.forEach((u: any) => next.delete(u.telegram_user_id));
        return next;
      });
    } else {
      setSelectedBlacklistUsers((prev) => {
        const next = new Set(prev);
        pagedBlacklistUsers.forEach((u: any) => next.add(u.telegram_user_id));
        return next;
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="border-b pb-4 flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold mb-1">{t('km.users.title')}</h2>
          <p className="text-xs text-muted-foreground">
            {t('km.users.total')} {dbUsers.length} {t('km.users.users')}（正常: {normalUsers.length}，黑名单: {blacklistedUsers.length}）{botToken ? t('km.users.realTimeSync') : t('km.users.notConnected')}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadAllUserData}
            disabled={loading}
            className="text-xs text-primary hover:bg-primary/10 px-2 py-1 rounded flex items-center gap-1"
          >
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} /> {t('km.users.refresh')}
          </button>
          <button
            onClick={async () => {
              if (!botToken) {
                showToast("error", t('km.users.connectFirst'));
                return;
              }
              if (!confirm(t('km.users.confirmClear'))) return;
              try {
                const { error } = await supabase.from("bot_users").delete().eq("bot_token", botToken);
                if (error) throw error;
                setDbUsers([]);
                showToast("info", t('km.users.cleared'));
              } catch (e: any) {
                showToast("error", `${t('km.users.clearFailed')}: ${e.message}`);
              }
            }}
            className="text-xs text-destructive hover:bg-destructive/10 px-2 py-1 rounded"
          >
            {t('km.users.clearData')}
          </button>
        </div>
      </div>

      {/* 正常用户列表 */}
      <div className="bg-card p-6 rounded-xl border shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h4 className="font-bold flex items-center gap-2">
              <Users size={18} /> {t('km.users.userList')}
              <span className="text-xs font-normal ml-2 flex items-center gap-1.5">
                <span className="text-green-600">({filteredNormalUsers.length}{userSearchQuery ? ` / ${normalUsers.length}` : ''})</span>
                <span className="text-muted-foreground">·</span>
                <span className="text-muted-foreground">黑名单 {blacklistedUsers.length}</span>
                <span className="text-muted-foreground">·</span>
                <span className="text-muted-foreground">总计 {dbUsers.length}</span>
              </span>
            </h4>
            {selectedNormalUsers.size > 0 && (
              <button
                onClick={batchBlock}
                disabled={batchProcessing}
                className="flex items-center gap-1 bg-red-500/10 hover:bg-red-500/20 text-red-600 px-3 py-1.5 rounded text-xs transition font-medium"
              >
                {batchProcessing ? <Loader2 size={14} className="animate-spin" /> : <Shield size={14} />}
                一键拉黑 ({selectedNormalUsers.size})
              </button>
            )}
          </div>
          <div className="relative w-64">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={userSearchQuery}
              onChange={(e) => { setUserSearchQuery(e.target.value); setUserPage(1); }}
              placeholder="搜索用户ID / 昵称 / 用户名"
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-muted border-b">
              <tr>
                <th className="px-2 py-3 w-8">
                  <input type="checkbox" checked={isAllNormalSelected} onChange={toggleSelectAllNormal} className="rounded border-muted-foreground" />
                </th>
                <th className="px-4 py-3">{t('km.users.userId')}</th>
                <th className="px-4 py-3">{t('km.users.nickname')}</th>
                <th className="px-4 py-3">{t('km.users.firstSeen')}</th>
                <th className="px-4 py-3">{t('km.users.lastActive')}</th>
                <th className="px-4 py-3 text-right">{t('km.users.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    <Loader2 size={20} className="animate-spin mx-auto mb-2" />
                    {t('km.users.loading')}
                  </td>
                </tr>
              ) : pagedNormalUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    {t('km.users.noData')}
                  </td>
                </tr>
              ) : (
                pagedNormalUsers.map((u: any) => renderUserRow(u, false))
              )}
            </tbody>
          </table>
        </div>
        {renderPagination(userPage, normalTotalPages, setUserPage, normalUsers.length)}
      </div>

      {/* 黑名单列表 */}
      <div className="bg-card p-6 rounded-xl border shadow-sm border-red-500/20">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h4 className="font-bold flex items-center gap-2 text-red-600">
              <Shield size={18} /> 黑名单用户
              <span className="text-xs font-normal ml-2 flex items-center gap-1.5">
                <span className="text-red-600">({filteredBlacklistUsers.length}{blacklistSearchQuery ? ` / ${blacklistedUsers.length}` : ''})</span>
                <span className="text-muted-foreground">·</span>
                <span className="text-muted-foreground">正常 {normalUsers.length}</span>
                <span className="text-muted-foreground">·</span>
                <span className="text-muted-foreground">总计 {dbUsers.length}</span>
              </span>
            </h4>
            {selectedBlacklistUsers.size > 0 && (
              <button
                onClick={batchUnblock}
                disabled={batchUnblockProcessing}
                className="flex items-center gap-1 bg-green-500/10 hover:bg-green-500/20 text-green-600 px-3 py-1.5 rounded text-xs transition font-medium"
              >
                {batchUnblockProcessing ? <Loader2 size={14} className="animate-spin" /> : <Shield size={14} />}
                一键解除 ({selectedBlacklistUsers.size})
              </button>
            )}
          </div>
          <div className="relative w-64">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={blacklistSearchQuery}
              onChange={(e) => { setBlacklistSearchQuery(e.target.value); setBlacklistPage(1); }}
              placeholder="搜索用户ID / 昵称 / 用户名"
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          黑名单中的用户发送的所有消息（包括 /start）都会被自动忽略，即使删除机器人重新开始也无法绕过。
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-muted border-b">
              <tr>
                <th className="px-2 py-3 w-8">
                  <input type="checkbox" checked={isAllBlacklistSelected} onChange={toggleSelectAllBlacklist} className="rounded border-muted-foreground" />
                </th>
                <th className="px-4 py-3">{t('km.users.userId')}</th>
                <th className="px-4 py-3">{t('km.users.nickname')}</th>
                <th className="px-4 py-3">{t('km.users.firstSeen')}</th>
                <th className="px-4 py-3">{t('km.users.lastActive')}</th>
                <th className="px-4 py-3 text-right">{t('km.users.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {blacklistedUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    暂无黑名单用户
                  </td>
                </tr>
              ) : (
                pagedBlacklistUsers.map((u: any) => renderUserRow(u, true))
              )}
            </tbody>
          </table>
        </div>
        {renderPagination(blacklistPage, blacklistTotalPages, setBlacklistPage, blacklistedUsers.length)}
      </div>
    </div>
  );
}

// --- Phone Simulator ---
function PhoneSimulator({ chatHistory, botProfile, menuPages, commands, isConnected, onSimulateInteraction }: any) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [activePageId, setActivePageId] = useState("main");

  const currentPage = menuPages.find((p: MenuPage) => p.id === activePageId) || menuPages[0];

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [chatHistory]);

  const handleBtnClick = (btn: ReplyButton) => {
    if (btn.actionType === "navigate" && btn.actionValue) {
      setActivePageId(btn.actionValue);
      return;
    }
    if (!onSimulateInteraction) return;
    onSimulateInteraction(btn.text);
  };

  const handleCommandClick = (cmd: string) => {
    setShowMenu(false);
    if (onSimulateInteraction) onSimulateInteraction("/" + cmd);
  };

  return (
    <div className="w-[280px] h-[640px] bg-card rounded-[32px] shadow-2xl overflow-hidden border-[8px] border-foreground relative flex flex-col shrink-0">
      <div className="bg-card/95 backdrop-blur-md border-b pt-8 pb-2 px-3 flex items-center justify-between z-20 shadow-sm">
        <div className="flex items-center gap-2">
          <ArrowLeft className="text-primary w-5 h-5 -ml-1" />
          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-bold border">
            {botProfile ? botProfile.first_name.charAt(0) : <Bot size={16} />}
          </div>
          <div className="overflow-hidden w-24">
            <h3 className="font-bold text-sm truncate">{botProfile?.first_name || "App Preview"}</h3>
            <p className="text-[10px] text-primary font-medium">bot</p>
          </div>
        </div>
        <MoreVertical className="text-muted-foreground w-4 h-4" />
      </div>
      <div
        className="flex-1 bg-[#86a8bd] overflow-y-auto p-2 space-y-2"
        ref={scrollRef}
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M11 18c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm48 25c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm-43-7c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm63 31c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM34 90c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm56-76c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM12 86c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm28-65c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm23-11c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-6 60c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm29 22c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zM32 63c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm57-13c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-9-21c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM60 91c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM35 41c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM12 60c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2z' fill='%237092a7' fill-opacity='0.2' fill-rule='evenodd'/%3E%3C/svg%3E")`,
        }}
      >
        <div className="text-center my-2">
          <span className="bg-black/20 text-white text-[10px] px-2 py-0.5 rounded-full backdrop-blur-sm">Today</span>
        </div>
        {chatHistory.map((msg: ChatMessage) => (
          <div key={msg.id} className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"} mb-2`}>
            {msg.sender === "bot" && (
              <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-500 mr-1.5 self-end mb-1 border border-white">
                {botProfile ? botProfile.first_name.charAt(0) : "B"}
              </div>
            )}
            <div className="max-w-[80%] flex flex-col items-start">
              {msg.type === "photo" && msg.mediaUrl && (
                <img src={msg.mediaUrl} alt="media" className="w-full rounded-t-xl object-cover max-h-32" />
              )}
              {/* 视频渲染支持 */}
              {msg.type === "video" && msg.mediaUrl && (
                <video src={msg.mediaUrl} controls className="w-full rounded-t-xl object-cover max-h-48" />
              )}
              <div
                className={`rounded-xl px-3 py-1.5 shadow-sm ${msg.sender === "user" ? "bg-[#a3d7a5] rounded-br-none text-slate-800" : "bg-white rounded-bl-none text-slate-700"}`}
              >
                <p
                  className="text-[11px] leading-relaxed whitespace-pre-wrap"
                  dangerouslySetInnerHTML={{
                    __html: msg.content
                      .replace(/<a href="(.*?)">(.*?)<\/a>/g, '<a href="$1" class="text-blue-600 underline">$2</a>')
                      .replace(
                        /<code>(.*?)<\/code>/g,
                        '<code class="bg-slate-100 px-1 rounded text-xs font-mono">$1</code>',
                      ),
                  }}
                />
                <span className="text-[8px] text-slate-400 block text-right mt-0.5">{msg.timestamp}</span>
              </div>
              {msg.inlineKeyboard && msg.inlineKeyboard.length > 0 && (
                <div className="w-full mt-1 space-y-1">
                  {msg.inlineKeyboard.map((row: InlineButton[], rIdx: number) => (
                    <div key={rIdx} className="flex gap-1">
                      {row.map((btn: InlineButton, cIdx: number) => (
                        <button
                          key={cIdx}
                          className="flex-1 bg-white/80 hover:bg-white text-blue-600 text-[10px] font-medium py-1.5 rounded-lg border border-slate-200 transition flex items-center justify-center gap-1 shadow-sm"
                        >
                          {btn.type === "url" && <ExternalLink size={10} />}
                          {btn.text}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Menu Popup */}
      {showMenu && (
        <div className="absolute bottom-16 left-2 right-2 bg-white rounded-xl shadow-2xl p-2 z-30 animate-in fade-in slide-in-from-bottom-2 max-h-40 overflow-y-auto">
          {commands.map((c: BotCommand, i: number) => (
            <button
              key={i}
              onClick={() => handleCommandClick(c.command)}
              className="w-full text-left px-3 py-2 hover:bg-slate-100 rounded-lg transition text-xs"
            >
              <span className="text-blue-600 font-bold">/{c.command}</span>
              <span className="text-slate-500 ml-2">{c.description}</span>
            </button>
          ))}
        </div>
      )}

      {/* Keyboard & Input */}
      <div className="bg-white border-t p-2 space-y-2">
        {currentPage && currentPage.rows.length > 0 && (
          <div className="space-y-1.5">
            {currentPage.rows.map((row: ReplyButton[], rIdx: number) => (
              <div key={rIdx} className="flex gap-1.5">
                {row.map((btn: ReplyButton, cIdx: number) => (
                  <button
                    key={cIdx}
                    onClick={() => handleBtnClick(btn)}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-800 text-[10px] font-medium py-2 px-1 rounded-lg transition shadow-sm border border-slate-200 truncate"
                  >
                    {btn.text}
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-2 items-center">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-2 bg-slate-100 rounded-full hover:bg-slate-200 transition"
          >
            <Menu size={16} className="text-blue-500" />
          </button>
          <input
            placeholder="Message"
            className="flex-1 bg-slate-100 rounded-full px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-blue-300"
          />
          <button className="p-2 bg-blue-500 rounded-full hover:bg-blue-600 transition">
            <Send size={14} className="text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}
