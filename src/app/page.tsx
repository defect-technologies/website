"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";

/* ─── CURSOR ─────────────────────────────────────────────────── */

function Crosshair() {
  const [pos, setPos] = useState({ x: -100, y: -100 });
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      setPos({ x: e.clientX, y: e.clientY });
      setVisible(true);
    };
    const onLeave = () => setVisible(false);
    window.addEventListener("mousemove", onMove);
    document.addEventListener("mouseleave", onLeave);
    return () => {
      window.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  return (
    <div
      className="crosshair"
      style={{ left: pos.x, top: pos.y, opacity: visible ? 1 : 0 }}
      aria-hidden
    >
      <div className="crosshair-ring" />
    </div>
  );
}

/* ─── RETICLE SVG ────────────────────────────────────────────── */

function Reticle() {
  return (
    <div className="hero-reticle" aria-hidden>
      <svg viewBox="0 0 300 300" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="150" cy="150" r="120" stroke="currentColor" strokeWidth="0.6" strokeDasharray="6 6" />
        <circle cx="150" cy="150" r="80"  stroke="currentColor" strokeWidth="0.6" />
        <circle cx="150" cy="150" r="40"  stroke="currentColor" strokeWidth="0.6" strokeDasharray="3 3" />
        <circle cx="150" cy="150" r="5"   stroke="currentColor" strokeWidth="0.6" />
        {/* Cross lines */}
        <line x1="150" y1="0"   x2="150" y2="105" stroke="currentColor" strokeWidth="0.6" />
        <line x1="150" y1="195" x2="150" y2="300" stroke="currentColor" strokeWidth="0.6" />
        <line x1="0"   y1="150" x2="105" y2="150" stroke="currentColor" strokeWidth="0.6" />
        <line x1="195" y1="150" x2="300" y2="150" stroke="currentColor" strokeWidth="0.6" />
        {/* Angle ticks */}
        <line x1="150" y1="28" x2="150" y2="38" stroke="currentColor" strokeWidth="0.6" />
        <line x1="272" y1="150" x2="262" y2="150" stroke="currentColor" strokeWidth="0.6" />
        <line x1="150" y1="272" x2="150" y2="262" stroke="currentColor" strokeWidth="0.6" />
        <line x1="28"  y1="150" x2="38"  y2="150" stroke="currentColor" strokeWidth="0.6" />
        {/* Corner degree marks */}
        <text x="156" y="96" fontSize="8" fontFamily="monospace" fill="currentColor" opacity="0.7">0°</text>
        <text x="156" y="218" fontSize="8" fontFamily="monospace" fill="currentColor" opacity="0.7">180°</text>
        <text x="202" y="154" fontSize="8" fontFamily="monospace" fill="currentColor" opacity="0.7">90°</text>
        <text x="60"  y="154" fontSize="8" fontFamily="monospace" fill="currentColor" opacity="0.7">270°</text>
      </svg>
    </div>
  );
}

/* ─── SECTION HEADER ─────────────────────────────────────────── */

function SectionHeader({
  number,
  title,
  sub,
  light = false,
}: {
  number: string;
  title: string;
  sub: string;
  light?: boolean;
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <motion.div
      ref={ref}
      className="section-header"
      style={light ? { borderColor: "rgba(240,237,224,0.15)" } : {}}
      initial={{ opacity: 0, y: 16 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.55, ease: "easeOut" }}
    >
      <span className="section-num mono">{number}</span>
      <h2 className="section-title stencil" style={light ? { color: "var(--bg)" } : {}}>
        {title}
      </h2>
      <span className="section-sub mono" style={light ? { color: "rgba(240,237,224,0.4)" } : {}}>
        {sub}
      </span>
    </motion.div>
  );
}

/* ─── CASE FILE ──────────────────────────────────────────────── */

type CaseFileProps = {
  number: string;
  client: string;
  status: "DEPLOYED" | "CLASSIFIED" | "IN PROGRESS";
  year: string;
  type: string;
  description: string;
  url?: string;
  redacted?: boolean;
  visual?: React.ReactNode;
};

