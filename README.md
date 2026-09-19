# Zelhoranka

Dwuosobowa gra karciano-planszowa w świecie fantasy (Zelhor, Aranor, Desilvar).
Gra webowa 2D, widok prostopadle z góry, działa w pełni lokalnie — docelowo w trybie
kiosk na maszynie wirtualnej.

Pełna specyfikacja zasad i architektury: [`instrukcja.md`](instrukcja.md).
Ten plik mówi, jak to uruchomić i gdzie co leży.

---

## Uruchomienie

```bash
npm install
npm run dev          # tryb deweloperski, http://localhost:5173
```

Wersja produkcyjna (ta ma stać na maszynie wirtualnej):

```bash
npm run build        # tsc --noEmit && vite build  →  dist/
npm run preview      # serwuje dist/ pod http://localhost:4173
```

Build używa ścieżek względnych (`base: './'`), więc `dist/` da się serwować
z dowolnego podkatalogu.

### Pozostałe skrypty

| Polecenie | Co robi |
|---|---|
| `npm test` | testy jednostkowe silnika (Vitest) |
| `npm run test:watch` | to samo, w trybie ciągłym |
| `npm run validate` | walidacja `cards.json` + lista brakujących grafik |
| `npm run placeholders` | generuje tymczasowe grafiki SVG (nie nadpisuje istniejących) |
| `npm run docs` | generuje `docs/dokumentacja.pdf` z plików danych projektu |
| `npm run pack` | archiwum do oddania, bez `node_modules/` i `dist/` |

---

## Stan realizacji

Plan prac z §15 instrukcji ma **8 etapów**. Poniżej stan każdego z nich.

| Etap | Zakres | Stan |
|---|---|---|
| 1 | Szkielet Vite + typy + `cards.json` + render planszy | gotowe |
| 2 | Faza dobierania i logistyki + pula zaopatrzenia | gotowe |
| 3 | Faza strategii + ekran zasłony (hot-seat) | gotowe, ale **ze świadomym odstępstwem** — zasłony nie ma, patrz „Pełna informacja zamiast tajności" |
| 4 | Faza walki + warunki zwycięstwa + testy jednostkowe | gotowe |
| 5 | Manewry, zasadzki, interwencje, rejestr reguł specjalnych | gotowe — 6 reguł startowych działa i ma symbole |
| 6 | Assety, dźwięk, animacje, kostka inicjatywy | gotowe na grafikach zastępczych; brak docelowych plików `.webp` i `.ogg` |
| 7 | Ekrany menu i podsumowania, auto-reset, bot | gotowe |
| 8 | Build produkcyjny, dokumentacja PDF, pakowanie | gotowe |

