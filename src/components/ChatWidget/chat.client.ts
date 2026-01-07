// src/components/ChatWidget/chat.client.ts
// 聊天组件客户端逻辑

import { marked } from "marked";
import { createHighlighter, type Highlighter } from "shiki";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  sources?: { title: string; source: string; similarity: number }[];
}

interface ChatState {
  messages: ChatMessage[];
  isOpen: boolean;
  isLoading: boolean;
  name: string;
}

const STORAGE_KEY = "blog-chat-history";
const MAX_MESSAGES = 50; // 最多保存 50 条消息

class ChatWidget {
  private state: ChatState;
  private elements: {
    widget?: HTMLElement;
    button?: HTMLElement;
    window?: HTMLElement;
    messagesList?: HTMLElement;
    input?: HTMLInputElement;
    sendBtn?: HTMLElement;
    clearBtn?: HTMLElement;
    closeBtn?: HTMLElement;
  };
  private highlighter: Highlighter | null = null;
  private initPromise: Promise<void>;
  private eventsBound: boolean = false;

  constructor(name: string) {
    this.state = {
      messages: this.loadHistory(),
      isOpen: false,
      isLoading: false,
      name,
    };
    this.elements = {};
    this.initPromise = this.init();
  }

  // 初始化
  private async init() {
    // 重新获取 DOM 元素（支持客户端路由后重新初始化）
    this.updateElements();

    // 初始化按钮为可见状态
    this.elements.button?.classList.remove("chat-hidden");
    this.elements.button?.classList.add("visible");
    
    // 初始化 Shiki 高亮器（只初始化一次）
    if (!this.highlighter) {
      await this.initHighlighter();
    }
    
    // 绑定事件
    this.bindEvents();
    this.eventsBound = true;
    
    this.renderMessages();
  }
  
  // 更新 DOM 元素引用
  private updateElements() {
    this.elements.widget = document.getElementById("chat-widget") || undefined;
    this.elements.button = document.getElementById("chat-button") || undefined;
    this.elements.window = document.getElementById("chat-window") || undefined;
    this.elements.messagesList =
      document.getElementById("chat-messages") || undefined;
    this.elements.input =
      (document.getElementById("chat-input") as HTMLInputElement) || undefined;
    this.elements.sendBtn =
      document.getElementById("chat-send") || undefined;
    this.elements.clearBtn =
      document.getElementById("chat-clear") || undefined;
    this.elements.closeBtn =
      document.getElementById("chat-close") || undefined;
  }
  
  // 公共方法：重新初始化（用于客户端路由后）
  public reinit() {
    console.log("[ChatWidget] 开始重新初始化, 当前 isOpen:", this.state.isOpen);
    
    // 更新 DOM 元素引用
    this.updateElements();
    
    console.log("[ChatWidget] DOM 元素:", {
      button: !!this.elements.button,
      window: !!this.elements.window,
      input: !!this.elements.input
    });
    
    // 重置状态：确保窗口是关闭状态
    this.state.isOpen = false;
    
    // 重置 UI：窗口隐藏，按钮显示
    this.elements.window?.classList.remove("open");
    this.elements.window?.classList.add("chat-hidden");
    this.elements.button?.classList.remove("chat-hidden");
    this.elements.button?.classList.add("visible");
    
    // 重新绑定事件
    this.rebindButtonEvents();
    
    // 重新渲染消息
    this.renderMessages();
    
    console.log("[ChatWidget] 重新初始化完成");
  }
  
