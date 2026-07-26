let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

/**
 * Ascending pleasant melodic arpeggio for successful registration.
 */
export function playSuccessSound() {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    
    // Clean, crisp ascending notes: E5, G#5, B5, E6
    const notes = [659.25, 830.61, 987.77, 1318.51];
    
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);
      
      // ADSR Envelope: swift attack, gentle decay
      gainNode.gain.setValueAtTime(0, now + idx * 0.08);
      gainNode.gain.linearRampToValueAtTime(0.2, now + idx * 0.08 + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.4);
      
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 0.45);
    });
  } catch (err) {
    console.warn('Web Audio API sound playback failed:', err);
  }
}

/**
 * Gentle warning sound for duplicate record discovery.
 */
export function playDuplicateSound() {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    
    // Subtle warning: warm double chime down-swing (C#4 -> G#3)
    const notes = [277.18, 207.65];
    
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      osc.type = 'triangle'; // Warmer, mellow timber
      osc.frequency.setValueAtTime(freq, now + idx * 0.12);
      
      // Gentle entry, clean release
      gainNode.gain.setValueAtTime(0, now + idx * 0.12);
      gainNode.gain.linearRampToValueAtTime(0.08, now + idx * 0.12 + 0.03);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.35);
      
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      osc.start(now + idx * 0.12);
      osc.stop(now + idx * 0.12 + 0.4);
    });
  } catch (err) {
    console.warn('Web Audio API sound playback failed:', err);
  }
}
