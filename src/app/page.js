import Image from "next/image";
import Link from "next/link";
import { preload } from "react-dom";
import Logo from "@/components/Logo";
import AutoVideo from "@/components/AutoVideo";
import NavMenu from "@/components/NavMenu";
import reviewPhoto from "@/assets/landing/tz-review.jpg";
import phonePhoto from "@/assets/landing/tz-phone.jpg";
import teamPhoto from "@/assets/landing/tz-team.jpg";
import portraitPhoto from "@/assets/landing/tz-portrait.jpg";
import appScreenshot from "@/assets/landing/app-screenshot.jpg";

const STEPS = [
  { n: "01", title: "Add the image", text: "Upload a scan, drop in a PDF, or photograph a film with your phone camera." },
  { n: "02", title: "Add context", text: "Note the age, symptoms, or the question you want the AI to focus on." },
  { n: "03", title: "Review the read", text: "Get a structured second opinion in about a minute, then confirm it with your own judgement." },
];

const FEATURES = [
  { title: "Every format you actually have", text: "JPG, PNG, WebP, HEIC phone photos, multi-page PDFs and live camera capture. No converting first." },
  { title: "A viewer built for reading films", text: "Zoom, pan, brightness, contrast and invert, so you can check the AI's read against the image." },
  { title: "Structured, scannable reports", text: "Region and view, observations, findings with Likely / Possible / Unlikely labels, follow-up and limitations." },
  { title: "Honest about uncertainty", text: "Poor exposure, glare or a photo of a screen? The report says how that limits the reading instead of guessing." },
  { title: "Private by design", text: "Invite-only accounts. Images sit in a private bucket and are visible only to the doctor who uploaded them." },
  { title: "Yours to delete", text: "Remove any case and its images permanently with one click." },
];

const FAQ = [
  { q: "Does neatx-ray diagnose patients?", a: "No. It is decision support for qualified clinicians. It describes what it sees and suggests possibilities; the doctor makes every clinical decision." },
  { q: "What can I upload?", a: "Common image formats (JPG, PNG, WebP, HEIC), PDFs and live camera photos. DICOM and TIFF are not supported yet; export them as JPG or PNG." },
  { q: "Who can see my images?", a: "Only your own account. Images are stored in a private bucket and opened through short-lived links. Use anonymized images and keep patient names and IDs out of labels and notes." },
  { q: "Can I use it on real patients?", a: "Check your local health-data rules and your organisation's policy first. During evaluation, use anonymized or public images." },
  { q: "How do I get access?", a: "Accounts are created for you by an administrator. Ask them to add you with your email address." },
];

function VideoFrame({ src, poster, className = "" }) {
  return (
    <div className={`relative overflow-hidden rounded-3xl border border-line bg-viewer shadow-[0_24px_60px_rgba(31,53,86,0.18)] ${className}`}>
      <AutoVideo src={src} poster={poster} buttonClassName="absolute bottom-3 right-3 z-10" />
    </div>
  );
}

function Photo({ src, alt, className = "", sizes = "(min-width: 1024px) 560px, 100vw" }) {
  return (
    <Image
      src={src}
      alt={alt}
      sizes={sizes}
      placeholder="blur"
      className={`w-full h-auto rounded-3xl border border-line object-cover shadow-[0_24px_60px_rgba(31,53,86,0.14)] ${className}`}
    />
  );
}

