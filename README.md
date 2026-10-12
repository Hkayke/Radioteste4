# Conexão FM — rádio online

Site responsivo para Android e computador, com página pública e painel do DJ.

## Recursos
- Página pública com botão de ouvir, status ao vivo, música atual e contador de ouvintes conectados.
- Painel protegido por senha configurada no servidor.
- Playlist local: o DJ seleciona arquivos de áudio no aparelho/computador e controla tocar, pausar, avançar e volume.
- Microfone com botão Push-to-Talk, controles de voz, eco e equalização básica.
- Mixagem de música + microfone enviada aos ouvintes por WebRTC.
- Link público compartilhável e botão de copiar.
- Sinalização Socket.IO e endpoint `/health`.

## Publicar no Render
1. Envie estes arquivos para um repositório GitHub.
2. No Render, selecione **New + → Blueprint** e conecte o repositório para usar `render.yaml`, ou crie um **Web Service** manual.
3. Build Command: `npm install`
4. Start Command: `npm start`
5. Em Environment, configure `ADMIN_PASSWORD` com uma senha forte. Opcional: `RADIO_NAME`.
6. Após o deploy, abra `https://SEU-SITE.onrender.com/admin.html` para o painel e compartilhe `https://SEU-SITE.onrender.com/` com os ouvintes.

## Como usar
1. Entre em `/admin.html`, informe a senha configurada no Render.
2. Selecione músicas usando “Adicionar músicas”. Os arquivos ficam no dispositivo do DJ e não são enviados para o servidor.
3. Permita acesso ao microfone. Use “Iniciar transmissão” e “Falar (segure)” para falar.
4. Os ouvintes abrem o endereço público e tocam em “Ouvir ao vivo”. Em celulares, é necessário tocar no botão para liberar áudio.
5. Mantenha a aba do painel aberta e o dispositivo conectado enquanto estiver transmitindo.

## Limitações importantes
- A transmissão ao vivo usa WebRTC peer-to-peer. Para muitos ouvintes, uma infraestrutura de mídia dedicada (SFU/servidor de streaming) é mais adequada. Este projeto é uma base funcional para testes e audiências pequenas; cada ouvinte aumenta o uso de upload do DJ.
- Alguns roteadores/rede móvel podem exigir um servidor TURN para atravessar NAT. Para produção, configure um serviço TURN e inclua sua configuração ICE em `public/admin.js` e `public/listener.js`.
- Voz com efeitos e mixagem dependem do suporte de áudio do navegador. Use Chrome no Android e conceda permissão de microfone.
- O navegador pode suspender abas em segundo plano, principalmente no Android. Mantenha a tela/aba ativa durante a transmissão.
- Só transmita músicas e conteúdos para os quais você tenha os direitos ou autorização necessários.
- A senha do painel protege a entrada normal, mas para produção pública recomenda-se autenticação robusta, limitação de tentativas e TURN/SFU gerenciado.

## Estrutura
- `server.js`: servidor Express + Socket.IO e sinalização WebRTC.
- `public/index.html`: página pública.
- `public/admin.html`: painel do DJ.
- `public/listener.js`: reprodução e conexão do ouvinte.
- `public/admin.js`: playlist, microfone, efeitos e envio WebRTC.
- `public/style.css`: visual responsivo.
