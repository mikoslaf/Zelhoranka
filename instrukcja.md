# Zelhoranka — instrukcja implementacyjna

Dokument roboczy projektu. Jest jednocześnie specyfikacją dla osoby (lub agenta) piszącego kod
i źródłem prawdy dla zasad gry. Wszystko, co nie wynika wprost z opisu gry, jest oznaczone jako
**ZAŁOŻENIE** (przyjęta interpretacja, można zmienić) albo **DO ROZSTRZYGNIĘCIA** (blokuje
implementację fragmentu silnika — patrz §14).

---

## 1. Czym jest projekt

Zelhoranka to dwuosobowa gra karciano-planszowa w świecie fantasy (Zelhor, Aranor, Desilvar).
Gracze werbują oddziały na 16-polową linię bitewną, zarządzają zaopatrzeniem, w tajemnicy
deklarują ataki i obrony, a następnie jednocześnie rozstrzygają starcie. Wygrywa ten, kto
wyprowadzi na tyły przeciwnika przełamanie o łącznej sile co najmniej 15.

Aplikacja: gra webowa 2D, widok z góry (płaski stół), działająca w pełni lokalnie, docelowo
w trybie kiosk w maszynie wirtualnej.

### 1.1 Mapowanie na kryteria zaliczenia

| Wymóg wykładowcy | Jak realizuje to projekt |
|---|---|
| Mechanika planszowa | Tury i fazy, dobieranie kart, żetony/oddziały na planszy, zarządzanie zasobem (zaopatrzenie), rzut kostką przy losowaniu inicjatywy |
| Perspektywa top-down | Plansza 4×4 pola na oś, rysowana płasko, kamera prostopadle z góry |
| Zakaz 3D/izometrii | Zero WebGL/Three.js, zero `perspective`, zero `rotate3d` na planszy (patrz §10.3) |
| Multimedia | Assety graficzne kart/pól/UI + warstwa dźwiękowa z manifestem (§8, §9) |
| Czystość kodu | `.gitignore` + skrypt pakujący (§12) |

---

## 2. Stos technologiczny i zasady architektury

**Ustalone:** Vite + TypeScript + React. Tryb rozgrywki: hot-seat z ekranem zasłony (§11.1);
przeciwnik komputerowy to opcjonalne rozszerzenie na koniec, nie warunek zaliczenia.

Zasady, których trzymamy się bezwzględnie:

1. **Silnik jest czysty.** Katalog `src/silnik/` to wyłącznie TypeScript: zero DOM, zero
   importów z Reacta, zero `Math.random()`. Cała logika to funkcje czyste
   `(stan, akcja) => { stan, zdarzenia }`. Dzięki temu reguły da się testować jednostkowo,
   a komisja widzi, że mechanika ma pokrycie testami.
2. **Losowość jest deterministyczna.** Jeden generator z ziarnem (`src/silnik/rng.ts`,
   np. mulberry32). Ziarno zapisane w stanie gry → powtarzalne rozgrywki, powtarzalne testy,
   możliwość „replayu" na obronie.
3. **UI nie zna zasad.** Warstwa widoku renderuje stan i wysyła akcje. Nie liczy obrażeń,
   nie sprawdza legalności ruchu — o to pyta silnik (`czyAkcjaLegalna`).
4. **Zdarzenia napędzają animacje i dźwięk.** Reducer zwraca listę zdarzeń
   (`KARTA_ZAGRANA`, `JEDNOSTKA_ZGINELA`, `FAZA_ZMIENIONA`...). Warstwa mediów tylko je
   konsumuje. Dodanie nowego dźwięku = wpis w manifeście, nie zmiana w logice.
5. **Dane, nie kod.** Karty, reguły specjalne, dźwięki i konfiguracja zasad siedzą w plikach
   JSON. Dodanie karty nie wymaga dotykania komponentów.
6. **Nazewnictwo.** Identyfikatory w kodzie i klucze JSON po angielsku, wszystkie teksty
   widoczne dla gracza po polsku (jeden plik `src/ui/teksty.ts`). Jeśli wolisz polskie klucze —
   zmień konsekwentnie w §4 i w typach.

Zależności trzymamy przy ziemi: React, Vite, TypeScript, Vitest. Bez UI-kitów, bez bibliotek
animacji, bez state managerów — stan gry to i tak jeden obiekt z reducerem.

### 2.1 Spięcie silnika z Reactem

Jeden `useReducer` na samej górze drzewa, kontekst do odczytu, `dispatch` przez własny hook.
Silnik zwraca parę `{ state, events }`, więc reducer Reacta go opakowuje i odkłada zdarzenia
do kolejki animacji:

```tsx
// src/ui/GameProvider.tsx
type Wrapped = { game: GameState; queue: GameEvent[] };

function wrapped(prev: Wrapped, action: GameAction): Wrapped {
  const { state, events } = reduce(prev.game, action);   // czysty silnik, zero Reacta
  return { game: state, queue: [...prev.queue, ...events] };
}
```

Reguły obowiązujące w warstwie React:

- Komponenty czytają **tylko** `state` i selektory (`legalTargets`, `effOffense`,
  `canPlay`). Żaden komponent nie liczy obrażeń ani nie sprawdza legalności samodzielnie.
