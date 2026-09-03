/**
 * Régua horizontal de versões do museu.
 */

import { VERSIONS } from '../data/versions'

export default function VersionTimeline({ selectedId, onSelect }) {
  const selected = VERSIONS.find((v) => v.id === selectedId)

  return (
    <div className="mb-6 w-full max-w-lg px-4">
      <p className="mb-3 text-xs uppercase tracking-wide text-white/50">Linha do tempo</p>
      <div className="relative flex items-start justify-between gap-1">
        <div className="pointer-events-none absolute left-4 right-4 top-[11px] h-0.5 bg-white/20" />
        {VERSIONS.map((v) => {
          const isSelected = v.id === selectedId
          const locked = v.status !== 'playable'
          return (
            <button
              key={v.id}
              type="button"
              disabled={locked}
              aria-disabled={locked}
              onClick={(e) => {
                if (locked) {
                  e.preventDefault()
                  return
                }
                onSelect(v.id)
              }}
              title={locked ? 'Indisponível por enquanto' : v.blurb}
              className={`relative z-[1] flex w-16 flex-col items-center gap-1.5 ${
                locked
                  ? 'pointer-events-none cursor-not-allowed opacity-40'
                  : 'cursor-pointer'
              }`}
            >
              <span
                className={`h-5 w-5 rounded-full border-2 transition ${
                  isSelected
                    ? 'border-white bg-white shadow-[0_0_0_3px_rgba(255,255,255,0.25)]'
                    : locked
                      ? 'border-white/35 bg-transparent'
                      : 'border-white/70 bg-black/40 hover:bg-white/30'
                }`}
              />
              <span
                className={`text-[11px] font-medium leading-tight ${
                  isSelected ? 'text-white' : 'text-white/60'
                }`}
              >
                {v.title}
              </span>
              <span className="text-[10px] text-white/40">
                {locked ? 'Bloqueada' : v.dateLabel}
              </span>
            </button>
          )
        })}
      </div>
      {selected?.blurb && (
        <p className="mt-3 text-center text-xs text-white/55">{selected.blurb}</p>
      )}
    </div>
  )
}
