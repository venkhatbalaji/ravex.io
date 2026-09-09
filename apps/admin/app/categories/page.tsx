"use client";

import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/auth-context";
import { api, ApiError } from "@/lib/api";
import { RequireAdmin } from "@/components/require-admin";

export default function CategoriesPage() {
  return (
    <RequireAdmin>
      <CategoriesContent />
    </RequireAdmin>
  );
}

function CategoriesContent() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const { data: categories, isLoading } = useQuery({ queryKey: ["categories"], queryFn: () => api.categories() });
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  async function create(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.createCategory(token!, name);
      setName("");
      queryClient.invalidateQueries({ queryKey: ["categories"] });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create the category.");
    }
  }

  async function saveRename(id: string) {
    setError(null);
    try {
      await api.updateCategory(token!, id, editingName);
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: ["categories"] });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not rename the category.");
    }
  }

  async function remove(id: string) {
    setError(null);
    try {
      await api.deleteCategory(token!, id);
      queryClient.invalidateQueries({ queryKey: ["categories"] });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete the category.");
    }
  }

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-semibold text-fg">Categories</h1>

      <form onSubmit={create} className="flex max-w-md gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Cricket"
          required
          className="flex-1 rounded-md border border-border-strong bg-surface-2 px-3 py-2 text-sm text-fg outline-none focus:border-accent"
        />
        <button
          type="submit"
          className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-fg transition hover:opacity-90"
        >
          Add
        </button>
      </form>
      {error && <p className="text-sm text-danger">{error}</p>}

      {isLoading && <p className="text-sm text-muted">Loading…</p>}

      <ul className="max-w-md divide-y divide-border overflow-hidden rounded-lg border border-border">
        {categories?.map((category) => (
          <li key={category.id} className="flex items-center justify-between gap-3 px-4 py-3">
            {editingId === category.id ? (
              <input
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                autoFocus
                className="flex-1 rounded-md border border-border-strong bg-surface-2 px-2 py-1 text-sm text-fg outline-none focus:border-accent"
              />
            ) : (
              <span className="text-sm text-fg">{category.name}</span>
            )}
            <div className="flex shrink-0 gap-3 text-xs">
              {editingId === category.id ? (
                <>
                  <button onClick={() => saveRename(category.id)} className="text-accent hover:underline">
                    Save
                  </button>
                  <button onClick={() => setEditingId(null)} className="text-muted hover:underline">
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => {
                      setEditingId(category.id);
                      setEditingName(category.name);
                    }}
                    className="text-muted hover:text-fg"
                  >
                    Rename
                  </button>
                  <button onClick={() => remove(category.id)} className="text-danger hover:underline">
                    Delete
                  </button>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
      {categories?.length === 0 && !isLoading && <p className="text-sm text-muted">No categories yet.</p>}
    </div>
  );
}
