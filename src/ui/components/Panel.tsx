import { memo, useEffect, useRef } from 'react';
import type { GameState, LogEntry, PlayerId } from '../../silnik/types';
import { supplyLimit } from '../../silnik/state';
import { breakthroughScore } from '../../silnik/victory';
import { CONFIG } from '../../silnik/cards';
import { T, nazwaGracza } from '../teksty';

/**
 * Panel boczny: faza, liczniki, dziennik, przyciski (§5).
 * Dziennik jest ważny — to on tłumaczy graczowi, dlaczego oddział zginął.
 */

export const KasetaFazy = memo(function KasetaFazy({
  state,
  bot,
}: {
  state: GameState;
  bot: PlayerId | null;
}) {
  return (
    <div className="kaseta">
      <div className="naglowek-tury">
        <span className="tura">
          {T.gra.tura} {state.turn}
        </span>
      </div>
      <div className="faza">{T.fazy[state.phase]}</div>
      <div className="opis-fazy">{T.fazyOpis[state.phase]}</div>
      <div className="kto-zaczyna">
        ⚑ {nazwaGracza(state.firstPlayer, bot)} {T.gra.zaczyna}
      </div>
    </div>
  );
});

/**
 * Dwa mierniki: ile zaopatrzenia zostało do wydania i jak blisko przełamania
 * jest gracz. Przełamanie to warunek zwycięstwa, więc musi być stale widoczne.
 */
export const KasetaLicznikow = memo(function KasetaLicznikow({
  state,
  gracz,
}: {
  state: GameState;
  gracz: PlayerId;
}) {
  const ps = state.players[gracz];
  const limit = supplyLimit(state.turn);
  const dostepne = ps.supplyPool - ps.supplySpent;
  const koraliki = Math.max(limit, ps.supplyPool);

  const przelamanie = breakthroughScore(state, gracz);
  const prog = CONFIG.breakthroughThreshold;
  const procent = Math.min(100, Math.round((przelamanie / prog) * 100));

  return (
    <div className="kaseta">
      <div className="miernik">
        <span className="etykieta-miernika">{T.gra.zaopatrzenie}</span>
        <span className="duza-liczba">
          {dostepne}
          <span className="drobna"> / {ps.supplyPool}</span>
        </span>
      </div>
      <div className="koraliki">
        {Array.from({ length: koraliki }, (_, i) => (
          <span
            key={i}
            className={`koralik${i < dostepne ? ' pelny' : i < ps.supplyPool ? ' wydany' : ''}`}
          />
        ))}
      </div>

      <div className="miernik">
        <span className="etykieta-miernika">{T.gra.przelamanie}</span>
        <span className="duza-liczba">
          {przelamanie}
          <span className="drobna"> / {prog}</span>
        </span>
      </div>
      <div className="pasek-przelamania">
        <div
          className={`wypelnienie${procent >= 66 ? ' blisko' : ''}`}
          style={{ width: `${procent}%` }}
        />
      </div>
    </div>
  );
});

export const Dziennik = memo(function Dziennik({
  wpisy,
  bot,
}: {
  wpisy: LogEntry[];
  bot: PlayerId | null;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [wpisy.length]);

  return (
    <div className="kaseta dziennik">
      <div className="tytul-kasety">{T.gra.dziennik}</div>
      <div className="wpisy" ref={ref}>
        {wpisy.length === 0 && <span className="pusty">Jeszcze nic się nie wydarzyło.</span>}
        {wpisy.slice(-60).map((w, i) => (
          <div key={`${i}-${w.text}`} className={`wpis${w.player ? ` ${w.player}` : ''}`}>
            <span className="znacznik" />
            <span className="tresc">
              {w.player && <span className="autor">{nazwaGracza(w.player, bot)}: </span>}
              {w.text}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
});
