class GemmaEmbedder {
  constructor({ model = null } = {}) {
    this.model =
      model || process.env.OLLAMA_IMAGE_EMBED_MODEL || "gemma3:27b";
    this.basePath =
      process.env.OLLAMA_BASE_PATH ||
      process.env.EMBEDDING_BASE_PATH ||
      "http://127.0.0.1:11434";
    this.headers = {
      "Content-Type": "application/json",
    };
    if (process.env.OLLAMA_AUTH_TOKEN) {
      this.headers["Authorization"] = `Bearer ${process.env.OLLAMA_AUTH_TOKEN}`;
    }
  }

  log(text, ...args) {
    console.log(`\x1b[36m[GemmaEmbedder]\x1b[0m ${text}`, ...args);
  }

  async #ensureAlive() {
    return await fetch(this.basePath)
      .then((res) => res.ok)
      .catch((err) => {
        this.log(`Failed to reach Ollama at ${this.basePath}: ${err.message}`);
        return false;
      });
  }

  async embedBatch(texts = []) {
    if (!Array.isArray(texts) || texts.length === 0) return [];
    if (!(await this.#ensureAlive())) {
      throw new Error(
        `Ollama service could not be reached at ${this.basePath}.`
      );
    }

    const cleanedTexts = texts.map((text) =>
      typeof text === "string" && text.trim().length > 0
        ? text
        : "Empty description"
    );

    const embeddings = [];
    for (const text of cleanedTexts) {
      try {
        const response = await fetch(`${this.basePath}/api/embeddings`, {
          method: "POST",
          headers: this.headers,
          body: JSON.stringify({
            model: this.model,
            prompt: text,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(
            `Embedding request failed with status ${response.status}: ${errorText}`
          );
        }

        const payload = await response.json();
        if (!payload || !Array.isArray(payload.embedding)) {
          throw new Error("Embedding response missing embedding vector");
        }
        embeddings.push(payload.embedding);
      } catch (error) {
        this.log(`Embedding failed: ${error.message}`);
        throw error;
      }
    }

    return embeddings;
  }

  async embedText(text = "") {
    const [embedding] = await this.embedBatch([text]);
    return embedding || [];
  }
}

module.exports = { GemmaEmbedder };
