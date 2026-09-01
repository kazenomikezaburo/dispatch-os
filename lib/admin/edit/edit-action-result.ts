export const editConflictMessage =
  "別の管理者によって内容が更新されています。最新情報を読み込んでからもう一度編集してください。";

export const editForbiddenMessage = "この内容を編集する権限がありません。";

export const editGeneralErrorMessage =
  "変更を保存できませんでした。最新の情報を確認して再度お試しください。";

export type EditActionResult<FieldName extends string = string> =
  | {
      ok: true;
      type: "updated" | "no_change";
      id: string;
      updatedAt: string;
    }
  | {
      ok: false;
      type: "validation";
      message: string;
      fieldErrors?: Partial<Record<FieldName, string>>;
    }
  | {
      ok: false;
      type: "conflict";
      message: string;
    }
  | {
      ok: false;
      type: "forbidden";
      message: string;
    }
  | {
      ok: false;
      type: "not_found";
      message: string;
    }
  | {
      ok: false;
      type: "error";
      message: string;
    };
