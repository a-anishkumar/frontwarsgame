import { sound } from "../sound/SoundFX";

export type PlatformType = "crazygames" | "poki" | "standalone";

declare global {
  interface Window {
    CrazyGames?: {
      SDK: {
        init: () => Promise<void>;
        environment: string;
        game: {
          loadingStart: () => void;
          loadingStop: () => void;
          gameplayStart: () => void;
          gameplayStop: () => void;
          happytime: () => void;
          settings?: { muteAudio?: boolean };
          addSettingsChangeListener: (callback: (settings: { muteAudio?: boolean }) => void) => void;
          removeSettingsChangeListener?: (callback: (settings: { muteAudio?: boolean }) => void) => void;
        };
        user?: {
          isUserAccountAvailable?: () => boolean;
          getUser: () => Promise<{ username: string; profilePictureUrl?: string } | null>;
          getUserToken?: () => Promise<string>;
          showAuthPrompt: () => Promise<{ username: string; profilePictureUrl?: string }>;
          addAuthListener: (callback: (user: { username: string; profilePictureUrl?: string } | null) => void) => void;
          removeAuthListener?: (callback: (user: { username: string; profilePictureUrl?: string } | null) => void) => void;
        };
        ad: {
          requestAd: (type: "midgame" | "rewarded") => Promise<void>;
        };
      };
    };
    PokiSDK?: {
      init: () => Promise<void>;
      gameLoadingFinished: () => void;
      gameplayStart: () => void;
      gameplayStop: () => void;
      commercialBreak: () => Promise<void>;
      rewardedBreak: () => Promise<boolean>;
      happyTime: (magnitude?: number) => void;
    };
  }
}

/**
 * Universal Game Portal Adapter.
 * Integrates CrazyGames SDK v3, Poki SDK v2, and Standalone (Itch.io/direct web).
 * Safely handles ad lifecycle, audio muting during breaks, and player achievement telemetry.
 */
export class GamePlatform {
  private static instance: GamePlatform | null = null;
  private platform: PlatformType = "standalone";
  private initialized = false;
  private isGameplayActive = false;
  private wasMutedBeforeAd = false;

  static get(): GamePlatform {
    if (!this.instance) {
      this.instance = new GamePlatform();
    }
    return this.instance;
  }

  get currentPlatform(): PlatformType {
    return this.platform;
  }

  /** Initialize SDKs safely on app boot */
  async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;

    // Detect CrazyGames SDK v3 (priority in CrazyGames portal)
    if (typeof window !== "undefined" && window.CrazyGames?.SDK) {
      try {
        await window.CrazyGames.SDK.init();
        this.platform = "crazygames";
        console.log("[Platform] CrazyGames SDK v3 successfully initialized");

        try {
          window.CrazyGames.SDK.game.loadingStart();
        } catch {}

        try {
          const s = window.CrazyGames.SDK.game.settings;
          if (s?.muteAudio) {
            sound.setMuted(true);
          }
          window.CrazyGames.SDK.game.addSettingsChangeListener((newSettings) => {
            sound.setMuted(Boolean(newSettings?.muteAudio));
          });
        } catch {}
        try {
          window.CrazyGames.SDK.user?.addAuthListener?.((user) => {
            window.dispatchEvent(new CustomEvent("borderwars-account-change", { detail: user }));
          });
        } catch {}


        return;
      } catch (err) {
        console.warn("[Platform] CrazyGames SDK init warning:", err);
      }
    }

    // Detect Poki SDK v2
    if (typeof window !== "undefined" && window.PokiSDK) {
      try {
        await window.PokiSDK.init();
        this.platform = "poki";
        console.log("[Platform] Poki SDK successfully initialized");
        return;
      } catch (err) {
        console.warn("[Platform] Poki SDK init warning (normal in dev/offline):", err);
      }
    }

