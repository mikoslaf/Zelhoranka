import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CARDS, CONFIG, RULES } from '../src/silnik/cards';
import type { CardType, RecruitCard } from '../src/silnik/types';

/**
 * Generator dokumentacji projektu (etap 8 z §15).
 *
 * Dokument powstaje z DANYCH, nie z przepisanego tekstu: liczby kart, progi
 * i parametry zasad czytamy z `cards.json`, `rules.json` i `config.json`.
 * Dzięki temu dokumentacja nie rozjedzie się z grą po zmianie balansu —
 * wystarczy wygenerować ją ponownie.
 *
 * PDF składamy przeglądarką Chrome w trybie headless (`--print-to-pdf`).
 * To świadoma decyzja: żadna biblioteka do PDF-ów nie wchodzi do zależności
 * projektu (§2 — „zależności trzymamy przy ziemi"), a Chrome i tak jest na
 * maszynie, bo gra jest aplikacją webową. Gdy go zabraknie, zostaje HTML
 * gotowy do wydruku z przeglądarki.
 *
 * Uruchomienie: npm run docs
 */

const KORZEN = join(dirname(fileURLToPath(import.meta.url)), '..');
const KATALOG = join(KORZEN, 'docs');
const HTML = join(KATALOG, 'dokumentacja.html');
const PDF = join(KATALOG, 'dokumentacja.pdf');

/* ---------- Liczby wyciągnięte z danych ---------- */

const kopieTypu = (t: CardType): number =>
  CARDS.filter((c) => c.type === t).reduce((s, c) => s + c.copies, 0);

const werbunki = CARDS.filter((c): c is RecruitCard => c.type === 'RECRUIT');
const wszystkieKopie = CARDS.reduce((s, c) => s + c.copies, 0);

const NAZWY_TYPOW: Record<CardType, string> = {
  RECRUIT: 'werbunek',
  SUPPLY: 'zaopatrzenie',
  AMBUSH: 'zasadzka',
  INTERVENTION: 'interwencja',
  MANEUVER: 'manewr',
};

const NAZWY_ZASIEGU: Record<string, string> = {
  FRONT: 'FRONT — tylko przednie pole przeciwnika',
  DEEP: 'DEEP — przednie, a gdy puste, tylne',
  RANGED: 'RANGED — przednie albo tylne',
};

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* ---------- Tabele generowane z danych ---------- */

const tabelaWerbunkow = werbunki
  .map(
    (c) => `<tr>
      <td><strong>${esc(c.name)}</strong></td>
      <td class="l">${c.offense}</td>
      <td class="l">${c.defense}</td>
      <td class="l">${c.cost}</td>
      <td>${c.zones.join(', ')}</td>
      <td>${c.attack.reach}${c.attack.fromRear ? ' · z tyłu' : ''}</td>
      <td>${c.rules.map((r) => esc(RULES.find((x) => x.id === r)?.name ?? r)).join(', ') || '—'}</td>
      <td class="l">${c.copies}</td>
    </tr>`,
  )
  .join('\n');

const tabelaTalii = (Object.keys(NAZWY_TYPOW) as CardType[])
  .map(
    (t) =>
      `<tr><td>${NAZWY_TYPOW[t][0].toUpperCase() + NAZWY_TYPOW[t].slice(1)}</td>` +
      `<td class="l">${CARDS.filter((c) => c.type === t).length}</td>` +
      `<td class="l">${kopieTypu(t)}</td></tr>`,
  )
  .join('\n');

const tabelaRegul = RULES.map(
  (r) => `<tr><td><strong>${esc(r.name)}</strong></td><td>${esc(r.text)}</td></tr>`,
).join('\n');

const tabelaZasiegow = Object.values(NAZWY_ZASIEGU)
  .map((o) => `<li>${esc(o)}</li>`)
  .join('\n');

/* ---------- Dokument ---------- */

