"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/dialog";
import CategorySelect from "@/src/components/docs/category-select";
import {
  ALLOWED_CONTENT_TYPES,
  MAX_UPLOAD_BYTES,
  isAllowedContentType,
} from "@/src/lib/docs/constants";
import type { DocCategoryRow } from "@/src/lib/docs/data";

// Strips the extension for a friendlier default display name, e.g.
// "energiecontract.pdf" -> "energiecontract".
function nameFromFilename(filename: string): string {
  const withoutExt = filename.replace(/\.[^./]+$/, "");
  return withoutExt.slice(0, 60);
}

export default function UploadDialog({
  open,
  onOpenChange,
  categories,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: DocCategoryRow[];
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const reset = () => {
    setFile(null);
    setName("");
    setCategoryId(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] ?? null;
    setFile(selected);
    if (selected) {
      setName((current) => current || nameFromFilename(selected.name));
    }
  };

  const handleConfirm = async () => {
    if (!file) {
      toast.error("Kies een bestand");
      return;
    }
    if (!isAllowedContentType(file.type)) {
      toast.error("Bestandstype niet toegestaan (pdf, png, jpeg, webp of heic)");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error("Bestand is te groot (max 4MB)");
      return;
    }
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error("Voer een naam in");
      return;
    }

    const formData = new FormData();
    formData.set("file", file);
    formData.set("name", trimmedName);
    if (categoryId !== null) {
      formData.set("categoryId", String(categoryId));
    }

    setIsUploading(true);
    try {
      const response = await fetch("/api/docs/upload", { method: "POST", body: formData });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? "Uploaden mislukt");
      }
      toast.success("Document geüpload");
      reset();
      onOpenChange(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Uploaden mislukt");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (isUploading) return;
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Document toevoegen</DialogTitle>
          <DialogDescription>Pdf, png, jpeg, webp of heic — maximaal 4MB.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="doc-file">Bestand</Label>
            <Input
              id="doc-file"
              type="file"
              ref={fileInputRef}
              accept={ALLOWED_CONTENT_TYPES.join(",")}
              onChange={handleFileChange}
              disabled={isUploading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="doc-upload-name">Naam</Label>
            <Input
              id="doc-upload-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="bijv. Huurcontract"
              maxLength={60}
              disabled={isUploading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="doc-category">Categorie</Label>
            <CategorySelect
              id="doc-category"
              categories={categories}
              value={categoryId}
              onChange={setCategoryId}
              disabled={isUploading}
            />
          </div>
        </div>
        <DialogFooter className="gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isUploading}>
            Annuleren
          </Button>
          <Button onClick={handleConfirm} disabled={isUploading}>
            {isUploading ? "Bezig met uploaden..." : "Uploaden"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
