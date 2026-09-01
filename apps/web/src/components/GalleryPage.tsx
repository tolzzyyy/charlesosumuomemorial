import { useEffect, useState } from "react";

const excludedPhotoNumbers = new Set([1, 2, 4, 11, 12, 13, 20, 21, 23, 24, 25, 27]);
const galleryPhotoNumbers = Array.from({ length: 40 }, (_, index) => index + 1).filter(
  (number) => !excludedPhotoNumbers.has(number),
);
const memorialPhotos = galleryPhotoNumbers.map((number, index) => ({
  src: `/images/memories/charles-${String(number).padStart(2, "0")}.jpg`,
  thumbnail: `/images/memories/thumbs/charles-${String(number).padStart(2, "0")}.jpg`,
  alt: `A photograph from Chief Charles Chidiebere Osumuo's life, ${index + 1} of ${galleryPhotoNumbers.length}`,
}));

export function GalleryPage() {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  useEffect(() => {
    if (selectedIndex === null) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedIndex(null);
      if (event.key === "ArrowLeft") {
        setSelectedIndex((current) =>
          current === null ? null : (current - 1 + memorialPhotos.length) % memorialPhotos.length,
        );
      }
      if (event.key === "ArrowRight") {
        setSelectedIndex((current) =>
          current === null ? null : (current + 1) % memorialPhotos.length,
        );
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedIndex]);

  const selectedPhoto = selectedIndex === null ? null : memorialPhotos[selectedIndex];

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <a
        className="fixed top-4 left-4 z-[100] -translate-y-[200%] bg-white px-4 py-3 text-navy transition-transform focus:translate-y-0"
        href="#gallery-grid"
      >
        Skip to photographs
      </a>

      <header className="flex h-[76px] items-center justify-between border-b border-[#e7ebee] bg-white px-[clamp(1.25rem,6vw,6.5rem)] max-sm:h-[68px] max-sm:px-5">
        <a className="grid leading-none tracking-[.12em] uppercase" href="/" aria-label="Chief Charles Chidiebere Osumuo memorial home">
          <span className="mb-[.38rem] text-[.58rem] font-semibold text-gold max-sm:hidden">In loving memory</span>
          <strong className="font-display text-[1.05rem] tracking-[.06em] text-navy max-sm:text-[.78rem] max-sm:tracking-[.025em]">Chief Charles Chidiebere Osumuo</strong>
        </a>
        <a
          className="text-[.7rem] font-semibold tracking-[.08em] text-navy uppercase transition-colors hover:text-gold focus-visible:text-gold"
          href="/#memories"
        >
          <span aria-hidden="true">← </span>Back to memorial
        </a>
      </header>

      <main>
        <section className="bg-navy px-[clamp(1.25rem,10vw,10rem)] py-[clamp(4.5rem,9vw,8rem)] text-white max-sm:px-5 max-sm:py-14">
          <p className="mb-3 text-[.68rem] font-semibold tracking-[.18em] text-[#d3aa64] uppercase">Photo archive</p>
          <h1 className="max-w-[780px] font-display text-[clamp(3rem,7vw,6.5rem)] leading-[1.08] font-semibold tracking-[-.04em] max-sm:text-[2.75rem]">
            A lifetime in photographs.
          </h1>
          <p className="mt-7 max-w-[580px] text-[.95rem] leading-[1.7] text-[#bdcbd5] max-sm:text-[.9rem] max-sm:leading-[1.6]">
            Twenty-eight photographs shared by family and friends, gathered together in memory of Chief Charles.
          </p>
        </section>

        <section
          id="gallery-grid"
          className="px-[clamp(1.25rem,6vw,6.5rem)] py-[clamp(4rem,8vw,7rem)] max-sm:px-5 max-sm:py-12"
          aria-label="All memorial photographs"
        >
          <div className="mb-8 flex items-end justify-between gap-6 border-b border-[#dfe6eb] pb-5">
            <div>
              <p className="mb-2 text-[.64rem] font-semibold tracking-[.16em] text-[#8a6b34] uppercase">All memories</p>
              <h2 className="font-display text-[clamp(2rem,4vw,3.3rem)] leading-[1.1] text-navy">{memorialPhotos.length} photographs</h2>
            </div>
            <p className="text-[.72rem] leading-[1.55] text-muted max-sm:max-w-[130px] max-sm:text-right">Select a photograph to view it full screen.</p>
          </div>

          <div className="columns-1 gap-4 sm:columns-2 lg:columns-3 xl:columns-4">
            {memorialPhotos.map((photo, index) => (
              <button
                type="button"
                className="group relative mb-4 block w-full cursor-zoom-in break-inside-avoid overflow-hidden border-0 bg-mist p-0 text-left"
                key={photo.src}
                onClick={() => setSelectedIndex(index)}
                aria-label={`Open photograph ${index + 1} of ${memorialPhotos.length}`}
              >
                <img
                  className="h-auto w-full transition-[transform,filter] duration-500 group-hover:scale-[1.025] group-hover:saturate-100"
                  src={photo.thumbnail}
                  alt={photo.alt}
                  loading={index < 6 ? "eager" : "lazy"}
                  decoding="async"
                />
                <span className="absolute right-3 bottom-3 translate-y-1 bg-navy/85 px-2.5 py-2 text-[.6rem] tracking-[.1em] text-white uppercase opacity-0 transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100">
                  View photo
                </span>
              </button>
            ))}
          </div>
        </section>
      </main>

      <footer className="grid min-h-[120px] place-content-center gap-[.4rem] bg-navy-deep text-center text-white">
        <strong className="font-display text-[1.25rem]">Chief Charles Chidiebere Osumuo</strong>
        <span className="text-[.6rem] tracking-[.14em] text-[#849aab] uppercase">1962 · Forever remembered</span>
      </footer>

      {selectedPhoto && selectedIndex !== null ? (
        <div
          className="fixed inset-0 z-[60] grid place-items-center bg-[rgba(0,19,32,.96)] p-8 max-sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`Photograph ${selectedIndex + 1} of ${memorialPhotos.length}`}
          onClick={(event) => {
            if (event.target === event.currentTarget) setSelectedIndex(null);
          }}
        >
          <button
            className="fixed top-4 right-4 z-10 h-[46px] w-[46px] cursor-pointer border border-white/35 bg-navy/30 font-serif text-[2rem] text-white transition-colors hover:bg-white hover:text-navy"
            type="button"
            onClick={() => setSelectedIndex(null)}
            aria-label="Close photograph"
          >
            ×
          </button>
          <button
            className="fixed top-1/2 left-4 z-10 h-12 w-12 -translate-y-1/2 cursor-pointer border border-white/35 bg-navy/30 text-xl text-white transition-colors hover:bg-white hover:text-navy max-sm:top-auto max-sm:bottom-4 max-sm:translate-y-0"
            type="button"
            onClick={() => setSelectedIndex((selectedIndex - 1 + memorialPhotos.length) % memorialPhotos.length)}
            aria-label="Previous photograph"
          >
            ←
          </button>
          <img
            className="max-h-[86vh] max-w-[min(88vw,1200px)] object-contain max-sm:max-h-[78vh] max-sm:max-w-[94vw]"
            src={selectedPhoto.src}
            alt={selectedPhoto.alt}
            decoding="async"
          />
          <button
            className="fixed top-1/2 right-4 z-10 h-12 w-12 -translate-y-1/2 cursor-pointer border border-white/35 bg-navy/30 text-xl text-white transition-colors hover:bg-white hover:text-navy max-sm:top-auto max-sm:bottom-4 max-sm:translate-y-0"
            type="button"
            onClick={() => setSelectedIndex((selectedIndex + 1) % memorialPhotos.length)}
            aria-label="Next photograph"
          >
            →
          </button>
          <p className="fixed bottom-5 left-1/2 -translate-x-1/2 text-[.68rem] tracking-[.12em] text-white/75 uppercase max-sm:bottom-8">
            {String(selectedIndex + 1).padStart(2, "0")} / {memorialPhotos.length}
          </p>
        </div>
      ) : null}
    </div>
  );
}
