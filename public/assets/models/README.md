# Modelos 3D (.glb / .gltf)

Coloque aqui os modelos do museu e dos NPCs.

- Museu: `public/assets/models/museu.glb` -> ver bloco comentado em
  `src/components/MuseumEnvironment.jsx`.
- NPCs: `public/assets/models/npc.glb` -> use `<NPC modelPath="/assets/models/npc.glb" idleName="Idle" />`.

DRACO ja esta configurado em `src/App.jsx` (decoder via CDN oficial do three.js),
entao modelos comprimidos com DRACO funcionam automaticamente.
