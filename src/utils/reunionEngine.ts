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
      // Bring up the volume node using Tone's safe ramping timelines
      testTrack.volumeNode.volume.setValueAtTime(-12, Tone.now());
      testTrack.isPlaying = true;
      
      // Automatically fade it back out to silent after 1 second
      testTrack.volumeNode.volume.setValueAtTime(-Infinity, Tone.now() + 1.0);
      testTrack.isPlaying = false;
    }
  }
  /**
   * Processes the board state safely.
   */
  public updateBoardState(board: any): void {
    if (!this.initialized) return;

    // 1. Check if the object has Chessops' native get() method on its board sub-property
    const hasChessopsGetMethod = board && board.board && typeof board.board.get === 'function';

    const trackMuteRequests = new Array(16).fill(true);
    let totalOccupied = 0;
    let totalSoundingSquares = 0;

    for (let i = 0; i < 64; i++) {
      const rank = Math.floor(i / 8) + 1; // Ranks 1 to 8
      
      // 2. Query Chessops directly using its formal native .get() selector method
      let isOccupied = false;
      if (hasChessopsGetMethod) {
        isOccupied = board.board.get(i) !== undefined && board.board.get(i) !== null; 
      } else if (Array.isArray(board)) {
        const item = board[i];
        isOccupied = item !== 0 && item !== "" && item !== null && item !== undefined;
      }

      if (isOccupied) totalOccupied++;

      let squareShouldProduceSound = false;

      // 3. John Cage's exact inversion logic:
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

    // Print active tracker audit
    const activeTracksCount = trackMuteRequests.filter(m => m === false).length;
    console.log(`📊 [Reunion Diagnostic] Total Occupied Squares: ${totalOccupied} | Sounding Squares: ${totalSoundingSquares} | Active Audio Tracks: ${activeTracksCount}`);

    // Apply the states purely with volume adjustments inside updateBoardState
    this.audioTracks.forEach((track, id) => {
      const shouldMute = trackMuteRequests[id];

      if (shouldMute && track.isPlaying) {
        track.volumeNode.volume.rampTo(-Infinity, 0.15, Tone.now());
        track.isPlaying = false;
      } else if (!shouldMute && !track.isPlaying) {
        // Safe mixed volume floor level
        track.volumeNode.volume.rampTo(-16, 0.05, Tone.now()); 
        track.isPlaying = true;
      }
    });
  }

}

export const reunion = new ReunionEngine();
