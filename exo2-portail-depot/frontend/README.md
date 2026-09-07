# Frontend

Application React/Vite utilisant Chakra UI v3 et les tokens visuels DIV Protocol.

Pages : `/login` (avocat), `/` (dashboard), `/d/:token` (dépôt public + PIN).
Charte : `#5100FF` primary, bouton pill hover inversé, cards blanches `1px #E9E9E9` radius 12 sans ombre, Inter 400/600, reveal 0.55s.
Upload : presign -> PUT MinIO direct avec progression XHR -> complete. États vide/chargement/erreur gérés, 375px OK.

```bash
npm install
npm run dev   # proxy /api -> :3000
npm run build # dist/ servi par nginx
```
