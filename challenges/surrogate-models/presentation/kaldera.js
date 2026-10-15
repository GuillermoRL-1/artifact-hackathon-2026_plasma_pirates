// The KALDERA animation and its timeline slider (sections/_01 and _02), rebuilt from kaldera.desy.de:
// the same two full clips (25 fps, every frame a keyframe, so seeking is smooth while
// streaming) and the same stage table, which maps the 0-3600 timeline to frames of each clip.
(() => {
  const players = document.querySelectorAll('.kaldera-player');
  if (!players.length || typeof Reveal === 'undefined') return;

  const FPS = 25;
  const CLIPS = {
    micro: 'https://kaldera.desy.de/videos/microFullClip.mp4',
    macro: 'https://kaldera.desy.de/videos/makroFullClip.mp4',
  };
  // From the site's bundle: [name, colour, macro frames, micro frames, timeline from/centre/to].
  const STAGES = [
    ['Laser', 'red', [0, 300], [0, 300], [0, 0, 400]],
    ['Alignment', 'red', [300, 600], [300, 600], [400, 640, 800]],
    ['Radiation pressure', 'grey', [600, 800], [600, 700], [800, 900, 1000]],
    ['Plasma wave', 'grey', [800, 950], [700, 850], [1000, 1150, 1300]],
    ['Bunch', 'grey', [950, 1025], [850, 925], [1300, 1350, 1450]],
    ['Acceleration', 'grey', [1025, 1200], [925, 1100], [1450, 1625, 1800]],
    ['Exit', 'grey', [1200, 1800], [1100, 1600], [1800, 2400, 2800]],
    ['Bunching', 'blue', [1800, 1950], [1600, 1750], [2800, 3050, 3200]],
    ['Application', 'blue', [1950, 2250], [1750, 2050], [3200, 3384, 3600]],
  ];
  const END = 3600;
  // Playback speeds of the speed button, and the one each player starts at.
  const SPEEDS = [1, 2, 3, 5];
  const DEFAULT_SPEED = 3;

  players.forEach((player) => {
  const video = player.querySelector('.kaldera-video');
  const slider = player.querySelector('.kaldera-slider');
  const playButton = player.querySelector('.kaldera-play');
  const clipButton = player.querySelector('.kaldera-clip');
  const slide = player.closest('section');
  let clip = player.dataset.clip || 'micro';
  const frames = (stage) => (clip === 'macro' ? stage[2] : stage[3]);

  // Speed: a button next to the view switch cycles through SPEEDS. Loading a clip resets the
  // rate, so it is applied again on every load.
  let speed = Number(player.dataset.speed) || DEFAULT_SPEED;
  const speedButton = document.createElement('button');
  speedButton.type = 'button';
  speedButton.className = 'kaldera-speed';
  speedButton.title = `Playback speed (${SPEEDS.map((x) => `${x}×`).join(', ')})`;
  clipButton.before(speedButton);
  const applySpeed = () => {
    video.defaultPlaybackRate = speed;
    video.playbackRate = speed;
    speedButton.textContent = `${speed}×`;
    speedButton.setAttribute('aria-label', `Playback speed ${speed} times`);
  };
  speedButton.addEventListener('click', () => {
    speed = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
    applySpeed();
    speedButton.blur();   // arrows back to the deck
  });
  video.addEventListener('loadedmetadata', applySpeed);
  applySpeed();

  const frameAt = (t) => {
    const stage = STAGES.find((s) => t <= s[4][2]) || STAGES[STAGES.length - 1];
    const [from, , to] = stage[4];
    const [f0, f1] = frames(stage);
    return f0 + ((Math.min(Math.max(t, from), to) - from) / (to - from || 1)) * (f1 - f0);
  };
  const timelineAt = (frame) => {
    const stage = STAGES.find((s) => frame <= frames(s)[1]) || STAGES[STAGES.length - 1];
    const [f0, f1] = frames(stage);
    const [from, , to] = stage[4];
    return from + ((Math.min(Math.max(frame, f0), f1) - f0) / (f1 - f0 || 1)) * (to - from);
  };

  // Stage markers on the track: a coloured segment per stage, a dot at its centre.
  const stagesBox = player.querySelector('.kaldera-stages');
  STAGES.forEach(([name, colour, , , [from, centre, to]]) => {
    const segment = document.createElement('span');
    segment.className = `kaldera-segment ${colour}`;
    segment.style.left = `${(from / END) * 100}%`;
    segment.style.width = `${((to - from) / END) * 100}%`;
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = `kaldera-dot ${colour}`;
    dot.title = name;
    dot.setAttribute('aria-label', name);
    dot.style.left = `${(centre / END) * 100}%`;
    dot.addEventListener('click', () => { pause(); seekTimeline(centre); });
    stagesBox.append(segment, dot);
  });

  // Seeking: keep only the latest target while the video is busy, so a fast drag never queues.
  let pendingFrame = null;
  const applySeek = () => {
    if (pendingFrame === null || video.seeking || video.readyState < 1) return;
    video.currentTime = pendingFrame / FPS;
    pendingFrame = null;
  };
  video.addEventListener('seeked', applySeek);
  video.addEventListener('loadedmetadata', applySeek);
  const paint = (t) => {
    slider.value = String(t);
    player.style.setProperty('--progress', `${(t / END) * 100}%`);
  };
  const seekTimeline = (t) => {
    paint(t);
    pendingFrame = frameAt(t);
    applySeek();
  };

  // Playing runs the clip itself and moves the slider with it.
  let raf = null;
  const follow = () => {
    paint(timelineAt(video.currentTime * FPS));
    raf = video.paused ? null : requestAnimationFrame(follow);
  };
  const play = () => {
    if (Number(slider.value) >= END - 1) seekTimeline(0);
    video.play().then(() => { player.classList.add('playing'); follow(); }).catch(() => {});
  };
  function pause() {
    video.pause();
    player.classList.remove('playing');
    if (raf) cancelAnimationFrame(raf);
    raf = null;
  }
  video.addEventListener('ended', pause);
  playButton.addEventListener('click', () => (video.paused ? play() : pause()));

  slider.addEventListener('pointerdown', pause);
  slider.addEventListener('input', () => seekTimeline(Number(slider.value)));
  // Hand the keyboard back to Reveal once the slider has been used.
  slider.addEventListener('change', () => slider.blur());
  slider.addEventListener('pointerup', () => slider.blur());

  const load = (name) => {
    clip = name;
    player.dataset.clip = name;
    const t = Number(slider.value);
    video.src = CLIPS[name];
    seekTimeline(t);
  };
  clipButton.addEventListener('click', () => {
    const wasPlaying = !video.paused;
    pause();
    load(clip === 'micro' ? 'macro' : 'micro');
    if (wasPlaying) video.addEventListener('canplay', play, {once: true});
  });

  // Start streaming one slide early; play from the start on every visit, stop on leaving.
  const reveal = document.querySelector('.reveal');
  const onSlide = () => {
    const here = Reveal.getIndices().h;
    const there = Reveal.getIndices(slide).h;
    if (!video.src && here >= there - 1) load(clip);
    const present = Reveal.getCurrentSlide() === slide;
    if (slide.classList.contains('kaldera-slide')) {
      reveal.classList.toggle('on-kaldera', present);
    }
    if (present) {
      seekTimeline(0);
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        if (video.readyState >= 2) play();
        else video.addEventListener('canplay', play, {once: true});
      }
    } else if (!video.paused) {
      pause();
    }
  };
  Reveal.on('slidechanged', onSlide);
  if (Reveal.isReady()) onSlide();
  else Reveal.on('ready', onSlide);
  });
})();
