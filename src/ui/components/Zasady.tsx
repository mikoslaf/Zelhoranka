import { CARDS, CONFIG, RULES } from '../../silnik/cards';
import { T } from '../teksty';

/**
 * Modal z zasadami. Własny modal, nie `alert`/`confirm` — w kiosku natywne
 * dialogi przeglądarki wyglądają jak awaria i wychodzą poza pełny ekran (§2.1).
 */

export function ModalZasad({ onZamknij }: { onZamknij: () => void }) {
  return (
    <div className="modal-tlo" onClick={onZamknij}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{T.menu.zasady}</h2>
        <div className="tresc">
          <h3>Informacja</h3>
          <p>
            Obaj gracze widzą wszystko: ręce, zasadzki i rozkazy w chwili wydania. Zakryta
            zostaje wyłącznie zawartość talii — jednakowo dla obu stron. Gra nie polega na
            ukrywaniu, tylko na tym, kto musi zadeklarować się pierwszy.
          </p>

          <h3>Cel</h3>
          <p>
            Wygrywa gracz, który wyprowadzi na tyły przeciwnika przełamanie o łącznej sile co
            najmniej {CONFIG.breakthroughThreshold}. Liczą się kolumny, w których przednie pole
            przeciwnika jest puste — sumujesz ofensywę własnych oddziałów z obu rzędów takiej
            kolumny.
          </p>

          <h3>Przebieg tury</h3>
          <ul>
            <li>
              <strong>{T.fazy.DRAW}</strong> — uzupełnij rękę do {CONFIG.handSize} kart. W turze 1
              wolno wymienić całą rękę, później do {CONFIG.mulliganLater} kart. Po wymianie dwóch
              możesz odrzucić jedną kartę i wymienić całą resztę.
            </li>
            <li>
              <strong>{T.fazy.LOGISTICS}</strong> — na przemian po jednej karcie. Zaopatrzenie to
              pula: karty zaopatrzenia ją zasilają, z niej płacisz koszty werbunku. Limit tury to
              numer tury + {CONFIG.supplyBase}.
            </li>
            <li>
              <strong>{T.fazy.STRATEGY}</strong> — gracze na przemian wydają rozkaz jednemu
              oddziałowi: atak, obrona albo postój. Rozkazy są jawne od razu i nie da się ich
              cofnąć, więc liczy się kolejność decyzji. Pierwszy deklaruje gracz z większą
              liczbą oddziałów — przewaga na planszy kosztuje przewagę informacyjną.
            </li>
            <li>
              <strong>{T.fazy.MANEUVERS}</strong> — rozkazy odkryte, gracze na przemian zagrywają
              karty manewrów i odpalają zasadzki.
            </li>
            <li>
              <strong>{T.fazy.COMBAT}</strong> — starcie rozstrzyga się jednocześnie, na zamrożonej
              migawce. Żadna śmierć nie wpływa na obliczenia w tej samej fazie.
            </li>
          </ul>

          <h3>Rozstrzyganie starcia</h3>
          <ul>
            <li>
              Oddział ginie, gdy suma ofensyw napastników <strong>przekracza</strong> jego
              defensywę. Równa wartość nie wystarczy.
            </li>
            <li>
              Obrońca dokłada swoją defensywę jako obrażenia napastnikowi, który sam jest
              atakowany.
            </li>
            <li>
              Obrońca odwzajemnia cios: pulą równą swojej defensywie zabija napastników,
              zaczynając od największego.
            </li>
            <li>
              Gdy dwa oddziały atakują się wzajemnie, wyższa ofensywa zabija niższą. Remis —
              obaj przeżywają.
            </li>
          </ul>

          <h3>Zasięgi</h3>
          <ul>
            <li>
              <strong>FRONT</strong> — tylko przednie pole przeciwnika; puste pole znaczy brak
              ataku w tę kolumnę.
            </li>
            <li>
              <strong>DEEP</strong> — przednie pole, a gdy jest puste, tylne.
            </li>
            <li>
              <strong>RANGED</strong> — przednie albo tylne, niezależnie od zajętości.
            </li>
            <li>
              Oddział w tylnej linii atakuje tylko wtedy, gdy jego karta na to pozwala. Strefy
              ograniczają rozmieszczanie, nie celowanie.
            </li>
          </ul>

          <h3>Reguły specjalne</h3>
          <ul>
            {RULES.map((r) => (
              <li key={r.id}>
                <strong>{r.name}</strong> — {r.text}
              </li>
            ))}
          </ul>

          <h3>Talia</h3>
          <p>
            {CONFIG.deckSize} kart na gracza, obie talie identyczne:{' '}
            {(['RECRUIT', 'SUPPLY', 'AMBUSH', 'INTERVENTION', 'MANEUVER'] as const)
              .map(
                (t) =>
                  `${CARDS.filter((c) => c.type === t).reduce((s, c) => s + c.copies, 0)} ${T.typy[
                    t
                  ].toLowerCase()}`,
              )
              .join(', ')}
            . Talia się nie przetasowuje — jej wyczerpanie kończy partię porównaniem ofensyw.
          </p>
        </div>
        <div className="przyciski">
          <button type="button" className="glowny" onClick={onZamknij}>
            {T.gra.dalej}
          </button>
        </div>
      </div>
    </div>
  );
}
