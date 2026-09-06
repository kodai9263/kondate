"use client";

import { Trash2 } from "lucide-react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/Button";
import { removeRecipe } from "@/app/app/recipes/actions";

type ArchiveRecipeButtonProps = { recipeName: string } & (
  | { recipeKind: "custom"; recipeId: string }
  | { recipeKind: "official"; recipeKey: string }
);

export function ArchiveRecipeButton(props: ArchiveRecipeButtonProps) {
  const { recipeKind, recipeName } = props;
  return (
    <form
      action={removeRecipe}
      onSubmit={(event) => {
        const confirmed = window.confirm(`「${recipeName}」を削除しますか？\nメニュー一覧と今後の献立候補から非表示になります。`);
        if (!confirmed) event.preventDefault();
      }}
    >
      <input type="hidden" name="recipeKind" value={recipeKind} />
      {recipeKind === "custom" ? <input type="hidden" name="recipeId" value={props.recipeId} /> : <input type="hidden" name="recipeKey" value={props.recipeKey} />}
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
