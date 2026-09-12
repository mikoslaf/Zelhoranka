import type { RuleHooks } from './index';

/**
 * Zwiadowca — po zamknięciu deklaracji ten oddział może raz zmienić swój
 * rozkaz, za darmo, w fazie manewrów.
 *
 * Pierwotnie reguła pozwalała podejrzeć jeden rozkaz przeciwnika. Po przejściu
 * na jawne rozkazy stała się bezużyteczna: nie ma czego podglądać, skoro widać
 * wszystko. Nowe brzmienie zachowuje sens nazwy — zwiad melduje, dowódca
 * koryguje plan — i jest realną przeciwwagą dla tego, że w naprzemiennej
 * deklaracji ktoś musi zadeklarować się pierwszy.
 */
export const zwiadowca: RuleHooks = {
  onOrderDeclared(): boolean {
    return true;
  },
};
