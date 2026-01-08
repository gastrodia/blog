// src/components/ChatWidget/chat.client.ts
// 聊天组件客户端逻辑

import { marked } from "marked";
import { createHighlighter, type Highlighter } from "shiki";

// ============= 类型定义 =============
interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  sources?: ChatSource[];
}

interface ChatSource {
  title: string;
  source: string;
  similarity: number;
}

interface ChatState {
  messages: ChatMessage[];
  isOpen: boolean;
  isLoading: boolean;
  name: string;
}

interface DOMElements {
  widget?: HTMLElement;
  button?: HTMLElement;
  window?: HTMLElement;
  messagesList?: HTMLElement;
  input?: HTMLInputElement;
  sendBtn?: HTMLElement;
  clearBtn?: HTMLElement;
  closeBtn?: HTMLElement;
}

// ============= 常量配置 =============
const STORAGE_KEY = "blog-chat-history";
const MAX_MESSAGES = 50;
const HISTORY_FOR_API = 10;
const ANIMATION_DURATION = {
  WINDOW_OPEN: 400,
  WINDOW_CLOSE: 300,
  BUTTON_DELAY: 150,
  BUTTON_SHOW_DELAY: 200,
  SCROLL_DELAY: 100,
} as const;

// 开发模式标志
const isDev = import.meta.env.DEV;

const ELEMENT_IDS = {
  WIDGET: "chat-widget",
  BUTTON: "chat-button",
  WINDOW: "chat-window",
  MESSAGES: "chat-messages",
  INPUT: "chat-input",
  SEND: "chat-send",
  CLEAR: "chat-clear",
  CLOSE: "chat-close",
  LOADING: "loading-indicator",
} as const;

const CSS_CLASSES = {
  HIDDEN: "chat-hidden",
  VISIBLE: "visible",
  OPEN: "open",
  MESSAGE: "message",
  MESSAGE_USER: "chat-message-user",
  MESSAGE_ASSISTANT: "chat-message-assistant",
  CONTENT_USER: "chat-content-user",
  CONTENT_ASSISTANT: "chat-content-assistant chat-md-content",
  CONTENT_LOADING: "chat-content-loading",
} as const;

const SHIKI_CONFIG = {
  themes: ["github-dark", "github-light"] as const,
  langs: [
    "javascript", "typescript", "python", "java", "rust", "go",
    "html", "css", "json", "markdown", "bash", "shell", "sql", "yaml", "xml",
  ] as const,
} as const;

// ============= 辅助函数 =============
function log(...args: unknown[]) {
  if (isDev) {
    // eslint-disable-next-line no-console
    console.log("[ChatWidget]", ...args);
  }
}

function logError(...args: unknown[]) {
  // eslint-disable-next-line no-console
  console.error("[ChatWidget]", ...args);
}

// ============= 主类 =============
class ChatWidget {
  private state: ChatState;
  private elements: DOMElements = {};
  private highlighter: Highlighter | null = null;
  private initPromise: Promise<void>;
  private eventsBound = false;
  private isAnimating = false;

  constructor(name: string) {
    this.state = {
      messages: this.loadHistory(),
      isOpen: false,
      isLoading: false,
      name,
    };
    this.initPromise = this.init();
  }

  // ============= 初始化方法 =============
  private async init() {
    this.updateElements();
    this.isAnimating = false;

    // 初始化按钮显示状态
    this.setElementClasses(this.elements.button, [CSS_CLASSES.VISIBLE], [CSS_CLASSES.HIDDEN]);
    
    // 初始化 Shiki 高亮器（仅一次）
    if (!this.highlighter) {
      await this.initHighlighter();
    }
    
    this.bindEvents();
    this.eventsBound = true;
    this.renderMessages();
  }
  
