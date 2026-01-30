import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Bot, LogIn, UserPlus, LogOut, Settings, MessageSquare, Layout, ShoppingCart, Sun, Moon, Globe } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/hooks/use-language";
import { useTheme } from "@/hooks/use-theme";

export const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const { theme, toggleTheme } = useTheme();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/', { replace: true });
  };

  const toggleLanguage = () => {
    setLanguage(language === 'zh' ? 'en' : 'zh');
  };
  
  return (
    <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
      <div className="container mx-auto px-4 h-14 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 font-bold text-lg">
          <Bot className="h-6 w-6 text-primary" />
          <span className="hidden sm:inline">{t('nav.brand')}</span>
        </Link>
        
        {/* 居中导航项 */}
        <div className="flex flex-wrap items-center justify-center gap-1 md:gap-2 md:absolute md:left-1/2 md:transform md:-translate-x-1/2">
          <Button 
            variant={location.pathname === "/" ? "default" : "ghost"} 
            size="sm" 
            asChild
            className="px-2 md:px-3"
          >
            <Link to="/">
              <MessageSquare className="h-4 w-4 mr-1" />
              <span className="md:hidden">{t('nav.chat.short')}</span>
              <span className="hidden md:inline">{t('nav.chat')}</span>
            </Link>
          </Button>
          
          <Button 
            variant={location.pathname === "/keyboard-menu" ? "default" : "ghost"} 
            size="sm" 
            asChild
            className="px-2 md:px-3"
          >
            <Link to="/keyboard-menu">
              <Layout className="h-4 w-4 mr-1" />
              <span className="md:hidden">{t('nav.keyboard.short')}</span>
              <span className="hidden md:inline">{t('nav.keyboard')}</span>
            </Link>
          </Button>
          
          <Button 
            variant={location.pathname === "/store" ? "default" : "ghost"} 
            size="sm" 
            asChild
            className="px-2 md:px-3"
          >
            <Link to="/store">
              <ShoppingCart className="h-4 w-4 mr-1" />
              <span className="md:hidden">{t('nav.store.short')}</span>
              <span className="hidden md:inline">{t('nav.store')}</span>
            </Link>
          </Button>
        </div>
        
        <div className="flex items-center gap-1 md:gap-2">
          {/* 语言切换 */}
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleLanguage}
            className="px-2"
            title={language === 'zh' ? 'Switch to English' : '切换到中文'}
          >
            <Globe className="h-4 w-4" />
            <span className="ml-1 text-xs font-bold">{language === 'zh' ? 'EN' : '中'}</span>
          </Button>
          
          {/* 主题切换 */}
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleTheme}
            className="px-2"
            title={theme === 'dark' ? '切换到亮色模式' : '切换到暗黑模式'}
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          
          {user ? (
            <>
              <Button 
                variant={location.pathname === "/user" ? "default" : "ghost"} 
                size="sm" 
                asChild
                className="px-2 md:px-3"
              >
                <Link to="/user">
                  <Settings className="h-4 w-4 md:mr-1" />
                  <span className="hidden md:inline">{t('nav.userCenter')}</span>
                </Link>
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleLogout}
                className="px-2 md:px-3"
              >
                <LogOut className="h-4 w-4 md:mr-1" />
                <span className="hidden md:inline">{t('nav.logout')}</span>
              </Button>
            </>
          ) : (
            <>
              <Button 
                variant={location.pathname === "/auth" ? "default" : "ghost"} 
                size="sm" 
                asChild
                className="px-2 md:px-3"
              >
                <Link to="/auth?mode=register">
                  <UserPlus className="h-4 w-4 md:mr-1" />
                  <span className="hidden md:inline">{t('nav.register')}</span>
                </Link>
              </Button>
              
              <Button 
                variant={location.pathname === "/auth" ? "default" : "ghost"} 
                size="sm" 
                asChild
                className="px-2 md:px-3"
              >
                <Link to="/auth?mode=login">
                  <LogIn className="h-4 w-4 md:mr-1" />
                  <span className="hidden md:inline">{t('nav.login')}</span>
                </Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
