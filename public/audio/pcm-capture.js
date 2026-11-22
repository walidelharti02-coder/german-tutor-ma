// Average the hardware samples that overlap each 16 kHz sample. Carry both
// the fractional boundary and incomplete 20 ms packet across render quanta.
class PcmCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.ratio = sampleRate / 16000;
    this.remaining = this.ratio;
    this.sum = 0;
    this.packet = new DataView(new ArrayBuffer(640));
    this.offset = 0;
  }
  process(inputs) {
    const channel = inputs[0]?.[0];
    if (!channel) return true;
    for (const value of channel) {
      let portion = 1;
      while (portion > 1e-8) {
        const weight = Math.min(portion, this.remaining);
        this.sum += value * weight;
        this.remaining -= weight;
        portion -= weight;
        if (this.remaining <= 1e-8) {
          const sample = Math.max(-1, Math.min(1, this.sum / this.ratio));
          this.packet.setInt16(
            this.offset,
            Math.round(sample * (sample < 0 ? 32768 : 32767)),
            true,
          );
          this.offset += 2;
          this.sum = 0;
          this.remaining = this.ratio;
          if (this.offset === 640) {
            this.port.postMessage(this.packet.buffer, [this.packet.buffer]);
            this.packet = new DataView(new ArrayBuffer(640));
            this.offset = 0;
          }
        }
      }
    }
    return true;
  }
}
registerProcessor("oustad-pcm", PcmCapture);
