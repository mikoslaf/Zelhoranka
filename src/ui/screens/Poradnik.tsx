import { useState, type ReactNode } from 'react';
import { CONFIG } from '../../silnik/cards';
import { T } from '../teksty';

/**
 * Poradnik dla kogoś, kto siada do gry pierwszy raz.
 *
 * Świadomie NIE jest to powtórka zasad — od tego jest modal „Zasady"
 * i dokumentacja. Tu chodzi o pięć rzeczy, bez których nie da się wykonać
 * pierwszego ruchu: po co gram, z czego składa się tura, jak czytać oddział,
 * kiedy ktoś ginie i na czym polega jedyna trudna decyzja.
 *
 * Krok = jedna myśl + jeden rysunek. W kiosku nikt nie czyta akapitów,
 * a wszystkie rysunki są płaskim SVG (§10.3 — zero perspektywy i 3D).
 */

/* ---------- Elementy rysunków ---------- */

const KOSC = 'var(--kosc)';
const PRZYGASZONA = 'var(--kosc-przygaszona)';

function Pole({
  x,
  y,
  wariant = 'puste',
  etykieta,
}: {
  x: number;
  y: number;
  wariant?: 'puste' | 'moj' | 'wrogi' | 'luka';
  etykieta?: string;
}) {
  const wypelnienie =
    wariant === 'moj'
      ? 'var(--grynszpan)'
      : wariant === 'wrogi'
        ? 'var(--marzanna)'
        : 'rgba(19,27,41,0.5)';
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={34}
        height={30}
        rx={2}
        fill={wypelnienie}
        stroke={wariant === 'luka' ? 'var(--mosiadz-jasny)' : 'rgba(236,228,208,0.3)'}
        strokeWidth={wariant === 'luka' ? 2 : 1}
        strokeDasharray={wariant === 'luka' ? '4 3' : undefined}
      />
      {etykieta && (
        <text
          x={x + 17}
          y={y + 20}
          textAnchor="middle"
          fontSize={14}
          fontWeight="700"
          fill={KOSC}
        >
          {etykieta}
        </text>
      )}
    </g>
  );
}

/** Plansza w miniaturze: kolumna 1 przeciwnika pusta, więc droga stoi otworem. */
function RysunekPrzelamania() {
  // Cztery kolumny po 34 px z odstępem 4 → 148 px, wyśrodkowane w 200.
  const kol = (c: number): number => 26 + c * 38;
  const OTWARTA = 1;
  return (
    <svg viewBox="0 0 200 208" width="100%" style={{ maxWidth: 300 }}>
      <text x={100} y={10} textAnchor="middle" fontSize={8} fill={PRZYGASZONA} letterSpacing="1.5">
        PRZECIWNIK
      </text>

      {[0, 1, 2, 3].map((c) => (
        <Pole key={`wr${c}`} x={kol(c)} y={16} wariant={c === OTWARTA ? 'puste' : 'wrogi'} />
      ))}
      {[0, 1, 2, 3].map((c) => (
        <Pole key={`wf${c}`} x={kol(c)} y={50} wariant={c === OTWARTA ? 'luka' : 'wrogi'} />
      ))}

      <line x1={26} y1={92} x2={174} y2={92} stroke="var(--mosiadz-jasny)" strokeWidth={1.5} />

      {[0, 1, 2, 3].map((c) => (
        <Pole
          key={`mf${c}`}
          x={kol(c)}
          y={100}
          wariant={c === OTWARTA ? 'moj' : 'puste'}
          etykieta={c === OTWARTA ? '5' : undefined}
        />
      ))}
      {[0, 1, 2, 3].map((c) => (
        <Pole
          key={`mr${c}`}
          x={kol(c)}
          y={134}
          wariant={c === OTWARTA ? 'moj' : 'puste'}
          etykieta={c === OTWARTA ? '3' : undefined}
        />
      ))}
      <text x={100} y={176} textAnchor="middle" fontSize={8} fill={PRZYGASZONA} letterSpacing="1.5">
        TY
      </text>

      {/* Droga przez otwartą kolumnę — strzałka biegnie obok pól, nie po nich. */}
      <path
        d="M 62 130 L 62 74"
        stroke="var(--mosiadz-jasny)"
        strokeWidth={2}
        fill="none"
        strokeDasharray="5 4"
      />
      <polygon points="62,62 57,76 67,76" fill="var(--mosiadz-jasny)" />

      {/* Podpis pod planszą, żeby nic nie nachodziło na pola. */}
      <text x={100} y={198} textAnchor="middle" fontSize={11} fontWeight="700" fill="var(--mosiadz-jasny)">
        kolumna otwarta → 5 + 3 = 8
      </text>
    </svg>
  );
}

