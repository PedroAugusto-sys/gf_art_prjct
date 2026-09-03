/**
 * artworkTargets.js
 *
 * Mapa global { artworkId -> THREE.Mesh } para que o ArtworkFocus possa
 * fazer raycast diretamente sobre as malhas das obras sem precisar
 * percorrer a cena toda a cada frame.
 */

const targets = new Map() // artworkId (string) -> THREE.Mesh

export function registerArtwork(id, mesh) {
  if (mesh) {
    targets.set(id, mesh)
  } else {
    targets.delete(id)
  }
}

export function getArtworkTargets() {
  return targets
}
