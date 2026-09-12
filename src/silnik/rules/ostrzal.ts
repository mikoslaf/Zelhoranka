import type { RuleHooks } from './index';

/**
 * Ostrzał — jednostka strzela z tylnej linii i sięga tylnych pól przeciwnika.
 * Sam zasięg opisuje profil ataku karty (`reach: RANGED`, `fromRear: true`),
 * reguła nie musi nic zmieniać — istnieje po to, by karta niosła symbol i tekst.
 */
export const ostrzal: RuleHooks = {
  modifyRange(_state, _unit, targets) {
    return targets;
  },
};
