import manifest from '../data/audio.json';
import { assetUrl } from './images';

/**
 * Warstwa dźwiękowa (§9). Zasady:
 *  - brak pliku = cisza, nie wyjątek;
 *  - pula instancji na efekt, żeby kilka zgonów naraz nie ucinało dźwięku;
 *  - muzyka startuje dopiero po pierwszej interakcji użytkownika (autoplay);
 *  - `.ogg` z fallbackiem `.mp3` — kod nie zakłada, co obsłuży przeglądarka.
 */

type SfxKey = keyof typeof manifest.sfx;
type MusicKey = keyof typeof manifest.music;

const POOL_SIZE = 4;

type Pool = { elements: HTMLAudioElement[]; next: number };

class AudioManager {
  private pools = new Map<string, Pool>();
  private music: HTMLAudioElement | null = null;
  private musicKey: MusicKey | null = null;
  private unlocked = false;

  muted = false;
  sfxVolume = 0.7;
  musicVolume = 0.35;

  /** Ścieżki alternatywne: manifest podaje .ogg, próbujemy też .mp3. */
  private sources(path: string): string[] {
    const ogg = assetUrl(path);
    const mp3 = ogg.replace(/\.ogg$/i, '.mp3');
    return ogg === mp3 ? [ogg] : [ogg, mp3];
  }

  private makeElement(path: string): HTMLAudioElement {
    const el = new Audio();
    const [primary, fallback] = this.sources(path);
    el.src = primary;
    if (fallback) {
      let switched = false;
      el.addEventListener('error', () => {
        if (switched) return;
        switched = true;
        el.src = fallback;
      });
    }
    el.preload = 'auto';
    return el;
  }

  private pool(path: string): Pool {
    let pool = this.pools.get(path);
    if (!pool) {
      pool = {
        elements: Array.from({ length: POOL_SIZE }, () => this.makeElement(path)),
        next: 0,
      };
      this.pools.set(path, pool);
    }
    return pool;
  }

  /** Wywoływane po pierwszym kliknięciu — odblokowuje autoplay. */
  unlock(): void {
    if (this.unlocked) return;
    this.unlocked = true;
    if (this.musicKey) void this.playMusic(this.musicKey);
  }

  playSfx(key: SfxKey): void {
    if (this.muted) return;
    const path = manifest.sfx[key];
    if (!path) return;
    const pool = this.pool(path);
    const el = pool.elements[pool.next];
    pool.next = (pool.next + 1) % pool.elements.length;
    el.volume = this.sfxVolume;
    el.currentTime = 0;
    // Brak pliku albo blokada autoplay — cisza, nie wyjątek.
    void el.play().catch(() => undefined);
  }

  async playMusic(key: MusicKey): Promise<void> {
    this.musicKey = key;
    if (!this.unlocked || this.muted) return;
    const path = manifest.music[key];
    if (!path) return;

    if (this.music) {
      this.music.pause();
      this.music = null;
    }
    const el = this.makeElement(path);
    el.loop = true;
    el.volume = this.musicVolume;
    this.music = el;
    await el.play().catch(() => undefined);
  }

  stopMusic(): void {
    this.music?.pause();
    this.music = null;
    this.musicKey = null;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (muted) this.music?.pause();
    else if (this.musicKey) void this.playMusic(this.musicKey);
  }

  setSfxVolume(v: number): void {
    this.sfxVolume = Math.min(1, Math.max(0, v));
  }

  setMusicVolume(v: number): void {
    this.musicVolume = Math.min(1, Math.max(0, v));
    if (this.music) this.music.volume = this.musicVolume;
  }

  /** Lista wszystkich plików do wstępnego wczytania (pasek postępu). */
  allPaths(): string[] {
    return [...Object.values(manifest.sfx), ...Object.values(manifest.music)];
  }
}

export const audio = new AudioManager();
export type { SfxKey, MusicKey };
