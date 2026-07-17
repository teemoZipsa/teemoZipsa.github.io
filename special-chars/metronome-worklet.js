class PrecisionMetronomeProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bpm = 120;
    this.volume = 0.8;
    this.beatsPerBar = 4;
    this.beat = 0;
    this.running = false;
    this.nextBeatFrame = 0;
    this.clickFrames = Math.max(1, Math.floor(sampleRate * 0.055));
    this.clickSamplesLeft = 0;
    this.phase = 0;
    this.frequency = 1000;
    this.port.onmessage = event => this.handleMessage(event.data || {});
  }

  handleMessage(message) {
    if (message.type === 'config') {
      if (Number.isFinite(message.bpm)) this.bpm = Math.max(20, Math.min(300, message.bpm));
      if (Number.isFinite(message.volume)) this.volume = Math.max(0, Math.min(1, message.volume));
      if (Number.isFinite(message.beatsPerBar)) this.beatsPerBar = Math.max(1, Math.min(12, Math.round(message.beatsPerBar)));
      if (message.resetBeat) this.beat = 0;
    } else if (message.type === 'start') {
      this.beat = 0;
      this.nextBeatFrame = currentFrame;
      this.running = true;
    } else if (message.type === 'stop') {
      this.running = false;
      this.clickSamplesLeft = 0;
    }
  }

  process(_inputs, outputs) {
    const channel = outputs[0] && outputs[0][0];
    if (!channel) return true;
    channel.fill(0);
    if (!this.running) return true;

    const framesPerBeat = sampleRate * 60 / this.bpm;
    for (let i = 0; i < channel.length; i += 1) {
      const frame = currentFrame + i;
      if (frame >= this.nextBeatFrame) {
        const scheduledBeat = this.beat;
        this.frequency = scheduledBeat === 0 ? 1000 : 700;
        this.phase = 0;
        this.clickSamplesLeft = this.clickFrames;
        this.port.postMessage({ type: 'beat', beat: scheduledBeat, frame });
        this.beat = (scheduledBeat + 1) % this.beatsPerBar;
        this.nextBeatFrame += framesPerBeat;
        if (this.nextBeatFrame <= frame) this.nextBeatFrame = frame + framesPerBeat;
      }

      if (this.clickSamplesLeft > 0) {
        const progress = 1 - this.clickSamplesLeft / this.clickFrames;
        const envelope = Math.exp(-8 * progress);
        const accentGain = this.frequency === 1000 ? 1 : 0.6;
        channel[i] = Math.sin(this.phase) * envelope * this.volume * accentGain;
        this.phase += 2 * Math.PI * this.frequency / sampleRate;
        this.clickSamplesLeft -= 1;
      }
    }
    return true;
  }
}

registerProcessor('precision-metronome', PrecisionMetronomeProcessor);
