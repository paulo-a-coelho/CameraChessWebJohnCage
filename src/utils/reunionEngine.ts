import * as Tone from 'tone';

interface TrackState {
  synth: Tone.NoiseSynth;
  filter: Tone.AutoFilter;
  volumeNode: Tone.Volume;
  isPlaying: boolean;
}

export class ReunionEngine {
  private initialized: boolean = false;
  private audioTracks: TrackState[] = [];
  private panners: Tone.Panner[] = [];
  private squareMappings: number[] = []; // Maps each of the 64 squares to an audio track index
  
  // Debouncing / Stability tracking for hands & transient shadows
  private rawSquareStates: boolean[] = new Array(64).fill(false);
  private stableSquareStates: boolean[] = new Array(64).fill(false);
  private stateCounters: number[] = new Array(64).fill(0);
  private readonly STABILITY_THRESHOLD = 3; // Number of consecutive consistent updates required to register a change

  /**
   * Initializes the John Cage audio nodes. Must be called via user interaction.
   */
  public async init(): Promise<void> {
    if (this.initialized) return;
    await Tone.start();

    // 1. Initialize 16 independent synthesizer loops with rich modulations
    for (let i = 0; i < 16; i++) {
      const noiseTypes: Array<'white' | 'pink' | 'brown'> = ['pink', 'brown', 'white'];
      const chosenNoise = noiseTypes[Math.floor(Math.random() * noiseTypes.length)];

      const synth = new Tone.NoiseSynth({
        noise: { type: chosenNoise },
        envelope: { attack: 0.2, decay: 0.6, sustain: 1, release: 1.0 }
      });
      
      const filter = new Tone.AutoFilter({
        frequency: 0.5 + Math.random() * 3,
        baseFrequency: 100 + Math.random() * 300,
        octaves: 3 + Math.random() * 2
      }).start();

      const volumeNode = new Tone.Volume(-Infinity); // Start completely muted
      
      synth.chain(filter, volumeNode);
      this.audioTracks.push({ synth, filter, volumeNode, isPlaying: false });

      // Start the synth continuously in the background
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
    console.log("John Cage Reunion Audio Engine Initialized with Dynamic Timbral Modulation & Hand Filtering.");
  }

  /**
   * Diagnostic Test Sound
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
   * Processes the board state with debouncing (to filter out hands/transients) 
   * and dynamic sound evolution.
   */
  public updateBoardState(board: any): void {
    if (!this.initialized) return;

    const hasChessopsGetMethod = board && board.board && typeof board.board.get === 'function';
    let totalOccupied = 0;
    let totalSoundingSquares = 0;

    // Step 1: Evaluate raw occupancy and apply temporal debouncing (filters out hands & fast shadows)
    for (let i = 0; i < 64; i++) {
      let isOccupied = false;
      if (hasChessopsGetMethod) {
        isOccupied = board.board.get(i) !== undefined && board.board.get(i) !== null; 
      } else if (Array.isArray(board)) {
        const item = board[i];
        isOccupied = item !== 0 && item !== "" && item !== null && item !== undefined;
      }

      // Debounce logic: check if raw state matches current stable state
      if (isOccupied === this.rawSquareStates[i]) {
        this.stateCounters[i]++;
        if (this.stateCounters[i] >= this.STABILITY_THRESHOLD) {
          this.stableSquareStates[i] = isOccupied;
        }
      } else {
        this.rawSquareStates[i] = isOccupied;
        this.stateCounters[i] = 1; // Reset counter for new state candidate
      }

      if (this.stableSquareStates[i]) totalOccupied++;
    }

    // Step 2: Calculate track requirements using John Cage's inversion logic
    const trackMuteRequests = new Array(16).fill(true);

    for (let i = 0; i < 64; i++) {
      const rank = Math.floor(i / 8) + 1; // Ranks 1 to 8
      const isStableOccupied = this.stableSquareStates[i];

      let squareShouldProduceSound = false;
      if (rank === 1 || rank === 2 || rank === 7 || rank === 8) {
        squareShouldProduceSound = !isStableOccupied; // ON when open, Silent when covered
      } else {
        squareShouldProduceSound = isStableOccupied;  // ON when covered, Silent when open
      }

      if (squareShouldProduceSound) {
        totalSoundingSquares++;
        const assignedTrackId = this.squareMappings[i];
        trackMuteRequests[assignedTrackId] = false; 
      }
    }

    console.log(`📊 [Reunion Diagnostic] Stable Occupied: ${totalOccupied} | Sounding Squares: ${totalSoundingSquares}`);

    // Step 3: Apply volume changes and dynamic timbral evolution
    this.audioTracks.forEach((track, id) => {
      const shouldMute = trackMuteRequests[id];

      if (shouldMute && track.isPlaying) {
        track.volumeNode.volume.rampTo(-Infinity, 0.2, Tone.now());
        track.isPlaying = false;
      } else if (!shouldMute && !track.isPlaying) {
        // Dynamic Timbral Variation: Shift filter characteristics when activated
        const randomBaseFreq = 150 + Math.random() * 600;
        const randomFilterFreq = 1 + Math.random() * 5;
        track.filter.baseFrequency = randomBaseFreq;
        track.filter.frequency.setValueAtTime(randomFilterFreq, Tone.now());

        // Bring up volume smoothly
        track.volumeNode.volume.rampTo(-16, 0.1, Tone.now()); 
        track.isPlaying = true;
      } else if (!shouldMute && track.isPlaying) {
        // Continually evolve sound slightly even while sustained if board state shifts
        if (Math.random() < 0.3) {
          track.filter.baseFrequency = 120 + Math.random() * 500;
        }
      }
    });
  }
}

export const reunion = new ReunionEngine();
