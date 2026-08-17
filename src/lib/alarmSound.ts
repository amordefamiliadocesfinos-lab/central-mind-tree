// Motor de som do alarme: bipes em loop até ser parado manualmente.
let ctx: AudioContext | null = null;
let loopTimer: number | null = null;
let vibrateTimer: number | null = null;
let retryTimer: number | null = null;
let playing = false;

function getCtx(): AudioContext | null {
  try {
    if (!ctx) {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  } catch {
    return null;
  }
}

/** Deve ser chamado em um gesto do usuário para liberar o áudio no navegador. */
export function unlockAlarmAudio() {
  const c = getCtx();
  // Se um alarme está tocando mas o áudio estava bloqueado, retoma agora.
  if (playing && c && c.state === 'running' && loopTimer === null) startLoop();
}

function beep(at: number, freq: number, duration: number) {
  const c = ctx;
  if (!c) return;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = 'square';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(0.25, at + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  osc.connect(gain);
  gain.connect(c.destination);
  osc.start(at);
  osc.stop(at + duration + 0.05);
}

export function isAlarmSoundPlaying() {
  return playing;
}

function cycle() {
  const c = getCtx();
  if (!c || !playing) return;
  if (c.state !== 'running') return; // aguarda liberação do áudio pelo navegador
  const t = c.currentTime;
  beep(t, 880, 0.18);
  beep(t + 0.25, 1174, 0.18);
  beep(t + 0.5, 880, 0.18);
}

function startLoop() {
  if (loopTimer !== null) return;
  cycle();
  loopTimer = window.setInterval(cycle, 1500);
}

export function startAlarmSound() {
  if (playing) return;
  playing = true;

  const c = getCtx();
  if (c && c.state === 'running') {
    startLoop();
  } else {
    // Áudio ainda bloqueado: tenta novamente até ser liberado (gesto do usuário).
    c?.resume?.().then(() => { if (playing) startLoop(); }).catch(() => {});
    retryTimer = window.setInterval(() => {
      if (!playing) return;
      const c2 = getCtx();
      if (c2 && c2.state === 'running') {
        startLoop();
        if (retryTimer) { clearInterval(retryTimer); retryTimer = null; }
      }
    }, 1000);
  }

  if ('vibrate' in navigator) {
    const buzz = () => navigator.vibrate?.([400, 200, 400]);
    buzz();
    vibrateTimer = window.setInterval(buzz, 1500);
  }
}

export function stopAlarmSound() {
  playing = false;
  if (loopTimer) { clearInterval(loopTimer); loopTimer = null; }
  if (retryTimer) { clearInterval(retryTimer); retryTimer = null; }
  if (vibrateTimer) { clearInterval(vibrateTimer); vibrateTimer = null; }
  if ('vibrate' in navigator) navigator.vibrate?.(0);
  try { window.speechSynthesis?.cancel(); } catch { /* noop */ }
}
