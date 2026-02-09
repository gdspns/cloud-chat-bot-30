import React, { useState, useRef } from "react";
import { Link, Code, Smile } from "lucide-react";
import { useLanguage } from "@/hooks/use-language";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface WelcomeMessageEditorProps {
  value: string;
  onChange: (value: string) => void;
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
  placeholder
}: WelcomeMessageEditorProps) {
  const { language } = useLanguage();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [linkText, setLinkText] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [showLinkPopover, setShowLinkPopover] = useState(false);

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

  // Insert copyable code text (Telegram uses backticks for inline code)
  const handleInsertCopyableText = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end);
    
    // If text is selected, wrap it with backticks; otherwise insert placeholder
    const codeText = selectedText ? `\`${selectedText}\`` : '`可复制文字`';
    const newValue = value.substring(0, start) + codeText + value.substring(end);
    onChange(newValue);
    
    // Position cursor appropriately
    setTimeout(() => {
      textarea.focus();
      if (selectedText) {
        textarea.setSelectionRange(start + codeText.length, start + codeText.length);
      } else {
        // Select the placeholder text for easy replacement
        textarea.setSelectionRange(start + 1, start + codeText.length - 1);
      }
    }, 0);
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

        {/* Insert copyable text button */}
        <button
          type="button"
          onClick={handleInsertCopyableText}
          className="flex items-center gap-1 px-2 py-1.5 text-xs bg-muted hover:bg-muted/80 rounded border transition-colors"
        >
          <Code size={14} />
          <span>{language === 'zh' ? '可复制文字' : 'Copyable Text'}</span>
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

      {/* Tip for copyable text */}
      <p className="text-xs text-muted-foreground">
        💡 {language === 'zh' 
          ? '使用「可复制文字」按钮插入的内容，用户在 Telegram 中点击即可复制' 
          : 'Text inserted with "Copyable Text" button can be tapped to copy in Telegram'}
      </p>
    </div>
  );
}
