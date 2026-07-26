import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { AppErrorBoundary } from "./components/AppErrorBoundary";

// --- Global Error Handlers ---
window.addEventListener("error", (event) => {
  const msg = String(event.error?.message || event.message || '').toLowerCase();
  if (
    msg.includes('script error') ||
    msg.includes('econnreset') || 
    msg.includes('unavailable') || 
    msg.includes('grpcconnection') || 
    msg.includes('failed to fetch') || 
    msg.includes('network error') ||
    msg.includes('resizeobserver') ||
    msg.includes('load failed')
  ) {
    event.preventDefault();
    console.warn("Transient notice intercepted:", msg);
    return;
  }
  console.error("Global runtime error:", event.error || event.message);
});

window.addEventListener("unhandledrejection", (event) => {
  const reasonStr = String(event.reason?.message || event.reason || '').toLowerCase();
  if (
    reasonStr.includes('script error') ||
    reasonStr.includes('econnreset') || 
    reasonStr.includes('unavailable') || 
    reasonStr.includes('grpcconnection') || 
    reasonStr.includes('failed to fetch') || 
    reasonStr.includes('network error') ||
    reasonStr.includes('resizeobserver') ||
    reasonStr.includes('quota')
  ) {
    event.preventDefault();
    console.warn("Transient unhandled rejection intercepted:", reasonStr);
    return;
  }
  console.error("Unhandled promise rejection:", event.reason);
});

// --- Console Patching ---
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

const cleanQuotaLogs = (originalFn: (...args: any[]) => void) => {
  return (...args: any[]) => {
    const argStr = args.map(a => {
      if (a instanceof Error) {
        return String(a.message || a.stack || a);
      }
      return String(a?.message || a?.details || a || '');
    }).join(' ');

    const lowerStr = argStr.toLowerCase();
    const isQuotaOrTransient = lowerStr.includes('quota') || 
                                lowerStr.includes('resource_exhausted') || 
                                lowerStr.includes('limit exceeded') ||
                                lowerStr.includes('exhausted') ||
                                lowerStr.includes('quota_exceeded') ||
                                lowerStr.includes('cancelling stream') ||
                                lowerStr.includes('disconnecting idle stream') ||
                                lowerStr.includes('timed out waiting for new targets') ||
                                lowerStr.includes('unavailable') ||
                                lowerStr.includes('econnreset') ||
                                lowerStr.includes('grpcconnection') ||
                                lowerStr.includes('code: 14') ||
                                lowerStr.includes('could not reach') ||
                                lowerStr.includes('script error');

    if (args[0] && typeof args[0] === 'string' && args[0].includes('BloomFilter error')) {
      return;
    }
    if (isQuotaOrTransient) {
      console.log(`[Notice] Intercepted transient or offline notice.`);
      return;
    }
    originalFn.apply(console, args);
  };
};

console.error = cleanQuotaLogs(originalConsoleError);
console.warn = cleanQuotaLogs(originalConsoleWarn);

// --- Helper Functions ---
const rawLogoUrl = '/logo.svg';

function resolveImageUrl(url: string): string {
  if (!url) return '';
  const val = url.trim();
  if (val.includes('drive.google.com')) {
    const idMatch = val.match(/\/d\/([a-zA-Z0-9-_]+)/) || val.match(/[?&]id=([a-zA-Z0-9-_]+)/);
    if (idMatch && idMatch[1]) {
      return `https://lh3.googleusercontent.com/d/${idMatch[1]}`;
    }
  }
  return val;
}

function setFavicon(url: string) {
  if (url.includes('.svg') || url.startsWith('data:image/svg')) {
    const link: HTMLLinkElement = document.querySelector("link[rel~='icon']") || document.createElement('link');
    link.rel = 'icon';
    link.type = 'image/svg+xml';
    link.href = url;
    document.head.appendChild(link);
    return;
  }

  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.beginPath();
    ctx.arc(canvas.width / 2, canvas.height / 2, Math.min(canvas.width, canvas.height) / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    
    const link: HTMLLinkElement = document.querySelector("link[rel~='icon']") || document.createElement('link');
    link.rel = 'icon';
    link.type = 'image/png';
    link.href = canvas.toDataURL('image/png');
    document.head.appendChild(link);
  };
  
  img.onerror = () => {
    const link: HTMLLinkElement = document.querySelector("link[rel~='icon']") || document.createElement('link');
    link.rel = 'icon';
    link.href = url;
    document.head.appendChild(link);
  }
  
  img.src = url;
}

function renderFatalError(error: unknown, title = "Application failed to start") {
  const root = document.getElementById("root");

  if (!root) {
    console.error(title, error);
    return;
  }

  const message = error instanceof Error ? error.message : String(error ?? "Unknown error");

  root.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;background:#f8fafc;font-family:Arial,sans-serif;">
      <div style="width:100%;max-width:640px;background:white;border:1px solid #fecaca;border-radius:20px;padding:24px;box-shadow:0 20px 50px rgba(15,23,42,.12);">
        <h1 style="margin:0;color:#991b1b;font-size:22px;">${title}</h1>
        <p style="margin-top:12px;color:#475569;line-height:1.6;">The application encountered an unexpected error instead of loading normally.</p>
        <pre style="margin-top:16px;overflow:auto;white-space:pre-wrap;background:#fff1f2;color:#9f1239;border-radius:12px;padding:14px;font-size:12px;">${message}</pre>
        <button onclick="window.location.reload()" style="margin-top:16px;border:0;border-radius:12px;padding:12px 18px;background:#0f766e;color:white;font-weight:700;cursor:pointer;">Reload Application</button>
      </div>
    </div>
  `;
}

// --- Bootstrap ---
async function bootstrap() {
  try {
    const rootElement = document.getElementById("root");
    if (!rootElement) {
      throw new Error('Root element with id="root" was not found.');
    }

    setFavicon(resolveImageUrl(rawLogoUrl));
    document.title = 'SRC Registration Form';

    ReactDOM.createRoot(rootElement).render(
      <React.StrictMode>
        <AppErrorBoundary>
          <App />
        </AppErrorBoundary>
      </React.StrictMode>
    );
  } catch (error) {
    console.error("Application bootstrap failed:", error);
    renderFatalError(error);
  }
}

void bootstrap();