    this.platform = "standalone";
    console.log("[Platform] Running in Standalone / Itch.io mode");
  }

  /** Call when all initial graphics, assets, and shaders are finished loading */
  gameLoadingFinished(): void {
    if (this.platform === "crazygames" && window.CrazyGames?.SDK) {
      try {
        window.CrazyGames.SDK.game.loadingStop();
      } catch {}
    } else if (this.platform === "poki" && window.PokiSDK) {
      try {
        window.PokiSDK.gameLoadingFinished();
      } catch {}
    }
  }

  /** Call when gameplay starts (player spawns into match, resumes game) */
  gameplayStart(): void {
    if (this.isGameplayActive) return;
    this.isGameplayActive = true;

    if (this.platform === "crazygames" && window.CrazyGames?.SDK) {
      try {
        window.CrazyGames.SDK.game.gameplayStart();
      } catch {}
    } else if (this.platform === "poki" && window.PokiSDK) {
      try {
        window.PokiSDK.gameplayStart();
      } catch {}
    }
  }

  /** Call when gameplay stops (game paused, victory/defeat screen, player death) */
  gameplayStop(): void {
    if (!this.isGameplayActive) return;
    this.isGameplayActive = false;

    if (this.platform === "crazygames" && window.CrazyGames?.SDK) {
      try {
        window.CrazyGames.SDK.game.gameplayStop();
      } catch {}
    } else if (this.platform === "poki" && window.PokiSDK) {
      try {
        window.PokiSDK.gameplayStop();
      } catch {}
    }
  }

  /**
   * Celebrate an in-game achievement or milestone (e.g. Empire Capitulation, Nuke Launch, Victory).
   * Generates feedback on platforms that support it.
   */
  happyTime(intensity = 0.5): void {
    if (this.platform === "crazygames" && window.CrazyGames?.SDK) {
      try {
        window.CrazyGames.SDK.game.happytime();
      } catch {}
    } else if (this.platform === "poki" && window.PokiSDK) {
      try {
        window.PokiSDK.happyTime(intensity);
      } catch {}
    }
  }

  /**
   * Request an interstitial / commercial break (e.g. between matches or at the end screen).
   * Mutes audio during the ad and restores user audio settings on completion.
   */
  async showCommercialBreak(): Promise<void> {
    this.gameplayStop();
    this.wasMutedBeforeAd = sound.isMuted();
    sound.setMuted(true);

    try {
      if (this.platform === "crazygames" && window.CrazyGames?.SDK) {
        await window.CrazyGames.SDK.ad.requestAd("midgame");
      } else if (this.platform === "poki" && window.PokiSDK) {
        await window.PokiSDK.commercialBreak();
      }
    } catch (err) {
      console.warn("[Platform] Ad break skipped or blocked:", err);
    } finally {
      // Restore user audio preference
      if (!this.wasMutedBeforeAd) {
        sound.setMuted(false);
      }
    }
  }

  /**
   * Request a rewarded video ad (player opted in for bonus gold or troops).
   * Returns true if user watched the ad to completion.
   */
  async showRewardedAd(): Promise<boolean> {
    this.gameplayStop();
    this.wasMutedBeforeAd = sound.isMuted();
    sound.setMuted(true);
    let rewarded = false;

    try {
      if (this.platform === "crazygames" && window.CrazyGames?.SDK) {
        await window.CrazyGames.SDK.ad.requestAd("rewarded");
        rewarded = true;
      } else if (this.platform === "poki" && window.PokiSDK) {
        rewarded = await window.PokiSDK.rewardedBreak();
      } else {
        // In standalone mode, automatically grant reward for testing
        rewarded = true;
      }
    } catch (err) {
      console.warn("[Platform] Rewarded ad failed:", err);
      rewarded = false;
    } finally {
      if (!this.wasMutedBeforeAd) {
        sound.setMuted(false);
      }
      this.gameplayStart();
    }
    return rewarded;
  }
  /** Retrieve currently signed-in platform user (e.g. CrazyGames account) */
  async getPlatformUser(): Promise<{ username: string; profilePictureUrl?: string } | null> {
    if (this.platform === "crazygames" && window.CrazyGames?.SDK?.user) {
      try {
        const user = await window.CrazyGames.SDK.user.getUser();
        if (user?.username) {
          return { username: user.username, profilePictureUrl: user.profilePictureUrl };
        }
      } catch (e) {
        console.warn("[Platform] getUser error:", e);
      }
    }
    return null;
  }

  /** Prompt user to log in or register via platform UI (e.g. CrazyGames auth modal) */
  async promptSignIn(): Promise<{ username: string; profilePictureUrl?: string } | null> {
    if (this.platform === "crazygames" && window.CrazyGames?.SDK?.user) {
      try {
        const user = await window.CrazyGames.SDK.user.showAuthPrompt();
        if (user?.username) {
          window.dispatchEvent(new CustomEvent("borderwars-account-change", { detail: user }));
          return { username: user.username, profilePictureUrl: user.profilePictureUrl };
        }
      } catch (e) {
        console.warn("[Platform] showAuthPrompt error or closed:", e);
      }
    }
    return null;
  }
}

export const platform = GamePlatform.get();

