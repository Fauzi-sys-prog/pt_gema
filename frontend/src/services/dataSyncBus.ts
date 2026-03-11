const ERP_DATA_SYNC_EVENT = "erp:data-sync";

export function emitDataSync(reason = "unknown") {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(ERP_DATA_SYNC_EVENT, {
      detail: { reason, at: Date.now() },
    })
  );
}

export function subscribeDataSync(handler: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }
  const listener = () => handler();
  window.addEventListener(ERP_DATA_SYNC_EVENT, listener as EventListener);
  return () => {
    window.removeEventListener(ERP_DATA_SYNC_EVENT, listener as EventListener);
  };
}

