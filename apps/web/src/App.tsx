import { useEffect, useMemo, useRef, useState } from "react";
import { MemoryForm } from "./components/MemoryForm";
import { MemoryPhotoForm } from "./components/MemoryPhotoForm";
import { GalleryPage } from "./components/GalleryPage";
import {
  apiUrl,
  getMemorial,
  getMemoryPhotos,
  getTributes,
  type MemoryPhoto,
  type MemoryPhotoReceipt,
  type MemorialData,
  type MemorialMedia,
  type Tribute,
  type TributeReceipt,
} from "./lib/api";

type LightboxImage = {
  url: string;
  altText: string | null;
};

function MemorialImage({ decoding = "async", ...props }: React.ComponentPropsWithoutRef<"img">) {
  return <img decoding={decoding} {...props} />;
}

function memorialThumbnailUrl(url: string): string {
  return /^\/images\/memories\/charles-\d{2}\.jpg$/.test(url)
    ? url.replace("/images/memories/", "/images/memories/thumbs/")
    : url;
}

const eyebrowClass =
  "mb-3 text-[.68rem] font-semibold uppercase tracking-[.18em] text-[#8a6b34]";
const pageSectionClass =
  "px-[clamp(1.25rem,10vw,10rem)] py-[clamp(4.75rem,8vw,7.5rem)] max-sm:px-5 max-sm:py-[3.5rem]";
const buttonClass =
  "inline-flex min-h-12 cursor-pointer items-center justify-center border border-transparent px-[1.4rem] py-[.85rem] text-[.72rem] font-semibold uppercase tracking-[.09em] transition-transform duration-200 hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-70 disabled:hover:translate-y-0";
const textLinkClass =
  "inline-flex items-center gap-[.65rem] text-[.76rem] font-semibold uppercase tracking-[.08em]";
const navItems = [
  ["#story", "His story"],
  ["#milestones", "Milestones"],
  ["#favourites", "Favourites"],
  ["#memories", "Memory Wall"],
  ["#tributes", "Tributes"],
  ["#funeral", "Funeral"],
] as const;
const galleryTileLayouts = [
  "row-span-2 max-sm:col-span-2 max-sm:row-span-1 max-sm:row-start-1",
  "col-start-2 row-start-1 max-sm:col-start-1 max-sm:row-start-2",
  "col-start-3 row-start-1 max-sm:col-start-2 max-sm:row-start-2",
  "col-start-2 row-start-2 max-sm:col-start-1 max-sm:row-start-3",
  "col-start-3 row-start-2 max-sm:col-start-2 max-sm:row-start-3",
];

const featuredGalleryPhotoNumbers = [3, 10, 8, 14, 17];

const fallbackGallery = featuredGalleryPhotoNumbers.map((number, index) => ({
  id: `fallback-${number}`,
  mediaType: "image" as const,
  url: `/images/memories/charles-${String(number).padStart(2, "0")}.jpg`,
  altText: `A photograph from Chief Charles Chidiebere Osumuo's life`,
  caption: null,
  isFeatured: false,
  sortOrder: index,
}));

const funeralArrangements = [
  {
    title: "Requiem Mass",
    date: "Tuesday 13th October 2026",
    details: [
      "Address: Catholic Church of the Holy Spirit,",
      "56 Adeyemo Akakpo Street, by 1 Agoro Street, Omole Estate Phase 1, Ikeja, Ojodu Berger 100213, Lagos.",
      "Time: 5pm",
    ],
  },
  {
    title: "Wake Keep (Lagos)",
    date: "Thursday 15th October 2026",
    details: [
      "Address: The Stable, Union Bank Hall,",
      "43/45 Bode Thomas, Surulere, Lagos.",
      "Time: 9am–6pm",
    ],
  },
  {
    title: "Wake Keep (Village)",
    date: "Thursday 29th October 2026",
    details: [
      "Wake keep at his compound, Okofia Village, Otolo, Nnewi.",
      "Time: 5pm",
    ],
  },
  {
    title: "Lying in State & Final Burial",
    date: "Friday 30th October 2026",
    details: [
      "7:00am – Body leaves Nnewi Diocesan Mortuary, Akwudo.",
      "8:00am – Lying in state in his house in Okofia, Otolo, Nnewi.",
      "10:00am – Body leaves for Mass at St Paul Catholic Church, Okofia, Otolo, Nnewi.",
      "12:30pm – Internment in his compound, Okofia, Otolo, Nnewi.",
    ],
  },
  {
    title: "Thanksgiving Mass",
    date: "Sunday 1st November 2026",
    details: [
      "St Pauls Catholic Church, Okofia, Otolo, Nnewi.",
      "Time: 6:30am",
    ],
  },
] as const;

function formatDate(date: string | null): string {
  if (!date) return "To be announced";
  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Africa/Lagos",
  }).format(new Date(`${date}T12:00:00+01:00`));
}

