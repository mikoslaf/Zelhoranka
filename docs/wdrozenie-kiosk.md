# Zelhoranka — wdrożenie kiosku na maszynie wirtualnej

**Stan: wykonane 19.09.2026.** Kiosk działa pod adresem `10.40.30.92`: po włączeniu zasilania
maszyna sama loguje się na konto `kiosk`, podnosi Openboksa i otwiera Zelhorankę na pełnym
ekranie 1920×1080, bez ekranu logowania i bez dostępu do internetu.

Dokument jest jednocześnie zapisem tego, co zrobiono, i procedurą do powtórzenia na czystej
maszynie. Łączy dwa źródła wymagań:

- **`instrukcja.md` §10.4 i §12.2** — aplikacja ma być na maszynie **zbudowana i działająca**,
  bez paska adresu, bez dialogów przeglądarki, z auto-resetem po bezczynności;
- **sylabus „Kiosk Linux – Ubuntu Server (netinstall), dnsmasq whitelist+blacklist, SSH"** —
  ręcznie budowane środowisko graficzne, LightDM z auto-loginem, Openbox, Chromium `--kiosk`,
  filtrowanie DNS, utwardzenie i zarządzanie wyłącznie przez SSH.

Zelhoranka realizuje **zadanie dodatkowe 4 sylabusa** („biała lista tylko domen lokalnych /
intranet") w jego najostrzejszym wariancie: kiosk serwuje stronę z własnego nginx-a pod
`kiosk.local`, a DNS zwraca NXDOMAIN dla całej reszty świata.

---

## 1. Stan zastany maszyny

Zweryfikowany przez SSH przed rozpoczęciem prac.

| Obszar | Stan |
|---|---|
| System | Ubuntu **26.04.1 LTS**, kernel 7.0.0, x86_64 |
| Hypervisor | **VMware** (`systemd-detect-virt: vmware`), `open-vm-tools` obecne |
| Konto | `student` (uid 1000), w grupie `sudo` — sylabusowe `admin` **nie istnieje** |
| Sieć | `ens33`, 10.40.30.92/23, DHCP, internet działał |
| GUI | **brak** — czysty Ubuntu Server, `XDG_SESSION_TYPE=tty` |
| Node, nginx, dnsmasq | **brak**; port 80 wolny |
| Dysk | LV 10 G (5,6 G wolne), w VG **8,22 G nieprzydzielone** |
| RAM | 3,3 GiB, **bez swap** |

Zmierzone rozmiary pobierania: stos graficzny **213 pakietów / 102 MB**, snap Chromium
**~200 MB**, Node z NodeSource **~30 MB**, `nginx` + `dnsmasq` **1 MB**.

> Dla porównania: `apt install nodejs npm` z repozytorium Ubuntu ciągnie **568 pakietów /
> 161 MB** debianowego zoo `node-*`. Dlatego Node pochodzi z NodeSource.

---

## 2. Architektura

```
        VMware VM  (Ubuntu 26.04 Server, 10.40.30.92)
        ┌──────────────────────────────────────────────────────────┐
  zasilanie →  systemd  →  graphical.target
        │        │                                                 │
        │        ├── nginx.service ──── /var/www/zelhoranka ────┐   │
        │        │    :80  kiosk.local                          │   │
        │        │                                              │   │
        │        ├── dnsmasq.service ── whitelist: kiosk.local   │   │
        │        │                      blacklist + address=/#/  │   │
        │        │                      (reszta swiata NXDOMAIN) │   │
        │        │                                              │   │
        │        └── lightdm.service                            │   │
        │              └─ auto-login: kiosk                     │   │
        │                   └─ openbox-session                  │   │
        │                        └─ ~/.config/openbox/autostart  │   │
        │                             ├ xset s off / -dpms       │   │
        │                             ├ xrandr 1920x1080         │   │
        │                             ├ unclutter -idle 3        │   │
        │                             └ petla: chromium --kiosk ─┘   │
        │                                  http://kiosk.local/       │
        │                                                            │
        └── sshd :22 ── student (jedyne wejscie administracyjne) ────┘
```

Aplikacja jest **statyczna i w 100 % offline**: w kodzie nie ma `fetch`, `XMLHttpRequest`,
service workera ani `localStorage`. Grafiki i dźwięki ładują się przez `new Image()` /
`new Audio()` ze ścieżek względnych. Po zbudowaniu kiosk nie potrzebuje sieci do niczego.

### Dlaczego tak, a nie inaczej

| Decyzja | Uzasadnienie |
|---|---|
| **nginx**, nie `python3 -m http.server` | wprost z zadania dodatkowego 4 sylabusa; poprawne typy MIME (zweryfikowane: `image/webp`, `application/javascript`); usługa systemd, a nie skrypt |
| **Serwer HTTP jest konieczny**, `file://` odpada | `dist/index.html` ładuje `<script type="module" crossorigin src="./assets/index-*.js">`. Moduły ES z `file://` blokuje CORS (origin `null`) — kiosk pokazałby białą stronę |
| **Build na maszynie**, nie kopiowanie `dist/` | `instrukcja.md` §12.2: „na maszynie wirtualnej aplikacja ma być zbudowana i działająca". `dist/` jest zresztą w `.gitignore` |
| **Node z NodeSource** | jeden pakiet z npm w środku zamiast 568 pakietów z repo Ubuntu |
| **Wpis w `/etc/hosts`** obok reguły dnsmasq | `kiosk.local → 127.0.0.1` działa nawet gdy dnsmasq leży. Kiosk nie może zależeć od DNS, żeby wyświetlić stronę z własnego dysku |
| **Blokada DNS i utwardzenie na końcu** | po włączeniu `address=/#/` przestają działać `apt`, `npm` i `git` |

---

## 3. Cztery odstępstwa od sylabusa wymuszone przez tę maszynę

To najważniejsza część dokumentu. Każdy z tych punktów przepisany z sylabusa dosłownie
**zepsułby kiosk albo odciął dostęp do maszyny**. Wszystkie wykryte i potwierdzone na żywo.

### 3.1 `Exec=openbox` nie uruchamia autostartu

Sylabus (zadanie 9) każe stworzyć `/usr/share/xsessions/openbox.desktop` z `Exec=openbox`.
Samo `openbox` **nie czyta** `~/.config/openbox/autostart` — robi to dopiero `openbox-session`.
Z wersją z sylabusa Chromium nigdy by nie wystartował; zostałoby szare tło.

**Zastosowano:** pakiet `openbox` z Ubuntu 26.04 dostarcza własny `openbox.desktop`
z `Exec=/usr/bin/openbox-session` — poprawny. **Nie nadpisujemy go.**

### 3.2 Watchdog po nazwie procesu nigdy nie trafia

Sylabus (zadanie 18) proponuje `pgrep -x chromium-browser`. `chromium-browser` to tylko
przejściówka do snapa; realny proces nazywa się **`chrome`**:

```
/snap/chromium/3529/usr/lib/chromium-browser/chrome --kiosk ... http://kiosk.local/
```

`pgrep -x chromium-browser` nie trafia nigdy, więc watchdog **w nieskończoność mnożyłby
instancje przeglądarki**.

**Zastosowano:** pętla `while true; do chromium-browser ...; sleep 3; done` w autostarcie.
Jest odporna na nazwę procesu i podnosi przeglądarkę natychmiast po jej wyjściu.
Zweryfikowane: `pkill -9 -u kiosk chrome` → PID 1988 zniknął, PID 2604 wstał w ciągu 12 s.

### 3.3 `usermod -s /usr/sbin/nologin kiosk` zepsułby auto-login

Sylabus (zadanie 19) każe zablokować powłokę użytkownika kiosku. Na tej maszynie
`/etc/pam.d/lightdm-autologin` ma w linii 3:

```
auth required pam_succeed_if.so shell notin /sbin/nologin:/usr/sbin/nologin:/bin/false:/usr/bin/false
```

Ustawienie `nologin` sprawi, że **PAM odrzuci auto-login i kiosk przestanie wstawać**.

**Zastosowano:** powłoka `kiosk` zostaje `/bin/bash`, a dostęp SSH blokujemy tam, gdzie to
naprawdę należy — w `sshd_config`: `AllowUsers student` + `DenyUsers kiosk`. Efekt dla
bezpieczeństwa identyczny, kiosk działa.

### 3.4 `AllowUsers admin` odciąłby SSH

Sylabus zakłada konto `admin`. Na tej maszynie jedyne konto z sudo to **`student`**.
Wpisanie `AllowUsers admin` zamknęłoby jedyne wejście administracyjne.

**Zastosowano:** `AllowUsers student`.

### 3.5 Bonus: sterownik `vmware` tnie ekran do 800×600

Nie jest to błąd sylabusa, tylko cecha Ubuntu 26.04. Sterownik X `vmware` jest zbudowany
**bez KMS**:

```
(II) vmware(0): Driver was compiled without KMS- and 3D support.
(WW) vmware(0): Disabling RandR12+ support.
```

Skutek: jedno wyjście `default`, maksimum 1176×885, faktycznie 800×600 — gra w proporcji 16:9
dostaje czarne pasy. Moduł jądra `vmwgfx` i `/dev/dri/card0` są jednak dostępne.

**Zastosowano:** `/etc/X11/xorg.conf.d/20-modesetting.conf` przestawia ekran na sterownik
`modesetting`. Efekt: wyjście `Virtual-1`, maksimum 16384×16384, **1920×1080**.

---

## 4. Przebieg wdrożenia

### Etap 0 — dysk i swap

```bash
sudo lvextend -l +100%FREE /dev/ubuntu-vg/ubuntu-lv
sudo resize2fs /dev/ubuntu-vg/ubuntu-lv        # ext4
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

**Wynik:** 10 G → **18 G** (14 G wolnego), swap 2 G aktywny. Bez swapu `npm ci` + `vite build`
na 3,3 GB RAM kończy się OOM-killerem.

### Etap 1 — baza systemu

```bash
sudo apt update && sudo apt upgrade -y
sudo apt autoremove --purge -y
sudo timedatectl set-timezone Europe/Warsaw
sudo localectl set-x11-keymap pl               # było: us
sudo reboot
```

**Wynik:** kernel 7.0.0-31, strefa Europe/Warsaw, układ klawiatury pl.

### Etap 2 — Node, kod i build

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x -o /tmp/nodesource_setup.sh
sudo bash /tmp/nodesource_setup.sh
sudo apt-get install -y nodejs                  # v22.23.2 + npm 10.9.8

sudo mkdir -p /opt/zelhoranka && sudo chown student:student /opt/zelhoranka
git clone https://github.com/mikoslaf/Zelhoranka.git /opt/zelhoranka
cd /opt/zelhoranka
npm ci && npm test && npm run validate && npm run build
```

**Wynik:** `npm test` → **74/74 zielone na Linuksie**. `dist/` → 52 pliki, 1,5 MB,
16 kart `.webp`.

> **Uwaga — realna wpadka wyłapana tutaj.** Pierwszy `npm run build` na maszynie **padł**:
> `tsc` zgłosił `Cannot find module 'node:fs'` w `tools/*.ts`. Powód: `@types/node`
> **nie istniało w `package-lock.json`** — na Windows leżało w `node_modules` jako
> pozostałość po ręcznej instalacji, więc build był reprodukowalny wyłącznie przez przypadek.
> `npm ci` na czystej maszynie go nie zainstalował. Naprawione przez `npm i -D @types/node@^22`.
> **Zmiana w `package.json` i `package-lock.json` czeka na commit** — na maszynę trafiła
> bezpośrednio przez SFTP, więc do czasu commita `git pull` w `/opt/zelhoranka` zgłosi
> lokalne modyfikacje (`git checkout -- package.json package-lock.json` przed pierwszym pullem
> po wypchnięciu zmiany).

### Etap 3 — nginx

`/etc/nginx/sites-available/zelhoranka`:

```nginx
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name kiosk.local localhost _;

    root /var/www/zelhoranka;
    index index.html;

    # Kiosk jest lokalny — cache nic nie przyspiesza, a po aktualizacji
    # potrafi pokazać starą wersję gry.
    add_header Cache-Control "no-store" always;

    location / { try_files $uri $uri/ /index.html; }

    access_log off;
    error_log /var/log/nginx/zelhoranka-error.log warn;
}
```

```bash
sudo rsync -a --delete /opt/zelhoranka/dist/ /var/www/zelhoranka/
sudo chown -R www-data:www-data /var/www/zelhoranka
sudo ln -sf /etc/nginx/sites-available/zelhoranka /etc/nginx/sites-enabled/zelhoranka
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl enable --now nginx
echo "127.0.0.1 kiosk.local" | sudo tee -a /etc/hosts
```

**Zweryfikowano:** `/` → 200 `text/html`, `.webp` → `image/webp`, `index-*.js` →
`application/javascript`, `fonts.css` → `text/css`.

### Etap 4 — środowisko graficzne

```bash
echo "lightdm shared/default-x-display-manager select lightdm" | sudo debconf-set-selections
sudo DEBIAN_FRONTEND=noninteractive apt install -y \
    xorg openbox lightdm lightdm-gtk-greeter unclutter x11-xserver-utils open-vm-tools-desktop

sudo useradd -m -s /bin/bash kiosk
echo 'kiosk:kiosk123' | sudo chpasswd
sudo groupadd -f autologin && sudo groupadd -f nopasswdlogin
sudo usermod -aG autologin,nopasswdlogin kiosk
```

`/etc/lightdm/lightdm.conf.d/50-kiosk.conf` (drop-in, nie edycja `lightdm.conf`):

```ini
[Seat:*]
autologin-user=kiosk
autologin-user-timeout=0
autologin-session=openbox
user-session=openbox
greeter-session=lightdm-gtk-greeter
```

`/etc/X11/xorg.conf.d/20-modesetting.conf` — patrz §3.5:

```
Section "Device"
    Identifier  "vmwgfx"
    Driver      "modesetting"
    Option      "kmsdev" "/dev/dri/card0"
EndSection
```

### Etap 5 — Chromium

```bash
sudo apt install -y chromium-browser      # przejściówka → snapd + snap chromium 153.0.8010.36
```

`/home/kiosk/.config/openbox/autostart`:

```sh
#!/bin/sh
xset s off
xset s noblank
xset -dpms

OUT=$(xrandr | awk '/ connected/{print $1; exit}')
for M in 1920x1080 1600x900 1366x768 1280x720; do
    if xrandr --output "$OUT" --mode "$M" 2>/dev/null; then break; fi
done

unclutter -idle 3 -root &

while true; do
    chromium-browser \
        --kiosk --noerrdialogs --disable-infobars \
        --disable-session-crashed-bubble \
        --disable-features=TranslateUI,Translate \
        --no-first-run --fast-start --password-store=basic \
        --disable-pinch --overscroll-history-navigation=0 \
        --check-for-update-interval=31536000 \
        http://kiosk.local/
    sleep 3
done
```

Dwie rzeczy warte zapamiętania:

- `--password-store=basic` — bez tego Chromium szuka `gnome-keyring`, którego w minimalnym
  Openboksie nie ma, i potrafi zawiesić start na oknie dialogowym.
- **Nie ustawiamy `--user-data-dir`.** Pierwsza próba z katalogiem
  `/home/kiosk/.config/chromium-kiosk` dała `Failed To Create Data Directory` — snap może pisać
  wyłącznie pod `~/snap/chromium/`. Profil domyślny snapa działa bez zarzutu.

**Polityka zarządzana Chromium** — `/etc/chromium/policies/managed/zelhoranka-kiosk.json`
oraz `/var/snap/chromium/current/policies/managed/zelhoranka-kiosk.json`:

```json
{
  "TranslateEnabled": false,
  "DefaultBrowserSettingEnabled": false,
  "PasswordManagerEnabled": false,
  "MetricsReportingEnabled": false,
  "SpellcheckEnabled": false,
  "AutofillAddressEnabled": false,
  "AutofillCreditCardEnabled": false,
  "SyncDisabled": true,
  "BrowserSignin": 0,
  "SearchSuggestEnabled": false,
  "BookmarkBarEnabled": false,
  "PromptForDownloadLocation": false,
  "DownloadRestrictions": 3,
  "IncognitoModeAvailability": 1,
  "URLAllowlist": ["http://kiosk.local/"],
  "URLBlocklist": ["*"]
}
```

Sama flaga `--disable-features=TranslateUI,Translate` **nie wystarczyła** — pasek „Polish /
English" pojawiał się mimo niej (snap dokłada własne `--disable-features` przed naszym).
Dopiero `TranslateEnabled: false` go usunął. `URLBlocklist: ["*"]` z jednym wyjątkiem to
druga, niezależna od DNS warstwa: przeglądarka nie potrafi opuścić `kiosk.local`.

### Etap 6 — dnsmasq, tryb intranet

```bash
sudo apt install -y dnsmasq bind9-dnsutils
sudo cp /etc/dnsmasq.conf /etc/dnsmasq.conf.bak
sudo systemctl disable --now systemd-resolved
sudo rm -f /etc/resolv.conf
echo "nameserver 127.0.0.1" | sudo tee /etc/resolv.conf
sudo chattr +i /etc/resolv.conf
```

`/etc/dnsmasq.conf` — `listen-address=127.0.0.1`, `bind-interfaces`, `no-resolv`,
`server=8.8.8.8`, `server=1.1.1.1`, **`address=/#/`**, `conf-dir=/etc/dnsmasq.d/,*.conf`,
`log-queries`, `log-facility=/var/log/dnsmasq.log`, `cache-size=1000`, `domain-needed`,
`bogus-priv`.

`/etc/dnsmasq.d/whitelist.conf`:

```conf
address=/kiosk.local/127.0.0.1
```

`/etc/dnsmasq.d/blacklist.conf` — `facebook.com`, `instagram.com`, `tiktok.com`, `twitter.com`,
`x.com`, `reddit.com`, `doubleclick.net`, `googlesyndication.com`.

**Zweryfikowano:**

| Test | Wynik |
|---|---|
| `dig +short kiosk.local @127.0.0.1` | `127.0.0.1` |
| `dig facebook.com @127.0.0.1` | NXDOMAIN (czarna lista) |
| `dig allegro.pl @127.0.0.1` | NXDOMAIN (`address=/#/`) |
| `dig github.com @127.0.0.1` | NXDOMAIN |
| `curl -I http://kiosk.local/` | 200 — gra działa bez DNS zewnętrznego |
| `ss -ltnp` | :53 wyłącznie na 127.0.0.1 |

### Etap 7 — utwardzenie

- **`/home/kiosk/.config/openbox/rc.xml`** — `A-F4`, `A-Tab`, `A-S-Tab`, `Super_L/R`, `C-A-t`,
  `F11`, `C-w`, `C-n`, `C-t` przechwycone na `true`; prawy i środkowy przycisk na pulpicie bez
  akcji; okna bez dekoracji i zmaksymalizowane. Wdrożone przez `openbox --reconfigure`,
  bez restartu sesji.
- **`/etc/X11/xorg.conf.d/30-kiosk-flags.conf`** — `DontVTSwitch`, `DontZap`. To właściwe
  miejsce na blokadę `Ctrl+Alt+Fn`: X przechwytuje te skróty **zanim** zobaczy je menedżer
  okien, więc keybindy w `rc.xml` ich nie zatrzymują.
- **TTY** — `getty@tty2`…`tty6` i `ctrl-alt-del.target` zamaskowane.
- **SSH** — `/etc/ssh/sshd_config.d/99-kiosk.conf`: `PermitRootLogin no`,
  `AllowUsers student`, `DenyUsers kiosk`, `MaxAuthTries 3`, `LoginGraceTime 30`,
  `ClientAliveInterval 300`, `ClientAliveCountMax 2`, `Banner /etc/ssh/banner.txt`.
  Po każdej zmianie `sshd -t`, restart, i natychmiastowe sprawdzenie nowego połączenia.
- **Powłoka `kiosk` celowo zostaje `/bin/bash`** — patrz §3.3.

### Etap 8 — skrypty zarządzające

| Skrypt | Do czego |
|---|---|
| `kiosk-net open\|close\|status` | zdejmuje i przywraca `address=/#/` — bez tego żadna aktualizacja nie przejdzie, bo `apt`, `npm` i `git` nie rozwiążą nazw |
| `kiosk-status` | usługi, sesja graficzna, rozdzielczość, stan serwera gry, wersja `dist`, testy DNS, zasoby |
| `zelhoranka-update` | otwiera DNS → `git pull` → `npm ci` → testy → build → kopia do `zelhoranka.prev` → publikacja → zamyka DNS → restart przeglądarki |

---

## 5. Testy akceptacyjne

### Zweryfikowane zdalnie

- [x] Zimny start: auto-login bez ekranu logowania, Openbox + Chromium wstają same
- [x] Rozdzielczość **1920×1080** (`Virtual-1`), gra w pełnej proporcji 16:9
- [x] Menu gry renderuje się bez paska adresu, paska zadań i dekoracji okna
- [x] **Pasek Tłumacza Google zniknął** po wdrożeniu polityki `TranslateEnabled: false`
- [x] „Nowa gra" startuje partię: tura 1, plansza 4×4 na gracza, ręka 7 kart z grafikami
      `.webp`, rzut o inicjatywę w dzienniku
- [x] `pkill -9 -u kiosk chrome` → przeglądarka wraca w ≤ 12 s (PID 1988 → 2604)
- [x] Jednostka wystawiona na planszę pokazuje ilustrację karty (Kwatermistrz taboru na R1)
- [x] **Auto-reset po bezczynności** — partia zostawiona w turze 1 wróciła po 5,5 min do menu
      z nowym ziarnem (176577 → 621615); `config.idleResetSeconds: 300` działa na kiosku
- [x] `kiosk.local` → 127.0.0.1; `facebook.com`, `allegro.pl`, `github.com` → NXDOMAIN
- [x] `curl -I http://kiosk.local/` → 200 przy zamkniętym DNS
- [x] SSH działa po utwardzeniu; `student` wpuszczony, `kiosk` odrzucony
- [x] `kiosk-net open` → `apt install` → `kiosk-net close` przechodzi bez problemu
- [x] 74/74 testy jednostkowe silnika zielone na maszynie

### Do sprawdzenia przy konsoli VMware (wymaga klawiatury i oczu)

- [ ] `Alt+F4` nie zamyka przeglądarki
- [ ] `Ctrl+Alt+T` nie otwiera terminala
- [ ] `Ctrl+Alt+F2` nie przełącza na TTY
- [ ] Prawy przycisk myszy nie otwiera menu
- [ ] Kursor znika po 3 s bezczynności
- [ ] Ekran nie gaśnie po 10 minutach
- [ ] Pełna partia do przełamania 15 kończy się ekranem podsumowania
- [ ] Bot (3 poziomy) rozgrywa partię do końca

---

## 6. Co zostało otwarte

1. **Commit trzech poprawek.** W repozytorium nie ma jeszcze:
   - `@types/node` w `package.json` / `package-lock.json` (patrz etap 2),
   - grafik zagranych kart — żeton na planszy szukał tylko `board/tokens/<id>.webp`, którego
     nie ma, i spadał na paskowy placeholder; teraz po drodze bierze ilustrację karty
     (`src/media/useObrazek.ts`, `src/ui/components/Pole.tsx`),
   - wyglądu żetonów na planszy — jasne pasy pod nazwą i statystykami zasłaniały ilustrację;
     teraz nazwa stoi na ciemnym gradiencie, a statystyki na własnych znacznikach
     (`src/ui/styles/gra.css`, tylko reguły `.zeton`; karty w ręce bez zmian).

   Wszystkie są już na maszynie, wgrane bezpośrednio przez SFTP i zbudowane na miejscu. Do czasu
   commita i pushu `zelhoranka-update` przy pierwszym `git pull` zgłosi lokalne modyfikacje —
   po wypchnięciu zmian wystarczy w `/opt/zelhoranka` wykonać `git checkout -- .`.
2. **Snapshot VMware.** Nie da się go zrobić zdalnie. Warto zrobić teraz, na działającym
   kiosku — to jedyny szybki punkt cofnięcia.
3. **Kroje pisma.** `public/assets/fonts/fonts.css` odwołuje się do czterech plików `.woff2`,
   których nie ma; gra chodzi na kroju systemowym. Po zamknięciu DNS nie da się ich dociągnąć
   z sieci — trzeba je wrzucić do repo i wykonać `zelhoranka-update`.
4. **Dźwięk.** `public/assets/audio/` jest pusty, a `src/data/audio.json` wymienia 14 ścieżek.
   `preload.ts:26` czeka na każdy brakujący plik 4 sekundy (równolegle), więc ekran ładowania
   trwa ok. 4 s i gra chodzi w ciszy. Albo pliki `.ogg`, albo krótszy timeout.
5. **Grafiki planszy.** `npm run validate` wypisuje 16 brakujących plików (żetony jednostek,
   pola planszy, tło stołu). Karty mają komplet `.webp`; reszta jedzie na placeholderach,
   co gra sygnalizuje w menu.
6. **Adres IP z DHCP.** 10.40.30.92 może się zmienić po restarcie sieci. Kiosk działa lokalnie,
   więc gra ruszy i tak, ale warto zrobić rezerwację na routerze albo adres statyczny
   w `/etc/netplan/`.

---

## 7. Utrzymanie

```bash
ssh student@10.40.30.92
kiosk-status                 # co żyje, co nie
sudo zelhoranka-update       # nowa wersja gry z GitHuba + przeładowanie kiosku
```

Cofnięcie nieudanej aktualizacji:

```bash
sudo rsync -a --delete /var/www/zelhoranka.prev/ /var/www/zelhoranka/
sudo pkill -u kiosk chrome
```

Ręczna praca z siecią:

```bash
sudo kiosk-net open      # apt, npm, git znów działają
… prace …
sudo kiosk-net close     # z powrotem tryb kiosku
```

Wyjście z kiosku na czas serwisu:

```bash
sudo systemctl stop lightdm      # gaśnie sesja graficzna, SSH zostaje
sudo systemctl start lightdm     # wraca kiosk
```

### Co gdzie leży

```
/opt/zelhoranka/                  repozytorium + node_modules + dist (źródło buildu)
/var/www/zelhoranka/              serwowana gra
/var/www/zelhoranka.prev/         poprzednia wersja — punkt cofnięcia
/etc/nginx/sites-available/zelhoranka
/etc/dnsmasq.conf, /etc/dnsmasq.d/{whitelist,blacklist}.conf
/etc/lightdm/lightdm.conf.d/50-kiosk.conf
/etc/X11/xorg.conf.d/{20-modesetting,30-kiosk-flags}.conf
/etc/ssh/sshd_config.d/99-kiosk.conf
/etc/chromium/policies/managed/zelhoranka-kiosk.json
/var/snap/chromium/current/policies/managed/zelhoranka-kiosk.json
/home/kiosk/.config/openbox/{autostart,rc.xml}
/usr/local/bin/{kiosk-net,kiosk-status,zelhoranka-update}
```

---

## 8. Mapowanie na wymagania

### Sylabus

| Commit sylabusa | Realizacja |
|---|---|
| 1 — Ubuntu Server, sieć, SSH | zastane |
| 2 — auto-login, Openbox, Chromium | etapy 4–5 (z poprawką §3.1) |
| 3 — dnsmasq: biała, czarna lista, blokowanie domyślne | etap 6 |
| 4 — utwardzenie: klawisze, TTY, watchdog, SSH | etap 7 (z poprawkami §3.2, §3.3, §3.4) |
| 5 — zarządzanie przez SSH | `kiosk-net`, `kiosk-status`, `zelhoranka-update` |
| 6 — testy końcowe | §5 |
| 7 — zadania dodatkowe | **zadanie 4 (intranet) zrealizowane w całości**; klucze SSH, logrotate i harmonogram do dołożenia |

### `instrukcja.md` §10.4

| Wymaganie | Gdzie egzekwowane |
|---|---|
| brak przewijania, zaznaczania, menu kontekstowego | aplikacja (CSS) + Openbox `rc.xml` |
| duże cele kliknięcia ≥ 44 px | aplikacja |
| „Nowa gra" zawsze dostępna | aplikacja |
| auto-reset po 5 min bezczynności | `src/data/config.json: idleResetSeconds` |
| brak paska adresu i dialogów systemowych | `--kiosk --noerrdialogs --disable-infobars` + polityka zarządzana |
| aplikacja zbudowana i działająca na maszynie | etap 2 — `npm run build` **na VM**, 74/74 testy |
