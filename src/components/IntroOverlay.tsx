/** Écran titre (phase 1 de la séquence d'accueil). Toucher pour passer. */
export function IntroOverlay({ phase, onSkip }: { phase: 'logo' | 'reveal' | 'done'; onSkip: () => void }) {
  if (phase === 'done') return null;
  return (
    <div
      onClick={onSkip}
      className="absolute inset-0 z-40 grid place-items-center transition-[opacity,background-color] duration-[900ms]"
      style={{ opacity: phase === 'logo' ? 1 : 0, backgroundColor: phase === 'logo' ? 'rgb(8 10 13)' : 'rgba(8,10,13,0)', pointerEvents: phase === 'logo' ? 'auto' : 'none' }}
    >
      <div className="text-center">
        <div className="text-[13px] font-medium uppercase tracking-[0.5em] text-mute">BMW 116i · F21 LCI</div>
        <div className="mt-4 text-6xl font-extralight tracking-[0.18em]">F21 <span className="text-accent">DIGITAL</span></div>
        <div className="mx-auto mt-6 h-px w-64 origin-left bg-gradient-to-r from-transparent via-accent to-transparent" style={{ animation: 'logoLine 1.1s cubic-bezier(.2,.7,.2,1) both' }} />
      </div>
    </div>
  );
}
