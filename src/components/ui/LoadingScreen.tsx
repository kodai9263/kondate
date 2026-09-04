export function LoadingScreen() {
  return (
    <main className="grid min-h-[100dvh] place-items-center bg-kondate-bg px-6" aria-busy="true" aria-live="polite">
      <div className="text-kondate-muted" role="status" aria-label="読み込み中">
        <span className="block size-8 animate-spin rounded-full border-2 border-kondate-line border-t-kondate-accent" aria-hidden="true" />
      </div>
    </main>
  );
}
