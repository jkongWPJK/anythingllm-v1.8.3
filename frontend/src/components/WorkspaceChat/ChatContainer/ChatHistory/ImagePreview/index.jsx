import { fullApiUrl } from "@/utils/constants";

function truncateText(text = "", length = 120) {
  if (!text) return "";
  if (text.length <= length) return text;
  return `${text.slice(0, length)}…`;
}

export default function ImagePreviewGallery({ images = [] }) {
  if (!Array.isArray(images) || images.length === 0) return null;

  return (
    <div className="mt-4 flex flex-col gap-y-2">
      <span className="text-xs font-semibold uppercase text-theme-text-secondary">
        Relevant images
      </span>
      <div className="grid gap-3 sm:grid-cols-2">
        {images.map((image, index) => {
          const imageUrl = `${fullApiUrl()}/system/extracted-image?path=${encodeURIComponent(
            image.image_path
          )}`;
          const scoreLabel =
            typeof image.score === "number"
              ? image.score.toFixed(3)
              : "N/A";
          const ocrPreview = truncateText(image.metadata?.ocrText || "", 80);

          return (
            <div
              key={`${image.image_path}-${index}`}
              className="flex gap-3 rounded-md border border-theme-border bg-theme-bg-surface p-3"
            >
              <div className="h-20 w-20 overflow-hidden rounded-md bg-theme-bg-secondary">
                <img
                  src={imageUrl}
                  alt={`${image.label || `Image ${index + 1}`}`}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              </div>
              <div className="flex-1 text-xs text-theme-text">
                <p className="font-semibold text-theme-text">
                  {image.label || `Image ${index + 1}`}
                </p>
                <p className="break-all text-theme-text-secondary">
                  {image.image_path}
                </p>
                <p className="text-theme-text-secondary">Score: {scoreLabel}</p>
                {image.page !== null && image.page !== undefined && (
                  <p className="text-theme-text-secondary">Page: {image.page}</p>
                )}
                {ocrPreview && (
                  <p className="mt-1 text-theme-text-secondary">
                    OCR: {ocrPreview}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
