import type { RevieweeData } from '../types';

const STORAGE_KEY = 'samaritan_offline_reviewees';

export function getOfflineRecords(): RevieweeData[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Error reading localStorage:', e);
    return [];
  }
}

export function checkOfflineDuplicate(
  lastName: string,
  firstName: string,
  middleName: string
): RevieweeData | null {
  const records = getOfflineRecords();
  const ln = lastName.trim().toUpperCase();
  const fn = firstName.trim().toUpperCase();
  const mn = middleName.trim().toUpperCase();

  const match = records.find(
    (r) =>
      r.last_name.toUpperCase() === ln &&
      r.first_name.toUpperCase() === fn &&
      (r.middle_name || '').toUpperCase() === mn
  );

  return match || null;
}

function parseSeqNum(seqIdStr: string): number | null {
  if (!seqIdStr) return null;
  const partBeforeDash = seqIdStr.split('-')[0];
  const cleaned = partBeforeDash.toUpperCase().replace(/^SRC\s*/, '').trim();
  const digits = cleaned.replace(/\D/g, '');
  if (digits.length >= 3) {
    const numPart = digits.slice(0, -2);
    const parsed = parseInt(numPart, 10);
    if (!isNaN(parsed)) return parsed;
  }
  return null;
}

export function saveOfflineRecord(
  lastName: string,
  firstName: string,
  middleName: string,
  schoolName: string,
  pin?: string,
  skipWebhook: boolean = false
): RevieweeData {
  const records = getOfflineRecords();
  const ln = lastName.trim().toUpperCase();
  const fn = firstName.trim().toUpperCase();
  const mn = middleName.trim().toUpperCase();
  const sn = schoolName.trim().toUpperCase();

  // Check if already exists
  const existing = checkOfflineDuplicate(ln, fn, mn);
  if (existing) return existing;

  const timestamp = new Date().toISOString();
  
  // Sequence ID calculation mimicking the backend with gap-filling
  const currentYearSuffix = String(new Date().getFullYear()).slice(-2);
  const usedNumbers = new Set<number>();
  records.forEach(r => {
    const seq = r.seqId;
    if (seq) {
      const parsed = parseSeqNum(seq);
      if (parsed !== null) {
        usedNumbers.add(parsed);
      }
    }
  });

  let nextAvailableNumber = 1001;
  while (usedNumbers.has(nextAvailableNumber)) {
    nextAvailableNumber++;
  }

  const seqNum = String(nextAvailableNumber).padStart(4, '0');
  const seqId = `SRC ${seqNum}${currentYearSuffix}`;

  const newRecord: RevieweeData = {
    seqId,
    last_name: ln,
    first_name: fn,
    middle_name: mn,
    school_name: sn,
    timestamp,
    pin: pin,
  };

  records.push(newRecord);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch (e) {
    console.error('Storage quota exceeded or error saving:', e);
  }

  // Also submit to backup apps script webhook in background if possible (skipped if primary server already stored it)
  if (!skipWebhook) {
    const webhookUrl = (import.meta as any).env?.VITE_APPS_SCRIPT_WEBHOOK_URL || "https://script.google.com/macros/s/AKfycbzSNptC4NPT6W8ItbInnKohco_hd_GgwkVG7LlWJ_X3_GDq8fkExbshBJzCMPoGV9BB4Q/exec";
    if (webhookUrl && webhookUrl.startsWith('http')) {
      fetch(webhookUrl, {
        method: 'POST',
        mode: 'no-cors', // Bypasses browser CORS pre-flight blocks entirely on static hosting like Netlify
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          "timestamp": timestamp,
          "Timestamp": timestamp,
          "last_name": ln,
          "lastName": ln,
          "Last Name": ln,
          "first_name": fn,
          "firstName": fn,
          "First Name": fn,
          "middle_name": mn,
          "middleName": mn,
          "Middle Name": mn,
          "school_name": sn,
          "schoolName": sn,
          "SCHOOL NAME": sn,
          "School Name": sn,
          "seq_id": String(seqId || '').replace(/^SRC\s*/i, '').trim(),
          "seqId": String(seqId || '').replace(/^SRC\s*/i, '').trim(),
          "id_number": String(seqId || '').replace(/^SRC\s*/i, '').trim(),
          "idnumber": String(seqId || '').replace(/^SRC\s*/i, '').trim(),
          "ID Number": String(seqId || '').replace(/^SRC\s*/i, '').trim(),
          "pin": pin || '',
          "PIN": pin || '',
          "Pin": pin || '',
          "pin_code": pin || '',
          "PIN Code": pin || '',
          "PIN CODE": pin || '',
          "pinCode": pin || '',
          "pincode": pin || '',
          "Pin Code": pin || '',
          "pin code": pin || '',
          "pin_number": pin || '',
          "pinNumber": pin || '',
          "PIN Number": pin || '',
          "PIN NUMBER": pin || '',
          "pinnumber": pin || '',
          "PIN_NUMBER": pin || '',
          "pin_password": pin || '',
          "PIN Password": pin || '',
          "pinpassword": pin || '',
          "PINPASSWORD": pin || '',
          "password": pin || '',
          "Password": pin || '',
          "PASSWORD": pin || '',
          "code": pin || '',
          "Code": pin || '',
          "CODE": pin || '',
          "pass": pin || '',
          "Pass": pin || '',
          "PASS": pin || '',
          "key": pin || '',
          "Key": pin || '',
          "KEY": pin || '',
          "pin_no": pin || '',
          "pinNo": pin || '',
          "PIN No": pin || '',
          "PIN NO": pin || '',
          "pinno": pin || '',
          "PIN_CODE": pin || '',
          "PIN_No": pin || ''
        })
      }).catch(err => console.error("Apps Script webhook submission error:", err));
    }
  }

  return newRecord;
}

export function clearAllOfflineRecords() {
  localStorage.removeItem(STORAGE_KEY);
}
