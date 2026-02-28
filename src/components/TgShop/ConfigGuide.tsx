import React, { useState, useEffect } from "react";
import { BookOpen, ChevronDown, ChevronUp, X, Loader2, RefreshCw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/hooks/use-language";

// --- Category config ---
const CATEGORIES_ZH = ["菜单键盘配置", "TG商城配置"];
const CATEGORIES_EN = ["Menu Keyboard Config", "TG Shop Config"];

interface Article {
  id: string;
  title: string;
  content: string;
  category: string;
  created_at: string;
  updated_at: string;
}

export const ConfigGuide: React.FC = () => {
  const { t, language } = useLanguage();
  const [articles, setArticles] = useState<Article[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>(t('guide.all'));
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const CATEGORIES = language === 'zh' ? CATEGORIES_ZH : CATEGORIES_EN;
  const allLabel = t('guide.all');

  // Load articles
  const loadArticles = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('articles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setArticles((data || []).filter(a => a.category !== '__SYSTEM__'));
    } catch (error) {
      console.error('加载文章失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadArticles();

    // 订阅实时更新
    const channel = supabase
      .channel('articles-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'articles' },
        () => {
          loadArticles();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Filter articles
  const filteredArticles = activeCategory === allLabel
    ? articles
    : articles.filter(a => a.category === activeCategory);

  return (
    <div className="h-full flex flex-col bg-muted/30">
      {/* Header */}
      <header className="bg-card border-b px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 text-lg font-bold text-primary">
          <BookOpen className="w-5 h-5" />
          <span>{t('guide.title')}</span>
        </div>
        <Button variant="ghost" size="sm" onClick={loadArticles} disabled={isLoading}>
          <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
        </Button>
      </header>

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
            <p className="mt-2 text-muted-foreground">{t('common.loading')}</p>
          </div>
        </div>
      ) : (
        <ScrollArea className="flex-1">
          <div className="max-w-3xl mx-auto px-4 py-8">
            {/* Category tabs */}
            <div className="flex flex-wrap gap-2 mb-8 justify-center">
              <Button
                variant={activeCategory === allLabel ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveCategory(allLabel)}
                className="rounded-full"
              >
                {allLabel}
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



            {/* Article list */}
            <div className="space-y-4">
              {filteredArticles.length === 0 ? (
                <Card className="p-10 text-center">
                  <p className="text-muted-foreground">{t('guide.noArticles')}</p>
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
                        <span className="text-sm hidden sm:inline">
                          {new Date(article.updated_at).toLocaleDateString('zh-CN')}
                        </span>
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
      )}

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
