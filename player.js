// Motor de reprodução: um único <audio> tocando o streaming da música.
const player = (() => {
  const audio = document.getElementById('audio');
  const on = { play() {}, pause() {}, time() {}, ended() {}, error() {} };
  audio.addEventListener('ended', () => on.ended());
  audio.addEventListener('play', () => on.play());
  audio.addEventListener('pause', () => on.pause());
  audio.addEventListener('timeupdate', () => on.time());
  audio.addEventListener('loadedmetadata', () => on.time());
  audio.addEventListener('error', () => audio.getAttribute('src') && on.error());
  return {
    on,
    get paused() { return audio.paused; },
    get currentTime() { return audio.currentTime; },
    set currentTime(s) { audio.currentTime = s; },
    get duration() { return audio.duration; },
    play() { audio.play().catch(() => {}); },
    pause() { audio.pause(); },
    stop() { audio.pause(); audio.removeAttribute('src'); },
    load(url, autoplay = true) { audio.src = url; if (autoplay) audio.play().catch(() => {}); },
  };
})();
