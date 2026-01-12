export const ALLOWED = "allowed";
export const USED = "allowedAndUsed";
type AllowedMigrationState = typeof ALLOWED | typeof USED;

export interface AllowedMigrations {
	recreateTable?: Record<string, AllowedMigrationState>;
	dropTable?: Record<string, AllowedMigrationState>;
	dropColumn?: Record<string, AllowedMigrationState>;
	alterPrimaryKey?: Record<string, AllowedMigrationState>;
	removeForeignKey?: Record<string, AllowedMigrationState>;
	alterForeignKey?: Record<string, AllowedMigrationState>;
}

export const NO_COLUMN = "noColumn";