/** Anatomia żetonu — co znaczą liczby w rogach. */
function RysunekZetonu() {
  return (
    <svg viewBox="0 0 250 150" width="100%" style={{ maxWidth: 360 }}>
      <rect x={78} y={26} width={94} height={94} rx={3} fill="var(--kosc)" stroke="var(--inkaust)" />
      <rect x={78} y={26} width={94} height={22} fill="rgba(23,28,38,0.08)" />
      <text x={125} y={41} textAnchor="middle" fontSize={10} fill="var(--inkaust)">
        Jeźdźcy
      </text>
      <circle cx={125} cy={76} r={20} fill="var(--marzanna)" opacity={0.35} />

      <rect x={82} y={100} width={24} height={16} rx={2} fill="var(--marzanna)" />
      <text x={94} y={112} textAnchor="middle" fontSize={11} fontWeight="700" fill={KOSC}>
        5
      </text>
      <rect x={144} y={100} width={24} height={16} rx={2} fill="var(--grynszpan)" />
      <text x={156} y={112} textAnchor="middle" fontSize={11} fontWeight="700" fill={KOSC}>
        2
      </text>
      <circle cx={165} cy={33} r={8} fill="var(--marzanna)" stroke="var(--inkaust)" />
      <text x={165} y={37} textAnchor="middle" fontSize={9} fontWeight="700" fill={KOSC}>
        ↑
      </text>

      <line x1={70} y1={108} x2={40} y2={108} stroke={PRZYGASZONA} strokeWidth={1} />
      <text x={36} y={111} textAnchor="end" fontSize={9} fill={KOSC}>
        ofensywa
      </text>
      <line x1={180} y1={108} x2={205} y2={108} stroke={PRZYGASZONA} strokeWidth={1} />
      <text x={209} y={111} fontSize={9} fill={KOSC}>
        defensywa
      </text>
      <line x1={174} y1={33} x2={205} y2={20} stroke={PRZYGASZONA} strokeWidth={1} />
      <text x={209} y={22} fontSize={9} fill={KOSC}>
        rozkaz
      </text>
    </svg>
  );
}

/** Dwóch napastników na jednego obrońcę — suma ofensyw kontra defensywa. */
function RysunekStarcia() {
  return (
    <svg viewBox="0 0 250 180" width="100%" style={{ maxWidth: 340 }}>
      <text x={113} y={9} textAnchor="middle" fontSize={8} fill={PRZYGASZONA} letterSpacing="1.2">
        OBROŃCA
      </text>
      <Pole x={96} y={14} wariant="wrogi" etykieta="5" />

      <path d="M 62 100 L 102 52" stroke="var(--marzanna-jasna)" strokeWidth={2} fill="none" />
      <polygon points="108,46 98,50 104,56" fill="var(--marzanna-jasna)" />
      <path d="M 166 100 L 128 52" stroke="var(--marzanna-jasna)" strokeWidth={2} fill="none" />
      <polygon points="122,46 132,50 126,56" fill="var(--marzanna-jasna)" />

      <Pole x={45} y={104} wariant="moj" etykieta="3" />
      <Pole x={149} y={104} wariant="moj" etykieta="5" />
      <text x={113} y={150} textAnchor="middle" fontSize={8} fill={PRZYGASZONA} letterSpacing="1.2">
        TWOI NAPASTNICY
      </text>

      <text x={113} y={172} textAnchor="middle" fontSize={11} fontWeight="700" fill="var(--marzanna-jasna)">
        3 + 5 = 8 &gt; 5 → ginie
      </text>
    </svg>
  );
}