function CaseFile({
  number,
  client,
  status,
  year,
  type,
  description,
  url,
  redacted = false,
  visual,
}: CaseFileProps) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });

  const statusClass =
    status === "DEPLOYED"
      ? "status-deployed"
      : status === "CLASSIFIED"
      ? "status-classified"
      : "status-progress";

  return (
    <motion.div
      ref={ref}
      className={`case-file${redacted ? " case-file-redacted" : ""}`}
      initial={{ opacity: 0, x: -24 }}
      animate={inView ? { opacity: 1, x: 0 } : {}}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      {/* ID column */}
      <div className="case-file-id">
        <span className="case-num stencil">{number}</span>
        <span className="case-year mono">{year}</span>
      </div>

      {/* Body */}
      <div className="case-body">
        <span className="case-type mono">
          {redacted ? (
            <span className="redacted">████ × ████████</span>
          ) : (
            type
          )}
        </span>
        <h3 className="case-client stencil">
          {redacted ? (
            <span className="redacted">████████████████</span>
          ) : (
            client
          )}
        </h3>
        <p className="case-desc mono">{description}</p>
        {url && !redacted && (
          <a
            href={`https://${url}`}
            target="_blank"
            rel="noopener noreferrer"
            className="case-link mono"
          >
            {url}&nbsp;↗
          </a>
        )}
      </div>

      {/* Status column */}
      <div className="case-status-col">
        <span className={`status-badge mono ${statusClass}`}>{status}</span>
      </div>

      {/* Optional visual */}
      {visual && (
        <div className="case-visual" aria-hidden>
          {visual}
        </div>
      )}
    </motion.div>
  );
}

/* ─── JYV SPECIMEN ───────────────────────────────────────────── */

function JyvSpecimen() {
  return (
    <div className="jyv-specimen">
      <span className="jyv-label mono">TYPE SPECIMEN</span>
      <span className="jyv-letters stencil">J&thinsp;Y&thinsp;V</span>
      <span className="jyv-label mono">GEOMETRIC SANS</span>
    </div>
  );
}

/* ─── PAGE ───────────────────────────────────────────────────── */

