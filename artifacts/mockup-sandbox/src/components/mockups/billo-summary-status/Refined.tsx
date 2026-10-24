import { CheckCheck, ListChecks } from "lucide-react";
import "./_group.css";

function RefinedStatus({ complete = false }: { complete?: boolean }) {
  return (
    <div
      className={`sp-payment-overview sp-confirmation-overview${complete ? "" : " confirmation-pending"}`}
      role="group"
      aria-label="Bill confirmation status"
    >
      <div className="sp-overview-stat">
        <span className="sp-overview-icon" aria-hidden="true">
          <CheckCheck size={19} strokeWidth={2.2} />
        </span>
        <div>
          <small>Confirmed</small>
          <strong className="sp-overview-value">
            {complete ? "4" : "2"}
            <span className="sp-overview-total"> of {complete ? "4" : "5"}</span>
          </strong>
        </div>
      </div>
      <span className="sp-overview-divider" aria-hidden="true" />
      <div className="sp-overview-stat">
        <span className="sp-overview-icon" aria-hidden="true">
          <ListChecks size={19} strokeWidth={2.2} />
        </span>
        <div>
          <small>Unclaimed</small>
          <strong className="sp-overview-value">{complete ? "None" : "3"}</strong>
        </div>
      </div>
    </div>
  );
}

export function Refined() {
  return (
    <main className="split-v2 status-preview">
      <section>
        <p className="status-sample-label">In progress</p>
        <RefinedStatus />
      </section>
      <section>
        <p className="status-sample-label">All claimed and confirmed</p>
        <RefinedStatus complete />
      </section>
      <style>{`
        .sp-confirmation-overview {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 1px minmax(0, 1fr);
          align-items: center;
          gap: 18px;
          min-height: 96px;
          padding: 18px 20px;
          border: 1px solid color-mix(in srgb, currentColor 16%, transparent);
          border-radius: 18px;
          box-shadow: 0 5px 14px var(--sp-shadow);
          transition: background-color 180ms ease, box-shadow 180ms ease;
        }
        .sp-confirmation-overview .sp-overview-stat {
          display: grid;
          grid-template-columns: 38px minmax(0, 1fr);
          align-items: center;
          gap: 11px;
          min-width: 0;
        }
        .sp-overview-icon {
          display: grid;
          place-items: center;
          width: 38px;
          height: 38px;
          border-radius: 13px;
          background: color-mix(in srgb, white 48%, transparent);
          color: currentColor;
        }
        .sp-overview-value {
          display: block;
          font-size: 29px !important;
          font-weight: 750 !important;
          line-height: 1.05;
          letter-spacing: -0.8px;
          white-space: nowrap;
        }
        .sp-overview-total {
          font-size: 16px;
          font-weight: 550;
          letter-spacing: -0.2px;
          opacity: 0.76;
        }
        .sp-overview-divider {
          width: 1px;
          height: 44px;
          background: color-mix(in srgb, currentColor 19%, transparent);
        }
        .sp-confirmation-overview > div:last-child { text-align: left; }
        @media (max-width: 480px) {
          .sp-confirmation-overview { gap: 11px; padding: 16px 14px; }
          .sp-confirmation-overview .sp-overview-stat { grid-template-columns: 32px minmax(0, 1fr); gap: 8px; }
          .sp-overview-icon { width: 32px; height: 32px; border-radius: 11px; }
          .sp-overview-value { font-size: 25px !important; }
          .sp-overview-total { font-size: 14px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .sp-confirmation-overview { transition: none; }
        }
      `}</style>
    </main>
  );
}
