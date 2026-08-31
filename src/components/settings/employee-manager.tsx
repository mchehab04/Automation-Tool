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
import { createEmployee, updateEmployee, deleteEmployee } from "@/lib/actions/employees";
import { MAX_LENGTHS, MIN_PASSWORD_LENGTH, isValidEmail } from "@/lib/validation";

export type EmployeeRow = { id: string; name: string; email: string; createdAt: string };

export function EmployeeManager({ items, isOwner }: { items: EmployeeRow[]; isOwner: boolean }) {
  // editingItem: null while dialog is closed. When open, undefined means
  // "add new", an item means "edit that item" — mirrors catalog-manager.tsx
  // / stage-select.tsx's pattern: fields are reset explicitly by whichever
  // handler opens the dialog, not derived during render.
  const [editingItem, setEditingItem] = useState<EmployeeRow | undefined | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const dialogOpen = editingItem !== null;
  // Password is required to add, optional to edit (blank = keep current).
  const isValid =
    name.trim().length > 0 &&
    isValidEmail(email) &&
    email.trim().length > 0 &&
    (editingItem ? password.length === 0 || password.length >= MIN_PASSWORD_LENGTH : password.length >= MIN_PASSWORD_LENGTH);

  const openAdd = () => {
    setName("");
    setEmail("");
    setPassword("");
    setEditingItem(undefined);
  };
  const openEdit = (item: EmployeeRow) => {
    setName(item.name);
    setEmail(item.email);
    setPassword("");
    setEditingItem(item);
  };
  const closeDialog = () => setEditingItem(null);

  const handleSubmit = async (formData: FormData) => {
    setSaving(true);
    try {
      if (editingItem) {
        await updateEmployee(editingItem.id, formData);
        toast.success("Employee updated.");
      } else {
        await createEmployee(formData);
        toast.success("Employee added.");
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
      await deleteEmployee(id);
      toast.success("Employee removed.");
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
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              {isOwner ? <TableHead className="w-20" /> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{item.name}</TableCell>
                <TableCell className="text-muted-foreground">{item.email}</TableCell>
                {isOwner ? (
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Edit employee"
                        onClick={() => openEdit(item)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Remove employee"
                        disabled={deletingId === item.id}
                        onClick={() => handleDelete(item.id)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                ) : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
          No employees yet.
        </p>
      )}

      {isOwner ? (
        <Button type="button" variant="outline" size="sm" className="self-start" onClick={openAdd}>
          <Plus className="size-4" /> Add employee
        </Button>
      ) : null}

      <Dialog open={dialogOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent>
          <form action={handleSubmit} className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>{editingItem ? "Edit employee" : "Add employee"}</DialogTitle>
              <DialogDescription>
                {editingItem
                  ? "Leave the password blank to keep their current one."
                  : "They'll use this email and password to sign in — share it with them directly."}
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="employee-name">Name</Label>
              <Input
                id="employee-name"
                name="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={MAX_LENGTHS.name + 20}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="employee-email">Email</Label>
              <Input
                id="employee-email"
                name="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                maxLength={MAX_LENGTHS.email + 20}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="employee-password">
                {editingItem ? "New password" : "Temporary password"}
              </Label>
              <Input
                id="employee-password"
                name="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                placeholder={editingItem ? "Leave blank to keep current" : undefined}
              />
              <p className="text-xs text-muted-foreground">
                {editingItem
                  ? `Leave blank to keep their current password, or set a new one (at least ${MIN_PASSWORD_LENGTH} characters) — this signs them out everywhere.`
                  : `At least ${MIN_PASSWORD_LENGTH} characters.`}
              </p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>
                Cancel
              </Button>
              <Button type="submit" disabled={!isValid || saving}>
                {saving ? "Saving…" : editingItem ? "Save" : "Add employee"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
