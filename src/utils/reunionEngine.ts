import * as Tone from 'tone';

class ReunionEngine {
  private initialized: boolean = false;
  private audioTracks: Array<{ synth: Tone.NoiseSynth; filter: Tone.AutoFilter; volumeNode: Tone.Volume; isPlaying: boolean }> = [];
  private panners: Tone.Panner[] = [];
  private squareMappings: number[] = []; // Maps each of the 64 squares to an audio track index
  
  // Hand-filtering / debouncing state
  private lastBoardState: any[] = new Array(64).fill(null);
  private pendingBoardState: any[] = new Array(64).fill(null);
  private debounceTimer: any = null;
  private readonly DEBOUNCE_DELAY_MS = 250; // Ignore rapid hand movements faster than 250ms

  /**
   * Initializes the John Cage audio nodes. Must be called via user interaction (like a button click).
   */
  public async init(): Promise<void> {
    if (this.initialized) return;
    await Tone.start();

    const noiseTypes: ('pink' | 'white' | 'brown')[] = ['pink', 'white', 'brown', 'pink'];

    // 1. Initialize 16 independent synthesizer loops with diverse timbres
    for (let i = 0; i < 16; i++) {
      const noiseType = noiseTypes[i % noiseTypes.length];
      const synth = new Tone.NoiseSynth({
        noise: { type: noiseType },
        envelope: { attack: 0.2, decay: 0.6, sustain: 0.9, release: 1.0 }
      });
      
      // Dynamic filter with variable base frequency for rich timbral variance
      const filter = new Tone.AutoFilter({
        frequency: 0.5 + Math.random() * 3,
        baseFrequency: 150 + Math.random() * 600,
        octaves: 3 + Math.random() * 3
      }).start();

      const volumeNode = new Tone.Volume(-Infinity); // Start completely muted
      
      synth.chain(filter, volumeNode);
      this.audioTracks.push({ synth, filter, volumeNode, isPlaying: false });

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
    console.log("John Cage Reunion Audio Engine Initialized with Dynamic Timbral Modulation.");
  }

  /**
   * Safe Diagnostic Test Sound
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
   * Public entrypoint: buffers board state updates to ignore transient hand movements.
   */
  public updateBoardState(board: any): void {
    if (!this.initialized) return;

    // Clear previous pending timeout so rapid hand motions don't trigger intermediate sounds
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    // Debounce: Wait until the board state remains steady (ignoring temporary hand reach-overs)
    this.debounceTimer = setTimeout(() => {
      this.processStableBoard(board);
    }, this.DEBOUNCE_DELAY_MS);
  }

  /**
   * Processes the stable board state and modulates sound parameters.
   */
  private processStableBoard(board: any): void {
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

      // John Cage's exact inversion logic:
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

    console.log(`📊 [Reunion Audit] Stable State — Occupied: ${totalOccupied} | Sounding: ${totalSoundingSquares}`);

    // Apply state changes with dynamic timbral shifting ("change more")
    this.audioTracks.forEach((track, id) => {
      const shouldMute = trackMuteRequests[id];

      if (shouldMute && track.isPlaying) {
        track.volumeNode.volume.rampTo(-Infinity, 0.2, Tone.now());
        track.isPlaying = false;
      } else if (!shouldMute && !track.isPlaying) {
        // Dynamically shift filter parameters whenever a track activates for varied sound character
        const newBaseFreq = 100 + Math.random() * 800;
        track.filter.baseFrequency.rampTo(newBaseFreq, 0.1);

        track.volumeNode.volume.rampTo(-14, 0.1, Tone.now()); 
        track.isPlaying = true;
      } else if (!shouldMute && track.isPlaying) {
        // If track is already playing, subtly morph its timbre further on piece changes
        const morphedFreq = 150 + Math.random() * 700;
        track.filter.baseFrequency.rampTo(morphedFreq, 0.4);
      }
    });
  }
}

export const reunion = new ReunionEngine();