export default function Landing() {
  // Start fetching the hero poster before the video element is parsed.
  preload("/media/hero-poster.jpg", { as: "image", fetchPriority: "high" });
  const cta = { href: "/app", label: "Scan now" };

  return (
    <div className="relative overflow-clip">
      {/* Hero with video background */}
      <div className="relative isolate">
        <AutoVideo
          src="/media/hero.mp4"
          poster="/media/hero-poster.jpg"
          wrapperClassName="absolute inset-0 -z-10"
          videoClassName="h-full w-full object-cover object-right"
          showButton={false}
        >
          <div className="absolute inset-0 bg-bg/80 lg:hidden" />
          <div className="absolute inset-0 hidden lg:block bg-gradient-to-r from-bg via-bg/85 to-bg/0" />
          <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-bg to-bg/0" />
        </AutoVideo>

        <header className="relative mx-auto max-w-6xl px-4 sm:px-6 py-5 flex items-center justify-between">
          <Link href="/" aria-label="neatx-ray home" className="inline-flex min-h-[44px] items-center"><Logo size={34} /></Link>
          <NavMenu cta={cta} />
        </header>

        <section className="mx-auto max-w-6xl px-4 sm:px-6 pt-16 pb-28 sm:pt-24 sm:pb-40">
          <div className="max-w-xl">
            <h1 className="motion-rise font-serif text-4xl sm:text-6xl leading-[1.05] text-navy">
              A calm second read on every <span className="whitespace-nowrap">X-ray.</span>
            </h1>
            <p className="motion-rise mt-5 text-lg text-navy/80" style={{ animationDelay: "90ms" }}>
              Upload a film, PDF or phone photo. Get a structured AI read in about a minute, with uncertainty spelled out.
            </p>
            <div className="motion-rise mt-8" style={{ animationDelay: "180ms" }}>
              <Link href={cta.href} className="btn-primary inline-flex items-center">{cta.label}</Link>
            </div>
          </div>
        </section>
      </div>

      {/* Product screenshot */}
      <section className="relative z-10 -mt-16 sm:-mt-28 px-4 sm:px-6 pb-20" aria-label="The neatx-ray app">
        <div className="mx-auto max-w-6xl">
          <div className="overflow-clip rounded-2xl border border-line bg-surface shadow-[0_40px_90px_rgba(31,53,86,0.22)]">
            <div className="flex items-center gap-2 border-b border-line bg-[#f3f8fa] px-4 py-3" aria-hidden="true">
              <span className="h-3 w-3 rounded-full bg-[#f4a3a3]" />
              <span className="h-3 w-3 rounded-full bg-[#f2d48a]" />
              <span className="h-3 w-3 rounded-full bg-[#9fd9a6]" />
            </div>
            <div className="relative">
            <Image
              src={appScreenshot}
              alt="The neatx-ray app showing a chest X-ray in the viewer and a structured AI report beside it"
              sizes="(min-width: 1152px) 1152px, 100vw"
              quality={80}
              priority
              placeholder="blur"
              className="block h-auto w-full"
            />
            <div className="scan-region" aria-hidden="true">
              <div className="scan-sweep" />
            </div>
            </div>
          </div>
          <p className="mt-4 text-center text-xs text-muted">Illustrative example with a sample image. Not a real patient.</p>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="bg-surface/60 border-y border-line">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-20 grid gap-12 lg:grid-cols-2 lg:items-center">
          <VideoFrame src="/media/workflow.mp4" poster="/media/workflow-poster.jpg" className="aspect-video order-last lg:order-first" />
          <div>
            <h2 className="font-serif text-3xl sm:text-4xl text-navy">From image to report in three steps</h2>
            <ol className="mt-8 space-y-7">
              {STEPS.map((s) => (
                <li key={s.n} className="flex gap-5">
                  <span className="font-serif text-2xl text-accent-strong w-10 shrink-0">{s.n}</span>
                  <div>
                    <h3 className="font-semibold text-navy">{s.title}</h3>
                    <p className="text-muted mt-1">{s.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* Sample report */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 py-20 grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:items-center">
        <div>
          <h2 className="font-serif text-3xl sm:text-4xl text-navy">Reports you can read at a glance</h2>
          <p className="mt-4 text-muted max-w-md">
            Every finding carries a confidence label and the visible features behind it, so you can check the reasoning against the image.
          </p>
          <Photo src={reviewPhoto} alt="A doctor in a clinic studying a chest X-ray on a monitor" className="mt-8 max-w-md" />
        </div>
        <div className="card p-6 space-y-4" aria-label="Illustrative sample report">
          <p className="text-xs uppercase tracking-wide text-muted">Illustrative example, not a real patient</p>
          <div>
            <p className="font-serif text-lg">Region and view</p>
            <p className="text-sm">Chest, PA projection. Image quality: adequate.</p>
          </div>
          <div className="rounded-xl border border-line p-3 text-sm space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="badge badge-possible">Possible</span>
              <strong>Right lower zone opacity</strong>
              <span className="text-muted">· right lung base</span>
            </div>
            <p className="text-muted">Increased density blurring the right hemidiaphragm outline. Correlate with symptoms.</p>
          </div>
          <div className="rounded-xl border border-line p-3 text-sm space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="badge badge-unlikely">Unlikely</span>
              <strong>Pneumothorax</strong>
              <span className="text-muted">· both lungs</span>
            </div>
            <p className="text-muted">Lung markings are visible to the periphery on both sides.</p>
          </div>
          <p className="text-xs text-muted">Limitations: single view; clinical history needed for interpretation.</p>
        </div>
      </section>

      {/* Camera */}
      <section className="bg-surface/60 border-y border-line">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-20 grid gap-12 lg:grid-cols-2 lg:items-center">
          <div>
            <h2 className="font-serif text-3xl sm:text-4xl text-navy">Photograph a film. Get a read.</h2>
            <p className="mt-4 text-muted max-w-md">
              No scanner or PACS export needed. Hold your phone to a film on the lightbox and neatx-ray reads the photo. For the best result, shoot straight on, avoid glare and fill the frame.
            </p>
            <p className="mt-3 text-sm text-muted max-w-md">
              Photos of films and screens carry less detail than original images, and the report says so when quality limits the reading.
            </p>
          </div>
          <Photo src={phonePhoto} alt="A doctor photographing an X-ray film on a lightbox with a smartphone" />
        </div>
      </section>

      {/* Features */}
      <section id="features">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-20">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
            <h2 className="font-serif text-3xl sm:text-4xl text-navy max-w-md">Built for the way clinics actually work</h2>
            <Photo src={teamPhoto} alt="Two doctors discussing a chest X-ray film at a lightbox" />
          </div>
          <div className="mt-14 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title}>
                <h3 className="font-semibold text-navy">{f.title}</h3>
                <p className="mt-2 text-sm text-muted">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Safety */}
      <section id="safety" className="mx-auto max-w-6xl px-4 sm:px-6 py-20 grid gap-12 lg:grid-cols-2 lg:items-center border-t border-line">
        <Photo src={portraitPhoto} alt="A doctor in a hospital corridor" />
        <div>
          <h2 className="font-serif text-3xl sm:text-4xl text-navy">A second pair of eyes, never the final word</h2>
          <p className="mt-5 text-muted">
            AI can miss findings and can state things that are not there. neatx-ray is designed to support your review, not replace it: it shows its reasoning, labels its uncertainty, flags possibly urgent findings, and reminds you on every report that the clinical decision is yours.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="mx-auto max-w-3xl px-4 sm:px-6 pb-20">
        <h2 className="font-serif text-3xl text-navy text-center">Questions</h2>
        <div className="mt-8 divide-y divide-line border-y border-line">
          {FAQ.map((f) => (
            <details key={f.q} className="group">
              <summary className="cursor-pointer list-none flex min-h-[44px] items-center justify-between gap-4 py-4 font-medium text-navy">
                {f.q}
                <span className="text-accent-strong transition-transform group-open:rotate-45 text-xl leading-none" aria-hidden="true">+</span>
              </summary>
              <p className="-mt-1 pb-4 text-sm text-muted">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 pb-20">
        <div className="rounded-3xl bg-navy text-white px-6 py-14 sm:px-14 text-center">
          <h2 className="font-serif text-3xl sm:text-4xl">Bring a calmer workflow to your reading room</h2>
          <p className="mt-3 text-white/70">Access is by invitation. You will be asked to sign in first.</p>
          <Link href={cta.href} className="mt-8 inline-flex items-center rounded-full bg-white px-6 min-h-[44px] font-semibold text-navy hover:bg-bg">
            {cta.label}
          </Link>
        </div>
      </section>

      <footer className="border-t border-line">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8 flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between text-sm text-muted">
          <Logo size={26} />
          <p className="max-w-md">
            neatx-ray provides AI decision support only. It does not provide medical diagnoses. Photos and videos on this page are AI-generated illustrations.
          </p>
        </div>
      </footer>
    </div>
  );
}
