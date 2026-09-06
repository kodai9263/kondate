"use client";

import { Trash2 } from "lucide-react";
import { useFormStatus } from "react-dom";
import { archiveRecipe } from "@/app/app/recipes/actions";
import { Button } from "@/components/ui/Button";

export function ArchiveRecipeButton({ recipeId, recipeName }: { recipeId: string; recipeName: string }) {
  return (
    <form
      action={archiveRecipe}
      onSubmit={(event) => {
        const confirmed = window.confirm(`「${recipeName}」を削除しますか？\nメニュー一覧と今後の献立候補から非表示になります。`);
        if (!confirmed) event.preventDefault();
      }}
    >
      <input type="hidden" name="recipeId" value={recipeId} />
      <ArchiveSubmitButton recipeName={recipeName} />
    </form>
  );
}

function ArchiveSubmitButton({ recipeName }: { recipeName: string }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" variant="danger" size="sm" aria-label={`${recipeName}を一覧から削除`} disabled={pending} className="disabled:cursor-wait">
      <Trash2 size={16} aria-hidden="true" />
      {pending ? "削除中..." : "削除"}
    </Button>
  );
}