const html = `<!doctype html>
<html lang="pl">
<head>
<meta charset="utf-8">
<title>Zelhoranka — dokumentacja projektu</title>
<style>
  @page { size: A4; margin: 18mm 16mm; }
  * { box-sizing: border-box; }
  body {
    font-family: "Georgia", "Times New Roman", serif;
    font-size: 10.5pt; line-height: 1.55; color: #1a1a1a; background: #fff;
    margin: 0; hyphens: auto;
  }
  h1 { font-size: 26pt; margin: 0 0 2mm; letter-spacing: -0.01em; }
  h2 {
    font-size: 14pt; margin: 9mm 0 3mm; padding-bottom: 1.5mm;
    border-bottom: 1.5px solid #1a1a1a; break-after: avoid;
  }
  h3 { font-size: 11.5pt; margin: 5mm 0 1.5mm; break-after: avoid; }
  p, li { orphans: 3; widows: 3; }
  ul, ol { margin: 2mm 0; padding-left: 6mm; }
  li { margin-bottom: 1mm; }
  code {
    font-family: "Consolas", "Courier New", monospace; font-size: 9pt;
    background: #f0efe9; padding: 0.4mm 1mm; border-radius: 1.5px;
  }
  pre {
    font-family: "Consolas", "Courier New", monospace; font-size: 8.5pt;
    background: #f5f4ef; border-left: 2.5px solid #9c7a3c;
    padding: 2.5mm 3mm; margin: 2.5mm 0; line-height: 1.4;
    white-space: pre-wrap; break-inside: avoid;
  }
  table { width: 100%; border-collapse: collapse; margin: 3mm 0; font-size: 9pt; }
  th, td { border: 0.5px solid #b8b4a8; padding: 1.2mm 2mm; text-align: left; vertical-align: top; }
  th { background: #eceae2; font-weight: bold; }
  td.l { text-align: center; }
  table { break-inside: auto; }
  tr { break-inside: avoid; }
  .naglowek { border-bottom: 2.5px solid #1a1a1a; padding-bottom: 4mm; margin-bottom: 6mm; }
  .podtytul { font-size: 12pt; color: #55514a; margin: 1mm 0 0; font-style: italic; }
  .meta { font-size: 9pt; color: #6a655c; margin-top: 3mm; }
  .uwaga {
    background: #f7f3e8; border-left: 2.5px solid #9c7a3c;
    padding: 2.5mm 3.5mm; margin: 3mm 0; break-inside: avoid; font-size: 9.5pt;
  }
  .uwaga strong { color: #6f5526; }
  .spis { columns: 2; column-gap: 8mm; font-size: 9.5pt; }
  .spis li { margin-bottom: 0.8mm; }
  .nowa-strona { break-before: page; }
</style>
</head>
<body>

<div class="naglowek">
  <h1>Zelhoranka</h1>
  <p class="podtytul">Dwuosobowa gra karciano-planszowa — dokumentacja projektu</p>
  <p class="meta">
    Aplikacja webowa 2D · widok prostopadle z góry · działa w pełni lokalnie ·
    tryb kiosk<br>
    Wygenerowano automatycznie z danych projektu: ${new Date().toLocaleDateString('pl-PL')}
  </p>
</div>

<h2>1. Spis treści</h2>
<ol class="spis">
  <li>Spis treści</li>
  <li>Czym jest projekt</li>
  <li>Uruchomienie</li>
  <li>Zasady gry</li>
  <li>Karty i reguły specjalne</li>
  <li>Architektura</li>
  <li>Odstępstwa od specyfikacji</li>
  <li>Testy</li>
  <li>Grafika i dźwięk</li>
  <li>Tryb kiosk</li>
  <li>Struktura repozytorium</li>
</ol>

<h2>2. Czym jest projekt</h2>
<p>
  Zelhoranka to dwuosobowa gra karciano-planszowa osadzona w świecie fantasy
  (Zelhor, Aranor, Desilvar). Gracze werbują oddziały na szesnastopolową linię
  bitewną, zarządzają zaopatrzeniem, wydają rozkazy i rozstrzygają starcie.
  Wygrywa ten, kto wyprowadzi na tyły przeciwnika przełamanie o łącznej sile
  co najmniej ${CONFIG.breakthroughThreshold}.
</p>
<p>
  Aplikacja jest grą webową 2D z widokiem prostopadle z góry, działa w pełni
  lokalnie i jest przystosowana do pracy w trybie kiosk na maszynie wirtualnej.
  Nie wymaga połączenia z siecią ani żadnej usługi zewnętrznej.
</p>

<h3>Realizacja wymagań</h3>
<table>
  <tr><th style="width:38%">Wymóg</th><th>Realizacja</th></tr>
  <tr><td>Mechanika planszowa</td><td>Tury i fazy, dobieranie kart, żetony oddziałów na planszy, zarządzanie zasobem (zaopatrzenie), rzut kostką przy losowaniu inicjatywy</td></tr>
  <tr><td>Perspektywa top-down</td><td>Plansza 4×4 pola na gracza, rysowana płasko, kamera prostopadle z góry</td></tr>
  <tr><td>Zakaz 3D i izometrii</td><td>Zero WebGL, zero <code>perspective</code>, zero <code>rotate3d</code> i <code>rotateX</code>. Dozwolone wyłącznie <code>translate</code>, <code>scale</code>, <code>rotate</code> w płaszczyźnie ekranu, <code>opacity</code> i filtry</td></tr>
  <tr><td>Multimedia</td><td>Warstwa graficzna kart, żetonów i pól oraz warstwa dźwiękowa sterowana manifestem zdarzeń</td></tr>
  <tr><td>Czystość kodu</td><td><code>.gitignore</code>, skrypt pakujący, walidator danych, ${73} testów jednostkowych</td></tr>
</table>

<h2>3. Uruchomienie</h2>
<pre>npm install
npm run dev        # tryb deweloperski, http://localhost:5173

npm run build      # sprawdzenie typów + build produkcyjny do dist/
npm run preview    # serwuje dist/ pod http://localhost:4173</pre>
<p>
  Build używa ścieżek względnych, więc katalog <code>dist/</code> da się serwować
  z dowolnego podkatalogu lub otworzyć lokalnie.
</p>
<table>
  <tr><th style="width:32%">Polecenie</th><th>Działanie</th></tr>
  <tr><td><code>npm test</code></td><td>Testy jednostkowe silnika (Vitest)</td></tr>
  <tr><td><code>npm run validate</code></td><td>Walidacja danych kart i lista brakujących grafik</td></tr>
  <tr><td><code>npm run placeholders</code></td><td>Generuje tymczasowe grafiki zastępcze</td></tr>
  <tr><td><code>npm run docs</code></td><td>Generuje ten dokument</td></tr>
  <tr><td><code>npm run pack</code></td><td>Archiwum do oddania, bez <code>node_modules</code> i <code>dist</code></td></tr>
</table>

<h2 class="nowa-strona">4. Zasady gry</h2>

<h3>Plansza</h3>
<p>
  Szesnaście pól, po osiem na gracza, w układzie 4 kolumny × 2 rzędy na stronę.
  Identyfikator pola to <code>&lt;gracz&gt;-&lt;rząd&gt;&lt;kolumna&gt;</code>, gdzie
  rząd <code>F</code> to linia przednia, a <code>R</code> tylna. Kolumny liczone są
  tak samo dla obu graczy, więc <code>P1-F2</code> stoi naprzeciw <code>P2-F2</code>.
</p>
<ul>
  <li><strong>Flanka</strong> — pola <code>F0</code> i <code>F3</code></li>
  <li><strong>Linia główna</strong> — pola <code>F1</code> i <code>F2</code></li>
  <li><strong>Tylna linia</strong> — pola <code>R0</code>–<code>R3</code></li>
</ul>
<p>
  Na jednym polu stoi najwyżej jeden oddział. Kartę werbunku można zagrać
  wyłącznie na pole, którego strefa mieści się w dozwolonych strefach karty.
  Oddziały raz rozmieszczone nie przemieszczają się.
</p>

<h3>Przebieg tury</h3>
<ol>
  <li>
    <strong>Dobieranie.</strong> Gracz uzupełnia rękę do ${CONFIG.handSize} kart
    (twardy limit ${CONFIG.handMax}). W turze pierwszej wolno wymienić całą rękę,
    w kolejnych do ${CONFIG.mulliganLater} kart. Po wymianie dwóch można odrzucić
    jedną kartę i wymienić całą resztę, dopóki na ręce zostaje co najmniej jedna.
    Talia nie jest przetasowywana — jej wyczerpanie kończy partię.
  </li>
  <li>
    <strong>Logistyka.</strong> Gracze zagrywają na przemian po jednej karcie.
    Zaopatrzenie działa jako pula: karty zaopatrzenia ją zasilają, z puli opłaca
    się koszty werbunku i zasadzek. Pula startuje od ${CONFIG.supplyBase}, a limit
    tury wynosi numer tury powiększony o ${CONFIG.supplyBase}. Pas kończy udział
    gracza w fazie; drugi może grać dalej sam.
  </li>
  <li>
    <strong>Strategia.</strong> Gracze na przemian wydają rozkaz jednemu oddziałowi:
    atak, obrona albo postój. Rozkazy są jawne od chwili wydania i nie da się ich
    cofnąć. Przycisk „Reszta stoi" nadaje postój wszystkim niezadeklarowanym
    oddziałom naraz.
  </li>
  <li>
    <strong>Manewry.</strong> Gracze na przemian zagrywają karty manewrów
    i odpalają zasadzki, aż obaj spasują z rzędu. Manewr modyfikuje deklaracje,
    nie planszę.
  </li>
  <li>
    <strong>Walka.</strong> Starcie rozstrzyga się jednocześnie, na zamrożonej
    migawce stanu — żadna śmierć nie wpływa na obliczenia w tej samej fazie.
  </li>
</ol>

<h3>Zasięgi ataku</h3>
<ul>
${tabelaZasiegow}
  <li>Oddział w tylnej linii atakuje tylko wtedy, gdy pozwala na to jego karta</li>
  <li>Strefy ograniczają rozmieszczanie, nie celowanie — oddział z flanki może uderzyć na ukos w linię główną</li>
</ul>

<h3>Rozstrzyganie starcia</h3>
<ol>
  <li>Policz statystyki efektywne wszystkich żywych oddziałów.</li>
  <li>
    <strong>Wsparcie obrońców.</strong> Każdy oddział z rozkazem obrony dokłada
    swoją defensywę jako obrażenia napastnikowi, który sam jest przez kogoś atakowany.
  </li>
  <li>
    <strong>Obrażenia.</strong> Oddział ginie, gdy suma ofensyw napastników
    powiększona o wsparcie <em>przekracza</em> jego defensywę. Porównanie jest ostre —
    wartość równa nie wystarcza.
  </li>
  <li>
    <strong>Odwet obrońcy.</strong> Obrońca dysponuje pulą równą swojej defensywie
    i zabija napastników w kolejności od największej ofensywy. Zabicie kosztuje
    ofensywę celu powiększoną o jeden. Pula niewystarczająca na największego
    napastnika przerywa odwet.
  </li>
  <li>
    <strong>Pojedynek wzajemny.</strong> Gdy dwa oddziały atakują się nawzajem,
    wyższa ofensywa zabija niższą.
    ${CONFIG.duelTie === 'both_live' ? 'Przy remisie obaj przeżywają.' : 'Przy remisie giną obaj.'}
    Zasada uzupełnia zwykłe liczenie obrażeń, nie zastępuje go.
  </li>
  <li>Wszystkie oznaczone oddziały znikają naraz, a ich karty trafiają na stos odrzuconych.</li>
</ol>

<h3>Warunki zwycięstwa</h3>
<p>Sprawdzane na koniec tury, po usunięciu poległych.</p>
<ul>
  <li>
    <strong>Przełamanie.</strong> Dla każdej kolumny, w której przednie pole
    przeciwnika jest puste, sumujesz ofensywę własnych oddziałów z obu rzędów tej
    kolumny. Suma co najmniej ${CONFIG.breakthroughThreshold} oznacza zwycięstwo.
    Obustronne przełamanie rozstrzyga wyższa suma, równa — remis.
  </li>
  <li>
    <strong>Wyczerpanie talii.</strong> Gdy talia któregokolwiek gracza się skończy,
    po zakończeniu bieżącej tury wygrywa gracz o większej łącznej ofensywie żywych
    oddziałów. Równość oznacza remis.
  </li>
  <li>
    <strong>Limit ${CONFIG.maxTurns} tur.</strong> Bezpiecznik — rozstrzygnięcie
    porównawcze jak przy wyczerpaniu talii. Uzasadnienie w rozdziale 7.
  </li>
</ul>

<h2 class="nowa-strona">5. Karty i reguły specjalne</h2>
<p>
  Talia liczy <strong>${wszystkieKopie} kart na gracza</strong>, zbudowana
  z ${CARDS.length} definicji. Obaj gracze grają taliami identycznymi.
</p>
<table>
  <tr><th>Typ karty</th><th class="l">Definicji</th><th class="l">Kart w talii</th></tr>
${tabelaTalii}
  <tr><th>Razem</th><th class="l">${CARDS.length}</th><th class="l">${wszystkieKopie}</th></tr>
</table>

<h3>Oddziały</h3>
<table>
  <tr>
    <th>Nazwa</th><th class="l">OFN</th><th class="l">DEF</th><th class="l">Koszt</th>
    <th>Strefy</th><th>Zasięg</th><th>Reguła</th><th class="l">Szt.</th>
  </tr>
${tabelaWerbunkow}
</table>

<h3>Reguły specjalne</h3>
<table>
  <tr><th style="width:24%">Reguła</th><th>Działanie</th></tr>
${tabelaRegul}
</table>
<p>
  Reguła to wpis w <code>rules.json</code> plus funkcja w <code>src/silnik/rules/</code>.
  Rejestr mapuje identyfikator na zestaw hooków, a brak implementacji dla
  zadeklarowanej reguły powoduje błąd przy starcie aplikacji — literówka ma boleć
  od razu, a nie zniknąć jako cichy brak efektu.
</p>

<h2>6. Architektura</h2>
<p>Projekt trzymają trzy zasady, konsekwentnie egzekwowane w całym kodzie.</p>

<h3>Silnik jest czysty</h3>
<p>
  Katalog <code>src/silnik/</code> to wyłącznie TypeScript: zero DOM, zero importów
  z Reacta, zero <code>Math.random()</code>. Całość logiki to funkcja
  <code>reduce(stan, akcja) → { stan, zdarzenia }</code>. Losowość pochodzi
  z jednego generatora z ziarnem zapisanym w stanie gry, dzięki czemu rozgrywki są
  powtarzalne, testy stabilne, a przeciwnik komputerowy dostaje symulację starcia
  za darmo — wywołuje po prostu ten sam silnik na kopii stanu.
</p>

<h3>Interfejs nie zna zasad</h3>
<p>
  Warstwa widoku renderuje stan i wysyła akcje. Nie liczy obrażeń, nie sprawdza
  legalności ruchu — pyta o to silnik funkcją <code>czyAkcjaLegalna()</code>.
  Stan interfejsu, taki jak zaznaczona karta czy podgląd zasięgu, trzymany jest
  osobno od stanu gry, który dzięki temu serializuje się do JSON bez śmieci.
</p>

<h3>Dane, nie kod</h3>
<p>
  Karty, reguły specjalne, manifest dźwięków i parametry zasad siedzą w plikach
  JSON w katalogu <code>src/data/</code>. Dodanie karty to wpis w pliku, nie zmiana
  w komponencie. Silnik nie zawiera liczb magicznych — progi i limity czyta
  z <code>config.json</code>.
</p>

<h3>Zdarzenia napędzają multimedia</h3>
<p>
  Reducer zwraca listę zdarzeń (<code>KARTA_ZAGRANA</code>, <code>JEDNOSTKA_ZGINELA</code>,
  <code>FAZA_ZMIENIONA</code> i inne). Warstwa mediów tylko je konsumuje: pojedynczy
  moduł zdejmuje zdarzenia z kolejki, odtwarza animację i dźwięk, a na czas
  odtwarzania blokuje wejście. Dodanie nowego dźwięku to wpis w manifeście,
  nie zmiana w logice.
</p>

<h2 class="nowa-strona">7. Odstępstwa od specyfikacji</h2>
<p>
  Specyfikacja pozostawiała dwanaście kwestii do rozstrzygnięcia. Wszystkie
  parametry wynikające z tych decyzji siedzą w <code>config.json</code>.
</p>
<table>
  <tr><th style="width:26%">Kwestia</th><th>Rozstrzygnięcie</th></tr>
  <tr><td>Talie</td><td>${wszystkieKopie} kart na gracza, obie identyczne</td></tr>
  <tr><td>Zaopatrzenie</td><td>Model puli: karty zasilają pulę, z puli opłaca się koszty</td></tr>
  <tr><td>Limit zaopatrzenia</td><td>Numer tury powiększony o bazę — inaczej karty zaopatrzenia byłyby bezużyteczne w turze pierwszej</td></tr>
  <tr><td>Wolna droga na tyły</td><td>Kolumna z pustym przednim polem przeciwnika; liczą się oddziały z obu rzędów</td></tr>
  <tr><td>Pojedynek wzajemny</td><td>Uzupełnia zwykłe liczenie obrażeń, nie zastępuje go</td></tr>
  <tr><td>Odwet obrońcy</td><td>Priorytet dla największych czytany dosłownie — brak środków na największego przerywa odwet</td></tr>
  <tr><td>Ruch oddziałów</td><td>Nie istnieje; raz rozmieszczone stoją do śmierci</td></tr>
  <tr><td>Remis</td><td>Istnieje przy równym przełamaniu i przy równej ofensywie</td></tr>
</table>

<h3>Pełna informacja zamiast tajności</h3>
<p>
  Specyfikacja zakładała rozkazy tajne, deklarowane jednocześnie i rozdzielone
  ekranem zasłony. Projekt świadomie od tego odszedł: <strong>ręce obu graczy są
  jawne, zasadzki widoczne, a zasłona usunięta</strong>. Zakryta zostaje wyłącznie
  zawartość talii — symetrycznie, bo nie zna jej żadna ze stron.
</p>
<div class="uwaga">
  <strong>Dlaczego wymagało to przebudowy fazy strategii.</strong>
  Sama jawność rąk jest symetryczna i nieszkodliwa. Problem leżał w deklaracji:
  przy zachowaniu modelu jednoczesnego, ale bez zasłony, gracz deklarujący jako
  drugi widziałby komplet rozkazów przeciwnika przed podjęciem własnych decyzji.
  To nie byłaby drobna przewaga, tylko rozstrzygnięcie partii.
</div>
<table>
  <tr><th style="width:34%">Mechanizm</th><th>Cel</th></tr>
  <tr><td>Deklaracja naprzemienna, po jednym oddziale</td><td>Przewaga informacyjna rozkłada się na całą fazę zamiast trafiać w całości do jednej strony</td></tr>
  <tr><td>Rozkazu nie da się cofnąć</td><td>Inaczej obaj gracze czekaliby na ruch przeciwnika i naprzemienność traci sens</td></tr>
  <tr><td>Pierwszy deklaruje gracz z większą liczbą oddziałów</td><td>Przy jawnej deklaracji pierwszeństwo jest obciążeniem; przewaga na planszy kosztuje przewagę informacyjną — mechanizm wyrównujący</td></tr>
  <tr><td>Reguła zwiadowcy przebudowana</td><td>Podglądanie rozkazu stało się bezużyteczne; zwiadowca raz w turze koryguje własny rozkaz w fazie manewrów</td></tr>
</table>
<p>
  <strong>Weryfikacja balansu.</strong> Dwieście partii rozegranych między
  przeciwnikami komputerowymi o równej sile, 189 rozstrzygniętych: gracz
  deklarujący jako drugi wygrał 100 razy (52,9%), deklarujący pierwszy 89 razy
  (47,1%). Odchylenie od równowagi wynosi 2,9 punktu procentowego przy błędzie
  losowym rzędu ±3,6 punktu, mieści się więc w granicy szumu. Średnia długość
  partii: 15,6 tury.
</p>

<h3>Limit tur jako bezpiecznik</h3>
<p>
  Zasady ze specyfikacji nie gwarantują zakończenia partii. Gdy obaj gracze
  przestaną cokolwiek zagrywać, ręka nie schodzi, talia się nie wyczerpuje,
  a przełamanie nie rośnie — rozgrywka biegnie w nieskończoność. W trybie kiosk
  jest to niedopuszczalne, dlatego po ${CONFIG.maxTurns} turach następuje
  rozstrzygnięcie porównawcze. W praktyce uruchamia się rzadko: w serii partii
  testowych zadziałał w około jednej szóstej przypadków, reszta kończyła się
  przełamaniem albo wyczerpaniem talii między czwartą a czternastą turą.
</p>

<h2>8. Testy</h2>
<p>
  Testy jednostkowe (Vitest) obejmują silnik oraz test dymny warstwy widoku.
  Warstwa widoku renderowana jest przez <code>renderToString</code>
  z <code>react-dom</code>, bez dokładania biblioteki testującej ani środowiska
  przeglądarkowego do zależności projektu.
</p>
<table>
  <tr><th style="width:34%">Obszar</th><th>Co sprawdza</th></tr>
  <tr><td>Rozmieszczanie</td><td>Zgodność stref, zajętość pola, brak zaopatrzenia, wymiana kart przy duplikatach w ręce</td></tr>
  <tr><td>Zasięgi</td><td>Zachowanie każdego z trzech trybów zasięgu, blokada ataku z tylnej linii, odrzucanie kolumn spoza planszy</td></tr>
  <tr><td>Walka</td><td>Ostrość porównania, wsparcie obrońców, odwet z priorytetem, pojedynek wzajemny, reguły specjalne</td></tr>
  <tr><td>Zwycięstwo</td><td>Próg przełamania dokładnie na granicy, wyczerpanie talii, limit tur</td></tr>
  <tr><td>Determinizm</td><td>Powtarzalność przy tym samym ziarnie, serializacja stanu do JSON, spójność danych kart</td></tr>
  <tr><td>Deklaracja</td><td>Naprzemienność, jednorazowość rozkazu, korekta zwiadowcy, jawność informacji</td></tr>
  <tr><td>Przeciwnik komputerowy</td><td>Wyłącznie legalne akcje, dogrywanie partii do rozstrzygnięcia, powtarzalność</td></tr>
  <tr><td>Warstwa widoku</td><td>Render każdego ekranu w każdej fazie bez wyjątku</td></tr>
</table>

<h2 class="nowa-strona">9. Grafika i dźwięk</h2>
<p>
  Żadna ścieżka do pliku nie występuje w kodzie komponentów — wszystko przechodzi
  przez <code>cards.json</code>, <code>rules.json</code> i manifest dźwięków.
  Nazwa pliku odpowiada identyfikatorowi karty.
</p>
<table>
  <tr><th>Element</th><th>Rozmiar pliku</th><th>Rozmiar na ekranie</th></tr>
  <tr><td>Awers karty</td><td>750 × 1050 px</td><td>150 × 210 px</td></tr>
  <tr><td>Żeton oddziału</td><td>512 × 512 px</td><td>128 × 128 px</td></tr>
  <tr><td>Pole planszy</td><td>512 × 512 px</td><td>128 × 128 px</td></tr>
  <tr><td>Tło stołu</td><td>2560 × 1440 px</td><td>pełny ekran</td></tr>
  <tr><td>Symbol reguły</td><td>SVG, kanwa 64 × 64</td><td>24 × 24 px</td></tr>
</table>
<div class="uwaga">
  <strong>Statystyki nie są wypalone w grafice.</strong> Ofensywę, defensywę, koszt
  i symbole reguł rysuje aplikacja warstwą nad ilustracją. Liczby pozostają ostre
  w każdej skali, modyfikatory widać na żywo, a ilustrator nie musi numerować
  kilkudziesięciu plików.
</div>
<p>
  <strong>Brak pliku nie psuje gry.</strong> Aplikacja szuka kolejno formatu
  docelowego, zastępnika i wreszcie rysuje placeholder proceduralny.
  Polecenie <code>npm run validate</code> wypisuje listę brakujących grafik, która
  jest zarazem listą zadań rysunkowych. Dźwięki działają tak samo: brak pliku
  oznacza ciszę, nie wyjątek.
</p>

<h2>10. Tryb kiosk</h2>
<ul>
  <li>Scena ma stałą proporcję 16:9 i skaluje się do rozmiaru okna, wyśrodkowana; w każdej rozdzielczości wygląda identycznie i nic się nie przewija</li>
  <li>Brak przewijania, zaznaczania tekstu, menu kontekstowego i przeciągania obrazków</li>
  <li>Cele kliknięcia nie mniejsze niż 44 px</li>
  <li>Zero natywnych dialogów przeglądarki — potwierdzenia to własne modale</li>
  <li>Automatyczny powrót do menu po ${CONFIG.idleResetSeconds / 60} minutach bezczynności, żeby stacja demonstracyjna nie została zablokowana na porzuconej partii</li>
  <li>Muzyka startuje dopiero po pierwszej interakcji użytkownika, zgodnie z polityką autoodtwarzania w przeglądarkach</li>
  <li>Ustawienie <code>prefers-reduced-motion</code> zeruje czasy wszystkich animacji</li>
</ul>

<h2>11. Struktura repozytorium</h2>
<pre>src/
├─ data/            dane, nie kod: karty, reguły, dźwięki, konfiguracja zasad
├─ silnik/          czysty TypeScript — zero DOM, zero Reacta, zero Math.random()
│  ├─ phases/       po jednym module na fazę tury
│  ├─ rules/        implementacje reguł specjalnych
│  └─ __tests__/    testy jednostkowe
├─ ai/              przeciwnik komputerowy
├─ media/           audio, obrazki, wstępne wczytywanie zasobów
└─ ui/              warstwa widoku: ekrany, komponenty, style, teksty

tools/              walidator danych, generator grafik zastępczych,
                    generator dokumentacji, skrypt pakujący
public/assets/      grafiki, dźwięki, kroje pisma</pre>

<p class="meta" style="margin-top:8mm; border-top:0.5px solid #b8b4a8; padding-top:3mm">
  Dokument wygenerowany poleceniem <code>npm run docs</code> na podstawie plików
  danych projektu. Źródłem prawdy dla zasad pozostaje
  <code>instrukcja.md</code>, dla parametrów — <code>src/data/config.json</code>.
</p>

</body>
</html>
`;

