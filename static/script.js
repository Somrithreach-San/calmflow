class SoundManager {
  constructor() {
    this.sounds = new Map();
    this.globalVolume = 0.5;
    this.currentActiveGroup = null;
    this.init();
  }

  async init() {
    try {
      const response = await fetch("/api/sounds");
      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }
      const soundsData = await response.json();

      const soundButtons = document.querySelectorAll(".sound-button");
      soundButtons.forEach((button) => {
        const soundContainer = button.closest(".sound-button-container");
        const soundName = soundContainer.getAttribute("data-sound-name");
        const soundInfo = soundsData.find((s) => s.name === soundName);
        if (soundInfo) {
          this.initializeSound(button, soundInfo);
        }
      });

      // Initialize slider thumb neo-brutalist effect
      this.initSliderThumbEffect();
    } catch (error) {
      console.error("Error initializing SoundManager:", error);
    }
  }

  initializeSound(button, soundInfo) {
    const audio = new Audio();
    audio.loop = true;

    const volumeControl = button.parentElement.querySelector(".volume-control");
    const volumeSlider = volumeControl.querySelector(".volume-slider");

    const initialVolume = soundInfo.default_volume || 0.5;
    volumeSlider.value = initialVolume * 100;

    this.sounds.set(soundInfo.name, {
      audio: audio,
      isPlaying: false,
      volume: initialVolume,
      data: soundInfo,
    });

    button.addEventListener("click", () => {
      this.toggleSound(soundInfo.name, button, volumeControl);
    });

    volumeSlider.addEventListener("input", (e) => {
      const newVolume = e.target.value / 100;
      const sound = this.sounds.get(soundInfo.name);
      if (sound) {
        sound.volume = newVolume;
        if (sound.isPlaying) {
          sound.audio.volume = newVolume * this.globalVolume;
        }
      }
    });
  }

  initSliderThumbEffect() {
    // Add neo-brutalist drag effect to all volume sliders
    const volumeSliders = document.querySelectorAll(".volume-slider");

    volumeSliders.forEach((slider) => {
      let isThumbPressed = false;

      // Helper function to check if event is on the thumb
      const isThumbEvent = (e) => {
        // For mouse events, check if target is the slider (thumb clicks go to slider)
        if (e.type.includes("mouse") || e.type.includes("pointer")) {
          const rect = slider.getBoundingClientRect();
          const thumbWidth = 20; // Same as CSS thumb size
          const thumbPosition =
            (slider.value / 100) * (rect.width - thumbWidth);

          // Check if click is within thumb area (with some padding)
          const clickX = e.clientX - rect.left;
          return (
            clickX >= thumbPosition - 15 &&
            clickX <= thumbPosition + thumbWidth + 15
          );
        }
        // For touch events, it's harder to detect thumb specifically
        return true; // Assume it's the thumb for touch events
      };

      // Mouse down - check if it's on the thumb
      slider.addEventListener("mousedown", (e) => {
        if (isThumbEvent(e)) {
          isThumbPressed = true;
          slider.classList.add("thumb-pressed");
        }
      });

      // Mouse up - remove pressed state
      slider.addEventListener("mouseup", () => {
        if (isThumbPressed) {
          isThumbPressed = false;
          slider.classList.remove("thumb-pressed");
        }
      });

      // Mouse leave - remove pressed state if mouse leaves while dragging
      slider.addEventListener("mouseleave", () => {
        if (isThumbPressed) {
          isThumbPressed = false;
          slider.classList.remove("thumb-pressed");
        }
      });

      // Touch start
      slider.addEventListener("touchstart", (e) => {
        isThumbPressed = true;
        slider.classList.add("thumb-pressed");
      });

      // Touch end
      slider.addEventListener("touchend", () => {
        isThumbPressed = false;
        slider.classList.remove("thumb-pressed");
      });

      // Touch cancel
      slider.addEventListener("touchcancel", () => {
        isThumbPressed = false;
        slider.classList.remove("thumb-pressed");
      });

      // Global mouse up to catch releases outside the slider
      document.addEventListener("mouseup", () => {
        if (isThumbPressed) {
          isThumbPressed = false;
          slider.classList.remove("thumb-pressed");
        }
      });

      // Global touch end
      document.addEventListener("touchend", () => {
        if (isThumbPressed) {
          isThumbPressed = false;
          slider.classList.remove("thumb-pressed");
        }
      });
    });
  }

  async toggleSound(soundName, button, volumeControl) {
    const sound = this.sounds.get(soundName);
    if (!sound) return;

    try {
      if (!sound.isPlaying) {
        if (!sound.audio.src) {
          sound.audio.src = sound.data.file_path;
        }
        sound.audio.volume = sound.volume * this.globalVolume;
        await sound.audio.play();
        sound.isPlaying = true;
        button.classList.add("active");
        volumeControl.classList.remove("hidden");
      } else {
        sound.audio.pause();
        sound.audio.currentTime = 0;
        sound.isPlaying = false;
        button.classList.remove("active");
        volumeControl.classList.add("hidden");
      }
    } catch (error) {
      console.error("Error toggling sound:", error);
    }
  }

  setGlobalVolume(volume) {
    this.globalVolume = volume;
    this.sounds.forEach((sound) => {
      if (sound.isPlaying) {
        sound.audio.volume = sound.volume * this.globalVolume;
      }
    });
  }

  stopAllSounds() {
    this.sounds.forEach((sound, soundName) => {
      if (sound.isPlaying) {
        const soundContainer = document.querySelector(
          `.sound-button-container[data-sound-name="${soundName}"]`
        );
        if (soundContainer) {
          const button = soundContainer.querySelector(".sound-button");
          const volumeControl = soundContainer.querySelector(".volume-control");
          this.toggleSound(soundName, button, volumeControl);
        }
      }
    });
    this.currentActiveGroup = null;
    document
      .querySelectorAll(".playlist-card")
      .forEach((c) => c.classList.remove("active"));
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const soundManager = new SoundManager();

  // --- THEME TOGGLE LOGIC ---
  const themeToggleButton = document.getElementById("theme-toggle");
  const docElement = document.documentElement;

  const applyTheme = (theme) => {
    docElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  };

  const preferredTheme = localStorage.getItem("theme") || "light";
  applyTheme(preferredTheme);

  themeToggleButton.addEventListener("click", () => {
    const currentTheme = docElement.getAttribute("data-theme");
    const newTheme = currentTheme === "light" ? "dark" : "light";
    applyTheme(newTheme);
  });

  // Global Controls
  const clearButton = document.querySelector(".action-button.clear");
  const volumeIcon = document.getElementById("volume-icon");
  const globalVolumeSlider = document.getElementById("global-volume-slider");

  clearButton.addEventListener("click", () => soundManager.stopAllSounds());

  if (globalVolumeSlider) {
    globalVolumeSlider.addEventListener("input", (e) =>
      soundManager.setGlobalVolume(e.target.value / 100)
    );

    // Add neo-brutalist effect to global volume slider too
    let isThumbPressedGlobal = false;

    // Mouse down
    globalVolumeSlider.addEventListener("mousedown", (e) => {
      const rect = globalVolumeSlider.getBoundingClientRect();
      const thumbWidth = 20;
      const thumbPosition =
        (globalVolumeSlider.value / 100) * (rect.width - thumbWidth);
      const clickX = e.clientX - rect.left;

      // Check if click is within thumb area
      if (
        clickX >= thumbPosition - 15 &&
        clickX <= thumbPosition + thumbWidth + 15
      ) {
        isThumbPressedGlobal = true;
        globalVolumeSlider.classList.add("thumb-pressed");
      }
    });

    // Mouse up
    globalVolumeSlider.addEventListener("mouseup", () => {
      if (isThumbPressedGlobal) {
        isThumbPressedGlobal = false;
        globalVolumeSlider.classList.remove("thumb-pressed");
      }
    });

    // Mouse leave
    globalVolumeSlider.addEventListener("mouseleave", () => {
      if (isThumbPressedGlobal) {
        isThumbPressedGlobal = false;
        globalVolumeSlider.classList.remove("thumb-pressed");
      }
    });

    // Touch events
    globalVolumeSlider.addEventListener("touchstart", () => {
      isThumbPressedGlobal = true;
      globalVolumeSlider.classList.add("thumb-pressed");
    });

    globalVolumeSlider.addEventListener("touchend", () => {
      isThumbPressedGlobal = false;
      globalVolumeSlider.classList.remove("thumb-pressed");
    });

    // Global cleanup
    document.addEventListener("mouseup", () => {
      if (isThumbPressedGlobal) {
        isThumbPressedGlobal = false;
        globalVolumeSlider.classList.remove("thumb-pressed");
      }
    });

    document.addEventListener("touchend", () => {
      if (isThumbPressedGlobal) {
        isThumbPressedGlobal = false;
        globalVolumeSlider.classList.remove("thumb-pressed");
      }
    });
  }

  // Playlist Playback Logic
  const playlistCards = document.querySelectorAll(".playlist-card");

  playlistCards.forEach((card) => {
    card.addEventListener("click", (event) => {
      event.preventDefault();

      const isRandomCard = card.id === "random-playlist";
      const selectedGroup = isRandomCard
        ? "random"
        : card.getAttribute("data-group");

      if (soundManager.currentActiveGroup === selectedGroup) {
        soundManager.stopAllSounds();
        return;
      }

      soundManager.stopAllSounds();

      soundManager.currentActiveGroup = selectedGroup;
      document
        .querySelectorAll(".playlist-card")
        .forEach((c) => c.classList.remove("active"));
      card.classList.add("active");

      if (isRandomCard) {
        const allSoundNames = Array.from(soundManager.sounds.keys());

        for (let i = allSoundNames.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [allSoundNames[i], allSoundNames[j]] = [
            allSoundNames[j],
            allSoundNames[i],
          ];
        }

        const soundsToPlay = allSoundNames.slice(0, 4);

        soundsToPlay.forEach((soundName) => {
          const sound = soundManager.sounds.get(soundName);
          if (sound && !sound.isPlaying) {
            const container = document.querySelector(
              `.sound-button-container[data-sound-name="${soundName}"]`
            );
            if (container) {
              const button = container.querySelector(".sound-button");
              const volumeControl = container.querySelector(".volume-control");
              soundManager.toggleSound(soundName, button, volumeControl);
            }
          }
        });
      } else {
        const soundsToPlay = document.querySelectorAll(
          `.sound-button-container[data-group~="${selectedGroup}"]`
        );
        soundsToPlay.forEach((container) => {
          const soundName = container.getAttribute("data-sound-name");
          const sound = soundManager.sounds.get(soundName);
          if (sound && !sound.isPlaying) {
            const button = container.querySelector(".sound-button");
            const volumeControl = container.querySelector(".volume-control");
            soundManager.toggleSound(soundName, button, volumeControl);
          }
        });
      }
    });
  });

  // Playlist Carousel Logic
  const scrollLeftBtn = document.getElementById("scroll-left");
  const scrollRightBtn = document.getElementById("scroll-right");
  const playlistCarousel = document.querySelector(".playlist-carousel");

  if (scrollLeftBtn && scrollRightBtn && playlistCarousel) {
    const cardWidth = 200;
    const gap = 24;
    const scrollAmount = (cardWidth + gap) * 1;

    scrollLeftBtn.addEventListener("click", () => {
      playlistCarousel.scrollBy({ left: -scrollAmount, behavior: "smooth" });
    });

    scrollRightBtn.addEventListener("click", () => {
      playlistCarousel.scrollBy({ left: scrollAmount, behavior: "smooth" });
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft") {
        playlistCarousel.scrollBy({ left: -scrollAmount, behavior: "smooth" });
      } else if (e.key === "ArrowRight") {
        playlistCarousel.scrollBy({ left: scrollAmount, behavior: "smooth" });
      }
    });

    const updateArrowVisibility = () => {
      const { scrollLeft, scrollWidth, clientWidth } = playlistCarousel;
      scrollLeftBtn.style.opacity = scrollLeft > 0 ? "1" : "0.5";
      scrollRightBtn.style.opacity =
        scrollLeft < scrollWidth - clientWidth - 1 ? "1" : "0.5";
    };

    playlistCarousel.addEventListener("scroll", updateArrowVisibility);
    updateArrowVisibility();
  }
});
