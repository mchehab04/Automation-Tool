"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { createCatalogItem, updateCatalogItem, deleteCatalogItem } from "@/lib/actions/business-settings";
import { MAX_LENGTHS, parseForgivingNumber } from "@/lib/validation";

export type CatalogItem = { id: string; description: string; unitPrice: number };

function formatMoney(cents: number) {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export function CatalogManager({ items }: { items: CatalogItem[] }) {
  // editingItem: null while dialog is closed. When open, undefined means "add
  // new", an item means "edit that item" — mirrors stage-select.tsx's
  // pendingStage pattern: the field values below are reset explicitly by
  // whichever handler opens the dialog, not derived during render.
  const [editingItem, setEditingItem] = useState<CatalogItem | undefined | null>(null);
  const [description, setDescription] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const dialogOpen = editingItem !== null;
  const isValid = description.trim().length > 0 && parseForgivingNumber(unitPrice) >= 0;

  const openAdd = () => {
    setDescription("");
    setUnitPrice("");
    setEditingItem(undefined);
  };
  const openEdit = (item: CatalogItem) => {
    setDescription(item.description);
    setUnitPrice(String(item.unitPrice / 100));
    setEditingItem(item);
  };
  const closeDialog = () => setEditingItem(null);

  const handleSubmit = async (formData: FormData) => {
    setSaving(true);
    try {
      if (editingItem) {
        await updateCatalogItem(editingItem.id, formData);
        toast.success("Item updated.");
      } else {
        await createCatalogItem(formData);
        toast.success("Item added.");
      }
      closeDialog();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteCatalogItem(id);
      toast.success("Item removed.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {items.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{item.description}</TableCell>
                <TableCell className="text-right tabular-nums">{formatMoney(item.unitPrice)}</TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Edit item"
                      onClick={() => openEdit(item)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Remove item"
                      disabled={deletingId === item.id}
                      onClick={() => handleDelete(item.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
          No catalogue items yet — add one so the AI can quote against real prices.
        </p>
      )}

      <Button type="button" variant="outline" size="sm" className="self-start" onClick={openAdd}>
        <Plus className="size-4" /> Add item
      </Button>

      <Dialog open={dialogOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent>
          <form action={handleSubmit} className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>{editingItem ? "Edit item" : "Add catalogue item"}</DialogTitle>
              <DialogDescription>
                Grounds the AI&apos;s quote suggestions in real prices instead of guessing.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="item-description">Description</Label>
              <Input
                id="item-description"
                name="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Oil change"
                maxLength={MAX_LENGTHS.quoteDescription + 20}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="item-price">Unit price</Label>
              <Input
                id="item-price"
                name="unitPrice"
                inputMode="decimal"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                placeholder="$0.00"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>
                Cancel
              </Button>
              <Button type="submit" disabled={!isValid || saving}>
                {saving ? "Saving…" : editingItem ? "Save" : "Add item"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
