"use client";

import { useState } from "react";

export default function DocxUploader() {
  const [html, setHtml] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setHtml("");

    const formData = new FormData(e.target);

    try {
      const response = await fetch("/api/convert", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error || "Something went wrong");

      setHtml(data.html);
    } catch (err) {
      setError(err.message);
    }

    setLoading(false);
  }

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <input type="file" name="file" accept=".doc,.docx" required />
        <button type="submit" disabled={loading}>
          {loading ? "Converting..." : "Convert DOCX to HTML"}
        </button>
      </form>

      {error && <p style={{ color: "red" }}>{error}</p>}

      {html && (
        <section
          style={{ marginTop: 20, border: "1px solid #ccc", padding: 10 }}
        >
          <h3>Converted HTML:</h3>
          <div dangerouslySetInnerHTML={{ __html: html }} />
        </section>
      )}
    </div>
  );
}
