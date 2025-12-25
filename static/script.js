// SoundManager Class - FIXED PLAYLIST CREATION FLOW
class SoundManager {
  constructor() {
    this.disableTrackpadNavigation();
    this.sounds = new Map();
    this.globalVolume = 0.5;
    this.currentActiveGroup = null;
    this.currentActivePlaylist = null;
    this.isUserLoggedIn = document.body.dataset.userLoggedIn === "true";
    this.currentSoundForPlaylist = null;
    this.userPlaylists = [];
    this.isPlaylistCreationMode = false;
    this.currentEditingPlaylistId = null;
    this.selectedSounds = new Set();

    // For the NEW playlist creation flow
    this.pendingPlaylistName = null;
    this.isNamingPlaylistMode = false;

    // Custom icons for playlist creation
    this.playlistIcons = [
      "feather.png",
      "headphones.png",
      "lemon.png",
      "night_and_cloud.png",
      "periwinkle.png",
    ];

    // For delete confirmation modal
    this.pendingDeletePlaylistId = null;
    this.pendingDeletePlaylistName = null;

    // Store references to all playlist event handlers for cleanup
    this.playlistHandlers = new Map();

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
      this.setupDeleteConfirmationModal();

      this.loadUserPlaylists();
      this.setupCreatePlaylistButton();

      console.log("✅ SoundManager initialized successfully");

      // Auto-scroll to show user playlists
      setTimeout(() => {
        this.scrollToFirstUserPlaylist();
      }, 800);
    } catch (error) {
      console.error("❌ Error initializing SoundManager:", error);
    }
  }

  // ==============================
  // FIXED PLAYLIST CREATION FLOW
  // ==============================

  setupCreatePlaylistButton() {
    const createPlaylistBtn = document.getElementById("create-playlist-btn");
    if (!createPlaylistBtn) return;

    // Check if user is logged in
    if (!this.isUserLoggedIn) {
      // User is NOT logged in - disable button and show tooltip
      createPlaylistBtn.disabled = true;
      createPlaylistBtn.classList.add("disabled");
      createPlaylistBtn.title = "Login to create playlists";

      // Show login message when clicked
      createPlaylistBtn.addEventListener("click", (e) => {
        e.preventDefault();
        this.showToast("Please login to create playlists", "info");
      });
      return;
    }

    // User IS logged in - add the full functionality
    createPlaylistBtn.addEventListener("click", async (e) => {
      e.preventDefault();

      if (this.isPlaylistCreationMode) {
        // In creation mode - trying to save
        await this.savePlaylistWithSounds();
        return;
      }

      if (this.isNamingPlaylistMode) {
        // Currently naming playlist - show error
        this.showToast("Please finish creating the playlist first", "info");
        return;
      }

      // Start new playlist creation
      this.startPlaylistCreation();
    });
  }

  startPlaylistCreation() {
    console.log("🎯 Starting new playlist creation flow");

    this.isNamingPlaylistMode = true;
    this.pendingPlaylistName = null;
    this.selectedSounds.clear();

    const createPlaylistBtn = document.getElementById("create-playlist-btn");
    if (createPlaylistBtn) {
      createPlaylistBtn.classList.add("active");
      createPlaylistBtn.textContent = "Save Playlist";
      createPlaylistBtn.disabled = true; // Disabled until name entered
      createPlaylistBtn.style.opacity = "1"; // Reset opacity
      createPlaylistBtn.style.cursor = "pointer"; // Reset cursor
    }

    this.showNamePlaylistModal();
  }

  showNamePlaylistModal() {
    // Create modal for naming playlist
    const modalHTML = `
      <div id="name-playlist-modal" class="modal active">
        <div class="modal-content">
          <button class="close-button" id="close-name-modal">&times;</button>
          <h2>Name Your Playlist</h2>
          
          <div class="form-group" style="margin-top: 1.5rem;">
            <label for="new-playlist-name">
              Playlist Name 
              <span id="char-count" style="float: right; font-size: 0.9rem; opacity: 0.7;">0/15</span>
            </label>
            <input 
              type="text" 
              id="new-playlist-name" 
              placeholder="Enter playlist name (max 15 characters)"
              maxlength="15"
              autofocus
            >
          </div>
          
          <div style="margin-top: 2rem; display: flex; justify-content: center;">
            <button id="confirm-name-btn" class="action-button" style="width: 200px;" disabled>
              Confirm
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML("beforeend", modalHTML);

    const modal = document.getElementById("name-playlist-modal");
    const closeBtn = document.getElementById("close-name-modal");
    const confirmBtn = document.getElementById("confirm-name-btn");
    const nameInput = document.getElementById("new-playlist-name");
    const charCount = document.getElementById("char-count");

    // Update character count
    const updateCharCount = () => {
      const currentLength = nameInput.value.length;
      const maxLength = 15;
      charCount.textContent = `${currentLength}/${maxLength}`;

      // Change color when approaching limit
      if (currentLength >= maxLength - 2) {
        charCount.style.color = "#dc3545";
        charCount.style.fontWeight = "bold";
      } else if (currentLength >= maxLength - 5) {
        charCount.style.color = "#ffc107";
        charCount.style.fontWeight = "bold";
      } else {
        charCount.style.color = "";
        charCount.style.fontWeight = "";
      }

      // Enable/disable confirm button
      confirmBtn.disabled = currentLength === 0;
      if (confirmBtn.disabled) {
        confirmBtn.style.opacity = "0.5";
        confirmBtn.style.cursor = "not-allowed";
      } else {
        confirmBtn.style.opacity = "1";
        confirmBtn.style.cursor = "pointer";
      }
    };

    // Close modal handlers
    const closeModal = () => {
      modal.remove();
      this.isNamingPlaylistMode = false;
      this.pendingPlaylistName = null;

      const createPlaylistBtn = document.getElementById("create-playlist-btn");
      if (createPlaylistBtn) {
        createPlaylistBtn.classList.remove("active");
        createPlaylistBtn.textContent = "Create Playlist";
        createPlaylistBtn.disabled = false;
        createPlaylistBtn.style.opacity = "1";
        createPlaylistBtn.style.cursor = "pointer";
      }
    };

    closeBtn.addEventListener("click", closeModal);

    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        closeModal();
      }
    });

    // Name input validation
    nameInput.addEventListener("input", updateCharCount);

    nameInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter" && nameInput.value.trim().length > 0) {
        confirmBtn.click();
      }
    });

    // Initial update
    updateCharCount();

    // Confirm name button
    confirmBtn.addEventListener("click", () => {
      const playlistName = nameInput.value.trim();
      if (playlistName.length === 0) {
        this.showToast("Please enter a playlist name", "error");
        return;
      }

      if (playlistName.length > 15) {
        this.showToast("Playlist name must be 15 characters or less", "error");
        return;
      }

      this.pendingPlaylistName = playlistName;
      modal.remove();
      this.isNamingPlaylistMode = false;

      // Now enter multi-select mode for sounds
      this.enterSoundSelectionMode();
    });
  }

  enterSoundSelectionMode() {
    console.log(
      "🎯 Entering sound selection mode for playlist:",
      this.pendingPlaylistName
    );

    this.isPlaylistCreationMode = true;
    this.selectedSounds.clear();

    const createPlaylistBtn = document.getElementById("create-playlist-btn");
    const body = document.body;

    if (createPlaylistBtn) {
      createPlaylistBtn.classList.add("active");
      createPlaylistBtn.textContent = `Save "${this.pendingPlaylistName}"`;
      createPlaylistBtn.disabled = true; // Disabled until at least 1 sound selected
      createPlaylistBtn.style.opacity = "0.5"; // Grayed out
      createPlaylistBtn.style.cursor = "not-allowed"; // Not allowed cursor
    }

    body.classList.add("playlist-creation-mode");
    body.classList.add("multi-select-mode");

    this.showSelectionIndicators();
    this.showSelectionInstructions();
    this.showMinimumSelectionWarning();
  }

  showMinimumSelectionWarning() {
    const existingWarning = document.querySelector(".toast-minimum-selection");
    if (existingWarning) existingWarning.remove();

    const toastContainer = document.querySelector(".toast-container");
    if (!toastContainer) return;

    const warning = document.createElement("div");
    warning.className = "toast toast-warning toast-minimum-selection";
    warning.innerHTML = `
      <p class="toast-message">Select at least 1 sound before saving. Currently selected: <span id="current-selection-count">0</span>/1</p>
      <button class="toast-close">&times;</button>
    `;

    toastContainer.appendChild(warning);

    const closeBtn = warning.querySelector(".toast-close");
    closeBtn.addEventListener("click", () => {
      warning.style.opacity = "0";
      warning.style.transform = "translateY(-10px)";
      setTimeout(() => warning.remove(), 300);
    });

    // Auto-remove after 15 seconds
    setTimeout(() => {
      if (warning.parentNode) {
        warning.style.opacity = "0";
        warning.style.transform = "translateY(-10px)";
        setTimeout(() => warning.remove(), 300);
      }
    }, 15000);
  }

  toggleSoundSelection(soundId, container) {
    const wasSelected = this.selectedSounds.has(soundId);

    if (wasSelected) {
      this.selectedSounds.delete(soundId);
      container.classList.remove("selected");
      console.log(`➖ Deselected sound: ${soundId}`);
    } else {
      this.selectedSounds.add(soundId);
      container.classList.add("selected");
      console.log(`➕ Selected sound: ${soundId}`);
    }

    this.updateSelectionCount();
    this.updateSelectionWarning();
  }

  updateSelectionWarning() {
    const warningToast = document.querySelector(".toast-minimum-selection");
    if (warningToast) {
      const countSpan = warningToast.querySelector("#current-selection-count");
      if (countSpan) {
        countSpan.textContent = this.selectedSounds.size;

        // Change color based on count
        if (this.selectedSounds.size >= 1) {
          countSpan.style.color = "#28a745"; // Green when enough
          countSpan.style.fontWeight = "bold";
        } else {
          countSpan.style.color = "#dc3545"; // Red when not enough
          countSpan.style.fontWeight = "bold";
        }
      }
    }
  }

  updateSelectionCount() {
    const createPlaylistBtn = document.getElementById("create-playlist-btn");
    if (createPlaylistBtn && this.pendingPlaylistName) {
      const count = this.selectedSounds.size;

      if (count > 0) {
        createPlaylistBtn.textContent = `Save "${this.pendingPlaylistName}" (${count} sounds)`;
        createPlaylistBtn.disabled = false; // Enable button when at least 1 sound
        createPlaylistBtn.style.opacity = "1"; // Full opacity
        createPlaylistBtn.style.cursor = "pointer"; // Pointer cursor
      } else {
        createPlaylistBtn.textContent = `Save "${this.pendingPlaylistName}"`;
        createPlaylistBtn.disabled = true; // Disable button when no sounds
        createPlaylistBtn.style.opacity = "0.5"; // Grayed out
        createPlaylistBtn.style.cursor = "not-allowed"; // Not allowed cursor
      }
    }
  }

  async savePlaylistWithSounds() {
    // ✅ FINAL VALIDATION - NO EMPTY PLAYLISTS
    if (!this.pendingPlaylistName) {
      this.showToast("Please enter a playlist name first", "error");
      return;
    }

    if (this.selectedSounds.size === 0) {
      this.showEnhancedEmptyPlaylistWarning();
      return;
    }

    console.log(
      `🎯 Saving playlist "${this.pendingPlaylistName}" with ${this.selectedSounds.size} sounds`
    );

    try {
      // Get a random icon from our custom playlist icons
      const randomIcon =
        this.playlistIcons[
          Math.floor(Math.random() * this.playlistIcons.length)
        ];

      // 1. First, create the playlist
      const playlistId = await this.createPlaylistOnServer(
        this.pendingPlaylistName,
        randomIcon
      );

      if (!playlistId) {
        throw new Error("Failed to create playlist");
      }

      // 2. Then, add all selected sounds to it
      const addedCount = await this.addSoundsToPlaylist(
        playlistId,
        Array.from(this.selectedSounds)
      );

      // 3. Show success and clean up
      this.showToast(
        `✅ Playlist "${this.pendingPlaylistName}" created with ${addedCount} sounds!`,
        "success"
      );
      this.exitPlaylistCreationMode();

      // 4. Refresh the playlists list
      await this.loadUserPlaylists();

      setTimeout(() => this.scrollToFirstUserPlaylist(), 300);
    } catch (error) {
      console.error("❌ Error saving playlist:", error);
      this.showToast("Error creating playlist", "error");
      this.exitPlaylistCreationMode();
    }
  }

  async createPlaylistOnServer(playlistName, icon) {
    try {
      const response = await fetch("/api/playlists/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: playlistName,
          icon: `static/icons/${icon}`,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        const playlistId = data.playlist_id || data.playlist?.id;
        console.log(
          `✅ Created playlist "${playlistName}" with ID: ${playlistId}`
        );
        return playlistId;
      } else {
        throw new Error(data.error || "Failed to create playlist");
      }
    } catch (error) {
      console.error("❌ Error creating playlist:", error);
      throw error;
    }
  }

  async addSoundsToPlaylist(playlistId, soundIds) {
    let addedCount = 0;
    let errorCount = 0;

    // Show loading state
    const createPlaylistBtn = document.getElementById("create-playlist-btn");
    if (createPlaylistBtn) {
      createPlaylistBtn.textContent = "Adding sounds...";
      createPlaylistBtn.disabled = true;
      createPlaylistBtn.style.opacity = "0.5";
      createPlaylistBtn.style.cursor = "not-allowed";
    }

    for (const soundId of soundIds) {
      try {
        const response = await fetch(`/api/playlists/${playlistId}/add-sound`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sound_id: parseInt(soundId),
          }),
        });

        const data = await response.json();

        if (response.ok) {
          addedCount++;
        } else {
          if (!data.error.includes("already in playlist")) {
            errorCount++;
            console.error(`❌ Error adding sound ${soundId}:`, data.error);
          }
        }
      } catch (error) {
        errorCount++;
        console.error("Error adding sound:", error);
      }
    }

    console.log(
      `✅ Added ${addedCount} sounds to playlist ${playlistId} (${errorCount} errors)`
    );
    return addedCount;
  }

  showEnhancedEmptyPlaylistWarning() {
    // Remove any existing warnings
    const existingWarning = document.querySelector(".toast-empty-playlist");
    if (existingWarning) existingWarning.remove();

    const toastContainer = document.querySelector(".toast-container");
    if (!toastContainer) return;

    const warning = document.createElement("div");
    warning.className = "toast toast-error toast-empty-playlist";
    warning.innerHTML = `
      <div style="display: flex; align-items: center; gap: 10px;">
        <span style="font-size: 1.2rem;">⚠️</span>
        <div>
          <p class="toast-message" style="font-weight: bold; margin-bottom: 4px;">
            Cannot save empty playlist!
          </p>
          <p class="toast-message" style="font-size: 0.9rem; opacity: 0.9;">
            You must select at least 1 sound before saving.
            Click on sound icons to select them.
          </p>
        </div>
      </div>
      <button class="toast-close">&times;</button>
    `;

    toastContainer.appendChild(warning);

    // Add a pulsing animation to sound containers
    this.pulseSoundContainers();

    const closeBtn = warning.querySelector(".toast-close");
    closeBtn.addEventListener("click", () => {
      warning.remove();
      this.stopPulseSoundContainers();
    });

    // Auto-remove after 8 seconds
    setTimeout(() => {
      if (warning.parentNode) {
        warning.remove();
        this.stopPulseSoundContainers();
      }
    }, 8000);
  }

  pulseSoundContainers() {
    const soundContainers = document.querySelectorAll(
      ".sound-button-container:not(.premium)"
    );

    soundContainers.forEach((container) => {
      container.style.animation = "pulse-guide 2s infinite";
    });

    // Add the animation to CSS
    if (!document.querySelector("#pulse-animation-style")) {
      const style = document.createElement("style");
      style.id = "pulse-animation-style";
      style.textContent = `
        @keyframes pulse-guide {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); box-shadow: 0 0 15px rgba(0, 123, 255, 0.5); }
        }
      `;
      document.head.appendChild(style);
    }
  }

  stopPulseSoundContainers() {
    const soundContainers = document.querySelectorAll(
      ".sound-button-container:not(.premium)"
    );

    soundContainers.forEach((container) => {
      container.style.animation = "";
    });
  }

  exitPlaylistCreationMode() {
    this.isPlaylistCreationMode = false;
    this.isNamingPlaylistMode = false;
    this.pendingPlaylistName = null;
    this.selectedSounds.clear();

    const createPlaylistBtn = document.getElementById("create-playlist-btn");
    const body = document.body;

    if (createPlaylistBtn) {
      createPlaylistBtn.classList.remove("active");
      createPlaylistBtn.textContent = "Create Playlist";
      createPlaylistBtn.disabled = false;
      createPlaylistBtn.style.opacity = "1";
      createPlaylistBtn.style.cursor = "pointer";
    }

    body.classList.remove("playlist-creation-mode");
    body.classList.remove("multi-select-mode");

    this.removeSelectionIndicators();

    // Remove all related toasts
    const instructionToast = document.querySelector(".toast-instruction");
    if (instructionToast) instructionToast.remove();

    const warningToast = document.querySelector(".toast-minimum-selection");
    if (warningToast) warningToast.remove();

    const emptyToast = document.querySelector(".toast-empty-playlist");
    if (emptyToast) emptyToast.remove();

    this.stopPulseSoundContainers();

    console.log("🎵 Exited playlist creation mode");
  }

  // ==============================
  // OLD PLAYLIST MODAL (FOR EDITING EXISTING PLAYLISTS)
  // ==============================

  setupPlaylistModal() {
    const modal = document.getElementById("create-playlist-modal");
    const closeBtn = modal?.querySelector(".close-button");
    const form = document.getElementById("create-playlist-form");

    if (!modal || !form) {
      console.error("❌ Create playlist modal elements not found");
      return;
    }

    closeBtn.addEventListener("click", () => {
      modal.classList.remove("active");
    });

    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        modal.classList.remove("active");
      }
    });

    // This is now for EDITING existing playlists only
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const playlistName = document
        .getElementById("playlist-name")
        .value.trim();
      if (!playlistName) {
        this.showToast("Please enter a playlist name", "error");
        return;
      }

      // For editing - you would need to update existing playlist
      this.showToast("Edit playlist feature coming soon!", "info");
      modal.classList.remove("active");
    });
  }

  // ==============================
  // EXISTING METHODS (unchanged)
  // ==============================

  setupDeleteConfirmationModal() {
    const modal = document.getElementById("delete-confirmation-modal");

    if (!modal) {
      console.error("❌ Delete modal not found!");
      return;
    }

    console.log("🔧 Setting up delete confirmation modal...");

    // Get ALL close methods
    const closeBtn = modal.querySelector(".close-button");
    const cancelBtn = document.getElementById("cancel-delete-btn");
    const confirmBtn = document.getElementById("confirm-delete-btn");

    // 1. Close when clicking X button
    if (closeBtn) {
      console.log("✅ Found close button (X)");
      closeBtn.replaceWith(closeBtn.cloneNode(true));
      const newCloseBtn = modal.querySelector(".close-button");

      newCloseBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log("❌ Delete cancelled (X button clicked)");
        modal.classList.remove("active");
        this.resetDeleteState();
      });
    }

    // 2. Close when clicking outside modal
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        console.log("❌ Delete cancelled (clicked outside modal)");
        modal.classList.remove("active");
        this.resetDeleteState();
      }
    });

    // 3. Close when clicking Cancel button
    if (cancelBtn) {
      console.log("✅ Found cancel button");
      cancelBtn.replaceWith(cancelBtn.cloneNode(true));
      const newCancelBtn = document.getElementById("cancel-delete-btn");

      newCancelBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log("❌ Delete cancelled (Cancel button clicked)");
        modal.classList.remove("active");
        this.resetDeleteState();
      });
    }

    // 4. Confirm delete button
    if (confirmBtn) {
      console.log("✅ Found confirm button");
      confirmBtn.replaceWith(confirmBtn.cloneNode(true));
      const newConfirmBtn = document.getElementById("confirm-delete-btn");

      newConfirmBtn.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log("✅ Delete confirmed");

        if (this.pendingDeletePlaylistId && this.pendingDeletePlaylistName) {
          await this.performDeletePlaylist(
            this.pendingDeletePlaylistId,
            this.pendingDeletePlaylistName
          );
        }
        modal.classList.remove("active");
      });
    }

    // 5. Close with Escape key
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && modal.classList.contains("active")) {
        console.log("❌ Delete cancelled (Escape key pressed)");
        modal.classList.remove("active");
        this.resetDeleteState();
      }
    });

    console.log("✅ Delete confirmation modal setup complete");
  }

  resetDeleteState() {
    this.pendingDeletePlaylistId = null;
    this.pendingDeletePlaylistName = null;
  }

  scrollToFirstUserPlaylist() {
    const userPlaylists = document.querySelectorAll(
      '[data-playlist-type="user"]'
    );
    const playlistGrid = document.getElementById("playlist-grid");

    if (userPlaylists.length > 0) {
      console.log(
        `🎯 Found ${userPlaylists.length} user playlists, scrolling to show them...`
      );

      if (playlistGrid) {
        playlistGrid.scrollLeft = 0;
        console.log("📜 Reset carousel scroll to start");
      }

      setTimeout(() => {
        const firstUserPlaylist = userPlaylists[0];
        if (firstUserPlaylist) {
          firstUserPlaylist.scrollIntoView({
            behavior: "smooth",
            block: "nearest",
            inline: "start",
          });
          console.log("🎯 Scrolled to first user playlist");
        }
      }, 100);
    } else {
      console.log("📭 No user playlists found, keeping default position");
    }
  }

  disableTrackpadNavigation() {
    let lastX = 0;
    let isScrolling = false;

    window.addEventListener(
      "wheel",
      (e) => {
        const isHorizontalSwipe =
          Math.abs(e.deltaX) > Math.abs(e.deltaY) && Math.abs(e.deltaX) > 10;

        if (isHorizontalSwipe && !isScrolling) {
          e.preventDefault();
          e.stopPropagation();
          return false;
        }

        lastX = e.deltaX;
      },
      { passive: false }
    );

    let touchStartX = 0;
    let touchStartY = 0;

    document.addEventListener(
      "touchstart",
      (e) => {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
      },
      { passive: true }
    );

    document.addEventListener(
      "touchmove",
      (e) => {
        if (!touchStartX || !touchStartY) return;

        const touchX = e.touches[0].clientX;
        const touchY = e.touches[0].clientY;

        const diffX = Math.abs(touchX - touchStartX);
        const diffY = Math.abs(touchY - touchStartY);

        if (diffX > diffY && diffX > 30) {
          e.preventDefault();
        }
      },
      { passive: false }
    );

    document.addEventListener(
      "scroll",
      () => {
        isScrolling = true;
        clearTimeout(window.scrollTimeout);
        window.scrollTimeout = setTimeout(() => {
          isScrolling = false;
        }, 100);
      },
      true
    );
  }

  isSamePlaylist(card) {
    const groupId = card.getAttribute("data-group");
    const playlistId = card.getAttribute("data-playlist-id");

    if (card.id === "random-playlist") {
      return this.currentActiveGroup === "random";
    }

    if (groupId) {
      return this.currentActiveGroup === `group-${groupId}`;
    }

    if (playlistId) {
      return this.currentActivePlaylist === parseInt(playlistId);
    }

    return false;
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

  initializeSound(button, soundInfo) {
    const soundContainer = button.closest(".sound-button-container");
    const soundName = soundInfo.name;

    const audio = new Audio(soundInfo.file_path);
    audio.loop = true;
    audio.volume = soundInfo.default_volume || 0.5;

    this.sounds.set(soundName, audio);

    button.addEventListener("click", () => {
      if (
        this.isPlaylistCreationMode &&
        document.body.classList.contains("multi-select-mode")
      ) {
        this.toggleSoundSelection(soundInfo.id.toString(), soundContainer);
        return;
      }

      if (audio.paused) {
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              this.updateButtonState(soundName, true);
              console.log(`▶️ Manually playing: ${soundName}`);
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

    button.addEventListener("click", () => {
      if (volumeControl && !audio.paused) {
        volumeControl.classList.remove("hidden");
      }
    });

    soundContainer.addEventListener("mouseleave", () => {
      if (audio.paused && volumeControl) {
        volumeControl.classList.add("hidden");
      }
    });

    if (volumeSlider) {
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
      if (volumeControl) {
        volumeControl.classList.remove("hidden");
      }
    });

    audio.addEventListener("pause", () => {
      if (volumeControl && !soundContainer.matches(":hover")) {
        volumeControl.classList.add("hidden");
      }
    });

    console.log(`✅ Initialized sound: ${soundName}`);
  }

  setupPlaylistHandlers() {
    const playlistCards = document.querySelectorAll(".playlist-card");
    console.log(`🎵 Found ${playlistCards.length} playlist cards`);

    playlistCards.forEach((card) => {
      this.setupSinglePlaylistHandler(card);
    });
  }

  setupSinglePlaylistHandler(card) {
    const playlistId =
      card.getAttribute("data-playlist-id") ||
      card.getAttribute("data-group") ||
      card.id;
    const handlerKey = `playlist-${playlistId}`;

    if (this.playlistHandlers.has(handlerKey)) {
      const oldCard = this.playlistHandlers.get(handlerKey);
      if (oldCard && oldCard.parentNode) {
        const newCard = oldCard.cloneNode(true);
        oldCard.parentNode.replaceChild(newCard, oldCard);
        this.playlistHandlers.set(handlerKey, newCard);
        this.setupSinglePlaylistHandler(newCard);
        return;
      }
    }

    this.playlistHandlers.set(handlerKey, card);

    card.addEventListener("click", (e) => {
      this.handlePlaylistClick(e, card);
    });

    const menuBtn = card.querySelector(".playlist-menu-btn");
    if (menuBtn) {
      menuBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const dropdownMenu = card.querySelector(".dropdown-menu");
        if (dropdownMenu) {
          dropdownMenu.classList.toggle("show");

          document
            .querySelectorAll(".dropdown-menu.show")
            .forEach((otherMenu) => {
              if (otherMenu !== dropdownMenu) {
                otherMenu.classList.remove("show");
              }
            });
        }
      });
    }
  }

  handlePlaylistClick(e, card) {
    if (
      e.target.closest(".playlist-menu-btn") ||
      e.target.closest(".dropdown-menu")
    ) {
      return;
    }

    e.preventDefault();

    const groupId = card.getAttribute("data-group");
    const playlistId = card.getAttribute("data-playlist-id");
    const groupName =
      card.querySelector(".playlist-title")?.textContent || "Playlist";

    console.log(`🎯 Playlist clicked: ${groupName}`, {
      groupId: groupId,
      playlistId: playlistId,
      currentActiveGroup: this.currentActiveGroup,
      currentActivePlaylist: this.currentActivePlaylist,
    });

    if (this.isSamePlaylist(card)) {
      console.log(`🔄 Same playlist clicked - toggling OFF`);
      this.stopAllSounds();
      this.currentActiveGroup = null;
      this.currentActivePlaylist = null;

      document.querySelectorAll(".playlist-card").forEach((c) => {
        c.classList.remove("playing");
      });
      return;
    }

    console.log(
      `🆕 Different playlist clicked - stopping current and starting new`
    );

    this.stopAllSounds();

    document.querySelectorAll(".playlist-card").forEach((c) => {
      c.classList.remove("playing");
    });

    if (card.id === "random-playlist") {
      this.currentActiveGroup = "random";
      this.currentActivePlaylist = null;
      this.playRandomSounds();
    } else if (groupId) {
      this.currentActiveGroup = `group-${groupId}`;
      this.currentActivePlaylist = null;
      this.playGroupSounds(parseInt(groupId), groupName);
    } else if (playlistId) {
      const playlistIdNum = parseInt(playlistId);
      this.currentActivePlaylist = playlistIdNum;
      this.currentActiveGroup = null;
      this.playUserPlaylist(playlistIdNum, groupName);
    }

    card.classList.add("playing");
    console.log(`✅ Now playing: ${groupName}`);
  }

  stopPlaylist(card) {
    const groupId = card.getAttribute("data-group");
    const playlistId = card.getAttribute("data-playlist-id");

    if (card.id === "random-playlist") {
      this.stopAllSounds();
    } else if (groupId) {
      this.stopGroupSounds(parseInt(groupId));
    } else if (playlistId) {
      this.stopUserPlaylist(parseInt(playlistId));
    }

    card.classList.remove("playing");
  }

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

  stopUserPlaylist(playlistId) {
    console.log(`⏹️ Stopping playlist ID: ${playlistId}`);

    fetch(`/api/playlists/${playlistId}`)
      .then((response) => response.json())
      .then((playlistData) => {
        playlistData.sounds.forEach((sound) => {
          const audio = this.sounds.get(sound.name);
          if (audio) {
            audio.pause();
            audio.currentTime = 0;
            this.updateButtonState(sound.name, false);

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

    document.querySelectorAll(".playlist-card").forEach((card) => {
      card.classList.remove("playing");
    });

    console.log("✅ All sounds stopped and state cleared");
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

      setTimeout(() => {
        this.ensureUserPlaylistsVisible();
      }, 200);

      console.log(`📋 Loaded ${this.userPlaylists.length} user playlists`);
    } catch (error) {
      console.error("❌ Error loading user playlists:", error);
    }
  }

  ensureUserPlaylistsVisible() {
    const userPlaylists = document.querySelectorAll(
      '[data-playlist-type="user"]'
    );

    if (userPlaylists.length > 0) {
      const carousel = document.querySelector(".playlist-carousel");
      const playlistGrid = document.getElementById("playlist-grid");

      if (playlistGrid) {
        playlistGrid.scrollLeft = 0;
      }

      setTimeout(() => {
        const firstUserPlaylist = userPlaylists[0];
        if (firstUserPlaylist && carousel) {
          firstUserPlaylist.scrollIntoView({
            behavior: "auto",
            block: "nearest",
            inline: "start",
          });
        }
      }, 50);

      console.log(
        `🎯 Ensured ${userPlaylists.length} user playlists are visible`
      );
    }
  }

  renderUserPlaylists() {
    const playlistGrid = document.getElementById("playlist-grid");
    if (!playlistGrid) return;

    const existingUserPlaylists = playlistGrid.querySelectorAll(
      '[data-playlist-type="user"]'
    );
    existingUserPlaylists.forEach((playlistCard) => {
      const playlistId = playlistCard.getAttribute("data-playlist-id");
      if (playlistId) {
        const handlerKey = `playlist-${playlistId}`;
        this.playlistHandlers.delete(handlerKey);
      }
      playlistCard.remove();
    });

    const sortedPlaylists = [...this.userPlaylists].sort((a, b) => b.id - a.id);

    const randomPlaylist = document.getElementById("random-playlist");

    if (randomPlaylist) {
      sortedPlaylists.forEach((playlist) => {
        const playlistCard = this.createPlaylistCard(playlist);
        playlistGrid.insertBefore(playlistCard, randomPlaylist);
        this.setupSinglePlaylistHandler(playlistCard);
      });
    } else {
      sortedPlaylists.forEach((playlist) => {
        const playlistCard = this.createPlaylistCard(playlist);
        playlistGrid.prepend(playlistCard);
        this.setupSinglePlaylistHandler(playlistCard);
      });
    }

    console.log(
      `✅ Added ${sortedPlaylists.length} user playlists BEFORE random playlist`
    );
  }

  createPlaylistCard(playlist) {
    const card = document.createElement("a");
    card.href = "#";
    card.className = "playlist-card";
    card.dataset.playlistId = playlist.id;
    card.dataset.playlistType = "user";

    let iconPath = playlist.icon;
    if (iconPath && iconPath.includes("static/")) {
      iconPath = iconPath.split("static/")[1];
    }

    card.innerHTML = `
      <div class="playlist-icon">
        <img src="/static/${iconPath || "icons/random.png"}" alt="${
      playlist.name
    } Icon" class="icon-img">
      </div>
      <h3 class="playlist-title">${playlist.name}</h3>
      <div class="playlist-menu">
        <button class="playlist-menu-btn" title="Playlist options">
          ⋮
        </button>
        <div class="dropdown-menu">
          <button class="dropdown-item edit-playlist-btn" data-playlist-id="${
            playlist.id
          }">
            Edit
          </button>
          <button class="dropdown-item delete-playlist-btn" data-playlist-id="${
            playlist.id
          }" data-playlist-name="${playlist.name}">
            Delete
          </button>
        </div>
      </div>
    `;

    const deleteBtn = card.querySelector(".delete-playlist-btn");
    deleteBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();

      const dropdownMenu = card.querySelector(".dropdown-menu");
      if (dropdownMenu) dropdownMenu.classList.remove("show");

      const playlistId = deleteBtn.getAttribute("data-playlist-id");
      const playlistName = deleteBtn.getAttribute("data-playlist-name");

      this.deletePlaylist(parseInt(playlistId), playlistName);
    });

    const editBtn = card.querySelector(".edit-playlist-btn");
    editBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();

      const dropdownMenu = card.querySelector(".dropdown-menu");
      if (dropdownMenu) dropdownMenu.classList.remove("show");

      this.showToast("Edit feature coming soon!", "info");
    });

    return card;
  }

  async deletePlaylist(playlistId, playlistName) {
    this.pendingDeletePlaylistId = playlistId;
    this.pendingDeletePlaylistName = playlistName;

    this.showDeleteConfirmationModal(playlistName);
  }

  showDeleteConfirmationModal(playlistName) {
    console.log("🎯 Showing delete modal for:", playlistName);

    const modal = document.getElementById("delete-confirmation-modal");

    if (!modal) {
      console.error("❌ Delete modal not found!");
      if (confirm(`Are you sure you want to delete "${playlistName}"?`)) {
        this.performDeletePlaylist(this.pendingDeletePlaylistId, playlistName);
      }
      this.resetDeleteState();
      return;
    }

    modal.classList.add("active");
    console.log("🎯 Modal shown");

    setTimeout(() => {
      const cancelBtn = document.getElementById("cancel-delete-btn");
      if (cancelBtn) {
        cancelBtn.focus();
        console.log("🎯 Cancel button focused");
      }
    }, 100);
  }

  async performDeletePlaylist(playlistId, playlistName) {
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

        if (this.currentActivePlaylist === playlistId) {
          this.stopAllSounds();
        }

        await this.loadUserPlaylists();
      } else {
        this.showToast(data.error || "Failed to delete playlist", "error");
      }
    } catch (error) {
      console.error("Error deleting playlist:", error);
      this.showToast("Error deleting playlist", "error");
    } finally {
      this.resetDeleteState();
    }
  }

  setupAddToPlaylistModal() {
    const modal = document.getElementById("add-to-playlist-modal");
    const closeBtn = modal?.querySelector(".close-button");

    if (!modal) return;

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

    document.addEventListener("click", (e) => {
      if (e.target.closest(".add-to-playlist-btn")) {
        e.preventDefault();
        e.stopPropagation();

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

        document
          .getElementById("add-to-playlist-modal")
          .classList.remove("active");
        this.currentSoundForPlaylist = null;

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

  showSelectionIndicators() {
    const soundContainers = document.querySelectorAll(
      ".sound-button-container:not(.premium)"
    );

    soundContainers.forEach((container) => {
      const existingIndicator = container.querySelector(".selection-indicator");
      if (existingIndicator) existingIndicator.remove();

      const existingAddBtn = container.querySelector(".add-to-playlist-btn");
      if (existingAddBtn) existingAddBtn.remove();

      const indicator = document.createElement("div");
      indicator.className = "selection-indicator";
      indicator.innerHTML = `
        <div class="selection-checkbox">
          <div class="checkmark">✓</div>
        </div>
      `;

      indicator.addEventListener("click", (e) => {
        e.stopPropagation();
        const soundId = container.getAttribute("data-sound-id");
        this.toggleSoundSelection(soundId, container);
      });

      container.appendChild(indicator);
      container.style.cursor = "pointer";
    });
  }

  showSelectionInstructions() {
    const existingToast = document.querySelector(".toast-instruction");
    if (existingToast) existingToast.remove();

    const toastContainer = document.querySelector(".toast-container");
    if (!toastContainer) return;

    const instruction = document.createElement("div");
    instruction.className = "toast toast-info toast-instruction";
    instruction.innerHTML = `
      <p class="toast-message">Click sound icons to select multiple sounds. Click "Save" when finished.</p>
      <button class="toast-close">&times;</button>
    `;

    toastContainer.appendChild(instruction);

    const closeBtn = instruction.querySelector(".toast-close");
    closeBtn.addEventListener("click", () => {
      instruction.style.opacity = "0";
      instruction.style.transform = "translateY(-10px)";
      setTimeout(() => instruction.remove(), 300);
    });

    setTimeout(() => {
      instruction.style.opacity = "0";
      instruction.style.transform = "translateY(-10px)";
      setTimeout(() => instruction.remove(), 8000);
    }, 8000);
  }

  removeSelectionIndicators() {
    const indicators = document.querySelectorAll(".selection-indicator");
    indicators.forEach((indicator) => indicator.remove());

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
      let thumbDiv = slider.parentElement.querySelector(".slider-thumb");
      if (!thumbDiv) {
        thumbDiv = document.createElement("div");
        thumbDiv.className = "slider-thumb";
        slider.parentElement.appendChild(thumbDiv);
      }

      const updateThumb = () => {
        const value = slider.value;
        const min = slider.min || 0;
        const max = slider.max || 100;
        const percent = ((value - min) / (max - min)) * 100;

        thumbDiv.style.left = `calc(${percent}% - 8px)`;
      };

      updateThumb();

      slider.addEventListener("input", updateThumb);

      slider.addEventListener("mouseenter", () => {
        thumbDiv.style.opacity = "1";
      });

      slider.addEventListener("mouseleave", () => {
        if (!slider.matches(":active")) {
          thumbDiv.style.opacity = "0";
        }
      });

      slider.addEventListener("mousedown", () => {
        thumbDiv.style.opacity = "1";
      });

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

    const closeBtn = toast.querySelector(".toast-close");
    closeBtn.addEventListener("click", () => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(-10px)";
      setTimeout(() => toast.remove(), 300);
    });

    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(-10px)";
      setTimeout(() => toast.remove(), 300);
    }, 5000);
  }
}

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

document.addEventListener("DOMContentLoaded", () => {
  console.log("🚀 Calm Flow initializing...");
  window.soundManager = new SoundManager();
  setupToasts();
  console.log("🎉 Calm Flow ready!");
});
