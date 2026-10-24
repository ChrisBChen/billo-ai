import "./_group.css";

function ExistingStatus({ complete = false }: { complete?: boolean }) {
  return (
    <div
      className={`sp-payment-overview${complete ? "" : " confirmation-pending"}`}
      role="group"
      aria-label="Bill confirmation status"
    >
      <div>
        <small>Confirmed</small>
        <strong>{complete ? "4 of 4" : "2 of 5"}</strong>
      </div>
      <div>
        <small>Unclaimed</small>
        <strong>{complete ? "None" : "3"}</strong>
      </div>
    </div>
  );
}

export function Current() {
  return (
    <main className="split-v2 status-preview">
      <section>
        <p className="status-sample-label">In progress</p>
        <ExistingStatus />
      </section>
      <section>
        <p className="status-sample-label">All claimed and confirmed</p>
        <ExistingStatus complete />
      </section>
    </main>
  );
}
