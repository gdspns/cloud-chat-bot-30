import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Bot, Home, LogIn, UserPlus, LogOut, User, Settings, MessageSquare, Layout, ShoppingCart } from "lucide-react";
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
          <span>Bot管理</span>
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
          
          <Button 
            variant={location.pathname === "/store" ? "default" : "ghost"} 
            size="sm" 
            asChild
            className="px-2 md:px-3"
          >
            <Link to="/store">
              <ShoppingCart className="h-4 w-4 mr-1" />
              <span className="md:hidden">商城</span>
              <span className="hidden md:inline">自助商城</span>
            </Link>
          </Button>
        </div>
        
        <div className="flex items-center gap-2">
          {user ? (
            <>
              <Button 
                variant={location.pathname === "/user" ? "default" : "ghost"} 
                size="sm" 
                asChild
                className="px-2 md:px-3"
              >
                <Link to="/user">
                  <Settings className="h-4 w-4 mr-1" />
                  用户中心
                </Link>
              </Button>
              {/* <div className="flex items-center gap-2 px-3 py-1 rounded-md bg-muted">
                <User className="h-4 w-4" />
                <span className="text-sm font-medium max-w-[120px] truncate">{user.email}</span>
              </div>
              */}
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleLogout}
              >
                <LogOut className="h-4 w-4 mr-1" />
                退出
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
                  <UserPlus className="h-4 w-4 mr-1" />
                  注册
                </Link>
              </Button>
              
              <Button 
                variant={location.pathname === "/auth" ? "default" : "ghost"} 
                size="sm" 
                asChild
                className="px-2 md:px-3"
              >
                <Link to="/auth?mode=login">
                  <LogIn className="h-4 w-4 mr-1" />
                  登录
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
