export type AccountType = "worker" | "manager" | "system_admin";

export type CurrentProfile = {
  id: string;
  display_name: string;
  account_type: AccountType;
  is_active: boolean;
};

export type CurrentProfileResult =
  | { status: "authenticated"; profile: CurrentProfile }
  | { status: "unauthenticated" }
  | { status: "inactive"; profile: CurrentProfile }
  | { status: "misconfigured" };