- `AnimationRunner` — jeden `useEffect` — zdejmuje zdarzenia z kolejki po kolei, odtwarza
  animację i dźwięk, a na czas odtwarzania ustawia `inputLocked`. Kliknięcia w tym czasie są
  **ignorowane, nie kolejkowane** (inaczej gracz „przeklika" całą fazę walki w ciemno).
- `Field` i `Card` w `React.memo`, klucz = `uid` jednostki, nigdy indeks tablicy — inaczej
  animacje przy usuwaniu martwych będą się gubić.
- Stan interfejsu (zaznaczona karta, podgląd zasięgu, otwarty modal, `viewPlayer`) trzymamy
  **osobno** od `GameState`. `GameState` ma się serializować do JSON bez śmieci z UI — to
  warunek zapisu partii i testów migawkowych.
- Zero `<form>`, zero `alert`/`confirm`/`prompt`. Potwierdzenia to własne modale w warstwie
  gry — w kiosku natywne dialogi przeglądarki wyglądają jak awaria i wychodzą poza ramy
  pełnego ekranu.

---

## 3. Struktura repozytorium

```
zelhoranka/
├─ instrukcja.md              ← ten dokument
├─ README.md                  ← krótko: jak uruchomić
├─ index.html
├─ package.json
├─ vite.config.ts
├─ tsconfig.json
├─ .gitignore
├─ public/
│  └─ assets/
│     ├─ cards/               ← awersy kart:  <id_karty>.webp
│     ├─ cards/backs/         ← rewersy:      back_<typ>.webp
│     ├─ symbols/             ← symbole reguł specjalnych: <id_reguly>.svg
│     ├─ board/               ← tło stołu, pola, linia bitewna
│     ├─ ui/                  ← ikony, kostka, ramki, kursory
│     ├─ fonts/               ← kroje self-hosted (offline!)
│     └─ audio/               ← sfx/ i music/
├─ src/
│  ├─ data/
│  │  ├─ cards.json           ← baza kart
│  │  ├─ rules.json           ← słownik reguł specjalnych
│  │  ├─ audio.json           ← manifest dźwięków
│  │  └─ config.json          ← parametry zasad (§13)
│  ├─ silnik/
│  │  ├─ types.ts
│  │  ├─ state.ts             ← tworzenie i klonowanie stanu
│  │  ├─ actions.ts           ← typy akcji + walidacja legalności
│  │  ├─ reducer.ts           ← wejście: (stan, akcja) → (stan, zdarzenia)
│  │  ├─ board.ts             ← pola, strefy, sąsiedztwo, zasięgi
│  │  ├─ phases/
│  │  │  ├─ draw.ts
│  │  │  ├─ logistics.ts
│  │  │  ├─ strategy.ts
│  │  │  ├─ maneuvers.ts
│  │  │  └─ combat.ts
│  │  ├─ victory.ts
│  │  ├─ rules/               ← implementacje słów kluczowych
│  │  │  ├─ index.ts          ← rejestr id → hooki
│  │  │  └─ *.ts
│  │  ├─ rng.ts
│  │  └─ __tests__/
│  ├─ ai/                     ← przeciwnik komputerowy (§11)
│  ├─ media/
│  │  ├─ audio.ts             ← AudioManager + fallback
│  │  ├─ images.ts            ← ładowanie + placeholdery
│  │  └─ preload.ts
│  ├─ ui/
│  │  ├─ screens/             ← Menu, Gra, Zasłona, Podsumowanie
│  │  ├─ components/          ← Karta, Pole, Reka, Panel, Kostka, Log
│  │  ├─ styles/tokens.css    ← paleta i skala typograficzna
│  │  └─ teksty.ts
│  └─ main.tsx
└─ tools/
   ├─ validate-cards.ts       ← walidacja cards.json + istnienia plików graficznych
   └─ make-placeholders.ts    ← generowanie tymczasowych grafik kart
```

---

## 4. Model danych

### 4.1 Karta (`src/data/cards.json`)

Wspólne pola każdej karty:

| Pole | Typ | Opis |
|---|---|---|
| `id` | string | `snake_case`, unikalny. **Jest też nazwą pliku grafiki.** |
| `name` | string | Nazwa wyświetlana (PL) |
| `type` | enum | `RECRUIT` \| `SUPPLY` \| `AMBUSH` \| `INTERVENTION` \| `MANEUVER` |
| `text` | string | Treść karty widoczna dla gracza |
| `rules` | string[] | Identyfikatory reguł specjalnych (§7) |
| `copies` | number | Ile egzemplarzy trafia do talii |
| `art` | string? | Ścieżka do grafiki. Brak = placeholder proceduralny |

Pola zależne od typu:

| Typ | Dodatkowe pola |
|---|---|
| `RECRUIT` | `offense`, `defense`, `cost`, `zones: ("MAIN"\|"FLANK"\|"REAR")[]`, `attack` |
| `SUPPLY` | `supply` — ile punktów zaopatrzenia daje karta |
| `AMBUSH` | `trigger` — identyfikator zdarzenia wyzwalającego, `cost` |
| `INTERVENTION` | `requirements` — lista warunków zagrania (bez kosztu zaopatrzenia) |
| `MANEUVER` | `effect` — identyfikator efektu modyfikującego deklaracje |

Obiekt `attack` (dla `RECRUIT`):

```jsonc
"attack": {
  "offsets": [0],        // kolumny względne: 0 = wprost, -1 / +1 = na ukos
  "reach": "FRONT",      // FRONT | DEEP | RANGED   (patrz §6.4)
  "fromRear": false      // czy jednostka może atakować stojąc we własnej tylnej linii
}
```

Przykładowe wpisy:

```jsonc
[
  {
    "id": "zelhorska_piechota",
    "name": "Piechota zelhorska",
    "type": "RECRUIT",
    "offense": 3, "defense": 5, "cost": 2,
    "zones": ["MAIN"],
    "attack": { "offsets": [0], "reach": "FRONT", "fromRear": false },
    "rules": ["tarcza_scienna"],
    "text": "Mur tarcz, za którym stoi całe królestwo.",
    "copies": 4,
    "art": "cards/zelhorska_piechota.webp"
  },
  {
    "id": "aranorscy_jezdzcy",
    "name": "Aranorscy jeźdźcy",
    "type": "RECRUIT",
    "offense": 5, "defense": 2, "cost": 3,
    "zones": ["FLANK"],
    "attack": { "offsets": [0, -1, 1], "reach": "DEEP", "fromRear": false },
    "rules": ["szarza"],
    "text": "Uderzają tam, gdzie linia jest najcieńsza.",
    "copies": 3,
    "art": "cards/aranorscy_jezdzcy.webp"
  },
  {
    "id": "tabor_prowiantowy",
    "name": "Tabor prowiantowy",
    "type": "SUPPLY",
    "supply": 2,
    "rules": [],
    "text": "Dwie punkty zaopatrzenia. Odrzuć po zapłacie.",
    "copies": 6,
    "art": "cards/tabor_prowiantowy.webp"
  },
  {
    "id": "falszywy_rozkaz",
    "name": "Fałszywy rozkaz",
    "type": "MANEUVER",
    "effect": "retarget_one",
    "rules": [],
    "text": "Przekieruj atak jednego własnego oddziału na inny cel w jego zasięgu.",
    "copies": 2,
    "art": "cards/falszywy_rozkaz.webp"
  }
]
```

### 4.2 Plansza

16 pól, 8 na gracza. Identyfikatory: `<gracz>-<rząd><kolumna>`, gdzie rząd `F` = linia
przednia, `R` = tylna. Kolumny 0–3 liczone **tak samo dla obu graczy**, więc `P1-F2` stoi
naprzeciw `P2-F2` — to upraszcza wyliczanie zasięgów.

| Pole | Strefa |
|---|---|
| `P*-F0`, `P*-F3` | `FLANK` |
| `P*-F1`, `P*-F2` | `MAIN` |
| `P*-R0` … `P*-R3` | `REAR` |

Na jednym polu stoi maksymalnie jedna jednostka. Kartę werbunku można zagrać wyłącznie na pole,
którego strefa znajduje się w jej `zones`.

### 4.3 Stan gry

```ts
type GameState = {
  turn: number;
  phase: Phase;                    // DRAW | LOGISTICS | STRATEGY | MANEUVERS | COMBAT | END
  activePlayer: PlayerId;          // czyja jest akcja w fazie naprzemiennej
  firstPlayer: PlayerId;           // kto rozpoczyna tę turę
  players: Record<PlayerId, PlayerState>;
  board: Record<FieldId, Unit | null>;
  orders: Record<PlayerId, Order[]>;   // ukryte do fazy walki
  revealed: boolean;                   // czy rozkazy zostały odkryte
  log: LogEntry[];
  rng: RngState;
  winner: PlayerId | 'DRAW' | null;
};

type PlayerState = {
  deck: CardId[];
  hand: CardId[];
  discard: CardId[];
  ambushes: AmbushInPlay[];        // zakryte, do ujawnienia przy triggerze
  supplyPool: number;              // dostępne w tej turze
  supplySpent: number;
  mulligansUsed: number;
  passedManeuvers: boolean;
};

type Unit = {
  uid: string;                     // instancja, nie definicja
  cardId: CardId;
  owner: PlayerId;
  field: FieldId;
  modifiers: Modifier[];           // tymczasowe: z manewrów, zasadzek, reguł
  dead: boolean;                   // znacznik ustawiany w fazie walki
};

type Order =
  | { unit: string; kind: 'ATTACK'; target: FieldId }
  | { unit: string; kind: 'DEFEND' }
  | { unit: string; kind: 'NONE' };
```

Statystyki efektywne zawsze liczymy funkcjami `effOffense(state, unit)` /
`effDefense(state, unit)` — nigdy nie odczytujemy `card.offense` bezpośrednio w UI ani w walce.

---

## 5. Układ ekranu

Widok z góry, przeciwnik u góry, gracz na dole. Plansza dokładnie pośrodku, ręka w dolnej
krawędzi jak karty trzymane nad stołem.

```
┌──────────────────────────────────────────────────────────────┐
│  ┌ przeciwnik ─────────────────────────┐   ┌ tura / faza ──┐  │
│  │ ręka (rewersy) · talia · odrzucone  │   │  Tura 4       │  │
│  └─────────────────────────────────────┘   │  Logistyka    │  │
│                                            │  ⚑ P2 zaczyna │  │
│        [P2-R0][P2-R1][P2-R2][P2-R3]        └───────────────┘  │
│        [P2-F0][P2-F1][P2-F2][P2-F3]        ┌ zaopatrzenie ─┐  │
│  ══════════ LINIA BITEWNA ══════════       │  ●●●○○  3/5   │  │
│        [P1-F0][P1-F1][P1-F2][P1-F3]        └───────────────┘  │
│        [P1-R0][P1-R1][P1-R2][P1-R3]        ┌ dziennik ─────┐  │
│                                            │  …            │  │
│  ┌ twoja ręka ─────────────────────────┐   └───────────────┘  │
│  │  [karta][karta][karta][karta][karta]│   [ Zakończ fazę ]   │
│  └─────────────────────────────────────┘                      │
└──────────────────────────────────────────────────────────────┘
```

Zasady układu:

- Stała proporcja 16:9. Cała scena w kontenerze skalowanym `transform: scale()` do rozmiaru
  okna → kiosk w dowolnej rozdzielczości wygląda identycznie, nic się nie przewija.
- Pola planszy kwadratowe, jednakowe, z wyraźnym rozróżnieniem stref (flanka / główna / tylna)
  — rozróżnienie graficzne, nie tylko podpis.
- Skrajne kolumny (flanki) lekko odsunięte od centrum, żeby podział linii był czytelny bez
  czytania etykiet.
- Karta w ręce: 150×210 px CSS. Jednostka na planszy: mniejszy żeton/kafel 128×128 px
  z nazwą, ofensywą, defensywą i symbolami reguł.
- Panel boczny po prawej: faza, licznik zaopatrzenia, dziennik zdarzeń, przycisk kończący fazę.
  Dziennik jest ważny — to on tłumaczy graczowi, dlaczego oddział zginął.

### 5.1 Kierunek wizualny (propozycja do nadpisania Twoimi grafikami)

Punkt odniesienia: gra wymyślona przez nadwornego błazna i wydawana w warsztacie
ilustratorskim — barwniki i materiały sprzed epoki przemysłowej, nie neon i nie „fantasy
z gry mobilnej".

Paleta (`src/ui/styles/tokens.css`):

```css
:root {
  --sukno:      #2A3A55;  /* len farbowany indygo — blat stołu */
  --kosc:       #E8DFC8;  /* papier kart, tekst na suknie      */
  --inkaust:    #1E2430;  /* atrament żelazowo-galusowy — linie, typografia */
  --mosiadz:    #B08A46;  /* zaopatrzenie, akcenty aktywne     */
  --marzanna:   #9E3B34;  /* atak, straty                      */
  --grynszpan:  #4E7A6A;  /* obrona, stany bezpieczne          */
}
```

Typografia: dwa kroje, oba **self-hosted w `public/assets/fonts/`** (kiosk działa offline,
Google Fonts z CDN odpadają):

- **Alegreya** — nazwy kart, nagłówki faz, teksty fabularne. Ma fakturę pisma drukarskiego
  i nie wygląda jak domyślny serif.
- **Archivo Narrow** (lub Barlow Condensed) — liczby, statystyki w rogach kart, UI.
  Wąski krój mieści dwucyfrowe wartości w małych polach bez zmniejszania stopnia.

Zasada wydawania odwagi: mocny jest **stół i karta**. Panele, przyciski i dziennik mają być
ciche — cienka ramka w kolorze inkaustu, brak cieni, brak gradientów. Jeden akcent naraz:
podświetlenie pola, na które można zagrać.

---

## 6. Zasady w formie algorytmicznej

### 6.0 Przygotowanie

1. Zbuduj talię każdego gracza z `cards.json` (każda karta ×`copies`), potasuj generatorem
   z ziarnem.
2. Rozdaj po 7 kart.
3. Ustal gracza rozpoczynającego turę 1 losowo — **pokazywane graczowi jako animowany rzut
   kostką** (spełnia wymóg „rzuty kostką" i dźwięk rzutu z wytycznych).
4. `turn = 1`, `phase = DRAW`.

> **DO ROZSTRZYGNIĘCIA (§14.1):** czy gracze mają dwie identyczne talie, jedną wspólną, czy
> talie budowane przed grą. Domyślnie przyjmuję **dwie identyczne talie** — symetria ułatwia
> balans i testy.

### 6.1 Faza dobierania

1. Gracz dobiera z własnej talii aż będzie miał 7 kart na ręce. Twardy limit ręki to 8
   (efekty kart mogą przekroczyć 7, ale nie 8 — nadmiar odrzucamy natychmiast).
2. Wymiana kart:
   - tura 1: można wymienić **całą rękę**;
   - tury kolejne: można wymienić **do 3 kart**;
   - po wymianie 2 kart można **odrzucić 1 kartę z ręki, by wymienić całą resztę**.
     Operację można powtarzać, dopóki na ręce zostanie co najmniej 1 karta.
3. Wymienione karty trafiają na stos odrzuconych, dobranie uzupełnia rękę do 7.
4. Jeśli w tej fazie którakolwiek talia się wyczerpie → gra kończy się po tej turze
   rozstrzygnięciem porównawczym (§6.6).

> **ZAŁOŻENIE:** talia się **nie** przetasowuje ze stosu odrzuconych. Wyczerpanie talii to
> mechanizm kończący grę, opisany w warunkach zwycięstwa.
> **DO ROZSTRZYGNIĘCIA (§14.4):** czy „po wymienieniu dwóch kart" znaczy „dwóch z limitu 3",
> a jeśli tak — czy trzecia wymiana wciąż przysługuje po skorzystaniu z odrzutu.

### 6.2 Faza logistyki

Rozgrywana **naprzemiennie, po jednej karcie**. Gracz rozpoczynający tę fazę zmienia się co
turę (`firstPlayer` alternuje). Gracz, który nie chce już nic zagrać, pasuje; drugi może grać
dalej sam.

Zaopatrzenie w danej turze:

```
limit          = config.supplyLimitPerTurn(turn)   // domyślnie: turn
supplyPool     = 1 (baza)  +  Σ supply zagranych kart zaopatrzenia,  przycięte do limit
```

Akcje dostępne w tej fazie:

- **Zagraj kartę zaopatrzenia** → odrzuć ją, `supplyPool += card.supply` (do limitu).
- **Zagraj kartę werbunku** na wskazane puste pole → wymaga `supplyPool - supplySpent >= cost`
  oraz zgodności strefy pola z `card.zones`. Karta trafia na planszę jako `Unit`,
  `supplySpent += cost`.
- **Zagraj kartę zasadzki** → ląduje zakryta w `player.ambushes`, czeka na swój `trigger`.
- **Pasuj.**

> **ZAŁOŻENIE (§14.2, §14.3):** zamiast „zapłać jedną kartą zaopatrzenia o odpowiadającej
> liczbie punktów" przyjmuję **pulę zaopatrzenia**: karty zaopatrzenia dokładają punkty do
> puli, z puli płacisz koszty. Jest to jedyna interpretacja, w której zasada „bazowo 1
> zaopatrzenia" i „limit równy numerowi tury" składają się w spójną całość. Jeśli zależy Ci
> na płatności 1:1 kartą o dokładnie równej wartości, zmień `config.supplyModel` na `"exact"`
> — funkcja `canPay()` ma być jedynym miejscem, które o tym decyduje.

### 6.3 Faza strategii

Obaj gracze **równolegle i w tajemnicy** przypisują rozkaz każdej własnej żywej jednostce:

- `ATTACK(cel)` — cel musi leżeć w zasięgu jednostki (§6.4),
- `DEFEND`,
- `NONE`.

W trybie hot-seat faza przebiega sekwencyjnie, rozdzielona ekranem zasłony (§11.1).
Rozkazy trafiają do `state.orders[player]` i **nie są renderowane** dla drugiej strony aż do
odkrycia w fazie walki.

### 6.4 Zasięgi ataku

Dla jednostki stojącej na polu `(rząd, kolumna=c)` gracza P, cele wyznaczamy tak:

1. Kolumny docelowe: `c + offset` dla każdego `offset` z `attack.offsets`, odrzucając kolumny
   spoza zakresu 0–3.
2. Rząd docelowy zależy od `attack.reach`:
   - `FRONT` — wyłącznie `ENEMY-F<kol>`; jeśli to pole jest puste, atak w tę kolumnę
     jest niemożliwy.
   - `DEEP` — `ENEMY-F<kol>`, a jeśli jest puste, to `ENEMY-R<kol>`.
   - `RANGED` — `ENEMY-F<kol>` **albo** `ENEMY-R<kol>`, niezależnie od tego, czy przednie
     pole jest zajęte.
3. Jednostka stojąca we własnej tylnej linii atakuje **tylko** gdy `attack.fromRear === true`.
   To nadaje tylnej linii sens: stoją tam ostrzał, wsparcie i rezerwa.

Ograniczenie stref (główna/flanka) dotyczy **rozmieszczania**, nie celowania — jednostka
z flanki może atakować na ukos pole linii głównej.

> **DO ROZSTRZYGNIĘCIA (§14.9):** w opisie gry nie ma reguł ruchu. Przyjmuję, że jednostki
> **nie przemieszczają się** między polami — raz rozmieszczone stoją do śmierci, a „droga na
> tyły" jest sprawdzana abstrakcyjnie (§6.6). Jeśli ruch ma istnieć, trzeba dopisać osobną
> podfazę i zmienić warunek zwycięstwa.

### 6.5 Faza manewrów

Gracze na przemian zagrywają po jednej karcie manewru, zaczynając od `firstPlayer`, aż obaj
spasują z rzędu. Manewr modyfikuje **deklaracje** (nie planszę): przekierowanie ataku, zmiana
rozkazu na obronę, anulowanie ataku, dołożenie modyfikatora statystyk.

Tu też rozpatrujemy zasadzki, których `trigger` odpowiada zdarzeniom tej fazy.

Efekty manewrów implementujemy jako wpisy w rejestrze (§7), nie jako `switch` w komponencie.

### 6.6 Faza walki

Rozstrzygana **jednocześnie** na zamrożonej migawce stanu — żadna śmierć nie wpływa na
obliczenia w tej samej fazie. Kolejność kroków:

```
1. Odkryj rozkazy obu stron (zdarzenie ORDERS_REVEALED → animacja + dźwięk).
2. Policz statystyki efektywne wszystkich żywych jednostek (modyfikatory, reguły, manewry).
3. attackersOf[cel] = wszystkie jednostki z rozkazem ATTACK wymierzonym w to pole.
4. Wsparcie obrońców (zasada dodatkowa 3):
   dla każdej jednostki O z rozkazem DEFEND
     dla każdego napastnika X atakującego O
       jeżeli X sam jest przez kogoś atakowany:
         support[X] += effDefense(O)
5. Dla każdej jednostki U:
     incoming = Σ effOffense(a) dla a ∈ attackersOf[U]  +  support[U]
     jeżeli incoming > effDefense(U)  →  oznacz U jako martwą
6. Odwet obrońców:
     dla każdej jednostki U z rozkazem DEFEND:
       pula = effDefense(U)
       dla każdego a ∈ attackersOf[U], posortowanych malejąco po ofensywie:
         jeżeli pula > effOffense(a):
            oznacz a jako martwą;  pula -= (effOffense(a) + 1)
         w przeciwnym razie: przerwij
7. Pojedynki wzajemne (zasada dodatkowa 6):
     dla każdej pary (A,B), gdzie A atakuje pole B i B atakuje pole A:
       jeżeli off(A) > off(B) → B martwa
       jeżeli off(B) > off(A) → A martwa
       remis → obie przeżywają        // config.duelTie: "both_live" | "both_die"
8. Usuń wszystkie oznaczone jednostki naraz, karty trafiają na stos odrzuconych.
9. Sprawdź warunki zwycięstwa (§6.7). Jeśli brak rozstrzygnięcia: turn += 1, faza DRAW.
```

Uwagi do implementacji:

- Porównania są **ostre** (`>`, nie `>=`): „przekracza defensywę" znaczy przekracza.
- Sortowanie napastników w kroku 6 musi być stabilne i deterministyczne: ofensywa malejąco,
  potem defensywa malejąco, potem identyfikator pola — inaczej testy będą migotać.
- Kroki 5, 6 i 7 czytają **tę samą migawkę**. Jednostka może zostać oznaczona jako martwa
  kilkoma drogami; to nie jest błąd.
- Każde oznaczenie generuje zdarzenie z powodem (`"przewaga ofensywy 7 > 5"`,
  `"odwet obrońcy"`, `"pojedynek"`) — dziennik i animacje biorą to stąd.

> **DO ROZSTRZYGNIĘCIA (§14.7, §14.8):** (a) czy zasada pojedynku zastępuje zwykłe liczenie
> ofensywa-kontra-defensywa, czy je uzupełnia — przyjąłem, że uzupełnia; (b) czy przy odwecie
> z pulą niewystarczającą na największego napastnika wolno „przeskoczyć" do mniejszego, którego
> stać zabić — przyjąłem, że nie („priorytet dla największych" czytam dosłownie).

### 6.7 Warunki zwycięstwa

Sprawdzane **na koniec tury**, po usunięciu martwych.

**Przełamanie (główny warunek):**

```
function breakthrough(state, player):
    total = 0
    dla kolumny c = 0..3:
        jeżeli pole ENEMY-F<c> jest puste:
            dla u ∈ { OWN-F<c>, OWN-R<c> } jeśli jednostka istnieje:
                total += effOffense(u)
    zwróć total >= config.breakthroughThreshold   // domyślnie 15
```

**Wyczerpanie talii:** gdy talia któregokolwiek gracza się skończyła, po zakończeniu bieżącej
tury wygrywa gracz o większej łącznej ofensywie żywych jednostek na planszy. Równość → remis.

Jeśli w tej samej turze warunek przełamania spełniają obaj gracze → wygrywa ten z wyższą sumą
przełamania; przy równej sumie remis.

> **DO ROZSTRZYGNIĘCIA (§14.6):** definicja „wolnej drogi" jest moją propozycją. Alternatywy:
> liczyć tylko jednostki z linii przedniej; wymagać, by kolumna była pusta na **obu** rzędach
> przeciwnika; pozwolić jednostkom ze skosem liczyć się w sąsiedniej otwartej kolumnie.
> Funkcja `breakthrough()` jest celowo jednym miejscem do podmiany.

---

## 7. Reguły specjalne (symbole na kartach)

Każda karta ma u dołu symbole reguł. Reguła to wpis w `src/data/rules.json` plus funkcja
w `src/silnik/rules/`:

```jsonc
{
  "id": "szarza",
  "name": "Szarża",
  "symbol": "symbols/szarza.svg",
  "text": "W turze rozmieszczenia ofensywa +2.",
  "hooks": ["modifyOffense"]
}
```

Dostępne hooki (wszystkie czyste, wszystkie opcjonalne):

| Hook | Kiedy wywoływany |
|---|---|
| `onDeploy` | po położeniu jednostki na planszy |
| `canDeploy` | dodatkowe ograniczenia rozmieszczania |
| `modifyOffense` | przy liczeniu ofensywy efektywnej |
| `modifyDefense` | przy liczeniu defensywy efektywnej |
| `modifyRange` | przy wyznaczaniu dozwolonych celów |
| `onOrderDeclared` | po przypisaniu rozkazu |
| `beforeCombat` | przed krokiem 5 fazy walki |
| `afterCombat` | po usunięciu martwych |
| `onDeath` | gdy jednostka ginie |
| `canPlay` | warunki zagrania kart interwencji |

Dodanie nowej reguły = wpis w JSON + funkcja + plik SVG symbolu. Zero zmian w komponentach.
Rejestr (`rules/index.ts`) mapuje `id → { hook: fn }`; brak implementacji dla zadeklarowanego
`id` ma **rzucać błąd przy starcie** (łatwiej złapać literówkę niż cichy brak efektu).

Minimalny zestaw na start — 6 reguł wystarczy, by gra miała głębię:
osłona (chroni sąsiada), szarża (premia w turze wejścia), ostrzał (`RANGED`),
niezłomność (przeżywa pierwsze oznaczenie śmierci), zwiadowca (podgląd jednej deklaracji),
zaopatrzeniowiec (karta zaopatrzenia wraca na rękę zamiast na stos odrzuconych).

---

## 8. Kontrakt na grafiki

Najważniejsza sekcja pod kątem „grafiki zrobię sam". Trzymamy się jej, żeby wrzucenie plików
do katalogu było jedyną czynnością potrzebną do podmiany oprawy.

### 8.1 Zasady

1. **Żadna ścieżka do grafiki nie występuje w kodzie komponentów.** Wszystko idzie przez
   `card.art` / `rules.json` / manifest.
2. **Nazwa pliku = `id` karty.** `zelhorska_piechota` → `public/assets/cards/zelhorska_piechota.webp`.
3. **Statystyki NIE są wypalone w grafice.** Ofensywa, defensywa, koszt i symbole reguł są
   rysowane przez aplikację jako warstwa DOM/SVG nad ilustracją. Powody: liczby pozostają
   ostre w każdej skali, modyfikatory (+2 z szarży) da się pokazać na żywo, a Ty rysujesz samą
   ilustrację bez liczbowania 40 plików.
4. **Brakująca grafika nie psuje gry.** Jeżeli plik się nie wczyta, `images.ts` renderuje
   placeholder proceduralny: prostokąt w kolorze typu karty + nazwa + statystyki. Dzięki temu
   cała mechanika jest grywalna i testowalna, zanim powstanie pierwszy rysunek.
5. Format: **WebP** dla ilustracji (mała waga, kiosk startuje szybciej), **SVG** dla symboli
   i ikon UI. Bez plików >500 kB.

### 8.2 Wymiary i pola bezpieczne

| Element | Rozmiar pliku | Rozmiar na ekranie | Uwagi |
|---|---|---|---|
| Awers karty | 750 × 1050 px (proporcja 5:7) | 150 × 210 px | patrz układ niżej |
| Rewers karty | 750 × 1050 px | 150 × 210 px | jeden wspólny lub po jednym na typ |
| Żeton jednostki na planszy | 512 × 512 px | 128 × 128 px | kadr ilustracji, bez tekstu |
| Pole planszy | 512 × 512 px | 128 × 128 px | trzy warianty: główna / flanka / tylna |
| Tło stołu | 2560 × 1440 px | pełny ekran | kafelkowalne lub jedno duże |
| Symbol reguły | SVG, kanwa 64 × 64 | 24 × 24 px | jednobarwny, `currentColor` |
| Kostka | SVG lub 6 klatek 256 × 256 | 96 × 96 px | do animacji inicjatywy |

Układ awersu (aplikacja rysuje w tych obszarach, Ty zostawiasz je czyste):

```
┌─────────────────────────────┐ 750 × 1050
│ ⬛ 90×90  koszt      nazwa   │  ← pas górny, wys. 120 px
├─────────────────────────────┤
│                             │
│      ILUSTRACJA — pełna      │  ← obszar swobodny, 750 × 620
│      swoboda kompozycji      │
│                             │
├─────────────────────────────┤
│ tekst karty (2–3 wiersze)   │  ← wys. 180 px, tło półprzezroczyste
├─────────────────────────────┤
│ ⬛ OFN   ⬛ symbole   ⬛ DEF  │  ← pas dolny, wys. 130 px
└─────────────────────────────┘
```

Ilustracja może wchodzić pod pasy (aplikacja przyciemnia je gradientem), ale nic ważnego
kompozycyjnie nie powinno tam siedzieć.

### 8.3 Narzędzie pomocnicze

`tools/validate-cards.ts` — uruchamiane przed commitem:
sprawdza unikalność `id`, kompletność pól wymaganych dla typu, poprawność `zones` względem
`attack`, istnienie plików `art` i `symbol`, oraz czy każda reguła użyta w kartach ma
implementację. Wypisuje listę brakujących grafik — to jest Twoja lista zadań rysunkowych.

---

## 9. Dźwięk

Manifest `src/data/audio.json` mapuje zdarzenia silnika na pliki:

```jsonc
{
  "sfx": {
    "CARD_DRAWN":        "audio/sfx/draw.ogg",
    "CARD_PLAYED":       "audio/sfx/play.ogg",
    "UNIT_DEPLOYED":     "audio/sfx/deploy.ogg",
    "SUPPLY_SPENT":      "audio/sfx/coin.ogg",
    "DICE_ROLL":         "audio/sfx/dice.ogg",
    "ORDERS_REVEALED":   "audio/sfx/reveal.ogg",
    "COMBAT_START":      "audio/sfx/clash.ogg",
    "UNIT_DIED":         "audio/sfx/death.ogg",
    "PHASE_CHANGED":     "audio/sfx/phase.ogg",
    "ILLEGAL_ACTION":    "audio/sfx/deny.ogg",
    "GAME_WON":          "audio/sfx/fanfare.ogg",
    "GAME_LOST":         "audio/sfx/defeat.ogg"
  },
  "music": {
    "MENU":  "audio/music/menu.ogg",
    "GAME":  "audio/music/game.ogg"
  }
}
```

`src/media/audio.ts`:

- preload przy starcie z paskiem postępu (kiosk ma ruszyć bez zacięć),
- pula instancji na efekt, żeby kilka śmierci naraz nie ucinało dźwięku,
- **muzyka startuje dopiero po pierwszej interakcji użytkownika** (polityka autoplay
  w przeglądarkach — inaczej w kiosku nie zagra nic),
- brak pliku = cisza, nie wyjątek,
- widoczny przełącznik wyciszenia i suwak głośności, stan trzymany w pamięci sesji,
- format `.ogg` z fallbackiem `.mp3` (Chromium w kiosku obsłuży oba, ale niech kod nie zakłada).

---

## 10. Animacje i UX

### 10.1 Zasada

Animacje odtwarzają **strumień zdarzeń** z reducera, nie odwrotnie. Stan zmienia się od razu,
kolejka animacji nadąża i blokuje wejście na czas odtwarzania. Jeden `AnimationQueue`, który
przyjmuje zdarzenia i emituje `onDone`.

### 10.2 Sekwencja fazy walki (najważniejszy moment gry)

```
odkrycie rozkazów (0,4 s)
  → strzałki ataków rysują się od atakującego do celu (0,6 s, stagger 60 ms)
  → jednoczesne uderzenie: drgnięcie pól, błysk marzanny (0,3 s)
  → liczby obrażeń wypływają nad jednostkami (0,5 s)
  → martwe jednostki gasną i zsuwają się na stos odrzuconych (0,5 s)
  → wpisy w dzienniku pojawiają się zsynchronizowane z kolejnymi zgonami
```

### 10.3 Ograniczenia z wytycznych

Plansza musi zostać płaska. Zakazane: `perspective`, `rotate3d`, `rotateX`, cienie sugerujące
bryłę, rzut izometryczny, jakikolwiek WebGL. Dozwolone: `translate`, `scale`, `rotate` (w
płaszczyźnie ekranu), `opacity`, filtry. Obrót karty przy dobieraniu (`rotateY`) traktuję jako
dopuszczalny efekt interfejsu, ale jeżeli wolisz zero ryzyka przy ocenie — zastąp go przejściem
przez zwężenie w osi X (`scaleX: 1 → 0 → 1` z podmianą grafiki w punkcie zerowym), efekt
wizualny jest ten sam bez użycia transformacji 3D.

`prefers-reduced-motion: reduce` skraca wszystkie czasy do 0 i pomija stagger.

### 10.4 Pod kiosk

- Brak przewijania, brak zaznaczania tekstu, wyłączone menu kontekstowe i przeciąganie obrazków.
- Duże cele kliknięcia (min. 44 px).
- Przycisk „Nowa gra" zawsze dostępny.
- **Auto-reset po bezczynności** (domyślnie 5 min) → powrót do menu głównego. Stacja
  demonstracyjna nie może zostać zablokowana na porzuconej partii.
- Aplikacja nigdy nie potrzebuje paska adresu, okien systemowych ani dialogów przeglądarki
  (żadnych `alert`, `confirm`, `window.open`).

---

## 11. Tryb rozgrywki

**Tryb podstawowy: hot-seat z ekranem zasłony.** Dwie osoby przy jednej maszynie, sterowanie
przekazywane między fazami. Bot (§11.2) dokładamy tylko, jeśli zostanie czas.

### 11.1 Hot-seat z zasłoną

Tryb kiosk oznacza jeden ekran, a faza strategii wymaga tajności. Rozwiązanie: faza przebiega
sekwencyjnie, rozdzielona pełnoekranową zasłoną.

```
[P1 deklaruje rozkazy]  →  ZASŁONA „Przekaż sterowanie graczowi 2"
   →  [P2 deklaruje rozkazy]  →  ZASŁONA „Gotowi? Odkrywamy rozkazy"
      →  faza manewrów (jawna, naprzemienna)  →  faza walki (jawna)
```

Wymagania implementacyjne:

- **Odwrócenie perspektywy.** `viewPlayer` w stanie UI decyduje, która strona planszy jest na
  dole. Renderujemy jeden komplet komponentów przemapowany funkcją `fieldsFor(viewPlayer)` —
  nie dwa równoległe widoki.
- **Odmontowanie, nie ukrycie.** Przy zmianie gracza ekran gry idzie w całości do wymiany
  (`key={viewPlayer}`). Ukrywanie przez `display: none` zostawia rękę i rozkazy poprzednika
  w DOM, skąd da się je podejrzeć — a na obronie ktoś może o to zapytać.
- **Co musi zniknąć:** ręka poprzednika, jego strzałki ataków i podświetlenia, zakryte
  zasadzki, podgląd zasięgów, dziennik zwinięty do wpisów jawnych.
- **`orders[przeciwnika]` nie trafia do propsów** komponentów planszy, dopóki
  `state.revealed !== true`. To jedyna realna gwarancja tajności — reszta to kosmetyka.
- **Zasłona nie znika przypadkiem.** Duży przycisk plus 200 ms blokady po wejściu na ekran,
  żeby kliknięcie kończące poprzednią fazę nie przeleciało przez zasłonę.
- Zasłona pokazuje wyłącznie: czyja kolej, numer tury, przycisk. Zero informacji o stanie gry.
- Faza manewrów jest jawna dla obu stron (rozkazy są już odkryte), więc nie wymaga zasłony —
  gracze siedzą obok siebie i grają na przemian.

### 11.2 Przeciwnik komputerowy (opcjonalnie, etap 7)

Przydatny dla stacji demonstracyjnej — zwiedzający siada i gra sam. Bot działa na tym samym
publicznym API silnika (`legalActions(state, player)`), więc nie ma dostępu do ukrytych
informacji „po cichu".

Wystarczy heurystyka, bez drzewa gry:

- **Logistyka:** rozmieszczaj tam, gdzie własna kolumna jest najsłabsza względem kolumny
  przeciwnika; kupuj zaopatrzenie, jeśli w ręce jest karta werbunku droższa niż aktualna pula.
- **Strategia:** dla każdego przypisania rozkazu policz wynik symulacją `resolveCombat()` na
  kopii stanu (silnik jest czysty, więc to darmowa funkcja); wybierz przypisanie o najlepszym
  bilansie `zabite_wrogie_punkty − stracone_własne_punkty`, z premią za otwarcie kolumny.
  Przy 8 jednostkach i kilku celach przeszukanie zachłanne wystarcza.
- **Poziomy trudności:** szum losowy dodawany do oceny (łatwy = duży szum).

Bot nie dotyka silnika — korzysta z tego samego publicznego API, co interfejs, więc dołożenie
go później nie wymaga przepisywania żadnej fazy. Jeśli zabraknie czasu, sam hot-seat w pełni
spełnia wymagania zadania.

---

## 12. Testy, budowanie, pakowanie

### 12.1 Testy

Vitest, tylko dla `src/silnik/`. Minimalny, ale realnie broniący zestaw:

- rozmieszczanie: karta linii głównej odrzucona na flance, pole zajęte, brak zaopatrzenia;
- zaopatrzenie: limit rośnie z numerem tury, baza 1 działa w turze 1, nadwyżka przycięta;
- zasięgi: `FRONT` nie sięga tylnej linii, `DEEP` sięga po opróżnieniu pola, `fromRear=false`
  blokuje atak z tyłu;
- walka: suma ofensyw przekraczająca defensywę zabija; równa nie zabija; odwet obrońcy
  z priorytetem dla największego; wsparcie z zasady dodatkowej 3; pojedynek wzajemny;
- zwycięstwo: przełamanie dokładnie na 15 wygrywa, na 14 nie; wyczerpanie talii rozstrzyga
  porównaniem ofensyw;
- determinizm: ta sama sekwencja akcji przy tym samym ziarnie daje identyczny stan końcowy.

### 12.2 `.gitignore`

```
node_modules/
dist/
build/
.vite/
coverage/
*.local
.DS_Store
```

Uwaga z wytycznych: `dist/` usuwamy **tylko z archiwum wysyłanego na uploader**. Na maszynie
wirtualnej aplikacja ma być zbudowana i działająca.

### 12.3 Skrypty `package.json`

```jsonc
{
  "dev":      "vite",
  "build":    "tsc --noEmit && vite build",
  "preview":  "vite preview",
  "test":     "vitest run",
  "validate": "tsx tools/validate-cards.ts"
}
```

---

## 13. Plik konfiguracyjny zasad

`src/data/config.json` — wszystkie parametry, które mogą się zmienić po playtestach.
Silnik nigdy nie ma liczb magicznych w kodzie.

```jsonc
{
  "handSize": 7,
  "handMax": 8,
  "mulliganFirstTurn": "all",
  "mulliganLater": 3,
  "supplyBase": 1,
  "supplyLimitMode": "turn",       // "turn" | "turn_plus_base"
  "supplyModel": "pool",           // "pool" | "exact"
  "breakthroughThreshold": 15,
  "duelTie": "both_live",          // "both_live" | "both_die"
  "retaliationSkipUnaffordable": false,
  "reshuffleDiscard": false,
  "idleResetSeconds": 300
}
```

---

## 14. Kwestie do rozstrzygnięcia

Uporządkowane od najbardziej blokujących. Numeracja jest cytowana w poprzednich sekcjach.

1. **Talie.** Ile kart liczy talia, jaki jest rozkład typów i czy obaj gracze grają
   identycznymi taliami? Bez tego nie da się zbudować `cards.json`.
   *Propozycja startowa:* 40 kart na gracza — 16 werbunku, 12 zaopatrzenia, 4 zasadzki,
   4 interwencje, 4 manewry; obie talie identyczne.
2. **Zaopatrzenie: pula czy płatność 1:1.** Opis mówi „zapłacić kartą zaopatrzenia
   z odpowiadającą jej ilością punktów", ale punkty dodatkowe 1–2 opisują limit i bazę, co
   składa się w pulę. Przyjąłem pulę.
3. **Limit zaopatrzenia.** `limit = numer tury` czy `limit = numer tury + 1 (baza)`?
   Przy pierwszym wariancie baza 1 czyni karty zaopatrzenia bezużytecznymi w turze 1.
4. **Wymiana kart.** „Po wymienieniu dwóch kart" — dwóch z limitu trzech? Czy trzecia wymiana
   dalej przysługuje? Czy odrzut-i-wymiana działa też w turze 1?
5. **Kolejność gry.** Zasada główna mówi, że pierwszeństwo ma gracz z **większą** liczbą
   jednostek; punkt dodatkowy 5 — że wybiera gracz z **mniejszą**; punkt 7 — że w logistyce
   pierwszeństwo alternuje co turę. Te trzy zdania są sprzeczne. Przyjąłem: wybiera gracz
   z mniejszą liczbą jednostek, remis rozstrzyga rzut kostką, a w fazie logistyki dodatkowo
   alternuje kto zaczyna.
6. **„Wolna droga na tylną linię".** Moja definicja: kolumna, w której przednie pole
   przeciwnika jest puste; liczą się Twoje jednostki z obu rzędów tej kolumny.
   Potwierdzić albo podmienić.
7. **Pojedynek wzajemny.** Czy porównanie ofensyw **zastępuje** zwykłe liczenie
   ofensywa-kontra-defensywa, czy je uzupełnia? Co przy remisie ofensyw?
8. **Odwet obrońcy.** Czy przy puli niewystarczającej na największego napastnika wolno
   przydzielić punkty mniejszemu, którego stać zabić?
9. **Ruch jednostek.** Czy istnieje? W opisie go nie ma — przyjąłem, że nie.
10. **Zasadzki i interwencje.** Potrzebuję zamkniętej listy wyzwalaczy (`trigger`) i typów
    wymagań (`requirements`), zanim powstanie rejestr reguł. Na razie mam puste sloty.
11. **Manewry.** Jakie dokładnie operacje wolno wykonać? Przekierowanie ataku, zamiana
    rozkazu na obronę, anulowanie, modyfikator statystyk — to moja lista wyjściowa.
12. **Remis.** Czy w tej grze remis w ogóle istnieje, czy trzeba go rozstrzygać dogrywką?

---

## 15. Kolejność prac

| Etap | Zakres | Kiedy uznać za skończony |
|---|---|---|
| 1 | Szkielet Vite + typy + `cards.json` z 10 kartami + render planszy na placeholderach | Widać stół, pola i rękę; nic się nie dzieje |
| 2 | Faza dobierania i logistyki + pula zaopatrzenia | Da się rozstawić oddziały zgodnie ze strefami |
| 3 | Faza strategii + ekran zasłony (hot-seat) | Obaj gracze deklarują rozkazy w tajemnicy |
| 4 | Faza walki + warunki zwycięstwa + testy jednostkowe | Partia da się rozegrać do końca; testy zielone |
| 5 | Manewry, zasadzki, interwencje, rejestr reguł specjalnych | 6 reguł startowych działa i ma symbole |
| 6 | Assety, dźwięk, animacje, kostka inicjatywy | Podmiana grafiki = wrzucenie pliku |
| 7 | Ekrany menu/podsumowania, auto-reset, tryb demo (+ bot, opcjonalnie) | Można postawić przy kiosku i zostawić |
| 8 | Build produkcyjny, dokumentacja PDF, pakowanie | Archiwum bez `node_modules` i `dist` |

Etap 4 jest kamieniem milowym — do niego wszystko robimy na placeholderach, bez rysowania
czegokolwiek. Jeśli zabraknie czasu, etapy 1–6 wystarczają na kompletny, oceniany projekt;
etap 7 jest wartością dodaną.
