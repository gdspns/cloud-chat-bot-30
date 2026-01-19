import React, { useState, useEffect } from "react";
import { BookOpen, ChevronDown, ChevronUp, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent } from "@/components/ui/dialog";

// --- 配置 ---
const CATEGORIES = ["菜单键盘配置", "TG商城配置"];

interface Article {
  id: number;
  title: string;
  date: string;
  category: string;
  content: string;
}

const INITIAL_DATA: Article[] = [
  { id: 1, title: "欢迎使用", date: "2023-10-27", category: "菜单键盘配置", content: `<p>暂无数据，请登录后台添加。</p>` }
];

export const ConfigGuide: React.FC = () => {
  const [articles, setArticles] = useState<Article[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('全部');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // 初始化数据 (只读)
  useEffect(() => {
    const stored = localStorage.getItem('cms_articles');
    if (stored) {
      try {
        const parsed = JSON.parse(stored).map((a: Article) => ({
          ...a,
          category: a.category || CATEGORIES[0]
        }));
        setArticles(parsed);
      } catch (e) {
        setArticles(INITIAL_DATA);
      }
    } else {
      setArticles(INITIAL_DATA);
    }

    // 监听 storage 变化，实现跨标签页同步
    const handleStorageChange = () => {
      const updated = localStorage.getItem('cms_articles');
      if (updated) setArticles(JSON.parse(updated));
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // 筛选文章
  const filteredArticles = activeCategory === '全部'
    ? articles
    : articles.filter(a => a.category === activeCategory);

  return (
    <div className="h-full flex flex-col bg-muted/30">
      {/* Header */}
      <header className="bg-card border-b px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 text-lg font-bold text-primary">
          <BookOpen className="w-5 h-5" />
          <span>配置说明</span>
        </div>
      </header>

      <ScrollArea className="flex-1">
        <div className="max-w-3xl mx-auto px-4 py-8">
          {/* 分类切换 Tab */}
          <div className="flex flex-wrap gap-2 mb-8 justify-center">
            <Button
              variant={activeCategory === '全部' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveCategory('全部')}
              className="rounded-full"
            >
              全部
            </Button>
            {CATEGORIES.map(cat => (
              <Button
                key={cat}
                variant={activeCategory === cat ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveCategory(cat)}
                className="rounded-full"
              >
                {cat}
              </Button>
            ))}
          </div>

          {/* 文章列表 */}
          <div className="space-y-4">
            {filteredArticles.length === 0 ? (
              <Card className="p-10 text-center">
                <p className="text-muted-foreground">该分类下暂无文章</p>
              </Card>
            ) : (
              filteredArticles.map(article => (
                <Card key={article.id} className="overflow-hidden transition-all duration-200 hover:shadow-md">
                  <div
                    className="p-5 cursor-pointer flex items-center justify-between select-none hover:bg-muted/50"
                    onClick={() => setExpandedId(expandedId === article.id ? null : article.id)}
                  >
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-primary border-primary/50">
                          {article.category || CATEGORIES[0]}
                        </Badge>
                        <h3 className="text-lg font-medium">{article.title}</h3>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-muted-foreground">
                      <span className="text-sm hidden sm:inline">{article.date}</span>
                      {expandedId === article.id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </div>
                  </div>
                  {expandedId === article.id && (
                    <div className="border-t bg-muted/30 p-6">
                      <div
                        className="article-body prose prose-sm max-w-none text-muted-foreground leading-relaxed"
                        dangerouslySetInnerHTML={{ __html: article.content }}
                        onClick={(e) => {
                          const target = e.target as HTMLElement;
                          if (target.tagName === 'IMG') {
                            e.stopPropagation();
                            setPreviewImage((target as HTMLImageElement).src);
                          }
                        }}
                      />
                    </div>
                  )}
                </Card>
              ))
            )}
          </div>
        </div>
      </ScrollArea>

      {/* 图片预览 */}
      <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
        <DialogContent className="max-w-4xl p-2">
          <div className="relative">
            <Button
              variant="ghost"
              size="sm"
              className="absolute -top-2 -right-2 z-10 rounded-full"
              onClick={() => setPreviewImage(null)}
            >
              <X size={20} />
            </Button>
            {previewImage && (
              <img src={previewImage} className="max-w-full max-h-[85vh] object-contain rounded" alt="Preview" />
            )}
          </div>
        </DialogContent>
      </Dialog>

      <style>{`
        .article-body font[size="1"] { font-size: 0.75rem; }
        .article-body font[size="2"] { font-size: 0.875rem; }
        .article-body font[size="3"] { font-size: 1rem; }
        .article-body font[size="4"] { font-size: 1.25rem; font-weight: 600; }
        .article-body font[size="5"] { font-size: 1.5rem; font-weight: 700; }
        .article-body font[size="6"] { font-size: 2rem; font-weight: 700; }
        .article-body img {
          max-width: 100%;
          border-radius: 0.5rem;
          margin: 1rem 0;
          cursor: zoom-in;
          transition: opacity 0.2s;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }
        .article-body img:hover { opacity: 0.9; }
        .article-body iframe { width: 100%; aspect-ratio: 16/9; margin: 1rem 0; border-radius: 0.5rem; }
        .article-body video { width: 100%; border-radius: 0.5rem; margin: 1rem 0; background-color: #000; }
        .article-body ul { list-style-type: disc; padding-left: 1.5rem; margin-bottom: 1rem; }
        .article-body ol { list-style-type: decimal; padding-left: 1.5rem; margin-bottom: 1rem; }
        .article-body blockquote { border-left: 4px solid hsl(var(--primary)); padding-left: 1rem; background-color: hsl(var(--muted)); padding-top: 0.5rem; padding-bottom: 0.5rem; margin: 1rem 0; color: hsl(var(--muted-foreground)); }
      `}</style>
    </div>
  );
};