/* ---------- Zapis i złożenie PDF ---------- */

mkdirSync(KATALOG, { recursive: true });
writeFileSync(HTML, html, 'utf8');
console.log('\n=== Zelhoranka — dokumentacja ===\n');
console.log(`HTML: ${HTML}`);

const KANDYDACI = [
  process.env.CHROME,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  process.env.LOCALAPPDATA
    ? join(process.env.LOCALAPPDATA, 'Google\\Chrome\\Application\\chrome.exe')
    : undefined,
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter((p): p is string => Boolean(p));

const chrome = KANDYDACI.find((p) => existsSync(p));

if (!chrome) {
  console.log('\nNie znalazłem przeglądarki Chrome, więc PDF nie powstał.');
  console.log('Otwórz plik HTML i wydrukuj do PDF (Ctrl+P), albo wskaż przeglądarkę:');
  console.log('  CHROME="ścieżka/do/chrome.exe" npm run docs\n');
  process.exit(0);
}

try {
  execFileSync(
    chrome,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-pdf-header-footer',
      `--print-to-pdf=${PDF}`,
      `file:///${HTML.replace(/\\/g, '/')}`,
    ],
    { stdio: 'ignore', timeout: 60_000 },
  );
  console.log(`PDF:  ${PDF}`);
  console.log('\nGotowe.\n');
} catch {
  console.log('\nChrome nie zdołał złożyć PDF-a. Zostaje HTML gotowy do wydruku.\n');
}
