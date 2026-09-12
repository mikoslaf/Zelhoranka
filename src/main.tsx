import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { assertRegistryComplete } from './silnik/rules';
import { GameProvider } from './ui/GameProvider';
import { App } from './ui/App';
import type { Ustawienia } from './ui/screens/Menu';
import './ui/styles/gra.css';

/**
 * Punkt wejścia. Rejestr reguł sprawdzamy przy starcie — literówka w `rules`
 * ma rzucić błąd od razu, a nie zniknąć jako cichy brak efektu (§7).
 */
assertRegistryComplete();

function Root() {
  const [ustawienia, setUstawienia] = useState<Ustawienia>({
    ziarno: Math.floor(Date.now() % 1_000_000),
    bot: false,
    trudnosc: 'SREDNI',
  });

  return (
    <GameProvider seed={ustawienia.ziarno}>
      <App ustawienia={ustawienia} onUstawienia={setUstawienia} />
    </GameProvider>
  );
}

const kontener = document.getElementById('root');
if (!kontener) throw new Error('Brak elementu #root w index.html');

createRoot(kontener).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
