import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Mail, Lock, Eye, EyeOff, Loader2, Check, Sun, Moon, UserCheck, Inbox, CheckCircle2 } from 'lucide-react';
import { auth, googleSignIn } from '../utils/auth';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { initFirebaseClient } from '../utils/firebaseClient';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { PortalLoading } from './PortalLoading';
import { normalizeEmail } from '../utils/stringUtils';

const GoogleIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    xmlnsXlink="http://www.w3.org/1999/xlink"
    xmlSpace="preserve"
    overflow="hidden"
    viewBox="0 0 268.152 273.883"
    className={className}
  >
    <defs>
      <linearGradient id="a">
        <stop offset="0" stopColor="#0fbc5c" />
        <stop offset="1" stopColor="#0cba65" />
      </linearGradient>
      <linearGradient id="g">
        <stop offset=".231" stopColor="#0fbc5f" />
        <stop offset=".312" stopColor="#0fbc5f" />
        <stop offset=".366" stopColor="#0fbc5e" />
        <stop offset=".458" stopColor="#0fbc5d" />
        <stop offset=".54" stopColor="#12bc58" />
        <stop offset=".699" stopColor="#28bf3c" />
        <stop offset=".771" stopColor="#38c02b" />
        <stop offset=".861" stopColor="#52c218" />
        <stop offset=".915" stopColor="#67c30f" />
        <stop offset="1" stopColor="#86c504" />
      </linearGradient>
      <linearGradient id="h">
        <stop offset=".142" stopColor="#1abd4d" />
        <stop offset=".248" stopColor="#6ec30d" />
        <stop offset=".312" stopColor="#8ac502" />
        <stop offset=".366" stopColor="#a2c600" />
        <stop offset=".446" stopColor="#c8c903" />
        <stop offset=".54" stopColor="#ebcb03" />
        <stop offset=".616" stopColor="#f7cd07" />
        <stop offset=".699" stopColor="#fdcd04" />
        <stop offset=".771" stopColor="#fdce05" />
        <stop offset=".861" stopColor="#ffce0a" />
      </linearGradient>
      <linearGradient id="f">
        <stop offset=".316" stopColor="#ff4c3c" />
        <stop offset=".604" stopColor="#ff692c" />
        <stop offset=".727" stopColor="#ff7825" />
        <stop offset=".885" stopColor="#ff8d1b" />
        <stop offset="1" stopColor="#ff9f13" />
      </linearGradient>
      <linearGradient id="b">
        <stop offset=".231" stopColor="#ff4541" />
        <stop offset=".312" stopColor="#ff4540" />
        <stop offset=".458" stopColor="#ff4640" />
        <stop offset=".54" stopColor="#ff473f" />
        <stop offset=".699" stopColor="#ff5138" />
        <stop offset=".771" stopColor="#ff5b33" />
        <stop offset=".861" stopColor="#ff6c29" />
        <stop offset="1" stopColor="#ff8c18" />
      </linearGradient>
      <linearGradient id="d">
        <stop offset=".408" stopColor="#fb4e5a" />
        <stop offset="1" stopColor="#ff4540" />
      </linearGradient>
      <linearGradient id="c">
        <stop offset=".132" stopColor="#0cba65" />
        <stop offset=".21" stopColor="#0bb86d" />
        <stop offset=".297" stopColor="#09b479" />
        <stop offset=".396" stopColor="#08ad93" />
        <stop offset=".477" stopColor="#0aa6a9" />
        <stop offset=".568" stopColor="#0d9cc6" />
        <stop offset=".667" stopColor="#1893dd" />
        <stop offset=".769" stopColor="#258bf1" />
        <stop offset=".859" stopColor="#3086ff" />
      </linearGradient>
      <linearGradient id="e">
        <stop offset=".366" stopColor="#ff4e3a" />
        <stop offset=".458" stopColor="#ff8a1b" />
        <stop offset=".54" stopColor="#ffa312" />
        <stop offset=".616" stopColor="#ffb60c" />
        <stop offset=".771" stopColor="#ffcd0a" />
        <stop offset=".861" stopColor="#fecf0a" />
        <stop offset=".915" stopColor="#fecf08" />
        <stop offset="1" stopColor="#fdcd01" />
      </linearGradient>
      <linearGradient xlinkHref="#a" id="s" x1="219.7" x2="254.467" y1="329.535" y2="329.535" gradientUnits="userSpaceOnUse" />
      <radialGradient xlinkHref="#b" id="m" cx="109.627" cy="135.862" r="71.46" fx="109.627" fy="135.862" gradientTransform="matrix(-1.93688 1.043 1.45573 2.55542 290.525 -400.634)" gradientUnits="userSpaceOnUse" />
      <radialGradient xlinkHref="#c" id="n" cx="45.259" cy="279.274" r="71.46" fx="45.259" fy="279.274" gradientTransform="matrix(-3.5126 -4.45809 -1.69255 1.26062 870.8 191.554)" gradientUnits="userSpaceOnUse" />
      <radialGradient xlinkHref="#d" id="l" cx="304.017" cy="118.009" r="47.854" fx="304.017" fy="118.009" gradientTransform="matrix(2.06435 0 0 2.59204 -297.679 -151.747)" gradientUnits="userSpaceOnUse" />
      <radialGradient xlinkHref="#e" id="o" cx="181.001" cy="177.201" r="71.46" fx="181.001" fy="177.201" gradientTransform="matrix(-.24858 2.08314 2.96249 .33417 -255.146 -331.164)" gradientUnits="userSpaceOnUse" />
      <radialGradient xlinkHref="#p" id="p-grad" cx="207.673" cy="108.097" r="41.102" fx="207.673" fy="108.097" gradientTransform="matrix(-1.2492 1.34326 -3.89684 -3.4257 880.501 194.905)" gradientUnits="userSpaceOnUse" />
      <radialGradient xlinkHref="#g" id="r" cx="109.627" cy="135.862" r="71.46" fx="109.627" fy="135.862" gradientTransform="matrix(-1.93688 -1.043 1.45573 -2.55542 290.525 838.683)" gradientUnits="userSpaceOnUse" />
      <radialGradient xlinkHref="#h" id="j" cx="154.87" cy="145.969" r="71.46" fx="154.87" fy="145.969" gradientTransform="matrix(-.0814 -1.93722 2.92674 -.11625 -215.135 632.86)" gradientUnits="userSpaceOnUse" />
      <filter id="q" width="1.097" height="1.116" x="-.048" y="-.058" colorInterpolationFilters="sRGB">
        <feGaussianBlur stdDeviation="1.701" />
      </filter>
      <filter id="k" width="1.033" height="1.02" x="-.017" y="-.01" colorInterpolationFilters="sRGB">
        <feGaussianBlur stdDeviation=".242" />
      </filter>
      <clipPath id="i" clipPathUnits="userSpaceOnUse">
        <path d="M371.378 193.24H237.083v53.438h77.167c-1.241 7.563-4.026 15.003-8.105 21.786-4.674 7.773-10.451 13.69-16.373 18.196-17.74 13.498-38.42 16.258-52.783 16.258-36.283 0-67.283-23.286-79.285-54.928-.484-1.149-.805-2.335-1.197-3.507a81.115 81.115 0 0 1-4.101-25.448c0-9.226 1.569-18.057 4.43-26.398 11.285-32.897 42.985-57.467 80.179-57.467 7.481 0 14.685.884 21.517 2.648a77.668 77.668 0 0 1 33.425 18.25l40.834-39.712c-24.839-22.616-57.219-36.32-95.844-36.32-30.878 0-59.386 9.553-82.748 25.7-18.945 13.093-34.483 30.625-44.97 50.985-9.753 18.879-15.094 39.8-15.094 62.294 0 22.495 5.35 43.633 15.103 62.337v.126c10.302 19.857 25.368 36.954 43.678 49.988 15.997 11.386 44.68 26.551 84.031 26.551 22.63 0 42.687-4.051 60.375-11.644 12.76-5.478 24.065-12.622 34.301-21.804 13.525-12.132 24.117-27.139 31.347-44.404 7.23-17.265 11.097-36.79 11.097-57.957 0-9.858-.998-19.87-2.689-28.968Z" />
      </clipPath>
    </defs>
    <g clipPath="url(#i)" transform="matrix(.95792 0 0 .98525 -90.174 -78.856)">
      <path fill="url(#j)" d="M92.076 219.958c.148 22.14 6.501 44.983 16.117 63.424v.127c6.949 13.392 16.445 23.97 27.26 34.452l65.327-23.67c-12.36-6.235-14.246-10.055-23.105-17.026-9.054-9.066-15.802-19.473-20.004-31.677h-.17l.17-.127c-2.765-8.058-3.037-16.613-3.14-25.503Z" filter="url(#k)" />
      <path fill="url(#l)" d="M237.083 79.025c-6.456 22.526-3.988 44.421 0 57.161 7.457.006 14.64.888 21.45 2.647a77.662 77.662 0 0 1 33.424 18.25l41.88-40.726c-24.81-22.59-54.667-37.297-96.754-37.332Z" filter="url(#k)" />
      <path fill="url(#m)" d="M236.943 78.847c-31.67 0-60.91 9.798-84.871 26.359a145.533 145.533 0 0 0-24.332 21.15c-1.904 17.744 14.257 39.551 46.262 39.37 15.528-17.936 38.495-29.542 64.056-29.542l.07.002-1.044-57.335c-.048 0-.093-.004-.14-.004Z" filter="url(#k)" />
      <path fill="url(#n)" d="m341.475 226.379-28.268 19.285c-1.24 7.562-4.028 15.002-8.107 21.786-4.674 7.772-10.45 13.69-16.373 18.196-17.702 13.47-38.328 16.244-52.687 16.255-14.842 25.102-17.444 37.675 1.043 57.934 22.877-.016 43.157-4.117 61.046-11.796 12.931-5.551 24.388-12.792 34.761-22.097 13.706-12.295 24.442-27.503 31.769-45 7.327-17.497 11.245-37.282 11.245-58.734Z" filter="url(#k)" />
      <path fill="#3086ff" d="M234.996 191.21v57.498h136.006c1.196-7.874 5.152-18.064 5.152-26.5 0-9.858-.996-21.899-2.687-30.998Z" filter="url(#k)" />
      <path fill="url(#o)" d="M128.39 124.327c-8.394 9.119-15.564 19.326-21.249 30.364-9.753 18.879-15.094 41.83-15.094 64.324 0 .317.026.627.029.944 4.32 8.224 59.666 6.649 62.456 0-.004-.31-.039-.613-.039-.924 0-9.226 1.57-16.026 4.43-24.367 3.53-10.289 9.056-19.763 16.123-27.926 1.602-2.031 5.875-6.397 7.121-9.016.475-.997-.862-1.557-.937-1.908-.083-.393-1.876-.077-2.277-.37-1.275-.929-3.8-1.414-5.334-1.845-3.277-.921-8.708-2.953-11.725-5.06-9.536-6.658-24.417-14.612-33.505-24.216Z" filter="url(#k)" />
      <path fill="url(#p-grad)" d="M162.099 155.857c22.112 13.301 28.471-6.714 43.173-12.977l-25.574-52.664a144.74 144.74 0 0 0-26.543 14.504c-12.316 8.512-23.192 18.9-32.176 30.72Z" filter="url(#q)" />
      <path fill="url(#r)" d="M171.099 290.222c-29.683 10.641-34.33 11.023-37.062 29.29a144.806 144.806 0 0 0 16.792 13.984c15.996 11.386 46.766 26.551 86.118 26.551.046 0 .09-.004.137-.004v-59.157l-.094.002c-14.736 0-26.512-3.843-38.585-10.527-2.977-1.648-8.378 2.777-11.123.799-3.786-2.729-12.9 2.35-16.183-.938Z" filter="url(#k)" />
      <path fill="url(#s)" d="M219.7 299.023v59.996c5.506.64 11.236 1.028 17.247 1.028 6.026 0 11.855-.307 17.52-.872v-59.748a105.119 105.119 0 0 1-17.477 1.461c-5.932 0-11.7-.686-17.29-1.865Z" filter="url(#k)" opacity=".5" />
    </g>
  </svg>
);

