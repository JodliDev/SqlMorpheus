export type ForeignKeyActions = "SET NULL" | "SET DEFAULT" | "RESTRICT" | "NO ACTION" | "CASCADE"

export interface ForeignKeyInfo {
	fromTable: string;
	fromColumn: string;
	toTable: string;
	toColumn: string;
	onUpdate?: ForeignKeyActions;
	onDelete?: ForeignKeyActions;
}
