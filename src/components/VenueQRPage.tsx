import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { ChevronLeft, Printer } from 'lucide-react';

interface VenueQRPageProps {
  onBack: () => void;
}

export function VenueQRPage({ onBack }: VenueQRPageProps) {
  // Use the window location as the URL, defaulting to the shared app URL if accessible
  const appUrl = typeof window !== 'undefined' ? window.location.origin : 'https://ais-pre-4bqaxmuiuuu2wnxxh27u5j-44815475787.asia-east1.run.app';

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="w-full max-w-md mx-auto bg-white rounded-3xl shadow-xl border border-slate-200 p-8 flex flex-col items-center relative overflow-hidden mb-8 mt-12 sm:mt-16 print:shadow-none print:border-none print:mt-0 print:p-0">
      <div className="absolute top-0 left-0 w-full h-1 bg-slate-900 print:hidden"></div>
      
      <div className="w-full mb-8 text-center print:mb-4">
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">Venue QR Code</h2>
        <p className="text-sm text-slate-500 mt-2">Print and display this at the entrance.</p>
      </div>

      <div className="bg-white p-6 border-4 border-slate-900 rounded-3xl mb-8">
        <QRCodeSVG 
          value={appUrl} 
          size={250}
          level="H"
          className="w-full h-auto"
        />
      </div>

      <div className="text-center mb-10 print:mb-0">
        <p className="text-sm font-bold text-slate-900 mb-1">Scan to Register</p>
        <p className="text-xs text-slate-500 font-mono break-all">{appUrl}</p>
      </div>

      <div className="w-full space-y-3 print:hidden">
        <button
          onClick={handlePrint}
          className="w-full border border-slate-300 py-3 rounded-xl font-bold text-sm bg-slate-900 text-white hover:bg-slate-800 transition-colors active:scale-[0.98] flex justify-center items-center"
        >
          <Printer size={16} className="mr-2" />
          Print QR Code
        </button>
        
        <button
          onClick={onBack}
          className="w-full bg-slate-100 text-slate-600 py-3 rounded-xl font-bold text-sm hover:bg-slate-200 transition-colors flex justify-center items-center"
        >
          <ChevronLeft size={16} className="mr-1" />
          Back to Registration
        </button>
      </div>
    </div>
  );
}
