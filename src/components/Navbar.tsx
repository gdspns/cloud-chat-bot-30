import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Bot, LogIn, UserPlus, LogOut, Settings, MessageSquare, Layout, ShoppingCart, Sun, Moon, Globe, Menu } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/hooks/use-language";
import { useTheme } from "@/hooks/use-theme";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { useState } from "react";

export const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const [open, setOpen] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/', { replace: true });
    setOpen(false);
  };

  const toggleLanguage = () => {
    setLanguage(language === 'zh' ? 'en' : 'zh');
  };
  
  return (
    <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
      <div className="container mx-auto px-2 md:px-4 h-14 flex items-center justify-between gap-1">
        {/* Logo - 手机端只显示图标 */}
        <Link to="/" className="flex items-center gap-2 font-bold text-lg shrink-0">
          <Bot className="h-6 w-6 text-primary" />
          <span className="hidden sm:inline">{t('nav.brand')}</span>
        </Link>
        
        {/* 居中导航项 */}
        <div className="flex items-center justify-center gap-0.5 md:gap-2 md:absolute md:left-1/2 md:transform md:-translate-x-1/2">
          <Button 
            variant={location.pathname === "/" ? "default" : "ghost"} 
            size="sm" 
            asChild
            className="h-8 px-1.5 md:px-3 text-xs md:text-sm"
          >
            <Link to="/">
              <MessageSquare className="h-4 w-4 shrink-0" />
              <span className="ml-1 hidden sm:inline">{t('nav.chat')}</span>
              <span className="ml-0.5 sm:hidden text-[10px]">{t('nav.chat.short')}</span>
            </Link>
          </Button>
          
          <Button 
            variant={location.pathname === "/keyboard-menu" ? "default" : "ghost"} 
            size="sm" 
            asChild
            className="h-8 px-1.5 md:px-3 text-xs md:text-sm"
          >
            <Link to="/keyboard-menu">
              <Layout className="h-4 w-4 shrink-0" />
              <span className="ml-1 hidden sm:inline">{t('nav.keyboard')}</span>
              <span className="ml-0.5 sm:hidden text-[10px]">{t('nav.keyboard.short')}</span>
            </Link>
          </Button>
          
          <Button 
            variant={location.pathname === "/store" ? "default" : "ghost"} 
            size="sm" 
            asChild
            className="h-8 px-1.5 md:px-3 text-xs md:text-sm"
          >
            <Link to="/store">
              <ShoppingCart className="h-4 w-4 shrink-0" />
              <span className="ml-1 hidden sm:inline">{t('nav.store')}</span>
              <span className="ml-0.5 sm:hidden text-[10px]">{t('nav.store.short')}</span>
            </Link>
          </Button>
        </div>
        
        {/* 右侧功能区 - 桌面端 */}
        <div className="hidden md:flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="icon" onClick={toggleLanguage} className="h-8 w-8" title={language === 'zh' ? 'Switch to English' : '切换到中文'}>
            <Globe className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={toggleTheme} className="h-8 w-8" title={theme === 'dark' ? '切换到亮色模式' : '切换到暗黑模式'}>
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          {user ? (
            <>
              <Button variant={location.pathname === "/user" ? "default" : "ghost"} size="sm" asChild className="h-8 px-3">
                <Link to="/user"><Settings className="h-4 w-4 mr-1" /><span className="text-sm">{t('nav.userCenter')}</span></Link>
              </Button>
              <Button variant="ghost" size="sm" onClick={handleLogout} className="h-8 px-3">
                <LogOut className="h-4 w-4 mr-1" /><span className="text-sm">{t('nav.logout')}</span>
              </Button>
            </>
          ) : (
            <>
              <Button variant={location.pathname === "/auth" ? "default" : "ghost"} size="sm" asChild className="h-8 px-3">
                <Link to="/auth?mode=register"><UserPlus className="h-4 w-4 mr-1" /><span className="text-sm">{t('nav.register')}</span></Link>
              </Button>
              <Button variant={location.pathname === "/auth" ? "default" : "ghost"} size="sm" asChild className="h-8 px-3">
                <Link to="/auth?mode=login"><LogIn className="h-4 w-4 mr-1" /><span className="text-sm">{t('nav.login')}</span></Link>
              </Button>
            </>
          )}
        </div>

        {/* 右侧功能区 - 移动端汉堡菜单 */}
        <div className="md:hidden shrink-0">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-64 p-0">
              <SheetTitle className="sr-only">菜单</SheetTitle>
              <div className="flex flex-col gap-1 p-4 pt-12">
                <Button variant="ghost" className="justify-start gap-3 h-11" onClick={() => { toggleLanguage(); }}>
                  <Globe className="h-4 w-4" />
                  {language === 'zh' ? 'English' : '中文'}
                </Button>
                <Button variant="ghost" className="justify-start gap-3 h-11" onClick={() => { toggleTheme(); }}>
                  {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                  {theme === 'dark' ? t('nav.lightMode') || '亮色模式' : t('nav.darkMode') || '暗黑模式'}
                </Button>
                <div className="my-2 border-t" />
                {user ? (
                  <>
                    <Button variant={location.pathname === "/user" ? "secondary" : "ghost"} className="justify-start gap-3 h-11" asChild onClick={() => setOpen(false)}>
                      <Link to="/user"><Settings className="h-4 w-4" />{t('nav.userCenter')}</Link>
                    </Button>
                    <Button variant="ghost" className="justify-start gap-3 h-11 text-destructive" onClick={handleLogout}>
                      <LogOut className="h-4 w-4" />{t('nav.logout')}
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="ghost" className="justify-start gap-3 h-11" asChild onClick={() => setOpen(false)}>
                      <Link to="/auth?mode=register"><UserPlus className="h-4 w-4" />{t('nav.register')}</Link>
                    </Button>
                    <Button variant="ghost" className="justify-start gap-3 h-11" asChild onClick={() => setOpen(false)}>
                      <Link to="/auth?mode=login"><LogIn className="h-4 w-4" />{t('nav.login')}</Link>
                    </Button>
                  </>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
