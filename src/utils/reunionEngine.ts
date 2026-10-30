import * as Tone from 'tone';

class ReunionEngine {
  private initialized = false;
  private audioTracks: Array<{
    synth: Tone.NoiseSynth;
    filter: Tone.AutoFilter;
    volumeNode: Tone.Volume;
    isPlaying: boolean;
  }> = [];
  private panners: Tone.Panner[] = [];
  private squareMappings: number[] = [];

  // Debounce / stability
  private lastStableMask: boolean[] = new Array(64).fill(false);
  private pendingMask: boolean[] | null = null;
  private stableSince = 0;
  private readonly STABILITY_MS = 600; // only commit after board is quiet this long

  // Current track mute state (true = muted)
  private trackMuted = new Array(16).fill(true);

  public async init(): Promise<void> {
    if (this.initialized) return;
    await Tone.start();

    // 16 continuous pink-noise sources
    for (let i = 0; i < 16; i++) {
      const synth = new Tone.NoiseSynth({
        noise: { type: 'pink' },
        envelope: { attack: 0.05, decay: 0.3, sustain: 1, release: 0.6 },
      });

      const filter = new Tone.AutoFilter({
        frequency: 0.3 + Math.random() * 1.5,
        baseFrequency: 180 + Math.random() * 120,
        octaves: 3.5,
        type: 'sine',
      }).start();

      const volumeNode = new Tone.Volume(-Infinity);
      synth.chain(filter, volumeNode);

      this.audioTracks.push({ synth, filter, volumeNode, isPlaying: false });
      synth.triggerAttack(Tone.now()); // keep running forever
    }

    // Simple 8-channel spatial simulation
    for (let col = 0; col < 8; col++) {
      const pan = -1 + (col / 7) * 2;
      this.panners.push(new Tone.Panner(pan).toDestination());
    }

    this.audioTracks.forEach((track, i) => {
      track.volumeNode.connect(this.panners[i % 8]);
    });

    // Random mapping of 64 squares → 16 tracks (Cage indeterminacy)
    for (let s = 0; s < 64; s++) {
      this.squareMappings.push(Math.floor(Math.random() * 16));
    }

    this.initialized = true;
    console.log('Reunion engine ready (debounced + change-emphasized)');
  }

  /** Call this every frame / every vision update */
  public updateBoardState(board: any): void {
    if (!this.initialized) return;

    const occupancy = this.extractOccupancy(board);
    const now = performance.now();

    // Detect whether the raw occupancy changed
    const changed =
      this.pendingMask === null ||
      occupancy.some((v, i) => v !== this.pendingMask![i]);

    if (changed) {
      this.pendingMask = occupancy.slice();
      this.stableSince = now;
      return; // still moving / hands present → ignore
    }

    // Board has been identical long enough → commit
    if (now - this.stableSince < this.STABILITY_MS) return;

    // Compare against last *stable* mask
    const reallyChanged = occupancy.some(
      (v, i) => v !== this.lastStableMask[i]
    );
    if (!reallyChanged) return;

    this.lastStableMask = occupancy.slice();
    this.applyStableState(occupancy);
  }

  private extractOccupancy(board: any): boolean[] {
    const occ = new Array(64).fill(false);
    const hasChessops =
      board?.board && typeof board.board.get === 'function';

    for (let i = 0; i < 64; i++) {
      if (hasChessops) {
        const p = board.board.get(i);
        occ[i] = p !== undefined && p !== null;
      } else if (Array.isArray(board)) {
        const item = board[i];
        occ[i] =
          item !== 0 &&
          item !== '' &&
          item !== null &&
          item !== undefined;
      }
    }
    return occ;
  }

  private applyStableState(occupancy: boolean[]): void {
    // Which of the 16 tracks should be sounding?
    const shouldSound = new Array(16).fill(false);
    let soundingSquares = 0;

    for (let i = 0; i < 64; i++) {
      const rank = Math.floor(i / 8) + 1; // 1–8
      const isOccupied = occupancy[i];

      // Exact Cage/Cross inversion logic
      const squareSounds =
        rank === 1 || rank === 2 || rank === 7 || rank === 8
          ? !isOccupied
          : isOccupied;

      if (squareSounds) {
        soundingSquares++;
        shouldSound[this.squareMappings[i]] = true;
      }
    }

    // Apply track changes with emphasis
    this.audioTracks.forEach((track, id) => {
      const wantOn = shouldSound[id];
      const isOn = !this.trackMuted[id];

      if (wantOn === isOn) return; // no change

      this.trackMuted[id] = !wantOn;

      if (wantOn) {
        // Turning ON → short bright attack so the change is audible
        track.volumeNode.volume.cancelScheduledValues(Tone.now());
        track.volumeNode.volume.setValueAtTime(-28, Tone.now());
        track.volumeNode.volume.rampTo(-12, 0.08); // quick rise
        track.volumeNode.volume.rampTo(-18, 0.35); // settle a bit quieter

        // briefly open the filter for a “click / brighten”
        track.filter.baseFrequency.rampTo(420, 0.05);
        track.filter.baseFrequency.rampTo(220, 0.4);

        track.isPlaying = true;
      } else {
        // Turning OFF → smooth but decisive fade
        track.volumeNode.volume.cancelScheduledValues(Tone.now());
        track.volumeNode.volume.rampTo(-Infinity, 0.4);
        track.isPlaying = false;
      }
    });

    console.log(
      `Reunion stable update → sounding squares: ${soundingSquares}`
    );
  }

  /** Optional: force an immediate update (e.g. after a confirmed move from your chess engine) */
  public forceUpdate(board: any): void {
    if (!this.initialized) return;
    const occupancy = this.extractOccupancy(board);
    this.lastStableMask = occupancy.slice();
    this.pendingMask = occupancy.slice();
    this.stableSince = performance.now() - this.STABILITY_MS - 10;
    this.applyStableState(occupancy);
  }

  public playTestSound(): void {
    if (!this.initialized) return;
    const t = this.audioTracks[0];
    t.volumeNode.volume.cancelScheduledValues(Tone.now());
    t.volumeNode.volume.setValueAtTime(-12, Tone.now());
    t.volumeNode.volume.setValueAtTime(-Infinity, Tone.now() + 1.2);
  }
}

export const reunion = new ReunionEngine();
