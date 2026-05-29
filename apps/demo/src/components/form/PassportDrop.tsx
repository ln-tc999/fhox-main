"use client";

type Props = {
  legalName: string;
  tokenId: string;
  manager: string;
  jurisdiction?: string;
};

/**
 * A CSS-animated passport that drops in from above on a gold lanyard line,
 * swings to settle, and stays mounted (no WebGL, no physics, no crashes).
 * Hovering it gives a subtle 3D tilt.
 */
export function PassportDrop({
  legalName,
  tokenId,
  manager,
  jurisdiction = "WY",
}: Props) {
  return (
    <div className="passport-stage">
      {/* gold lanyard line */}
      <div className="passport-cord" aria-hidden>
        <span className="passport-cord-line" />
        <span className="passport-cord-clip" />
        <span className="passport-cord-ring" />
      </div>

      <div className="passport-card-wrap">
        <div className="passport-card">
          {/* corner ornaments */}
          <span className="corner tl" />
          <span className="corner tr" />
          <span className="corner bl" />
          <span className="corner br" />

          <div className="passport-rubric">
            <span className="dot" />
            <span>FHOX PASSPORT</span>
            <span className="dot" />
          </div>

          <div className="passport-rule" />

          {/* seal */}
          <div className="seal" aria-hidden>
            <svg viewBox="0 0 100 130" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="vessel" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#F4EFE7" />
                  <stop offset="100%" stopColor="#9b948a" />
                </linearGradient>
              </defs>
              <path
                d="M50 5 C 18 18, 12 90, 50 100 C 88 90, 82 18, 50 5 Z"
                fill="url(#vessel)"
              />
              <line x1="50" y1="0" x2="50" y2="108" stroke="#C8A45D" strokeWidth="1" opacity="0.85" />
              <circle cx="50" cy="3" r="2.5" fill="#C8A45D" />
              <circle cx="50" cy="108" r="2.5" fill="#C8A45D" />
            </svg>
          </div>

          <h3 className="passport-name">{truncate(legalName, 30)}</h3>
          <div className="passport-status">
            <span className="status-dot" />
            ACTIVE · ON-CHAIN
          </div>

          <div className="passport-grid">
            <Field k="Jurisdiction" v={`Wyoming · ${jurisdiction}`} />
            <Field k="Identity Token" v={`#${tokenId}`} />
            <Field k="Manager" v={`${manager.slice(0, 8)}…${manager.slice(-6)}`} mono />
            <Field k="Entity Type" v="DAO LLC · W.S. 17-31-115" />
          </div>

          <div className="passport-rule short" />

          <div className="passport-footer">
            <span>ARBITRUM SEPOLIA · CHAIN 421614</span>
            <span className="footer-sep">·</span>
            <span>ERC-8004</span>
          </div>
        </div>
      </div>

      <style jsx>{`
        .passport-stage {
          position: relative;
          width: 100%;
          height: 580px;
          display: flex;
          flex-direction: column;
          align-items: center;
          perspective: 1400px;
          overflow: hidden;
        }
        .passport-cord {
          position: absolute;
          top: 0;
          left: 50%;
          transform: translateX(-50%);
          width: 14px;
          height: 92px;
          display: flex;
          flex-direction: column;
          align-items: center;
          animation: cord-drop 1.2s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        .passport-cord-line {
          width: 2px;
          height: 72px;
          background: linear-gradient(
            180deg,
            rgba(200, 164, 93, 0) 0%,
            rgba(200, 164, 93, 0.75) 15%,
            rgba(200, 164, 93, 0.95) 100%
          );
          box-shadow: 0 0 8px rgba(200, 164, 93, 0.4);
        }
        .passport-cord-clip {
          width: 28px;
          height: 8px;
          background: linear-gradient(180deg, #e1c889 0%, #c8a45d 60%, #a8843e 100%);
          border-radius: 2px;
          margin-top: -1px;
          box-shadow: 0 2px 8px rgba(200, 164, 93, 0.5);
        }
        .passport-cord-ring {
          width: 14px;
          height: 14px;
          border: 2px solid #c8a45d;
          border-radius: 50%;
          margin-top: 4px;
          box-shadow: 0 2px 8px rgba(200, 164, 93, 0.4);
          background: radial-gradient(circle, rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.85));
        }
        .passport-card-wrap {
          margin-top: 110px;
          transform-origin: top center;
          animation:
            card-drop 1.6s cubic-bezier(0.34, 1.56, 0.5, 1) 0.35s both,
            card-swing 6.5s ease-in-out 1.95s infinite;
          will-change: transform;
        }
        .passport-card {
          position: relative;
          width: 340px;
          padding: 36px 30px 28px;
          background: linear-gradient(180deg, #100b08 0%, #060503 100%);
          border: 1px solid rgba(200, 164, 93, 0.45);
          color: #f4efe7;
          box-shadow:
            0 36px 80px -28px rgba(0, 0, 0, 0.9),
            0 8px 24px -12px rgba(0, 0, 0, 0.7),
            inset 0 1px 0 rgba(200, 164, 93, 0.08);
          transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .passport-card:hover {
          transform: translateY(-2px) rotateX(2deg);
        }
        .corner {
          position: absolute;
          width: 18px;
          height: 18px;
          border-color: #c8a45d;
          border-style: solid;
        }
        .corner.tl { top: -1px; left: -1px; border-width: 2px 0 0 2px; }
        .corner.tr { top: -1px; right: -1px; border-width: 2px 2px 0 0; }
        .corner.bl { bottom: -1px; left: -1px; border-width: 0 0 2px 2px; }
        .corner.br { bottom: -1px; right: -1px; border-width: 0 2px 2px 0; }
        .passport-rubric {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          font-family: var(--font-cormorant), Garamond, serif;
          font-weight: 300;
          font-size: 13px;
          letter-spacing: 0.42em;
          color: #c8a45d;
        }
        .passport-rubric .dot {
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: #c8a45d;
          opacity: 0.7;
        }
        .passport-rule {
          width: 40px;
          height: 1px;
          background: linear-gradient(90deg, transparent, #c8a45d, transparent);
          margin: 14px auto 0;
        }
        .passport-rule.short {
          width: 64px;
          margin: 22px auto;
          opacity: 0.4;
        }
        .seal {
          width: 80px;
          height: 100px;
          margin: 22px auto 14px;
          position: relative;
        }
        .seal::before {
          content: "";
          position: absolute;
          inset: -22px;
          border: 1px solid rgba(200, 164, 93, 0.25);
          border-radius: 50%;
        }
        .seal svg {
          width: 100%;
          height: 100%;
          filter: drop-shadow(0 4px 12px rgba(244, 239, 231, 0.1));
        }
        .passport-name {
          font-family: var(--font-cormorant), Garamond, serif;
          font-weight: 300;
          font-size: 26px;
          line-height: 1.1;
          text-align: center;
          color: #f4efe7;
          margin-top: 4px;
        }
        .passport-status {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin-top: 8px;
          font-family: var(--font-cormorant), Garamond, serif;
          font-size: 11px;
          letter-spacing: 0.32em;
          color: #58d68d;
        }
        .status-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #58d68d;
          box-shadow: 0 0 8px #58d68d;
          animation: pulse 2.5s ease-in-out infinite;
        }
        .passport-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 18px 14px;
          margin-top: 26px;
        }
        .passport-footer {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          font-family: ui-monospace, Menlo, monospace;
          font-size: 9px;
          letter-spacing: 0.24em;
          color: rgba(200, 164, 93, 0.65);
          text-transform: uppercase;
        }
        .footer-sep {
          color: rgba(200, 164, 93, 0.4);
        }
        @keyframes cord-drop {
          0% { transform: translateX(-50%) scaleY(0); opacity: 0; }
          100% { transform: translateX(-50%) scaleY(1); opacity: 1; }
        }
        @keyframes card-drop {
          0% {
            transform: translateY(-480px) rotate(-14deg);
            opacity: 0;
          }
          55% {
            transform: translateY(20px) rotate(6deg);
            opacity: 1;
          }
          80% {
            transform: translateY(-6px) rotate(-3deg);
          }
          100% {
            transform: translateY(0) rotate(0);
            opacity: 1;
          }
        }
        @keyframes card-swing {
          0%, 100% { transform: rotate(-0.6deg); }
          50% { transform: rotate(0.6deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.65; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}

function Field({ k, v, mono = false }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="field">
      <span className="field-k">{k}</span>
      <span className={`field-v${mono ? " mono" : ""}`}>{v}</span>
      <style jsx>{`
        .field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .field-k {
          font-family: ui-monospace, Menlo, monospace;
          font-size: 8.5px;
          letter-spacing: 0.32em;
          color: rgba(155, 148, 138, 0.85);
          text-transform: uppercase;
        }
        .field-v {
          font-family: var(--font-cormorant), Garamond, serif;
          font-weight: 300;
          font-size: 14px;
          color: #f4efe7;
        }
        .field-v.mono {
          font-family: ui-monospace, Menlo, monospace;
          font-size: 11px;
        }
      `}</style>
    </div>
  );
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}