/** Naprzemienna deklaracja — kto mówi pierwszy, ten odsłania plan. */
function RysunekDeklaracji() {
  const wiersze = [
    { tekst: 'oddział 1 → atak', moj: false },
    { tekst: 'oddział 1 → obrona', moj: true },
    { tekst: 'oddział 2 → obrona', moj: false },
    { tekst: 'oddział 2 → atak', moj: true },
  ];
  return (
    <svg viewBox="0 0 250 162" width="100%" style={{ maxWidth: 340 }}>
      {/* Nagłówki kolumn u góry — pod spodem kolidowały z ostatnim wierszem. */}
      <text x={64} y={10} textAnchor="middle" fontSize={8} fill={PRZYGASZONA} letterSpacing="1.2">
        PRZECIWNIK
      </text>
      <text x={186} y={10} textAnchor="middle" fontSize={8} fill={PRZYGASZONA} letterSpacing="1.2">
        TY
      </text>

      {wiersze.map((w, i) => (
        <g key={w.tekst}>
          <rect
            x={w.moj ? 128 : 6}
            y={22 + i * 33}
            width={116}
            height={26}
            rx={2}
            fill={w.moj ? 'rgba(86,137,117,0.35)' : 'rgba(176,66,57,0.3)'}
            stroke="rgba(236,228,208,0.25)"
          />
          <text x={w.moj ? 186 : 64} y={39 + i * 33} textAnchor="middle" fontSize={9} fill={KOSC}>
            {w.tekst}
          </text>
          <text x={w.moj ? 118 : 132} y={39 + i * 33} fontSize={8} fill={PRZYGASZONA}>
            {i + 1}
          </text>
        </g>
      ))}
    </svg>
  );
}

/* ---------- Kroki ---------- */

type Krok = { tytul: string; rysunek: ReactNode; tresc: ReactNode };

