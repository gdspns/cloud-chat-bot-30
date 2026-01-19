import React, { useState, useEffect, useRef } from "react";
import { Settings, Plus, Trash2, Edit3, Image as ImageIcon, Video, Bold, Italic, List, Save, X, Check } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// --- 数据配置 ---
const CATEGORIES = ["菜单键盘配置", "TG商城配置"];

interface Article {
  id: number;
  title: string;
  date: string;
  category: string;
  content: string;
}

const INITIAL_DATA: Article[] = [
  {
    id: 1,
    title: "如何使用本系统",
    date: "2023-10-27",
    category: "菜单键盘配置",
    content: `<p><font size="5">欢迎使用！</font></p><p>这是后台初始化数据。</p>`
  }
];

// --- 富文本编辑器 ---
interface RichEditorProps {
  value: string;
  onChange: (value: string) => void;
}

const RichEditor: React.FC<RichEditorProps> = ({ value, onChange }) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const [promptMode, setPromptMode] = useState<'image' | 'video' | null>(null);
  const [promptValue, setPromptValue] = useState('');

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || '';
    }
  }, []);

  const handleChange = () => {
    if (editorRef.current) onChange(editorRef.current.innerHTML);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.indexOf('image') !== -1) {
        e.preventDefault();
        const blob = item.getAsFile();
        if (!blob) return;
        const reader = new FileReader();
        reader.onload = (event) => {
          if (editorRef.current) editorRef.current.focus();
          document.execCommand('insertImage', false, event.target?.result as string);
          handleChange();
        };
        reader.readAsDataURL(blob);
        return;
      }
    }
  };

  const execCmd = (command: string, val: string | null = null) => {
    if (editorRef.current) editorRef.current.focus();
    document.execCommand(command, false, val || undefined);
    handleChange();
  };

  const handlePromptSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!promptValue.trim()) {
      setPromptMode(null);
      return;
    }
    if (promptMode === 'image') {
      execCmd('insertImage', promptValue);
    } else if (promptMode === 'video') {
      let html = `<div class="my-4"><video controls class="w-full rounded-lg" src="${promptValue}"></video><p><br/></p>`;
      if (promptValue.includes('iframe') || promptValue.includes('embed')) html = promptValue;
      execCmd('insertHTML', html);
    }
    setPromptMode(null);
    setPromptValue('');
  };

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-card flex flex-col h-full relative">
      <div className="relative z-20">
        <div className="flex flex-wrap gap-2 p-2 bg-muted border-b border-border items-center">
          <select
            onChange={(e) => {
              execCmd('fontSize', e.target.value);
              e.target.value = "3";
            }}
            defaultValue="3"
            className="h-8 px-2 text-sm border border-border rounded cursor-pointer bg-background text-foreground"
          >
            <option value="3">默认大小</option>
            <option value="4">中标题</option>
            <option value="5">大标题</option>
            <option value="6">特大标题</option>
          </select>
          <div className="w-px h-6 bg-border mx-1"></div>
          <Button type="button" variant="ghost" size="sm" onClick={() => execCmd('bold')} className="p-1.5">
            <Bold size={18} />
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => execCmd('italic')} className="p-1.5">
            <Italic size={18} />
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => execCmd('insertUnorderedList')} className="p-1.5">
            <List size={18} />
          </Button>
          <div className="w-px h-6 bg-border mx-1"></div>
          <Button type="button" variant="ghost" size="sm" onClick={() => { setPromptMode('image'); setPromptValue(''); }} className="p-1.5">
            <ImageIcon size={18} />
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => { setPromptMode('video'); setPromptValue(''); }} className="p-1.5">
            <Video size={18} />
          </Button>
        </div>
        {promptMode && (
          <div className="absolute top-full left-0 right-0 z-30 bg-card border-b p-3 shadow-md">
            <form onSubmit={handlePromptSubmit} className="flex gap-2">
              <Input
                autoFocus
                className="flex-1"
                placeholder={promptMode === 'image' ? "图片URL" : "视频链接/代码"}
                value={promptValue}
                onChange={e => setPromptValue(e.target.value)}
              />
              <Button type="submit" size="sm">确定</Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setPromptMode(null)}>取消</Button>
            </form>
          </div>
        )}
      </div>
      <div
        ref={editorRef}
        className="editor-content p-4 overflow-y-auto flex-1 text-foreground min-h-[300px] outline-none"
        contentEditable
        onInput={handleChange}
        onPaste={handlePaste}
        suppressContentEditableWarning={true}
      />
      <style>{`
        .editor-content font[size="1"] { font-size: 0.75rem; }
        .editor-content font[size="2"] { font-size: 0.875rem; }
        .editor-content font[size="3"] { font-size: 1rem; }
        .editor-content font[size="4"] { font-size: 1.25rem; font-weight: 600; }
        .editor-content font[size="5"] { font-size: 1.5rem; font-weight: 700; }
        .editor-content font[size="6"] { font-size: 2rem; font-weight: 700; }
        .editor-content img { max-width: 100%; height: auto; border-radius: 0.5rem; margin: 1rem 0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
        .editor-content iframe, .editor-content video { max-width: 100%; margin: 1rem 0; border-radius: 0.5rem; }
        .editor-content ul { list-style-type: disc; padding-left: 1.5rem; margin: 1rem 0; }
        .editor-content ol { list-style-type: decimal; padding-left: 1.5rem; margin: 1rem 0; }
        .editor-content blockquote { border-left: 4px solid hsl(var(--primary)); padding-left: 1rem; background-color: hsl(var(--muted)); padding: 0.5rem 0 0.5rem 1rem; margin: 1rem 0; font-style: italic; color: hsl(var(--muted-foreground)); }
      `}</style>
    </div>
  );
};