export default function Home() {
  return (
    <>
      <Crosshair />

      {/* ── HERO ── */}
      <section className="hero blueprint-grid">
        {/* Nav */}
        <nav className="nav">
          <span className="nav-brand stencil">DEFECT.TECH</span>
          <div className="nav-meta">
            <span className="nav-label mono">EST. MMXXIV</span>
            <span className="nav-label mono">DESIGN STUDIO</span>
            <span className="nav-status mono">● ACTIVE</span>
          </div>
        </nav>

        {/* Corner annotation marks */}
        <div className="corner-mark tl" aria-hidden />
        <div className="corner-mark tr" aria-hidden />
        <div className="corner-mark bl" aria-hidden />
        <div className="corner-mark br" aria-hidden />

        {/* Targeting reticle */}
        <Reticle />

        {/* Background watermark */}
        <div className="hero-watermark stencil" aria-hidden>
          DEFECT
        </div>

        {/* Main content */}
        <div className="hero-content">
          <motion.p
            className="hero-eyebrow mono"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            ── DESIGN STUDIO / FIELD OPERATIONS
          </motion.p>

          <motion.h1
            className="hero-title stencil"
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            <span className="hero-title-line">DEVIATION</span>
            <span className="hero-title-line">IS&nbsp;THE</span>
            <span className="hero-title-line hero-title-red">DISCIPLINE.</span>
          </motion.h1>

          <motion.p
            className="hero-desc mono"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.55 }}
          >
            We design typefaces, identities, and
            <br />
            web experiences that feel wrong
            <br />
            until they feel exactly right.
          </motion.p>
        </div>

        {/* Footer bar */}
        <div className="hero-footer">
          <span className="mono">N 41°24′12″ &nbsp;E 02°10′26″</span>
          <div className="scroll-cue">
            <span className="mono">SCROLL TO DEPLOY</span>
            <div className="scroll-arrow" aria-hidden />
          </div>
          <span className="mono">CL: UNRESTRICTED</span>
        </div>
      </section>

      {/* ── CASE FILES ── */}
      <section className="section">
        <SectionHeader
          number="— 01"
          title="CASE FILES"
          sub="FIELD OPERATIONS — ACTIVE & COMPLETED"
        />

        <div className="case-files">
          <CaseFile
            number="001"
            client="THE JYV"
            status="DEPLOYED"
            year="2024"
            type="TYPE DESIGN × DIGITAL"
            description={
              "Custom typeface design and digital type specimen for THE JYV. " +
              "A geometric sans-serif built for editorial and screen environments, " +
              "balancing mechanical precision with typographic warmth."
            }
            url="thejyv.com"
            visual={<JyvSpecimen />}
          />

          <CaseFile
            number="002"
            client="CLASSIFIED"
            status="IN PROGRESS"
            year="2025"
            type="BRAND × WEB"
            description="Identity system and digital experience for an undisclosed client. Full scope: wordmark, type selection, motion language, and web presence. ETA: Q3 2025."
            redacted
          />

          <CaseFile
            number="003"
            client="CLASSIFIED"
            status="CLASSIFIED"
            year="2025"
            type="TYPE DESIGN"
            description="A new typeface. Variable axes. Intended for editorial use. Announcement forthcoming."
            redacted
          />
        </div>
      </section>

      {/* ── MANIFESTO ── */}
      <section className="manifesto-section blueprint-grid-dark">
        <div className="manifesto-inner">
          {/* Left: big statement */}
          <motion.h2
            className="manifesto-heading stencil"
            initial={{ opacity: 0, x: -24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.65, ease: "easeOut" }}
          >
            GOOD DESIGN IS INVISIBLE.
            <br />
            GREAT DESIGN IS{" "}
            <span className="manifesto-underline">UNFORGETTABLE.</span>
            <br />
            WE&apos;RE INTERESTED IN
            <br />
            THE LATTER.
          </motion.h2>

          {/* Right: operational brief */}
          <motion.div
            className="manifesto-body"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.65, delay: 0.2 }}
          >
            <SectionHeader
              number="— 02"
              title="OPERATIONAL BRIEF"
              sub="WHO WE ARE"
              light
            />
            <p className="manifesto-text mono">
              Defect.tech is a design studio that operates outside the accepted
              parameters.
              <br />
              <br />
              We believe that memorable work requires intentional departure from
              convention. Not chaos — precision with conviction.
              <br />
              <br />
              Every letterform deliberate.
              <br />
              Every interaction earned.
              <br />
              Every expectation a candidate for defection.
            </p>
            <div className="manifesto-divider" />
            <span className="manifesto-sign stencil">DEFECT.TECH</span>
          </motion.div>
        </div>
      </section>

      {/* ── CAPABILITIES ── */}
      <section className="section">
        <SectionHeader
          number="— 03"
          title="CAPABILITIES"
          sub="WHAT WE DEPLOY"
        />

        <div className="caps-grid">
          {[
            {
              code: "CAP-01",
              name: "TYPEFACE DESIGN",
              desc: "Custom letterforms from concept to distribution. Variable fonts, type systems, display faces.",
            },
            {
              code: "CAP-02",
              name: "BRAND IDENTITY",
              desc: "Visual systems built for conviction and longevity. Wordmarks, marks, motion, guidelines.",
            },
            {
              code: "CAP-03",
              name: "WEB EXPERIENCES",
              desc: "Digital presences that perform and persuade. Design, build, and launch.",
            },
            {
              code: "CAP-04",
              name: "ART DIRECTION",
              desc: "Strategic visual leadership for ambitious projects. Campaign, editorial, and product.",
            },
          ].map((cap, i) => (
            <motion.div
              key={cap.code}
              className="cap-item"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: i * 0.08, ease: "easeOut" }}
            >
              <span className="cap-code mono">{cap.code}</span>
              <h3 className="cap-name stencil">{cap.name}</h3>
              <div className="cap-rule" />
              <p className="cap-desc mono">{cap.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="footer blueprint-grid">
        {/* Ghost wordmark */}
        <div className="footer-wordmark stencil" aria-hidden>
          DEFECT.TECH
        </div>

        <div className="footer-top">
          <div className="footer-left">
            <span className="footer-tagline mono">DESIGN STUDIO — EST. MMXXIV</span>
            <span className="footer-tagline mono" style={{ color: "var(--red)", letterSpacing: "0.2em" }}>
              DEVIATION IS THE DISCIPLINE.
            </span>
          </div>

          <div>
            <p className="footer-contact-label mono">INITIATE CONTACT</p>
            <a href="mailto:hello@defect.tech" className="footer-email stencil">
              HELLO@DEFECT.TECH ↗
            </a>
          </div>
        </div>

        <div className="footer-bottom">
          <span className="mono">© MMXXIV DEFECT.TECH. ALL RIGHTS RESERVED.</span>
          <span className="mono" style={{ color: "var(--red)" }}>
            ALL EXPECTATIONS VIOLATED.
          </span>
        </div>
      </footer>
    </>
  );
}
