import * as Tone from 'tone';

class ReunionEngine {
  private initialized: boolean = false;
  private audioTracks: Array<{ synth: Tone.NoiseSynth; volumeNode: Tone.Volume; isPlaying: boolean }> = [];
  private panners: Tone.Panner[] = [];
  private squareMappings: number[] = []; // Maps each of the 64 squares to an audio track index

  /**
   * Initializes the John Cage audio nodes. Must be called via user interaction (like a button click).
   */
  public async init(): Promise<void> {
    if (this.initialized) return;
    await Tone.start();
/*
    // 1. Initialize 16 independent synthesizer loops
    for (let i = 0; i < 16; i++) {
      const synth = new Tone.NoiseSynth({
        noise: { type: 'pink' },
        envelope: { attack: 0.1, decay: 0.5, sustain: 1, release: 0.8 }
      });
      
      const filter = new Tone.AutoFilter({ frequency: Math.random() * 2, baseFrequency: 200, octaves: 4 }).start();
      const volumeNode = new Tone.Volume(-Infinity); // Start completely muted
      
      synth.chain(filter, volumeNode);
      this.audioTracks.push({ synth, volumeNode, isPlaying: false });

      // START THE SYNTH CONTINUOUSLY IN THE BACKGROUND
      synth.triggerAttack(Tone.now()); 
    }
    */
    // Define distinct presets to give each loop its own unique character
const designPresets = [
  // 1-4: Rhythm & Percussion (Short, snappy, white/pink noise)
  { type: 'white', attack: 0.001, decay: 0.05, sustain: 0.0, release: 0.05, filterFreq: 0.1, baseFreq: 2000, octaves: 2 },
  { type: 'pink',  attack: 0.005, decay: 0.15, sustain: 0.1, release: 0.1,  filterFreq: 0.5, baseFreq: 800,  octaves: 3 },
  { type: 'white', attack: 0.01,  decay: 0.3,  sustain: 0.0, release: 0.2,  filterFreq: 1.5, baseFreq: 500,  octaves: 4 },
  { type: 'pink',  attack: 0.002, decay: 0.08, sustain: 0.0, release: 0.1,  filterFreq: 3.0, baseFreq: 4000, octaves: 1 },

  // 5-8: Sweeps & Drones (Slow attacks, heavy sustain, brown noise)
  { type: 'brown', attack: 1.5,   decay: 2.0,  sustain: 0.8, release: 2.0,  filterFreq: 0.05, baseFreq: 100, octaves: 5 },
  { type: 'brown', attack: 0.5,   decay: 1.0,  sustain: 0.6, release: 1.5,  filterFreq: 0.2,  baseFreq: 300, octaves: 3 },
  { type: 'pink',  attack: 2.0,   decay: 1.5,  sustain: 0.7, release: 2.5,  filterFreq: 0.1,  baseFreq: 150, octaves: 4 },
  { type: 'brown', attack: 3.0,   decay: 0.5,  sustain: 0.9, release: 3.0,  filterFreq: 0.02, baseFreq: 80,  octaves: 6 },

  // 9-12: Sci-Fi & Bubbling FX (Fast filter modulation, varied noise)
  { type: 'white', attack: 0.1,   decay: 0.4,  sustain: 0.3, release: 0.5,  filterFreq: 8.0,  baseFreq: 600, octaves: 5 },
  { type: 'pink',  attack: 0.05,  decay: 0.2,  sustain: 0.5, release: 0.4,  filterFreq: 12.0, baseFreq: 1200, octaves: 3 },
  { type: 'brown', attack: 0.2,   decay: 0.6,  sustain: 0.4, release: 0.6,  filterFreq: 5.5,  baseFreq: 400, octaves: 4 },
  { type: 'white', attack: 0.01,  decay: 0.1,  sustain: 0.2, release: 0.2,  filterFreq: 15.0, baseFreq: 2500, octaves: 2 },

  // 13-16: Intermediate Textures & "Wind"
  { type: 'pink',  attack: 0.8,   decay: 0.8,  sustain: 0.5, release: 1.0,  filterFreq: 0.4,  baseFreq: 1000, octaves: 3 },
  { type: 'brown', attack: 1.0,   decay: 1.2,  sustain: 0.4, release: 1.2,  filterFreq: 0.8,  baseFreq: 200,  octaves: 4 },
  { type: 'white', attack: 0.4,   decay: 0.5,  sustain: 0.6, release: 0.8,  filterFreq: 0.3,  baseFreq: 1800, octaves: 3 },
  { type: 'pink',  attack: 1.2,   decay: 2.5,  sustain: 0.3, release: 2.0,  filterFreq: 0.08, baseFreq: 500,  octaves: 5 }
];

for (let i = 0; i < 16; i++) {
  // Grab the specific configuration preset for this loop iteration
  const preset = designPresets[i];

  const synth = new Tone.NoiseSynth({
    noise: { type: preset.type },
    envelope: { 
      attack: preset.attack, 
      decay: preset.decay, 
      sustain: preset.sustain, 
      release: preset.release 
    }
  });
  
  // Use unique filter frequencies, base frequencies, and octaves based on the preset
  const filter = new Tone.AutoFilter({ 
    frequency: preset.filterFreq, 
    baseFrequency: preset.baseFreq, 
    octaves: preset.octaves 
  }).start();
  
  const volumeNode = new Tone.Volume(-Infinity); // Start completely muted
  
  synth.chain(filter, volumeNode);
  this.audioTracks.push({ synth, volumeNode, isPlaying: false });

  // START THE SYNTH CONTINUOUSLY IN THE BACKGROUND
  synth.triggerAttack(Tone.now()); 
}


    // 2. Spatial Mapping (Octophonic Simulation)
    for (let col = 0; col < 8; col++) {
      const panValue = -1 + (col * 0.285); // Left (-1) to Right (+1)
      const panner = new Tone.Panner(panValue).toDestination();
      this.panners.push(panner);
    }

    // Connect tracks to panners
    this.audioTracks.forEach((track, index) => {
      const targetPanner = this.panners[index % 8];
      track.volumeNode.connect(targetPanner);
    });

    // 3. Cage's Indeterminacy Mapping (Randomly link 64 squares to 16 tracks)
    for (let square = 0; square < 64; square++) {
      this.squareMappings.push(Math.floor(Math.random() * 16));
    }

    this.initialized = true;
    console.log("John Cage Reunion Audio Engine Initialized.");
  }

