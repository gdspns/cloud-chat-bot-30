import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Bot, Home, LogIn, UserPlus, LogOut, User, Settings, MessageSquare, Layout } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/', { replace: true });
  };
  
  return (
    <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
      <div className="container mx-auto px-4 h-14 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 font-bold text-lg">
          <Bot className="h-6 w-6 text-primary" />
          <span className="md:hidden">Bot管理</span>
          <span className="hidden md:inline">TG机器人管理</span>
        </Link>
        
        {/* 居中导航项 - 手机端显示简短文字，自动换行 */}
        <div className="flex flex-wrap items-center justify-center gap-1 md:gap-2 md:absolute md:left-1/2 md:transform md:-translate-x-1/2">
          <Button 
            variant={location.pathname === "/" ? "default" : "ghost"} 
            size="sm" 
            asChild
            className="px-2 md:px-3"
          >
            <Link to="/">
              <Home className="h-4 w-4 mr-1" />
              <span className="md:hidden">双向</span>
              <span className="hidden md:inline">双向聊天</span>
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
              <span className="md:hidden">键盘</span>
              <span className="hidden md:inline">菜单键盘</span>
            </Link>
          </Button>
        </div>
        
        <div className="flex items-center gap-1 md:gap-2">
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
                  <span className="hidden md:inline">用户中心</span>
                </Link>
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleLogout}
                className="px-2 md:px-3"
              >
                <LogOut className="h-4 w-4 md:mr-1" />
                <span className="hidden md:inline">退出</span>
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
                  <span className="hidden md:inline">注册</span>
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
                  <span className="hidden md:inline">登录</span>
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
