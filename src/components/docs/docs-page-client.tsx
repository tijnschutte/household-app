"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import PageHeader from "@/src/components/page-header";
import { Button } from "@/src/components/ui/button";
import KeyInfoCard from "@/src/components/docs/key-info-card";
import DocumentList from "@/src/components/docs/document-list";
import EmptyState from "@/src/components/docs/empty-state";
import UploadDialog from "@/src/components/docs/upload-dialog";
import type { DocsData } from "@/src/lib/docs/data";

export default function DocsPageClient({ data }: { data: DocsData }) {
  const [uploadOpen, setUploadOpen] = useState(false);
  // Categories without documents still render (their headings carry the
  // rename/delete affordances), so the empty state only applies when the
  // household has neither.
  const showList = data.documents.length > 0 || data.categories.length > 0;

  return (
    <div className="flex h-full w-full flex-col">
      <PageHeader title="Docs" />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col overflow-y-auto px-4 pt-4 pb-4">
        <div className="space-y-6">
          <KeyInfoCard keyInfo={data.keyInfo} />
          {showList ? (
            <DocumentList documents={data.documents} categories={data.categories} />
          ) : (
            <EmptyState />
          )}
        </div>
      </main>
      <div className="mx-auto w-full max-w-2xl shrink-0 border-t border-border px-4 py-3">
        <Button onClick={() => setUploadOpen(true)} className="w-full gap-2">
          <Plus className="h-4 w-4" />
          Document toevoegen
        </Button>
      </div>

      <UploadDialog open={uploadOpen} onOpenChange={setUploadOpen} categories={data.categories} />
    </div>
  );
}