  private updateElements() {
    const getElement = <T extends HTMLElement = HTMLElement>(id: string): T | undefined => {
      const el = document.getElementById(id);
      return el ? (el as T) : undefined;
    };

    this.elements = {
      widget: getElement(ELEMENT_IDS.WIDGET),
      button: getElement(ELEMENT_IDS.BUTTON),
      window: getElement(ELEMENT_IDS.WINDOW),
      messagesList: getElement(ELEMENT_IDS.MESSAGES),
      input: getElement<HTMLInputElement>(ELEMENT_IDS.INPUT),
      sendBtn: getElement(ELEMENT_IDS.SEND),
      clearBtn: getElement(ELEMENT_IDS.CLEAR),
      closeBtn: getElement(ELEMENT_IDS.CLOSE),
    };
  }
  
  // ============= 公共方法 =============
  public reinit() {
    log("重新初始化, isOpen:", this.state.isOpen);
    
    this.updateElements();
    
    log("DOM 元素状态:", {
      button: !!this.elements.button,
      window: !!this.elements.window,
      input: !!this.elements.input,
    });
    
    // 重置状态
    this.state.isOpen = false;
    this.isAnimating = false;
    
    // 重置 UI
    this.setElementClasses(this.elements.window, [CSS_CLASSES.HIDDEN], [CSS_CLASSES.OPEN]);
    this.setElementClasses(this.elements.button, [CSS_CLASSES.VISIBLE], [CSS_CLASSES.HIDDEN]);
    
    this.rebindButtonEvents();
    this.renderMessages();
    
    log("重新初始化完成");
  }

  // ============= 辅助方法 =============
  private setElementClasses(
    element: HTMLElement | undefined,
    add: string[],
    remove: string[]
  ) {
    if (!element) return;
    element.classList.remove(...remove);
    element.classList.add(...add);
  }

  private forceReflow(element: HTMLElement | undefined) {
    if (element) void element.offsetHeight;
  }
  
