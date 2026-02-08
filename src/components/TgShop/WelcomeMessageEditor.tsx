import React, { useState, useRef } from "react";
import { Plus, X, Link, Copy, Smile, Trash2 } from "lucide-react";
import { useLanguage } from "@/hooks/use-language";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface CustomButton {
  text: string;
  url: string;
}

interface WelcomeMessageEditorProps {
  value: string;
  onChange: (value: string) => void;
  customButtons: CustomButton[];
  onCustomButtonsChange: (buttons: CustomButton[]) => void;
  placeholder?: string;
}

// Common emoji list
const EMOJI_LIST = [
  "👋", "😊", "🎉", "✅", "❌", "⚠️", "💡", "🔥", "⭐", "💰",
  "🛒", "📦", "🎁", "💳", "🏷️", "📱", "💬", "🔔", "🎯", "🚀",
  "👍", "👎", "❤️", "🙏", "🤝", "✨", "🔗", "📌", "📢", "🎊"
];

export function WelcomeMessageEditor({
  value,
  onChange,
  customButtons,
  onCustomButtonsChange,
  placeholder
}: WelcomeMessageEditorProps) {
  const { t, language } = useLanguage();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [linkText, setLinkText] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [showLinkPopover, setShowLinkPopover] = useState(false);
  const [newButtonText, setNewButtonText] = useState('');
  const [newButtonUrl, setNewButtonUrl] = useState('');

  // Insert text at cursor position
  const insertAtCursor = (text: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newValue = value.substring(0, start) + text + value.substring(end);
    onChange(newValue);

    // Reset cursor position after insert
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + text.length, start + text.length);
    }, 0);
  };

  // Insert Telegram markdown link
  const handleInsertLink = () => {
    if (!linkText.trim() || !linkUrl.trim()) return;
    const linkMarkdown = `[${linkText}](${linkUrl})`;
    insertAtCursor(linkMarkdown);
    setLinkText('');
    setLinkUrl('');
    setShowLinkPopover(false);
  };

  // Insert emoji
  const handleInsertEmoji = (emoji: string) => {
    insertAtCursor(emoji);
  };

  // Add custom button
  const handleAddButton = () => {
    if (!newButtonText.trim() || !newButtonUrl.trim()) return;
    onCustomButtonsChange([...customButtons, { text: newButtonText.trim(), url: newButtonUrl.trim() }]);
    setNewButtonText('');
    setNewButtonUrl('');
  };

  // Remove custom button
  const handleRemoveButton = (index: number) => {
    const newButtons = customButtons.filter((_, i) => i !== index);
    onCustomButtonsChange(newButtons);
  };

  // Copy formatted text
  const handleCopy = () => {
    navigator.clipboard.writeText(value).catch(() => {});
  };

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Link insertion */}
        <Popover open={showLinkPopover} onOpenChange={setShowLinkPopover}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-1 px-2 py-1.5 text-xs bg-muted hover:bg-muted/80 rounded border transition-colors"
            >
              <Link size={14} />
              <span>{language === 'zh' ? '插入链接' : 'Insert Link'}</span>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-3" align="start">
            <div className="space-y-2">
              <div>
                <label className="text-xs font-medium text-foreground">
                  {language === 'zh' ? '显示文字' : 'Display Text'}
                </label>
                <input
                  type="text"
                  value={linkText}
                  onChange={(e) => setLinkText(e.target.value)}
                  placeholder={language === 'zh' ? '点击这里' : 'Click here'}
                  className="w-full p-2 text-sm border rounded bg-background mt-1"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-foreground">
                  {language === 'zh' ? '链接地址' : 'URL'}
                </label>
                <input
                  type="text"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://"
                  className="w-full p-2 text-sm border rounded bg-background font-mono mt-1"
                />
              </div>
              <button
                onClick={handleInsertLink}
                disabled={!linkText.trim() || !linkUrl.trim()}
                className="w-full py-1.5 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50"
              >
                {language === 'zh' ? '插入' : 'Insert'}
              </button>
            </div>
          </PopoverContent>
        </Popover>

        {/* Emoji picker */}
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-1 px-2 py-1.5 text-xs bg-muted hover:bg-muted/80 rounded border transition-colors"
            >
              <Smile size={14} />
              <span>{language === 'zh' ? '表情' : 'Emoji'}</span>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-2" align="start">
            <div className="grid grid-cols-10 gap-1">
              {EMOJI_LIST.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => handleInsertEmoji(emoji)}
                  className="w-6 h-6 text-base hover:bg-muted rounded transition-colors"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* Copy button */}
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 px-2 py-1.5 text-xs bg-muted hover:bg-muted/80 rounded border transition-colors"
        >
          <Copy size={14} />
          <span>{language === 'zh' ? '复制' : 'Copy'}</span>
        </button>
      </div>

      {/* Textarea */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full p-3 bg-background border rounded text-sm min-h-[120px] focus:ring-2 focus:ring-primary outline-none"
      />

      {/* Custom buttons section */}
      <div className="p-3 bg-muted rounded-lg border">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-foreground">
            {language === 'zh' ? '自定义按钮（显示在消息下方）' : 'Custom Buttons (shown below message)'}
          </span>
        </div>

        {/* Existing buttons */}
        {customButtons.length > 0 && (
          <div className="space-y-2 mb-3">
            {customButtons.map((btn, index) => (
              <div key={index} className="flex items-center gap-2 p-2 bg-background rounded border">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{btn.text}</div>
                  <div className="text-xs text-muted-foreground truncate">{btn.url}</div>
                </div>
                <button
                  onClick={() => handleRemoveButton(index)}
                  className="p-1 text-muted-foreground hover:text-destructive rounded"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add new button form */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <input
            type="text"
            value={newButtonText}
            onChange={(e) => setNewButtonText(e.target.value)}
            placeholder={language === 'zh' ? '按钮文字' : 'Button text'}
            className="p-2 text-sm border rounded bg-background"
          />
          <input
            type="text"
            value={newButtonUrl}
            onChange={(e) => setNewButtonUrl(e.target.value)}
            placeholder="https://"
            className="p-2 text-sm border rounded bg-background font-mono"
          />
        </div>
        <button
          onClick={handleAddButton}
          disabled={!newButtonText.trim() || !newButtonUrl.trim()}
          className="mt-2 w-full flex items-center justify-center gap-1 py-2 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          <Plus size={14} />
          <span>{language === 'zh' ? '添加按钮' : 'Add Button'}</span>
        </button>

        <p className="text-xs text-muted-foreground mt-2">
          💡 {language === 'zh' 
            ? '按钮将显示为 Telegram 内联键盘，点击后打开指定链接' 
            : 'Buttons will be displayed as Telegram inline keyboard, clicking opens the specified link'}
        </p>
      </div>
    </div>
  );
}
