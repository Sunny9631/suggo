// Audio fix for WebRTC calls
export const setupAudioElement = (stream) => {
  const audio = new Audio();
  audio.srcObject = stream;
  audio.muted = false;
  audio.volume = 1.0;
  
  // Store globally
  window.remoteAudio = audio;
  
  // Try to play
  const playAudio = async () => {
    try {
      await audio.play();
      console.log('Audio playing successfully');
    } catch (err) {
      console.log('Audio autoplay blocked, waiting for click');
      const startAudio = () => {
        audio.play().then(() => {
          console.log('Audio started after click');
        }).catch(e => console.log('Audio still failed:', e));
        document.removeEventListener('click', startAudio);
      };
      document.addEventListener('click', startAudio, { once: true });
    }
  };
  
  playAudio();
  return audio;
};
