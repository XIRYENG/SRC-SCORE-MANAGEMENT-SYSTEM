import React from 'react';
import { Scanner } from '@yudiel/react-qr-scanner';
import { ChevronLeft } from 'lucide-react';

interface ScannerPageProps {
  onScan: (result: string) => void;
  onBack: () => void;
}

export function ScannerPage({ onScan, onBack }: ScannerPageProps) {
  return (
    <div className="w-full max-w-md mx-auto bg-white rounded-3xl shadow-xl border border-slate-200 p-6 sm:p-8 flex flex-col items-center relative overflow-hidden mb-8 mt-12 sm:mt-16">
      <div className="absolute top-0 left-0 w-full h-1 bg-blue-600"></div>

      <div className="flex justify-center mb-6">
        <div className="w-12 h-1 bg-slate-200 rounded-full"></div>
      </div>

      <div className="w-full mb-6 text-center">
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">Scan QR Code</h2>
        <p className="text-sm text-slate-500 mt-2">Position the venue QR code within the frame.</p>
      </div>

      <div className="w-full aspect-square bg-slate-900 rounded-2xl overflow-hidden mb-8 relative flex items-center justify-center border-4 border-slate-900">
        <Scanner
          onScan={(result) => {
            if (result && result.length > 0) {
              // We extract the decoded text from the first barcode found
              onScan(result[0].rawValue);
            }
          }}
          formats={['qr_code']}
          components={{ audio: false, finder: true } as any}
        />
      </div>

      <button
        onClick={onBack}
        className="w-full bg-slate-100 text-slate-600 py-3.5 rounded-xl font-bold text-sm hover:bg-slate-200 transition-colors flex justify-center items-center active:scale-[0.98]"
      >
        <ChevronLeft size={16} className="mr-1" />
        Cancel Scanning
      </button>
    </div>
  );
}