// --- 主管理组件 ---
export const ArticleManager: React.FC = () => {
  const [view, setView] = useState<'list' | 'editor'>('list');
  const [articles, setArticles] = useState<Article[]>([]);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  // 编辑器状态
  const [editingArticle, setEditingArticle] = useState<Article | null>(null);
  const [editorTitle, setEditorTitle] = useState('');
  const [editorContent, setEditorContent] = useState('');
  const [editorCategory, setEditorCategory] = useState(CATEGORIES[0]);
  const [saveError, setSaveError] = useState('');

  // 初始化加载数据
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
      localStorage.setItem('cms_articles', JSON.stringify(INITIAL_DATA));
    }
  }, []);

  const saveArticlesToStorage = (newArticles: Article[]) => {
    setArticles(newArticles);
    localStorage.setItem('cms_articles', JSON.stringify(newArticles));
  };

  const confirmDelete = (id: number) => {
    const newArticles = articles.filter(a => a.id !== id);
    saveArticlesToStorage(newArticles);
    setDeleteConfirmId(null);
  };

  const openEditor = (article: Article | null = null) => {
    setSaveError('');
    if (article) {
      setEditingArticle(article);
      setEditorTitle(article.title);
      setEditorCategory(article.category || CATEGORIES[0]);
      setEditorContent(article.content);
    } else {
      setEditingArticle(null);
      setEditorTitle('');
      setEditorCategory(CATEGORIES[0]);
      setEditorContent('');
    }
    setView('editor');
  };

  const handleSave = () => {
    if (!editorTitle.trim()) {
      setSaveError('标题不能为空');
      return;
    }
    const newArticle: Article = {
      id: editingArticle ? editingArticle.id : Date.now(),
      title: editorTitle,
      category: editorCategory,
      content: editorContent,
      date: new Date().toLocaleDateString('zh-CN')
    };
    let newArticles: Article[];
    if (editingArticle) {
      newArticles = articles.map(a => a.id === editingArticle.id ? newArticle : a);
    } else {
      newArticles = [newArticle, ...articles];
    }
    saveArticlesToStorage(newArticles);
    setView('list');
  };

  // 列表视图
  if (view === 'list') {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Settings className="text-primary" />
            <h2 className="text-xl font-bold">内容管理系统 (CMS)</h2>
          </div>
          <Button onClick={() => openEditor()} className="gap-2">
            <Plus size={18} /> 新增文章
          </Button>
        </div>

        <Card className="overflow-hidden">
          {articles.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">暂无文章，请点击右上角添加。</div>
          ) : (
            <ScrollArea className="h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>标题</TableHead>
                    <TableHead className="w-32">分类</TableHead>
                    <TableHead className="w-32">日期</TableHead>
                    <TableHead className="w-48 text-center">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {articles.map(article => (
                    <TableRow key={article.id}>
                      <TableCell className="font-medium">{article.title}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{article.category}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{article.date}</TableCell>
                      <TableCell>
                        {deleteConfirmId === article.id ? (
                          <div className="flex justify-center gap-2 items-center">
                            <span className="text-xs text-destructive font-bold">确认删除?</span>
                            <Button size="sm" variant="destructive" onClick={() => confirmDelete(article.id)}>
                              <Check size={16} />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setDeleteConfirmId(null)}>
                              <X size={16} />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex justify-center gap-2">
                            <Button size="sm" variant="ghost" onClick={() => openEditor(article)} title="编辑">
                              <Edit3 size={18} />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setDeleteConfirmId(article.id)} title="删除" className="text-destructive">
                              <Trash2 size={18} />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </Card>
      </div>
    );
  }

  // 编辑器视图
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">{editingArticle ? '编辑文章' : '新建文章'}</h2>
        <Button variant="ghost" onClick={() => setView('list')}>
          <X size={24} />
        </Button>
      </div>

      <Card className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-3">
            <label className="block text-sm font-medium mb-2">标题</label>
            <Input
              type="text"
              className={saveError ? 'border-destructive' : ''}
              placeholder="文章标题"
              value={editorTitle}
              onChange={(e) => {
                setEditorTitle(e.target.value);
                setSaveError('');
              }}
            />
            {saveError && <p className="text-sm text-destructive mt-1">{saveError}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">分类</label>
            <Select value={editorCategory} onValueChange={setEditorCategory}>
              <SelectTrigger>
                <SelectValue placeholder="选择分类" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">内容</label>
          <div className="h-[400px]">
            <RichEditor value={editorContent} onChange={setEditorContent} />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={() => setView('list')}>取消</Button>
          <Button onClick={handleSave} className="gap-2">
            <Save size={18} /> 保存发布
          </Button>
        </div>
      </Card>
    </div>
  );
};