Kryterium etapu 8 („archiwum bez `node_modules` i `dist`") spełnia `npm run pack`.
Dokumentacja: [`docs/dokumentacja.pdf`](docs/dokumentacja.pdf), generowana poleceniem
`npm run docs` **z plików danych projektu**, więc liczby w niej nie rozjeżdżają się
z grą po zmianie balansu.

### Co pozostaje do zrobienia

Jedno: **właściwe pliki graficzne i dźwiękowe**. Gra jest w pełni grywalna bez nich —
`npm run validate` wypisuje dokładną listę brakujących plików, która jest zarazem listą
zadań rysunkowych. Podmiana oprawy nie wymaga żadnej zmiany w kodzie.

### Zakres

- **Silnik** — wszystkie fazy, warunki zwycięstwa, rejestr reguł specjalnych,
  deterministyczny RNG z ziarnem.
- **Interfejs** — plansza 4×4 na gracza, ręka, panel z dziennikiem, animacje
  starcia, rzut kostką o inicjatywę, ekrany menu i podsumowania.
- **Poradnik „Jak grać"** — pięć kroków z rysunkami dla kogoś, kto siada pierwszy raz;
  osobno od modalu „Zasady szczegółowe", który jest referencją, nie nauką gry.
- **Hot-seat z pełną informacją** — jawne ręce, naprzemienna jawna deklaracja rozkazów.
- **Multimedia** — manifest dźwięków, preload z paskiem postępu, placeholdery
  proceduralne dla brakujących grafik.
- **Przeciwnik komputerowy** — trzy poziomy trudności, działa na publicznym API silnika.
- **Testy** — 74 testy: zasady, zasięgi, walka, zwycięstwo, determinizm,
  naprzemienna deklaracja, wymiana duplikatów, bot, test dymny wszystkich ekranów.

---

## Struktura

```
src/
├─ data/            dane, nie kod: karty, reguły, dźwięki, konfiguracja zasad
├─ silnik/          czysty TypeScript — zero DOM, zero Reacta, zero Math.random()
│  ├─ phases/       po jednym module na fazę tury
│  ├─ rules/        implementacje reguł specjalnych (rejestr id → hooki)
│  └─ __tests__/    testy jednostkowe
├─ ai/              przeciwnik komputerowy
├─ media/           audio, obrazki, preload
└─ ui/              warstwa widoku: ekrany, komponenty, style, teksty PL
```

Trzy zasady, które trzymają ten projekt w kupie:

1. **Silnik jest czysty.** `reduce(stan, akcja) → { stan, zdarzenia }`. Dzięki temu
   reguły da się testować jednostkowo, a bot dostaje symulację starcia za darmo.
2. **UI nie zna zasad.** Komponenty pytają `czyAkcjaLegalna()` i renderują stan.
   Żaden komponent nie liczy obrażeń.
3. **Dane, nie kod.** Dodanie karty to wpis w `cards.json`, nie zmiana w komponencie.

---

## Podmiana grafiki i dźwięku

Żadna ścieżka do pliku nie występuje w kodzie komponentów — wszystko idzie przez
`cards.json`, `rules.json` i `audio.json`.

**Nazwa pliku = `id` karty.** `zelhorska_piechota` → `public/assets/cards/zelhorska_piechota.webp`.

```bash
npm run validate     # wypisze dokładną listę brakujących plików
```

Aplikacja szuka po kolei: `.webp` → `.svg` → placeholder proceduralny. Dlatego
wygenerowane zastępniki widać od razu, a wrzucenie właściwego `.webp` o tej samej
nazwie przesłania je bez żadnej zmiany w kodzie.

Żeton jednostki na planszy ma dłuższy łańcuch: `board/tokens/<id>.webp` → ilustracja
karty z `cards/<id>.webp` → `board/tokens/<id>.svg`. Osobne grafiki żetonów są więc
opcjonalne — bez nich zagrana karta pokazuje na polu tę samą ilustrację co w ręce.

Wymiary i pola bezpieczne opisuje §8.2 instrukcji. Najważniejsze:

| Element | Plik | Na ekranie |
|---|---|---|
| Awers karty | 750 × 1050 | 150 × 210 |
| Żeton jednostki | 512 × 512 | 128 × 128 |
| Pole planszy | 512 × 512 | 128 × 128 |
| Tło stołu | 2560 × 1440 | pełny ekran |
| Symbol reguły | SVG 64 × 64 | 24 × 24 |

**Statystyki nie są wypalone w grafice.** Ofensywa, defensywa, koszt i symbole rysuje
aplikacja warstwą DOM nad ilustracją — liczby są ostre w każdej skali, a modyfikatory
(np. +2 z szarży) widać na żywo.

**Dźwięk:** pliki `.ogg` (z fallbackiem `.mp3`) pod ścieżkami z `src/data/audio.json`.
Brak pliku = cisza, nie wyjątek.

**Kroje pisma:** wrzuć `Alegreya-Regular/Bold.woff2` i `ArchivoNarrow-Regular/Bold.woff2`
do `public/assets/fonts/`. Bez nich `@font-face` po cichu przepada i wchodzi krój
systemowy z tego samego stosu — gra wygląda spójnie, tylko mniej charakternie.

---

## Rozstrzygnięcia kwestii z §14 instrukcji

Wszystkie parametry siedzą w `src/data/config.json` — silnik nie ma liczb magicznych.
Zmiana ustawienia nie wymaga dotykania kodu.

| # | Kwestia | Przyjęte rozwiązanie | Gdzie zmienić |
|---|---|---|---|
| 1 | Talie | 40 kart na gracza (16 werbunku, 12 zaopatrzenia, 4 zasadzki, 4 interwencje, 4 manewry), obie identyczne | `cards.json` |
| 2 | Zaopatrzenie | Pula: karty zasilają pulę, z puli płacisz koszty | `config.supplyModel` |
| 3 | Limit zaopatrzenia | `numer tury + baza` — inaczej karty zaopatrzenia są bezużyteczne w turze 1 | `config.supplyLimitMode` |
| 4 | Wymiana kart | Tura 1: cała ręka. Dalej: 3 karty. Po dwóch wymianach można odrzucić 1 i wymienić resztę, póki zostaje ≥ 1 karta | `config.mulligan*` |
| 5 | Kolejność gry | Rozkaz pierwszy deklaruje gracz z **większą** liczbą jednostek (patrz „Pełna informacja" niżej), remis → alternacja; w logistyce alternuje, kto zaczyna | `reducer.ts: beginNextTurn()` |
| 6 | Wolna droga na tyły | Kolumna z pustym przednim polem przeciwnika; liczą się twoje jednostki z obu rzędów tej kolumny | `victory.ts: breakthroughScore()` |
| 7 | Pojedynek wzajemny | **Uzupełnia** zwykłe liczenie, nie zastępuje. Remis ofensyw → obaj przeżywają | `config.duelSupplementsDamage`, `config.duelTie` |
| 8 | Odwet obrońcy | Priorytet dla największych dosłownie: pula niewystarczająca na największego przerywa odwet | `config.retaliationSkipUnaffordable` |
| 9 | Ruch jednostek | Nie istnieje — raz rozmieszczone stoją do śmierci | — |
| 10 | Zasadzki i interwencje | Zamknięte listy: wyzwalacze `ENEMY_DEPLOYED`, `ORDERS_REVEALED`; wymagania `PHASE_LOGISTICS`, `PHASE_MANEUVERS`, `HAND_BELOW_MAX`, `HAS_UNIT_ON_BOARD` | `silnik/types.ts` |
| 11 | Manewry | `retarget_one`, `to_defend`, `buff_offense` | `phases/maneuvers.ts` |
| 12 | Remis | Istnieje: przy równym przełamaniu i przy równej ofensywie po wyczerpaniu talii | `victory.ts` |

Decyzje wykraczające poza §14, warte odnotowania:

- **Pełna informacja zamiast tajności** — patrz osobna sekcja niżej. To największe
  odstępstwo od instrukcji i pociągnęło za sobą przebudowę fazy strategii.
- **Limit tur** (`config.maxTurns`, domyślnie 40) jako bezpiecznik. Zasady z instrukcji
  nie gwarantują końca partii: jeśli obaj gracze przestaną cokolwiek zagrywać, ręka
  nie schodzi, talia się nie wyczerpuje i przełamanie nigdy nie rośnie — partia biegnie
  w nieskończoność. Po limicie rozstrzygamy tak samo jak przy wyczerpaniu talii.
  W praktyce rzadko się uruchamia: w 24 partiach botów zadziałał 4 razy, reszta
  skończyła się przełamaniem albo wyczerpaniem talii między 4. a 14. turą.

---

## Pełna informacja zamiast tajności

Instrukcja (§6.3, §11.1) zakładała rozkazy tajne, deklarowane jednocześnie i rozdzielone
ekranem zasłony. Projekt odszedł od tego: **ręce obu graczy są jawne, zasadzki widoczne,
a zasłona usunięta**. Zakryta zostaje wyłącznie zawartość talii — symetrycznie, bo nie zna
jej nikt.

Sama jawność rąk jest symetryczna i nieszkodliwa. Problem leżał gdzie indziej: przy
jednoczesnej deklaracji bez zasłony gracz deklarujący jako drugi widziałby komplet rozkazów
przeciwnika przed podjęciem własnych decyzji. To nie jest drobna przewaga, tylko
rozstrzygnięcie partii. Dlatego faza strategii została przebudowana:

| Mechanizm | Po co |
|---|---|
| Deklaracja **naprzemienna, po jednym oddziale** | Przewaga informacyjna rozkłada się na całą fazę zamiast trafiać w całości do drugiego gracza |
| Rozkazu **nie da się cofnąć** | Inaczej naprzemienność traci sens — każdy czekałby na ruch przeciwnika |
| Pierwszy deklaruje gracz z **większą** liczbą oddziałów | Przy jawnej deklaracji pierwszeństwo jest obciążeniem; przewaga na planszy kosztuje przewagę informacyjną. Mechanizm wyrównujący dla słabszej strony |
| Reguła **zwiadowca** przebudowana | Podglądanie rozkazu stało się bezużyteczne; teraz zwiadowca raz w turze koryguje własny rozkaz w fazie manewrów — przeciwwaga dla przymusu deklarowania się pierwszym |
| Koszt **Zasadzki w jarze** 2 → 1 | Zasadzki są jawne (przeciwnik widział kartę na ręce), więc straciły element zaskoczenia |

**Pomiar balansu.** 200 partii botów o równej sile, 189 rozstrzygniętych:

```
deklarujący DRUGI wygrał:  100  (52,9%)
deklarujący PIERWSZY:       89  (47,1%)
odchylenie od 50/50:       2,9 pkt proc.
```

Przy 189 próbach błąd losowy wynosi około ±3,6 pkt proc., więc odchylenie mieści się
w granicy szumu. Średnia długość partii: 15,6 tury.

---

## Tryb kiosk

- Scena ma stałą proporcję 16:9 i skaluje się do okna — w każdej rozdzielczości
  wygląda identycznie i nic się nie przewija.
- Brak zasłony i przekazywania sterowania: obaj gracze patrzą na ten sam ekran przez
  całą partię, nikt nie musi odwracać wzroku.
- Brak przewijania, zaznaczania tekstu, menu kontekstowego i przeciągania obrazków.
- Zero `alert` / `confirm` / `prompt` — potwierdzenia to własne modale.
- Auto-reset po 5 minutach bezczynności wraca do menu (`config.idleResetSeconds`).
- Muzyka startuje po pierwszej interakcji (polityka autoplay w przeglądarkach).
- `prefers-reduced-motion: reduce` zeruje wszystkie czasy animacji.

Plansza jest płaska zgodnie z wytycznymi: zero WebGL, zero `perspective`,
zero `rotate3d` i `rotateX`. Używane są wyłącznie `translate`, `scale`,
`rotate` w płaszczyźnie ekranu, `opacity` i filtry.

---

## Pakowanie do oddania

```bash
npm run build && npm test && npm run validate
npm run pack
```

Archiwum ląduje w `paczka/` bez `node_modules/` i `dist/`.
Na maszynie wirtualnej aplikacja ma być **zbudowana i działająca** — `dist/`
usuwamy tylko z archiwum wysyłanego na uploader.
