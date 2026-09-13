import { useCallback, useEffect, useRef, useState } from 'react';
import type { PlayerId } from '../silnik/types';
import { legalActions } from '../silnik/actions';
import { CONFIG } from '../silnik/cards';
import { audio } from '../media/audio';
import { wybierzAkcje, type Trudnosc } from '../ai/bot';
import { useGra } from './GameProvider';
import { Scena } from './screens/Scena';
import { EkranGry } from './screens/Gra';
import { EkranMenu, type Ustawienia } from './screens/Menu';
import { EkranPodsumowania } from './screens/Podsumowanie';
import { EkranKostki } from './components/Kostka';
import { ModalZasad } from './components/Zasady';
import { Poradnik } from './screens/Poradnik';

/**
 * Powłoka aplikacji: ekrany, bot, auto-reset po bezczynności.
 * Cała logika zasad siedzi w silniku — tu tylko nawigacja i obracanie stołu
 * do gracza, który jest przy ruchu.
 */

type Ekran = 'MENU' | 'GRA' | 'PODSUMOWANIE';

const CZLOWIEK: PlayerId = 'P1';

export function App({
  ustawienia,
  onUstawienia,
}: {
  ustawienia: Ustawienia;
  onUstawienia: (u: Ustawienia) => void;
}) {
  const { game, dispatch, nowaGra, inputLocked } = useGra();
  const [ekran, setEkran] = useState<Ekran>('MENU');
  const [viewPlayer, setViewPlayer] = useState<PlayerId>('P1');
  const [pokazKostke, setPokazKostke] = useState(false);
  const [zasady, setZasady] = useState(false);
  const [poradnik, setPoradnik] = useState(false);
  const [wPartii, setWPartii] = useState(false);
  // StrictMode woła efekty dwa razy — bez tej blokady drugi rzut byłby
  // odrzucony jako nielegalny i mignąłby komunikat o błędzie.
  const rzucono = useRef(false);

  const bot: PlayerId | null = ustawienia.bot ? 'P2' : null;

  /* ---------- Start i powrót do menu ---------- */

  const start = useCallback(() => {
    rzucono.current = false;
    nowaGra(ustawienia.ziarno);
    setViewPlayer(CZLOWIEK);
    setPokazKostke(true);
    setEkran('GRA');
    setWPartii(true);
    void audio.playMusic('GAME');
  }, [nowaGra, ustawienia.ziarno]);

  const doMenu = useCallback(() => {
    setEkran('MENU');
    void audio.playMusic('MENU');
  }, []);

  // Rzut o inicjatywę odpalamy sami — gracz widzi animację, nie klika dwa razy.
  useEffect(() => {
    if (ekran !== 'GRA' || game.phase !== 'SETUP' || rzucono.current) return;
    rzucono.current = true;
    dispatch({ type: 'ROLL_INITIATIVE' });
  }, [ekran, game.phase, dispatch]);

  /* ---------- Perspektywa podąża za aktywnym graczem ---------- */

  /*
   * Zasłona zniknęła razem z tajnymi rękami i rozkazami — nie ma już czego
   * zasłaniać. Zostaje samo obrócenie stołu, żeby gracz przy klawiaturze miał
   * swoje pola i swoją rękę na dole. Ekran nie jest już odmontowywany
   * (`key={viewPlayer}`): to było zabezpieczenie przed wyciekiem cudzych kart
   * do DOM, a przy jawnej informacji tylko szarpałoby widokiem.
   */
  useEffect(() => {
    if (ekran !== 'GRA' || inputLocked || pokazKostke) return;

    if (game.winner !== null) {
      setEkran('PODSUMOWANIE');
      return;
    }

    const docelowy = bot !== null ? CZLOWIEK : game.activePlayer;
    if (viewPlayer !== docelowy) setViewPlayer(docelowy);
  }, [ekran, game, inputLocked, pokazKostke, viewPlayer, bot]);

  /* ---------- Faza manewrów: pomijamy turę, gdy nie ma czym zagrać ---------- */

  useEffect(() => {
    if (ekran !== 'GRA' || inputLocked || pokazKostke) return;
    if (game.phase !== 'MANEUVERS' || game.winner !== null) return;
    const gracz = game.activePlayer;
    if (bot === gracz) return;
    const akcje = legalActions(game, gracz);
    if (akcje.length === 1 && akcje[0].type === 'PASS_MANEUVERS') {
      const t = window.setTimeout(() => dispatch(akcje[0]), 60);
      return () => window.clearTimeout(t);
    }
  }, [ekran, game, inputLocked, pokazKostke, bot, dispatch]);

  /* ---------- Bot (§11.2) ---------- */

  useEffect(() => {
    if (ekran !== 'GRA' || bot === null || inputLocked || pokazKostke) return;
    if (game.winner !== null || game.phase === 'COMBAT' || game.phase === 'SETUP') return;
    if (game.activePlayer !== bot) return;

    const t = window.setTimeout(() => {
      const akcja = wybierzAkcje(game, bot, ustawienia.trudnosc as Trudnosc);
      if (akcja) dispatch(akcja);
    }, 420);
    return () => window.clearTimeout(t);
  }, [ekran, game, bot, inputLocked, pokazKostke, ustawienia.trudnosc, dispatch]);

  /* ---------- Auto-reset po bezczynności (§10.4) ---------- */

  const ostatniaAktywnosc = useRef(Date.now());

  useEffect(() => {
    const dotknij = (): void => {
      ostatniaAktywnosc.current = Date.now();
    };
    const zdarzenia = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;
    for (const z of zdarzenia) window.addEventListener(z, dotknij, { passive: true });

    const licznik = window.setInterval(() => {
      const bezczynnosc = (Date.now() - ostatniaAktywnosc.current) / 1000;
      if (bezczynnosc > CONFIG.idleResetSeconds && ekran !== 'MENU') {
        // Stacja demonstracyjna nie może zostać zablokowana na porzuconej partii.
        setEkran('MENU');
        setWPartii(false);
        void audio.playMusic('MENU');
        ostatniaAktywnosc.current = Date.now();
      }
    }, 5000);

    return () => {
      for (const z of zdarzenia) window.removeEventListener(z, dotknij);
      window.clearInterval(licznik);
    };
  }, [ekran]);

  /* ---------- Kiosk: bez menu kontekstowego i przeciągania (§10.4) ---------- */

  useEffect(() => {
    const blokuj = (e: Event): void => e.preventDefault();
    window.addEventListener('contextmenu', blokuj);
    window.addEventListener('dragstart', blokuj);
    return () => {
      window.removeEventListener('contextmenu', blokuj);
      window.removeEventListener('dragstart', blokuj);
    };
  }, []);

  /* ---------- Render ---------- */

  return (
    <Scena>
      {ekran === 'MENU' && (
        <EkranMenu
          ustawienia={ustawienia}
          onZmiana={onUstawienia}
          onStart={start}
          onPoradnik={() => setPoradnik(true)}
          onZasady={() => setZasady(true)}
          wPartii={wPartii && game.winner === null && game.phase !== 'SETUP'}
          onWroc={() => setEkran('GRA')}
        />
      )}

      {ekran === 'GRA' && (
        <EkranGry viewPlayer={viewPlayer} bot={bot} onMenu={doMenu} />
      )}

      {ekran === 'PODSUMOWANIE' && (
        <EkranPodsumowania game={game} bot={bot} onJeszczeRaz={start} onMenu={doMenu} />
      )}

      {ekran === 'GRA' && pokazKostke && game.lastRoll && (
        <EkranKostki
          p1={game.lastRoll.p1}
          p2={game.lastRoll.p2}
          bot={bot}
          onKoniec={() => setPokazKostke(false)}
        />
      )}

      {poradnik && <Poradnik onZamknij={() => setPoradnik(false)} />}

      {zasady && <ModalZasad onZamknij={() => setZasady(false)} />}
    </Scena>
  );
}
