# Plano: YTMusic-Winamp (app Electron)

## Contexto

Ouvir YouTube Music numa interface estilo Winamp clássico — janela pequena, sem cara
de navegador. Como o YouTube Music **não tem API pública**, a estratégia é embrulhar o
site num app Electron: o YTM roda **oculto** apenas como motor de áudio/login, e uma
**skin própria** (HTML/CSS) controla e exibe tudo.

Decisões:
- **Interface:** skin própria em HTML/CSS (não maquiar a página, não usar Webamp).
- **MVP:** transporte + metadados, fila/playlist (melhor esforço), ícone na bandeja,
  e um **botão para mostrar/esconder a janela real do YTM** (para o usuário navegar e
  escolher playlists, depois esconder de volta).
- Visualizador de espectro **fora do MVP** (ver "Fase posterior" — tem limitação CORS).

## Arquitetura: duas janelas

```
+----------------------------+        IPC         +-----------------------------+
|  Janela SKIN (frameless)   | <----------------> |  Main process (Node)        |
|  - UI Winamp em HTML/CSS   |   comandos/estado  |  - cria janelas + sessão    |
|  - preload: window.winamp  |                    |  - relay IPC skin <-> YTM   |
+----------------------------+                    |  - Tray                     |
                                                  +--------------+--------------+
                                                                 | webContents.send / on
                                                                 v
                                              +-----------------------------------+
                                              |  Janela YTM (BrowserWindow oculta)|
                                              |  show:false, persist:session, UA  |
                                              |  preload ytm-inject: lê <video> + |
                                              |  mediaSession, executa comandos   |
                                              +-----------------------------------+
```

- A **janela YTM** fica `show:false` por padrão; áudio continua tocando mesmo oculta.
  O botão "YTM" da skin faz `win.show()/win.hide()` para o usuário escolher playlist.
- A **janela skin** é o "rosto" do app (frameless, `resizable:false`, opcional always-on-top).

## Stack

- **Electron + Vite + TypeScript** via `electron-vite`.
- Sem framework de UI (HTML/CSS/TS puro) — a skin é pequena e pixel-art-like.
- `electron-builder` só depois (empacotar .dmg) — não faz parte do MVP.

## Estrutura de arquivos

```
src/
  main/
    index.ts          # entry: app.whenReady, cria skinWindow + ytmWindow, Tray, sessão
    session.ts        # partition 'persist:ytmusic' + User-Agent realista de Chrome
    ytm-window.ts     # cria a BrowserWindow oculta do YTM (show:false)
    ipc.ts            # handlers: relay comandos skin->YTM e estado YTM->skin
  preload/
    skin-preload.ts   # contextBridge -> window.winamp { play, pause, next, prev,
                      #   seek, setVolume, toggleYtmWindow, onState(cb) }
    ytm-inject.ts     # roda na página do YTM: lê estado, executa comandos, posta estado
  renderer/
    index.html        # marcação da skin
    style.css         # visual Winamp clássico
    app.ts            # liga botões -> window.winamp e renderiza estado recebido
```

## Pontos técnicos críticos

### 1. Login Google (maior risco — mitigado)
- **Não** usar OAuth/API; é login por **cookie no site**, igual navegador.
- `session.fromPartition('persist:ytmusic')` → loga **uma vez**, cookie persiste.
- User-Agent de Chrome real (sem "Electron") — o bloqueio "This browser or app may not
  be secure" é em boa parte por UA. Referência: th-ch/youtube-music.
- Fallback (se bloquear): abrir login no navegador do sistema.

### 2. Ler estado do YTM (preload `ytm-inject.ts`)
- **Metadados** (título, artista, capa): `navigator.mediaSession.metadata`.
- **Tempo/estado**: elemento `<video>` → `currentTime`, `duration`, `paused`, `volume`.
  Eventos `timeupdate`, `play`, `pause`, `loadedmetadata`.

### 3. Comandos (skin → main → YTM)
- Preferir o `<video>` direto: `play()/pause()`, `currentTime` (seek), `volume`.
- next/prev: clicar botões do YTM. Encapsular num módulo para corrigir fácil.

### 4. Fila / playlist (melhor esforço)
- Navegação principal = botão mostrar/esconder a janela YTM.
- Extra: ler a fila do DOM e listar na skin; clicar item troca a faixa.

### 5. Janela skin frameless + arrastar
- `frame:false, resizable:false`. Arrastar via CSS `-webkit-app-region: drag`.

### 6. Bandeja (Tray)
- Menu: Mostrar/Ocultar skin, Mostrar/Ocultar YTM, Play/Pause, Próxima, Sair.

## Fase posterior (não-MVP)
- Visualizador de espectro (PoC de CORS antes — áudio cross-origin pode "tainted"),
  atalhos globais de mídia (`globalShortcut`), `electron-builder`, skins `.wsz`, EQ.

## Implementação por etapas

- **Etapa 0** — Scaffold (janela em branco).
- **Etapa 1** — Janela YTM + login persistente (maior risco primeiro).
- **Etapa 2** — Skin frameless + botão mostrar/esconder YTM.
- **Etapa 3** — Ponte de estado (metadados → skin).
- **Etapa 4** — Comandos de transporte.
- **Etapa 5** — Bandeja.
- **Etapa 6** — Fila/playlist (melhor esforço).
- **Etapa 7** — Fase posterior (não-MVP).

## Verificação (teste ponta a ponta)
1. `npm run dev` → abre a skin; janela YTM oculta.
2. Botão "YTM" → janela aparece; logar no Google (1ª vez). Reabrir → continua logado.
3. Tocar música, esconder YTM → skin mostra título/artista/capa/progresso.
4. Skin: play/pause, próxima, anterior, seek, volume → refletem no áudio.
5. Bandeja: play/pause e mostrar/ocultar janelas.
6. (Se implementado) fila na skin troca a faixa ao clicar.

## Riscos
- Seletores DOM do YTM mudam → isolar tudo em `ytm-inject.ts`.
- Login Google bloqueado → UA + sessão persistente; fallback navegador.
- Visualizador pode falhar por CORS → fase posterior com PoC.