function SectionHeading({
  eyebrow,
  children,
  compactOnMobile = false,
  className = "",
}: {
  eyebrow: string;
  children: React.ReactNode;
  compactOnMobile?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <p
        className={`${eyebrowClass} ${
          compactOnMobile ? "max-sm:mb-[.55rem] max-sm:text-[.62rem] max-sm:leading-[1.35]" : ""
        }`}
      >
        {eyebrow}
      </p>
      <h2
        className={`mb-[clamp(2.2rem,4vw,3.2rem)] font-display text-[clamp(2.25rem,5vw,4.35rem)] leading-[1.12] font-semibold tracking-[-.03em] max-sm:mb-8 max-sm:text-[2.3rem] max-sm:leading-[1.12] ${
          compactOnMobile ? "max-sm:text-[2.05rem] max-sm:leading-[1.1]" : ""
        }`}
      >
        {children}
      </h2>
    </div>
  );
}

function TributeCarousel({ tributes }: { tributes: Tribute[] }) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setActiveIndex((current) => Math.min(current, Math.max(tributes.length - 1, 0)));
  }, [tributes.length]);

  function showPrevious() {
    setActiveIndex((current) => (current - 1 + tributes.length) % tributes.length);
  }

  function showNext() {
    setActiveIndex((current) => (current + 1) % tributes.length);
  }

  return (
    <div
      className="relative"
      role="region"
      aria-roledescription="carousel"
      aria-label="Tributes from family and friends"
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          showPrevious();
        }
        if (event.key === "ArrowRight") {
          event.preventDefault();
          showNext();
        }
      }}
    >
      <div className="overflow-hidden bg-mist">
        <div
          className="flex transition-transform duration-[550ms] ease-[cubic-bezier(.22,.61,.36,1)]"
          style={{ transform: `translateX(-${activeIndex * 100}%)` }}
        >
          {tributes.map((tribute, index) => (
            <article
              className="grid min-h-[380px] w-full min-w-full items-stretch bg-mist max-sm:min-h-0"
              key={tribute.id}
              role="group"
              aria-roledescription="slide"
              aria-label={`${index + 1} of ${tributes.length}`}
              aria-hidden={index !== activeIndex}
            >
              <div className="relative flex flex-col justify-between p-[clamp(2rem,5vw,4.8rem)] before:absolute before:top-[.4rem] before:left-[clamp(1.25rem,3vw,3rem)] before:font-display before:text-[clamp(5rem,9vw,9rem)] before:leading-none before:text-gold/30 before:content-['“'] max-sm:min-h-0 max-sm:px-5 max-sm:py-6 max-sm:before:left-3">
                <blockquote className="relative z-10 mb-10 max-w-[760px] pt-[clamp(2.5rem,4vw,3.75rem)] font-display text-[clamp(1.45rem,3vw,2.35rem)] leading-[1.5] text-navy max-sm:mb-6 max-sm:pt-7 max-sm:text-[1.3rem] max-sm:leading-[1.5]">
                  {tribute.message}
                </blockquote>
                <footer className="grid gap-[.2rem] border-l-2 border-gold pl-4">
                  <strong className="text-[.82rem] font-semibold uppercase tracking-[.06em] text-ink">
                    {tribute.name}
                  </strong>
                  <span className="text-[.72rem] text-muted">{tribute.relationship}</span>
                </footer>
              </div>
            </article>
          ))}
        </div>
      </div>

      {tributes.length > 1 ? (
        <div className="mt-5 flex items-center justify-between gap-6 max-sm:mt-4 max-sm:justify-center">
          <div className="flex items-center gap-[.85rem] max-sm:w-full max-sm:max-w-[260px] max-sm:justify-between">
            <button
              type="button"
              className="h-11 w-11 shrink-0 cursor-pointer border border-[#ccd7df] bg-transparent p-0 text-[1.1rem] text-navy transition-colors hover:border-navy hover:bg-navy hover:text-white focus-visible:border-navy focus-visible:bg-navy focus-visible:text-white max-sm:h-10 max-sm:w-10"
              onClick={showPrevious}
              aria-label="Show previous tribute"
            >
              <span aria-hidden="true">←</span>
            </button>
            <p
              className="min-w-[63px] text-center text-[.68rem] tracking-[.08em] text-[#8b99a2] max-sm:min-w-[76px] max-sm:text-[.72rem]"
              aria-live="polite"
              aria-atomic="true"
            >
              <span className="font-bold text-navy">
                {String(activeIndex + 1).padStart(2, "0")}
              </span>
              <span aria-hidden="true"> / </span>
              <span>{String(tributes.length).padStart(2, "0")}</span>
            </p>
            <button
              type="button"
              className="h-11 w-11 shrink-0 cursor-pointer border border-[#ccd7df] bg-transparent p-0 text-[1.1rem] text-navy transition-colors hover:border-navy hover:bg-navy hover:text-white focus-visible:border-navy focus-visible:bg-navy focus-visible:text-white max-sm:h-10 max-sm:w-10"
              onClick={showNext}
              aria-label="Show next tribute"
            >
              <span aria-hidden="true">→</span>
            </button>
          </div>
          <div
            className="flex items-center gap-[.45rem] max-sm:hidden"
            aria-label="Choose a tribute"
          >
            {tributes.map((tribute, index) => (
              <button
                type="button"
                key={tribute.id}
                className={`relative h-6 cursor-pointer border-0 bg-transparent p-0 transition-[width] duration-200 before:absolute before:inset-x-0 before:top-1/2 before:h-[3px] before:-translate-y-1/2 before:bg-[#cbd5dc] before:transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy ${
                  index === activeIndex
                    ? "w-[42px] before:bg-gold max-sm:w-7"
                    : "w-6 max-sm:w-4"
                }`}
                onClick={() => setActiveIndex(index)}
                aria-label={`Show tribute ${index + 1}`}
                aria-current={index === activeIndex ? "true" : undefined}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function CommunityPhotoCarousel({
  photos,
  onOpen,
}: {
  photos: MemoryPhoto[];
  onOpen: (image: LightboxImage) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setActiveIndex((current) => Math.min(current, Math.max(photos.length - 1, 0)));
  }, [photos.length]);

  function showPhoto(index: number) {
    const normalizedIndex = (index + photos.length) % photos.length;
    const item = trackRef.current?.children.item(normalizedIndex) as HTMLElement | null;
    item?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "start" });
    setActiveIndex(normalizedIndex);
  }

  function handleScroll() {
    const track = trackRef.current;
    if (!track) return;

    const items = Array.from(track.children) as HTMLElement[];
    const closestIndex = items.reduce((closest, item, index) => {
      const closestDistance = Math.abs(items[closest].offsetLeft - track.scrollLeft);
      const distance = Math.abs(item.offsetLeft - track.scrollLeft);
      return distance < closestDistance ? index : closest;
    }, 0);
    setActiveIndex(closestIndex);
  }

  return (
    <div role="region" aria-label="Photographs shared by family and friends">
      <div
        ref={trackRef}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        onScroll={handleScroll}
      >
        {photos.map((photo, index) => (
          <button
            type="button"
            className="group relative aspect-[4/5] basis-[calc((100%-2rem)/3)] shrink-0 snap-start cursor-zoom-in overflow-hidden border-0 bg-mist p-0 text-left max-[980px]:basis-[calc((100%-1rem)/2)] max-sm:basis-[86%]"
            key={photo.id}
            onClick={() =>
              onOpen({ url: apiUrl(photo.image.url), altText: photo.image.altText })
            }
            aria-label={`Open photograph ${index + 1} of ${photos.length}, shared by ${photo.contributorName}`}
          >
            <img
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.035]"
              src={apiUrl(photo.image.url)}
              alt={photo.image.altText ?? `Photograph shared by ${photo.contributorName}`}
              loading="lazy"
            />
            <span className="absolute inset-x-0 bottom-0 grid gap-1 bg-gradient-to-t from-navy/95 to-transparent px-5 pt-20 pb-5 text-white">
              <strong className="font-display text-xl leading-[1.3]">
                {photo.caption || "A memory of Chief Charles"}
              </strong>
              <small className="text-[.68rem] tracking-[.06em] text-white/75 uppercase">
                Shared by {photo.contributorName}
              </small>
            </span>
          </button>
        ))}
      </div>

      {photos.length > 1 ? (
        <div className="mt-5 flex items-center justify-between gap-6 max-sm:mt-3">
          <p className="text-[.68rem] tracking-[.08em] text-[#8b99a2]" aria-live="polite">
            <span className="font-bold text-navy">
              {String(activeIndex + 1).padStart(2, "0")}
            </span>
            <span aria-hidden="true"> / </span>
            <span>{String(photos.length).padStart(2, "0")}</span>
          </p>
          <div className="flex items-center gap-2">
            <span className="mr-2 text-[.65rem] tracking-[.08em] text-muted uppercase max-sm:hidden">
              Swipe or browse
            </span>
            <button
              type="button"
              className="h-11 w-11 cursor-pointer border border-[#ccd7df] bg-white p-0 text-[1.1rem] text-navy transition-colors hover:border-navy hover:bg-navy hover:text-white max-sm:h-10 max-sm:w-10"
              onClick={() => showPhoto(activeIndex - 1)}
              aria-label="Show previous shared photograph"
            >
              <span aria-hidden="true">←</span>
            </button>
            <button
              type="button"
              className="h-11 w-11 cursor-pointer border border-[#ccd7df] bg-white p-0 text-[1.1rem] text-navy transition-colors hover:border-navy hover:bg-navy hover:text-white max-sm:h-10 max-sm:w-10"
              onClick={() => showPhoto(activeIndex + 1)}
              aria-label="Show next shared photograph"
            >
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MemorialHome() {
  const [data, setData] = useState<MemorialData | null>(null);
  const [tributes, setTributes] = useState<Tribute[]>([]);
  const [memoryPhotos, setMemoryPhotos] = useState<MemoryPhoto[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<LightboxImage | null>(null);
  const [showBackToTop, setShowBackToTop] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    getMemorial(controller.signal)
      .then(setData)
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setLoadError(true);
      });
    getTributes(controller.signal)
      .then(setTributes)
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
      });
    getMemoryPhotos(controller.signal)
      .then(setMemoryPhotos)
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!selectedImage) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedImage(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [selectedImage]);

  useEffect(() => {
    const updateBackToTopVisibility = () => {
      const hero = document.getElementById("top");
      setShowBackToTop(hero ? hero.getBoundingClientRect().bottom < 0 : window.scrollY > 600);
    };

    updateBackToTopVisibility();
    window.addEventListener("scroll", updateBackToTopVisibility, { passive: true });
    return () => window.removeEventListener("scroll", updateBackToTopVisibility);
  }, []);

  const gallery = useMemo(() => {
    if (!data?.media.length) return fallbackGallery;
    return featuredGalleryPhotoNumbers
      .map((number) =>
        data.media.find((item) => item.url.endsWith(`charles-${String(number).padStart(2, "0")}.jpg`)),
      )
      .filter((item): item is MemorialMedia => Boolean(item));
  }, [data]);

  const timeline = data?.timeline ?? [];
  const funeral = data?.funeral;
  const fullName = data?.memorial.fullName ?? "Chief Charles Chidiebere Osumuo";
  const name = fullName.startsWith("Chief ") ? fullName : `Chief ${fullName}`;
  const heroImage = data?.memorial.heroMediaUrl ?? "/images/hero/chief-charles-hero.jpg";

  const milestones = [
    ...timeline.map((event) => {
      const isChildrenMilestone = ["birth of first child", "blessed with 4 children"]
        .includes(event.title.toLowerCase());

      return {
        key: event.id,
        year: isChildrenMilestone ? "1998–2005" : event.eventYear?.toString() ?? "—",
        title: isChildrenMilestone ? "Blessed with 4 Children" : event.title,
        detail: isChildrenMilestone
          ? "They are blessed with 4 children."
          : event.location ?? event.description,
      };
    }),
    ...(funeral?.funeralDate
      ? [
          {
            key: "funeral",
            year: "2026",
            title: "Funeral & burial",
            detail: formatDate(funeral.funeralDate),
          },
        ]
      : []),
  ];

  function closeMenu() {
    setMenuOpen(false);
  }

  async function handleTributeSubmitted(receipt: TributeReceipt) {
    if (receipt.status !== "approved") return;
    try {
      const approvedTributes = await getTributes();
      setTributes(approvedTributes);
      window.setTimeout(() => {
        document.getElementById("tributes")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 50);
    } catch {
      // The tribute is already stored; a normal refresh will retrieve it.
    }
  }

  async function handleMemoryPhotoSubmitted(receipt: MemoryPhotoReceipt) {
    if (receipt.status !== "approved") return;

    const publishedPhoto = receipt.photo;
    if (publishedPhoto) {
      setMemoryPhotos((current) => [
        publishedPhoto,
        ...current.filter((photo) => photo.id !== publishedPhoto.id),
      ]);
      window.setTimeout(() => {
        document.getElementById("community-photo-wall")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 50);
      return;
    }

    try {
      const approvedPhotos = await getMemoryPhotos();
      setMemoryPhotos(approvedPhotos);
      window.setTimeout(() => {
        document.getElementById("community-photo-wall")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 50);
    } catch {
      // The image is already stored; a normal refresh will retrieve it.
    }
  }

  return (
    <div className="overflow-x-clip">
      <a
        className="fixed top-4 left-4 z-[100] -translate-y-[200%] bg-white px-4 py-3 text-navy transition-transform focus:translate-y-0"
        href="#main"
      >
        Skip to main content
      </a>
      <header className="relative z-20 flex h-[86px] items-center justify-between border-b border-[#e7ebee] bg-white px-[clamp(1.25rem,6vw,6.5rem)] max-[980px]:h-[72px] max-sm:px-5">
        <a className="grid leading-none tracking-[.12em] uppercase" href="#top" aria-label="Chief Charles Chidiebere Osumuo memorial home">
          <span className="mb-[.38rem] text-[.58rem] font-semibold text-gold max-sm:hidden">In loving memory</span>
          <strong className="font-display text-[1.05rem] tracking-[.06em] text-navy max-sm:text-[.78rem] max-sm:tracking-[.025em]">Chief Charles Chidiebere Osumuo</strong>
        </a>
        <button
          className="hidden h-[42px] w-[42px] cursor-pointer place-content-center gap-1 border-0 bg-transparent text-navy max-[980px]:grid"
          type="button"
          aria-expanded={menuOpen}
          aria-controls="main-navigation"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span className={`block h-px w-[22px] origin-center bg-current transition-[transform,opacity] duration-[450ms] ${menuOpen ? "translate-y-[5px] rotate-45" : ""}`} />
          <span className={`block h-px w-[22px] origin-center bg-current transition-[transform,opacity] duration-[450ms] ${menuOpen ? "scale-x-0 opacity-0" : ""}`} />
          <span className={`block h-px w-[22px] origin-center bg-current transition-[transform,opacity] duration-[450ms] ${menuOpen ? "-translate-y-[5px] -rotate-45" : ""}`} />
          <span className="sr-only">Toggle menu</span>
        </button>
        <div
          className={`contents max-[980px]:absolute max-[980px]:top-full max-[980px]:right-0 max-[980px]:left-0 max-[980px]:block max-[980px]:overflow-hidden ${
            menuOpen ? "max-[980px]:pointer-events-auto" : "max-[980px]:pointer-events-none"
          }`}
        >
          <nav
            id="main-navigation"
            className={`flex items-center gap-[clamp(1.1rem,2.5vw,2.6rem)] max-[980px]:flex-col max-[980px]:items-stretch max-[980px]:gap-0 max-[980px]:bg-white max-[980px]:px-5 max-[980px]:py-4 max-[980px]:shadow-[0_15px_25px_rgba(4,31,48,.12)] max-[980px]:transform-gpu max-[980px]:will-change-transform max-[980px]:[backface-visibility:hidden] max-[980px]:transition-transform max-[980px]:duration-[450ms] max-[980px]:ease-[cubic-bezier(.22,1,.36,1)] ${
              menuOpen ? "max-[980px]:translate-y-0" : "max-[980px]:-translate-y-full"
            }`}
            aria-label="Main navigation"
          >
            {navItems.map(([href, label]) => (
              <a
                key={href}
                className="text-[.78rem] font-semibold tracking-[.08em] text-[#4b5a64] uppercase transition-colors duration-200 hover:text-gold focus-visible:text-gold max-[980px]:border-b max-[980px]:border-[#edf0f2] max-[980px]:py-[.9rem]"
                href={href}
                onClick={closeMenu}
              >
                {label}
              </a>
            ))}
          </nav>
        </div>
      </header>

      <main id="main">
        <section id="top" className="grid min-h-[650px] grid-cols-[minmax(0,1fr)_minmax(330px,.78fr)] items-center gap-[clamp(3rem,8vw,8rem)] overflow-hidden bg-navy px-[clamp(1.25rem,10vw,10rem)] py-[5.4rem] text-white max-[980px]:min-h-0 max-[980px]:grid-cols-1 max-[980px]:gap-12 max-[980px]:py-[4.5rem] max-sm:px-5 max-sm:pt-8 max-sm:pb-16">
          <div className="max-w-[650px] max-sm:text-center">
            <p className={`${eyebrowClass} text-[#d3aa64]`}>In loving memory of</p>
            <h1 className="mb-[1.1rem] max-w-[700px] font-display text-[clamp(3.5rem,7vw,7rem)] leading-[1.05] font-semibold tracking-[-.045em] max-sm:text-[clamp(2.85rem,13vw,4.2rem)] max-sm:leading-[1.05]">{name}</h1>
            <p className="text-[.85rem] font-medium tracking-[.14em] text-[#d9e1e8] uppercase max-sm:text-[.65rem]">Born 1962 · Forever in our hearts</p>
            <p className="my-10 max-w-[540px] font-display text-[1.2rem] leading-[1.5] text-[#bdcbd5] max-sm:mx-auto max-sm:my-[1.7rem] max-sm:text-[1.05rem] max-sm:leading-[1.5]">Let the memory of Charles be with us forever.</p>
            <div className="flex flex-wrap items-center gap-3 max-sm:flex-col">
              <a className={`${buttonClass} bg-gold text-[#09243a] max-sm:w-full`} href="#share-tribute">Share a tribute</a>
              <a className={`${buttonClass} border-white/35 bg-white/[.04] text-white hover:border-gold hover:bg-white/[.08] max-sm:w-full`} href="#tributes">
                View other tributes <span className="ml-2 text-[1.15em] text-gold" aria-hidden="true">↓</span>
              </a>
            </div>
            <a className={`${textLinkClass} mt-5 text-[#bdcbd5] transition-colors hover:text-white max-sm:justify-center`} href="#story">Read his story <span className="text-[1.2em] text-gold" aria-hidden="true">↓</span></a>
          </div>
          <figure className="relative mx-auto w-full max-w-[430px] pt-[1.1rem] pl-[1.1rem] max-[980px]:w-[min(78vw,430px)] max-sm:w-full max-sm:max-w-[390px] max-sm:pt-[.65rem] max-sm:pl-[.65rem]">
            <span className="absolute inset-[0_1.1rem_1.1rem_0] border border-gold/70 max-sm:inset-[0_.65rem_.65rem_0]" aria-hidden="true" />
            <MemorialImage className="relative z-10 aspect-[4/5] w-full object-cover object-[50%_22%] saturate-[.88] contrast-[1.02]" src={heroImage} alt={`Portrait of ${name}`} fetchPriority="high" />
            <figcaption className="absolute right-[-1.5rem] bottom-[3.2rem] z-20 text-[.58rem] tracking-[.18em] text-[#dce5eb] uppercase [writing-mode:vertical-rl] max-sm:hidden">Chief Charles Chidiebere Osumuo</figcaption>
          </figure>
        </section>

        <section className="grid min-h-[380px] place-items-center bg-mist px-5 py-[clamp(4.5rem,7vw,6.5rem)] text-center max-sm:min-h-0 max-sm:py-[3.5rem]">
          <div className="max-w-[780px]">
            <p className={eyebrowClass}>Remembering Chief Charles</p>
            <h2 className="mb-4 font-display text-[clamp(2.15rem,5vw,4rem)] leading-[1.12] text-navy max-sm:text-[2.2rem] max-sm:leading-[1.1]">A beloved husband, father and friend.</h2>
            <p className="mx-auto max-w-[600px] leading-[1.7] text-muted max-sm:text-[.95rem] max-sm:leading-[1.6]">This memorial gathers the story of Chief Charles&apos; life and the memories held by those who knew him.</p>
            <span className="mx-auto my-[2.4rem] block h-px w-[70px] bg-gold" />
            <blockquote className="font-display text-[1.15rem] leading-[1.6] text-[#3c5262] italic">“A life is kept close in the stories we continue to share.”</blockquote>
          </div>
        </section>

        <section id="story" className={`${pageSectionClass} grid grid-cols-[minmax(300px,.86fr)_minmax(330px,1fr)] items-center gap-[clamp(3rem,9vw,9rem)] bg-white max-[980px]:grid-cols-1 max-sm:gap-10`}>
          <div className="relative max-w-[530px] max-[980px]:w-full max-[980px]:max-w-[600px]">
            <span className="absolute -top-[1.1rem] -left-[1.1rem] z-10 h-[32%] w-[44%] border-t border-l border-gold" />
            <MemorialImage className="aspect-[4/5] w-full object-cover object-[50%_28%] max-sm:aspect-[4/4.6]" src="/images/memories/charles-01.jpg" alt="Chief Charles Chidiebere Osumuo wearing a maroon traditional outfit" loading="lazy" />
          </div>
          <div className="max-w-[680px]">
            <SectionHeading className="text-navy" eyebrow="His story">A life rooted in family and home.</SectionHeading>
            <p className="mb-4 leading-[1.7] text-[#5f707c] max-sm:text-[.95rem] max-sm:leading-[1.6]">Chief Charles was born in Cross River, Nigeria, in 1962. In 1998, he married Mrs Clementina Osumuo in Lagos and he is blessed with four children: Adaeze, Chisom, Chidiebere and Ikechukwu.</p>
            <p className="mb-4 leading-[1.7] text-[#5f707c] max-sm:text-[.95rem] max-sm:leading-[1.6]">Home remained his favourite place. He enjoyed working out, drinking green tea, reading life-help books and following Chelsea football club.</p>
            <p className="mb-4 leading-[1.7] text-[#5f707c] max-sm:text-[.95rem] max-sm:leading-[1.6]">This page will continue to grow as family and friends add photographs, stories and the small moments that made him unforgettable.</p>
            <a className={`${textLinkClass} mt-4 text-navy`} href="#memories">Explore his memories <span className="text-[1.2em] text-gold" aria-hidden="true">→</span></a>
          </div>
        </section>

        <section id="milestones" className={`${pageSectionClass} bg-navy text-white`}>
          <SectionHeading className="max-w-[720px]" eyebrow="His journey">Milestones of a life well lived.</SectionHeading>
          <div className="grid grid-cols-3 gap-4 max-[980px]:grid-cols-2 max-sm:grid-cols-1">
            {milestones.map((milestone) => (
              <article key={milestone.key} className="min-h-[190px] border-t-2 border-transparent bg-[#18476f] p-8 transition-[border-color,transform] duration-200 hover:-translate-y-[3px] hover:border-gold max-sm:min-h-[150px]">
                <p className="mb-[1.4rem] font-display text-[1.65rem] text-[#e8c483]">{milestone.year}</p>
                <h3 className="mb-[.45rem] font-display text-[1.4rem] leading-[1.25] max-sm:text-[1.3rem] max-sm:leading-[1.2]">{milestone.title}</h3>
                <span className="text-[.76rem] leading-[1.6] text-[#afc3d2]">{milestone.detail}</span>
              </article>
            ))}
          </div>
        </section>

        <section id="favourites" className={`${pageSectionClass} bg-mist text-navy`}>
          <SectionHeading compactOnMobile eyebrow="The little things">Chief Charles&apos; favourites.</SectionHeading>
          <div className="grid grid-cols-3 gap-4 max-[980px]:grid-cols-2">
            {(data?.favourites ?? []).map((favourite) => (
              <article className="flex min-h-[135px] flex-col justify-between border-b-2 border-transparent bg-white p-[1.6rem] transition-colors hover:border-gold max-sm:min-h-[105px] max-sm:p-[1.2rem]" key={favourite.id}>
                <span className="text-[.65rem] leading-[1.5] tracking-[.13em] text-[#84929b] uppercase max-sm:text-[.58rem] max-sm:leading-[1.4]">{favourite.category.replace("Favourite ", "")}</span>
                <strong className="font-display text-[1.35rem] leading-[1.2] text-navy max-sm:text-[1.1rem] max-sm:leading-[1.18]">{favourite.value}</strong>
              </article>
            ))}
          </div>
          {!data && !loadError ? <p className="text-muted">Loading his favourites…</p> : null}
        </section>

        <section id="funeral" className={`${pageSectionClass} grid grid-cols-[.7fr_1.3fr] gap-[clamp(3rem,7vw,7rem)] bg-white max-[980px]:grid-cols-1`}>
          <div>
            <SectionHeading className="text-navy" eyebrow="Coming together">Funeral arrangements.</SectionHeading>
            <p className="max-w-[450px] leading-[1.7] text-muted max-sm:text-[.95rem] max-sm:leading-[1.6]">Family and friends are invited to gather, remember and celebrate Chief Charles&apos; life.</p>
          </div>
          <div className="border-t border-[#dbe2e7]">
            {funeralArrangements.map((item, index) => (
              <article className="grid grid-cols-[.65fr_1.35fr] gap-x-6 border-b border-[#dbe2e7] py-[1.7rem] max-sm:grid-cols-1 max-sm:py-6" key={item.title}>
                <p className={`${eyebrowClass} row-span-3 max-sm:row-auto`}>{String(index + 1).padStart(2, "0")}</p>
                <h3 className="mb-1 font-display text-[1.55rem] leading-[1.25] text-navy max-sm:text-[1.4rem] max-sm:leading-[1.25]">{item.title}</h3>
                <p className="mb-3 text-[.78rem] font-semibold tracking-[.02em] text-[#526675] max-sm:leading-[1.55]">{item.date}</p>
                <div className="grid gap-1">
                  {item.details.map((detail) => (
                    <p className="text-[.85rem] leading-[1.65] text-muted max-sm:leading-[1.6]" key={detail}>{detail}</p>
                  ))}
                </div>
              </article>
            ))}
          </div>
          {funeral?.rsvpPhone ? (
            <p className="col-start-2 text-[.85rem] text-[#5e6f7a] max-[980px]:col-auto">RSVP or enquiries: <a className="border-b border-gold font-semibold text-navy" href={`tel:${funeral.rsvpPhone}`}>{funeral.rsvpPhone}</a></p>
          ) : null}
          <div className="col-span-2 mt-4 grid grid-cols-[.65fr_1.35fr] items-center gap-[clamp(2rem,6vw,6rem)] border-t border-[#dbe2e7] bg-mist p-[clamp(1.25rem,4vw,3.5rem)] max-[980px]:col-span-1 max-[980px]:grid-cols-1 max-sm:gap-6 max-sm:p-5">
            <div className="max-w-[390px]">
              <p className={eyebrowClass}>Official announcement</p>
              <h3 className="mb-4 font-display text-[clamp(2rem,4vw,3.3rem)] leading-[1.12] text-navy max-sm:text-[1.9rem] max-sm:leading-[1.1]">Funeral arrangements poster.</h3>
              <p className="mb-5 text-[.9rem] leading-[1.7] text-muted max-sm:text-[.85rem] max-sm:leading-[1.6]">Select the poster to view the full announcement and programme clearly.</p>
              <a className={`${textLinkClass} text-navy`} href="/images/funeral/funeral-poster.jpg" target="_blank" rel="noreferrer">
                Open full poster
              </a>
            </div>
            <button
              type="button"
              className="group relative mx-auto w-full max-w-[560px] cursor-zoom-in overflow-hidden border-0 bg-white p-0 shadow-[0_18px_45px_rgba(3,38,63,.14)]"
              onClick={() => setSelectedImage({ url: "/images/funeral/funeral-poster.jpg", altText: "Chief Charles Chidiebere Osumuo funeral arrangements poster" })}
              aria-label="Enlarge Chief Charles Chidiebere Osumuo funeral arrangements poster"
            >
              <picture className="block">
                <source media="(max-width: 640px)" srcSet="/images/funeral/funeral-poster-mobile.jpg" />
                <img
                  className="h-auto w-full transition-transform duration-500 group-hover:scale-[1.012]"
                  src="/images/funeral/funeral-poster.jpg"
                  alt="Chief Charles Chidiebere Osumuo funeral arrangements poster"
                  loading="lazy"
                  decoding="async"
                />
              </picture>
              <span className="absolute right-3 bottom-3 translate-y-1 bg-navy/90 px-3 py-2 text-[.62rem] tracking-[.1em] text-white uppercase opacity-0 transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100 max-sm:translate-y-0 max-sm:opacity-100">
                Tap to enlarge
              </span>
            </button>
          </div>
        </section>

        <section id="memories" className={`${pageSectionClass} bg-white`}>
          <SectionHeading className="text-navy" eyebrow="Memory wall">Photographs of moments we will always treasure.</SectionHeading>
          <div className="grid h-[590px] grid-cols-[1.25fr_1fr_1fr] grid-rows-2 gap-[.8rem] max-sm:h-auto max-sm:grid-cols-2 max-sm:grid-rows-[300px_190px_190px]">
            {gallery.map((image, index) => (
              <button type="button" className={`group relative cursor-zoom-in overflow-hidden border-0 bg-[#dfe9f2] p-0 ${galleryTileLayouts[index]}`} key={image.id} onClick={() => setSelectedImage({ url: image.url, altText: image.altText })} aria-label={`Open ${image.altText ?? "memory photograph"}`}>
                <MemorialImage className="h-full w-full object-cover saturate-[.78] transition-[transform,filter] duration-500 group-hover:scale-[1.035] group-hover:saturate-100" src={memorialThumbnailUrl(image.url)} alt={image.altText ?? "A memory of Chief Charles"} loading="lazy" />
                <span className="absolute bottom-4 left-4 translate-y-[5px] bg-navy/85 px-[.7rem] py-[.55rem] text-[.62rem] tracking-[.1em] text-white uppercase opacity-0 transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100">View memory</span>
              </button>
            ))}
          </div>
          <div className="mt-8 flex justify-end max-sm:justify-stretch">
            <a className={`${buttonClass} border-navy bg-transparent text-navy hover:bg-navy hover:text-white max-sm:w-full`} href="/gallery">
              View all 38 photographs <span className="ml-2 text-[1.15em]" aria-hidden="true">→</span>
            </a>
          </div>

          {memoryPhotos.length ? (
            <div id="community-photo-wall" className="mt-16 border-t border-[#dfe6eb] pt-12 max-sm:mt-12 max-sm:pt-10">
              <div className="mb-8">
                <p className={eyebrowClass}>Shared photographs</p>
                <h3 className="font-display text-[clamp(2rem,4vw,3.4rem)] leading-[1.15] text-navy">Added by family and friends.</h3>
              </div>
              <CommunityPhotoCarousel photos={memoryPhotos} onOpen={setSelectedImage} />
            </div>
          ) : null}

          <div className="mt-16 grid grid-cols-[.8fr_1.2fr] gap-[clamp(3rem,7vw,7rem)] bg-mist p-[clamp(1.5rem,5vw,4.5rem)] max-[980px]:grid-cols-1 max-sm:mt-12 max-sm:p-5">
            <div>
              <p className={eyebrowClass}>Add to the Memory Wall</p>
              <h3 className="mb-5 font-display text-[clamp(2rem,4vw,3.4rem)] leading-[1.12] text-navy max-sm:text-[1.9rem] max-sm:leading-[1.1]">Share a photograph of Chief Charles.</h3>
              <p className="max-w-[470px] leading-[1.7] text-muted max-sm:text-[.95rem] max-sm:leading-[1.6]">Photographs live here in the Memory Wall. Add a short caption if you know where or when the moment was captured.</p>
            </div>
            <MemoryPhotoForm onSubmitted={handleMemoryPhotoSubmitted} />
          </div>
        </section>

        <section id="tributes" className={`${pageSectionClass} bg-[#f8fafc]`}>
          <div className="border-t border-[#dfe6eb] pt-12 max-sm:pt-10">
            <div className="mb-8 flex items-end justify-between gap-8 max-sm:flex-col max-sm:items-start">
              <div>
                <p className={`${eyebrowClass} mb-[.55rem]`}>Tributes</p>
                <h3 className="max-w-[600px] font-display text-[clamp(2rem,4vw,3.4rem)] leading-[1.12] text-navy max-sm:text-[1.9rem] max-sm:leading-[1.1]">Stories and words shared by family and friends.</h3>
              </div>
              {tributes.length > 1 ? <p className="mb-[.35rem] max-w-[230px] text-[.72rem] leading-[1.65] text-muted max-sm:max-w-none">Use the arrows to read each tribute.</p> : null}
            </div>
            {tributes.length ? (
              <TributeCarousel tributes={tributes} />
            ) : (
              <div className="flex items-center justify-between gap-8 bg-mist p-8 text-muted max-sm:flex-col max-sm:items-start">
                <p>The first tribute will appear here.</p>
                <a className={`${textLinkClass} text-navy`} href="#share-tribute">Share yours <span className="text-[1.2em] text-gold" aria-hidden="true">→</span></a>
              </div>
            )}
          </div>
        </section>

        <section id="share-tribute" className={`${pageSectionClass} grid grid-cols-[.8fr_1.2fr] gap-[clamp(3rem,8vw,8rem)] bg-navy text-white max-[980px]:grid-cols-1 max-sm:gap-10`}>
          <div>
            <p className={`${eyebrowClass} text-[#d3aa64]`}>In your own words</p>
            <h2 className="mb-[1.4rem] font-display text-[clamp(2.6rem,6vw,5.3rem)] leading-[1.08] max-sm:text-[2.3rem] max-sm:leading-[1.08]">Share a tribute for Chief Charles.</h2>
            <p className="max-w-[470px] leading-[1.7] text-[#b8c8d3] max-sm:text-[.95rem] max-sm:leading-[1.6]">Tell a story or leave a written tribute for others to read. Photographs are added separately in the Memory Wall above.</p>
          </div>
          <MemoryForm onSubmitted={handleTributeSubmitted} />
        </section>
      </main>

      <footer className="grid min-h-[130px] place-content-center gap-[.4rem] bg-navy-deep text-center text-white">
        <strong className="font-display text-[1.35rem]">Chief Charles Chidiebere Osumuo</strong>
        <span className="text-[.62rem] tracking-[.14em] text-[#849aab] uppercase">2026 · Forever remembered</span>
      </footer>

      <a
        className={`fixed right-6 bottom-6 z-40 grid h-12 w-12 place-items-center rounded-full border border-white/30 bg-navy text-xl text-white shadow-[0_10px_30px_rgba(1,27,46,.3)] transition-[opacity,transform,background-color] duration-300 hover:-translate-y-1 hover:bg-gold focus-visible:-translate-y-1 focus-visible:bg-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy max-sm:right-4 max-sm:bottom-4 max-sm:h-11 max-sm:w-11 ${
          showBackToTop
            ? "pointer-events-auto translate-y-0 opacity-100"
            : "pointer-events-none translate-y-3 opacity-0"
        }`}
        href="#top"
        aria-label="Back to the hero section"
        aria-hidden={!showBackToTop}
        tabIndex={showBackToTop ? 0 : -1}
      >
        <span aria-hidden="true">↑</span>
      </a>

      {selectedImage ? (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-[rgba(0,19,32,.94)] p-8" role="dialog" aria-modal="true" aria-label="Memory photograph">
          <button className="fixed top-4 right-4 h-[46px] w-[46px] cursor-pointer border border-white/35 bg-transparent font-serif text-[2rem] text-white" type="button" onClick={() => setSelectedImage(null)} aria-label="Close photograph">×</button>
          <MemorialImage className="max-h-[88vh] max-w-[min(90vw,1100px)] object-contain" src={selectedImage.url} alt={selectedImage.altText ?? "A memory of Chief Charles"} />
        </div>
      ) : null}
    </div>
  );
}

export default function App() {
  return /^\/gallery\/?$/.test(window.location.pathname) ? <GalleryPage /> : <MemorialHome />;
}
