// Loading global — spinner VNK affiche pendant le chargement des pages
export default function Loading() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-4">
        <div className="relative h-14 w-14">
          <div className="absolute inset-0 rounded-full border-[3px] border-muted" />
          <div className="absolute inset-0 rounded-full border-[3px] border-t-[#0F2D52] animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[10px] font-bold text-[#0F2D52]">VNK</span>
          </div>
        </div>
        <p className="text-sm text-muted-foreground animate-pulse">Chargement...</p>
      </div>
    </div>
  );
}