const LOGO_URL = '/logo.svg';

const labelBase =
  "text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1.5";

const inputBase =
  "w-full bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-slate-900 dark:text-white font-bold outline-none focus:border-[#00B8A9] text-xs transition-all placeholder:text-[10px] placeholder:font-normal";

const pillButton =
  "w-full bg-gradient-to-r from-[#0057FF] via-[#00B8A9] to-[#22C55E] hover:brightness-110 text-white py-3 lg:py-4 rounded-full font-bold text-xs lg:text-sm uppercase tracking-wider shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:translate-y-[-2px] active:scale-[0.98] flex items-center justify-center gap-2";

const googleButton =
  "w-full rounded-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] px-4 py-3 lg:py-4 text-xs lg:text-sm font-black uppercase tracking-widest text-slate-700 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-900 transition-all active:scale-[0.98] flex items-center justify-center gap-3 shadow-sm cursor-pointer disabled:opacity-50";

interface LoginPageProps {
  onSuccess: (user: any) => void;
  onToggleSignup: () => void;
}

export function LoginPage({ onSuccess, onToggleSignup }: LoginPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [resetSending, setResetSending] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Dark/Light Mode state
  const [darkMode, setDarkMode] = useState(() => {
    return document.documentElement.classList.contains('dark') || localStorage.getItem('theme') === 'dark';
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  // Load Remembered Email
  useEffect(() => {
    const rememberedEmail = localStorage.getItem('src_remembered_email');
    if (rememberedEmail) {
      setEmail(rememberedEmail);
      setRememberMe(true);
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || googleLoading) return;
    if (!email.trim() || !password) {
      setError("Please fill out all fields.");
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const loginEmail = normalizeEmail(email);

      const userCredential = await signInWithEmailAndPassword(auth, loginEmail, password);
      
      // Save/Clear Remembered Email
      if (rememberMe) {
        localStorage.setItem('src_remembered_email', loginEmail);
      } else {
        localStorage.removeItem('src_remembered_email');
      }

      onSuccess(userCredential.user);
    } catch (err: any) {
      console.error("Login Error:", err);
      let errMsg = "Invalid credentials or password.";
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        errMsg = "Incorrect email address or password.";
      } else if (err.code === 'auth/invalid-email') {
        errMsg = "The email address format is invalid.";
      } else if (err?.message) {
        errMsg = err.message;
      }
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (loading || googleLoading) return;
    setGoogleLoading(true);
    setError(null);
    setMessage(null);
    try {
      const res = await googleSignIn();
      if (res && res.user) {
        onSuccess(res.user);
      }
    } catch (err: any) {
      console.error("Google Sign-In Error:", err);
      setError(err?.message || "Google Authentication failed.");
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setError("Please enter your email address in the field below to reset your password.");
      return;
    }

    setError(null);
    setMessage(null);
    setResetSending(true);

    try {
      await sendPasswordResetEmail(auth, cleanEmail);
      setResetEmailSent(cleanEmail);
      setMessage("Password reset email sent! Please check your Inbox or Spam folder.");
    } catch (err: any) {
      console.warn("Client Password Reset error:", err);
      
      if (err.code === 'auth/user-not-found') {
        setError("We could not find an account registered with that email address. Please double check your email.");
        setResetSending(false);
        return;
      } else if (err.code === 'auth/invalid-email') {
        setError("Please enter a valid email address (e.g. username@gmail.com).");
        setResetSending(false);
        return;
      }

      // Try server fallback endpoint if client network request or domain check failed
      try {
        const res = await fetch('/api/send-password-reset', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: cleanEmail }),
        });
        const data = await res.json();
        
        if (res.ok && data.success) {
          setResetEmailSent(cleanEmail);
          setMessage("Password reset instructions processed! Please check your Inbox or Spam folder.");
        } else if (res.status === 404 || (data.error && data.error.includes("not find an account"))) {
          setError(data.error || "We could not find an account with that email address.");
        } else {
          setResetEmailSent(cleanEmail);
          setMessage("Password reset request received. If an account exists for this email address, password reset instructions have been sent to your Inbox or Spam folder.");
        }
      } catch (fallbackErr: any) {
        console.error("Server password reset fallback failed:", fallbackErr);
        setResetEmailSent(cleanEmail);
        setMessage("Password reset request submitted. Please check your Email Inbox and Spam/Junk folder.");
      }
    } finally {
      setResetSending(false);
    }
  };

  return (
    <>
      {(loading || googleLoading) && (
        <PortalLoading message="Waiting to Log In" subMessage="Please wait, Future RCrim." status="Authenticating your account…" />
      )}
      <div className="max-w-md w-full bg-white dark:bg-[#0B1220] border border-slate-100 dark:border-slate-800/80 rounded-3xl p-8 sm:p-10 shadow-2xl relative overflow-hidden space-y-8">
      {/* Dark/Light mode toggle */}
      <button
        type="button"
        onClick={() => setDarkMode(!darkMode)}
        className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer p-1.5 rounded-lg border border-slate-100 dark:border-slate-800/80"
        title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
      >
        {darkMode ? <Sun size={15} /> : <Moon size={15} />}
      </button>

      {/* Brand Header */}
      <div className="flex flex-col items-center text-center space-y-4">
        {/* Floating/Bounce Logo animation */}
        <a
          href="https://samaritanreviewcenter.com/student/"
          className="animate-float cursor-pointer hover:scale-105 transition-transform duration-300 block"
          title="Samaritan Review Center"
        >
          <img
            src={LOGO_URL}
            alt="Samaritan Review Center Logo"
            className="w-24 h-24 object-contain pointer-events-none select-none"
          />
        </a>

        <div className="space-y-1">
          <p className="text-[10px] font-bold text-teal-600 dark:text-[#00B8A9] uppercase tracking-widest font-mono">Welcome to</p>
          <a
            href="https://samaritanreviewcenter.com/student/"
            className="text-xl font-extrabold tracking-tight text-slate-800 dark:text-white uppercase font-display hover:text-teal-600 dark:hover:text-[#00B8A9] transition-colors block"
          >
            Samaritan Review Center
          </a>
          <button
            type="button"
            onClick={onToggleSignup}
            className="text-[11px] font-bold text-teal-600 dark:text-[#00B8A9] hover:underline cursor-pointer"
          >
            Create an account
          </button>
        </div>
      </div>

      {/* Message and Error alerts */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-rose-50 dark:bg-rose-950/30 border-l-4 border-rose-500 text-rose-700 dark:text-rose-300 p-4 rounded-xl text-xs font-semibold"
        >
          {error}
        </motion.div>
      )}

      {/* Password Reset Notification Card / Alert Message */}
      {message && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800/80 text-emerald-950 dark:text-emerald-100 p-4 sm:p-5 rounded-2xl shadow-md relative overflow-hidden space-y-3"
        >
          <div className="flex items-start gap-3">
            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/60 rounded-xl text-emerald-600 dark:text-emerald-400 shrink-0">
              <Mail className="w-5 h-5 animate-bounce" />
            </div>
            <div className="space-y-1.5 flex-1">
              <h4 className="font-bold text-xs uppercase tracking-wider text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Password Reset Email Sent
              </h4>
              <p className="text-xs text-emerald-800 dark:text-emerald-300 leading-relaxed font-medium">
                {message}
              </p>
              {resetEmailSent && (
                <div className="mt-2 bg-white/80 dark:bg-slate-900/80 p-3 rounded-xl border border-emerald-200 dark:border-emerald-900/50 text-xs space-y-1.5 shadow-inner">
                  <div className="flex items-center justify-between text-slate-700 dark:text-slate-200 font-semibold">
                    <span>Target Email:</span>
                    <span className="font-mono text-emerald-700 dark:text-emerald-300 font-bold break-all">{resetEmailSent}</span>
                  </div>
                  <div className="text-[11px] text-slate-600 dark:text-slate-400 space-y-1 pt-1.5 border-t border-slate-200 dark:border-slate-800">
                    <p className="flex items-center gap-1.5 font-medium">
                      <Inbox className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> Check your <strong>Inbox</strong> and <strong>Spam / Junk</strong> folder.
                    </p>
                    <p>• Password reset links usually arrive within 1–2 minutes.</p>
                    <p>• If using strict network filters or adblockers, allow messages from Samaritan Review Center.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={() => { setMessage(null); setResetEmailSent(null); }}
              className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 hover:underline cursor-pointer"
            >
              Dismiss Notification
            </button>
          </div>
        </motion.div>
      )}

      {/* Login Form */}
      <form onSubmit={handleLogin} className="space-y-5">
        {/* Email Address */}
        <div className="space-y-1">
          <label className={labelBase}>
            <Mail size={11} className="text-teal-600 dark:text-[#00B8A9]" /> Email Address
          </label>
          <input
            type="email"
            required
            placeholder="username@gmail.com"
            value={email}
            onChange={(e) => setEmail(e.target.value.toLowerCase())}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className={inputBase}
          />
        </div>

        {/* Password */}
        <div className="space-y-1">
          <label className={labelBase}>
            <Lock size={11} className="text-teal-600 dark:text-[#00B8A9]" /> Password
          </label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputBase + " pr-11"}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#00B8A9] focus:outline-none"
            >
              {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>

        {/* Options */}
        <div className="flex items-center justify-between text-xs pt-1">
          {/* Remember Me */}
          <button
            type="button"
            onClick={() => setRememberMe(!rememberMe)}
            className="flex items-center gap-2 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 font-semibold focus:outline-none"
          >
            <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all ${rememberMe ? 'bg-teal-600 border-teal-600 dark:bg-[#00B8A9] dark:border-[#00B8A9] text-white' : 'border-slate-300 dark:border-slate-700'}`}>
              {rememberMe && <Check size={10} strokeWidth={4} />}
            </div>
            Remember Me
          </button>

          {/* Forgot Password */}
          <button
            type="button"
            onClick={handleForgotPassword}
            disabled={resetSending}
            className="text-teal-600 dark:text-[#00B8A9] hover:text-teal-700 dark:hover:text-teal-400 font-bold focus:outline-none flex items-center gap-1 cursor-pointer disabled:opacity-50"
          >
            {resetSending && <Loader2 size={12} className="animate-spin" />}
            Forgot Password?
          </button>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className={pillButton}
        >
          {loading && <Loader2 size={14} className="animate-spin" />}
          {loading ? "Authenticating..." : "LOG IN"}
        </button>
      </form>

      {/* Divider */}
      <div className="flex items-center text-slate-300 dark:text-slate-800 text-xs font-bold gap-3">
        <div className="flex-1 h-px bg-slate-100 dark:bg-slate-800" />
        <span className="uppercase text-[10px] tracking-wider font-extrabold text-slate-400 dark:text-slate-500">or</span>
        <div className="flex-1 h-px bg-slate-100 dark:bg-slate-800" />
      </div>

      {/* Google Login Button */}
      <button
        type="button"
        disabled={googleLoading}
        onClick={handleGoogleLogin}
        className={googleButton}
      >
        {googleLoading ? (
          <Loader2 size={16} className="animate-spin text-teal-600" />
        ) : (
          <GoogleIcon className="w-5 h-5 shrink-0" />
        )}
        Continue with Google
      </button>

      {/* Terms and Privacy Policy footer */}
      <div className="flex justify-center gap-4 text-[10px] text-slate-400 dark:text-slate-500 font-semibold pt-2">
        <a href="#terms" className="hover:text-slate-500 dark:hover:text-slate-300 transition-colors">Terms of Service</a>
        <span>•</span>
        <a href="#privacy" className="hover:text-slate-500 dark:hover:text-slate-300 transition-colors">Privacy Policy</a>
      </div>
    </div>
    </>
  );
}