  // 重新绑定按钮事件（用于客户端路由后重新初始化）
  private rebindButtonEvents() {
    // 通过克隆节点来移除所有旧的事件监听器
    if (this.elements.button) {
      const newButton = this.elements.button.cloneNode(true) as HTMLElement;
      this.elements.button.parentNode?.replaceChild(newButton, this.elements.button);
      this.elements.button = newButton;
      this.elements.button.addEventListener("click", () => this.toggleChat());
    }
    
    if (this.elements.closeBtn) {
      const newCloseBtn = this.elements.closeBtn.cloneNode(true) as HTMLElement;
      this.elements.closeBtn.parentNode?.replaceChild(newCloseBtn, this.elements.closeBtn);
      this.elements.closeBtn = newCloseBtn;
      this.elements.closeBtn.addEventListener("click", () => this.closeChat());
    }
    
    if (this.elements.sendBtn) {
      const newSendBtn = this.elements.sendBtn.cloneNode(true) as HTMLElement;
      this.elements.sendBtn.parentNode?.replaceChild(newSendBtn, this.elements.sendBtn);
      this.elements.sendBtn = newSendBtn;
      this.elements.sendBtn.addEventListener("click", () => this.sendMessage());
    }
    
    if (this.elements.clearBtn) {
      const newClearBtn = this.elements.clearBtn.cloneNode(true) as HTMLElement;
      this.elements.clearBtn.parentNode?.replaceChild(newClearBtn, this.elements.clearBtn);
      this.elements.clearBtn = newClearBtn;
      this.elements.clearBtn.addEventListener("click", () => this.clearHistory());
    }
    
    // 输入框事件
    if (this.elements.input) {
      const newInput = this.elements.input.cloneNode(true) as HTMLInputElement;
      this.elements.input.parentNode?.replaceChild(newInput, this.elements.input);
      this.elements.input = newInput;
      this.elements.input.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          this.sendMessage();
        }
      });
    }
  }

  // 初始化 Shiki 高亮器
  private async initHighlighter() {
    try {
      this.highlighter = await createHighlighter({
        themes: ["github-dark", "github-light"],
        langs: [
          "javascript",
          "typescript",
          "python",
          "java",
          "rust",
          "go",
          "html",
          "css",
          "json",
          "markdown",
          "bash",
          "shell",
          "sql",
          "yaml",
          "xml",
        ],
      });

      // 配置 marked 使用自定义 renderer
      const renderer = new marked.Renderer();
      
      renderer.code = ({ text, lang }: { text: string; lang?: string }): string => {
        if (!this.highlighter || !lang) {
          // 降级处理：返回基本的代码块
          const escapedText = text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
          return `<pre><code class="language-${lang || "text"}">${escapedText}</code></pre>`;
        }
        
        try {
          // 检测系统主题
          const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
          const theme = isDark ? "github-dark" : "github-light";
          
          return this.highlighter.codeToHtml(text, {
            lang: lang,
            theme,
          });
        } catch (error) {
          console.error("代码高亮失败:", error);
          const escapedText = text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
          return `<pre><code class="language-${lang}">${escapedText}</code></pre>`;
        }
      };

      // 自定义链接渲染器，确保链接正确处理
      renderer.link = ({ href, title, text }: { href: string; title?: string | null; text: string }): string => {
        // 清理 href，移除可能错误包含的中文字符
        let cleanHref = href;
        
        // 如果href包含编码的中文字符（%E开头），尝试解码并截断
        try {
          const decoded = decodeURIComponent(href);
          // 查找常见的中文标点符号，作为URL结束的标志
          const endMarkers = ['。', '，', '、', '；', '：', '！', '？', ' ', '\n'];
          let endPos = -1;
          
          for (const marker of endMarkers) {
            const pos = decoded.indexOf(marker);
            if (pos > 0 && (endPos === -1 || pos < endPos)) {
              endPos = pos;
            }
          }
          
          if (endPos > 0) {
            cleanHref = decoded.substring(0, endPos);
          }
        } catch (e) {
          // 解码失败，使用原始href
        }
        
        const titleAttr = title ? ` title="${title}"` : '';
        const escapedHref = cleanHref
          .replace(/&/g, "&amp;")
          .replace(/"/g, "&quot;");
        
        return `<a href="${escapedHref}"${titleAttr} target="_blank" rel="noopener noreferrer" class="text-accent underline hover:text-accent/80">${text}</a>`;
      };

      marked.setOptions({
        renderer,
        breaks: true,
        gfm: true,
      });
    } catch (error) {
      console.error("初始化 Shiki 失败:", error);
    }
  }

  // 绑定事件
  private bindEvents() {
    // 打开/关闭聊天窗口
    this.elements.button?.addEventListener("click", () => this.toggleChat());
    this.elements.closeBtn?.addEventListener("click", () => this.closeChat());

    // 发送消息
    this.elements.sendBtn?.addEventListener("click", () => this.sendMessage());
    this.elements.input?.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    // 清空对话
    this.elements.clearBtn?.addEventListener("click", () => this.clearHistory());

    // ESC 键关闭（只绑定一次）
    if (!this.eventsBound) {
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && this.state.isOpen) {
          this.closeChat();
        }
      });
    }
  }

  // 打开/关闭聊天
  private toggleChat() {
    this.state.isOpen = !this.state.isOpen;
    this.updateUI();
  }

  private closeChat() {
    this.state.isOpen = false;
    this.updateUI();
  }

  private updateUI() {
    if (this.state.isOpen) {
      // 先隐藏按钮
      this.elements.button?.classList.remove("visible");
      this.elements.button?.classList.add("chat-hidden");
      
      // 延迟显示窗口，创建流畅的过渡效果
      setTimeout(() => {
        this.elements.window?.classList.remove("chat-hidden");
        this.elements.window?.classList.add("open");
        this.elements.input?.focus();
        this.scrollToBottom();
      }, 150);
    } else {
      // 先隐藏窗口
      this.elements.window?.classList.remove("open");
      this.elements.window?.classList.add("chat-hidden");
      
      // 延迟显示按钮，创建流畅的过渡效果
      setTimeout(() => {
        this.elements.button?.classList.remove("chat-hidden");
        this.elements.button?.classList.add("visible");
      }, 200);
    }
  }

  // 发送消息
  private async sendMessage() {
    const message = this.elements.input?.value.trim();
    if (!message || this.state.isLoading) return;

    // 添加用户消息
    const userMessage: ChatMessage = {
      role: "user",
      content: message,
      timestamp: Date.now(),
    };
    this.state.messages.push(userMessage);
    this.saveHistory();
    this.renderMessages();

    // 清空输入框
    if (this.elements.input) this.elements.input.value = "";

    // 显示加载状态
    this.state.isLoading = true;
    this.addLoadingMessage();

    try {
      // 调用 API（流式响应）
      await this.streamChatResponse(message);
    } catch (error) {
      console.error("发送消息失败:", error);
      this.addErrorMessage("抱歉，发送消息时出错了，请稍后再试。");
    } finally {
      this.state.isLoading = false;
      this.removeLoadingMessage();
    }
  }

  // 流式调用 API
  private async streamChatResponse(message: string) {
    // 过滤掉错误消息，只保留有效的对话历史
    const validHistory = this.state.messages
      .filter((msg) => !msg.content.startsWith("❌")) // 过滤错误消息
      .slice(-10) // 只取最近 10 条
      .map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        history: validHistory,
      }),
    });

    if (!response.ok) {
      let errorMessage = `API 错误 (${response.status})`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
        console.error("API 错误详情:", errorData);
      } catch (e) {
        console.error("无法解析错误响应:", e);
      }
      throw new Error(errorMessage);
    }

    // 非流式响应（降级处理）
    const contentType = response.headers.get("content-type");
    if (!contentType?.includes("text/event-stream")) {
      try {
        const data = await response.json();
        if (data.error) {
          throw new Error(data.error);
        }
        if (data.type === "message" || data.content) {
          this.addAssistantMessage(data.content, data.sources);
        }
      } catch (e) {
        console.error("解析响应失败:", e);
        throw new Error("服务器返回了无效的响应");
      }
      return;
    }

    // 确保有 response.body
    if (!response.body) {
      throw new Error("服务器未返回数据流");
    }

    // 处理 SSE 流
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let assistantMessage = "";
    let sources: ChatMessage["sources"] = [];

    // 创建一个临时的助手消息用于流式更新
    const tempMessageId = this.addAssistantMessage("", []);

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.type === "sources") {
                sources = data.sources;
              } else if (data.type === "content") {
                assistantMessage += data.content;
                this.updateStreamingMessage(tempMessageId, assistantMessage);
              } else if (data.type === "done") {
                // 完成，添加来源信息
                this.updateStreamingMessage(
                  tempMessageId,
                  assistantMessage,
                  sources
                );
              } else if (data.type === "error") {
                this.removeMessage(tempMessageId);
                this.addErrorMessage(data.error);
                return; // 提前返回，不继续处理
              }
            } catch (parseError) {
              console.error("解析 SSE 数据失败:", line, parseError);
              // 继续处理下一行
            }
          }
        }
      }
    } catch (error) {
      console.error("流式响应错误:", error);
      this.removeMessage(tempMessageId);
      this.addErrorMessage("接收回复时出错");
    }
  }

  // 添加助手消息
  private addAssistantMessage(
    content: string,
    sources?: ChatMessage["sources"]
  ): number {
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

  // 更新流式消息
  private updateStreamingMessage(
    index: number,
    content: string,
    sources?: ChatMessage["sources"]
  ) {
    if (this.state.messages[index]) {
      this.state.messages[index].content = content;
      if (sources) {
        this.state.messages[index].sources = sources;
      }
      this.saveHistory();
      this.renderMessages();
    }
  }

  // 移除消息
  private removeMessage(index: number) {
    this.state.messages.splice(index, 1);
    this.renderMessages();
  }

  // 添加错误消息
  private addErrorMessage(error: string) {
    this.addAssistantMessage(`❌ ${error}`);
  }

  // 添加/移除加载状态
  private addLoadingMessage() {
    const loadingDiv = document.createElement("div");
    loadingDiv.id = "loading-indicator";
    loadingDiv.className = "message flex flex-col max-w-[85%] self-start";
    loadingDiv.innerHTML = `
      <div class="px-4 py-3 rounded-2xl rounded-bl-sm bg-muted text-foreground wrap-break-word leading-relaxed">
        <div class="typing-indicator flex gap-1 py-2">
          <span class="w-2 h-2 rounded-full bg-foreground opacity-40"></span>
          <span class="w-2 h-2 rounded-full bg-foreground opacity-40"></span>
          <span class="w-2 h-2 rounded-full bg-foreground opacity-40"></span>
        </div>
      </div>
    `;
    this.elements.messagesList?.appendChild(loadingDiv);
    this.scrollToBottom();
  }

  private removeLoadingMessage() {
    document.getElementById("loading-indicator")?.remove();
  }

  // 渲染消息列表
  private renderMessages() {
    if (!this.elements.messagesList) return;

    // 保留加载指示器
    const loadingIndicator = document.getElementById("loading-indicator");

    this.elements.messagesList.innerHTML = "";

    if (this.state.messages.length === 0) {
      // 显示欢迎消息
      this.elements.messagesList.innerHTML = `
        <div class="text-center py-8 px-4 text-foreground">
          <div class="welcome-icon text-5xl mb-4 animate-wave">👋</div>
          <h3 class="m-0 mb-2 text-xl text-foreground">你好！我是${this.state.name}</h3>
          <p class="m-0 mb-6 text-foreground opacity-70">你可以问我关于博客内容的任何问题</p>
          <div class="flex flex-col gap-2 mt-4">
            <button class="quick-btn px-4 py-3 bg-muted border border-border rounded-lg cursor-pointer transition-all text-foreground text-sm text-left hover:bg-accent hover:text-background hover:border-accent" data-question="作者的技能栈有哪些？">💼 技能栈</button>
            <button class="quick-btn px-4 py-3 bg-muted border border-border rounded-lg cursor-pointer transition-all text-foreground text-sm text-left hover:bg-accent hover:text-background hover:border-accent" data-question="有哪些项目？">🚀 项目</button>
            <button class="quick-btn px-4 py-3 bg-muted border border-border rounded-lg cursor-pointer transition-all text-foreground text-sm text-left hover:bg-accent hover:text-background hover:border-accent" data-question="关于作者的信息？"> ✍ 笔者信息</button>
          </div>
        </div>
      `;

      // 绑定快捷问题
      this.elements.messagesList
        .querySelectorAll(".quick-btn")
        .forEach((btn) => {
          btn.addEventListener("click", (e) => {
            const question = (e.target as HTMLElement).dataset.question;
            if (question && this.elements.input) {
              this.elements.input.value = question;
              this.sendMessage();
            }
          });
        });
    } else {
      // 渲染消息
      this.state.messages.forEach((msg) => {
        const messageDiv = document.createElement("div");
        messageDiv.className = `message flex flex-col max-w-[85%] ${
          msg.role === "user" ? "self-end" : "self-start"
        }`;

        let sourcesHTML = "";
        if (msg.sources && msg.sources.length > 0) {
          sourcesHTML = `
            <div class="mt-2 p-3 bg-background border border-border rounded-lg text-xs">
              <div class="font-semibold mb-2 text-foreground">📚 参考来源：</div>
              ${msg.sources
                .map(
                  (src) => {
                    // 检查是否是 md/mdx 文件
                    const isMdFile = /\.mdx?$/i.test(src.source);
                    if (isMdFile) {
                      return `
                <a href="/posts/p${src.source.replace(/\.mdx?$/, "")}" class="flex justify-between items-center px-2 py-2 mt-1 bg-muted rounded text-foreground no-underline transition-all text-xs hover:bg-accent hover:text-background" target="_blank">
                  <span>${src.title}</span> <span class="font-semibold opacity-70">${src.similarity}%</span>
                </a>
              `;
                    } else {
                      return `
                <div class="flex justify-between items-center px-2 py-2 mt-1 bg-muted rounded text-foreground text-xs opacity-75 cursor-default">
                  <span>${src.title}</span> <span class="font-semibold opacity-70">${src.similarity}%</span>
                </div>
              `;
                    }
                  }
                )
                .join("")}
            </div>
          `;
        }

        const contentClass = msg.role === "user" 
          ? "px-4 py-3 rounded-2xl rounded-br-sm bg-accent text-background wrap-break-word leading-relaxed"
          : "px-4 py-3 rounded-2xl rounded-bl-sm bg-muted text-foreground wrap-break-word leading-relaxed markdown-content";

        messageDiv.innerHTML = `
          <div class="${contentClass}">
            ${this.formatMessage(msg.content)}
          </div>
          ${sourcesHTML}
        `;

        this.elements.messagesList?.appendChild(messageDiv);
      });
    }

    // 恢复加载指示器
    if (loadingIndicator) {
      this.elements.messagesList.appendChild(loadingIndicator);
    }

    this.scrollToBottom();
  }

  // 格式化消息（使用 Marked + Shiki 渲染完整 Markdown）
  private formatMessage(content: string): string {
    if (!this.highlighter) {
      // 降级处理：如果 highlighter 未初始化，使用简单替换
      return content
        .replace(/\n/g, "<br>")
        .replace(/`([^`]+)`/g, '<code class="bg-black/10 dark:bg-white/10 px-1 py-0.5 rounded text-sm">$1</code>')
        .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
        .replace(/\*([^*]+)\*/g, "<em>$1</em>");
    }

    try {
      // 预处理：修复URL后面跟中文标点的问题
      // 将裸露的URL转换为markdown链接格式，并在中文标点前截断
      const processedContent = content.replace(
        /(https?:\/\/[^\s<>）】\]]+?)([。，、；：！？）】\]])/g,
        '[$1]($1)$2'
      );
      
      // 使用 marked 渲染 markdown
      const html = marked.parse(processedContent, { async: false }) as string;
      return html;
    } catch (error) {
      console.error("Markdown 渲染失败:", error);
      return content.replace(/\n/g, "<br>");
    }
  }

  // 滚动到底部
  private scrollToBottom() {
    setTimeout(() => {
      this.elements.messagesList?.scrollTo({
        top: this.elements.messagesList.scrollHeight,
        behavior: "smooth",
      });
    }, 100);
  }

  // 清空历史
  private clearHistory() {
      this.state.messages = [];
      this.saveHistory();
      this.renderMessages();
  }

  // 加载历史记录
  private loadHistory(): ChatMessage[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const messages = JSON.parse(stored);
        // 只保留最近的消息
        return messages.slice(-MAX_MESSAGES);
      }
    } catch (error) {
      console.error("加载历史记录失败:", error);
    }
    return [];
  }

  // 保存历史记录
  private saveHistory() {
    try {
      // 只保存最近的消息，避免超出 localStorage 限制
      const toSave = this.state.messages.slice(-MAX_MESSAGES);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    } catch (error) {
      console.error("保存历史记录失败:", error);
      // 如果存储失败（可能是容量满了），清理旧消息
      if (this.state.messages.length > 20) {
        this.state.messages = this.state.messages.slice(-20);
        try {
          localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(this.state.messages)
          );
        } catch (e) {
          console.error("清理后仍然无法保存:", e);
        }
      }
    }
  }
}

// 初始化聊天组件
export default ChatWidget;