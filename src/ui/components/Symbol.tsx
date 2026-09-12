import { memo } from 'react';
import { ruleDef } from '../../silnik/cards';
import { symbolUrl } from '../../media/images';
import { useObrazek } from '../../media/useObrazek';

/**
 * Symbol reguły specjalnej. Ścieżka pochodzi z `rules.json`, nie z kodu (§8.1).
 * Brak pliku SVG → zostaje litera w kółku, gra działa dalej (§8.4).
 */
export const SymbolReguly = memo(function SymbolReguly({ id }: { id: string }) {
  const def = ruleDef(id);
  const url = useObrazek(symbolUrl(def.symbol));

  if (!url) {
    return (
      <span className="symbol" title={`${def.name} — ${def.text}`}>
        {def.name.charAt(0).toUpperCase()}
      </span>
    );
  }

  return (
    <span
      className="symbol"
      title={`${def.name} — ${def.text}`}
      style={{ backgroundImage: `url("${url}")`, borderColor: 'transparent' }}
    />
  );
});
