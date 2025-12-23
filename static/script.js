// SoundManager Class
class SoundManager {
  constructor() {
    this.sounds = new Map();
    this.globalVolume = 0.5;
    this.currentActiveGroup = null;
    this.isUserLoggedIn = document.body.dataset.userLoggedIn === "true";
    this.init();
  }

  async init() {
    try {
      console.log("🎵 Initializing SoundManager...");
      console.log("👤 User logged in:", this.isUserLoggedIn);

      const response = await fetch("/api/sounds");
      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }
      const soundsData = await response.json();

      this.allSoundsData = soundsData;
      console.log(`📊 Loaded ${soundsData.length} sounds from API`);

      this.initializeAccessibleSounds(soundsData);
      this.setupPlaylistHandlers();
      this.setupClearButton();
      this.setupGlobalVolumeControl();
      this.setupThemeToggle();
      this.setupUserMenu();
      this.setupCarousel();
      this.initSliderThumbEffect();

      console.log("✅ SoundManager initialized successfully");
    } catch (error) {
      console.error("❌ Error initializing SoundManager:", error);
    }
  }

  // Initialize slider thumb neo-brutalist effect
  initSliderThumbEffect() {
    const sliders = document.querySelectorAll('input[type="range"]');

    sliders.forEach((slider) => {
      // Create thumb div if it doesn't exist
      let thumbDiv = slider.parentElement.querySelector(".slider-thumb");
      if (!thumbDiv) {
        thumbDiv = document.createElement("div");
        thumbDiv.className = "slider-thumb";
        slider.parentElement.appendChild(thumbDiv);
      }

      // Update thumb position
      const updateThumb = () => {
        const value = slider.value;
        const min = slider.min || 0;
        const max = slider.max || 100;
        const percent = ((value - min) / (max - min)) * 100;

        thumbDiv.style.left = `calc(${percent}% - 8px)`;
        // REMOVED: thumbDiv.textContent = `${value}%`;
      };

      // Initial update
      updateThumb();

      // Update on input
      slider.addEventListener("input", updateThumb);

      // Add hover effect
      slider.addEventListener("mouseenter", () => {
        thumbDiv.style.opacity = "1";
      });

      slider.addEventListener("mouseleave", () => {
        // Only hide if slider is not being dragged
        if (!slider.matches(":active")) {
          thumbDiv.style.opacity = "0";
        }
      });

      // Show thumb when slider is being dragged
      slider.addEventListener("mousedown", () => {
        thumbDiv.style.opacity = "1";
      });

      // Hide thumb after dragging ends
      slider.addEventListener("mouseup", () => {
        setTimeout(() => {
          if (!slider.matches(":hover")) {
            thumbDiv.style.opacity = "0";
          }
        }, 1000);
      });
    });

    console.log("🎛️ Slider thumb effect initialized (no percentages)");
  }

  initializeAccessibleSounds(soundsData) {
    const soundButtons = document.querySelectorAll(
      ".sound-button:not(.premium .sound-button)"
    );
    console.log(`🔊 Found ${soundButtons.length} accessible sound buttons`);

    let initializedCount = 0;
    soundButtons.forEach((button) => {
      const soundContainer = button.closest(".sound-button-container");
      const soundName = soundContainer.getAttribute("data-sound-name");
      const soundInfo = soundsData.find((s) => s.name === soundName);

      if (soundInfo && soundInfo.user_can_access) {
        this.initializeSound(button, soundInfo);
        initializedCount++;
      }
    });
    console.log(`✅ Initialized ${initializedCount} sounds`);
  }

  setupPlaylistHandlers() {
    const playlistCards = document.querySelectorAll(".playlist-card");
    console.log(`🎵 Found ${playlistCards.length} playlist cards`);

    playlistCards.forEach((card, index) => {
      const groupId = card.getAttribute("data-group");
      const groupName = card.querySelector(".playlist-title").textContent;
      console.log(`  ${index}: ${groupName} (ID: ${groupId || "Random"})`);

      // Store original state
      card.dataset.originalState = "stopped";

      card.addEventListener("click", (e) => {
        e.preventDefault();
        const groupId = card.getAttribute("data-group");
        const groupName = card.querySelector(".playlist-title").textContent;

        console.log(`🎯 Playlist clicked: ${groupName} (ID: ${groupId})`);

        // Toggle playlist on/off
        if (card.dataset.originalState === "stopped") {
          // Start the playlist
          if (card.id === "random-playlist") {
            this.playRandomSounds();
          } else if (groupId) {
            this.playGroupSounds(parseInt(groupId), groupName);
          }
          card.dataset.originalState = "playing";
          card.classList.add("playing");
        } else {
          // Stop the playlist
          this.stopAllSounds();
          card.dataset.originalState = "stopped";
          card.classList.remove("playing");
          console.log(`⏹️ Stopped ${groupName} playlist`);
        }
      });
    });
  }

  playGroupSounds(groupId, groupName) {
    console.log(`▶️ Playing ${groupName} playlist (ID: ${groupId})`);

    if (!this.allSoundsData) {
      console.error("❌ No sound data available");
      return;
    }

    // Only stop other sounds, not this group if it's already playing
    if (this.currentActiveGroup !== groupId) {
      this.stopAllSounds();
    }

    const groupSounds = this.allSoundsData.filter((sound) => {
      const hasAccess = this.isUserLoggedIn || !sound.is_premium;
      const inGroup = sound.groups.includes(groupId);
      return hasAccess && inGroup;
    });

    console.log(
      `📊 Found ${groupSounds.length} accessible sounds in ${groupName}`
    );

    if (groupSounds.length === 0) {
      console.warn(`⚠️ No accessible sounds in ${groupName}`);
      return;
    }

    let playedCount = 0;
    groupSounds.forEach((sound) => {
      const audio = this.sounds.get(sound.name);
      if (audio) {
        audio.volume = (sound.default_volume || 0.5) * this.globalVolume;

        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              this.updateButtonState(sound.name, true);
              playedCount++;
              console.log(`   🔊 Playing: ${sound.display_name}`);
            })
            .catch((error) => {
              console.error(`   ❌ Error playing ${sound.name}:`, error);
            });
        }
      }
    });

    console.log(`✅ Attempted to play ${playedCount} sounds`);
    this.currentActiveGroup = groupId;
    this.highlightActiveGroup(groupId);
  }

  playRandomSounds() {
    console.log("🎲 Playing random sounds");

    if (!this.allSoundsData) {
      console.error("❌ No sound data available");
      return;
    }

    this.stopAllSounds();

    const accessibleSounds = this.allSoundsData.filter(
      (sound) => this.isUserLoggedIn || !sound.is_premium
    );

    console.log(`📊 Total accessible sounds: ${accessibleSounds.length}`);

    if (accessibleSounds.length === 0) {
      console.warn("⚠️ No accessible sounds available");
      return;
    }

    const randomCount = Math.min(
      accessibleSounds.length,
      Math.floor(Math.random() * 3) + 3
    );
    const shuffled = [...accessibleSounds].sort(() => 0.5 - Math.random());
    const selectedSounds = shuffled.slice(0, randomCount);

    console.log(`🎲 Selected ${selectedSounds.length} random sounds`);

    let playedCount = 0;
    selectedSounds.forEach((sound) => {
      const audio = this.sounds.get(sound.name);
      if (audio) {
        audio.volume = (sound.default_volume || 0.5) * this.globalVolume;

        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              this.updateButtonState(sound.name, true);
              playedCount++;
              console.log(`   🔊 Playing: ${sound.display_name}`);
            })
            .catch((error) => {
              console.error(`   ❌ Error playing ${sound.name}:`, error);
            });
        }
      }
    });

    console.log(`✅ Attempted to play ${playedCount} random sounds`);
    this.currentActiveGroup = null;
    this.highlightActiveGroup(null);
  }

  initializeSound(button, soundInfo) {
    const soundContainer = button.closest(".sound-button-container");
    const soundName = soundInfo.name;

    const audio = new Audio(soundInfo.file_path);
    audio.loop = true;
    audio.volume = soundInfo.default_volume || 0.5;

    this.sounds.set(soundName, audio);

    button.addEventListener("click", () => {
      if (audio.paused) {
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              this.updateButtonState(soundName, true);
              console.log(`▶️ Manually playing: ${soundName}`);
              // Show volume control when playing
              const volumeControl =
                soundContainer.querySelector(".volume-control");
              if (volumeControl) {
                volumeControl.classList.remove("hidden");
              }
            })
            .catch((error) => {
              console.error(`❌ Error playing ${soundName}:`, error);
            });
        }
      } else {
        audio.pause();
        this.updateButtonState(soundName, false);
        // Hide volume control when paused (if not hovering)
        if (!soundContainer.matches(":hover")) {
          const volumeControl = soundContainer.querySelector(".volume-control");
          if (volumeControl) {
            volumeControl.classList.add("hidden");
          }
        }
      }
    });

    const volumeSlider = soundContainer.querySelector(".volume-slider");
    const volumeControl = soundContainer.querySelector(".volume-control");

    // Only show volume control on click, not hover
    button.addEventListener("click", () => {
      if (volumeControl && !audio.paused) {
        volumeControl.classList.remove("hidden");
      }
    });

    // Hide volume control when mouse leaves AND sound is not playing
    soundContainer.addEventListener("mouseleave", () => {
      if (audio.paused && volumeControl) {
        volumeControl.classList.add("hidden");
      }
    });

    if (volumeSlider) {
      // Initialize slider thumb for this slider
      setTimeout(() => {
        this.initSliderThumbEffect();
      }, 100);

      volumeSlider.addEventListener("input", (e) => {
        audio.volume = e.target.value / 100;
        this.updateAllVolumes();
      });
      audio.volume = volumeSlider.value / 100;
    }

    audio.addEventListener("play", () => {
      // Show volume control when playing
      if (volumeControl) {
        volumeControl.classList.remove("hidden");
      }
    });

    audio.addEventListener("pause", () => {
      // Hide volume control when paused (if not hovering)
      if (volumeControl && !soundContainer.matches(":hover")) {
        volumeControl.classList.add("hidden");
      }
    });

    console.log(`✅ Initialized sound: ${soundName}`);
  }

  updateButtonState(soundName, isPlaying) {
    const soundContainer = document.querySelector(
      `[data-sound-name="${soundName}"]`
    );
    if (!soundContainer) return;

    const button = soundContainer.querySelector(".sound-button");

    if (isPlaying) {
      button.classList.add("playing");
      const icon = button.querySelector(".sound-icon");
      if (icon) icon.style.transform = "scale(1.05)";
    } else {
      button.classList.remove("playing");
      const icon = button.querySelector(".sound-icon");
      if (icon) icon.style.transform = "scale(1)";
    }
  }

  stopAllSounds() {
    console.log("⏹️ Stopping all sounds");
    this.sounds.forEach((audio, soundName) => {
      audio.pause();
      audio.currentTime = 0;
      this.updateButtonState(soundName, false);
    });
    this.currentActiveGroup = null;
    this.highlightActiveGroup(null);

    // Reset all playlist cards to stopped state
    document.querySelectorAll(".playlist-card").forEach((card) => {
      card.dataset.originalState = "stopped";
      card.classList.remove("playing");
    });
  }

  highlightActiveGroup(groupId) {
    document.querySelectorAll(".playlist-card").forEach((card) => {
      card.classList.remove("active");
    });

    if (groupId) {
      const activeCard = document.querySelector(`[data-group="${groupId}"]`);
      if (activeCard) {
        activeCard.classList.add("active");
        console.log(`⭐ Highlighted group ID: ${groupId}`);
      }
    }
  }

  setupClearButton() {
    const clearButton = document.querySelector(".action-button.clear");
    if (clearButton) {
      clearButton.addEventListener("click", () => {
        this.stopAllSounds();
      });
    }
  }

  setupGlobalVolumeControl() {
    const globalSlider = document.getElementById("global-volume");
    const globalIcon = document.getElementById("global-volume-icon");

    if (!globalSlider || !globalIcon) return;

    this.globalVolume = globalSlider.value / 100;

    globalSlider.addEventListener("input", (e) => {
      this.globalVolume = e.target.value / 100;
      this.updateAllVolumes();
      globalIcon.style.opacity = this.globalVolume === 0 ? "0.5" : "1";
    });

    globalIcon.addEventListener("click", () => {
      if (this.globalVolume > 0) {
        this.previousVolume = this.globalVolume;
        this.globalVolume = 0;
        globalSlider.value = 0;
      } else {
        this.globalVolume = this.previousVolume || 0.5;
        globalSlider.value = this.globalVolume * 100;
      }
      this.updateAllVolumes();
      globalIcon.style.opacity = this.globalVolume === 0 ? "0.5" : "1";
    });

    // Initialize slider thumb for global volume
    setTimeout(() => {
      this.initSliderThumbEffect();
    }, 100);
  }

  updateAllVolumes() {
    this.sounds.forEach((audio, soundName) => {
      const soundContainer = document.querySelector(
        `[data-sound-name="${soundName}"]`
      );
      if (!soundContainer) return;

      const volumeSlider = soundContainer.querySelector(".volume-slider");
      if (volumeSlider) {
        const individualVolume = volumeSlider.value / 100;
        audio.volume = individualVolume * this.globalVolume;
      }
    });
  }

  setupThemeToggle() {
    const themeToggle = document.getElementById("theme-toggle");
    if (!themeToggle) return;

    themeToggle.addEventListener("click", () => {
      const html = document.documentElement;
      const currentTheme = html.getAttribute("data-theme");
      const newTheme = currentTheme === "dark" ? "light" : "dark";
      html.setAttribute("data-theme", newTheme);
      localStorage.setItem("theme", newTheme);
    });

    const savedTheme = localStorage.getItem("theme");
    if (savedTheme) {
      document.documentElement.setAttribute("data-theme", savedTheme);
    }
  }

  setupUserMenu() {
    const userMenuButton = document.getElementById("user-menu-button");
    const userDropdown = document.getElementById("user-dropdown");

    if (!userMenuButton || !userDropdown) return;

    userMenuButton.addEventListener("click", (e) => {
      e.stopPropagation();
      userDropdown.classList.toggle("show");
    });

    document.addEventListener("click", (e) => {
      if (
        !userDropdown.contains(e.target) &&
        !userMenuButton.contains(e.target)
      ) {
        userDropdown.classList.remove("show");
      }
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") userDropdown.classList.remove("show");
    });
  }

  setupCarousel() {
    const scrollLeftBtn = document.getElementById("scroll-left");
    const scrollRightBtn = document.getElementById("scroll-right");
    const carousel = document.querySelector(".playlist-carousel");

    if (!scrollLeftBtn || !scrollRightBtn || !carousel) return;

    scrollLeftBtn.addEventListener("click", () => {
      carousel.scrollBy({ left: -300, behavior: "smooth" });
    });

    scrollRightBtn.addEventListener("click", () => {
      carousel.scrollBy({ left: 300, behavior: "smooth" });
    });
  }
}

// Toast message handling
function setupToasts() {
  const toasts = document.querySelectorAll(".toast");
  toasts.forEach((toast) => {
    const closeBtn = toast.querySelector(".toast-close");
    if (closeBtn) {
      closeBtn.addEventListener("click", () => {
        toast.remove();
      });
    }

    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(-10px)";
      setTimeout(() => toast.remove(), 300);
    }, 5000);
  });
}

// Initialize everything
document.addEventListener("DOMContentLoaded", () => {
  console.log("🚀 Calm Flow initializing...");
  window.soundManager = new SoundManager();
  setupToasts();
  console.log("🎉 Calm Flow ready!");
});
