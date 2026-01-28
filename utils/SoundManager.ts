export class SoundManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicTimeout: any = null;
  private isMusicPlaying = false;
  private noteIndex = 0;

  constructor() {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioContextClass();
      this.masterGain = this.ctx.createGain();
      this.masterGain.connect(this.ctx.destination);
      this.masterGain.gain.value = 0.25; // Master volume
    } catch (e) {
      console.error("Web Audio API not supported");
    }
  }

  resume = async () => {
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
    if (!this.isMusicPlaying) {
      this.start8BitMusic();
      this.isMusicPlaying = true;
    }
  };

  // --- 8-Bit Music Sequencer ---
  private start8BitMusic() {
    if (!this.ctx || !this.masterGain) return;

    // Cheerful 8-bit Melody (C Majorish)
    // Format: [Frequency, Duration(16th notes)]
    // 0 freq means rest
    const tempo = 140;
    const s = 60 / tempo / 4; // 16th note duration in seconds

    const C4 = 261.63, D4 = 293.66, E4 = 329.63, F4 = 349.23, G4 = 392.00, A4 = 440.00, B4 = 493.88, C5 = 523.25;
    
    const melody = [
      // Bar 1
      { f: E4, d: 2 }, { f: E4, d: 2 }, { f: 0, d: 2 }, { f: E4, d: 2 },
      { f: 0, d: 2 }, { f: C4, d: 2 }, { f: E4, d: 2 }, { f: 0, d: 2 },
      // Bar 2
      { f: G4, d: 4 }, { f: 0, d: 4 }, 
      { f: G4 / 2, d: 4 }, { f: 0, d: 4 },
      // Bar 3
      { f: C5, d: 2 }, { f: 0, d: 1 }, { f: G4, d: 2 }, { f: 0, d: 1 },
      { f: E4, d: 2 }, { f: 0, d: 1 }, { f: A4, d: 2 }, { f: 0, d: 1 },
      // Bar 4
      { f: B4, d: 2 }, { f: 0, d: 1 }, { f: A4, d: 2 }, { f: G4, d: 2 },
      { f: E4, d: 2 }, { f: G4, d: 2 }, { f: A4, d: 4 },
    ];

    const playStep = () => {
      if (!this.isMusicPlaying || !this.ctx || !this.masterGain) return;
      
      const note = melody[this.noteIndex % melody.length];
      const duration = note.d * s;

      if (note.f > 0) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = 'square'; // Classic NES sound
        osc.frequency.value = note.f;

        osc.connect(gain);
        gain.connect(this.masterGain!);

        const now = this.ctx.currentTime;
        
        // Staccato envelope
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + duration * 0.9);

        osc.start(now);
        osc.stop(now + duration);
      }

      this.noteIndex++;
      this.musicTimeout = setTimeout(playStep, duration * 1000);
    };

    playStep();
  }

  // --- SFX: Coin / Score ---
  playCatch() {
    if (!this.ctx || !this.masterGain) return;
    
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    // High pitched square wave "Bling"
    osc.type = 'square';
    osc.frequency.setValueAtTime(900, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(1200, this.ctx.currentTime + 0.1);
    
    gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.1);
    
    osc.connect(gain);
    gain.connect(this.masterGain);
    
    osc.start();
    osc.stop(this.ctx.currentTime + 0.1);
  }

  // --- SFX: Meow (Synthesized) ---
  playMeow() {
    if (!this.ctx || !this.masterGain) return;
    const t = this.ctx.currentTime;
    
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'triangle'; 
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    // Pitch: Rising then falling slightly (M-e-ow)
    osc.frequency.setValueAtTime(400, t);
    osc.frequency.linearRampToValueAtTime(800, t + 0.1); 
    osc.frequency.linearRampToValueAtTime(350, t + 0.5); 

    // Vowel shape (Formant filter simulation)
    filter.type = 'bandpass';
    filter.Q.value = 1;
    filter.frequency.setValueAtTime(800, t);
    filter.frequency.linearRampToValueAtTime(1400, t + 0.15);
    filter.frequency.linearRampToValueAtTime(600, t + 0.5);

    // Volume envelope
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.3, t + 0.1);
    gain.gain.linearRampToValueAtTime(0, t + 0.5);

    osc.start(t);
    osc.stop(t + 0.6);
  }

  // --- SFX: Round Clear / Medal (Fanfare, keep music) ---
  playMedal() {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    
    // Short Fanfare
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C E G C
    notes.forEach((freq, i) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'square';
      osc.frequency.value = freq;
      
      const t = now + i * 0.1;
      osc.connect(gain);
      gain.connect(this.masterGain!);
      
      gain.gain.setValueAtTime(0.1, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
      
      osc.start(t);
      osc.stop(t + 0.2);
    });
  }

  // --- SFX: Win / Game Over (Stop music) ---
  playGameWin() {
    if (!this.ctx || !this.masterGain) return;
    
    this.isMusicPlaying = false; // Stop BGM loop
    if (this.musicTimeout) clearTimeout(this.musicTimeout);

    const now = this.ctx.currentTime;
    
    // Classic Arpeggio Fanfare
    const notes = [
      523.25, 659.25, 783.99, 1046.50, 783.99, 1046.50 // C E G C G C
    ];

    notes.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'square';
      osc.frequency.value = freq;
      
      const t = now + i * 0.12;
      osc.connect(gain);
      gain.connect(this.masterGain!);
      
      gain.gain.setValueAtTime(0.1, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
      
      osc.start(t);
      osc.stop(t + 0.1);
    });

    // Final long chord
    setTimeout(() => {
        if (!this.ctx || !this.masterGain) return;
        const finalNotes = [523.25, 659.25, 783.99, 1046.50];
        finalNotes.forEach(f => {
            const o = this.ctx!.createOscillator();
            const g = this.ctx!.createGain();
            o.type = 'triangle';
            o.frequency.value = f;
            o.connect(g);
            g.connect(this.masterGain!);
            const t = this.ctx!.currentTime;
            g.gain.setValueAtTime(0, t);
            g.gain.linearRampToValueAtTime(0.1, t + 0.1);
            g.gain.linearRampToValueAtTime(0, t + 2);
            o.start(t);
            o.stop(t + 2);
        })
    }, notes.length * 120);
  }
}

export const soundManager = new SoundManager();