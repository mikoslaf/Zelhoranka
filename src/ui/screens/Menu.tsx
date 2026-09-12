import { useEffect, useState } from 'react';
import { audio } from '../../media/audio';
import { preloadAll } from '../../media/preload';
import { CONFIG } from '../../silnik/cards';
import { T } from '../teksty';

/**
 * Menu główne. Zawiera ustawienia dźwięku, wybór przeciwnika i ziarno
 * rozgrywki (powtarzalna partia na obronie — §2.2).
 */

export type Ustawienia = {
  ziarno: number;
  bot: boolean;
  trudnosc: 'LATWY' | 'SREDNI' | 'TRUDNY';
};

type Props = {
  ustawienia: Ustawienia;
  onZmiana: (u: Ustawienia) => void;
  onStart: () => void;
  onZasady: () => void;
  wPartii: boolean;
  onWroc: () => void;
};

export function EkranMenu({
  ustawienia,
  onZmiana,
  onStart,
  onZasady,
  wPartii,
  onWroc,
}: Props) {
  const [postep, setPostep] = useState({ done: 0, total: 0 });
  const [brakujace, setBrakujace] = useState<number | null>(null);
  const [wyciszone, setWyciszone] = useState(audio.muted);
  const [glosSfx, setGlosSfx] = useState(audio.sfxVolume);
  const [glosMuz, setGlosMuz] = useState(audio.musicVolume);

  // Wstępne wczytanie zasobów z paskiem postępu (§9). Braki nie blokują gry.
  useEffect(() => {
    let anulowane = false;
    void preloadAll((done, total) => {
      if (!anulowane) setPostep({ done, total });
    }).then((wynik) => {
      if (!anulowane) setBrakujace(wynik.missing.length);
    });
    return () => {
      anulowane = true;
    };
  }, []);

  const gotowe = brakujace !== null;
  const procent = postep.total === 0 ? 0 : Math.round((postep.done / postep.total) * 100);

  return (
    <div className="menu">
      <div>
        <h1 className="tytul">{T.tytul}</h1>
        <div className="podtytul">{T.podtytul}</div>
        <p className="opis">
          Dwóch dowódców, jedna linia bitewna, szesnaście pól. Werbujesz oddziały, pilnujesz
          zaopatrzenia i na przemian wydajesz rozkazy — obaj widzicie wszystko, liczy się
          kolejność decyzji. Wygrywa ten, kto wyprowadzi na tyły przeciwnika przełamanie
          o sile co najmniej {CONFIG.breakthroughThreshold}.
        </p>

        <div className="przyciski">
          {wPartii && (
            <button type="button" onClick={onWroc}>
              {T.menu.kontynuuj}
            </button>
          )}
          <button type="button" className="glowny" onClick={onStart} disabled={!gotowe}>
            {gotowe ? T.menu.nowaGra : `${T.menu.wczytywanie}… ${procent}%`}
          </button>
          <button type="button" onClick={onZasady}>
            {T.menu.zasady}
          </button>
        </div>

        {!gotowe && (
          <div className="pasek-postepu" style={{ marginTop: 14, maxWidth: 340 }}>
            <div className="wypelnienie" style={{ width: `${procent}%` }} />
          </div>
        )}
        {gotowe && brakujace > 0 && (
          <div className="opis-male" style={{ marginTop: 12, maxWidth: 340 }}>
            Brakuje {brakujace} plików multimediów — gra działa na placeholderach. Wrzucenie
            plików do <code>public/assets/</code> podmienia oprawę bez zmian w kodzie.
          </div>
        )}
      </div>

      <div className="ustawienia">
        <div className="ustawienie">
          <span className="etykieta">{T.menu.ziarno}</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="number"
              value={ustawienia.ziarno}
              onChange={(e) =>
                onZmiana({ ...ustawienia, ziarno: Number(e.target.value) || 0 })
              }
            />
            <button
              type="button"
              onClick={() =>
                onZmiana({ ...ustawienia, ziarno: Math.floor(Date.now() % 1_000_000) })
              }
            >
              {T.menu.losujZiarno}
            </button>
          </div>
          <span className="opis-male">{T.menu.ziarnoOpis}</span>
        </div>

        <div className="ustawienie">
          <span className="etykieta">Przeciwnik</span>
          <div className="przelacznik">
            <button
              type="button"
              className={!ustawienia.bot ? 'aktywny' : undefined}
              onClick={() => onZmiana({ ...ustawienia, bot: false })}
            >
              Hot-seat
            </button>
            <button
              type="button"
              className={ustawienia.bot ? 'aktywny' : undefined}
              onClick={() => onZmiana({ ...ustawienia, bot: true })}
            >
              {T.menu.nowaGraBot}
            </button>
          </div>
          {ustawienia.bot && (
            <div className="przelacznik" style={{ marginTop: 6 }}>
              {(['LATWY', 'SREDNI', 'TRUDNY'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  className={ustawienia.trudnosc === p ? 'aktywny' : undefined}
                  onClick={() => onZmiana({ ...ustawienia, trudnosc: p })}
                >
                  {p === 'LATWY' ? T.menu.latwy : p === 'SREDNI' ? T.menu.sredni : T.menu.trudny}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="ustawienie">
          <span className="etykieta">{T.menu.dzwiek}</span>
          <button
            type="button"
            className={wyciszone ? 'aktywny' : undefined}
            onClick={() => {
              const m = !wyciszone;
              setWyciszone(m);
              audio.setMuted(m);
            }}
          >
            {wyciszone ? '🔇 ' : '🔊 '}
            {T.menu.wyciszenie}
          </button>
          <span className="opis-male">{T.menu.efekty}</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={glosSfx}
            onChange={(e) => {
              const v = Number(e.target.value);
              setGlosSfx(v);
              audio.setSfxVolume(v);
            }}
          />
          <span className="opis-male">{T.menu.muzyka}</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={glosMuz}
            onChange={(e) => {
              const v = Number(e.target.value);
              setGlosMuz(v);
              audio.setMusicVolume(v);
            }}
          />
        </div>
      </div>
    </div>
  );
}
