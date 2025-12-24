// SoundManager Class
class SoundManager {
  constructor() {
    this.sounds = new Map();
    this.globalVolume = 0.5;
    this.currentActiveGroup = null;
    this.currentActivePlaylist = null;
    this.isUserLoggedIn = document.body.dataset.userLoggedIn === "true";
    this.currentSoundForPlaylist = null;
    this.userPlaylists = [];
    this.isPlaylistCreationMode = false; // Track playlist creation mode
    this.currentEditingPlaylistId = null; // Store playlist ID during multi-select
    this.selectedSounds = new Set(); // Store selected sound IDs for multi-select
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
      this.setupPlaylistModal();
      this.setupAddToPlaylistModal();
      this.loadUserPlaylists();

      // Setup Create Playlist button
      this.setupCreatePlaylistButton();

      console.log("✅ SoundManager initialized successfully");
    } catch (error) {
      console.error("❌ Error initializing SoundManager:", error);
    }
  }

  // Setup Create Playlist button
  setupCreatePlaylistButton() {
    const createPlaylistBtn = document.getElementById("create-playlist-btn");
    if (!createPlaylistBtn) return;

    createPlaylistBtn.addEventListener("click", async (e) => {
      e.preventDefault();

      // If in creation mode, handle Done click
      if (this.isPlaylistCreationMode) {
        if (this.selectedSounds.size === 0) {
          this.showToast("Select at least one sound before saving", "info");
          return;
        }

        // Add all selected sounds to playlist
        await this.addSelectedSoundsToPlaylist();
        return;
      }

      // Otherwise, open create playlist modal
      this.openCreatePlaylistModal();
    });
  }

  // Open create playlist modal
  openCreatePlaylistModal() {
    const modal = document.getElementById("create-playlist-modal");
    if (modal) {
      modal.classList.add("active");

      // Focus on the input field
      const playlistNameInput = document.getElementById("playlist-name");
      if (playlistNameInput) {
        playlistNameInput.focus();
      }
    }
  }

  // Initialize sounds from API data
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

  // Initialize individual sound
  initializeSound(button, soundInfo) {
    const soundContainer = button.closest(".sound-button-container");
    const soundName = soundInfo.name;

    const audio = new Audio(soundInfo.file_path);
    audio.loop = true;
    audio.volume = soundInfo.default_volume || 0.5;

    this.sounds.set(soundName, audio);

    button.addEventListener("click", () => {
      // Don't play sound if we're in multi-select mode
      if (
        this.isPlaylistCreationMode &&
        document.body.classList.contains("multi-select-mode")
      ) {
        return;
      }

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

  // FIXED: Setup playlist handlers with proper toggle functionality
  setupPlaylistHandlers() {
    const playlistCards = document.querySelectorAll(".playlist-card");
    console.log(`🎵 Found ${playlistCards.length} playlist cards`);

    playlistCards.forEach((card, index) => {
      const groupId = card.getAttribute("data-group");
      const playlistId = card.getAttribute("data-playlist-id");
      const groupName = card.querySelector(".playlist-title").textContent;
      console.log(
        `  ${index}: ${groupName} (ID: ${groupId || playlistId || "Random"})`
      );

      card.addEventListener("click", (e) => {
        // Don't trigger if clicking on menu button
        if (
          e.target.closest(".playlist-menu-btn") ||
          e.target.closest(".dropdown-menu")
        ) {
          return;
        }

        e.preventDefault();
        const groupId = card.getAttribute("data-group");
        const playlistId = card.getAttribute("data-playlist-id");
        const groupName = card.querySelector(".playlist-title").textContent;

        console.log(
          `🎯 Playlist clicked: ${groupName} (ID: ${groupId || playlistId})`
        );

        // FIXED: Proper toggle functionality - click to play, click again to stop
        if (card.classList.contains("playing")) {
          // Stop this specific playlist - second click
          this.stopPlaylist(card);
          console.log(`⏹️ Stopped ${groupName} playlist`);
        } else {
          // Stop any currently playing playlist first
          this.stopAllSounds();

          // Start the clicked playlist
          if (card.id === "random-playlist") {
            this.playRandomSounds();
          } else if (groupId) {
            this.playGroupSounds(parseInt(groupId), groupName);
          } else if (playlistId) {
            this.playUserPlaylist(parseInt(playlistId), groupName);
          }
          console.log(`▶️ Started ${groupName} playlist`);
        }
      });
    });
  }

  // NEW: Stop specific playlist
  stopPlaylist(card) {
    const groupId = card.getAttribute("data-group");
    const playlistId = card.getAttribute("data-playlist-id");

    if (card.id === "random-playlist") {
      // For random playlist, stop all sounds
      this.stopAllSounds();
    } else if (groupId) {
      // For group playlist, stop only sounds in that group
      this.stopGroupSounds(parseInt(groupId));
    } else if (playlistId) {
      // For user playlist, stop only sounds in that playlist
      this.stopUserPlaylist(parseInt(playlistId));
    }

    card.classList.remove("playing");
  }

  // NEW: Stop group sounds
  stopGroupSounds(groupId) {
    console.log(`⏹️ Stopping group ID: ${groupId}`);

    if (!this.allSoundsData) return;

    const groupSounds = this.allSoundsData.filter((sound) => {
      return sound.groups.includes(groupId);
    });

    groupSounds.forEach((sound) => {
      const audio = this.sounds.get(sound.name);
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
        this.updateButtonState(sound.name, false);

        // Hide volume control
        const soundContainer = document.querySelector(
          `[data-sound-name="${sound.name}"]`
        );
        if (soundContainer) {
          const volumeControl = soundContainer.querySelector(".volume-control");
          if (volumeControl) {
            volumeControl.classList.add("hidden");
          }
        }
      }
    });
  }

  // NEW: Stop user playlist sounds
  stopUserPlaylist(playlistId) {
    console.log(`⏹️ Stopping playlist ID: ${playlistId}`);

    // We need to fetch the playlist to know which sounds to stop
    fetch(`/api/playlists/${playlistId}`)
      .then((response) => response.json())
      .then((playlistData) => {
        playlistData.sounds.forEach((sound) => {
          const audio = this.sounds.get(sound.name);
          if (audio) {
            audio.pause();
            audio.currentTime = 0;
            this.updateButtonState(sound.name, false);

            // Hide volume control
            const soundContainer = document.querySelector(
              `[data-sound-name="${sound.name}"]`
            );
            if (soundContainer) {
              const volumeControl =
                soundContainer.querySelector(".volume-control");
              if (volumeControl) {
                volumeControl.classList.add("hidden");
              }
            }
          }
        });
      })
      .catch((error) => {
        console.error("Error stopping playlist:", error);
        // If we can't fetch the playlist, just stop all sounds
        this.stopAllSounds();
      });
  }

  async playUserPlaylist(playlistId, playlistName) {
    console.log(
      `▶️ Playing user playlist: ${playlistName} (ID: ${playlistId})`
    );

    try {
      const response = await fetch(`/api/playlists/${playlistId}`);
      if (!response.ok) {
        throw new Error(`Failed to load playlist: ${response.status}`);
      }

      const playlistData = await response.json();

      console.log(`📊 Found ${playlistData.sounds.length} sounds in playlist`);

      if (playlistData.sounds.length === 0) {
        console.warn(`⚠️ No sounds in playlist: ${playlistName}`);
        this.showToast(
          "This playlist is empty. Add some sounds first!",
          "info"
        );
        return;
      }

      let playedCount = 0;
      playlistData.sounds.forEach((sound) => {
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

                // Show volume control for each playing sound
                const soundContainer = document.querySelector(
                  `[data-sound-name="${sound.name}"]`
                );
                if (soundContainer) {
                  const volumeControl =
                    soundContainer.querySelector(".volume-control");
                  if (volumeControl) {
                    volumeControl.classList.remove("hidden");
                  }
                }
              })
              .catch((error) => {
                console.error(`   ❌ Error playing ${sound.name}:`, error);
              });
          }
        }
      });

      console.log(`✅ Attempted to play ${playedCount} sounds`);
      this.currentActivePlaylist = playlistId;

      // Add playing class to the playlist card
      const playlistCard = document.querySelector(
        `[data-playlist-id="${playlistId}"]`
      );
      if (playlistCard) {
        playlistCard.classList.add("playing");
      }
    } catch (error) {
      console.error("Error playing user playlist:", error);
      this.showToast("Error loading playlist", "error");
    }
  }

  playGroupSounds(groupId, groupName) {
    console.log(`▶️ Playing ${groupName} playlist (ID: ${groupId})`);

    if (!this.allSoundsData) {
      console.error("❌ No sound data available");
      return;
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

              // Show volume control for each playing sound
              const soundContainer = document.querySelector(
                `[data-sound-name="${sound.name}"]`
              );
              if (soundContainer) {
                const volumeControl =
                  soundContainer.querySelector(".volume-control");
                if (volumeControl) {
                  volumeControl.classList.remove("hidden");
                }
              }
            })
            .catch((error) => {
              console.error(`   ❌ Error playing ${sound.name}:`, error);
            });
        }
      }
    });

    console.log(`✅ Attempted to play ${playedCount} sounds`);
    this.currentActiveGroup = groupId;

    // Add playing class to the playlist card
    const playlistCard = document.querySelector(`[data-group="${groupId}"]`);
    if (playlistCard) {
      playlistCard.classList.add("playing");
    }
  }

  playRandomSounds() {
    console.log("🎲 Playing random sounds");

    if (!this.allSoundsData) {
      console.error("❌ No sound data available");
      return;
    }

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

              // Show volume control for each playing sound
              const soundContainer = document.querySelector(
                `[data-sound-name="${sound.name}"]`
              );
              if (soundContainer) {
                const volumeControl =
                  soundContainer.querySelector(".volume-control");
                if (volumeControl) {
                  volumeControl.classList.remove("hidden");
                }
              }
            })
            .catch((error) => {
              console.error(`   ❌ Error playing ${sound.name}:`, error);
            });
        }
      }
    });

    console.log(`✅ Attempted to play ${playedCount} random sounds`);
    this.currentActiveGroup = null;

    // Add playing class to the random playlist card
    const randomPlaylistCard = document.getElementById("random-playlist");
    if (randomPlaylistCard) {
      randomPlaylistCard.classList.add("playing");
    }
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

      // Hide volume control for all sounds
      const soundContainer = document.querySelector(
        `[data-sound-name="${soundName}"]`
      );
      if (soundContainer) {
        const volumeControl = soundContainer.querySelector(".volume-control");
        if (volumeControl) {
          volumeControl.classList.add("hidden");
        }
      }
    });
    this.currentActiveGroup = null;
    this.currentActivePlaylist = null;

    // Remove playing class from all playlist cards
    document.querySelectorAll(".playlist-card").forEach((card) => {
      card.classList.remove("playing");
    });
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

  // Load user's playlists
  async loadUserPlaylists() {
    const isLoggedIn = document.body.dataset.userLoggedIn === "true";
    if (!isLoggedIn) return;

    try {
      const response = await fetch("/api/playlists");
      if (!response.ok) {
        if (response.status === 401) {
          console.log("User not authenticated for playlists");
          return;
        }
        throw new Error(`Failed to load playlists: ${response.status}`);
      }

      const data = await response.json();
      this.userPlaylists = data.playlists || [];
      this.renderUserPlaylists();
      console.log(`📋 Loaded ${this.userPlaylists.length} user playlists`);
    } catch (error) {
      console.error("❌ Error loading user playlists:", error);
    }
  }

  // Render user playlists in the carousel
  renderUserPlaylists() {
    const playlistGrid = document.getElementById("playlist-grid");
    if (!playlistGrid) return;

    // Remove existing user playlists
    const existingUserPlaylists =
      playlistGrid.querySelectorAll("[data-playlist-id]");
    existingUserPlaylists.forEach((el) => el.remove());

    // Sort user playlists to show newest first (assuming IDs increment)
    const sortedPlaylists = [...this.userPlaylists].sort((a, b) => b.id - a.id);

    // Add user playlists to the grid FIRST
    sortedPlaylists.forEach((playlist) => {
      const playlistCard = this.createPlaylistCard(playlist);
      // Insert at the beginning of the grid
      playlistGrid.prepend(playlistCard);
    });

    // Reinitialize playlist handlers
    this.setupPlaylistHandlers();
  }

  // Create playlist card with menu dots
  createPlaylistCard(playlist) {
    const card = document.createElement("a");
    card.href = "#";
    card.className = "playlist-card";
    card.dataset.playlistId = playlist.id;
    card.dataset.playlistType = "user";

    // Extract icon path
    let iconPath = playlist.icon;
    if (iconPath.includes("static/")) {
      iconPath = iconPath.split("static/")[1];
    }

    card.innerHTML = `
      <div class="playlist-icon">
        <img src="/static/${iconPath}" alt="${playlist.name} Icon" class="icon-img">
      </div>
      <h3 class="playlist-title">${playlist.name}</h3>
      <div class="playlist-menu">
        <button class="playlist-menu-btn" title="Playlist options">
          ⋮
        </button>
        <div class="dropdown-menu">
          <button class="dropdown-item edit-playlist-btn" data-playlist-id="${playlist.id}">
            Edit
          </button>
          <button class="dropdown-item delete-playlist-btn" data-playlist-id="${playlist.id}" data-playlist-name="${playlist.name}">
            Delete
          </button>
        </div>
      </div>
    `;

    // Add menu button event
    const menuBtn = card.querySelector(".playlist-menu-btn");
    const dropdownMenu = card.querySelector(".dropdown-menu");

    menuBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropdownMenu.classList.toggle("show");

      // Close other dropdowns
      document.querySelectorAll(".dropdown-menu.show").forEach((otherMenu) => {
        if (otherMenu !== dropdownMenu) {
          otherMenu.classList.remove("show");
        }
      });
    });

    // Close dropdown when clicking elsewhere
    document.addEventListener("click", (e) => {
      if (!dropdownMenu.contains(e.target) && !menuBtn.contains(e.target)) {
        dropdownMenu.classList.remove("show");
      }
    });

    // Add delete button event
    const deleteBtn = card.querySelector(".delete-playlist-btn");
    deleteBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropdownMenu.classList.remove("show");
      const playlistId = deleteBtn.getAttribute("data-playlist-id");
      const playlistName = deleteBtn.getAttribute("data-playlist-name");
      this.deletePlaylist(parseInt(playlistId), playlistName);
    });

    // Add edit button event
    const editBtn = card.querySelector(".edit-playlist-btn");
    editBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropdownMenu.classList.remove("show");
      this.showToast("Edit feature coming soon!", "info");
    });

    return card;
  }

  // MODIFIED: Setup playlist creation modal - REMOVED ICON SELECTION, RANDOMIZE ICON
  setupPlaylistModal() {
    const modal = document.getElementById("create-playlist-modal");
    const closeBtn = modal?.querySelector(".close-button");
    const form = document.getElementById("create-playlist-form");

    if (!modal) return;

    closeBtn.addEventListener("click", () => {
      modal.classList.remove("active");
      // Reset form
      form.reset();
    });

    // Close modal when clicking outside
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        modal.classList.remove("active");
        // Reset form
        form.reset();
      }
    });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const formData = new FormData(form);
      const name = formData.get("playlist_name");

      if (!name.trim()) {
        this.showToast("Please enter a playlist name", "error");
        return;
      }

      // Randomize icon selection from available icons
      const availableIcons = [
        "rain.png",
        "forest.png",
        "wave.png",
        "fire.png",
        "wind.png",
        "random.png",
      ];
      const randomIcon =
        availableIcons[Math.floor(Math.random() * availableIcons.length)];

      try {
        const response = await fetch("/api/playlists/create", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: name,
            icon: `static/icons/${randomIcon}`,
          }),
        });

        const data = await response.json();

        if (response.ok) {
          this.showToast(
            `Playlist created with ${
              randomIcon.split(".")[0]
            } icon! Now select sounds to add.`,
            "success"
          );

          // Clear form
          form.reset();

          // Close modal
          modal.classList.remove("active");

          // Get the new playlist ID
          const newPlaylistId = data.playlist.id;

          // Start multi-select mode for this playlist
          this.startMultiSelectMode(newPlaylistId);
        } else {
          this.showToast(data.error || "Failed to create playlist", "error");
        }
      } catch (error) {
        console.error("Error creating playlist:", error);
        this.showToast("Error creating playlist", "error");
      }
    });
  }

  // Setup "Add to Playlist" modal
  setupAddToPlaylistModal() {
    const modal = document.getElementById("add-to-playlist-modal");
    const closeBtn = modal?.querySelector(".close-button");

    if (!modal) return;

    // Close modal when clicking outside
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        modal.classList.remove("active");
        this.currentSoundForPlaylist = null;
      }
    });

    closeBtn.addEventListener("click", () => {
      modal.classList.remove("active");
      this.currentSoundForPlaylist = null;
    });

    // Handle add to playlist button clicks
    document.addEventListener("click", (e) => {
      if (e.target.closest(".add-to-playlist-btn")) {
        e.preventDefault();
        e.stopPropagation();

        // Check if we're in playlist creation mode
        if (!this.isPlaylistCreationMode) {
          this.showToast(
            'Click "Create Playlist" button first to enter creation mode',
            "info"
          );
          return;
        }

        const soundContainer = e.target.closest(".sound-button-container");
        if (soundContainer) {
          const soundId = soundContainer.getAttribute("data-sound-id");
          const soundName = soundContainer.getAttribute("data-sound-name");

          this.currentSoundForPlaylist = {
            id: parseInt(soundId),
            name: soundName,
          };

          this.openAddToPlaylistModal();
        }
      }
    });
  }

  async openAddToPlaylistModal() {
    const modal = document.getElementById("add-to-playlist-modal");
    const playlistsList = document.getElementById("user-playlists-list");

    if (!modal || !playlistsList) return;

    // Show loading
    playlistsList.innerHTML = "<p>Loading playlists...</p>";

    try {
      const response = await fetch("/api/playlists");
      if (!response.ok) throw new Error("Failed to load playlists");

      const data = await response.json();
      const playlists = data.playlists || [];

      if (playlists.length === 0) {
        playlistsList.innerHTML = `
          <div class="empty-playlist-message">
            <p>No playlists yet!</p>
            <button class="action-button create-new-playlist-btn" style="margin-top: 1rem;">
              Create New Playlist
            </button>
          </div>
        `;

        // Add event listener to create new playlist button
        const createNewBtn = playlistsList.querySelector(
          ".create-new-playlist-btn"
        );
        if (createNewBtn) {
          createNewBtn.addEventListener("click", () => {
            modal.classList.remove("active");
            this.openCreatePlaylistModal();
          });
        }
      } else {
        playlistsList.innerHTML = playlists
          .map(
            (playlist) => `
          <div class="playlist-item" data-playlist-id="${playlist.id}">
            <div class="playlist-item-info">
              <img src="/static/${
                playlist.icon.split("static/")[1] || playlist.icon
              }" 
                   alt="${playlist.name}" width="20" height="20">
              <span>${playlist.name}</span>
              <span class="sound-count">(${
                playlist.sound_count || 0
              } sounds)</span>
            </div>
            <button class="action-button add-sound-btn" 
                    data-playlist-id="${playlist.id}"
                    data-playlist-name="${playlist.name}">
              Add
            </button>
          </div>
        `
          )
          .join("");

        // Add event listeners to add buttons
        playlistsList.querySelectorAll(".add-sound-btn").forEach((btn) => {
          btn.addEventListener("click", async (e) => {
            const playlistId = btn.getAttribute("data-playlist-id");
            const playlistName = btn.getAttribute("data-playlist-name");

            await this.addSoundToPlaylist(parseInt(playlistId), playlistName);
          });
        });
      }

      modal.classList.add("active");
    } catch (error) {
      console.error("Error loading playlists:", error);
      playlistsList.innerHTML = `
        <p class="empty-playlist">Error loading playlists. Please try again.</p>
      `;
    }
  }

  async addSoundToPlaylist(playlistId, playlistName) {
    if (!this.currentSoundForPlaylist) return;

    try {
      const response = await fetch(`/api/playlists/${playlistId}/add-sound`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sound_id: this.currentSoundForPlaylist.id,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        this.showToast(data.message || "Sound added to playlist!", "success");

        // Close modal
        document
          .getElementById("add-to-playlist-modal")
          .classList.remove("active");
        this.currentSoundForPlaylist = null;

        // Exit playlist creation mode after successful addition
        this.exitPlaylistCreationMode();
      } else {
        this.showToast(
          data.error || "Failed to add sound to playlist",
          "error"
        );
      }
    } catch (error) {
      console.error("Error adding sound to playlist:", error);
      this.showToast("Error adding sound to playlist", "error");
    }
  }

  async deletePlaylist(playlistId, playlistName) {
    if (!confirm(`Are you sure you want to delete "${playlistName}"?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/playlists/${playlistId}/delete`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (response.ok) {
        this.showToast(
          data.message || "Playlist deleted successfully!",
          "success"
        );

        // If this playlist was playing, stop it
        if (this.currentActivePlaylist === playlistId) {
          this.stopAllSounds();
        }

        // Reload playlists
        await this.loadUserPlaylists();
      } else {
        this.showToast(data.error || "Failed to delete playlist", "error");
      }
    } catch (error) {
      console.error("Error deleting playlist:", error);
      this.showToast("Error deleting playlist", "error");
    }
  }

  // Start multi-select mode
  startMultiSelectMode(playlistId) {
    this.isPlaylistCreationMode = true;
    this.currentEditingPlaylistId = playlistId;
    this.selectedSounds.clear(); // Clear any previous selections

    const createPlaylistBtn = document.getElementById("create-playlist-btn");
    const body = document.body;

    // Update button to show "Done"
    if (createPlaylistBtn) {
      createPlaylistBtn.classList.add("active");
      createPlaylistBtn.textContent = "Done";
    }

    body.classList.add("playlist-creation-mode");
    body.classList.add("multi-select-mode");

    // Show selection indicators on all sound cards
    this.showSelectionIndicators();

    // Update instructions
    this.showSelectionInstructions();
  }

  // Show selection indicators (checkboxes)
  showSelectionIndicators() {
    const soundContainers = document.querySelectorAll(
      ".sound-button-container:not(.premium)"
    );

    soundContainers.forEach((container) => {
      // Remove any existing selection indicator
      const existingIndicator = container.querySelector(".selection-indicator");
      if (existingIndicator) existingIndicator.remove();

      // Remove existing add-to-playlist button if present
      const existingAddBtn = container.querySelector(".add-to-playlist-btn");
      if (existingAddBtn) existingAddBtn.remove();

      // Create selection indicator (checkbox)
      const indicator = document.createElement("div");
      indicator.className = "selection-indicator";
      indicator.innerHTML = `
        <div class="selection-checkbox">
          <div class="checkmark">✓</div>
        </div>
      `;

      // Add click handler for selection
      indicator.addEventListener("click", (e) => {
        e.stopPropagation();
        const soundId = container.getAttribute("data-sound-id");
        this.toggleSoundSelection(soundId, container);
      });

      container.appendChild(indicator);
      container.style.cursor = "pointer";
    });
  }

  // Toggle sound selection
  toggleSoundSelection(soundId, container) {
    if (this.selectedSounds.has(soundId)) {
      // Deselect
      this.selectedSounds.delete(soundId);
      container.classList.remove("selected");
      console.log(`➖ Deselected sound: ${soundId}`);
    } else {
      // Select
      this.selectedSounds.add(soundId);
      container.classList.add("selected");
      console.log(`➕ Selected sound: ${soundId}`);
    }

    // Update selection count display
    this.updateSelectionCount();
  }

  // Update selection count display
  updateSelectionCount() {
    const createPlaylistBtn = document.getElementById("create-playlist-btn");
    if (createPlaylistBtn) {
      const count = this.selectedSounds.size;
      if (count > 0) {
        createPlaylistBtn.textContent = `Done (${count} selected)`;
      } else {
        createPlaylistBtn.textContent = "Done";
      }
    }
  }

  // Show selection instructions
  showSelectionInstructions() {
    // Remove any existing instruction toast
    const existingToast = document.querySelector(".toast-instruction");
    if (existingToast) existingToast.remove();

    // Create instruction toast
    const toastContainer = document.querySelector(".toast-container");
    if (!toastContainer) return;

    const instruction = document.createElement("div");
    instruction.className = "toast toast-info toast-instruction";
    instruction.innerHTML = `
      <p class="toast-message">Click sound icons to select multiple sounds. Click "Done" when finished.</p>
      <button class="toast-close">&times;</button>
    `;

    toastContainer.appendChild(instruction);

    // Add close button functionality
    const closeBtn = instruction.querySelector(".toast-close");
    closeBtn.addEventListener("click", () => {
      instruction.style.opacity = "0";
      instruction.style.transform = "translateY(-10px)";
      setTimeout(() => instruction.remove(), 300);
    });

    // Auto-remove after 8 seconds
    setTimeout(() => {
      instruction.style.opacity = "0";
      instruction.style.transform = "translateY(-10px)";
      setTimeout(() => instruction.remove(), 300);
    }, 8000);
  }

  // Add all selected sounds to playlist
  async addSelectedSoundsToPlaylist() {
    if (!this.currentEditingPlaylistId || this.selectedSounds.size === 0) {
      return;
    }

    try {
      this.showToast(
        `Adding ${this.selectedSounds.size} sounds to playlist...`,
        "info"
      );

      let addedCount = 0;
      let errorCount = 0;

      // Add each selected sound
      for (const soundId of this.selectedSounds) {
        try {
          const response = await fetch(
            `/api/playlists/${this.currentEditingPlaylistId}/add-sound`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                sound_id: parseInt(soundId),
              }),
            }
          );

          const data = await response.json();

          if (response.ok) {
            addedCount++;
          } else {
            if (!data.error.includes("already in playlist")) {
              errorCount++;
            }
          }
        } catch (error) {
          errorCount++;
          console.error("Error adding sound:", error);
        }
      }

      // Exit creation mode
      this.exitPlaylistCreationMode();

      // Show result
      if (errorCount === 0) {
        this.showToast(`Added ${addedCount} sounds to playlist!`, "success");
      } else {
        this.showToast(
          `Added ${addedCount} sounds (${errorCount} errors)`,
          "warning"
        );
      }
    } catch (error) {
      console.error("Error adding sounds to playlist:", error);
      this.showToast("Error adding sounds to playlist", "error");
    }
  }

  // Exit playlist creation mode
  exitPlaylistCreationMode() {
    this.isPlaylistCreationMode = false;
    this.currentEditingPlaylistId = null;
    this.currentSoundForPlaylist = null;
    this.selectedSounds.clear();

    const createPlaylistBtn = document.getElementById("create-playlist-btn");
    const body = document.body;

    if (createPlaylistBtn) {
      createPlaylistBtn.classList.remove("active");
      createPlaylistBtn.textContent = "Create Playlist";
    }

    body.classList.remove("playlist-creation-mode");
    body.classList.remove("multi-select-mode");

    // Remove selection indicators
    this.removeSelectionIndicators();

    // Remove any instruction toast
    const instructionToast = document.querySelector(".toast-instruction");
    if (instructionToast) instructionToast.remove();

    console.log("🎵 Exited playlist creation mode");
  }

  // Remove selection indicators
  removeSelectionIndicators() {
    const indicators = document.querySelectorAll(".selection-indicator");
    indicators.forEach((indicator) => indicator.remove());

    // Remove selected class
    const selectedContainers = document.querySelectorAll(
      ".sound-button-container.selected"
    );
    selectedContainers.forEach((container) => {
      container.classList.remove("selected");
      container.style.cursor = "";
    });
  }

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

    console.log("🎛️ Slider thumb effect initialized");
  }

  showToast(message, type = "info") {
    const toastContainer = document.querySelector(".toast-container");
    if (!toastContainer) return;

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <p class="toast-message">${message}</p>
      <button class="toast-close">&times;</button>
    `;

    toastContainer.appendChild(toast);

    // Add close button functionality
    const closeBtn = toast.querySelector(".toast-close");
    closeBtn.addEventListener("click", () => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(-10px)";
      setTimeout(() => toast.remove(), 300);
    });

    // Auto-remove after 5 seconds
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(-10px)";
      setTimeout(() => toast.remove(), 300);
    }, 5000);
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
