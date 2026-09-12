import type { RuleHooks } from './index';

/**
 * Zaopatrzeniowiec — dopóki jednostka stoi na planszy, karty zaopatrzenia
 * zagrane przez jej właściciela wracają na rękę zamiast na stos odrzuconych.
 * Faza logistyki sprawdza flagę `supplyReturnsToHand`.
 */
export const zaopatrzeniowiec: RuleHooks = {
  supplyReturnsToHand: true,
  onDeploy() {
    /* efekt jest pasywny — nic do zrobienia w momencie wejścia na planszę */
  },
};
