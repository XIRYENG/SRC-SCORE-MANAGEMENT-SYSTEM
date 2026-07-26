import React, { useRef, useState, useEffect } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { CheckCircle2, Download, ChevronRight, User, BookOpen, Printer, CreditCard, Calendar, School, Loader2, AlertCircle } from 'lucide-react';
import { toPng } from 'html-to-image';
import confetti from 'canvas-confetti';
import { motion } from 'motion/react';
import { SyncModal } from './SyncModal';
import type { RevieweeData } from '../types';

interface SuccessPageProps {
  data: RevieweeData;
  onReset: () => void;
  onOpenSyncModal?: () => void;
  onOpenPortal?: () => void;
}

function formatRegistrationDate(timestampStr?: string): string {
  try {
    const d = timestampStr ? new Date(timestampStr) : new Date();
    if (isNaN(d.getTime())) return '';
    const day = String(d.getDate()).padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day} ${month} ${year}, ${hours}:${minutes}`;
  } catch (e) {
    return '';
  }
}

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

import { normalizeRole, isAdmin, isStaff, isAdminLike } from '../utils/roleUtils';

export function SuccessPage({ data, onReset, onOpenSyncModal, onOpenPortal }: SuccessPageProps) {
  const receiptRef = useRef<HTMLDivElement>(null);
  const badgeRef = useRef<HTMLDivElement>(null);
  const [isFlipped, setIsFlipped] = useState(false);
  const [loading, setLoading] = useState(false);

  const isAdminUser = isAdmin(data);
  const isStaffUser = isStaff(data);
  const isAdminLikeUser = isAdminLike(data);

  const displayRole = isAdminUser ? 'ADMIN' : (isStaffUser ? 'STAFF' : null);

  const resolvedUrl = resolveImageUrl('/logo.svg');
  const [imgSrc, setImgSrc] = useState(resolvedUrl);
  const [logoError, setLogoError] = useState(false);

  useEffect(() => {
    setImgSrc(resolvedUrl);
    setLogoError(false);
  }, [resolvedUrl]);

  const triggerCelebration = () => {
    confetti({
      particleCount: 80,
      spread: 75,
      origin: { y: 0.65 },
      colors: ['#10b981', '#3b82f6', '#14b8a6', '#f59e0b', '#ec4899']
    });

    confetti({
      particleCount: 20,
      angle: 60,
      spread: 45,
      origin: { x: 0.1, y: 0.8 },
      colors: ['#10b981', '#3b82f6', '#14b8a6']
    });
    confetti({
      particleCount: 20,
      angle: 120,
      spread: 45,
      origin: { x: 0.9, y: 0.8 },
      colors: ['#10b981', '#3b82f6', '#14b8a6']
    });
  };

  useEffect(() => {
    triggerCelebration();

    const timer = setTimeout(() => {
      confetti({
        particleCount: 40,
        spread: 60,
        origin: { y: 0.7 },
        colors: ['#3b82f6', '#14b8a6', '#f59e0b']
      });
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  const handleDownloadReceipt = async () => {
    if (!receiptRef.current) return;
    try {
      const url = await toPng(receiptRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: '#ffffff'
      });
      const link = document.createElement('a');
      link.download = `Receipt-${data.seqId}.png`;
      link.href = url;
      link.click();
    } catch (err) {
      console.error('Failed to generate receipt:', err);
      alert('Could not download receipt. Please take a screenshot instead.');
    }
  };

  const handleDownloadBadge = async () => {
    if (!badgeRef.current) return;
    try {
      const url = await toPng(badgeRef.current, {
        cacheBust: true,
        pixelRatio: 3, 
        backgroundColor: '#ffffff'
      });
      const link = document.createElement('a');
      link.download = `Badge-${data.seqId}.png`;
      link.href = url;
      link.click();
    } catch (err) {
      console.error('Failed to generate badge path:', err);
      alert('Could not download badge image. Please take a screenshot or print it instead.');
    }
  };

  return (
    <div className="w-full max-w-md mx-auto mb-8 mt-12 sm:mt-16 sm:px-0 px-4">
      <div className="flex justify-center mb-6 print:hidden">
        <button
          onClick={() => setIsFlipped(!isFlipped)}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-full text-xs font-bold text-slate-600 hover:text-slate-900 transition-all shadow-sm hover:shadow-md"
        >
          {isFlipped ? <BookOpen size={14} /> : <CreditCard size={14} />}
          {isFlipped ? 'Show Receipt' : 'Show ID Badge'}
        </button>
      </div>

      {!isFlipped ? (
        /* OFFICIAL RECEIPT VIEW */
        <div 
          ref={receiptRef}
          id="receipt-card"
          className="bg-white rounded-3xl shadow-xl p-8 flex flex-col relative overflow-hidden min-h-[500px]"
        >
          <div className={`absolute top-0 left-0 right-0 w-full h-2.5 z-10 ${data.exists ? 'bg-amber-500' : 'bg-emerald-500'}`} />
          {displayRole && (
            <div className={`absolute top-5 right-5 text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full shadow-sm z-20 ${displayRole === 'ADMIN' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-blue-100 text-blue-800 border border-blue-200'}`}>
              {displayRole}
            </div>
          )}
          <div className="flex justify-center mb-6">
            <div className="w-12 h-1 bg-slate-200 rounded-full"></div>
          </div>
          
          <div className="text-center flex-1 flex flex-col justify-center items-center">
            <div className="relative mb-4 flex flex-col items-center">
              <motion.a 
                href="https://samaritanreviewcenter.com/student/"
                className={`w-16 h-16 ${data.exists ? 'bg-amber-100 text-amber-600 hover:bg-amber-200' : 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200'} rounded-full flex items-center justify-center relative cursor-pointer focus:outline-none overflow-hidden block z-10`}
                animate={{ y: [0, -15, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              >
                {imgSrc && !logoError ? (
                  <img src={imgSrc} alt="Logo" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  data.exists ? <BookOpen size={32} /> : <CheckCircle2 size={32} />
                )}
              </motion.a>
              <motion.div 
                className="absolute -bottom-2 left-1/2 -ml-5 w-10 h-2 bg-slate-900/20 border-none blur-[3px] rounded-[50%] pointer-events-none" 
                animate={{ scale: [1, 0.6, 1], opacity: [0.5, 0.2, 0.5] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              />
            </div>
            <h3 
              onClick={(e) => { e.stopPropagation(); triggerCelebration(); }}
              className="text-2xl font-bold text-slate-900 cursor-pointer select-none hover:text-slate-750 active:opacity-80 flex items-center gap-1.5"
            >
              {data.exists ? 'Already Registered' : 'Success!'} 
              <span className="text-lg inline-block animate-bounce" style={{ animationDelay: '200ms' }}>🎉</span>
            </h3>
            <p className="text-slate-500 text-sm mb-6">{data.exists ? 'We found an existing record for you.' : 'Registration Confirmed'}</p>

            {data.isOffline && (
              <div className="w-full mb-6 p-3.5 bg-blue-50 border border-blue-200 rounded-2xl flex items-start gap-2.5 text-blue-900 shadow-sm text-left">
                <span className="shrink-0 text-base mt-0.5">💡</span>
                <div className="flex-1 text-[10.5px] leading-normal font-medium">
                  <strong className="font-extrabold uppercase tracking-wide block text-[9.5px] text-blue-800 mb-0.5">LOCAL BACKUP SERVICE ACTIVE</strong>
                  Your registration has been processed successfully! It is saved on this device and queued with the background integrations.
                </div>
              </div>
            )}

            <div className="w-full mb-6 flex flex-col items-center gap-4">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Your Unique ID</span>
                <span className="text-4xl font-sans tracking-wide font-black text-slate-900">{data.seqId}</span>
              </div>

              {data.pin && (
                <div className="bg-amber-50/75 rounded-2xl p-4 border border-amber-100 max-w-xs w-full text-center hover:bg-amber-100/50 transition-colors">
                  <span className="text-[9px] uppercase font-bold text-amber-700 block mb-1 tracking-wider">YOUR UNIQUE PIN PASSWORD</span>
                  <span className="text-3xl font-sans tracking-widest font-black text-amber-950 block">{data.pin}</span>
                  <p className="text-[9px] text-amber-600 mt-1.5 font-medium leading-relaxed">
                    Please remember/write down this PIN! You will need it as a password to access your receipt and ID Badge if you happen to exit this page.
                  </p>
                </div>
              )}
            </div>

            <dl className="space-y-4 text-sm w-full text-left">
              <div className="flex items-center gap-3">
                <User size={16} className="text-slate-400 shrink-0" />
                <div className="min-w-0 flex-1">
                  <dt className="text-[10px] font-bold uppercase text-slate-500">Last Name</dt>
                  <dd className="font-medium text-slate-900 truncate">{data.last_name}</dd>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <User size={16} className="text-slate-400 shrink-0" />
                <div className="min-w-0 flex-1">
                  <dt className="text-[10px] font-bold uppercase text-slate-500">First Name</dt>
                  <dd className="font-medium text-slate-900 truncate">{data.first_name}</dd>
                </div>
              </div>

              {data.middle_name && (
                <div className="flex items-center gap-3">
                  <User size={16} className="text-slate-400 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <dt className="text-[10px] font-bold uppercase text-slate-500">Middle Name</dt>
                    <dd className="font-medium text-slate-900 truncate">{data.middle_name}</dd>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3">
                <School size={16} className="text-slate-400 shrink-0" />
                <div className="min-w-0 flex-1">
                  <dt className="text-[10px] font-bold uppercase text-slate-500">School Name</dt>
                  <dd className={`font-medium text-slate-900 ${data.school_name.length > 25 ? 'text-xs' : 'text-sm'} break-words leading-tight`}>{data.school_name}</dd>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Calendar size={16} className="text-slate-400 shrink-0" />
                <div className="min-w-0 flex-1">
                  <dt className="text-[10px] font-bold uppercase text-slate-500">Registration Date</dt>
                  <dd className="font-medium text-slate-900 truncate">{formatRegistrationDate(data.timestamp)}</dd>
                </div>
              </div>
            </dl>
          </div>
        </div>
      ) : (
        /* OFFICIAL ID BADGE VIEW */
        <div 
            ref={badgeRef}
            className="bg-white rounded-3xl shadow-xl p-8 flex flex-col items-center text-center select-none min-h-[500px] relative overflow-hidden"
        >
            <div className="absolute top-0 left-0 right-0 w-full h-2.5 bg-gradient-to-r from-orange-400 to-amber-500 z-10" />
            
            {displayRole && (
              <div className={`absolute top-5 right-5 text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full shadow-sm z-20 ${displayRole === 'ADMIN' ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-blue-100 text-blue-800 border border-blue-200'}`}>
                {displayRole}
              </div>
            )}

            <div className="flex-1 flex flex-col justify-center items-center w-full text-center mt-3">
                <div className="relative mb-4 flex flex-col items-center">
                  <motion.a 
                    href="https://samaritanreviewcenter.com/student/" 
                    className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center p-0 overflow-hidden relative cursor-pointer block z-10 transition-transform hover:shadow-lg"
                    animate={{ y: [0, -15, 0] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  >
                    {imgSrc && !logoError ? (
                        <img src={imgSrc} alt="Logo" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : <BookOpen size={40} className="text-slate-400" />}
                  </motion.a>
                  <motion.div 
                    className="absolute -bottom-2.5 left-1/2 -ml-7 w-14 h-3 bg-slate-900/20 border-none blur-[4px] rounded-[50%] pointer-events-none" 
                    animate={{ scale: [1, 0.6, 1], opacity: [0.5, 0.2, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  />
                </div>
                
            <h2 className="text-lg font-bold text-slate-900 uppercase tracking-wide">SAMARITAN REVIEW CENTER</h2>

                <div className="w-full space-y-2 mb-8">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => onOpenPortal && onOpenPortal()}
                    className="w-full cursor-pointer hover:bg-slate-800 bg-slate-900 text-white py-2.5 px-3 rounded-lg font-black text-xs uppercase tracking-widest shadow-sm transition-colors flex items-center justify-center gap-2"
                  >
                    {isAdminUser ? 'Open Admin Portal' : isStaffUser ? 'Open Staff Portal' : 'Open Reviewee Portal'}
                  </motion.button>

                  {isAdminLikeUser && (
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => onOpenSyncModal && onOpenSyncModal()}
                      className="w-full cursor-pointer hover:bg-teal-700 bg-teal-600 text-white py-2 px-3 rounded-lg font-black text-[10px] uppercase tracking-widest shadow-sm transition-colors flex items-center justify-center gap-2"
                    >
                      Sync & Settings
                    </motion.button>
                  )}
                </div>
                
                <div className="flex-1 flex flex-col justify-center gap-2 w-full text-center mb-8">
                    <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Reviewee Name</p>
                    <p className="text-xl font-extrabold uppercase text-slate-900">{data.last_name}</p>
                    <p className="text-lg font-bold uppercase text-slate-700">
                      {data.first_name} {data.middle_name ? `${data.middle_name.charAt(0)}.` : ''}
                    </p>
                    <div className="mt-4 border-t border-slate-100 pt-4">
                      <p className="text-[9px] font-bold uppercase text-slate-400 tracking-wider mb-1">INSTITUTION</p>
                      <p className={`font-extrabold uppercase text-slate-900 truncate ${data.school_name.length > 25 ? 'text-xs' : 'text-sm'}`}>
                        {data.school_name}
                      </p>
                    </div>
                </div>
                
                <div className="border-t border-slate-100 pt-4 w-full">
                    <div className="mb-2 flex justify-center">
                      <QRCodeCanvas
                        value={`SAMARITAN REVIEW CENTER\n${data.seqId}\n${data.first_name} ${data.middle_name ? data.middle_name[0] + '. ' : ''}${data.last_name}\n${data.school_name}`}
                        size={100}
                        level="H"
                      />
                    </div>
                    <p className="text-[9px] font-bold uppercase text-slate-400 tracking-wider mb-1">STUDENT ID</p>
                    <div className="text-2xl font-black text-slate-900 tracking-wider bg-slate-100 py-1.5 rounded-lg mb-2">{data.seqId}</div>
                    <p className="text-[9px] font-bold uppercase text-slate-400 tracking-wider">REGISTERED ON {new Date(data.timestamp).toLocaleDateString()}</p>
                </div>
            </div>
        </div>
      )}

      {/* Action buttons (Download & Return) */}

      <div className="mt-6 space-y-3 px-2 print:hidden">
        <button
          onClick={isFlipped ? handleDownloadBadge : handleDownloadReceipt}
          className="w-full border border-slate-300 py-3 rounded-xl font-bold text-sm bg-white text-slate-900 hover:bg-slate-50 transition-colors active:scale-[0.98] flex justify-center items-center cursor-pointer"
        >
          <Download size={16} className="mr-2" />
          Download {isFlipped ? 'ID Badge' : 'Receipt'}
        </button>
        
        <button
          onClick={onReset}
          className="w-full bg-slate-100 text-slate-600 py-3 rounded-xl font-bold text-sm hover:bg-slate-200 transition-colors flex justify-center items-center cursor-pointer"
        >
          Return to Home
          <ChevronRight size={16} className="ml-1 opacity-50" />
        </button>
      </div>
    </div>
  );
}
