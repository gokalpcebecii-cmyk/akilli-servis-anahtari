"use client";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main style={{ maxWidth: 420, margin: "80px auto", padding: "0 20px", fontFamily: "system-ui, sans-serif", textAlign: "center" }}>
      <h1 style={{ fontSize: 20 }}>Bir sorun oluştu</h1>
      <p style={{ color: "#666", marginBottom: 20 }}>Sayfa yüklenirken bir hata oluştu. Lütfen tekrar deneyin.</p>
      <button
        onClick={() => reset()}
        style={{ padding: "10px 20px", background: "#1E3A5F", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer" }}
      >
        Tekrar Dene
      </button>
    </main>
  );
}