  /**
   * 👉 NEW: Stops all audio tracks and releases synths when recording stops
   */
  public stop(): void {
    if (!this.initialized) return;

    this.audioTracks.forEach(track => {
      // Mute volume immediately
      track.volumeNode.volume.setValueAtTime(-Infinity, Tone.now());
      try {
        track.synth.triggerRelease(Tone.now());
      } catch (e) {
        // Fallback if already released
      }
      track.isPlaying = false;
    });

    console.log("🛑 Reunion Audio Engine stopped.");
  }

  /**
   * Safe Diagnostic Test Sound using our new background volume strategy
   */
  public playTestSound(): void {
    if (!this.initialized) {
      console.warn("🔊 Cannot play test sound: Engine not initialized.");
      return;
    }
    
    console.log("🎵 Playing 1-second audio system diagnostic test...");
    
    const testTrack = this.audioTracks[0];
    if (testTrack) {
      testTrack.volumeNode.volume.setValueAtTime(-12, Tone.now());
      testTrack.isPlaying = true;
      
      testTrack.volumeNode.volume.setValueAtTime(-Infinity, Tone.now() + 1.0);
      testTrack.isPlaying = false;
    }
  }

  /**
   * Processes the board state safely.
   */
  public updateBoardState(board: any): void {
    if (!this.initialized) return;

    const hasChessopsGetMethod = board && board.board && typeof board.board.get === 'function';

    const trackMuteRequests = new Array(16).fill(true);
    let totalOccupied = 0;
    let totalSoundingSquares = 0;

    for (let i = 0; i < 64; i++) {
      const rank = Math.floor(i / 8) + 1; // Ranks 1 to 8
      
      let isOccupied = false;
      if (hasChessopsGetMethod) {
        isOccupied = board.board.get(i) !== undefined && board.board.get(i) !== null; 
      } else if (Array.isArray(board)) {
        const item = board[i];
        isOccupied = item !== 0 && item !== "" && item !== null && item !== undefined;
      }

      if (isOccupied) totalOccupied++;

      let squareShouldProduceSound = false;

      if (rank === 1 || rank === 2 || rank === 7 || rank === 8) {
        squareShouldProduceSound = !isOccupied; // ON when open, Silent when covered
      } else {
        squareShouldProduceSound = isOccupied;  // ON when covered, Silent when open
      }

      if (squareShouldProduceSound) {
        totalSoundingSquares++;
        const assignedTrackId = this.squareMappings[i];
        trackMuteRequests[assignedTrackId] = false; 
      }
    }

    const activeTracksCount = trackMuteRequests.filter(m => m === false).length;
    console.log(`📊 [Reunion Diagnostic] Total Occupied Squares: ${totalOccupied} | Sounding Squares: ${totalSoundingSquares} | Active Audio Tracks: ${activeTracksCount}`);

    this.audioTracks.forEach((track, id) => {
      const shouldMute = trackMuteRequests[id];

      if (shouldMute && track.isPlaying) {
        track.volumeNode.volume.rampTo(-Infinity, 0.15, Tone.now());
        track.isPlaying = false;
      } else if (!shouldMute && !track.isPlaying) {
        track.volumeNode.volume.rampTo(-16, 0.05, Tone.now()); 
        track.isPlaying = true;
      }
    });
  }
}

export const reunion = new ReunionEngine();
