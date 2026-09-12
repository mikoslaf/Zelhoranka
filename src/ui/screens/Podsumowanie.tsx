import type { GameState, PlayerId } from '../../silnik/types';
import { breakthroughScore, totalOffense } from '../../silnik/victory';
import { countUnits } from '../../silnik/stats';
import { T, nazwaGracza } from '../teksty';

/** Ekran podsumowania partii (§15, etap 7). */

export function EkranPodsumowania({
  game,
  bot,
  onJeszczeRaz,
  onMenu,
}: {
  game: GameState;
  bot: PlayerId | null;
  onJeszczeRaz: () => void;
  onMenu: () => void;
}) {
  const zwyciezca: PlayerId | null =
    game.winner === null || game.winner === 'DRAW' ? null : game.winner;
  const remis = game.winner === 'DRAW';
  const powod = game.log.filter((w) => w.text.startsWith('Koniec partii')).at(-1);

  return (
    <div className="podsumowanie">
      <h1 className={`werdykt${remis ? ' remis' : ' zwyciestwo'}`}>
        {remis ? T.koniec.remis : T.koniec.zwyciestwo}
      </h1>
      {zwyciezca && <div className="powod">{T.koniec.wygral(nazwaGracza(zwyciezca, bot))}</div>}
      {powod && (
        <div className="powod" style={{ fontSize: 'var(--stopien-m)', opacity: 0.65 }}>
          {powod.text.replace('Koniec partii: ', '')}
        </div>
      )}

      <div className="statystyki-koncowe">
        {(['P1', 'P2'] as PlayerId[]).map((p) => (
          <div key={p} className="kolumna-wyniku">
            <span className="etykieta">{nazwaGracza(p, bot)}</span>
            <span className="wartosc">{breakthroughScore(game, p)}</span>
            <span className="etykieta">{T.gra.przelamanie}</span>
            <span className="dopisek">
              {countUnits(game, p)} oddz. · {totalOffense(game, p)} ofn.
            </span>
          </div>
        ))}
        <div className="kolumna-wyniku">
          <span className="etykieta">{T.koniec.turyRozegrane}</span>
          <span className="wartosc">{game.turn}</span>
        </div>
      </div>

      <div className="przyciski">
        <button type="button" className="glowny" onClick={onJeszczeRaz}>
          {T.koniec.jeszczeRaz}
        </button>
        <button type="button" onClick={onMenu}>
          {T.koniec.doMenu}
        </button>
      </div>
    </div>
  );
}
