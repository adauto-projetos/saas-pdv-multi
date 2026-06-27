"use client";

import * as React from "react";
import { toast } from "sonner";

import { removeProductImageAction } from "@/app/(app)/products/actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

type ProductImageResponse = { imageUrl: string };
type ApiError = { error: string };

type ProductImageUploadProps = {
  /** Quando presente, está em modo edição: upload/remoção são imediatos. */
  productId?: string;
  /** Foto já salva (URL pública). Inicializa o preview. */
  defaultImageUrl?: string | null;
  /** Emoji do produto — fallback de exibição quando não há foto. */
  emoji?: string | null;
  /** Notifica o parent do arquivo staged (modo create), p/ enviar após o save. */
  onStagedChange?: (file: File | null) => void;
};

/** true quando a URL é um blob local (preview pré-save), não a URL pública do R2. */
function isBlobUrl(url: string | null): boolean {
  return url != null && url.startsWith("blob:");
}

/**
 * Upload de foto do produto (RF03). Em modo create (sem `productId`) apenas guarda o
 * arquivo staged + preview blob; o parent dispara o upload após o create (RF01). Em
 * modo edição faz upload imediato na seleção e remoção imediata via server action.
 * Exibição com `<img loading="lazy">` (RNF03); fallback foto → emoji → 📦 (RF05).
 */
export function ProductImageUpload({
  productId,
  defaultImageUrl,
  emoji,
  onStagedChange,
}: ProductImageUploadProps) {
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(
    defaultImageUrl ?? null,
  );
  const [uploading, setUploading] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Revoga o blob anterior quando o preview muda ou no unmount (evita vazamento).
  React.useEffect(() => {
    return () => {
      if (isBlobUrl(previewUrl)) {
        URL.revokeObjectURL(previewUrl as string);
      }
    };
  }, [previewUrl]);

  function replacePreview(next: string | null) {
    setPreviewUrl((prev) => {
      if (isBlobUrl(prev) && prev !== next) {
        URL.revokeObjectURL(prev as string);
      }
      return next;
    });
  }

  async function handleSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Permite re-selecionar o mesmo arquivo numa próxima vez.
    event.target.value = "";
    if (!file) return;

    const blobUrl = URL.createObjectURL(file);
    replacePreview(blobUrl);

    if (!productId) {
      // Modo create: só guarda o arquivo; o parent envia após o save (RF01).
      onStagedChange?.(file);
      return;
    }

    // Modo edição: upload imediato (RF02/RF06).
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch(`/api/products/${productId}/upload`, {
        method: "POST",
        body,
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as ApiError | null;
        toast.error(data?.error ?? "Não foi possível enviar a foto.");
        return;
      }
      const data = (await res.json()) as ProductImageResponse;
      replacePreview(data.imageUrl);
      toast.success("Foto atualizada");
    } catch {
      toast.error("Não foi possível enviar a foto.");
    } finally {
      setUploading(false);
    }
  }

  async function handleRemove() {
    const wasSavedPhoto = !!productId && !isBlobUrl(previewUrl) && !!previewUrl;

    // Limpa o staged + preview local imediatamente (RF03).
    replacePreview(null);
    onStagedChange?.(null);

    if (wasSavedPhoto) {
      // Modo edição com foto já salva: remove no R2 + zera o banco (RF02/RF09).
      setUploading(true);
      try {
        const result = await removeProductImageAction({ id: productId });
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        toast.success("Foto removida");
      } finally {
        setUploading(false);
      }
    }
  }

  const hasPreview = previewUrl != null;

  return (
    <div className="grid gap-2">
      <Label htmlFor="product-image">Foto do produto</Label>
      <div className="flex items-center gap-4">
        <div className="flex h-28 w-28 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl border border-input bg-muted text-4xl">
          {hasPreview ? (
            <img
              src={previewUrl as string}
              alt="Pré-visualização da foto do produto"
              loading="lazy"
              className="h-full w-full object-contain"
            />
          ) : (
            <span aria-hidden>{emoji || "📦"}</span>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <input
            ref={inputRef}
            id="product-image"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleSelect}
          />
          <Button
            type="button"
            variant="outline"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading
              ? "Enviando..."
              : hasPreview
                ? "Trocar foto"
                : "Escolher foto"}
          </Button>
          {hasPreview ? (
            <Button
              type="button"
              variant="ghost"
              disabled={uploading}
              onClick={handleRemove}
              className="text-destructive hover:text-destructive"
            >
              Remover foto
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
