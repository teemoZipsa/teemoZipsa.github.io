// 강세 단계별 클릭음: 0=약박, 1=보조 강세(그룹 시작), 2=마디 첫 박
const CLICK_TONES = [
  { frequency: 700, gain: 0.6 },
  { frequency: 850, gain: 0.8 },
  { frequency: 1000, gain: 1 }
];

class PrecisionMetronomeProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bpm = 120;
    this.volume = 0.8;
    this.beatsPerBar = 4;
    // BPM은 4분음표(♩) 기준이다. noteValue가 8이면 8분음표(♪)마다 클릭한다.
    this.noteValue = 4;
    this.accents = [2, 0, 0, 0];
    this.beat = 0;
    this.running = false;
    this.nextBeatFrame = 0;
    this.clickFrames = Math.max(1, Math.floor(sampleRate * 0.055));
    this.clickSamplesLeft = 0;
    this.phase = 0;
    this.tone = CLICK_TONES[2];
    this.port.onmessage = event => this.handleMessage(event.data || {});
  }

  handleMessage(message) {
    if (message.type === 'config') {
      if (Number.isFinite(message.bpm)) this.bpm = Math.max(20, Math.min(300, message.bpm));
      if (Number.isFinite(message.volume)) this.volume = Math.max(0, Math.min(1, message.volume));
      if (Number.isFinite(message.beatsPerBar)) this.beatsPerBar = Math.max(1, Math.min(12, Math.round(message.beatsPerBar)));
      if (message.noteValue === 4 || message.noteValue === 8) this.noteValue = message.noteValue;
      if (Array.isArray(message.accents)) this.accents = message.accents.map(level => Math.max(0, Math.min(2, Math.round(Number(level) || 0))));
      if (message.resetBeat || this.beat >= this.beatsPerBar) this.beat = 0;
    } else if (message.type === 'start') {
      this.beat = 0;
      this.nextBeatFrame = currentFrame;
      this.running = true;
    } else if (message.type === 'stop') {
      this.running = false;
      this.clickSamplesLeft = 0;
    }
  }

  accentLevel(beat) {
    if (beat === 0) return 2;
    return this.accents[beat] || 0;
  }

  process(_inputs, outputs) {
    const channel = outputs[0] && outputs[0][0];
    if (!channel) return true;
    channel.fill(0);
    if (!this.running) return true;

    const framesPerBeat = (sampleRate * 60 / this.bpm) * (4 / this.noteValue);
    for (let i = 0; i < channel.length; i += 1) {
      const frame = currentFrame + i;
      if (frame >= this.nextBeatFrame) {
        const scheduledBeat = this.beat;
        this.tone = CLICK_TONES[this.accentLevel(scheduledBeat)] || CLICK_TONES[0];
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
        channel[i] = Math.sin(this.phase) * envelope * this.volume * this.tone.gain;
        this.phase += 2 * Math.PI * this.tone.frequency / sampleRate;
        this.clickSamplesLeft -= 1;
      }
    }
    return true;
  }
}

registerProcessor('precision-metronome', PrecisionMetronomeProcessor);