  private rebindButtonEvents() {
    // 通过克隆节点移除所有旧事件监听器
    this.rebindElement("button", () => this.toggleChat());
    this.rebindElement("closeBtn", () => this.closeChat());
    this.rebindElement("sendBtn", () => this.sendMessage());
    this.rebindElement("clearBtn", () => this.clearHistory());
    
    // 输入框特殊处理（keydown 事件）
    if (this.elements.input) {
      const newInput = this.cloneAndReplace(this.elements.input);
      this.elements.input = newInput;
      newInput?.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          this.sendMessage();
        }
      });
    }
  }

  private rebindElement<K extends keyof DOMElements>(
    key: K,
    handler: () => void
  ) {
    const element = this.elements[key];
    if (element) {
      const newElement = this.cloneAndReplace(element);
      this.elements[key] = newElement as DOMElements[K];
      newElement?.addEventListener("click", handler);
    }
  }

  private cloneAndReplace<T extends HTMLElement>(element: T): T | undefined {
    const cloned = element.cloneNode(true) as T;
    element.parentNode?.replaceChild(cloned, element);
    return cloned || undefined;
  }

  // ============= Shiki 高亮器初始化 =============
  private async initHighlighter() {
    try {
      this.highlighter = await createHighlighter({
        themes: [...SHIKI_CONFIG.themes],
        langs: [...SHIKI_CONFIG.langs],
      });

      this.configureMarked();
    } catch (error) {
      logError("初始化 Shiki 失败:", error);
    }
  }

  private configureMarked() {
    const renderer = new marked.Renderer();
    
    renderer.code = ({ text, lang }: { text: string; lang?: string }) =>
      this.renderCode(text, lang);
    
    renderer.link = ({ href, title, text }: { href: string; title?: string | null; text: string }) =>
      this.renderLink(href, title, text);

    marked.setOptions({ renderer, breaks: true, gfm: true });
  }

  private renderCode(text: string, lang?: string): string {
    if (!this.highlighter || !lang) {
      return this.escapeCodeFallback(text, lang);
    }
    
    try {
      const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const theme = isDark ? "github-dark" : "github-light";
      
      return this.highlighter.codeToHtml(text, { lang, theme });
    } catch (error) {
      logError("代码高亮失败:", error);
      return this.escapeCodeFallback(text, lang);
    }
  }

  private escapeCodeFallback(text: string, lang?: string): string {
    const escaped = this.escapeHtml(text);
    return `<pre><code class="language-${lang || "text"}">${escaped}</code></pre>`;
  }

  private renderLink(href: string, title: string | null | undefined, text: string): string {
    const cleanHref = this.cleanLinkHref(href);
    const titleAttr = title ? ` title="${this.escapeAttribute(title)}"` : "";
    const escapedHref = this.escapeAttribute(cleanHref);
    
    return `<a href="${escapedHref}"${titleAttr} target="_blank" rel="noopener noreferrer" class="text-accent underline hover:text-accent/80">${text}</a>`;
  }

  private cleanLinkHref(href: string): string {
    try {
      const decoded = decodeURIComponent(href);
      const endMarkers = ["。", "，", "、", "；", "：", "！", "？", " ", "\n"];
      const positions = endMarkers
        .map((marker) => decoded.indexOf(marker))
        .filter((pos) => pos > 0);
      
      if (positions.length > 0) {
        const minPos = Math.min(...positions);
        return decoded.substring(0, minPos);
      }
      
      return decoded;
    } catch {
      return href;
    }
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  private escapeAttribute(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;");
  }

  // ============= 事件处理 =============
  private bindEvents() {
    this.elements.button?.addEventListener("click", () => this.toggleChat());
    this.elements.closeBtn?.addEventListener("click", () => this.closeChat());
    this.elements.sendBtn?.addEventListener("click", () => this.sendMessage());
    this.elements.clearBtn?.addEventListener("click", () => this.clearHistory());
    
    this.elements.input?.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    // ESC 键关闭（仅绑定一次）
    if (!this.eventsBound) {
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && this.state.isOpen) {
          this.closeChat();
        }
      });
    }
  }

  private toggleChat() {
    if (this.isAnimating) return;
    this.state.isOpen = !this.state.isOpen;
    this.updateUI();
  }

  private closeChat() {
    if (this.isAnimating) return;
    this.state.isOpen = false;
    this.updateUI();
  }

  private updateUI() {
    this.isAnimating = true;
    
    if (this.state.isOpen) {
      this.openChatWindow();
    } else {
      this.closeChatWindow();
    }
  }

  private openChatWindow() {
    // 隐藏按钮
    this.setElementClasses(this.elements.button, [CSS_CLASSES.HIDDEN], [CSS_CLASSES.VISIBLE]);
    this.forceReflow(this.elements.button);
    
    // 延迟显示窗口
    setTimeout(() => {
      this.setElementClasses(this.elements.window, [CSS_CLASSES.OPEN], [CSS_CLASSES.HIDDEN]);
      this.elements.input?.focus();
      this.scrollToBottom();
      
      setTimeout(() => {
        this.isAnimating = false;
      }, ANIMATION_DURATION.WINDOW_OPEN);
    }, ANIMATION_DURATION.BUTTON_DELAY);
  }

  private closeChatWindow() {
    // 隐藏窗口
    this.setElementClasses(this.elements.window, [CSS_CLASSES.HIDDEN], [CSS_CLASSES.OPEN]);
    this.forceReflow(this.elements.window);
    
    // 延迟显示按钮
    setTimeout(() => {
      this.setElementClasses(this.elements.button, [CSS_CLASSES.VISIBLE], [CSS_CLASSES.HIDDEN]);
      
      setTimeout(() => {
        this.isAnimating = false;
      }, ANIMATION_DURATION.WINDOW_CLOSE);
    }, ANIMATION_DURATION.BUTTON_SHOW_DELAY);
  }

  // ============= 消息发送 =============
  private async sendMessage() {
    const message = this.elements.input?.value.trim();
    if (!message || this.state.isLoading) return;

    this.addUserMessage(message);
    if (this.elements.input) this.elements.input.value = "";

    this.state.isLoading = true;
    this.addLoadingMessage();

    try {
      await this.streamChatResponse(message);
    } catch (error) {
      logError("发送消息失败:", error);
      this.addErrorMessage("抱歉，发送消息时出错了，请稍后再试。");
    } finally {
      this.state.isLoading = false;
      this.removeLoadingMessage();
    }
  }

  private addUserMessage(content: string) {
    const userMessage: ChatMessage = {
      role: "user",
      content,
      timestamp: Date.now(),
    };
    this.state.messages.push(userMessage);
    this.saveHistory();
    this.renderMessages();
  }

  // ============= API 调用 =============
  private async streamChatResponse(message: string) {
    const validHistory = this.getValidHistory();
    const response = await this.fetchChatAPI(message, validHistory);

    if (!response.ok) {
      throw new Error(await this.extractErrorMessage(response));
    }

    const contentType = response.headers.get("content-type");
    
    // 非流式响应降级处理
    if (!contentType?.includes("text/event-stream")) {
      await this.handleNonStreamResponse(response);
      return;
    }

    // 处理 SSE 流
    if (!response.body) {
      throw new Error("服务器未返回数据流");
    }

    await this.handleStreamResponse(response.body);
  }

  private getValidHistory() {
    return this.state.messages
      .filter((msg) => !msg.content.startsWith("❌"))
      .slice(-HISTORY_FOR_API)
      .map((msg) => ({ role: msg.role, content: msg.content }));
  }

  private async fetchChatAPI(
    message: string, 
    history: Array<{ role: string; content: string }>
  ) {
    return fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, history }),
    });
  }

  private async extractErrorMessage(response: Response): Promise<string> {
    let errorMessage = `API 错误 (${response.status})`;
    try {
      const errorData = await response.json();
      errorMessage = errorData.error || errorMessage;
      logError("API 错误详情:", errorData);
    } catch (e) {
      logError("无法解析错误响应:", e);
    }
    return errorMessage;
  }

  private async handleNonStreamResponse(response: Response) {
    try {
      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }
      if (data.type === "message" || data.content) {
        this.addAssistantMessage(data.content, data.sources);
      }
    } catch (e) {
      logError("解析响应失败:", e);
      throw new Error("服务器返回了无效的响应");
    }
  }

  private async handleStreamResponse(body: ReadableStream<Uint8Array>) {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let assistantMessage = "";
    let sources: ChatSource[] = [];
    const tempMessageId = this.addAssistantMessage("", []);

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const result = this.parseSSELine(line, tempMessageId, assistantMessage, sources);
            if (result.shouldReturn) return;
            assistantMessage = result.message;
            sources = result.sources;
          }
        }
      }
    } catch (error) {
      logError("流式响应错误:", error);
      this.removeMessage(tempMessageId);
      this.addErrorMessage("接收回复时出错");
    }
  }

  private parseSSELine(
    line: string,
    messageId: number,
    currentMessage: string,
    currentSources: ChatSource[]
  ): { message: string; sources: ChatSource[]; shouldReturn: boolean } {
    try {
      const data = JSON.parse(line.slice(6));

      switch (data.type) {
        case "sources":
          return { message: currentMessage, sources: data.sources, shouldReturn: false };
        
        case "content":
          const newMessage = currentMessage + data.content;
          this.updateStreamingMessage(messageId, newMessage);
          return { message: newMessage, sources: currentSources, shouldReturn: false };
        
        case "done":
          this.updateStreamingMessage(messageId, currentMessage, currentSources);
          return { message: currentMessage, sources: currentSources, shouldReturn: false };
        
        case "error":
          this.removeMessage(messageId);
          this.addErrorMessage(data.error);
          return { message: currentMessage, sources: currentSources, shouldReturn: true };
        
        default:
          return { message: currentMessage, sources: currentSources, shouldReturn: false };
      }
    } catch (parseError) {
      logError("解析 SSE 数据失败:", line, parseError);
      return { message: currentMessage, sources: currentSources, shouldReturn: false };
    }
  }

  // ============= 消息管理 =============
  private addAssistantMessage(content: string, sources?: ChatSource[]): number {
    const message: ChatMessage = {
      role: "assistant",
      content,
      timestamp: Date.now(),
      sources,
    };
    this.state.messages.push(message);
    this.saveHistory();
    this.renderMessages();
    return this.state.messages.length - 1;
  }

  private updateStreamingMessage(
    index: number,
    content: string,
    sources?: ChatSource[]
  ) {
    const message = this.state.messages[index];
    if (!message) return;

    message.content = content;
    if (sources) message.sources = sources;
    
    this.saveHistory();
    this.renderMessages();
  }

  private removeMessage(index: number) {
    this.state.messages.splice(index, 1);
    this.renderMessages();
  }

  private addErrorMessage(error: string) {
    this.addAssistantMessage(`❌ ${error}`);
  }

  private addLoadingMessage() {
    const loadingDiv = this.createLoadingElement();
    this.elements.messagesList?.appendChild(loadingDiv);
    this.scrollToBottom();
  }

  private createLoadingElement(): HTMLDivElement {
    const loadingDiv = document.createElement("div");
    loadingDiv.id = ELEMENT_IDS.LOADING;
    loadingDiv.className = CSS_CLASSES.MESSAGE_ASSISTANT;
    loadingDiv.innerHTML = `
      <div class="${CSS_CLASSES.CONTENT_LOADING}">
        <div class="typing-indicator flex gap-1 py-2">
          <span class="w-2 h-2 rounded-full bg-foreground opacity-40"></span>
          <span class="w-2 h-2 rounded-full bg-foreground opacity-40"></span>
          <span class="w-2 h-2 rounded-full bg-foreground opacity-40"></span>
        </div>
      </div>
    `;
    return loadingDiv;
  }

  private removeLoadingMessage() {
    document.getElementById(ELEMENT_IDS.LOADING)?.remove();
  }

  // ============= 消息渲染 =============
  private renderMessages() {
    if (!this.elements.messagesList) return;

    const loadingIndicator = document.getElementById(ELEMENT_IDS.LOADING);
    this.elements.messagesList.innerHTML = "";

    if (this.state.messages.length === 0) {
      this.renderWelcomeScreen();
    } else {
      this.renderMessageList();
    }

    // 恢复加载指示器
    if (loadingIndicator) {
      this.elements.messagesList.appendChild(loadingIndicator);
    }

    this.scrollToBottom();
  }

  private renderWelcomeScreen() {
    if (!this.elements.messagesList) return;

    const quickQuestions = [
      { emoji: "💼", text: "技能栈", question: "作者的技能栈有哪些？" },
      { emoji: "🚀", text: "项目", question: "有哪些项目？" },
      { emoji: "✍", text: "笔者信息", question: "关于作者的信息？" },
    ];

    this.elements.messagesList.innerHTML = `
      <div class="text-center py-8 px-4 text-foreground">
        <div class="welcome-icon text-5xl mb-4 animate-wave">👋</div>
        <h3 class="m-0 mb-2 text-xl text-foreground">你好！我是${this.state.name}</h3>
        <p class="m-0 mb-6 text-foreground opacity-70">你可以问我关于博客内容的任何问题</p>
        <div class="flex flex-col gap-2 mt-4">
          ${quickQuestions.map((q) => `
            <button class="quick-btn px-4 py-3 bg-muted border border-border rounded-lg cursor-pointer transition-all text-foreground text-sm text-left hover:bg-accent hover:text-background hover:border-accent" data-question="${q.question}">
              ${q.emoji} ${q.text}
            </button>
          `).join("")}
        </div>
      </div>
    `;

    this.bindQuickQuestions();
  }

  private bindQuickQuestions() {
    this.elements.messagesList?.querySelectorAll(".quick-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const question = (e.target as HTMLElement).dataset.question;
        if (question && this.elements.input) {
          this.elements.input.value = question;
          this.sendMessage();
        }
      });
    });
  }

  private renderMessageList() {
    this.state.messages.forEach((msg) => {
      const messageDiv = this.createMessageElement(msg);
      this.elements.messagesList?.appendChild(messageDiv);
    });
  }

  private createMessageElement(msg: ChatMessage): HTMLDivElement {
    const messageDiv = document.createElement("div");
    const isUser = msg.role === "user";
    
    messageDiv.className = isUser 
      ? CSS_CLASSES.MESSAGE_USER 
      : CSS_CLASSES.MESSAGE_ASSISTANT;

    const contentClass = isUser 
      ? CSS_CLASSES.CONTENT_USER 
      : CSS_CLASSES.CONTENT_ASSISTANT;

    const sourcesHTML = this.renderSources(msg.sources);

    messageDiv.innerHTML = `
      <div class="${contentClass}">
        ${this.formatMessage(msg.content)}
      </div>
      ${sourcesHTML}
    `;

    return messageDiv;
  }

  private renderSources(sources?: ChatSource[]): string {
    if (!sources || sources.length === 0) return "";

    const sourceItems = sources.map((src) => {
      const isMdFile = /\.mdx?$/i.test(src.source);
      const href = `/posts/p${src.source.replace(/\.mdx?$/, "")}`;
      
      if (isMdFile) {
        return `
          <a href="${href}" 
             class="flex justify-between items-center px-2 py-2 mt-1 bg-muted rounded text-foreground no-underline transition-all text-xs hover:bg-accent hover:text-background" 
             target="_blank">
            <span>${src.title}</span>
            <span class="font-semibold opacity-70">${src.similarity}%</span>
          </a>
        `;
      } else {
        return `
          <div class="flex justify-between items-center px-2 py-2 mt-1 bg-muted rounded text-foreground text-xs opacity-75 cursor-default">
            <span>${src.title}</span>
            <span class="font-semibold opacity-70">${src.similarity}%</span>
          </div>
        `;
      }
    }).join("");

    return `
      <div class="mt-2 p-3 bg-background border border-border rounded-lg text-xs">
        <div class="font-semibold mb-2 text-foreground">📚 参考来源：</div>
        ${sourceItems}
      </div>
    `;
  }

  // ============= Markdown 格式化 =============
  private formatMessage(content: string): string {
    if (!this.highlighter) {
      return this.formatMessageFallback(content);
    }

    try {
      const processedContent = this.preprocessUrls(content);
      const html = marked.parse(processedContent, { async: false }) as string;
      return html;
    } catch (error) {
      logError("Markdown 渲染失败:", error);
      return content.replace(/\n/g, "<br>");
    }
  }

  private formatMessageFallback(content: string): string {
    return content
      .replace(/\n/g, "<br>")
      .replace(/`([^`]+)`/g, '<code class="bg-black/10 dark:bg-white/10 px-1 py-0.5 rounded text-sm">$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>");
  }

  private preprocessUrls(content: string): string {
    // 修复 URL 后跟中文标点的问题
    return content.replace(
      /(https?:\/\/[^\s<>）】\]]+?)([。，、；：！？）】\]])/g,
      "[$1]($1)$2"
    );
  }

  // ============= 工具方法 =============
  private scrollToBottom() {
    setTimeout(() => {
      this.elements.messagesList?.scrollTo({
        top: this.elements.messagesList.scrollHeight,
        behavior: "smooth",
      });
    }, ANIMATION_DURATION.SCROLL_DELAY);
  }

  private clearHistory() {
    this.state.messages = [];
    this.saveHistory();
    this.renderMessages();
  }

  // ============= 历史记录管理 =============
  private loadHistory(): ChatMessage[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return [];

      const messages = JSON.parse(stored);
      return Array.isArray(messages) ? messages.slice(-MAX_MESSAGES) : [];
    } catch (error) {
      logError("加载历史记录失败:", error);
      return [];
    }
  }

  private saveHistory() {
    try {
      const toSave = this.state.messages.slice(-MAX_MESSAGES);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    } catch (error) {
      logError("保存历史记录失败:", error);
      this.handleStorageError();
    }
  }

  private handleStorageError() {
    const fallbackLimit = 20;
    if (this.state.messages.length > fallbackLimit) {
      this.state.messages = this.state.messages.slice(-fallbackLimit);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state.messages));
      } catch (e) {
        logError("清理后仍然无法保存:", e);
      }
    }
  }
}

// ============= 导出 =============
export default ChatWidget;