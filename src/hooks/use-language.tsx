import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Language = 'zh' | 'en';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

// 翻译字典
const translations: Record<Language, Record<string, string>> = {
  zh: {
    // Navbar
    'nav.brand': 'Bot管理',
    'nav.chat': '双向聊天',
    'nav.chat.short': '双向',
    'nav.keyboard': '菜单键盘',
    'nav.keyboard.short': '键盘',
    'nav.store': '自助商城',
    'nav.store.short': '商城',
    'nav.userCenter': '用户中心',
    'nav.logout': '退出',
    'nav.register': '注册',
    'nav.login': '登录',
    
    // Store Page
    'store.title': '自助商城',
    'store.auto': '自动充值',
    'store.card': '卡密购买',
    'store.selectProduct': '请选择商品',
    'store.selectPayment': '请选择支付方式',
    'store.stock': '库存',
    'store.soldOut': '已售罄',
    'store.days': '天',
    'store.buy': '购买',
    'store.enterBotId': '请输入账号ID',
    'store.enterContact': '请输入邮箱或手机号',
    'store.payment': '支付方式',
    'store.payNow': '立即支付',
    'store.orderQuery': '订单查询',
    'store.paySuccess': '支付成功',
    'store.expired': '已过期',
    'store.confirmPayment': '确认支付',
    'store.payAmount': '请支付精确金额',
    'store.scanToPay': '扫码支付',
    'store.wechatScan': '请使用微信扫码支付',
    'store.alipayScan': '请使用支付宝扫码支付',
    'store.openAlipay': '手机用户点击打开支付宝',
    'store.paidDone': '我已完成支付',
    'store.orderComplete': '订单完成',
    'store.cardInfo': '卡密信息',
    'store.copy': '复制',
    'store.copySuccess': '复制成功',
    'store.loadingCard': '正在安全从云端获取卡密，请稍候...',
    'store.retry': '重试',
    'store.noStock': '库存不足，暂时无法购买',
    'store.createOrderFailed': '创建订单失败，请稍后重试',
    'store.getPayLinkFailed': '获取支付链接失败，请稍后重试',
    'store.chat': '双向聊天',
    'store.keyboardMenu': '菜单键盘',
    'store.tgMall': 'TG商城',
    
    // Auth
    'auth.login': '登录',
    'auth.register': '注册',
    'auth.email': '邮箱',
    'auth.password': '密码',
    'auth.confirmPassword': '确认密码',
    'auth.submit': '提交',
    
    // Common
    'common.loading': '加载中...',
    'common.error': '错误',
    'common.success': '成功',
    'common.confirm': '确认',
    'common.cancel': '取消',
    'common.save': '保存',
    'common.delete': '删除',
    'common.edit': '编辑',
    'common.add': '添加',
    'common.search': '搜索',
    'common.noData': '暂无数据',
  },
  en: {
    // Navbar
    'nav.brand': 'Bot Manager',
    'nav.chat': 'Two-way Chat',
    'nav.chat.short': 'Chat',
    'nav.keyboard': 'Menu Keyboard',
    'nav.keyboard.short': 'Menu',
    'nav.store': 'Store',
    'nav.store.short': 'Store',
    'nav.userCenter': 'Account',
    'nav.logout': 'Logout',
    'nav.register': 'Sign Up',
    'nav.login': 'Login',
    
    // Store Page
    'store.title': 'Self-service Store',
    'store.auto': 'Auto Recharge',
    'store.card': 'Card Key',
    'store.selectProduct': 'Select a product',
    'store.selectPayment': 'Select payment method',
    'store.stock': 'Stock',
    'store.soldOut': 'Sold Out',
    'store.days': 'days',
    'store.buy': 'Buy',
    'store.enterBotId': 'Enter your account ID',
    'store.enterContact': 'Enter email or phone',
    'store.payment': 'Payment',
    'store.payNow': 'Pay Now',
    'store.orderQuery': 'Order Query',
    'store.paySuccess': 'Payment Success',
    'store.expired': 'Expired',
    'store.confirmPayment': 'Confirm Payment',
    'store.payAmount': 'Please pay exact amount',
    'store.scanToPay': 'Scan to Pay',
    'store.wechatScan': 'Scan with WeChat to pay',
    'store.alipayScan': 'Scan with Alipay to pay',
    'store.openAlipay': 'Tap to open Alipay',
    'store.paidDone': 'I have paid',
    'store.orderComplete': 'Order Complete',
    'store.cardInfo': 'Card Key',
    'store.copy': 'Copy',
    'store.copySuccess': 'Copied',
    'store.loadingCard': 'Fetching card key securely...',
    'store.retry': 'Retry',
    'store.noStock': 'Out of stock',
    'store.createOrderFailed': 'Failed to create order, please try again',
    'store.getPayLinkFailed': 'Failed to get payment link, please try again',
    'store.chat': 'Two-way Chat',
    'store.keyboardMenu': 'Menu Keyboard',
    'store.tgMall': 'TG Store',
    
    // Auth
    'auth.login': 'Login',
    'auth.register': 'Sign Up',
    'auth.email': 'Email',
    'auth.password': 'Password',
    'auth.confirmPassword': 'Confirm Password',
    'auth.submit': 'Submit',
    
    // Common
    'common.loading': 'Loading...',
    'common.error': 'Error',
    'common.success': 'Success',
    'common.confirm': 'Confirm',
    'common.cancel': 'Cancel',
    'common.save': 'Save',
    'common.delete': 'Delete',
    'common.edit': 'Edit',
    'common.add': 'Add',
    'common.search': 'Search',
    'common.noData': 'No data',
  }
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('app_language');
    return (saved === 'en' ? 'en' : 'zh') as Language;
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('app_language', lang);
  };

  const t = (key: string): string => {
    return translations[language][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

export default useLanguage;