const KROKI: Krok[] = [
  {
    tytul: 'Po co grasz',
    rysunek: <RysunekPrzelamania />,
    tresc: (
      <>
        <p>
          Wygrywa ten, kto wyprowadzi <strong>przełamanie o sile {CONFIG.breakthroughThreshold}</strong>.
        </p>
        <p>
          Przełamanie liczysz tak: znajdź kolumnę, w której <strong>przednie pole
          przeciwnika jest puste</strong>, i zsumuj ofensywę swoich oddziałów stojących
          w tej kolumnie — z obu rzędów.
        </p>
        <p className="drobne">
          Na rysunku kolumna przeciwnika stoi otworem, a twoje oddziały dają 5 + 3 = 8.
          Brakuje jeszcze {CONFIG.breakthroughThreshold - 8} — otwórz drugą kolumnę
          albo wstaw tam kogoś mocniejszego.
        </p>
      </>
    ),
  },
  {
    tytul: 'Z czego składa się tura',
    rysunek: (
      <ol className="fazy-poradnika">
        <li><strong>Dobieranie</strong> — uzupełnij rękę, wymień, co nie pasuje</li>
        <li><strong>Logistyka</strong> — wystawiaj oddziały, płacąc zaopatrzeniem</li>
        <li><strong>Strategia</strong> — wydaj rozkaz każdemu oddziałowi</li>
        <li><strong>Manewry</strong> — ostatnie poprawki kartami</li>
        <li><strong>Walka</strong> — starcie rozstrzyga się samo</li>
      </ol>
    ),
    tresc: (
      <>
        <p>
          Pięć faz, zawsze w tej kolejności. W logistyce i manewrach gracie
          <strong> na przemian po jednej karcie</strong>, aż obaj spasujecie.
        </p>
        <p>
          Zaopatrzenie to twój budżet na turę. Rośnie z każdą turą, więc w pierwszej
          stać cię na jeden tani oddział, a w piątej na kilka.
        </p>
        <p className="drobne">
          Panel po prawej stronie zawsze mówi, która to faza i co masz teraz zrobić.
        </p>
      </>
    ),
  },
  {
    tytul: 'Jak czytać oddział',
    rysunek: <RysunekZetonu />,
    tresc: (
      <>
        <p>
          <strong className="ofn">Ofensywa</strong> (czerwona, po lewej) — ile zadaje.
          <br />
          <strong className="def">Defensywa</strong> (zielona, po prawej) — ile wytrzyma.
        </p>
        <p>
          Kółko w rogu pokazuje <strong>rozkaz</strong>: ↑ atak, ⛊ obrona, · postój.
        </p>
        <p className="drobne">
          Gdy liczba ma złotą obwódkę, znaczy że jakaś reguła albo karta chwilowo
          ją zmieniła. Symbole pod nazwą to reguły specjalne — najedź, żeby przeczytać.
        </p>
      </>
    ),
  },
  {
    tytul: 'Kiedy oddział ginie',
    rysunek: <RysunekStarcia />,
    tresc: (
      <>
        <p>
          Zsumuj ofensywę <strong>wszystkich</strong> atakujących jedno pole. Jeśli suma
          <strong> przekroczy</strong> defensywę celu — cel ginie.
        </p>
        <p>
          Równo <em>nie</em> wystarczy. Pięć na pięć to za mało; trzeba sześć.
        </p>
        <p className="drobne">
          Dlatego pojedynczy oddział rzadko coś zabije. Uderzaj dwoma naraz.
          Oddział z rozkazem obrony oddaje ciosy — atak na obrońcę bywa kosztowny.
        </p>
      </>
    ),
  },
  {
    tytul: 'Jedyna trudna decyzja',
    rysunek: <RysunekDeklaracji />,
    tresc: (
      <>
        <p>
          Rozkazy wydajecie <strong>na przemian, po jednym oddziale</strong>, i są jawne
          od razu. Cofnąć się nie da.
        </p>
        <p>
          Kto deklaruje pierwszy, ten <strong>odsłania plan</strong> — przeciwnik może się
          dostosować. Dlatego pierwszy mówi gracz, który ma <strong>więcej oddziałów</strong>:
          przewaga na planszy kosztuje przewagę informacyjną.
        </p>
        <p className="drobne">
          Wniosek praktyczny: najpierw deklaruj oddziały, co do których jesteś pewny,
          a te wymagające reakcji zostaw na koniec.
        </p>
      </>
    ),
  },
];

/* ---------- Ekran ---------- */

export function Poradnik({ onZamknij }: { onZamknij: () => void }) {
  const [krok, setKrok] = useState(0);
  const ostatni = krok === KROKI.length - 1;
  const biezacy = KROKI[krok];

  return (
    <div className="poradnik">
      <div className="poradnik-naglowek">
        <span className="tytul-kasety">{T.menu.poradnik}</span>
        <span className="licznik-krokow">
          {krok + 1} / {KROKI.length}
        </span>
      </div>

      <div className="poradnik-tresc">
        <div className="poradnik-rysunek">{biezacy.rysunek}</div>
        <div className="poradnik-slowa">
          <h2>{biezacy.tytul}</h2>
          {biezacy.tresc}
        </div>
      </div>

      <div className="poradnik-kropki">
        {KROKI.map((k, i) => (
          <button
            key={k.tytul}
            type="button"
            className={`kropka${i === krok ? ' aktywna' : ''}`}
            onClick={() => setKrok(i)}
            title={k.tytul}
          />
        ))}
      </div>

      <div className="poradnik-przyciski">
        <button type="button" onClick={() => setKrok((k) => k - 1)} disabled={krok === 0}>
          {T.poradnik.wstecz}
        </button>
        {ostatni ? (
          <button type="button" className="glowny" onClick={onZamknij}>
            {T.poradnik.rozumiem}
          </button>
        ) : (
          <button type="button" className="glowny" onClick={() => setKrok((k) => k + 1)}>
            {T.poradnik.dalej}
          </button>
        )}
        <button type="button" onClick={onZamknij}>
          {T.poradnik.pomin}
        </button>
      </div>
    </div>
  );
}
